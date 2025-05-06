import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Affiche votre profil ou celui d\'un autre utilisateur')
    .addUserOption(option => 
      option
        .setName('utilisateur')
        .setDescription('Utilisateur dont vous voulez voir le profil')
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
      
      // Get user inventory summary (count items by category)
      const inventory = await client.db.getInventory(targetUserId);
      const inventorySummary = {};
      
      inventory.forEach(item => {
        if (!inventorySummary[item.category]) {
          inventorySummary[item.category] = 0;
        }
        
        inventorySummary[item.category] += item.quantity;
      });
      
      // Format inventory summary
      const inventorySummaryText = Object.keys(inventorySummary).length > 0
        ? Object.entries(inventorySummary)
            .map(([category, count]) => {
              // Get emoji for category
              let emoji;
              switch (category.toLowerCase()) {
                case 'tools':
                  emoji = '🔧';
                  break;
                case 'consumable':
                  emoji = '🧪';
                  break;
                case 'special':
                  emoji = '✨';
                  break;
                case 'cosmetic':
                  emoji = '🎭';
                  break;
                case 'upgrade':
                  emoji = '⬆️';
                  break;
                default:
                  emoji = '📦';
              }
              
              return `${emoji} ${category}: ${count}`;
            })
            .join('\n')
        : 'Aucun objet dans l\'inventaire';
      
      // Calculate next level XP requirement
      const nextLevelExp = 100 * (userData.level * userData.level);
      const progressPercent = Math.min(100, Math.floor((userData.experience / nextLevelExp) * 100));
      
      // Create progress bar
      const progressBar = EmbedCreator.createProgressBar(progressPercent);
      
      // Create profile embed
      const embed = EmbedCreator.create({
        title: `Profil de ${targetUser.username}`,
        description: targetUser.id === interaction.user.id 
          ? 'Votre profil PiloteCommunity'
          : `Profil PiloteCommunity de <@${targetUserId}>`,
        color: 'PROFILE',
        thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 }),
        fields: [
          {
            name: '💰 Solde',
            value: `${userData.balance} crédits`,
            inline: true
          },
          {
            name: '📊 Niveau',
            value: `${userData.level}`,
            inline: true
          },
          {
            name: '⭐ Expérience',
            value: `${userData.experience} / ${nextLevelExp} XP`,
            inline: true
          },
          {
            name: '📈 Progression',
            value: progressBar,
            inline: false
          },
          {
            name: '🎒 Inventaire',
            value: inventorySummaryText,
            inline: false
          }
        ]
      });
      
      // Add membership date if available
      if (userData.created_at) {
        const memberSince = new Date(userData.created_at);
        const formattedDate = memberSince.toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        embed.addFields({
          name: '📅 Membre depuis',
          value: formattedDate,
          inline: true
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in profile command:', error);
      
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