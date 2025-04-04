
// src/commands/monitoring/alert-list.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('alert-list')
  .setDescription('Affiche les alertes configurées pour un monitor')
  .addStringOption(option =>
    option.setName('monitor_id')
      .setDescription('ID du monitor')
      .setRequired(true)
      .setAutocomplete(true));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const monitorId = interaction.options.getString('monitor_id');
    
    // Récupérer le monitor
    const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
    
    if (!monitor) {
      return interaction.editReply({
        content: '❌ Monitor introuvable.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est le propriétaire du monitor
    if (monitor.user_id !== interaction.user.id && !interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        content: '❌ Vous n\'avez pas l\'autorisation de voir les alertes de ce monitor.',
        ephemeral: true
      });
    }
    
    // Récupérer les alertes
    const alerts = await monitorManager.getMonitorAlerts(monitorId);
    
    if (alerts.length === 0) {
      return interaction.editReply({
        content: `❌ Aucune alerte configurée pour le monitor "${monitor.name}".`,
        ephemeral: true
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`📢 Alertes pour ${monitor.name}`)
      .setColor(EMBED_COLORS.INFO)
      .setDescription(`${alerts.length} alerte${alerts.length > 1 ? 's' : ''} configurée${alerts.length > 1 ? 's' : ''}.`)
      .setTimestamp();
    
    // Ajouter les alertes
    for (const alert of alerts) {
      let details = '';
      
      if (alert.alert_type === 'channel') {
        details += `**Canal:** ${alert.channel_id ? `<#${alert.channel_id}>` : 'Non spécifié'}\n`;
        details += `**Rôle:** ${alert.role_id ? `<@&${alert.role_id}>` : 'Aucun'}\n`;
      } else if (alert.alert_type === 'webhook') {
        details += `**Webhook:** ${alert.webhook_url ? `${alert.webhook_url.substring(0, 30)}...` : 'Non spécifié'}\n`;
      }
      
      details += `**Échecs consécutifs:** ${alert.consecutive_failures}\n`;
      details += `**Cooldown:** ${alert.cooldown}s\n`;
      details += `**Statut:** ${alert.is_active ? '✅ Actif' : '❌ Inactif'}\n`;
      details += `**ID:** \`${alert.alert_id}\``;
      
      embed.addFields({
        name: `${alert.alert_type === 'channel' ? '📝 Canal Discord' : '🔗 Webhook'}`,
        value: details,
        inline: true
      });
    }
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des alertes:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la récupération des alertes: ${error.message}`,
      ephemeral: true
    });
  }
}
