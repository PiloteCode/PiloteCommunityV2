import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || './data/database.sqlite';
  }
  
  async initialize() {
    try {
      // Ensure data directory exists
      await mkdir(dirname(this.dbPath), { recursive: true });
      
      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });
      
      // Enable foreign keys and WAL mode for better performance and data integrity
      await this.db.exec('PRAGMA foreign_keys = ON');
      await this.db.exec('PRAGMA journal_mode = WAL');
      
      // Create tables if they don't exist
      await this.createTables();
      
      console.log('Database initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
  
  async createTables() {
    // Users table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0,
        experience INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        last_daily TEXT,
        last_weekly TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Inventory table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, item_id)
      )
    `);
    
    // Shop items table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS shop_items (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        category TEXT NOT NULL,
        usable BOOLEAN NOT NULL DEFAULT 0,
        image_url TEXT,
        available BOOLEAN NOT NULL DEFAULT 1
      )
    `);
    
    // Cooldowns table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS cooldowns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        command TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        UNIQUE(user_id, command)
      )
    `);
    
    // Transactions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
    
    // Events table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        data TEXT
      )
    `);
    
    // Initialize default shop items
    await this.initializeShopItems();
  }
  
  async initializeShopItems() {
    // Check if shop is already populated
    const itemCount = await this.db.get('SELECT COUNT(*) as count FROM shop_items');
    
    if (itemCount.count === 0) {
      // Define default shop items
      const defaultItems = [
        {
          item_id: 'fishing_rod',
          name: 'Canne à pêche',
          description: 'Augmente vos chances de gagner avec la commande /work',
          price: 1000,
          category: 'tools',
          usable: 0,
          image_url: 'https://example.com/fishing_rod.png',
          available: 1
        },
        {
          item_id: 'luck_potion',
          name: 'Potion de chance',
          description: 'Augmente vos gains pendant 30 minutes',
          price: 500,
          category: 'consumable',
          usable: 1,
          image_url: 'https://example.com/luck_potion.png',
          available: 1
        },
        {
          item_id: 'mystery_box',
          name: 'Boîte mystère',
          description: 'Contient une surprise aléatoire',
          price: 250,
          category: 'special',
          usable: 1,
          image_url: 'https://example.com/mystery_box.png',
          available: 1
        },
        {
          item_id: 'vip_badge',
          name: 'Badge VIP',
          description: 'Affiche un badge VIP sur votre profil',
          price: 5000,
          category: 'cosmetic',
          usable: 0,
          image_url: 'https://example.com/vip_badge.png',
          available: 1
        },
        {
          item_id: 'bank_upgrade',
          name: 'Amélioration de banque',
          description: 'Augmente votre capacité de stockage bancaire',
          price: 2500,
          category: 'upgrade',
          usable: 0,
          image_url: 'https://example.com/bank_upgrade.png',
          available: 1
        }
      ];
      
      // Insert default items
      const stmt = await this.db.prepare(`
        INSERT INTO shop_items 
        (item_id, name, description, price, category, usable, image_url, available)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of defaultItems) {
        await stmt.run(
          item.item_id,
          item.name,
          item.description,
          item.price,
          item.category,
          item.usable,
          item.image_url,
          item.available
        );
      }
      
      await stmt.finalize();
      console.log('Default shop items initialized');
    }
  }
  
  // User methods
  async getUser(userId) {
    const user = await this.db.get('SELECT * FROM users WHERE user_id = ?', userId);
    
    if (!user) {
      // Create new user if not exists
      await this.db.run(`
        INSERT INTO users (user_id, balance, experience, level)
        VALUES (?, 0, 0, 1)
      `, userId);
      
      return this.getUser(userId);
    }
    
    return user;
  }
  
  async updateUserBalance(userId, amount) {
    // Start a transaction for data integrity
    await this.db.exec('BEGIN TRANSACTION');
    
    try {
      // Ensure user exists
      await this.getUser(userId);
      
      // Update balance
      await this.db.run(`
        UPDATE users
        SET balance = balance + ?,
            updated_at = datetime('now')
        WHERE user_id = ?
      `, amount, userId);
      
      // Log transaction
      await this.db.run(`
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (?, ?, ?, ?)
      `, userId, amount, amount >= 0 ? 'credit' : 'debit', 
         amount >= 0 ? 'Added funds' : 'Removed funds');
      
      await this.db.exec('COMMIT');
      return true;
    } catch (error) {
      await this.db.exec('ROLLBACK');
      console.error('Error updating user balance:', error);
      throw error;
    }
  }
  
  async addExperience(userId, amount) {
    // Start a transaction
    await this.db.exec('BEGIN TRANSACTION');
    
    try {
      // Get current user data
      const user = await this.getUser(userId);
      
      // Calculate new experience
      const newExperience = user.experience + amount;
      
      // Calculate if level up is needed
      // Level formula: level = 1 + floor(sqrt(experience / 100))
      const newLevel = 1 + Math.floor(Math.sqrt(newExperience / 100));
      const leveledUp = newLevel > user.level;
      
      // Update user
      await this.db.run(`
        UPDATE users
        SET experience = ?,
            level = ?,
            updated_at = datetime('now')
        WHERE user_id = ?
      `, newExperience, newLevel, userId);
      
      await this.db.exec('COMMIT');
      
      return {
        newExperience,
        newLevel,
        leveledUp,
        oldLevel: user.level
      };
    } catch (error) {
      await this.db.exec('ROLLBACK');
      console.error('Error adding experience:', error);
      throw error;
    }
  }
  
  // Cooldown methods
  async setCooldown(userId, command, durationInMs) {
    const expiresAt = new Date(Date.now() + durationInMs).toISOString();
    
    try {
      await this.db.run(`
        INSERT INTO cooldowns (user_id, command, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, command) DO UPDATE SET
        expires_at = excluded.expires_at
      `, userId, command, expiresAt);
      
      return true;
    } catch (error) {
      console.error('Error setting cooldown:', error);
      throw error;
    }
  }
  
  async getCooldown(userId, command) {
    try {
      const cooldown = await this.db.get(`
        SELECT expires_at FROM cooldowns
        WHERE user_id = ? AND command = ? AND expires_at > datetime('now')
      `, userId, command);
      
      return cooldown ? cooldown.expires_at : null;
    } catch (error) {
      console.error('Error getting cooldown:', error);
      throw error;
    }
  }
  
  async clearExpiredCooldowns() {
    try {
      await this.db.run(`
        DELETE FROM cooldowns
        WHERE expires_at <= datetime('now')
      `);
      
      return true;
    } catch (error) {
      console.error('Error clearing expired cooldowns:', error);
      throw error;
    }
  }
  
  // Inventory methods
  async addItemToInventory(userId, itemId, quantity = 1) {
    try {
      await this.db.run(`
        INSERT INTO inventory (user_id, item_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, item_id) DO UPDATE SET
        quantity = quantity + excluded.quantity
      `, userId, itemId, quantity);
      
      return true;
    } catch (error) {
      console.error('Error adding item to inventory:', error);
      throw error;
    }
  }
  
  async getInventory(userId) {
    try {
      return await this.db.all(`
        SELECT i.*, s.name, s.description, s.category, s.usable, s.image_url
        FROM inventory i
        JOIN shop_items s ON i.item_id = s.item_id
        WHERE i.user_id = ?
        ORDER BY s.category, s.name
      `, userId);
    } catch (error) {
      console.error('Error getting inventory:', error);
      throw error;
    }
  }
  
  // Shop methods
  async getShopItems(category = null) {
    try {
      let query = `
        SELECT * FROM shop_items
        WHERE available = 1
      `;
      
      if (category) {
        query += ` AND category = ?`;
        return await this.db.all(query, category);
      }
      
      query += ` ORDER BY category, price`;
      return await this.db.all(query);
    } catch (error) {
      console.error('Error getting shop items:', error);
      throw error;
    }
  }
  
  async getShopItem(itemId) {
    try {
      return await this.db.get(`
        SELECT * FROM shop_items
        WHERE item_id = ?
      `, itemId);
    } catch (error) {
      console.error('Error getting shop item:', error);
      throw error;
    }
  }
  
  // Event methods
  async createEvent(eventType, channelId, expiresInMs, data = {}) {
    const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
    
    try {
      const result = await this.db.run(`
        INSERT INTO events (event_type, channel_id, status, expires_at, data)
        VALUES (?, ?, 'active', ?, ?)
      `, eventType, channelId, expiresAt, JSON.stringify(data));
      
      return result.lastID;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }
  
  async updateEventMessage(eventId, messageId) {
    try {
      await this.db.run(`
        UPDATE events
        SET message_id = ?
        WHERE id = ?
      `, messageId, eventId);
      
      return true;
    } catch (error) {
      console.error('Error updating event message:', error);
      throw error;
    }
  }
  
  async completeEvent(eventId) {
    try {
      await this.db.run(`
        UPDATE events
        SET status = 'completed'
        WHERE id = ?
      `, eventId);
      
      return true;
    } catch (error) {
      console.error('Error completing event:', error);
      throw error;
    }
  }
  
  async getActiveEvents() {
    try {
      const events = await this.db.all(`
        SELECT * FROM events
        WHERE status = 'active' AND expires_at > datetime('now')
      `);
      
      // Parse data field
      return events.map(event => ({
        ...event,
        data: JSON.parse(event.data || '{}')
      }));
    } catch (error) {
      console.error('Error getting active events:', error);
      throw error;
    }
  }
  
  // Get user rankings
  async getRichestUsers(limit = 10) {
    try {
      return await this.db.all(`
        SELECT user_id, balance, level, experience
        FROM users
        ORDER BY balance DESC
        LIMIT ?
      `, limit);
    } catch (error) {
      console.error('Error getting richest users:', error);
      throw error;
    }
  }
  
  async getHighestLevelUsers(limit = 10) {
    try {
      return await this.db.all(`
        SELECT user_id, level, experience, balance
        FROM users
        ORDER BY level DESC, experience DESC
        LIMIT ?
      `, limit);
    } catch (error) {
      console.error('Error getting highest level users:', error);
      throw error;
    }
  }
  
  // Gracefully close the database connection
  async close() {
    if (this.db) {
      await this.db.close();
      console.log('Database connection closed');
    }
  }
}