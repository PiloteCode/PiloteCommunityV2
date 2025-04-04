// src/commands/monitoring/report-list.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import reportManager from '../../utils/reportManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('report-list')
  .setDescription('Affiche la liste de vos rapports configurés');

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Récupérer les rapports de l'utilisateur
    const reports = await reportManager.getUserReports(interaction.user.id);
    
    if (reports.length === 0) {
      return interaction.editReply({
        content: '❌ Vous n\'avez aucun rapport configuré. Utilisez `/report-create` pour en créer un.',
        ephemeral: true
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle('📊 Liste de vos rapports')
      .setColor(EMBED_COLORS.INFO)
      .setDescription(`Vous avez ${reports.length} rapport${reports.length > 1 ? 's' : ''} configuré${reports.length > 1 ? 's' : ''}.`)
      .setTimestamp();
    
    // Ajouter les rapports à l'embed
    for (const report of reports) {
      const isPremium = report.is_premium === 1;
      const isActive = report.is_active === 1;
      const lastGenerated = report.last_generated 
        ? new Date(report.last_generated).toLocaleString() 
        : 'Jamais';
      
      embed.addFields({
        name: `${isPremium ? '✨ ' : ''}${report.name}`,
        value: 
          `**Canal:** ${report.channel_id ? `<#${report.channel_id}>` : 'Non spécifié'}\n` +
          `**Planification:** ${report.schedule ? formatSchedule(report.schedule) : 'Manuel'}\n` +
          `**Statut:** ${isActive ? '✅ Actif' : '❌ Inactif'}\n` +
          `**Type:** ${isPremium ? 'Détaillé (Premium)' : 'Standard'}\n` +
          `**Dernière génération:** ${lastGenerated}\n` +
          `**Monitors:** ${report.monitors.length}\n` +
          `**ID:** \`${report.report_id}\``,
        inline: false
      });
    }
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des rapports:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la récupération des rapports: ${error.message}`,
      ephemeral: true
    });
  }
}

