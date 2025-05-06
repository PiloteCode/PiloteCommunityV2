import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Jouez à la machine à sous')
    .addIntegerOption(option =>
      option
        .setName('montant')
        .setDescription('Montant à miser (10-1000)')
        .setRequired(true)
        .setMinValue(10)
        .setMaxValue(1000)
    ),
  
  // Cooldown of 30 seconds
  cooldown: 30000,
  
  async execute(interaction, client) {
    try {
      const betAmount = interaction.options.getInteger('montant');
      const userId = interaction.user.id;
      
      // Get user data
      const user = await client.db.getUser(userId);
      
      // Check if user has enough credits
      if (user.balance < betAmount) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants',
              `Vous n'avez pas assez de crédits pour ce pari.\nVotre solde: **${user.balance}** crédits`
            )
          ],
          ephemeral: true
        });
      }
      
      await interaction.deferReply();
      
      // Define slot symbols with their weights and multipliers
      const slotSymbols = [
        { emoji: '🍒', name: 'Cerise', weight: 30, multiplier: 2 },
        { emoji: '🍊', name: 'Orange', weight: 25, multiplier: 2 },
        { emoji: '🍋', name: 'Citron', weight: 20, multiplier: 3 },
        { emoji: '🍇', name: 'Raisin', weight: 15, multiplier: 4 },
        { emoji: '🍉', name: 'Pastèque', weight: 10, multiplier: 5 },
        { emoji: '🍌', name: 'Banane', weight: 8, multiplier: 6 },
        { emoji: '🔔', name: 'Cloche', weight: 5, multiplier: 10 },
        { emoji: '💎', name: 'Diamant', weight: 3, multiplier: 15 },
        { emoji: '💰', name: 'Jackpot', weight: 1, multiplier: 25 }
      ];
      
      // Create a weighted selection function
      const weightedRandom = () => {
        const totalWeight = slotSymbols.reduce((sum, symbol) => sum + symbol.weight, 0);
        let random = Math.floor(Math.random() * totalWeight);
        
        for (const symbol of slotSymbols) {
          random -= symbol.weight;
          if (random < 0) {
            return symbol;
          }
        }
        
        // Fallback (should never happen)
        return slotSymbols[0];
      };
      
      // Spin the slots (3 reels)
      const result = [
        weightedRandom(),
        weightedRandom(),
        weightedRandom()
      ];
      
      // Determine win/loss
      let winnings = 0;
      let winType = 'Perdu';
      let winDescription = 'Aucune combinaison gagnante. Meilleure chance la prochaine fois!';
      
      // Check for wins
      if (result[0].emoji === result[1].emoji && result[1].emoji === result[2].emoji) {
        // All three match (big win)
        winnings = betAmount * result[0].multiplier;
        winType = 'Triple match!';
        winDescription = `Trois ${result[0].name}s! Vous gagnez **${winnings}** crédits!`;
      } else if (result[0].emoji === result[1].emoji || result[1].emoji === result[2].emoji || result[0].emoji === result[2].emoji) {
        // Two match (small win)
        // Determine which symbol is duplicated
        let matchSymbol;
        if (result[0].emoji === result[1].emoji) {
          matchSymbol = result[0];
        } else if (result[1].emoji === result[2].emoji) {
          matchSymbol = result[1];
        } else {
          matchSymbol = result[0];
        }
        
        winnings = Math.floor(betAmount * (matchSymbol.multiplier / 3));
        winType = 'Double match!';
        winDescription = `Deux ${matchSymbol.name}s! Vous gagnez **${winnings}** crédits!`;
      } else if (result.some(r => r.emoji === '🔔')) {
        // Consolation prize for any bell
        winnings = Math.floor(betAmount * 0.5);
        winType = 'Cloche!';
        winDescription = `Une cloche! Vous récupérez **${winnings}** crédits.`;
      }
      
      // Update user balance
      const balanceChange = winnings - betAmount;
      await client.db.updateUserBalance(userId, balanceChange);
      
      // Add a small amount of XP regardless of win/loss
      const xpGained = Math.floor(Math.random() * 3) + 1;
      const xpResult = await client.db.addExperience(userId, xpGained);
      
      // Determine result color
      let color;
      if (balanceChange > 0) {
        color = 'SUCCESS';
      } else if (balanceChange === 0) {
        color = 'WARNING';
      } else {
        color = 'ERROR';
      }
      
      // Create the embed
      const resultEmoji = result.map(r => r.emoji).join(' | ');
      const embed = EmbedCreator.create({
        title: '🎰 Machine à sous',
        description: `<@${userId}> mise **${betAmount}** crédits...\n\n**[ ${resultEmoji} ]**\n\n**${winType}** ${winDescription}`,
        color,
        fields: [
          {
            name: 'Mise',
            value: `${betAmount} crédits`,
            inline: true
          },
          {
            name: 'Gain',
            value: `${winnings} crédits`,
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
            name: 'XP gagnée',
            value: `+${xpGained} XP`,
            inline: true
          }
        ],
        timestamp: true
      });
      
      // Add level up notification if user leveled up
      if (xpResult.leveledUp) {
        embed.addFields({
          name: '🎉 Niveau supérieur!',
          value: `Vous êtes passé au niveau **${xpResult.newLevel}**!`,
          inline: false
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in slots command:', error);
      
      // Send error message
      const errorEmbed = EmbedCreator.error(
        'Erreur',
        'Une erreur est survenue lors de l\'exécution de la commande.'
      );
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
};