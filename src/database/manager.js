// src/database/manager.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { SCHEMA } from './schema.js';

class DatabaseManager {
    constructor() {
        this.db = null;
    }

    async getDatabase() {
        if (!this.db) {
            await this.initializeDatabase();
        }
        return this.db;
    }

    async initializeDatabase() {
        try {
            console.log('🔄 Initialisation de la base de données...');
            
            this.db = await open({
                filename: './database.sqlite',
                driver: sqlite3.Database
            });

            for (const [tableName, createTableSQL] of Object.entries(SCHEMA)) {
                console.log(`📝 Création de la table ${tableName}...`);
                await this.db.exec(createTableSQL);
            }

            const shopItems = await this.db.all('SELECT * FROM shop');
            if (shopItems.length === 0) {
                console.log('📝 Initialisation des items de base dans la boutique...');
                await this.db.run(`
                    INSERT INTO shop (item_id, name, description, price, type) VALUES
                    ('fishing_rod', 'Canne à pêche', 'Permet de pêcher des poissons', 1000, 'tool'),
                    ('pickaxe', 'Pioche', 'Permet de miner des minerais', 1500, 'tool'),
                    ('backpack', 'Sac à dos', 'Augmente la capacité de stockage', 2000, 'upgrade');
                `);
            }

            console.log('✅ Base de données initialisée avec succès');
            return this.db;
        } catch (error) {
            console.error('❌ Erreur d\'initialisation de la base de données:', error);
            throw error;
        }
    }

    async getUser(userId) {
        try {
            const db = await this.getDatabase();
            
            let user = await db.get('SELECT * FROM users WHERE user_id = ?', userId);
            
            if (!user) {
                console.log(`📝 Création d'un nouveau profil pour l'utilisateur ${userId}`);
                await db.run(
                    'INSERT INTO users (user_id, balance, bank, experience, level) VALUES (?, 0, 0, 0, 1)',
                    userId
                );
                user = await db.get('SELECT * FROM users WHERE user_id = ?', userId);
            }

            return user;
        } catch (error) {
            console.error('❌ Erreur lors de la récupération de l\'utilisateur:', error);
            throw error;
        }
    }

    async updateUser(userId, data) {
        try {
            const db = await this.getDatabase();

            const entries = Object.entries(data);
            const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
            const values = entries.map(([_, value]) => value);

            await db.run(
                `UPDATE users SET ${setClause} WHERE user_id = ?`,
                ...values, userId
            );

            return await this.getUser(userId);
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour de l\'utilisateur:', error);
            throw error;
        }
    }

    async getInventory(userId) {
        try {
            const db = await this.getDatabase();
            
            const inventory = await db.all(`
                SELECT i.*, s.name, s.description, s.type 
                FROM inventory i
                LEFT JOIN shop s ON i.item_id = s.item_id
                WHERE i.user_id = ?
            `, userId);
            
            return inventory;
        } catch (error) {
            console.error('❌ Erreur lors de la récupération de l\'inventaire:', error);
            throw error;
        }
    }

    async getShopItems() {
        try {
            const db = await this.getDatabase();
            
            const items = await db.all('SELECT * FROM shop');
            return items;
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des items du shop:', error);
            throw error;
        }
    }

    async addAchievement(userId, achievementId) {
        try {
            const db = await this.getDatabase();
            
            await db.run(`
                INSERT INTO achievements (user_id, achievement_id)
                VALUES (?, ?)
            `, userId, achievementId);
            
            return true;
        } catch (error) {
            console.error('❌ Erreur lors de l\'ajout de l\'achievement:', error);
            throw error;
        }
    }

    async addToInventory(userId, itemId, quantity = 1) {
        try {
            const db = await this.getDatabase();
            
            const existingItem = await db.get(
                'SELECT * FROM inventory WHERE user_id = ? AND item_id = ?',
                userId, itemId
            );
            
            if (existingItem) {
                await db.run(
                    'UPDATE inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?',
                    quantity, userId, itemId
                );
            } else {
                await db.run(
                    'INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)',
                    userId, itemId, quantity
                );
            }
            
            return await this.getInventory(userId);
        } catch (error) {
            console.error('❌ Erreur lors de l\'ajout à l\'inventaire:', error);
            throw error;
        }
    }

    async recordTransaction(fromUser, toUser, amount, type) {
        try {
            const db = await this.getDatabase();
            
            await db.run(`
                INSERT INTO transactions (from_user, to_user, amount, type)
                VALUES (?, ?, ?, ?)
            `, fromUser, toUser, amount, type);
            
            return true;
        } catch (error) {
            console.error('❌ Erreur lors de l\'enregistrement de la transaction:', error);
            throw error;
        }
    }

    // Méthodes spécifiques aux cartes
    async executeQuery(query, params = []) {
        const db = await this.getDatabase();
        return await db.all(query, ...params);
    }

    async executeRun(query, params = []) {
        const db = await this.getDatabase();
        return await db.run(query, ...params);
    }
}

// Créer une instance unique
const dbManager = new DatabaseManager();

// Exporter l'instance et les méthodes
export default dbManager;
export const {
    getUser,
    updateUser,
    getInventory,
    getShopItems,
    addAchievement,
    addToInventory,
    recordTransaction,
    executeQuery,
    executeRun
} = dbManager;
