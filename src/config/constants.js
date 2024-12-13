// src/config/constants.js

// Configuration des cooldowns et limites
export const COOLDOWNS = {
    WORK: 3600000, // 1 heure
    DAILY: 86400000, // 24 heures
    TRADE_CREATION: 300000, // 5 minutes
    MARKETPLACE_LISTING: 60000, // 1 minute
    PACK_OPENING: 10000, // 10 secondes
    FUSION: 30000 // 30 secondes
  };
  
  // Configuration des limites système
  export const LIMITS = {
    MAX_CARDS_PER_TRADE: 10,
    MAX_ACTIVE_TRADES: 5,
    MAX_MARKETPLACE_LISTINGS: 25,
    MAX_FAVORITE_CARDS: 50,
    MAX_PACKS_PURCHASE: 10,
    MIN_LISTING_PRICE: 100,
    MAX_LISTING_PRICE: 1000000
  };
  
  // Configuration des pourcentages et taxes
  export const RATES = {
    MARKETPLACE_FEE: 0.05, // 5% de taxe sur les ventes
    FUSION_SUCCESS_RATE: 0.95, // 95% de chance de succès
    SPECIAL_EVENT_CHANCE: 0.10, // 10% de chance d'événement spécial
    ANIMATED_CARD_CHANCE: 0.05 // 5% de chance d'obtenir une carte animée
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
    },
    COLLECTION_COMPLETION: {
      COMMON: 1000,
      RARE: 5000,
      EPIC: 15000,
      LEGENDARY: 50000
    }
  };
  
  // Configuration des niveaux et progression
  export const PROGRESSION = {
    XP_PER_LEVEL: 1000,
    MAX_LEVEL: 100,
    LEVEL_REWARDS: {
      5: { type: 'pack', value: 'basic', quantity: 1 },
      10: { type: 'pack', value: 'premium', quantity: 1 },
      25: { type: 'pack', value: 'ultimate', quantity: 1 },
      50: { type: 'special_card', value: 'LIMITED' },
      100: { type: 'special_card', value: 'DIVINE' }
    }
  };
  
  // Configuration des événements spéciaux
  export const SPECIAL_EVENTS = {
    DOUBLE_XP: {
      duration: 3600000, // 1 heure
      multiplier: 2
    },
    LUCKY_HOUR: {
      duration: 3600000,
      drop_rate_boost: 1.5
    },
    FUSION_FEST: {
      duration: 7200000, // 2 heures
      cost_reduction: 0.5
    },
    MARKET_MADNESS: {
      duration: 3600000,
      fee_reduction: 0.5
    }
  };
  
  // Messages système et emojis
  export const SYSTEM_MESSAGES = {
    ERRORS: {
      INSUFFICIENT_FUNDS: '❌ Fonds insuffisants',
      COOLDOWN_ACTIVE: '⏰ Veuillez patienter',
      INVALID_QUANTITY: '❌ Quantité invalide',
      CARD_NOT_FOUND: '❌ Carte introuvable',
      TRADE_ERROR: '❌ Erreur lors de l\'échange',
      FUSION_ERROR: '❌ Erreur lors de la fusion',
      LISTING_ERROR: '❌ Erreur lors de la mise en vente'
    },
    SUCCESS: {
      PACK_OPENED: '📦 Pack ouvert avec succès',
      TRADE_COMPLETED: '🤝 Échange effectué',
      CARD_SOLD: '💰 Carte vendue',
      FUSION_COMPLETED: '✨ Fusion réussie',
      REWARD_CLAIMED: '🎁 Récompense récupérée'
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
    SUPPORT_SERVER: 'https://discord.gg/support',
    MAX_CACHE_SIZE: 1000,
    DEBUG_MODE: false
  };