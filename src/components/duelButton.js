import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'duel',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, eventId, userId] = extraData;
      
      // Handle duel click
      if (action === 'click') {
        // Get event from database
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        // Check if event exists
        if (!event) {
          return interaction.reply({
            content: 'Ce duel n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Check if already completed
        if (event.data.completed) {
          return interaction.reply({
            content: '❌ Ce duel est déjà terminé!',
            ephemeral: true
          });
        }
        
        // Check if user is part of the duel
        if (!event.data.users.includes(userId)) {
          return interaction.reply({
            content: '❌ Vous n\'êtes pas participant à ce duel!',
            ephemeral: true
          });
        }
        
        // Check if user is using the correct button
        if (interaction.user.id !== userId) {
          return interaction.reply({
            content: '❌ Ce n\'est pas votre bouton!',
            ephemeral: true
          });
        }
        
        // Anti-spam check using database timestamp or in-memory Map
        // This would be implemented in a more sophisticated way in production
        
        // Update clicks count
        event.data.clicks[userId]++;
        
        // Extract the current click counts from the event data
        const user1 = event.data.users[0];
        const user2 = event.data.users[1];
        const clicks1 = event.data.clicks[user1];
        const clicks2 = event.data.clicks[user2];
        
        // Update the message embed with new click counts
        await interaction.message.fetch(); // Ensure we have the latest message data
        
        const updatedEmbed = EmbedCreator.create({
          title: interaction.message.embeds[0].title,
          description: interaction.message.embeds[0].description,
          color: interaction.message.embeds[0].color,
          fields: [
            {
              name: `<@${user1}>`,
              value: `${clicks1} clics`,
              inline: true
            },
            {
              name: `<@${user2}>`,
              value: `${clicks2} clics`,
              inline: true
            }
          ],
          footer: interaction.message.embeds[0].footer,
          timestamp: true
        });
        
        // Acknowledge the interaction without sending a new message
        await interaction.deferUpdate();
        
        // Update the message
        await interaction.message.edit({
          embeds: [updatedEmbed],
          components: interaction.message.components
        });
      }
    } catch (error) {
      console.error('Error handling duel button:', error);
      
      await interaction.reply({
        content: 'Une erreur est survenue lors du traitement de ce duel.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};