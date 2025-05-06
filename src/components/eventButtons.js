import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'meteor',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, eventId] = extraData;
      
      // Handle meteor claim
      if (action === 'claim') {
        // Get event from database
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        // Check if event exists
        if (!event) {
          return interaction.reply({
            content: 'Cet événement n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Check if already claimed
        if (event.data.claimed) {
          return interaction.reply({
            content: '❌ Cette météorite a déjà été récupérée!',
            ephemeral: true
          });
        }
        
        await interaction.deferUpdate();
        
        // Mark event as claimed
        event.data.claimed = true;
        event.data.claimedBy = interaction.user.id;
        await client.db.completeEvent(eventId);
        
        // Award credits
        await client.db.updateUserBalance(interaction.user.id, event.data.reward);
        
        // Add experience
        const xpAmount = Math.floor(Math.random() * 10) + 10; // 10-20 XP
        const xpResult = await client.db.addExperience(interaction.user.id, xpAmount);
        
        // Update message
        const updatedEmbed = EmbedCreator.success(
          '🌠 Météorite récupérée!',
          `<@${interaction.user.id}> a récupéré la météorite et gagné **${event.data.reward}** crédits!`,
          {
            fields: [
              {
                name: '⭐ XP gagnée',
                value: `+${xpAmount} XP`,
                inline: true
              }
            ]
          }
        );
        
        // Add level up information if applicable
        if (xpResult.leveledUp) {
          updatedEmbed.addFields({
            name: '🎉 Niveau supérieur!',
            value: `<@${interaction.user.id}> est passé au niveau **${xpResult.newLevel}**!`,
            inline: false
          });
        }
        
        await interaction.message.edit({
          embeds: [updatedEmbed],
          components: []
        });
      }
    } catch (error) {
      console.error('Error handling event button:', error);
      
      await interaction.reply({
        content: 'Une erreur est survenue lors du traitement de cet événement.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};