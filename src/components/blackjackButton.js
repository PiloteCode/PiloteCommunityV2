import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'blackjack',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, userId] = extraData;
      
      // Verify that the user who clicked is the one who initiated
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: 'Vous ne pouvez pas jouer la partie de quelqu\'un d\'autre.',
          ephemeral: true
        });
      }
      
      // Check if game exists
      if (!client.blackjackGames || !client.blackjackGames.has(userId)) {
        return interaction.reply({
          content: 'Cette partie n\'existe plus.',
          ephemeral: true
        });
      }
      
      // Get the blackjack command to use its helper methods
      const blackjackCommand = client.commands.get('blackjack');
      
      // Handle hit action
      if (action === 'hit') {
        await blackjackCommand.handleHit(client, userId, interaction);
      }
      
      // Handle stand action
      else if (action === 'stand') {
        await blackjackCommand.handleStand(client, userId, interaction);
      }
    } catch (error) {
      console.error('Error handling blackjack button:', error);
      
      await interaction.reply({
        content: 'Une erreur est survenue lors du traitement de votre action.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};