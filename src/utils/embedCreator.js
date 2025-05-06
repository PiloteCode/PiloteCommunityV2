import { EmbedBuilder } from 'discord.js';

// Define color constants
const COLORS = {
  PRIMARY: '#3498db',   // Blue
  SUCCESS: '#2ecc71',   // Green
  ERROR: '#e74c3c',     // Red
  WARNING: '#f39c12',   // Orange
  INFO: '#9b59b6',      // Purple
  ECONOMY: '#f1c40f',   // Gold
  PROFILE: '#1abc9c',   // Teal
  EVENT: '#e91e63'      // Pink
};

export class EmbedCreator {
  /**
   * Create a standard embed with the bot's branding
   * @param {Object} options - Embed options
   * @param {string} options.title - Embed title
   * @param {string} options.description - Embed description
   * @param {string} options.color - Embed color (from COLORS or hex)
   * @param {Array} options.fields - Embed fields array
   * @param {string} options.thumbnail - Thumbnail URL
   * @param {string} options.image - Image URL
   * @param {Object} options.footer - Footer object with text and icon_url
   * @param {Object} options.author - Author object with name, icon_url and url
   * @param {boolean} options.timestamp - Whether to add current timestamp
   * @returns {EmbedBuilder} The created embed
   */
  static create({
    title = null,
    description = null,
    color = COLORS.PRIMARY,
    fields = [],
    thumbnail = null,
    image = null,
    footer = null,
    author = null,
    timestamp = true
  }) {
    const embed = new EmbedBuilder();
    
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    
    // Set color (use from constants or raw value)
    embed.setColor(COLORS[color] || color);
    
    // Add fields if provided
    if (fields && fields.length > 0) {
      embed.addFields(fields);
    }
    
    // Set thumbnail if provided
    if (thumbnail) embed.setThumbnail(thumbnail);
    
    // Set image if provided
    if (image) embed.setImage(image);
    
    // Set footer if provided
    if (footer) {
      embed.setFooter(footer);
    } else {
      embed.setFooter({ 
        text: 'PiloteCommunity Bot',
        iconURL: 'https://i.imgur.com/AfFp7pu.png' // Default icon, replace with your bot's icon
      });
    }
    
    // Set author if provided
    if (author) embed.setAuthor(author);
    
    // Add timestamp if requested
    if (timestamp) embed.setTimestamp();
    
    return embed;
  }
  
