import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Travaillez pour gagner des PiloCoins'),
  
  // Cooldown in milliseconds (1 hour)
  cooldown: 60 * 60 * 1000,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      
      // Get user data
      const user = await client.db.getUser(userId);
      
      // Check if user has fishing rod (boosts earnings)
      const inventory = await client.db.getInventory(userId);
      const hasFishingRod = inventory.some(item => item.item_id === 'fishing_rod');
      
      // Calculate earnings
      const minAmount = parseInt(process.env.WORK_MIN_AMOUNT) || 50;
      const maxAmount = parseInt(process.env.WORK_MAX_AMOUNT) || 150;
      
      let earnings = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
      
      // Apply fishing rod bonus (25% more)
      if (hasFishingRod) {
        earnings = Math.floor(earnings * 1.25);
      }
      
      // Add experience points (5-10 XP)
      const xpGained = Math.floor(Math.random() * 6) + 5;
      const xpResult = await client.db.addExperience(userId, xpGained);
      
      // Update user balance
      await client.db.updateUserBalance(userId, earnings);
      
      // Create an array of possible work scenarios
      const workScenarios = [
        {
          description: `Vous avez passé quelques heures à pêcher et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '🎣'
        },
        {
          description: `Vous avez aidé à livrer des colis et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '📦'
        },
        {
          description: `Vous avez fait le ménage chez un client et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '🧹'
        },
        {
          description: `Vous avez vendu des produits à la boutique locale et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '🏪'
        },
        {
          description: `Vous avez réparé le PC de quelqu'un et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '💻'
        },
        {
          description: `Vous avez fait des courses pour une personne âgée et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '🛒'
        },
        {
          description: `Vous avez participé à une enquête en ligne et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '📊'
        },
        {
          description: `Vous avez travaillé comme agent de sécurité et avez gagné **${earnings}** PiloCoins${hasFishingRod ? ' (Bonus: Canne à pêche)' : ''}.`,
          emoji: '👮'
        }
      ];
      
      // Select a random scenario
      const scenario = workScenarios[Math.floor(Math.random() * workScenarios.length)];
      
      // Create and send the embed
      const embed = EmbedCreator.success(
        `${scenario.emoji} Travail effectué!`,
        `${scenario.description}`,
        {
          fields: [
            {
              name: '💰 Solde actuel',
              value: `${user.balance + earnings} PiloCoins`,
              inline: true
            },
            {
              name: '⭐ XP gagnée',
              value: `+${xpGained} XP`,
              inline: true
            }
          ]
        }
      );
      
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
      console.error('Error in work command:', error);
      
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