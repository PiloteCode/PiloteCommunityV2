// src/commands/monitoring/report-generate.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import reportManager from '../../utils/reportManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('report-generate')
  .setDescription('Génère un rapport manuellement')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('ID du rapport à générer')
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
    
    // Générer le rapport
    await reportManager.generateReport(reportId);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Rapport généré')
      .setDescription(`Le rapport **${report.name}** a été généré avec succès et envoyé dans le canal <#${report.channel_id}>.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .setTimestamp();
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la génération du rapport:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la génération du rapport: ${error.message}`,
      ephemeral: true
    });
  }
}
