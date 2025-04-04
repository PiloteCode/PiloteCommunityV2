// src/config/constants.js

// Configuration des cooldowns et limites
export const COOLDOWNS = {
  WORK: 3600000, // 1 heure
  DAILY: 86400000, // 24 heures
  DEFAULT_COMMAND: 3000, // 3 secondes entre les commandes
  MONITOR_CHECK: 60000, // 1 minute entre les vérifications manuelles
};

// Configuration des récompenses
export const REWARDS = {
  DAILY: {
    BASE: 1000,
    STREAK_BONUS: 100, // Par jour de streak
    MAX_STREAK: 7
  },
  WORK: {
    MIN: 500,
    MAX: 2000,
    XP: {
      MIN: 10,
      MAX: 50
    }
  }
};

// Messages système et emojis
export const SYSTEM_MESSAGES = {
  ERRORS: {
    INSUFFICIENT_FUNDS: '❌ Fonds insuffisants',
    COOLDOWN_ACTIVE: '⏰ Veuillez patienter',
    INVALID_QUANTITY: '❌ Quantité invalide',
    GENERIC: '❌ Une erreur est survenue. Veuillez réessayer plus tard.'
  }
};

// Configuration des embeds Discord
export const EMBED_COLORS = {
  DEFAULT: '#0099ff',
  SUCCESS: '#00ff00',
  ERROR: '#ff0000',
  WARNING: '#ffff00',
  INFO: '#00ffff'
};

// Configuration du système de pagination
export const PAGINATION = {
  ITEMS_PER_PAGE: {
    INVENTORY: 8,
    MONITORS: 5,
    LOGS: 10
  },
  TIMEOUT: 300000, // 5 minutes
  BUTTON_STYLE: 'PRIMARY'
};

// Configuration du système de monitoring
export const MONITORING = {
  DEFAULT_INTERVAL: 300, // 5 minutes
  PREMIUM_INTERVAL: 30, // 30 secondes
  DEFAULT_TIMEOUT: 10000, // 10 secondes
  MAX_MONITORS_FREE: 5,
  MAX_MONITORS_PREMIUM: 20,
  LOG_RETENTION_DAYS: 30, // Nombre de jours de conservation des logs
  MONITOR_TYPES: [
    {
      id: 'http',
      name: 'HTTP/HTTPS',
      description: 'Vérifie la disponibilité d\'un site web ou d\'une API',
      examples: ['https://example.com', 'http://api.example.com/status']
    },
    {
      id: 'ping',
      name: 'PING',
      description: 'Vérifie si un serveur répond aux pings ICMP',
      examples: ['example.com', '192.168.1.1']
    },
    {
      id: 'tcp',
      name: 'TCP',
      description: 'Vérifie si un port TCP est ouvert',
      examples: ['example.com:80', '192.168.1.1:22']
    },
    {
      id: 'dns',
      name: 'DNS',
      description: 'Vérifie la résolution DNS d\'un domaine',
      examples: ['example.com', 'subdomain.example.com']
    },
    {
      id: 'ssl',
      name: 'SSL',
      description: 'Vérifie la validité et l\'expiration d\'un certificat SSL',
      examples: ['example.com', 'secure.example.com']
    },
    {
      id: 'keyword',
      name: 'Mot-clé',
      description: 'Vérifie la présence d\'un mot-clé sur une page web',
      examples: ['https://example.com']
    },
    {
      id: 'performance',
      name: 'Performance',
      description: 'Mesure le temps de chargement d\'une page web',
      examples: ['https://example.com']
    }
  ],
  PREMIUM_FEATURES: [
    {
      id: 'more_monitors',
      name: 'Monitors supplémentaires',
      description: 'Augmente la limite de monitors de 5 à 20',
      price: 5000,
      duration: 30 // jours
    },
    {
      id: 'increased_frequency',
      name: 'Fréquence accrue',
      description: 'Permet des vérifications toutes les 30 secondes (au lieu de 5 minutes)',
      price: 7500,
      duration: 30
    },
    {
      id: 'advanced_stats',
      name: 'Statistiques avancées',
      description: 'Accès aux graphiques détaillés et aux rapports personnalisés',
      price: 10000,
      duration: 30
    },
    {
      id: 'webhook_alerts',
      name: 'Alertes Webhook',
      description: 'Envoie des alertes à des webhooks externes',
      price: 5000,
      duration: 30
    },
    {
      id: 'status_page',
      name: 'Page de statut',
      description: 'Crée une page de statut publique pour vos services',
      price: 12500,
      duration: 30
    }
  ]
};

// Constantes diverses
export const MISC = {
  DEFAULT_AVATAR: 'https://exemple.com/default_avatar.png',
  BOT_VERSION: '1.0.0',
  DATABASE_VERSION: '1',
  SUPPORT_SERVER: 'https://discord.gg/pilote',
  MAX_CACHE_SIZE: 1000,
  DEBUG_MODE: false
};