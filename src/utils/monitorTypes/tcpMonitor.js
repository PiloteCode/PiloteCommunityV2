import net from 'net';

class TcpMonitor {
  /**
   * Vérifie un service TCP
   * @param {Object} monitor - Configuration du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async check(monitor) {
    try {
      // Analyser la cible (format: host:port)
      const [host, portStr] = monitor.target.split(':');
      const port = parseInt(portStr);
      
      if (!host || isNaN(port)) {
        throw new Error('Format de cible invalide. Utilisez "host:port"');
      }
      
      // Tester la connexion TCP
      const result = await this._testConnection(host, port, monitor.timeout || 10000);
      
      return {
        status: 'up',
        message: `Connexion TCP réussie à ${host}:${port}`,
        details: {
          host,
          port,
          connectionTime: result.time
        }
      };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
        details: { error: error.message }
      };
    }
  }
  
  /**
   * Teste une connexion TCP
   * @param {string} host - Hôte à tester
   * @param {number} port - Port à tester
   * @param {number} timeout - Timeout en millisecondes
   * @returns {Promise<Object>} Résultat du test
   */
  _testConnection(host, port, timeout) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        const endTime = Date.now();
        socket.destroy();
        resolve({ connected: true, time: endTime - startTime });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Timeout lors de la connexion à ${host}:${port}`));
      });
      
      socket.on('error', (error) => {
        socket.destroy();
        reject(new Error(`Erreur de connexion à ${host}:${port}: ${error.message}`));
      });
      
      socket.connect(port, host);
    });
  }
}

export default new TcpMonitor();
