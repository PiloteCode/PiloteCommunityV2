
// src/commands/monitoring/status-page-delete.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import statusPageManager from '../../utils/statusPageManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('status-page-delete')
  .setDescription('Supprime une page de statut')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('ID de la page à supprimer')
      .setRequired(true)
      .setAutocomplete(true));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const pageId = interaction.options.getString('id');
    
    // Récupérer la page
    const page = await statusPageManager.getStatusPage(pageId).catch(() => null);
    
    if (!page) {
      return interaction.editReply({
        content: '❌ Page de statut introuvable.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est le propriétaire de la page
    if (page.user_id !== interaction.user.id) {
      return interaction.editReply({
        content: '❌ Vous n\'êtes pas le propriétaire de cette page de statut.',
        ephemeral: true
      });
    }
    
    // Supprimer la page
    await statusPageManager.deleteStatusPage(pageId);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Page de statut supprimée')
      .setDescription(`La page **${page.title}** a été supprimée avec succès.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .setTimestamp();
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la page de statut:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la suppression de la page de statut: ${error.message}`,
      ephemeral: true
    });
  }
}