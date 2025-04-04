// src/utils/monitorManager.js
import { executeQuery, executeRun } from '../database/manager.js';
import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS } from '../config/constants.js';
import httpMonitor from './monitorTypes/httpMonitor.js';
import pingMonitor from './monitorTypes/pingMonitor.js';
import tcpMonitor from './monitorTypes/tcpMonitor.js';
import dnsMonitor from './monitorTypes/dnsMonitor.js';
import sslMonitor from './monitorTypes/sslMonitor.js';
import keywordMonitor from './monitorTypes/keywordMonitor.js';
import performanceMonitor from './monitorTypes/performanceMonitor.js';
import premiumManager from './premiumManager.js';

class MonitorManager {
  constructor() {
    this.monitors = new Map();
    this.intervalHandlers = new Map();
    this.monitorTypes = {
      http: httpMonitor,
      https: httpMonitor,
      ping: pingMonitor,
      tcp: tcpMonitor,
      dns: dnsMonitor,
      ssl: sslMonitor,
      keyword: keywordMonitor,
      performance: performanceMonitor
    };
  }

  /**
   * Initialise le système de monitoring
   */
  async initialize() {
    try {
      console.log('🔄 Initialisation du système de monitoring...');
      
      // Charger tous les monitors actifs
      const monitors = await this.getAllMonitors();
      
      for (const monitor of monitors) {
        if (monitor.is_active) {
          await this.startMonitor(monitor.monitor_id);
        }
      }
      
      // Initialiser les fonctionnalités premium par défaut si elles n'existent pas
      await this.initializePremiumFeatures();
      
      console.log(`✅ Système de monitoring initialisé avec ${monitors.length} moniteurs.`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du système de monitoring:', error);
    }
  }
  
  /**
   * Initialise les fonctionnalités premium par défaut
   */
  async initializePremiumFeatures() {
    const features = await executeQuery('SELECT * FROM premium_features');
    
    if (features.length === 0) {
      console.log('📝 Initialisation des fonctionnalités premium par défaut...');
      
      const defaultFeatures = [
        {
          feature_id: 'more_monitors',
          name: 'Monitors supplémentaires',
          description: 'Augmente la limite de monitors de 5 à 20',
          price: 5000,
          duration: 30 // jours
        },
        {
          feature_id: 'increased_frequency',
          name: 'Fréquence accrue',
          description: 'Permet des vérifications toutes les 30 secondes (au lieu de 5 minutes)',
          price: 7500,
          duration: 30
        },
        {
          feature_id: 'advanced_stats',
          name: 'Statistiques avancées',
          description: 'Accès aux graphiques détaillés et aux rapports personnalisés',
          price: 10000,
          duration: 30
        },
        {
          feature_id: 'webhook_alerts',
          name: 'Alertes Webhook',
          description: 'Envoie des alertes à des webhooks externes',
          price: 5000,
          duration: 30
        },
        {
          feature_id: 'status_page',
          name: 'Page de statut',
          description: 'Crée une page de statut publique pour vos services',
          price: 12500,
          duration: 30
        }
      ];
      
      for (const feature of defaultFeatures) {
        await executeRun(
          'INSERT INTO premium_features (feature_id, name, description, price, duration) VALUES (?, ?, ?, ?, ?)',
          [feature.feature_id, feature.name, feature.description, feature.price, feature.duration]
        );
      }
      
      console.log('✅ Fonctionnalités premium initialisées.');
    }
  }

  /**
   * Crée un nouveau monitor
   * @param {Object} data - Les données du monitor
   * @returns {Promise<Object>} Le monitor créé
   */
  async createMonitor(data) {
    try {
      // Vérifier si l'utilisateur peut créer un nouveau monitor (limite standard ou premium)
      const userMonitors = await this.getUserMonitors(data.user_id);
      const isPremium = await premiumManager.hasFeature(data.user_id, 'more_monitors');
      const monitorLimit = isPremium ? 20 : 5;
      
      if (userMonitors.length >= monitorLimit) {
        throw new Error(`Vous avez atteint la limite de ${monitorLimit} monitors. Passez à la version premium pour en créer davantage.`);
      }
      
      // Vérifier si la fréquence de vérification demandée est autorisée
      const minInterval = isPremium && await premiumManager.hasFeature(data.user_id, 'increased_frequency') ? 30 : 300;
      const interval = Math.max(minInterval, data.interval || minInterval);
      
      // Créer l'ID du monitor
      const monitorId = `${data.guild_id}-${Date.now()}`;
      
      // Préparer les options en JSON
      const options = data.options ? JSON.stringify(data.options) : null;
      
      // Insérer le monitor dans la base de données
      await executeRun(
        `INSERT INTO monitors 
        (monitor_id, guild_id, user_id, name, type, target, description, interval, timeout, is_premium, options) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          monitorId,
          data.guild_id,
          data.user_id,
          data.name,
          data.type,
          data.target,
          data.description || '',
          interval,
          data.timeout || 10000,
          data.is_premium ? 1 : 0,
          options
        ]
      );
      
      // Initialiser les statistiques
      await executeRun(
        'INSERT INTO monitor_stats (stat_id, monitor_id) VALUES (?, ?)',
        [`stat-${monitorId}`, monitorId]
      );
      
      // Démarrer le monitor si demandé
      if (data.start_now) {
        await this.startMonitor(monitorId);
      }
      
      return this.getMonitor(monitorId);
    } catch (error) {
      console.error('❌ Erreur lors de la création du monitor:', error);
      throw error;
    }
  }

  /**
   * Récupère un monitor par son ID
   * @param {string} monitorId - ID du monitor
   * @returns {Promise<Object>} Le monitor
   */
  async getMonitor(monitorId) {
    try {
      const monitor = await executeQuery('SELECT * FROM monitors WHERE monitor_id = ?', [monitorId]);
      
      if (monitor.length === 0) {
        throw new Error('Monitor introuvable.');
      }
      
      // Convertir les options JSON en objet
      if (monitor[0].options) {
        monitor[0].options = JSON.parse(monitor[0].options);
      } else {
        monitor[0].options = {};
      }
      
      return monitor[0];
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère tous les monitors
   * @returns {Promise<Array>} Liste des monitors
   */
  async getAllMonitors() {
    try {
      const monitors = await executeQuery('SELECT * FROM monitors');
      
      // Convertir les options JSON en objet pour chaque monitor
      for (const monitor of monitors) {
        if (monitor.options) {
          monitor.options = JSON.parse(monitor.options);
        } else {
          monitor.options = {};
        }
      }
      
      return monitors;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des monitors:', error);
      throw error;
    }
  }

  /**
   * Récupère les monitors d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} Liste des monitors de l'utilisateur
   */
  async getUserMonitors(userId) {
    try {
      const monitors = await executeQuery('SELECT * FROM monitors WHERE user_id = ?', [userId]);
      
      // Convertir les options JSON en objet pour chaque monitor
      for (const monitor of monitors) {
        if (monitor.options) {
          monitor.options = JSON.parse(monitor.options);
        } else {
          monitor.options = {};
        }
      }
      
      return monitors;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des monitors de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les monitors d'un serveur
   * @param {string} guildId - ID du serveur
   * @returns {Promise<Array>} Liste des monitors du serveur
   */
  async getGuildMonitors(guildId) {
    try {
      const monitors = await executeQuery('SELECT * FROM monitors WHERE guild_id = ?', [guildId]);
      
      // Convertir les options JSON en objet pour chaque monitor
      for (const monitor of monitors) {
        if (monitor.options) {
          monitor.options = JSON.parse(monitor.options);
        } else {
          monitor.options = {};
        }
      }
      
      return monitors;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des monitors du serveur ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour un monitor
   * @param {string} monitorId - ID du monitor
   * @param {Object} data - Nouvelles données
   * @returns {Promise<Object>} Le monitor mis à jour
   */
  async updateMonitor(monitorId, data) {
    try {
      const monitor = await this.getMonitor(monitorId);
      
      // Vérifier si la fréquence de vérification demandée est autorisée
      const isPremium = await premiumManager.hasFeature(monitor.user_id, 'increased_frequency');
      const minInterval = isPremium ? 30 : 300;
      
      if (data.interval && data.interval < minInterval) {
        data.interval = minInterval;
      }
      
      // Préparer les options en JSON si elles sont fournies
      let options = null;
      if (data.options) {
        options = JSON.stringify(data.options);
      } else if (monitor.options) {
        options = monitor.options;
      }
      
      // Créer la clause SET dynamique
      const updateFields = [];
      const updateValues = [];
      
      for (const [key, value] of Object.entries(data)) {
        // Ignorer les champs qui ne peuvent pas être mis à jour directement
        if (['monitor_id', 'guild_id', 'user_id', 'created_at'].includes(key)) continue;
        
        // Traiter les options séparément
        if (key === 'options') continue;
        
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
      
      // Ajouter options si nécessaire
      if (options !== null) {
        updateFields.push('options = ?');
        updateValues.push(options);
      }
      
      // Si aucun champ à mettre à jour, retourner le monitor tel quel
      if (updateFields.length === 0) {
        return monitor;
      }
      
      // Ajouter l'ID du monitor à la fin des valeurs
      updateValues.push(monitorId);
      
      // Exécuter la requête de mise à jour
      await executeRun(
        `UPDATE monitors SET ${updateFields.join(', ')} WHERE monitor_id = ?`,
        updateValues
      );
      
      // Si le monitor était en cours d'exécution, le redémarrer
      if (this.intervalHandlers.has(monitorId)) {
        await this.stopMonitor(monitorId);
        await this.startMonitor(monitorId);
      }
      
      return this.getMonitor(monitorId);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime un monitor
   * @param {string} monitorId - ID du monitor
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async deleteMonitor(monitorId) {
    try {
      // Arrêter le monitor s'il est en cours d'exécution
      if (this.intervalHandlers.has(monitorId)) {
        await this.stopMonitor(monitorId);
      }
      
      // Supprimer les alertes associées
      await executeRun('DELETE FROM monitor_alerts WHERE monitor_id = ?', [monitorId]);
      
      // Supprimer les statistiques associées
      await executeRun('DELETE FROM monitor_stats WHERE monitor_id = ?', [monitorId]);
      
      // Supprimer les logs associés (on pourrait les conserver pour l'historique)
      await executeRun('DELETE FROM monitor_logs WHERE monitor_id = ?', [monitorId]);
      
      // Supprimer le monitor
      await executeRun('DELETE FROM monitors WHERE monitor_id = ?', [monitorId]);
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Démarre un monitor
   * @param {string} monitorId - ID du monitor
   * @returns {Promise<boolean>} Succès du démarrage
   */
  async startMonitor(monitorId) {
    try {
      const monitor = await this.getMonitor(monitorId);
      
      // Vérifier si le monitor est déjà en cours d'exécution
      if (this.intervalHandlers.has(monitorId)) {
        return true;
      }
      
      // Mettre à jour le statut du monitor
      await this.updateMonitor(monitorId, { status: 'running', is_active: 1 });
      
      // Exécuter immédiatement une première vérification
      await this.checkMonitor(monitorId);
      
      // Démarrer l'intervalle de vérification
      const intervalHandler = setInterval(async () => {
        await this.checkMonitor(monitorId);
      }, monitor.interval * 1000);
      
      // Stocker le handler d'intervalle pour pouvoir l'arrêter plus tard
      this.intervalHandlers.set(monitorId, intervalHandler);
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors du démarrage du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Arrête un monitor
   * @param {string} monitorId - ID du monitor
   * @returns {Promise<boolean>} Succès de l'arrêt
   */
  async stopMonitor(monitorId) {
    try {
      // Vérifier si le monitor est en cours d'exécution
      if (!this.intervalHandlers.has(monitorId)) {
        return true;
      }
      
      // Récupérer et effacer le handler d'intervalle
      const intervalHandler = this.intervalHandlers.get(monitorId);
      clearInterval(intervalHandler);
      this.intervalHandlers.delete(monitorId);
      
      // Mettre à jour le statut du monitor
      await this.updateMonitor(monitorId, { status: 'stopped', is_active: 0 });
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de l'arrêt du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie un monitor
   * @param {string} monitorId - ID du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async checkMonitor(monitorId) {
    try {
      const monitor = await this.getMonitor(monitorId);
      const monitorType = this.monitorTypes[monitor.type.toLowerCase()];
      
      if (!monitorType) {
        throw new Error(`Type de monitor ${monitor.type} non pris en charge.`);
      }
      
      console.log(`🔍 Vérification du monitor ${monitor.name} (${monitorId})...`);
      
      // Mettre à jour la date de dernière vérification
      await executeRun(
        'UPDATE monitors SET last_check = ? WHERE monitor_id = ?',
        [new Date().toISOString(), monitorId]
      );
      
      // Exécuter la vérification
      const startTime = Date.now();
      const result = await monitorType.check(monitor);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Créer l'ID du log
      const logId = `log-${monitorId}-${Date.now()}`;
      
      // Enregistrer le résultat dans les logs
      await executeRun(
        `INSERT INTO monitor_logs 
        (log_id, monitor_id, status, response_time, message, details) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          logId,
          monitorId,
          result.status,
          responseTime,
          result.message || '',
          JSON.stringify(result.details || {})
        ]
      );
      
      // Mettre à jour le statut du monitor
      await executeRun(
        'UPDATE monitors SET status = ? WHERE monitor_id = ?',
        [result.status, monitorId]
      );
      
      // Mettre à jour les statistiques
      await this.updateMonitorStats(monitorId, result.status === 'up');
      
      // Vérifier si des alertes doivent être déclenchées
      if (result.status === 'down') {
        await this.checkAndTriggerAlerts(monitorId, result);
      }
      
      console.log(`✅ Vérification terminée pour ${monitor.name}: ${result.status}`);
      
      return {
        ...result,
        responseTime,
        logId
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification du monitor ${monitorId}:`, error);
      
      // Enregistrer l'erreur dans les logs
      const logId = `log-${monitorId}-${Date.now()}`;
      
      await executeRun(
        `INSERT INTO monitor_logs 
        (log_id, monitor_id, status, response_time, message, details) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          logId,
          monitorId,
          'error',
          0,
          error.message || 'Erreur inconnue',
          JSON.stringify({ stack: error.stack })
        ]
      );
      
      // Mettre à jour le statut du monitor
      await executeRun(
        'UPDATE monitors SET status = ? WHERE monitor_id = ?',
        ['error', monitorId]
      );
      
      return {
        status: 'error',
        message: error.message,
        details: { stack: error.stack },
        responseTime: 0,
        logId
      };
    }
  }

  /**
   * Met à jour les statistiques d'un monitor
   * @param {string} monitorId - ID du monitor
   * @param {boolean} isUp - Si le monitor est up
   * @returns {Promise<Object>} Les statistiques mises à jour
   */
  async updateMonitorStats(monitorId, isUp) {
    try {
      // Récupérer les statistiques actuelles
      const stats = await executeQuery('SELECT * FROM monitor_stats WHERE monitor_id = ?', [monitorId]);
      
      if (stats.length === 0) {
        // Créer les statistiques si elles n'existent pas
        await executeRun(
          'INSERT INTO monitor_stats (stat_id, monitor_id) VALUES (?, ?)',
          [`stat-${monitorId}`, monitorId]
        );
        return this.updateMonitorStats(monitorId, isUp);
      }
      
      const stat = stats[0];
      
      // Calculer les nouvelles statistiques
      const now = new Date();
      const logs24h = await executeQuery(
        'SELECT * FROM monitor_logs WHERE monitor_id = ? AND created_at > datetime("now", "-1 day")',
        [monitorId]
      );
      const logs7d = await executeQuery(
        'SELECT * FROM monitor_logs WHERE monitor_id = ? AND created_at > datetime("now", "-7 day")',
        [monitorId]
      );
      const logs30d = await executeQuery(
        'SELECT * FROM monitor_logs WHERE monitor_id = ? AND created_at > datetime("now", "-30 day")',
        [monitorId]
      );
      
      // Calculer l'uptime
      const upLogs24h = logs24h.filter(log => log.status === 'up').length;
      const upLogs7d = logs7d.filter(log => log.status === 'up').length;
      const upLogs30d = logs30d.filter(log => log.status === 'up').length;
      
      const uptime24h = logs24h.length > 0 ? (upLogs24h / logs24h.length) * 100 : 100;
      const uptime7d = logs7d.length > 0 ? (upLogs7d / logs7d.length) * 100 : 100;
      const uptime30d = logs30d.length > 0 ? (upLogs30d / logs30d.length) * 100 : 100;
      
      // Calculer le temps de réponse moyen
      const responseTimes24h = logs24h
        .filter(log => log.response_time > 0)
        .map(log => log.response_time);
      const responseTimes7d = logs7d
        .filter(log => log.response_time > 0)
        .map(log => log.response_time);
      const responseTimes30d = logs30d
        .filter(log => log.response_time > 0)
        .map(log => log.response_time);
      
      const avgResponse24h = responseTimes24h.length > 0
        ? responseTimes24h.reduce((sum, time) => sum + time, 0) / responseTimes24h.length
        : null;
      const avgResponse7d = responseTimes7d.length > 0
        ? responseTimes7d.reduce((sum, time) => sum + time, 0) / responseTimes7d.length
        : null;
      const avgResponse30d = responseTimes30d.length > 0
        ? responseTimes30d.reduce((sum, time) => sum + time, 0) / responseTimes30d.length
        : null;
      
      // Mettre à jour les statistiques
      await executeRun(
        `UPDATE monitor_stats SET 
        uptime_24h = ?, 
        uptime_7d = ?, 
        uptime_30d = ?, 
        avg_response_24h = ?, 
        avg_response_7d = ?, 
        avg_response_30d = ?, 
        checks_count = checks_count + 1, 
        failures_count = failures_count + ?, 
        last_updated = ? 
        WHERE monitor_id = ?`,
        [
          uptime24h,
          uptime7d,
          uptime30d,
          avgResponse24h,
          avgResponse7d,
          avgResponse30d,
          isUp ? 0 : 1,
          now.toISOString(),
          monitorId
        ]
      );
      
      return {
        uptime24h,
        uptime7d,
        uptime30d,
        avgResponse24h,
        avgResponse7d,
        avgResponse30d,
        checksCount: stat.checks_count + 1,
        failuresCount: stat.failures_count + (isUp ? 0 : 1)
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour des statistiques du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques d'un monitor
   * @param {string} monitorId - ID du monitor
   * @returns {Promise<Object>} Les statistiques
   */
  async getMonitorStats(monitorId) {
    try {
      const stats = await executeQuery('SELECT * FROM monitor_stats WHERE monitor_id = ?', [monitorId]);
      
      if (stats.length === 0) {
        throw new Error('Statistiques introuvables.');
      }
      
      return stats[0];
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des statistiques du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les logs d'un monitor
   * @param {string} monitorId - ID du monitor
   * @param {number} limit - Limite de résultats
   * @param {number} offset - Offset de pagination
   * @returns {Promise<Array>} Les logs
   */
  async getMonitorLogs(monitorId, limit = 10, offset = 0) {
    try {
      const logs = await executeQuery(
        'SELECT * FROM monitor_logs WHERE monitor_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [monitorId, limit, offset]
      );
      
      // Convertir les details JSON en objet pour chaque log
      for (const log of logs) {
        if (log.details) {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            log.details = {};
          }
        } else {
          log.details = {};
        }
      }
      
      return logs;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des logs du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Crée une alerte pour un monitor
   * @param {Object} data - Les données de l'alerte
   * @returns {Promise<Object>} L'alerte créée
   */
  async createAlert(data) {
    try {
      // Vérifier les fonctionnalités premium
      if (data.alert_type === 'webhook' && !await premiumManager.hasFeature(data.user_id, 'webhook_alerts')) {
        throw new Error('Les alertes webhook sont une fonctionnalité premium.');
      }
      
      // Créer l'ID de l'alerte
      const alertId = `alert-${data.monitor_id}-${Date.now()}`;
      
      // Insérer l'alerte dans la base de données
      await executeRun(
        `INSERT INTO monitor_alerts 
        (alert_id, monitor_id, guild_id, alert_type, threshold, channel_id, role_id, webhook_url, consecutive_failures, cooldown) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alertId,
          data.monitor_id,
          data.guild_id,
          data.alert_type,
          data.threshold || null,
          data.channel_id || null,
          data.role_id || null,
          data.webhook_url || null,
          data.consecutive_failures || 1,
          data.cooldown || 300
        ]
      );
      
      return this.getAlert(alertId);
    } catch (error) {
      console.error('❌ Erreur lors de la création de l\'alerte:', error);
      throw error;
    }
  }

  /**
   * Récupère une alerte par son ID
   * @param {string} alertId - ID de l'alerte
   * @returns {Promise<Object>} L'alerte
   */
  async getAlert(alertId) {
    try {
      const alert = await executeQuery('SELECT * FROM monitor_alerts WHERE alert_id = ?', [alertId]);
      
      if (alert.length === 0) {
        throw new Error('Alerte introuvable.');
      }
      
      return alert[0];
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération de l'alerte ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les alertes d'un monitor
   * @param {string} monitorId - ID du monitor
   * @returns {Promise<Array>} Les alertes
   */
  async getMonitorAlerts(monitorId) {
    try {
      const alerts = await executeQuery('SELECT * FROM monitor_alerts WHERE monitor_id = ?', [monitorId]);
      return alerts;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des alertes du monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour une alerte
   * @param {string} alertId - ID de l'alerte
   * @param {Object} data - Nouvelles données
   * @returns {Promise<Object>} L'alerte mise à jour
   */
  async updateAlert(alertId, data) {
    try {
      const alert = await this.getAlert(alertId);
      
      // Créer la clause SET dynamique
      const updateFields = [];
      const updateValues = [];
      
      for (const [key, value] of Object.entries(data)) {
        // Ignorer les champs qui ne peuvent pas être mis à jour directement
        if (['alert_id', 'monitor_id', 'guild_id'].includes(key)) continue;
        
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
      
      // Si aucun champ à mettre à jour, retourner l'alerte telle quelle
      if (updateFields.length === 0) {
        return alert;
      }
      
      // Ajouter l'ID de l'alerte à la fin des valeurs
      updateValues.push(alertId);
      
      // Exécuter la requête de mise à jour
      await executeRun(
        `UPDATE monitor_alerts SET ${updateFields.join(', ')} WHERE alert_id = ?`,
        updateValues
      );
      
      return this.getAlert(alertId);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour de l'alerte ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime une alerte
   * @param {string} alertId - ID de l'alerte
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async deleteAlert(alertId) {
    try {
      await executeRun('DELETE FROM monitor_alerts WHERE alert_id = ?', [alertId]);
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression de l'alerte ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie et déclenche les alertes pour un monitor
   * @param {string} monitorId - ID du monitor
   * @param {Object} result - Résultat de la vérification
   * @returns {Promise<Array>} Alertes déclenchées
   */
  async checkAndTriggerAlerts(monitorId, result) {
    try {
      const monitor = await this.getMonitor(monitorId);
      const alerts = await this.getMonitorAlerts(monitorId);
      const triggeredAlerts = [];
      
      // Récupérer les derniers logs pour vérifier les échecs consécutifs
      const recentLogs = await this.getMonitorLogs(monitorId, 10);
      
      for (const alert of alerts) {
        if (!alert.is_active) continue;
        
        // Vérifier si l'alerte est en cooldown
        if (alert.last_triggered) {
          const lastTriggered = new Date(alert.last_triggered);
          const now = new Date();
          const cooldownMs = alert.cooldown * 1000;
          
          if (now - lastTriggered < cooldownMs) {
            continue;
          }
        }
        
        // Vérifier le nombre d'échecs consécutifs
        const consecutiveFailures = recentLogs
          .filter(log => log.status === 'down')
          .slice(0, alert.consecutive_failures)
          .length;
        
        if (consecutiveFailures < alert.consecutive_failures) {
          continue;
        }
        
        // Déclencher l'alerte en fonction de son type
        switch (alert.alert_type) {
          case 'channel':
            if (alert.channel_id) {
              await this.sendChannelAlert(monitor, result, alert);
              triggeredAlerts.push(alert);
            }
            break;
            
          case 'webhook':
            if (alert.webhook_url) {
              await this.sendWebhookAlert(monitor, result, alert);
              triggeredAlerts.push(alert);
            }
            break;
            
          default:
            console.warn(`Type d'alerte inconnu: ${alert.alert_type}`);
        }
        
        // Mettre à jour la date de dernier déclenchement
        await this.updateAlert(alert.alert_id, {
          last_triggered: new Date().toISOString()
        });
      }
      
      return triggeredAlerts;
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification des alertes pour le monitor ${monitorId}:`, error);
      throw error;
    }
  }

  /**
   * Envoie une alerte dans un canal Discord
   * @param {Object} monitor - Le monitor
   * @param {Object} result - Résultat de la vérification
   * @param {Object} alert - L'alerte
   * @returns {Promise<boolean>} Succès de l'envoi
   */
  async sendChannelAlert(monitor, result, alert) {
    try {
      const client = global.client;
      if (!client) {
        throw new Error('Client Discord non disponible.');
      }
      
      const guild = client.guilds.cache.get(alert.guild_id);
      if (!guild) {
        throw new Error('Serveur non trouvé.');
      }
      
      const channel = guild.channels.cache.get(alert.channel_id);
      if (!channel) {
        throw new Error('Canal non trouvé.');
      }
      
      // Créer l'embed d'alerte
      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Alerte: ${monitor.name}`)
        .setDescription(`Le service ${monitor.target} est indisponible!`)
        .setColor(EMBED_COLORS.ERROR)
        .addFields(
          { name: 'Type', value: monitor.type, inline: true },
          { name: 'Statut', value: result.status, inline: true },
          { name: 'Message', value: result.message || 'Aucun message', inline: false }
        )
        .setTimestamp();
      
      // Ajouter des détails supplémentaires si disponibles
      if (result.details) {
        for (const [key, value] of Object.entries(result.details)) {
          if (typeof value === 'object') {
            embed.addFields({
              name: key,
              value: '```json\n' + JSON.stringify(value, null, 2) + '\n```',
              inline: false
            });
          } else {
            embed.addFields({
              name: key,
              value: String(value),
              inline: true
            });
          }
        }
      }
      
      // Mentionner un rôle si configuré
      const content = alert.role_id ? `<@&${alert.role_id}>` : '';
      
      await channel.send({
        content,
        embeds: [embed]
      });
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'alerte dans le canal:', error);
      throw error;
    }
  }

  /**
   * Envoie une alerte à un webhook
   * @param {Object} monitor - Le monitor
   * @param {Object} result - Résultat de la vérification
   * @param {Object} alert - L'alerte
   * @returns {Promise<boolean>} Succès de l'envoi
   */
  async sendWebhookAlert(monitor, result, alert) {
    try {
      const webhookUrl = alert.webhook_url;
      if (!webhookUrl) {
        throw new Error('URL de webhook non définie.');
      }
      
      // Préparer les données pour le webhook
      const data = {
        monitor: {
          id: monitor.monitor_id,
          name: monitor.name,
          type: monitor.type,
          target: monitor.target
        },
        result: {
          status: result.status,
          message: result.message,
          details: result.details
        },
        timestamp: new Date().toISOString()
      };
      
      // Envoyer la requête au webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de l'envoi au webhook: ${response.status} ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'alerte au webhook:', error);
      throw error;
    }
  }

  /**
   * Génère un embed de statut pour un monitor
   * @param {Object} monitor - Le monitor
   * @param {Object} stats - Les statistiques
   * @returns {EmbedBuilder} L'embed de statut
   */
  async generateStatusEmbed(monitor, stats = null) {
    try {
      // Récupérer les statistiques si non fournies
      if (!stats) {
        stats = await this.getMonitorStats(monitor.monitor_id);
      }
      
      // Récupérer le dernier log
      const recentLogs = await this.getMonitorLogs(monitor.monitor_id, 1);
      const lastLog = recentLogs.length > 0 ? recentLogs[0] : null;
      
      // Récupérer les informations sur l'utilisateur
      const client = global.client;
      const user = client ? await client.users.fetch(monitor.user_id).catch(() => null) : null;
      
      // Déterminer la couleur en fonction du statut
      let color = EMBED_COLORS.INFO;
      if (monitor.status === 'up') {
        color = EMBED_COLORS.SUCCESS;
      } else if (monitor.status === 'down') {
        color = EMBED_COLORS.ERROR;
      } else if (monitor.status === 'pending') {
        color = EMBED_COLORS.WARNING;
      }
      
      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${monitor.name}`)
        .setDescription(`**Type:** ${monitor.type.toUpperCase()}\n**Cible:** ${monitor.target}`)
        .setColor(color)
        .addFields(
          { name: 'Statut', value: this.formatStatus(monitor.status), inline: true },
          { name: 'Intervalle', value: `${monitor.interval}s`, inline: true },
          { name: 'Uptime (24h)', value: `${stats.uptime_24h.toFixed(2)}%`, inline: true },
          { name: 'Temps de réponse moyen', value: stats.avg_response_24h ? `${stats.avg_response_24h.toFixed(2)}ms` : 'N/A', inline: true },
          { name: 'Vérifications totales', value: String(stats.checks_count), inline: true },
          { name: 'Échecs totaux', value: String(stats.failures_count), inline: true }
        );
      
      // Ajouter des informations sur le dernier log si disponible
      if (lastLog) {
        embed.addFields(
          { name: 'Dernière vérification', value: new Date(lastLog.created_at).toLocaleString(), inline: false },
          { name: 'Message', value: lastLog.message || 'Aucun message', inline: false }
        );
      }
      
      // Ajouter le timestamp
      embed.setTimestamp();
      
      // Ajouter l'auteur si disponible
      if (user) {
        embed.setFooter({
          text: `Créé par ${user.tag}`,
          iconURL: user.displayAvatarURL()
        });
      }
      
      return embed;
    } catch (error) {
      console.error(`❌ Erreur lors de la génération de l'embed de statut pour le monitor ${monitor.monitor_id}:`, error);
      throw error;
    }
  }

  /**
   * Formate le statut pour l'affichage
   * @param {string} status - Le statut
   * @returns {string} Le statut formaté
   */
  formatStatus(status) {
    switch (status) {
      case 'up':
        return '🟢 En ligne';
      case 'down':
        return '🔴 Hors ligne';
      case 'pending':
        return '🟠 En attente';
      case 'error':
        return '⚠️ Erreur';
      case 'running':
        return '🟢 En cours';
      case 'stopped':
        return '⚫ Arrêté';
      default:
        return status;
    }
  }
}

const monitorManager = new MonitorManager();
export default monitorManager;