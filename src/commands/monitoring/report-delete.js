// src/commands/monitoring/report-delete.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import reportManager from '../../utils/reportManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('report-delete')
  .setDescription('Supprime un rapport')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('ID du rapport à supprimer')
      .setRequired(true)
      .setAutocomplete(true));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const reportId = interaction.options.getString('id');
    
    // Récupérer le rapport
    const report = await reportManager.getReport(reportId).catch(() => null);
    
    if (!report) {
      return interaction.editReply({
        content: '❌ Rapport introuvable.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est le propriétaire du rapport
    if (report.user_id !== interaction.user.id) {
      return interaction.editReply({
        content: '❌ Vous n\'êtes pas le propriétaire de ce rapport.',
        ephemeral: true
      });
    }
    
    // Supprimer le rapport
    await reportManager.deleteReport(reportId);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Rapport supprimé')
      .setDescription(`Le rapport **${report.name}** a été supprimé avec succès.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .setTimestamp();
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du rapport:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la suppression du rapport: ${error.message}`,
      ephemeral: true
    });
  }
}

