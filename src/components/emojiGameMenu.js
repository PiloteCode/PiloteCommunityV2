import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

export default {
  customId: 'emoji_game',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, eventId, position] = extraData;
      
      // Handle emoji selection
      if (action === 'select') {
        // Get event from database
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        if (!event) {
          return interaction.reply({
            content: '❌ Cet événement n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Check if game already completed
        if (event.data.completed) {
          return interaction.reply({
            content: '❌ Ce jeu est déjà terminé!',
            ephemeral: true
          });
        }
        
        // Get the emoji sequence
        const sequence = event.data.sequence;
        const selectedEmoji = interaction.values[0];
        const positionIndex = parseInt(position);
        
        // Initialize user selections tracking
        if (!client.emojiSelections) {
          client.emojiSelections = new Map();
        }
        
        // Get user's current selections
        const userId = interaction.user.id;
        if (!client.emojiSelections.has(userId)) {
          client.emojiSelections.set(userId, []);
        }
        
        const userSelections = client.emojiSelections.get(userId);
        
        // Update the selection at this position
        if (positionIndex < userSelections.length) {
          userSelections[positionIndex] = selectedEmoji;
        } else {
          userSelections.push(selectedEmoji);
        }
        
        // Determine next position
        const nextPosition = userSelections.length;
        
        // Define emoji options
        const emojis = ['🍎', '🍌', '🍒', '🍓', '🍊', '🍋', '🍉', '🍇', '🍍', '🥝'];
        
        // Check if user completed the sequence
        if (nextPosition === sequence.length) {
          // Check if sequence is correct
          const isCorrect = userSelections.every((emoji, index) => emoji === sequence[index]);
          
          if (isCorrect) {
            // Mark as completed
            event.data.completed = true;
            event.data.winner = userId;
            await client.db.completeEvent(eventId);
            
            // Award credits
            await client.db.updateUserBalance(userId, event.data.reward);
            
            // Add experience
            const xpAmount = Math.floor(Math.random() * 6) + 10; // 10-15 XP
            const xpResult = await client.db.addExperience(userId, xpAmount);
            
            // Create success embed
            const successEmbed = EmbedCreator.success(
              '🎮 Jeu d\'Émoji - Gagné!',
              `<@${userId}> a correctement reproduit la séquence **${sequence.join(' ')}** et gagne **${event.data.reward}** crédits!`,
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
            
            // Add level up notification if applicable
            if (xpResult.leveledUp) {
              successEmbed.addFields({
                name: '🎉 Niveau supérieur!',
                value: `<@${userId}> est passé au niveau **${xpResult.newLevel}**!`,
                inline: false
              });
            }
            
            await interaction.update({
              embeds: [successEmbed],
              components: []
            });
            
            // Clear user selections
            client.emojiSelections.delete(userId);
            
          } else {
            // Sequence incorrect
            await interaction.reply({
              content: `❌ Séquence incorrecte! La bonne séquence était **${sequence.join(' ')}**. Vous pouvez réessayer.`,
              ephemeral: true
            });
            
            // Reset user selections
            client.emojiSelections.set(userId, []);
            
            // Create new menu for first selection
            const resetMenu = new ActionRowBuilder()
              .addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId(`emoji_game:select:${eventId}:0`)
                  .setPlaceholder('Sélectionnez le 1er émoji')
                  .addOptions(
                    emojis.map(emoji => ({
                      label: emoji,
                      value: emoji,
                      emoji: emoji
                    }))
                  )
              );
            
            await interaction.message.edit({
              components: [resetMenu]
            });
          }
        } else {
          // Continue with next selection
          const nextMenu = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`emoji_game:select:${eventId}:${nextPosition}`)
                .setPlaceholder(`Sélectionnez le ${nextPosition + 1}e émoji`)
                .addOptions(
                  emojis.map(emoji => ({
                    label: emoji,
                    value: emoji,
                    emoji: emoji
                  }))
                )
            );
          
          await interaction.update({
            components: [nextMenu]
          });
        }
      }
    } catch (error) {
      console.error('Error handling emoji game menu:', error);
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du traitement de votre sélection.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};