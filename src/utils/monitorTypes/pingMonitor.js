// src/utils/monitorTypes/pingMonitor.js
import { exec } from 'child_process';
import os from 'os';

class PingMonitor {
  /**
   * Vérifie un hôte par ping
   * @param {Object} monitor - Configuration du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async check(monitor) {
    try {
      // Vérifier que la cible est valide
      if (!monitor.target) {
        throw new Error('Cible non spécifiée');
      }
      
      // Nettoyer l'adresse IP ou le nom d'hôte (éviter les injections de commande)
      const target = monitor.target.trim().replace(/[;|&`'"]/, '');
      if (!target.match(/^[a-zA-Z0-9.\-_]+$/)) {
        throw new Error('Cible invalide. Utilisez uniquement des lettres, chiffres, points, tirets ou underscores.');
      }
      
      // Déterminer la commande ping en fonction du système d'exploitation
      const platform = os.platform();
      let cmd = '';
      
      if (platform === 'win32') {
        // Windows
        cmd = `ping -n 4 -w ${monitor.timeout || 10000} ${target}`;
      } else {
        // Linux, macOS, etc.
        cmd = `ping -c 4 -W ${Math.floor((monitor.timeout || 10000) / 1000)} ${target}`;
      }
      
      // Exécuter la commande ping
      const result = await this._executeCommand(cmd);
      
      // Analyser le résultat
      let isSuccess = false;
      let avgResponse = null;
      let packetLoss = null;
      
      if (platform === 'win32') {
        // Analyse pour Windows
        isSuccess = result.stdout.includes('(0% loss)') || result.stdout.includes('(0% perte)');
        
        const avgMatch = result.stdout.match(/Moyenne\s=\s(\d+)ms|Average\s=\s(\d+)ms/);
        if (avgMatch) {
          avgResponse = parseInt(avgMatch[1] || avgMatch[2]);
        }
        
        const lossMatch = result.stdout.match(/(\d+)% perte|(\d+)% loss/);
        if (lossMatch) {
          packetLoss = parseInt(lossMatch[1] || lossMatch[2]);
        }
      } else {
        // Analyse pour Linux/macOS
        isSuccess = result.stdout.includes('0% packet loss');
        
        const avgMatch = result.stdout.match(/rtt min\/avg\/max\/mdev = [^\/]+\/([^\/]+)\/[^\/]+\/[^\/]+/);
        if (avgMatch) {
          avgResponse = parseFloat(avgMatch[1]);
        }
        
        const lossMatch = result.stdout.match(/(\d+)% packet loss/);
        if (lossMatch) {
          packetLoss = parseInt(lossMatch[1]);
        }
      }
      
      // Vérifier si le ping a réussi
      if (!isSuccess) {
        return {
          status: 'down',
          message: `Ping échoué${packetLoss !== null ? ` (${packetLoss}% de perte)` : ''}`,
          details: {
            target,
            stdout: result.stdout,
            stderr: result.stderr,
            packetLoss
          }
        };
      }
      
      // Tout est bon
      return {
        status: 'up',
        message: `Ping réussi${avgResponse !== null ? ` (${avgResponse}ms)` : ''}`,
        details: {
          target,
          avgResponse,
          packetLoss,
          stdout: result.stdout
        }
      };
    } catch (error) {
      // Gérer les erreurs
      return {
        status: 'down',
        message: error.message,
        details: { error: error.message }
      };
    }
  }
  
  /**
   * Exécute une commande shell
   * @param {string} cmd - Commande à exécuter
   * @returns {Promise<Object>} Résultat de la commande
   */
  _executeCommand(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
        resolve({
          error,
          stdout,
          stderr
        });
      });
    });
  }
}

export default new PingMonitor();