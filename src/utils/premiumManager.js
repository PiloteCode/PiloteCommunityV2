// src/utils/premiumManager.js
import { executeQuery, executeRun, getUser, updateUser } from '../database/manager.js';

class PremiumManager {
  constructor() {
    this.premiumFeatures = new Map();
  }

  /**
   * Initialise le gestionnaire premium
   */
  async initialize() {
    try {
      console.log('🔄 Initialisation du gestionnaire premium...');
      
      // Charger toutes les fonctionnalités premium
      const features = await executeQuery('SELECT * FROM premium_features');
      for (const feature of features) {
        this.premiumFeatures.set(feature.feature_id, feature);
      }
      
      console.log(`✅ Gestionnaire premium initialisé avec ${features.length} fonctionnalités.`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du gestionnaire premium:', error);
    }
  }

  /**
   * Récupère toutes les fonctionnalités premium
   * @returns {Promise<Array>} Liste des fonctionnalités premium
   */
  async getAllFeatures() {
    try {
      const features = await executeQuery('SELECT * FROM premium_features');
      return features;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des fonctionnalités premium:', error);
      throw error;
    }
  }

  /**
   * Récupère une fonctionnalité premium par son ID
   * @param {string} featureId - ID de la fonctionnalité
   * @returns {Promise<Object>} La fonctionnalité premium
   */
  async getFeature(featureId) {
    try {
      const feature = await executeQuery('SELECT * FROM premium_features WHERE feature_id = ?', [featureId]);
      
      if (feature.length === 0) {
        throw new Error('Fonctionnalité premium introuvable.');
      }
      
      return feature[0];
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération de la fonctionnalité premium ${featureId}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur a une fonctionnalité premium
   * @param {string} userId - ID de l'utilisateur
   * @param {string} featureId - ID de la fonctionnalité
   * @returns {Promise<boolean>} Si l'utilisateur a la fonctionnalité
   */
  async hasFeature(userId, featureId) {
    try {
      // Vérifier si l'utilisateur a un statut premium global
      const user = await getUser(userId);
      if (user.is_premium === 1) {
        const now = new Date();
        const expiry = user.premium_expiry ? new Date(user.premium_expiry) : null;
        
        if (!expiry || expiry > now) {
          return true;
        }
        
        // Mettre à jour le statut premium si expiré
        if (expiry && expiry <= now) {
          await updateUser(userId, {
            is_premium: 0,
            premium_expiry: null
          });
        }
      }
      
      // Vérifier si l'utilisateur a cette fonctionnalité spécifique
      const userFeature = await executeQuery(
        'SELECT * FROM user_premium_features WHERE user_id = ? AND feature_id = ?',
        [userId, featureId]
      );
      
      if (userFeature.length === 0) {
        return false;
      }
      
      // Vérifier si la fonctionnalité est expirée
      const now = new Date();
      const expiry = userFeature[0].expires_at ? new Date(userFeature[0].expires_at) : null;
      
      if (!expiry || expiry > now) {
        return true;
      }
      
      // Supprimer la fonctionnalité expirée
      await executeRun(
        'DELETE FROM user_premium_features WHERE user_id = ? AND feature_id = ?',
        [userId, featureId]
      );
      
      return false;
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de la fonctionnalité premium ${featureId} pour l'utilisateur ${userId}:`, error);
      return false;
    }
  }

  /**
   * Récupère les fonctionnalités premium d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} Liste des fonctionnalités premium de l'utilisateur
   */
  async getUserFeatures(userId) {
    try {
      const features = await executeQuery(
        `SELECT f.*, uf.purchased_at, uf.expires_at 
         FROM user_premium_features uf
         JOIN premium_features f ON uf.feature_id = f.feature_id
         WHERE uf.user_id = ?`,
        [userId]
      );
      
      return features;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des fonctionnalités premium de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Ajoute une fonctionnalité premium à un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} featureId - ID de la fonctionnalité
   * @param {number} duration - Durée en jours (si différente de la durée par défaut)
   * @returns {Promise<Object>} Le résultat de l'ajout
   */
  async addFeatureToUser(userId, featureId, duration = null) {
    try {
      // Récupérer la fonctionnalité
      const feature = await this.getFeature(featureId);
      
      // Déterminer la durée
      const featureDuration = duration || feature.duration;
      
      // Calculer la date d'expiration
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + featureDuration);
      
      // Vérifier si l'utilisateur a déjà cette fonctionnalité
      const userFeature = await executeQuery(
        'SELECT * FROM user_premium_features WHERE user_id = ? AND feature_id = ?',
        [userId, featureId]
      );
      
      if (userFeature.length > 0) {
        // Mettre à jour la date d'expiration
        const currentExpiry = userFeature[0].expires_at ? new Date(userFeature[0].expires_at) : null;
        let newExpiry = expiryDate;
        
        if (currentExpiry && currentExpiry > now) {
          // Ajouter la durée à la date d'expiration actuelle
          newExpiry = new Date(currentExpiry);
          newExpiry.setDate(newExpiry.getDate() + featureDuration);
        }
        
        await executeRun(
          'UPDATE user_premium_features SET expires_at = ? WHERE user_id = ? AND feature_id = ?',
          [newExpiry.toISOString(), userId, featureId]
        );
        
        return {
          userId,
          featureId,
          expiresAt: newExpiry,
          renewed: true
        };
      } else {
        // Ajouter la fonctionnalité
        await executeRun(
          'INSERT INTO user_premium_features (user_id, feature_id, purchased_at, expires_at) VALUES (?, ?, ?, ?)',
          [userId, featureId, now.toISOString(), expiryDate.toISOString()]
        );
        
        // Mettre à jour le statut premium de l'utilisateur
        await updateUser(userId, {
          is_premium: 1,
          premium_expiry: expiryDate.toISOString()
        });
        
        return {
          userId,
          featureId,
          expiresAt: expiryDate,
          renewed: false
        };
      }
    } catch (error) {
      console.error(`❌ Erreur lors de l'ajout de la fonctionnalité premium ${featureId} à l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Supprime une fonctionnalité premium d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} featureId - ID de la fonctionnalité
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async removeFeatureFromUser(userId, featureId) {
    try {
      await executeRun(
        'DELETE FROM user_premium_features WHERE user_id = ? AND feature_id = ?',
        [userId, featureId]
      );
      
      // Vérifier s'il reste des fonctionnalités premium à l'utilisateur
      const remainingFeatures = await this.getUserFeatures(userId);
      
      if (remainingFeatures.length === 0) {
        // Mettre à jour le statut premium de l'utilisateur
        await updateUser(userId, {
          is_premium: 0,
          premium_expiry: null
        });
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression de la fonctionnalité premium ${featureId} de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Achète une fonctionnalité premium pour un utilisateur avec sa monnaie virtuelle
   * @param {string} userId - ID de l'utilisateur
   * @param {string} featureId - ID de la fonctionnalité
   * @returns {Promise<Object>} Le résultat de l'achat
   */
  async purchaseFeature(userId, featureId) {
    try {
      // Récupérer l'utilisateur et la fonctionnalité
      const user = await getUser(userId);
      const feature = await this.getFeature(featureId);
      
      // Vérifier si l'utilisateur a assez d'argent
      if (user.balance < feature.price) {
        throw new Error(`Fonds insuffisants. Il manque ${feature.price - user.balance} pièces.`);
      }
      
      // Débiter l'utilisateur
      await updateUser(userId, {
        balance: user.balance - feature.price
      });
      
      // Ajouter la fonctionnalité
      const result = await this.addFeatureToUser(userId, featureId);
      
      // Enregistrer la transaction
      await executeRun(
        'INSERT INTO transactions (from_user, to_user, amount, type) VALUES (?, ?, ?, ?)',
        [userId, 'system', feature.price, 'premium_purchase']
      );
      
      return {
        ...result,
        price: feature.price,
        remainingBalance: user.balance - feature.price
      };
    } catch (error) {
      console.error(`❌ Erreur lors de l'achat de la fonctionnalité premium ${featureId} par l'utilisateur ${userId}:`, error);
      throw error;
    }
  }
}

const premiumManager = new PremiumManager();
export default premiumManager;