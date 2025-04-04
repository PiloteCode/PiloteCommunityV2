// src/commands/monitoring/monitor-status.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';

export const data = new SlashCommandBuilder()
  .setName('monitor-status')
  .setDescription('Affiche le statut détaillé d\'un monitor')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('ID du monitor')
      .setRequired(true)
      .setAutocomplete(true))
  .addBooleanOption(option =>
    option.setName('check')
      .setDescription('Effectuer une vérification immédiate')
      .setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const monitorId = interaction.options.getString('id');
    const check = interaction.options.getBoolean('check') ?? false;
    
    // Récupérer le monitor
    const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
    
    if (!monitor) {
      return interaction.editReply({
        content: '❌ Monitor introuvable.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est le propriétaire du monitor ou un admin
    if (monitor.user_id !== interaction.user.id && !interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        content: '❌ Vous n\'avez pas l\'autorisation de voir ce monitor.',
        ephemeral: true
      });
    }
    
    // Effectuer une vérification immédiate si demandé
    if (check) {
      await monitorManager.checkMonitor(monitorId);
    }
    
    // Récupérer les statistiques du monitor
    const stats = await monitorManager.getMonitorStats(monitorId);
    
    // Récupérer les logs récents
    const logs = await monitorManager.getMonitorLogs(monitorId, 5);
    
    // Générer l'embed de statut
    const embed = await monitorManager.generateStatusEmbed(monitor, stats);
    
    // Ajouter les logs récents
    if (logs.length > 0) {
      let logsText = '';
      
      for (const log of logs) {
        const date = new Date(log.created_at).toLocaleString();
        const statusEmoji = log.status === 'up' ? '🟢' : log.status === 'down' ? '🔴' : '⚪';
        
        logsText += `${statusEmoji} **${date}**: ${log.message}\n`;
      }
      
      embed.addFields({
        name: '📝 Logs récents',
        value: logsText || 'Aucun log disponible.'
      });
    }
    
    // Ajouter des informations supplémentaires
    const lastCheck = monitor.last_check ? new Date(monitor.last_check).toLocaleString() : 'Jamais';
    embed.addFields({
      name: '⚙️ Informations supplémentaires',
      value: `**ID:** \`${monitor.monitor_id}\`\n**Dernière vérification:** ${lastCheck}\n**Timeout:** ${monitor.timeout}ms`
    });
    
    return interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du statut du monitor:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la récupération du statut: ${error.message}`,
      ephemeral: true
    });
  }
}