  /**
   * Create a success embed
   * @param {string} title - Embed title
   * @param {string} description - Embed description
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static success(title, description, options = {}) {
    return this.create({
      title: `✅ ${title}`,
      description,
      color: COLORS.SUCCESS,
      ...options
    });
  }
  
  /**
   * Create an error embed
   * @param {string} title - Embed title
   * @param {string} description - Embed description
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static error(title, description, options = {}) {
    return this.create({
      title: `❌ ${title}`,
      description,
      color: COLORS.ERROR,
      ...options
    });
  }
  
  /**
   * Create a warning embed
   * @param {string} title - Embed title
   * @param {string} description - Embed description
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static warning(title, description, options = {}) {
    return this.create({
      title: `⚠️ ${title}`,
      description,
      color: COLORS.WARNING,
      ...options
    });
  }
  
  /**
   * Create an info embed
   * @param {string} title - Embed title
   * @param {string} description - Embed description
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static info(title, description, options = {}) {
    return this.create({
      title: `ℹ️ ${title}`,
      description,
      color: COLORS.INFO,
      ...options
    });
  }
  
  /**
   * Create an economy embed
   * @param {string} title - Embed title
   * @param {string} description - Embed description
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static economy(title, description, options = {}) {
    return this.create({
      title: `💰 ${title}`,
      description,
      color: COLORS.ECONOMY,
      ...options
    });
  }
  
  /**
   * Create a profile embed
   * @param {Object} user - User object with id, balance, experience, level
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static profile(user, options = {}) {
    const { user_id, balance, experience, level } = user;
    
    // Calculate next level XP requirement
    const nextLevelExp = 100 * (level * level);
    const progressPercent = Math.min(100, Math.floor((experience / nextLevelExp) * 100));
    
    // Create progress bar
    const progressBar = this.createProgressBar(progressPercent);
    
    return this.create({
      title: `Profil`,
      description: `<@${user_id}>`,
      color: COLORS.PROFILE,
      fields: [
        { name: '💰 Solde', value: `${balance} crédits`, inline: true },
        { name: '📊 Niveau', value: `${level}`, inline: true },
        { name: '⭐ Expérience', value: `${experience} / ${nextLevelExp} XP`, inline: true },
        { name: '📈 Progression', value: progressBar, inline: false }
      ],
      ...options
    });
  }
  
  /**
   * Create a shop embed
   * @param {Array} items - Array of shop items
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static shop(items, options = {}) {
    // Group items by category
    const categories = {};
    
    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      
      categories[item.category].push(item);
    });
    
    // Create fields for each category
    const fields = [];
    
    for (const [category, categoryItems] of Object.entries(categories)) {
      // Create category title with emoji
      let emoji;
      switch (category.toLowerCase()) {
        case 'tools':
          emoji = '🔧';
          break;
        case 'consumable':
          emoji = '🧪';
          break;
        case 'special':
          emoji = '✨';
          break;
        case 'cosmetic':
          emoji = '🎭';
          break;
        case 'upgrade':
          emoji = '⬆️';
          break;
        default:
          emoji = '📦';
      }
      
      fields.push({
        name: `${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        value: '\u200B', // Zero-width space
        inline: false
      });
      
      // Add items from this category
      categoryItems.forEach(item => {
        fields.push({
          name: `${item.name} - ${item.price} crédits`,
          value: `ID: \`${item.item_id}\`\n${item.description}`,
          inline: true
        });
      });
      
      // Add empty field for better layout if odd number of items
      if (categoryItems.length % 2 !== 0) {
        fields.push({
          name: '\u200B',
          value: '\u200B',
          inline: true
        });
      }
    }
    
    return this.create({
      title: '🛒 Boutique',
      description: 'Achetez des objets avec la commande `/buy`',
      color: COLORS.ECONOMY,
      fields,
      ...options
    });
  }
  
  /**
   * Create an inventory embed
   * @param {Array} items - Array of inventory items
   * @param {Object} options - Additional embed options
   * @returns {EmbedBuilder} The created embed
   */
  static inventory(items, options = {}) {
    let description = 'Voici les objets que vous possédez:';
    
    if (items.length === 0) {
      description = 'Votre inventaire est vide. Achetez des objets avec la commande `/shop`.';
    }
    
    // Group items by category
    const categories = {};
    
    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      
      categories[item.category].push(item);
    });
    
    // Create fields for each category
    const fields = [];
    
    for (const [category, categoryItems] of Object.entries(categories)) {
      // Create category title with emoji
      let emoji;
      switch (category.toLowerCase()) {
        case 'tools':
          emoji = '🔧';
          break;
        case 'consumable':
          emoji = '🧪';
          break;
        case 'special':
          emoji = '✨';
          break;
        case 'cosmetic':
          emoji = '🎭';
          break;
        case 'upgrade':
          emoji = '⬆️';
          break;
        default:
          emoji = '📦';
      }
      
      fields.push({
        name: `${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        value: '\u200B', // Zero-width space
        inline: false
      });
      
      // Add items from this category
      categoryItems.forEach(item => {
        fields.push({
          name: `${item.name} ${item.quantity > 1 ? `(x${item.quantity})` : ''}`,
          value: `${item.description}\n${item.usable ? '✅ Utilisable' : '❌ Non utilisable'}`,
          inline: true
        });
      });
      
      // Add empty field for better layout if odd number of items
      if (categoryItems.length % 2 !== 0) {
        fields.push({
          name: '\u200B',
          value: '\u200B',
          inline: true
        });
      }
    }
    
    return this.create({
      title: '🎒 Inventaire',
      description,
      color: COLORS.PROFILE,
      fields,
      ...options
    });
  }
  
  /**
   * Create a progress bar
   * @param {number} percent - Percentage filled (0-100)
   * @param {number} length - Length of the bar in characters
   * @returns {string} ASCII progress bar
   */
  static createProgressBar(percent, length = 20) {
    const filledLength = Math.round(length * (percent / 100));
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `${filled}${empty} ${percent}%`;
  }
}

// Export the color constants for use elsewhere
export { COLORS };