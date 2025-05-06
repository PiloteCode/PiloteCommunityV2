import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Affiche des informations sur le serveur'),
  
  cooldown: 10000, // 10 seconds
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const { guild } = interaction;
      
      // Fetch more guild data if needed
      await guild.fetch();
      
      // Count channels by type
      const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
      const categoryChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
      const forumChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).size;
      
      // Get member counts
      const totalMembers = guild.memberCount;
      const botCount = guild.members.cache.filter(member => member.user.bot).size;
      const humanCount = totalMembers - botCount;
      
      // Get role count
      const roleCount = guild.roles.cache.size - 1; // Minus @everyone
      
      // Get emoji count
      const emojiCount = guild.emojis.cache.size;
      
      // Get server features
      const features = guild.features.length > 0
        ? guild.features.map(feature => `\`${feature}\``).join(', ')
        : 'Aucune fonctionnalité spéciale';
      
      // Server creation time
      const createdAt = guild.createdAt;
      const createdTimestamp = Math.floor(createdAt.getTime() / 1000);
      
      // Create the embed
      const embed = EmbedCreator.create({
        title: `Informations sur ${guild.name}`,
        thumbnail: guild.iconURL({ dynamic: true, size: 256 }),
        color: 'PRIMARY',
        fields: [
          {
            name: '📋 Informations générales',
            value: [
              `**ID:** ${guild.id}`,
              `**Propriétaire:** <@${guild.ownerId}>`,
              `**Créé le:** <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`,
              `**Niveau de vérification:** ${guild.verificationLevel}`,
              `**Niveau de boost:** ${guild.premiumTier || '0'} (${guild.premiumSubscriptionCount || 0} boosts)`
            ].join('\n'),
            inline: false
          },
          {
            name: '👥 Membres',
            value: [
              `**Total:** ${totalMembers}`,
              `**Humains:** ${humanCount}`,
              `**Bots:** ${botCount}`
            ].join('\n'),
            inline: true
          },
          {
            name: '📢 Canaux',
            value: [
              `**Total:** ${guild.channels.cache.size}`,
              `**Textuels:** ${textChannels}`,
              `**Vocaux:** ${voiceChannels}`,
              `**Catégories:** ${categoryChannels}`,
              `**Forums:** ${forumChannels}`
            ].join('\n'),
            inline: true
          },
          {
            name: '🏷️ Autre',
            value: [
              `**Rôles:** ${roleCount}`,
              `**Émojis:** ${emojiCount}`,
              `**Stickers:** ${guild.stickers?.cache.size || 0}`
            ].join('\n'),
            inline: true
          },
          {
            name: '✨ Fonctionnalités',
            value: features,
            inline: false
          }
        ],
        footer: {
          text: `Demandé par ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: true
      });
      
      // Add server banner if exists
      if (guild.banner) {
        embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
      }
      
      // Send the embed
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in serverinfo command:', error);
      await interaction.editReply({
        embeds: [
          EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la récupération des informations du serveur.')
        ]
      });
    }
  }
};