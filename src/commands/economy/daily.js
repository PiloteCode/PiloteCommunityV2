import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Réclamez votre récompense quotidienne'),
  
  // Cooldown is handled manually since it needs to be 24 hours from last claim
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      
      // Get user data
      const user = await client.db.getUser(userId);
      
      // Check if user has already claimed daily reward today
      if (user.last_daily) {
        const lastDaily = new Date(user.last_daily);
        const now = new Date();
        const timeDiff = now - lastDaily;
        const hoursLeft = 24 - Math.floor(timeDiff / (1000 * 60 * 60));
        
        if (hoursLeft > 0) {
          // User has already claimed daily reward
          const minutesLeft = 60 - Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          
          const timeString = hoursLeft > 1 
            ? `${hoursLeft}h ${minutesLeft}m` 
            : `${minutesLeft}m`;
          
          const embed = EmbedCreator.warning(
            'Récompense déjà réclamée',
            `Vous avez déjà réclamé votre récompense quotidienne.\nRevenez dans **${timeString}**.`
          );
          
          return interaction.editReply({ embeds: [embed] });
        }
      }
      
      // Calculate reward
      const baseAmount = parseInt(process.env.DAILY_AMOUNT) || 500;
      
      // Calculate streak bonus
      // TODO: Implement streak system
      
      // Update user's last daily claim
      await client.db.db.run(`
        UPDATE users
        SET last_daily = datetime('now')
        WHERE user_id = ?
      `, userId);
      
      // Add experience points (20 XP)
      const xpResult = await client.db.addExperience(userId, 20);
      
      // Update user balance
      await client.db.updateUserBalance(userId, baseAmount);
      
      // Create and send the embed
      const embed = EmbedCreator.success(
        '🎁 Récompense quotidienne',
        `Vous avez réclamé votre récompense quotidienne de **${baseAmount}** PiloCoins!`,
        {
          fields: [
            {
              name: '💰 Solde actuel',
              value: `${user.balance + baseAmount} PiloCoins`,
              inline: true
            },
            {
              name: '⭐ XP gagnée',
              value: `+20 XP`,
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
      console.error('Error in daily command:', error);
      
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