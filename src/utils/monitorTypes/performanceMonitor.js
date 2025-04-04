// src/utils/monitorTypes/performanceMonitor.js
import https from 'https';
import http from 'http';
import { URL } from 'url';

class PerformanceMonitor {
  /**
   * Vérifie les performances d'un site web
   * @param {Object} monitor - Configuration du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async check(monitor) {
    try {
      // Analyser l'URL cible
      const url = new URL(monitor.target);
      const protocol = url.protocol === 'https:' ? https : http;
      
      // Récupérer les seuils d'alerte
      const options = monitor.options || {};
      const thresholds = {
        slow: options.slowThreshold || 2000, // ms
        critical: options.criticalThreshold || 5000 // ms
      };
      
      // Effectuer la requête avec mesure du temps
      const startTime = Date.now();
      const response = await this._request(protocol, {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        timeout: monitor.timeout || 10000,
        headers: {
          'User-Agent': 'PiloteCommunity-Bot-Monitor/1.0'
        }
      });
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Vérifier le code de statut
      if (response.statusCode !== 200) {
        return {
          status: 'down',
          message: `Code de statut HTTP inattendu: ${response.statusCode}`,
          details: {
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            loadTime
          }
        };
      }
      
      // Vérifier les performances
      if (loadTime > thresholds.critical) {
        return {
          status: 'down',
          message: `Temps de chargement critique: ${loadTime}ms`,
          details: {
            loadTime,
            threshold: thresholds.critical,
            url: monitor.target,
            statusCode: response.statusCode,
            contentLength: response.headers['content-length'] || response.body.length
          }
        };
      }
      
      if (loadTime > thresholds.slow) {
        return {
          status: 'up',
          message: `Temps de chargement lent: ${loadTime}ms`,
          details: {
            loadTime,
            threshold: thresholds.slow,
            url: monitor.target,
            statusCode: response.statusCode,
            contentLength: response.headers['content-length'] || response.body.length
          }
        };
      }
      
      // Tout est bon
      return {
        status: 'up',
        message: `Temps de chargement: ${loadTime}ms`,
        details: {
          loadTime,
          url: monitor.target,
          statusCode: response.statusCode,
          contentLength: response.headers['content-length'] || response.body.length
        }
      };
    } catch (error) {
      // Gérer les erreurs
      return {
        status: 'down',
        message: `Erreur de vérification: ${error.message}`,
        details: { error: error.message }
      };
    }
  }
  
  /**
   * Effectue une requête HTTP/HTTPS
   * @param {Object} protocol - Module http ou https
   * @param {Object} options - Options de la requête
   * @returns {Promise<Object>} Réponse de la requête
   */
  _request(protocol, options) {
    return new Promise((resolve, reject) => {
      const req = protocol.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: body
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }
}

export default new PerformanceMonitor();