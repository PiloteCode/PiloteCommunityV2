import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Affiche des informations sur un utilisateur')
    .addUserOption(option => 
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur sur lequel afficher des informations')
        .setRequired(false)
    ),
  
  cooldown: 5000, // 5 seconds
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Get the target user (mentioned or self)
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      
      // Get member object if in a guild
      const member = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;
      
      // Calculate account age
      const createdAt = targetUser.createdAt;
      const createdTimestamp = Math.floor(createdAt.getTime() / 1000);
      
      // Calculate guild join date if member
      let joinedTimestamp = null;
      if (member) {
        joinedTimestamp = Math.floor(member.joinedAt.getTime() / 1000);
      }
      
      // Get badges
      const flags = targetUser.flags?.toArray() || [];
      const badges = flags.length > 0
        ? flags.map(flag => `\`${flag}\``).join(', ')
        : 'Aucun badge';
      
      // Get roles if member
      const roles = member
        ? member.roles.cache
            .filter(role => role.id !== interaction.guild.id) // Filter out @everyone
            .sort((a, b) => b.position - a.position)
            .map(role => `<@&${role.id}>`)
            .join(', ') || 'Aucun rôle'
        : 'N/A';
      
      // Get economy data if available
      let economyData = null;
      try {
        economyData = await client.db.getUser(targetUser.id);
      } catch (err) {
        console.error('Error fetching economy data:', err);
      }
      
      // Create the embed
      const embed = EmbedCreator.create({
        title: `Informations sur ${targetUser.username}`,
        thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 }),
        color: member?.displayHexColor || 'PRIMARY',
        fields: [
          {
            name: '📋 Informations générales',
            value: [
              `**ID:** ${targetUser.id}`,
              `**Tag:** ${targetUser.tag}`,
              `**Créé le:** <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`,
              `**Bot:** ${targetUser.bot ? 'Oui' : 'Non'}`,
              `**Badges:** ${badges}`
            ].join('\n'),
            inline: false
          }
        ],
        footer: {
          text: `Demandé par ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: true
      });
      
      // Add member information if available
      if (member) {
        embed.addFields({
          name: '🏠 Informations serveur',
          value: [
            `**Surnom:** ${member.nickname || 'Aucun'}`,
            `**Rejoint le:** <t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)`,
            `**Booster:** ${member.premiumSince ? 'Oui' : 'Non'}`
          ].join('\n'),
          inline: false
        });
        
        embed.addFields({
          name: '🏷️ Rôles',
          value: roles,
          inline: false
        });
      }
      
      // Add economy information if available
      if (economyData) {
        embed.addFields({
          name: '💰 Économie',
          value: [
            `**Solde:** ${economyData.balance} crédits`,
            `**Niveau:** ${economyData.level}`,
            `**Expérience:** ${economyData.experience} XP`
          ].join('\n'),
          inline: false
        });
      }
      
      // Send the embed
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in userinfo command:', error);
      await interaction.editReply({
        embeds: [
          EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la récupération des informations de l\'utilisateur.')
        ]
      });
    }
  }
};