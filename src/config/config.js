/**
 * Configuration file for the PILOTE Discord bot
 */

export default {
  // Bot information
  botName: "PILOTE",
  version: "2.0.0",
  
  // Bot preferences
  defaultPrefix: "!",
  defaultLanguage: "fr",
  
  // Cooldowns (in seconds)
  cooldowns: {
    global: 3,
    economy: 5,
    games: 10,
    admin: 2
  },
  
  // Economy settings
  economy: {
    startingBalance: 500,
    dailyAmount: 250,
    dailyCooldown: 24 * 60 * 60 * 1000, // 24 hours
    weeklyAmount: 1000,
    weeklyCooldown: 7 * 24 * 60 * 60 * 1000, // 7 days
    workAmount: {
      min: 50,
      max: 150
    },
    workCooldown: 1 * 60 * 60 * 1000, // 1 hour
    shopRefreshInterval: 24 * 60 * 60 * 1000, // 24 hours
    bankInterestRate: 0.01, // 1% per day
    robberySuccessRate: 0.4, // 40% success rate
    robberyPenalty: 150  // Credits lost on failed robbery
  },
  
  // Shop items
  shop: {
    categories: [
      "Roles",
      "Utilitaires",
      "Cosmetiques"
    ],
    defaultItems: [
      {
        id: "role_vip",
        name: "Rôle VIP",
        description: "Un rôle exclusif avec une couleur distinctive",
        price: 5000,
        category: "Roles",
        type: "role",
        data: {
          duration: null // Permanent
        }
      },
      {
        id: "role_coloré",
        name: "Rôle Coloré",
        description: "Un rôle avec une couleur personnalisée pour 7 jours",
        price: 1000,
        category: "Roles",
        type: "role",
        data: {
          duration: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
      },
      {
        id: "name_custom",
        name: "Pseudo Personnalisé",
        description: "Changez votre pseudo sur le serveur pendant 3 jours",
        price: 800,
        category: "Cosmetiques",
        type: "nickname",
        data: {
          duration: 3 * 24 * 60 * 60 * 1000 // 3 days
        }
      },
      {
        id: "xp_boost",
        name: "Boost d'XP",
        description: "Gagnez 2x plus d'XP pendant 24 heures",
        price: 500,
        category: "Utilitaires",
        type: "boost",
        data: {
          duration: 24 * 60 * 60 * 1000, // 24 hours
          multiplier: 2
        }
      }
    ]
  },
  
  // Random events settings
  events: {
    interval: {
      min: 30 * 60 * 1000, // 30 minutes
      max: 120 * 60 * 1000 // 2 hours
    },
    chance: 0.7, // 70% chance to trigger an event when interval triggers
    duration: 5 * 60 * 1000, // 5 minutes
    rewards: {
      min: 100,
      max: 1000
    }
  },
  
  // Logging
  logging: {
    level: "INFO", // DEBUG, INFO, WARN, ERROR, FATAL
    colors: true,
    fileLogging: true
  },
  
  // Discord status rotation
  statusRotation: {
    interval: 2 * 60 * 1000, // 2 minutes
    statuses: [
      { text: "discord.gg/PILOTE", type: "WATCHING" },
      { text: "avec l'économie", type: "PLAYING" },
      { text: "vos commandes", type: "LISTENING" },
      { text: "/help pour de l'aide", type: "PLAYING" },
      { text: "la communauté grandir", type: "WATCHING" }
    ]
  },
  
  // API Keys
  apiKeys: {
    openWeather: process.env.WEATHER_API_KEY || ""
  },
  
  // Database settings
  database: {
    filename: "./data/pilote.db",
    backupInterval: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // Bot token (from environment variable)
  botToken: process.env.DISCORD_TOKEN || null
};