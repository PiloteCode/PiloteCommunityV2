// src/config/constants.js

// Configuration des cooldowns et limites
export const COOLDOWNS = {
    WORK: 3600000, // 1 heure
    DAILY: 86400000, // 24 heures
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
      INVALID_QUANTITY: '❌ Quantité invalide'
    }
  };
  
  // Configuration des embeds Discord
  export const EMBED_COLORS = {
    DEFAULT: '#0099ff',
    SUCCESS: '#00ff00',
    ERROR: '#ff0000',
    WARNING: '#ffff00',
    INFO: '#00ffff',
    RARE: '#3498db',
    EPIC: '#9b59b6',
    LEGENDARY: '#f1c40f',
    MYTHIC: '#e74c3c',
    DIVINE: '#fd79a8'
  };
  
  // Configuration du système de pagination
  export const PAGINATION = {
    ITEMS_PER_PAGE: {
      COLLECTION: 10,
      MARKETPLACE: 6,
      TRADES: 5,
      INVENTORY: 8
    },
    TIMEOUT: 300000, // 5 minutes
    BUTTON_STYLE: 'PRIMARY'
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