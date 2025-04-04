// src/utils/statusPageManager.js
import { executeQuery, executeRun } from '../database/manager.js';
import premiumManager from './premiumManager.js';
import monitorManager from './monitorManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Obtenir le répertoire actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StatusPageManager {
  constructor() {
    this.updateIntervals = new Map();
    this.statusPagesDir = path.join(__dirname, '../../status_pages');
  }

  /**
   * Initialise le système de pages de statut
   */
  async initialize() {
    try {
      console.log('🔄 Initialisation du système de pages de statut...');
      
      // Créer le dossier de pages de statut s'il n'existe pas
      if (!fs.existsSync(this.statusPagesDir)) {
        fs.mkdirSync(this.statusPagesDir, { recursive: true });
      }
      
      // Créer la table si elle n'existe pas
      await executeRun(`
        CREATE TABLE IF NOT EXISTS status_pages (
          page_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          logo_url TEXT,
          monitors TEXT NOT NULL,
          update_interval INTEGER DEFAULT 300,
          public_url TEXT,
          access_token TEXT,
          is_public INTEGER DEFAULT 1,
          theme TEXT DEFAULT 'light',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_updated DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
      `);
      
      // Charger toutes les pages de statut
      const pages = await this.getAllStatusPages();
      
      // Démarrer les mises à jour périodiques pour chaque page
      for (const page of pages) {
        await this.startPageUpdates(page.page_id);
      }
      
      console.log(`✅ Système de pages de statut initialisé avec ${pages.length} pages.`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du système de pages de statut:', error);
    }
  }

  /**
   * Crée une nouvelle page de statut
   * @param {Object} data - Les données de la page
   * @returns {Promise<Object>} La page créée
   */
  async createStatusPage(data) {
    try {
      // Vérifier si l'utilisateur a la fonctionnalité premium
      const isPremium = await premiumManager.hasFeature(data.user_id, 'status_page');
      
      if (!isPremium) {
        throw new Error('Les pages de statut sont une fonctionnalité premium.');
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
      
      // Créer l'ID de la page
      const pageId = `status-${data.guild_id}-${Date.now()}`;
      
      // Générer un token d'accès aléatoire
      const accessToken = crypto.randomBytes(32).toString('hex');
      
      // Créer l'URL publique
      const publicUrl = `status/${pageId}`;
      
      // Insérer la page dans la base de données
      await executeRun(
        `INSERT INTO status_pages 
        (page_id, user_id, guild_id, title, description, logo_url, monitors, update_interval, public_url, access_token, is_public, theme) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pageId,
          data.user_id,
          data.guild_id,
          data.title,
          data.description || '',
          data.logo_url || '',
          JSON.stringify(monitors),
          data.update_interval || 300,
          publicUrl,
          accessToken,
          data.is_public !== undefined ? (data.is_public ? 1 : 0) : 1,
          data.theme || 'light'
        ]
      );
      
      // Générer la page initiale
      await this.generateStatusPage(pageId);
      
      // Démarrer les mises à jour périodiques
      await this.startPageUpdates(pageId);
      
      return this.getStatusPage(pageId);
    } catch (error) {
      console.error('❌ Erreur lors de la création de la page de statut:', error);
      throw error;
    }
  }

  /**
   * Récupère une page de statut par son ID
   * @param {string} pageId - ID de la page
   * @returns {Promise<Object>} La page de statut
   */
  async getStatusPage(pageId) {
    try {
      const page = await executeQuery('SELECT * FROM status_pages WHERE page_id = ?', [pageId]);
      
      if (page.length === 0) {
        throw new Error('Page de statut introuvable.');
      }
      
      // Convertir les monitors JSON en tableau
      page[0].monitors = JSON.parse(page[0].monitors);
      
      return page[0];
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération de la page de statut ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère toutes les pages de statut
   * @returns {Promise<Array>} Liste des pages de statut
   */
  async getAllStatusPages() {
    try {
      const pages = await executeQuery('SELECT * FROM status_pages');
      
      // Convertir les monitors JSON en tableau pour chaque page
      for (const page of pages) {
        page.monitors = JSON.parse(page.monitors);
      }
      
      return pages;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des pages de statut:', error);
      throw error;
    }
  }

  /**
   * Récupère les pages de statut d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} Liste des pages de statut de l'utilisateur
   */
  async getUserStatusPages(userId) {
    try {
      const pages = await executeQuery('SELECT * FROM status_pages WHERE user_id = ?', [userId]);
      
      // Convertir les monitors JSON en tableau pour chaque page
      for (const page of pages) {
        page.monitors = JSON.parse(page.monitors);
      }
      
      return pages;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des pages de statut de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour une page de statut
   * @param {string} pageId - ID de la page
   * @param {Object} data - Nouvelles données
   * @returns {Promise<Object>} La page mise à jour
   */
  async updateStatusPage(pageId, data) {
    try {
      const page = await this.getStatusPage(pageId);
      
      // Vérifier si les monitors spécifiés existent et appartiennent à l'utilisateur
      if (data.monitors) {
        const monitors = Array.isArray(data.monitors) ? data.monitors : JSON.parse(data.monitors);
        
        for (const monitorId of monitors) {
          const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
          
          if (!monitor) {
            throw new Error(`Monitor ${monitorId} introuvable.`);
          }
          
          if (monitor.user_id !== page.user_id) {
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
        if (['page_id', 'user_id', 'guild_id', 'created_at', 'public_url', 'access_token'].includes(key)) continue;
        
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
      
      // Si aucun champ à mettre à jour, retourner la page telle quelle
      if (updateFields.length === 0) {
        return page;
      }
      
      // Ajouter l'ID de la page à la fin des valeurs
      updateValues.push(pageId);
      
      // Exécuter la requête de mise à jour
      await executeRun(
        `UPDATE status_pages SET ${updateFields.join(', ')} WHERE page_id = ?`,
        updateValues
      );
      
      // Si l'intervalle de mise à jour a changé, redémarrer les mises à jour
      if (data.update_interval) {
        await this.restartPageUpdates(pageId);
      } else {
        // Sinon, juste régénérer la page
        await this.generateStatusPage(pageId);
      }
      
      return this.getStatusPage(pageId);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour de la page de statut ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime une page de statut
   * @param {string} pageId - ID de la page
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async deleteStatusPage(pageId) {
    try {
      // Arrêter les mises à jour périodiques
      this.stopPageUpdates(pageId);
      
      // Supprimer le fichier HTML
      const htmlPath = path.join(this.statusPagesDir, `${pageId}.html`);
      if (fs.existsSync(htmlPath)) {
        fs.unlinkSync(htmlPath);
      }
      
      // Supprimer la page de la base de données
      await executeRun('DELETE FROM status_pages WHERE page_id = ?', [pageId]);
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression de la page de statut ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Démarre les mises à jour périodiques d'une page de statut
   * @param {string} pageId - ID de la page
   * @returns {Promise<boolean>} Succès du démarrage
   */
  async startPageUpdates(pageId) {
    try {
      // Arrêter les mises à jour existantes si nécessaire
      this.stopPageUpdates(pageId);
      
      // Récupérer la page
      const page = await this.getStatusPage(pageId);
      
      // Calculer l'intervalle en millisecondes
      const interval = page.update_interval * 1000;
      
      // Démarrer les mises à jour périodiques
      const intervalId = setInterval(async () => {
        try {
          await this.generateStatusPage(pageId);
        } catch (error) {
          console.error(`❌ Erreur lors de la mise à jour automatique de la page de statut ${pageId}:`, error);
        }
      }, interval);
      
      // Stocker l'ID d'intervalle
      this.updateIntervals.set(pageId, intervalId);
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors du démarrage des mises à jour de la page de statut ${pageId}:`, error);
      return false;
    }
  }

  /**
   * Arrête les mises à jour périodiques d'une page de statut
   * @param {string} pageId - ID de la page
   * @returns {boolean} Succès de l'arrêt
   */
  stopPageUpdates(pageId) {
    try {
      if (this.updateIntervals.has(pageId)) {
        clearInterval(this.updateIntervals.get(pageId));
        this.updateIntervals.delete(pageId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Erreur lors de l'arrêt des mises à jour de la page de statut ${pageId}:`, error);
      return false;
    }
  }

  /**
   * Redémarre les mises à jour périodiques d'une page de statut
   * @param {string} pageId - ID de la page
   * @returns {Promise<boolean>} Succès du redémarrage
   */
  async restartPageUpdates(pageId) {
    try {
      this.stopPageUpdates(pageId);
      return await this.startPageUpdates(pageId);
    } catch (error) {
      console.error(`❌ Erreur lors du redémarrage des mises à jour de la page de statut ${pageId}:`, error);
      return false;
    }
  }

  /**
   * Génère le fichier HTML d'une page de statut
   * @param {string} pageId - ID de la page
   * @returns {Promise<string>} Chemin du fichier généré
   */
  async generateStatusPage(pageId) {
    try {
      // Récupérer la page
      const page = await this.getStatusPage(pageId);
      
      // Récupérer les informations sur les monitors
      const monitorData = [];
      
      for (const monitorId of page.monitors) {
        try {
          const monitor = await monitorManager.getMonitor(monitorId);
          const stats = await monitorManager.getMonitorStats(monitorId);
          
          // Récupérer les logs récents
          const logs = await monitorManager.getMonitorLogs(monitorId, 10);
          
          monitorData.push({
            monitor,
            stats,
            logs
          });
        } catch (error) {
          console.error(`❌ Erreur lors de la récupération des informations du monitor ${monitorId}:`, error);
        }
      }
      
      // Compter les monitors par statut
      const statusCounts = {
        up: monitorData.filter(data => data.monitor.status === 'up').length,
        down: monitorData.filter(data => data.monitor.status === 'down').length,
        other: monitorData.filter(data => data.monitor.status !== 'up' && data.monitor.status !== 'down').length
      };
      
      // Déterminer le statut global
      let globalStatus = 'operational';
      
      if (statusCounts.down > 0) {
        globalStatus = 'major_outage';
      } else if (statusCounts.other > 0) {
        globalStatus = 'partial_outage';
      }
      
      // Déterminer le thème CSS
      const theme = page.theme || 'light';
      const themeColors = this.getThemeColors(theme);
      
      // Générer le contenu HTML
      let htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title} - Statut des services</title>
  <style>
    :root {
      --bg-color: ${themeColors.bgColor};
      --text-color: ${themeColors.textColor};
      --header-color: ${themeColors.headerColor};
      --card-bg: ${themeColors.cardBg};
      --card-border: ${themeColors.cardBorder};
      --success-color: ${themeColors.successColor};
      --error-color: ${themeColors.errorColor};
      --warning-color: ${themeColors.warningColor};
      --muted-color: ${themeColors.mutedColor};
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      text-align: center;
      padding: 30px 0;
      border-bottom: 1px solid var(--card-border);
    }
    
    header h1 {
      margin: 0;
      color: var(--header-color);
      font-size: 2.5rem;
    }
    
    header p {
      margin: 10px 0 0;
      color: var(--muted-color);
    }
    
    .status-overview {
      background-color: var(--card-bg);
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 50px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .status-operational {
      background-color: var(--success-color);
      color: white;
    }
    
    .status-partial {
      background-color: var(--warning-color);
      color: white;
    }
    
    .status-major {
      background-color: var(--error-color);
      color: white;
    }
    
    .status-counts {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-top: 15px;
    }
    
    .count-box {
      text-align: center;
    }
    
    .count-value {
      font-size: 2rem;
      font-weight: bold;
    }
    
    .count-up {
      color: var(--success-color);
    }
    
    .count-down {
      color: var(--error-color);
    }
    
    .count-other {
      color: var(--warning-color);
    }
    
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    
    .service-card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .service-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .service-status {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      margin-right: 10px;
    }
    
    .status-up {
      background-color: var(--success-color);
    }
    
    .status-down {
      background-color: var(--error-color);
    }
    
    .status-other {
      background-color: var(--warning-color);
    }
    
    .service-name {
      margin: 0;
      font-size: 1.2rem;
      font-weight: bold;
    }
    
    .service-info {
      margin-bottom: 15px;
      font-size: 0.9rem;
    }
    
    .service-info p {
      margin: 5px 0;
    }
    
    .uptime-bars {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    
    .uptime-period {
      flex: 1;
    }
    
    .uptime-label {
      font-size: 0.8rem;
      margin-bottom: 5px;
    }
    
    .uptime-value {
      font-size: 0.9rem;
      font-weight: bold;
    }
    
    .uptime-bar {
      height: 6px;
      border-radius: 3px;
      background-color: var(--muted-color);
      overflow: hidden;
    }
    
    .uptime-fill {
      height: 100%;
      background-color: var(--success-color);
    }
    
    .logs-section {
      margin-top: 20px;
      border-top: 1px solid var(--card-border);
      padding-top: 15px;
    }
    
    .logs-toggle {
      background: none;
      border: none;
      color: var(--header-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 0;
      font-size: 0.9rem;
      font-weight: bold;
    }
    
    .logs-content {
      display: none;
      margin-top: 10px;
      font-size: 0.85rem;
    }
    
    .log-entry {
      padding: 8px;
      border-left: 3px solid;
      margin-bottom: 5px;
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .log-up {
      border-left-color: var(--success-color);
    }
    
    .log-down {
      border-left-color: var(--error-color);
    }
    
    .log-date {
      font-size: 0.8rem;
      color: var(--muted-color);
    }
    
    footer {
      text-align: center;
      margin-top: 50px;
      padding: 20px 0;
      border-top: 1px solid var(--card-border);
      color: var(--muted-color);
      font-size: 0.9rem;
    }
    
    @media (max-width: 768px) {
      .services-grid {
        grid-template-columns: 1fr;
      }
      
      .status-counts {
        flex-direction: column;
        gap: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      ${page.logo_url ? `<img src="${page.logo_url}" alt="Logo" style="max-height: 80px; margin-bottom: 15px;">` : ''}
      <h1>${page.title}</h1>
      <p>${page.description || 'Statut des services en temps réel'}</p>
    </header>
    
    <div class="status-overview">
      ${globalStatus === 'operational' 
        ? '<div class="status-badge status-operational">Tous les systèmes opérationnels</div>'
        : globalStatus === 'partial_outage'
          ? '<div class="status-badge status-partial">Perturbations partielles</div>'
          : '<div class="status-badge status-major">Panne majeure</div>'
      }
      
      <p>Dernière mise à jour: ${new Date().toLocaleString()}</p>
      
      <div class="status-counts">
        <div class="count-box">
          <div class="count-value count-up">${statusCounts.up}</div>
          <div>Opérationnels</div>
        </div>
        
        <div class="count-box">
          <div class="count-value count-down">${statusCounts.down}</div>
          <div>En panne</div>
        </div>
        
        <div class="count-box">
          <div class="count-value count-other">${statusCounts.other}</div>
          <div>Autres</div>
        </div>
      </div>
    </div>
    
    <h2>Services</h2>
    <div class="services-grid">`;
      
      // Ajouter les services (monitors)
      for (const { monitor, stats, logs } of monitorData) {
        const statusClass = monitor.status === 'up' ? 'status-up' : monitor.status === 'down' ? 'status-down' : 'status-other';
        const statusText = monitorManager.formatStatus(monitor.status);
        
        htmlContent += `
      <div class="service-card">
        <div class="service-header">
          <div class="service-status ${statusClass}"></div>
          <h3 class="service-name">${monitor.name}</h3>
        </div>
        
        <div class="service-info">
          <p><strong>Type:</strong> ${monitor.type}</p>
          <p><strong>Statut:</strong> ${statusText}</p>
          ${logs.length > 0 
            ? `<p><strong>Dernière vérification:</strong> ${new Date(logs[0].created_at).toLocaleString()}</p>`
            : ''
          }
        </div>
        
        <div class="uptime-bars">
          <div class="uptime-period">
            <div class="uptime-label">24h</div>
            <div class="uptime-value">${stats.uptime_24h.toFixed(2)}%</div>
            <div class="uptime-bar">
              <div class="uptime-fill" style="width: ${stats.uptime_24h}%"></div>
            </div>
          </div>
          
          <div class="uptime-period">
            <div class="uptime-label">7j</div>
            <div class="uptime-value">${stats.uptime_7d.toFixed(2)}%</div>
            <div class="uptime-bar">
              <div class="uptime-fill" style="width: ${stats.uptime_7d}%"></div>
            </div>
          </div>
          
          <div class="uptime-period">
            <div class="uptime-label">30j</div>
            <div class="uptime-value">${stats.uptime_30d.toFixed(2)}%</div>
            <div class="uptime-bar">
              <div class="uptime-fill" style="width: ${stats.uptime_30d}%"></div>
            </div>
          </div>
        </div>
        
        <div class="logs-section">
          <button class="logs-toggle" onclick="toggleLogs('logs-${monitor.monitor_id}')">
            Historique récent
          </button>
          
          <div id="logs-${monitor.monitor_id}" class="logs-content">`;
        
        // Ajouter les logs
        if (logs.length === 0) {
          htmlContent += `<p>Aucun historique disponible.</p>`;
        } else {
          for (const log of logs) {
            const logClass = log.status === 'up' ? 'log-up' : 'log-down';
            const logDate = new Date(log.created_at).toLocaleString();
            
            htmlContent += `
            <div class="log-entry ${logClass}">
              <div class="log-date">${logDate}</div>
              <div>${log.message}</div>
            </div>`;
          }
        }
        
        htmlContent += `
          </div>
        </div>
      </div>`;
      }
      
      // Fermer le document HTML
      htmlContent += `
    </div>
    
    <footer>
      <p>Généré par PiloteCommunity Bot</p>
      <p>© ${new Date().getFullYear()} Pilote Production</p>
    </footer>
  </div>
  
  <script>
    function toggleLogs(id) {
      const logsContent = document.getElementById(id);
      if (logsContent.style.display === 'block') {
        logsContent.style.display = 'none';
      } else {
        logsContent.style.display = 'block';
      }
    }
  </script>
</body>
</html>`;
      
      // Écrire le fichier HTML
      const htmlPath = path.join(this.statusPagesDir, `${pageId}.html`);
      fs.writeFileSync(htmlPath, htmlContent);
      
      // Mettre à jour la date de dernière mise à jour
      await executeRun(
        'UPDATE status_pages SET last_updated = ? WHERE page_id = ?',
        [new Date().toISOString(), pageId]
      );
      
      return htmlPath;
    } catch (error) {
      console.error(`❌ Erreur lors de la génération de la page de statut ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les couleurs d'un thème
   * @param {string} theme - Nom du thème
   * @returns {Object} Couleurs du thème
   */
  getThemeColors(theme) {
    const themes = {
      light: {
        bgColor: '#f8f9fa',
        textColor: '#333333',
        headerColor: '#2c3e50',
        cardBg: '#ffffff',
        cardBorder: '#e0e0e0',
        successColor: '#28a745',
        errorColor: '#dc3545',
        warningColor: '#ffc107',
        mutedColor: '#6c757d'
      },
      dark: {
        bgColor: '#121212',
        textColor: '#e0e0e0',
        headerColor: '#f8f9fa',
        cardBg: '#1e1e1e',
        cardBorder: '#333333',
        successColor: '#28a745',
        errorColor: '#dc3545',
        warningColor: '#ffc107',
        mutedColor: '#6c757d'
      },
      blue: {
        bgColor: '#f0f8ff',
        textColor: '#333333',
        headerColor: '#0056b3',
        cardBg: '#ffffff',
        cardBorder: '#b8daff',
        successColor: '#28a745',
        errorColor: '#dc3545',
        warningColor: '#ffc107',
        mutedColor: '#6c757d'
      },
      corporate: {
        bgColor: '#ffffff',
        textColor: '#333333',
        headerColor: '#1a365d',
        cardBg: '#f8f9fa',
        cardBorder: '#e0e0e0',
        successColor: '#2c7a7b',
        errorColor: '#c53030',
        warningColor: '#d69e2e',
        mutedColor: '#718096'
      },
      minimal: {
        bgColor: '#ffffff',
        textColor: '#333333',
        headerColor: '#333333',
        cardBg: '#ffffff',
        cardBorder: '#f0f0f0',
        successColor: '#38b2ac',
        errorColor: '#e53e3e',
        warningColor: '#d69e2e',
        mutedColor: '#a0aec0'
      }
    };
    
    return themes[theme] || themes.light;
  }

  /**
   * Vérifie si une page de statut est accessible
   * @param {string} pageId - ID de la page
   * @param {string} token - Token d'accès (pour les pages privées)
   * @returns {Promise<boolean>} Si la page est accessible
   */
  async canAccessStatusPage(pageId, token = null) {
    try {
      const page = await this.getStatusPage(pageId);
      
      // Si la page est publique, l'accès est autorisé
      if (page.is_public) {
        return true;
      }
      
      // Si la page est privée, vérifier le token
      return token === page.access_token;
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification d'accès à la page de statut ${pageId}:`, error);
      return false;
    }
  }
}

const statusPageManager = new StatusPageManager();
export default statusPageManager;