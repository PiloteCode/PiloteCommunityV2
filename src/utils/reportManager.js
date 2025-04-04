// src/utils/reportManager.js
import { executeQuery, executeRun } from '../database/manager.js';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { EMBED_COLORS } from '../config/constants.js';
import monitorManager from './monitorManager.js';
import premiumManager from './premiumManager.js';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtenir le répertoire actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReportManager {
  constructor() {
    this.scheduledReports = new Map();
  }

  /**
   * Initialise le système de rapports
   */
  async initialize() {
    try {
      console.log('🔄 Initialisation du système de rapports...');
      
      // Créer le dossier de rapports s'il n'existe pas
      const reportsDir = path.join(__dirname, '../../reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      // Charger tous les rapports planifiés
      const reports = await this.getAllReports();
      
      for (const report of reports) {
        if (report.is_active) {
          await this.scheduleReport(report.report_id);
        }
      }
      
      console.log(`✅ Système de rapports initialisé avec ${reports.length} rapports planifiés.`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du système de rapports:', error);
    }
  }

  /**
   * Crée un nouveau rapport
   * @param {Object} data - Les données du rapport
   * @returns {Promise<Object>} Le rapport créé
   */
  async createReport(data) {
    try {
      // Vérifier si l'utilisateur a la fonctionnalité premium
      const isPremium = await premiumManager.hasFeature(data.user_id, 'advanced_stats');
      
      if (!isPremium && data.is_premium) {
        throw new Error('Les rapports avancés sont une fonctionnalité premium.');
      }
      
      // Vérifier que les monitors spécifiés existent et appartiennent à l'utilisateur
      const monitors = Array.isArray(data.monitors) ? data.monitors : JSON.parse(data.monitors);
      
      for (const monitorId of monitors) {
        const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
        
        if (!monitor) {
          throw new Error(`Monitor ${monitorId} introuvable.`);
        }
        
        if (monitor.user_id !== data.user_id) {
          throw new Error(`Vous n'êtes pas le propriétaire du monitor ${monitor.name}.`);
        }
      }
      
      // Créer l'ID du rapport
      const reportId = `report-${data.guild_id}-${Date.now()}`;
      
      // Insérer le rapport dans la base de données
      await executeRun(
        `INSERT INTO monitor_reports 
        (report_id, guild_id, user_id, name, monitors, schedule, channel_id, is_active, is_premium) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          data.guild_id,
          data.user_id,
          data.name,
          JSON.stringify(monitors),
          data.schedule || null,
          data.channel_id || null,
          data.is_active ? 1 : 0,
          data.is_premium ? 1 : 0
        ]
      );
      
      // Planifier le rapport si nécessaire
      if (data.is_active && data.schedule) {
        await this.scheduleReport(reportId);
      }
      
      return this.getReport(reportId);
    } catch (error) {
      console.error('❌ Erreur lors de la création du rapport:', error);
      throw error;
    }
  }

  /**
   * Récupère un rapport par son ID
   * @param {string} reportId - ID du rapport
   * @returns {Promise<Object>} Le rapport
   */
  async getReport(reportId) {
    try {
      const report = await executeQuery('SELECT * FROM monitor_reports WHERE report_id = ?', [reportId]);
      
      if (report.length === 0) {
        throw new Error('Rapport introuvable.');
      }
      
      // Convertir les monitors JSON en tableau
      report[0].monitors = JSON.parse(report[0].monitors);
      
      return report[0];
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération du rapport ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère tous les rapports
   * @returns {Promise<Array>} Liste des rapports
   */
  async getAllReports() {
    try {
      const reports = await executeQuery('SELECT * FROM monitor_reports');
      
      // Convertir les monitors JSON en tableau pour chaque rapport
      for (const report of reports) {
        report.monitors = JSON.parse(report.monitors);
      }
      
      return reports;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des rapports:', error);
      throw error;
    }
  }

  /**
   * Récupère les rapports d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} Liste des rapports de l'utilisateur
   */
  async getUserReports(userId) {
    try {
      const reports = await executeQuery('SELECT * FROM monitor_reports WHERE user_id = ?', [userId]);
      
      // Convertir les monitors JSON en tableau pour chaque rapport
      for (const report of reports) {
        report.monitors = JSON.parse(report.monitors);
      }
      
      return reports;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des rapports de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les rapports d'un serveur
   * @param {string} guildId - ID du serveur
   * @returns {Promise<Array>} Liste des rapports du serveur
   */
  async getGuildReports(guildId) {
    try {
      const reports = await executeQuery('SELECT * FROM monitor_reports WHERE guild_id = ?', [guildId]);
      
      // Convertir les monitors JSON en tableau pour chaque rapport
      for (const report of reports) {
        report.monitors = JSON.parse(report.monitors);
      }
      
      return reports;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des rapports du serveur ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour un rapport
   * @param {string} reportId - ID du rapport
   * @param {Object} data - Nouvelles données
   * @returns {Promise<Object>} Le rapport mis à jour
   */
  async updateReport(reportId, data) {
    try {
      const report = await this.getReport(reportId);
      
      // Vérifier si les monitors spécifiés existent et appartiennent à l'utilisateur
      if (data.monitors) {
        const monitors = Array.isArray(data.monitors) ? data.monitors : JSON.parse(data.monitors);
        
        for (const monitorId of monitors) {
          const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
          
          if (!monitor) {
            throw new Error(`Monitor ${monitorId} introuvable.`);
          }
          
          if (monitor.user_id !== report.user_id) {
            throw new Error(`Vous n'êtes pas le propriétaire du monitor ${monitor.name}.`);
          }
        }
        
        // Convertir monitors en JSON si nécessaire
        data.monitors = JSON.stringify(monitors);
      }
      
      // Créer la clause SET dynamique
      const updateFields = [];
      const updateValues = [];
      
      for (const [key, value] of Object.entries(data)) {
        // Ignorer les champs qui ne peuvent pas être mis à jour directement
        if (['report_id', 'guild_id', 'user_id', 'created_at'].includes(key)) continue;
        
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
      
      // Si aucun champ à mettre à jour, retourner le rapport tel quel
      if (updateFields.length === 0) {
        return report;
      }
      
      // Ajouter l'ID du rapport à la fin des valeurs
      updateValues.push(reportId);
      
      // Exécuter la requête de mise à jour
      await executeRun(
        `UPDATE monitor_reports SET ${updateFields.join(', ')} WHERE report_id = ?`,
        updateValues
      );
      
      // Si la planification a changé, mettre à jour la planification
      if (data.is_active !== undefined || data.schedule) {
        // Annuler l'ancienne planification
        this.cancelScheduledReport(reportId);
        
        // Créer une nouvelle planification si nécessaire
        const updatedReport = await this.getReport(reportId);
        
        if (updatedReport.is_active && updatedReport.schedule) {
          await this.scheduleReport(reportId);
        }
      }
      
      return this.getReport(reportId);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour du rapport ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime un rapport
   * @param {string} reportId - ID du rapport
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async deleteReport(reportId) {
    try {
      // Annuler la planification du rapport
      this.cancelScheduledReport(reportId);
      
      // Supprimer le rapport
      await executeRun('DELETE FROM monitor_reports WHERE report_id = ?', [reportId]);
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression du rapport ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Planifie un rapport récurrent
   * @param {string} reportId - ID du rapport
   * @returns {Promise<boolean>} Succès de la planification
   */
  async scheduleReport(reportId) {
    try {
      const report = await this.getReport(reportId);
      
      if (!report.schedule) {
        return false;
      }
      
      // Annuler l'ancienne planification si elle existe
      this.cancelScheduledReport(reportId);
      
      // Analyser la planification (format : daily, weekly-1, monthly-15, etc.)
      const [frequency, day] = report.schedule.split('-');
      
      // Calculer le prochain délai avant exécution
      const nextExecutionDelay = this.calculateNextExecutionDelay(frequency, day);
      
      if (nextExecutionDelay === null) {
        console.error(`❌ Format de planification ${report.schedule} non valide.`);
        return false;
      }
      
      // Planifier le rapport
      const timeout = setTimeout(async () => {
        try {
          await this.generateReport(reportId);
          
          // Replanifier le rapport
          this.scheduleReport(reportId);
        } catch (error) {
          console.error(`❌ Erreur lors de l'exécution automatique du rapport ${reportId}:`, error);
        }
      }, nextExecutionDelay);
      
      // Stocker le timeout pour pouvoir l'annuler plus tard
      this.scheduledReports.set(reportId, timeout);
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de la planification du rapport ${reportId}:`, error);
      return false;
    }
  }

  /**
   * Annule la planification d'un rapport
   * @param {string} reportId - ID du rapport
   * @returns {boolean} Succès de l'annulation
   */
  cancelScheduledReport(reportId) {
    try {
      if (this.scheduledReports.has(reportId)) {
        clearTimeout(this.scheduledReports.get(reportId));
        this.scheduledReports.delete(reportId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Erreur lors de l'annulation de la planification du rapport ${reportId}:`, error);
      return false;
    }
  }

  /**
   * Calcule le délai avant la prochaine exécution d'un rapport planifié
   * @param {string} frequency - Fréquence (daily, weekly, monthly)
   * @param {string|number} day - Jour spécifique (pour weekly et monthly)
   * @returns {number|null} Délai en millisecondes ou null si planification invalide
   */
  calculateNextExecutionDelay(frequency, day) {
    const now = new Date();
    let targetDate = new Date();
    
    // Configurer l'heure d'exécution (00:00)
    targetDate.setHours(0, 0, 0, 0);
    
    switch (frequency) {
      case 'daily':
        // Si l'heure actuelle est après minuit, planifier pour le lendemain
        if (now > targetDate) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        break;
        
      case 'weekly':
        // Le jour doit être entre 0 (dimanche) et 6 (samedi)
        const weekDay = parseInt(day);
        if (isNaN(weekDay) || weekDay < 0 || weekDay > 6) {
          return null;
        }
        
        // Calculer le nombre de jours jusqu'au prochain jour de la semaine spécifié
        const daysUntilWeekDay = (weekDay - now.getDay() + 7) % 7;
        targetDate.setDate(targetDate.getDate() + daysUntilWeekDay);
        
        // Si la date cible est dans le passé (aujourd'hui mais déjà passé), ajouter une semaine
        if (daysUntilWeekDay === 0 && now > targetDate) {
          targetDate.setDate(targetDate.getDate() + 7);
        }
        break;
        
      case 'monthly':
        // Le jour doit être entre 1 et 31
        const monthDay = parseInt(day);
        if (isNaN(monthDay) || monthDay < 1 || monthDay > 31) {
          return null;
        }
        
        // Configurer le jour du mois
        targetDate.setDate(monthDay);
        
        // Si la date cible est dans le passé, passer au mois suivant
        if (now > targetDate) {
          targetDate.setMonth(targetDate.getMonth() + 1);
        }
        
        // Vérifier si le jour existe dans le mois cible (ex: 31 février)
        if (targetDate.getDate() !== monthDay) {
          // Si le jour n'existe pas, revenir au dernier jour du mois
          targetDate.setDate(0);
        }
        break;
        
      default:
        return null;
    }
    
    // Calculer le délai en millisecondes
    const delay = targetDate.getTime() - now.getTime();
    
    return delay > 0 ? delay : 0;
  }

  /**
   * Génère un rapport
   * @param {string} reportId - ID du rapport
   * @returns {Promise<Object>} Résultat de la génération
   */
  async generateReport(reportId) {
    try {
      const report = await this.getReport(reportId);
      const monitorIds = report.monitors;
      
      if (monitorIds.length === 0) {
        throw new Error('Aucun monitor spécifié dans le rapport.');
      }
      
      // Récupérer les informations sur chaque monitor
      const monitors = [];
      
      for (const monitorId of monitorIds) {
        try {
          const monitor = await monitorManager.getMonitor(monitorId);
          const stats = await monitorManager.getMonitorStats(monitorId);
          
          // Récupérer les logs récents
          const logs = await monitorManager.getMonitorLogs(monitorId, 100);
          
          monitors.push({
            monitor,
            stats,
            logs
          });
        } catch (error) {
          console.error(`❌ Erreur lors de la récupération des informations du monitor ${monitorId}:`, error);
        }
      }
      
      if (monitors.length === 0) {
        throw new Error('Aucun monitor valide n\'a pu être récupéré.');
      }
      
      // Générer le rapport en fonction du type (premium ou standard)
      if (report.is_premium) {
        return this.generatePremiumReport(report, monitors);
      } else {
        return this.generateStandardReport(report, monitors);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la génération du rapport ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Génère un rapport standard
   * @param {Object} report - Données du rapport
   * @param {Array} monitors - Monitors avec leurs statistiques
   * @returns {Promise<Object>} Résultat de la génération
   */
  async generateStandardReport(report, monitors) {
    try {
      // Compter les monitors par statut
      const statusCounts = {
        up: 0,
        down: 0,
        other: 0
      };
      
      for (const { monitor } of monitors) {
        if (monitor.status === 'up') {
          statusCounts.up++;
        } else if (monitor.status === 'down') {
          statusCounts.down++;
        } else {
          statusCounts.other++;
        }
      }
      
      // Déterminer la couleur du rapport
      let reportColor = EMBED_COLORS.SUCCESS;
      
      if (statusCounts.down > 0) {
        reportColor = EMBED_COLORS.ERROR;
      } else if (statusCounts.other > 0) {
        reportColor = EMBED_COLORS.WARNING;
      }
      
      // Créer l'embed du rapport
      const embed = new EmbedBuilder()
        .setTitle(`📊 Rapport: ${report.name}`)
        .setDescription(`Rapport de statut pour ${monitors.length} monitors.`)
        .setColor(reportColor)
        .addFields(
          { name: '🟢 En ligne', value: String(statusCounts.up), inline: true },
          { name: '🔴 Hors ligne', value: String(statusCounts.down), inline: true },
          { name: '⚠️ Autres', value: String(statusCounts.other), inline: true }
        )
        .setTimestamp();
      
      // Ajouter les monitors en état critique (down) en premier
      if (statusCounts.down > 0) {
        const downMonitors = monitors.filter(({ monitor }) => monitor.status === 'down');
        let downList = '';
        
        for (const { monitor } of downMonitors) {
          downList += `🔴 **${monitor.name}** (${monitor.type}): ${monitor.target}\n`;
        }
        
        embed.addFields({
          name: '🔴 Services hors ligne',
          value: downList
        });
      }
      
      // Ajouter les statistiques générales pour chaque monitor
      let statsDetails = '';
      
      for (const { monitor, stats } of monitors) {
        const uptime = stats.uptime_24h.toFixed(2);
        const responseTime = stats.avg_response_24h ? `${stats.avg_response_24h.toFixed(2)}ms` : 'N/A';
        
        statsDetails += `**${monitor.name}**: Uptime ${uptime}%, Temps de réponse ${responseTime}\n`;
      }
      
      embed.addFields({
        name: '📈 Statistiques (24h)',
        value: statsDetails
      });
      
      // Mettre à jour la date de dernière génération
      await this.updateReport(report.report_id, {
        last_generated: new Date().toISOString()
      });
      
      // Envoyer le rapport dans le canal spécifié si configuré
      if (report.channel_id) {
        try {
          const client = global.client;
          
          if (!client) {
            throw new Error('Client Discord non disponible.');
          }
          
          const channel = await client.channels.fetch(report.channel_id);
          
          if (!channel) {
            throw new Error('Canal introuvable.');
          }
          
          await channel.send({ embeds: [embed] });
        } catch (error) {
          console.error(`❌ Erreur lors de l'envoi du rapport dans le canal ${report.channel_id}:`, error);
        }
      }
      
      return {
        report,
        embed,
        statusCounts
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la génération du rapport standard:`, error);
      throw error;
    }
  }

  /**
   * Génère un rapport premium
   * @param {Object} report - Données du rapport
   * @param {Array} monitors - Monitors avec leurs statistiques
   * @returns {Promise<Object>} Résultat de la génération
   */
  async generatePremiumReport(report, monitors) {
    try {
      // D'abord générer l'embed standard
      const standardResult = await this.generateStandardReport(report, monitors);
      const { embed } = standardResult;
      
      // Créer un fichier de rapport détaillé
      const reportFilePath = path.join(__dirname, `../../reports/report-${report.report_id}-${Date.now()}.html`);
      
      // Générer le contenu HTML
      let htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport: ${report.name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .status-overview {
      display: flex;
      justify-content: space-around;
      margin: 20px 0;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .status-box {
      text-align: center;
      padding: 15px;
      border-radius: 5px;
      width: 30%;
    }
    .status-up {
      background: #e6ffe6;
      border: 1px solid #00cc00;
    }
    .status-down {
      background: #ffe6e6;
      border: 1px solid #ff0000;
    }
    .status-other {
      background: #fff9e6;
      border: 1px solid #ffcc00;
    }
    .monitor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .monitor-card {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .monitor-card h3 {
      margin-top: 0;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    .status-up-title {
      color: #00cc00;
    }
    .status-down-title {
      color: #ff0000;
    }
    .stats-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .stats-table th, .stats-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .stats-table th {
      background-color: #f2f2f2;
    }
    .logs-section {
      margin-top: 15px;
    }
    .logs-section h4 {
      margin-bottom: 10px;
    }
    .log-entry {
      padding: 5px;
      margin-bottom: 5px;
      border-left: 3px solid #ddd;
    }
    .log-up {
      border-left-color: #00cc00;
    }
    .log-down {
      border-left-color: #ff0000;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 0.9em;
      color: #777;
      border-top: 1px solid #eee;
      padding-top: 15px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Rapport: ${report.name}</h1>
    <p>Généré le ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="status-overview">
    <div class="status-box status-up">
      <h2>🟢 En ligne</h2>
      <p>${standardResult.statusCounts.up} / ${monitors.length}</p>
    </div>
    <div class="status-box status-down">
      <h2>🔴 Hors ligne</h2>
      <p>${standardResult.statusCounts.down} / ${monitors.length}</p>
    </div>
    <div class="status-box status-other">
      <h2>⚠️ Autres</h2>
      <p>${standardResult.statusCounts.other} / ${monitors.length}</p>
    </div>
  </div>
  
  <h2>Détails des monitors</h2>
  
  <div class="monitor-grid">`;
      
      // Ajouter les détails de chaque monitor
      for (const { monitor, stats, logs } of monitors) {
        const statusClass = monitor.status === 'up' ? 'status-up-title' : 'status-down-title';
        const statusEmoji = monitor.status === 'up' ? '🟢' : '🔴';
        
        htmlContent += `
    <div class="monitor-card">
      <h3 class="${statusClass}">${statusEmoji} ${monitor.name}</h3>
      <p><strong>Type:</strong> ${monitor.type}</p>
      <p><strong>Cible:</strong> ${monitor.target}</p>
      <p><strong>Statut:</strong> ${monitorManager.formatStatus(monitor.status)}</p>
      
      <h4>Statistiques</h4>
      <table class="stats-table">
        <tr>
          <th>Période</th>
          <th>Uptime</th>
          <th>Temps de réponse</th>
        </tr>
        <tr>
          <td>24 heures</td>
          <td>${stats.uptime_24h.toFixed(2)}%</td>
          <td>${stats.avg_response_24h ? `${stats.avg_response_24h.toFixed(2)}ms` : 'N/A'}</td>
        </tr>
        <tr>
          <td>7 jours</td>
          <td>${stats.uptime_7d.toFixed(2)}%</td>
          <td>${stats.avg_response_7d ? `${stats.avg_response_7d.toFixed(2)}ms` : 'N/A'}</td>
        </tr>
        <tr>
          <td>30 jours</td>
          <td>${stats.uptime_30d.toFixed(2)}%</td>
          <td>${stats.avg_response_30d ? `${stats.avg_response_30d.toFixed(2)}ms` : 'N/A'}</td>
        </tr>
      </table>
      
      <div class="logs-section">
        <h4>Derniers logs (max 5)</h4>`;
        
        // Ajouter les 5 derniers logs
        const recentLogs = logs.slice(0, 5);
        
        if (recentLogs.length === 0) {
          htmlContent += `<p>Aucun log disponible.</p>`;
        } else {
          for (const log of recentLogs) {
            const logClass = log.status === 'up' ? 'log-up' : 'log-down';
            const logEmoji = log.status === 'up' ? '🟢' : '🔴';
            const logDate = new Date(log.created_at).toLocaleString();
            
            htmlContent += `
        <div class="log-entry ${logClass}">
          <p>${logEmoji} <strong>${logDate}</strong>: ${log.message}</p>
        </div>`;
          }
        }
        
        htmlContent += `
      </div>
    </div>`;
      }
      
      // Fermer le document HTML
      htmlContent += `
  </div>
  
  <div class="footer">
    <p>Rapport généré par PiloteCommunity Bot</p>
    <p>© ${new Date().getFullYear()} Pilote Production</p>
  </div>
</body>
</html>`;
      
      // Écrire le fichier HTML
      fs.writeFileSync(reportFilePath, htmlContent);
      
      // Créer une pièce jointe pour Discord
      const attachment = new AttachmentBuilder(reportFilePath, { name: `${report.name}-${Date.now()}.html` });
      
      // Mettre à jour le rapport standard pour inclure le fichier
      embed.setFooter({
        text: 'Rapport détaillé disponible en pièce jointe'
      });
      
      // Envoyer le rapport dans le canal spécifié si configuré
      if (report.channel_id) {
        try {
          const client = global.client;
          
          if (!client) {
            throw new Error('Client Discord non disponible.');
          }
          
          const channel = await client.channels.fetch(report.channel_id);
          
          if (!channel) {
            throw new Error('Canal introuvable.');
          }
          
          await channel.send({
            content: `📊 Rapport détaillé: **${report.name}**`,
            embeds: [embed],
            files: [attachment]
          });
        } catch (error) {
          console.error(`❌ Erreur lors de l'envoi du rapport premium dans le canal ${report.channel_id}:`, error);
        }
      }
      
      return {
        report,
        embed,
        attachment,
        filePath: reportFilePath,
        statusCounts: standardResult.statusCounts
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la génération du rapport premium:`, error);
      throw error;
    }
  }
}

const reportManager = new ReportManager();
export default reportManager;