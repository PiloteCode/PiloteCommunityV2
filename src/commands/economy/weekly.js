import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Réclamez votre récompense hebdomadaire'),
  
  // Cooldown is handled manually since it needs to be 7 days from last claim
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      
      // Get user data
      const user = await client.db.getUser(userId);
      
      // Check if user has already claimed weekly reward this week
      if (user.last_weekly) {
        const lastWeekly = new Date(user.last_weekly);
        const now = new Date();
        const timeDiff = now - lastWeekly;
        const daysLeft = 7 - Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        if (daysLeft > 0) {
          // User has already claimed weekly reward
          const hoursLeft = 24 - Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          
          const timeString = `${daysLeft}j ${hoursLeft}h`;
          
          const embed = EmbedCreator.warning(
            'Récompense déjà réclamée',
            `Vous avez déjà réclamé votre récompense hebdomadaire.\nRevenez dans **${timeString}**.`
          );
          
          return interaction.editReply({ embeds: [embed] });
        }
      }
      
      // Calculate reward
      const baseAmount = parseInt(process.env.WEEKLY_AMOUNT) || 2000;
      
      // Update user's last weekly claim
      await client.db.db.run(`
        UPDATE users
        SET last_weekly = datetime('now')
        WHERE user_id = ?
      `, userId);
      
      // Add experience points (50 XP)
      const xpResult = await client.db.addExperience(userId, 50);
      
      // Update user balance
      await client.db.updateUserBalance(userId, baseAmount);
      
      // Create and send the embed
      const embed = EmbedCreator.success(
        '🎁 Récompense hebdomadaire',
        `Vous avez réclamé votre récompense hebdomadaire de **${baseAmount}** crédits!`,
        {
          fields: [
            {
              name: '💰 Solde actuel',
              value: `${user.balance + baseAmount} crédits`,
              inline: true
            },
            {
              name: '⭐ XP gagnée',
              value: `+50 XP`,
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
      console.error('Error in weekly command:', error);
      
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