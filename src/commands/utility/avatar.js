import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Affiche l\'avatar d\'un utilisateur')
    .addUserOption(option => 
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont vous voulez voir l\'avatar')
        .setRequired(false)
    ),
  
  cooldown: 5000, // 5 seconds
  
  async execute(interaction, client) {
    try {
      // Get the target user (mentioned or self)
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      
      // Get member object if in a guild
      const member = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;
      
      // Check if user has different server avatar
      const hasServerAvatar = member && member.avatarURL() !== null;
      
      // Create the embed
      const embed = EmbedCreator.create({
        title: `Avatar de ${targetUser.username}`,
        description: hasServerAvatar 
          ? 'Cet utilisateur possède un avatar spécifique au serveur.' 
          : null,
        color: member?.displayHexColor || 'PRIMARY',
        image: targetUser.displayAvatarURL({ dynamic: true, size: 1024 }),
        footer: {
          text: `Demandé par ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        }
      });
      
      // Create components for download links
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('PNG')
            .setStyle(ButtonStyle.Link)
            .setURL(targetUser.displayAvatarURL({ extension: 'png', size: 1024 })),
          new ButtonBuilder()
            .setLabel('JPG')
            .setStyle(ButtonStyle.Link)
            .setURL(targetUser.displayAvatarURL({ extension: 'jpg', size: 1024 })),
          new ButtonBuilder()
            .setLabel('WEBP')
            .setStyle(ButtonStyle.Link)
            .setURL(targetUser.displayAvatarURL({ extension: 'webp', size: 1024 }))
        );
      
      // Add GIF link if avatar is animated
      if (targetUser.avatar && targetUser.avatar.startsWith('a_')) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel('GIF')
            .setStyle(ButtonStyle.Link)
            .setURL(targetUser.displayAvatarURL({ extension: 'gif', size: 1024 }))
        );
      }
      
      // Add server avatar button if available
      if (hasServerAvatar) {
        const serverAvatarButton = new ButtonBuilder()
          .setCustomId(`avatar:server:${targetUser.id}`)
          .setLabel('Voir avatar serveur')
          .setStyle(ButtonStyle.Primary);
        
        row.addComponents(serverAvatarButton);
      }
      
      // Send the embed with components
      await interaction.reply({
        embeds: [embed],
        components: [row]
      });
      
    } catch (error) {
      console.error('Error in avatar command:', error);
      await interaction.reply({
        embeds: [
          EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la récupération de l\'avatar.')
        ],
        ephemeral: true
      });
    }
  }
};