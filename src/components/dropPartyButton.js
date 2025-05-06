import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'drop_party',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, eventId] = extraData;
      
      // Handle joining drop party
      if (action === 'join') {
        // Get event from database
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        if (!event) {
          return interaction.reply({
            content: '❌ Cet événement n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Check if user already participated
        if (event.data.participants.includes(interaction.user.id)) {
          return interaction.reply({
            content: '❌ Vous participez déjà à cet événement!',
            ephemeral: true
          });
        }
        
        await interaction.deferUpdate();
        
        // Add user to participants
        event.data.participants.push(interaction.user.id);
        
        // Update event in database
        await client.db.db.run(`
          UPDATE events
          SET data = ?
          WHERE id = ?
        `, JSON.stringify(event.data), eventId);
        
        // Update participant count in embed
        const message = await interaction.message.fetch();
        const updatedEmbed = EmbedCreator.create({
          title: '🎉 Drop Party!',
          description: `Une pluie de cadeaux! Chaque participant reçoit **${event.data.rewardPerPerson}** crédits!\nCliquez sur le bouton ci-dessous pour participer!\n\nParticipants: **${event.data.participants.length}**`,
          color: 'EVENT',
          footer: { text: 'L\'événement se termine dans 45 secondes!' },
          timestamp: true
        });
        
        await message.edit({
          embeds: [updatedEmbed],
          components: message.components
        });
        
        // Send confirmation message
        await interaction.followUp({
          content: `✅ Vous participez maintenant au Drop Party! Vous recevrez **${event.data.rewardPerPerson}** crédits à la fin de l'événement.`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error handling drop party button:', error);
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du traitement de votre participation.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};