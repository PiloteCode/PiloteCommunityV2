import dns from 'dns';
import { promisify } from 'util';

// Promisifier les fonctions DNS
const lookup = promisify(dns.lookup);
const resolve = promisify(dns.resolve);
const reverse = promisify(dns.reverse);

class DnsMonitor {
  /**
   * Vérifie la résolution DNS
   * @param {Object} monitor - Configuration du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async check(monitor) {
    try {
      // Analyser les options
      const options = monitor.options || {};
      const recordType = options.recordType || 'A';
      
      // Déterminer le type de vérification
      let result;
      
      if (recordType === 'PTR') {
        // Résolution inverse
        result = await reverse(monitor.target);
      } else if (recordType === 'ANY') {
        // Résolution générique
        result = await lookup(monitor.target);
      } else {
        // Résolution d'un type spécifique
        result = await resolve(monitor.target, recordType);
      }
      
      // Tout est bon
      return {
        status: 'up',
        message: `Résolution DNS réussie pour ${monitor.target} (${recordType})`,
        details: {
          target: monitor.target,
          recordType,
          result
        }
      };
    } catch (error) {
      // Gérer les erreurs
      return {
        status: 'down',
        message: `Échec de résolution DNS: ${error.message}`,
        details: {
          target: monitor.target,
          recordType: monitor.options?.recordType || 'A',
          error: error.message
        }
      };
    }
  }
}

export default new DnsMonitor();
