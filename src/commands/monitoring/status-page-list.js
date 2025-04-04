
// src/commands/monitoring/status-page-list.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import statusPageManager from '../../utils/statusPageManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('status-page-list')
  .setDescription('Affiche la liste de vos pages de statut');

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Récupérer les pages de statut de l'utilisateur
    const pages = await statusPageManager.getUserStatusPages(interaction.user.id);
    
    if (pages.length === 0) {
      return interaction.editReply({
        content: '❌ Vous n\'avez aucune page de statut. Utilisez `/status-page-create` pour en créer une.',
        ephemeral: true
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle('🌐 Liste de vos pages de statut')
      .setColor(EMBED_COLORS.INFO)
      .setDescription(`Vous avez ${pages.length} page${pages.length > 1 ? 's' : ''} de statut.`)
      .setTimestamp();
    
    // Ajouter les pages à l'embed
    for (const page of pages) {
      const isPublic = page.is_public === 1;
      const lastUpdated = page.last_updated 
        ? new Date(page.last_updated).toLocaleString() 
        : 'Jamais';
      
      embed.addFields({
        name: page.title,
        value: 
          `**Description:** ${page.description || 'Aucune description'}\n` +
          `**URL:** \`${page.public_url}\`\n` +
          `**Thème:** ${page.theme}\n` +
          `**Visibilité:** ${isPublic ? 'Publique' : 'Privée'}\n` +
          `**Mise à jour:** Toutes les ${page.update_interval} secondes\n` +
          `**Dernière mise à jour:** ${lastUpdated}\n` +
          `**Monitors:** ${page.monitors.length}\n` +
          `**ID:** \`${page.page_id}\``,
        inline: false
      });
    }
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des pages de statut:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la récupération des pages de statut: ${error.message}`,
      ephemeral: true
    });
  }
}
