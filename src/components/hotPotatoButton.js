import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  customId: 'hot_potato',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, eventId] = extraData;
      
      // Handle start action
      if (action === 'start') {
        const userId = interaction.user.id;
        
        // Get event from database
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        if (!event) {
          return interaction.reply({
            content: '❌ Cet événement n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Check if game already started
        if (event.data.currentHolder !== null) {
          return interaction.reply({
            content: '❌ La partie a déjà commencé!',
            ephemeral: true
          });
        }
        
        // Start game with this user
        event.data.currentHolder = userId;
        event.data.passHistory = [];
        
        // Update event in database
        await client.db.db.run(`
          UPDATE events
          SET data = ?
          WHERE id = ?
        `, JSON.stringify(event.data), eventId);
        
        // Notify the user
        await interaction.reply({
          content: '🥔 Vous avez la patate chaude! Passez-la vite!',
          ephemeral: true
        });
        
        // Update message with game embed
        const gameEmbed = EmbedCreator.create({
          title: '🥔 Patate Chaude!',
          description: `La patate est en jeu! Passez-la avant qu'elle n'explose!\n\n<@${userId}> a la patate chaude! Qui va la prendre?\n\nPasses: **0**/${event.data.minPasses}-${event.data.maxPasses}`,
          color: '#FF5722',
          footer: { text: 'La patate peut exploser à tout moment après le nombre minimum de passes!' },
          timestamp: true
        });
        
        // Create pass button
        const passButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`hot_potato:pass:${eventId}`)
              .setLabel('Passer la patate!')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🥔')
          );
        
        await interaction.message.edit({
          embeds: [gameEmbed],
          components: [passButton]
        });
      }
      
      // Handle pass action
      else if (action === 'pass') {
        const userId = interaction.user.id;
        
        // Get event from database
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        if (!event) {
          return interaction.reply({
            content: '❌ Cet événement n\'existe plus.',
            ephemeral: true
          });
        }
        
        // Check if game already ended
        if (event.data.exploded) {
          return interaction.reply({
            content: '❌ La partie est déjà terminée!',
            ephemeral: true
          });
        }
        
        // Check if current user is passing to themselves
        if (event.data.currentHolder === userId) {
          return interaction.reply({
            content: '⚠️ Vous avez déjà la patate chaude! Attendez que quelqu'un d'autre la prenne!',
            ephemeral: true
          });
        }
        
        // Update holder and increment passes
        const previousHolder = event.data.currentHolder;
        event.data.currentHolder = userId;
        event.data.passes++;
        
        // Update pass history
        if (!event.data.passHistory) {
          event.data.passHistory = [];
        }
        event.data.passHistory.push(previousHolder);
        
        // Check if potato should explode
        const shouldExplode = event.data.passes >= event.data.minPasses && 
          (event.data.passes >= event.data.maxPasses || Math.random() < 0.3);
        
        if (shouldExplode) {
          // Potato explodes!
          event.data.exploded = true;
          
          // Mark event as completed
          await client.db.completeEvent(eventId);
          
          // Update event in database
          await client.db.db.run(`
            UPDATE events
            SET data = ?
            WHERE id = ?
          `, JSON.stringify(event.data), eventId);
          
          // Notify the user
          await interaction.reply({
            content: `💥 BOOM! La patate a explosé dans vos mains! Vous perdez **${Math.floor(event.data.reward * 0.5)}** crédits.`,
            ephemeral: true
          });
          
          // Create explosion embed
          const explosionEmbed = EmbedCreator.error(
            '🥔 BOOM! La patate a explosé!',
            `<@${userId}> tenait la patate quand elle a explosé après **${event.data.passes}** passes!\n\n<@${userId}> perd **${Math.floor(event.data.reward * 0.5)}** crédits, et tous les autres participants se partagent **${event.data.reward}** crédits!`,
            {
              timestamp: true
            }
          );
          
          await interaction.message.edit({
            embeds: [explosionEmbed],
            components: []
          });
          
          // Give penalty to the loser
          await client.db.updateUserBalance(userId, -Math.floor(event.data.reward * 0.5));
          
          // Give rewards to all other participants
          const participants = new Set();
          for (let i = 0; i < event.data.passHistory.length; i++) {
            const passerId = event.data.passHistory[i];
            if (passerId && passerId !== userId) {
              participants.add(passerId);
            }
          }
          
          // Convert to array and remove the loser
          const winners = [...participants].filter(id => id !== userId);
          
          if (winners.length > 0) {
            // Split the reward
            const sharePerPerson = Math.floor(event.data.reward / winners.length);
            
            for (const winnerId of winners) {
              await client.db.updateUserBalance(winnerId, sharePerPerson);
            }
          }
        } else {
          // Continue the game
          
          // Update event in database
          await client.db.db.run(`
            UPDATE events
            SET data = ?
            WHERE id = ?
          `, JSON.stringify(event.data), eventId);
          
          // Notify the user
          await interaction.reply({
            content: `🥔 Vous avez maintenant la patate chaude! Passez-la vite!`,
            ephemeral: true
          });
          
          // Update game embed
          const gameEmbed = EmbedCreator.create({
            title: '🥔 Patate Chaude!',
            description: `La patate continue de circuler! Passez-la avant qu'elle n'explose!\n\n<@${userId}> a maintenant la patate chaude! Qui va la prendre?\n\nPasses: **${event.data.passes}**/${event.data.minPasses}-${event.data.maxPasses}`,
            color: '#FF5722',
            footer: { text: `La patate devient de plus en plus chaude!` },
            timestamp: true
          });
          
          await interaction.message.edit({
            embeds: [gameEmbed]
          });
        }
      }
    } catch (error) {
      console.error('Error handling hot potato button:', error);
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du traitement de la patate chaude.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};