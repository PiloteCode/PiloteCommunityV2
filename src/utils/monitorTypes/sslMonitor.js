import https from 'https';
import { URL } from 'url';

class SslMonitor {
  /**
   * Vérifie un certificat SSL
   * @param {Object} monitor - Configuration du monitor
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async check(monitor) {
    try {
      // Analyser l'URL cible
      let url = monitor.target;
      
      // Ajouter le protocole si manquant
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        url = 'https://' + url;
      }
      
      const parsedUrl = new URL(url);
      
      // Vérifier que c'est bien HTTPS
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('La cible doit utiliser le protocole HTTPS');
      }
      
      // Récupérer les informations du certificat
      const certInfo = await this._getCertificateInfo(parsedUrl.hostname, parsedUrl.port || 443, monitor.timeout || 10000);
      
      // Vérifier que le certificat n'est pas expiré
      const now = new Date();
      
      if (now > certInfo.validTo) {
        return {
          status: 'down',
          message: `Le certificat SSL est expiré depuis le ${certInfo.validTo.toLocaleDateString()}`,
          details: certInfo
        };
      }
      
      // Vérifier que le certificat n'expire pas bientôt
      const warnDays = monitor.options?.warnDays || 14;
      const warnDate = new Date(now);
      warnDate.setDate(warnDate.getDate() + warnDays);
      
      if (warnDate > certInfo.validTo) {
        return {
          status: 'up',
          message: `Le certificat SSL expire bientôt (${certInfo.validTo.toLocaleDateString()})`,
          details: {
            ...certInfo,
            warning: `Expire dans moins de ${warnDays} jours`
          }
        };
      }
      
      // Tout est bon
      return {
        status: 'up',
        message: `Certificat SSL valide jusqu'au ${certInfo.validTo.toLocaleDateString()}`,
        details: certInfo
      };
    } catch (error) {
      // Gérer les erreurs
      return {
        status: 'down',
        message: `Erreur de vérification SSL: ${error.message}`,
        details: { error: error.message }
      };
    }
  }
  
  /**
   * Récupère les informations du certificat SSL
   * @param {string} host - Hôte à vérifier
   * @param {number} port - Port à vérifier
   * @param {number} timeout - Timeout en millisecondes
   * @returns {Promise<Object>} Informations du certificat
   */
  _getCertificateInfo(host, port, timeout) {
    return new Promise((resolve, reject) => {
      const options = {
        host,
        port,
        method: 'GET',
        path: '/',
        timeout,
        rejectUnauthorized: false, // Permet de vérifier même les certificats auto-signés
        servername: host // Important pour le SNI
      };
      
      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        
        if (Object.keys(cert).length === 0) {
          reject(new Error('Pas de certificat disponible'));
          return;
        }
        
        resolve({
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: new Date(cert.valid_from),
          validTo: new Date(cert.valid_to),
          fingerprint: cert.fingerprint,
          serialNumber: cert.serialNumber,
          subjectAltName: cert.subjectaltname
        });
        
        req.destroy();
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout lors de la connexion'));
      });
      
      req.end();
    });
  }
}

export default new SslMonitor();
