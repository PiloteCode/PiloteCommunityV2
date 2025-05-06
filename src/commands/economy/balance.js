import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Vérifiez votre solde de PiloCoins ou celui d\'un autre utilisateur')
    .addUserOption(option => 
      option
        .setName('utilisateur')
        .setDescription('Utilisateur dont vous voulez voir le solde')
        .setRequired(false)
    ),
  
  // No cooldown for this command
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Get target user (mentioned user or self)
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      const targetUserId = targetUser.id;
      
      // Get user data
      const userData = await client.db.getUser(targetUserId);
      
      // Create and send the embed
      const embed = EmbedCreator.economy(
        'Solde',
        targetUser.id === interaction.user.id 
          ? `Vous avez actuellement **${userData.balance}** PiloCoins.`
          : `<@${targetUserId}> a actuellement **${userData.balance}** PiloCoins.`,
        {
          thumbnail: targetUser.displayAvatarURL({ dynamic: true }),
          fields: [
            {
              name: '📊 Niveau',
              value: `${userData.level}`,
              inline: true
            },
            {
              name: '⭐ Expérience',
              value: `${userData.experience} XP`,
              inline: true
            }
          ]
        }
      );
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in balance command:', error);
      
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