import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'quiz',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, eventId, answerIndex] = extraData;
      
      // Handle quiz answer
      if (action === 'answer') {
        // Get event from database
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        // Check if event exists
        if (!event) {
          return interaction.reply({
            content: 'Ce quiz n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Check if already answered
        if (event.data.answered) {
          return interaction.reply({
            content: '❌ Quelqu\'un a déjà répondu à cette question!',
            ephemeral: true
          });
        }
        
        await interaction.deferUpdate();
        
        // Mark event as answered
        event.data.answered = true;
        event.data.answeredBy = interaction.user.id;
        event.data.selectedAnswer = parseInt(answerIndex);
        await client.db.completeEvent(eventId);
        
        // Check if answer is correct
        const isCorrect = parseInt(answerIndex) === event.data.answer;
        
        // Process rewards
        if (isCorrect) {
          // Award credits
          await client.db.updateUserBalance(interaction.user.id, event.data.reward);
          
          // Add experience
          const xpAmount = Math.floor(Math.random() * 5) + 5; // 5-10 XP
          const xpResult = await client.db.addExperience(interaction.user.id, xpAmount);
          
          // Update message
          const successEmbed = EmbedCreator.success(
            '🧠 Quiz - Bonne réponse!',
            `**Question:** ${event.data.question}\n\n**Réponse correcte:** ${event.data.options[event.data.answer]}`,
            {
              fields: [
                {
                  name: 'Gagnant',
                  value: `<@${interaction.user.id}> a gagné **${event.data.reward}** crédits!`,
                  inline: false
                },
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
            successEmbed.addFields({
              name: '🎉 Niveau supérieur!',
              value: `<@${interaction.user.id}> est passé au niveau **${xpResult.newLevel}**!`,
              inline: false
            });
          }
          
          await interaction.message.edit({
            embeds: [successEmbed],
            components: []
          });
        } else {
          // Wrong answer
          const failEmbed = EmbedCreator.error(
            '🧠 Quiz - Mauvaise réponse!',
            `**Question:** ${event.data.question}\n\n**Réponse correcte:** ${event.data.options[event.data.answer]}`,
            {
              fields: [
                {
                  name: 'Dommage!',
                  value: `<@${interaction.user.id}> a donné une mauvaise réponse (${event.data.options[parseInt(answerIndex)]}).`,
                  inline: false
                }
              ]
            }
          );
          
          await interaction.message.edit({
            embeds: [failEmbed],
            components: []
          });
        }
      }
    } catch (error) {
      console.error('Error handling quiz button:', error);
      
      await interaction.reply({
        content: 'Une erreur est survenue lors du traitement de ce quiz.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};