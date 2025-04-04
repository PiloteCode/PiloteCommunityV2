
// src/commands/monitoring/stats.js
import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import premiumManager from '../../utils/premiumManager.js';
import { EMBED_COLORS } from '../../config/constants.js';
import { createCanvas } from 'canvas';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Affiche les statistiques détaillées d\'un monitor')
  .addStringOption(option =>
    option.setName('monitor_id')
      .setDescription('ID du monitor')
      .setRequired(true)
      .setAutocomplete(true))
  .addStringOption(option =>
    option.setName('period')
      .setDescription('Période des statistiques')
      .setRequired(false)
      .addChoices(
        { name: '24 heures', value: '24h' },
        { name: '7 jours', value: '7d' },
        { name: '30 jours', value: '30d' }
      ));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const monitorId = interaction.options.getString('monitor_id');
    const period = interaction.options.getString('period') || '24h';
    
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
        content: '❌ Vous n\'avez pas l\'autorisation de voir les statistiques de ce monitor.',
        ephemeral: true
      });
    }
    
    // Récupérer les statistiques du monitor
    const stats = await monitorManager.getMonitorStats(monitorId);
    
    // Récupérer les logs pour la période spécifiée
    let logs;
    let periodLabel;
    let uptimeValue;
    let responseTimeValue;
    
    switch (period) {
      case '24h':
        logs = await monitorManager.getMonitorLogs(monitorId, 100);
        logs = logs.filter(log => new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000));
        periodLabel = '24 heures';
        uptimeValue = stats.uptime_24h;
        responseTimeValue = stats.avg_response_24h;
        break;
      case '7d':
        logs = await monitorManager.getMonitorLogs(monitorId, 500);
        logs = logs.filter(log => new Date(log.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        periodLabel = '7 jours';
        uptimeValue = stats.uptime_7d;
        responseTimeValue = stats.avg_response_7d;
        break;
      case '30d':
        logs = await monitorManager.getMonitorLogs(monitorId, 1000);
        logs = logs.filter(log => new Date(log.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        periodLabel = '30 jours';
        uptimeValue = stats.uptime_30d;
        responseTimeValue = stats.avg_response_30d;
        break;
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Statistiques pour ${monitor.name}`)
      .setDescription(`Statistiques sur les ${periodLabel} derniers.`)
      .setColor(EMBED_COLORS.INFO)
      .addFields(
        { name: 'Uptime', value: `${uptimeValue.toFixed(2)}%`, inline: true },
        { name: 'Temps de réponse moyen', value: responseTimeValue ? `${responseTimeValue.toFixed(2)}ms` : 'N/A', inline: true },
        { name: 'Vérifications', value: String(logs.length), inline: true },
        { name: 'Échecs', value: String(logs.filter(log => log.status === 'down').length), inline: true },
        { name: 'Réussites', value: String(logs.filter(log => log.status === 'up').length), inline: true },
        { name: 'Dernier statut', value: monitorManager.formatStatus(monitor.status), inline: true }
      )
      .setTimestamp();
    
    // Vérifier si l'utilisateur a la fonctionnalité premium pour les statistiques avancées
    const hasPremium = await premiumManager.hasFeature(interaction.user.id, 'advanced_stats');
    
    if (hasPremium && logs.length > 0) {
      // Générer un graphique pour les temps de réponse
      const canvas = createCanvas(800, 400);
      const ctx = canvas.getContext('2d');
      
      // Fond blanc
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 800, 400);
      
      // Trier les logs par date
      logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      // Filtrer les logs avec un temps de réponse
      const responseLogs = logs.filter(log => log.response_time > 0);
      
      if (responseLogs.length > 0) {
        // Calculer les valeurs min et max pour l'échelle
        const responseTimes = responseLogs.map(log => log.response_time);
        const maxTime = Math.max(...responseTimes) * 1.1; // Ajouter 10% de marge
        
        // Dessiner l'axe Y (temps de réponse)
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(50, 350);
        ctx.stroke();
        
        // Dessiner l'axe X (temps)
        ctx.beginPath();
        ctx.moveTo(50, 350);
        ctx.lineTo(750, 350);
        ctx.stroke();
        
        // Ajouter les graduations sur l'axe Y
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        for (let i = 0; i <= 10; i++) {
          const y = 350 - i * 30;
          const value = (i * maxTime / 10).toFixed(0);
          ctx.fillText(value + 'ms', 10, y + 5);
          
          // Lignes horizontales en pointillés
          ctx.strokeStyle = 'lightgray';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(50, y);
          ctx.lineTo(750, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        
        // Tracer la courbe des temps de réponse
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        responseLogs.forEach((log, index) => {
          const x = 50 + (index / (responseLogs.length - 1)) * 700;
          const y = 350 - (log.response_time / maxTime) * 300;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        
        // Ajouter des points pour chaque mesure
        responseLogs.forEach((log, index) => {
          const x = 50 + (index / (responseLogs.length - 1)) * 700;
          const y = 350 - (log.response_time / maxTime) * 300;
          
          ctx.fillStyle = log.status === 'up' ? 'green' : 'red';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Ajouter le titre du graphique
        ctx.fillStyle = 'black';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`Temps de réponse (${periodLabel})`, 300, 30);
        
        // Créer une image à partir du canvas
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'stats.png' });
        
        // Ajouter l'image à l'embed
        embed.setImage('attachment://stats.png');
        
        return interaction.editReply({
          embeds: [embed],
          files: [attachment]
        });
      }
    }
    
    // Sans premium ou sans données suffisantes pour le graphique
    return interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'affichage des statistiques:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}