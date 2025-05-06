import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'dice',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, userId, betAmount, betNumber] = extraData;
      
      // Verify that the user who clicked is the one who initiated
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: 'Vous ne pouvez pas utiliser ce bouton.',
          ephemeral: true
        });
      }
      
      // Handle dice roll
      if (action === 'roll') {
        await interaction.deferUpdate();
        
        // Parse amounts
        const amount = parseInt(betAmount);
        const target = parseInt(betNumber);
        
        // Get user data to verify funds
        const user = await client.db.getUser(userId);
        
        // Check if user still has enough credits
        if (user.balance < amount) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous n'avez plus assez de crédits pour ce pari.\nMise: **${amount}** crédits | Votre solde: **${user.balance}** crédits`
              )
            ],
            components: []
          });
        }
        
        // Roll two dice
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;
        
        // Check if user won
        const isWin = total === target;
        
        // Calculate winnings and outcome
        let winnings = 0;
        if (isWin) {
          // Get the multiplier based on the probability
          const multipliers = {
            2: 15, 3: 12, 4: 10, 5: 8, 6: 6, 7: 5,
            8: 6, 9: 8, 10: 10, 11: 12, 12: 15
          };
          
          winnings = amount * (multipliers[target] || 5);
        }
        
        // Calculate balance change
        const balanceChange = isWin ? winnings - amount : -amount;
        
        // Update user balance
        await client.db.updateUserBalance(userId, balanceChange);
        
        // Add experience points based on outcome
        const xpGained = isWin ? Math.floor(Math.random() * 6) + 5 : Math.floor(Math.random() * 3) + 1;
        const xpResult = await client.db.addExperience(userId, xpGained);
        
        // Create result embed
        const embed = EmbedCreator.create({
          title: '🎲 Résultat du pari',
          description: `<@${userId}> a parié sur **${target}** et obtient **${die1}** + **${die2}** = **${total}**`,
          color: isWin ? 'SUCCESS' : 'ERROR',
          fields: [
            {
              name: isWin ? '🎉 Victoire!' : '❌ Défaite!',
              value: isWin 
                ? `Vous avez gagné **${winnings}** crédits!`
                : `Vous avez perdu votre mise de **${amount}** crédits.`,
              inline: false
            },
            {
              name: 'Mise',
              value: `${amount} crédits`,
              inline: true
            },
            {
              name: 'Résultat net',
              value: `${balanceChange > 0 ? '+' : ''}${balanceChange} crédits`,
              inline: true
            },
            {
              name: 'Nouveau solde',
              value: `${user.balance + balanceChange} crédits`,
              inline: true
            },
            {
              name: '⭐ XP gagnée',
              value: `+${xpGained} XP`,
              inline: true
            }
          ],
          timestamp: true
        });
        
        // Add level up notification if applicable
        if (xpResult.leveledUp) {
          embed.addFields({
            name: '🎉 Niveau supérieur!',
            value: `Vous êtes passé au niveau **${xpResult.newLevel}**!`,
            inline: false
          });
        }
        
        await interaction.editReply({
          embeds: [embed],
          components: []
        });
      }
    } catch (error) {
      console.error('Error handling dice button:', error);
      
      await interaction.update({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement de votre lancer de dés.'
          )
        ],
        components: []
      }).catch(console.error);
    }
  }
};