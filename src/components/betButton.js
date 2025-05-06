import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'bet',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, betId, ...args] = extraData;
      
      // Get the bet command to use its helper methods
      const betCommand = client.commands.get('bet');
      
      // Handle vote action
      if (action === 'vote') {
        const optionIndex = parseInt(args[0]);
        const userId = interaction.user.id;
        
        // Add vote
        const success = await betCommand.addVote(client, betId, userId, optionIndex);
        
        if (success) {
          // Notify the user
          await interaction.reply({
            content: `✅ Vous avez voté pour l'option ${optionIndex + 1}!`,
            ephemeral: true
          });
          
          // Get updated bet
          const bet = await betCommand.getBet(client, betId);
          
          // Count votes for display
          const voteCounts = Array(bet.options.length).fill(0);
          
          Object.values(bet.votes).forEach(index => {
            voteCounts[index]++;
          });
          
          // Update embed fields to show vote counts
          const updatedFields = bet.options.map((option, index) => ({
            name: `Option ${index + 1}`,
            value: `${option}\n${voteCounts[index]} vote${voteCounts[index] !== 1 ? 's' : ''}`,
            inline: true
          }));
          
          // Get the original embed
          const originalEmbed = interaction.message.embeds[0];
          
          // Create updated embed
          const updatedEmbed = EmbedCreator.create({
            title: originalEmbed.title,
            description: originalEmbed.description,
            color: originalEmbed.color,
            fields: updatedFields,
            footer: originalEmbed.footer,
            timestamp: true
          });
          
          // Update message
          await interaction.message.edit({
            embeds: [updatedEmbed],
            components: interaction.message.components
          });
        } else {
          await interaction.reply({
            content: '❌ Ce pari est déjà terminé ou n\'existe plus.',
            ephemeral: true
          });
        }
      }
      
      // Handle end action
      else if (action === 'end') {
        const creatorId = args[0];
        
        // Verify that the user is the creator of the bet
        if (interaction.user.id !== creatorId) {
          return interaction.reply({
            content: '❌ Seul le créateur du pari peut le terminer manuellement.',
            ephemeral: true
          });
        }
        
        // Ask for winner selection
        const bet = await betCommand.getBet(client, betId);
        
        if (!bet || bet.ended) {
          return interaction.reply({
            content: '❌ Ce pari est déjà terminé ou n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Create selection buttons for winner
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        
        const selectionRow = new ActionRowBuilder();
        
        for (let i = 0; i < bet.options.length; i++) {
          selectionRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`bet:select_winner:${betId}:${i}`)
              .setLabel(`Option ${i + 1}`)
              .setStyle(ButtonStyle.Success)
          );
        }
        
        // Add no winner option
        selectionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`bet:select_winner:${betId}:null`)
            .setLabel('Aucun gagnant')
            .setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.reply({
          content: 'Sélectionnez l\'option gagnante:',
          components: [selectionRow],
          ephemeral: true
        });
      }
      
      // Handle winner selection
      else if (action === 'select_winner') {
        const winnerIndex = args[0] === 'null' ? null : parseInt(args[0]);
        
        // End the bet with the selected winner
        const success = await betCommand.endBet(client, betId, winnerIndex, interaction.message);
        
        if (success) {
          await interaction.update({
            content: '✅ Le pari a été terminé avec succès!',
            components: []
          });
        } else {
          await interaction.update({
            content: '❌ Ce pari est déjà terminé ou n\'existe plus.',
            components: []
          });
        }
      }
    } catch (error) {
      console.error('Error handling bet button:', error);
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du traitement de votre action.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};