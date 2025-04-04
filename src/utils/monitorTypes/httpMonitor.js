// src/utils/monitorTypes/httpMonitor.js
import https from 'https';
import http from 'http';
import { URL } from 'url';

class HttpMonitor {
  /**
   * Vérifie un service HTTP ou HTTPS
   * @param {Object} monitor - Configuration du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async check(monitor) {
    try {
      // Analyser l'URL cible
      const url = new URL(monitor.target);
      const protocol = url.protocol === 'https:' ? https : http;
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        timeout: monitor.timeout || 10000,
        headers: {
          'User-Agent': 'PiloteCommunity-Bot-Monitor/1.0'
        }
      };
      
      // Ajouter des options spécifiques si configurées
      if (monitor.options) {
        // Headers personnalisés
        if (monitor.options.headers) {
          options.headers = { ...options.headers, ...monitor.options.headers };
        }
        
        // Méthode HTTP
        if (monitor.options.method) {
          options.method = monitor.options.method;
        }
        
        // Corps de la requête
        if (monitor.options.body) {
          options.body = monitor.options.body;
        }
        
        // Ignorer la vérification SSL
        if (monitor.options.ignoreSsl && url.protocol === 'https:') {
          options.rejectUnauthorized = false;
        }
      }
      
      // Effectuer la requête
      const response = await this._request(protocol, options);
      
      // Vérifier le code de statut
      const expectedStatus = monitor.options && monitor.options.expectedStatus 
        ? monitor.options.expectedStatus 
        : [200, 201, 202, 203, 204, 205, 206, 207, 208, 226];
      
      const isValidStatus = Array.isArray(expectedStatus) 
        ? expectedStatus.includes(response.statusCode) 
        : response.statusCode === expectedStatus;
      
      if (!isValidStatus) {
        return {
          status: 'down',
          message: `Code de statut HTTP inattendu: ${response.statusCode}`,
          details: {
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            headers: response.headers
          }
        };
      }
      
      // Vérifier la présence d'un mot-clé si configuré
      if (monitor.options && monitor.options.keyword && response.body) {
        if (!response.body.includes(monitor.options.keyword)) {
          return {
            status: 'down',
            message: `Mot-clé "${monitor.options.keyword}" non trouvé dans la réponse`,
            details: {
              statusCode: response.statusCode,
              statusMessage: response.statusMessage,
              bodyPreview: response.body.substring(0, 200) + '...'
            }
          };
        }
      }
      
      // Tout est bon
      return {
        status: 'up',
        message: `Service en ligne (${response.statusCode} ${response.statusMessage})`,
        details: {
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          headers: response.headers,
          bodyLength: response.body ? response.body.length : 0
        }
      };
    } catch (error) {
      // Gérer les erreurs
      let message = error.message;
      let details = { error: error.message };
      
      if (error.code === 'ECONNREFUSED') {
        message = 'Connexion refusée';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        message = 'Timeout de connexion';
      } else if (error.code === 'ENOTFOUND') {
        message = 'Nom d\'hôte introuvable';
      } else if (error.code === 'CERT_HAS_EXPIRED') {
        message = 'Certificat SSL expiré';
      }
      
      return {
        status: 'down',
        message: message,
        details: details
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
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }
}

export default new HttpMonitor();