import https from 'https';
import http from 'http';
import { URL } from 'url';

class KeywordMonitor {
  /**
   * Vérifie la présence d'un mot-clé sur une page web
   * @param {Object} monitor - Configuration du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async check(monitor) {
    try {
      // Vérifier que les options nécessaires sont présentes
      if (!monitor.options || !monitor.options.keyword) {
        throw new Error('Mot-clé non spécifié');
      }
      
      // Analyser l'URL cible
      const url = new URL(monitor.target);
      const protocol = url.protocol === 'https:' ? https : http;
      
      // Effectuer la requête
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
      
      // Vérifier le code de statut
      if (response.statusCode !== 200) {
        return {
          status: 'down',
          message: `Code de statut HTTP inattendu: ${response.statusCode}`,
          details: {
            statusCode: response.statusCode,
            statusMessage: response.statusMessage
          }
        };
      }
      
      // Vérifier la présence du mot-clé
      const keyword = monitor.options.keyword;
      const body = response.body || '';
      const found = body.includes(keyword);
      
      if (!found) {
        return {
          status: 'down',
          message: `Mot-clé "${keyword}" non trouvé sur la page`,
          details: {
            keyword,
            url: monitor.target,
            bodyLength: body.length,
            bodySnippet: body.substring(0, 200) + '...'
          }
        };
      }
      
      // Vérifier l'absence d'un mot-clé si configuré
      if (monitor.options.negativeKeyword && body.includes(monitor.options.negativeKeyword)) {
        return {
          status: 'down',
          message: `Mot-clé négatif "${monitor.options.negativeKeyword}" trouvé sur la page`,
          details: {
            negativeKeyword: monitor.options.negativeKeyword,
            url: monitor.target,
            bodyLength: body.length
          }
        };
      }
      
      // Tout est bon
      return {
        status: 'up',
        message: `Mot-clé "${keyword}" trouvé sur la page`,
        details: {
          keyword,
          url: monitor.target,
          bodyLength: body.length
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

export default new KeywordMonitor();