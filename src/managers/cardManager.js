import { db } from '../database/manager.js';
import { RARITIES } from '../config/cardTypes.js';
import { CardGenerator } from './cardGenerator.js';

export class CardManager {
  // Méthodes de base pour la gestion des cartes
  static async getUserCards(userId, rarityFilter = null, themeFilter = null) {
    let query = `
      SELECT uc.*, c.*
      FROM user_cards uc
      JOIN cards c ON uc.card_id = c.card_id
      WHERE uc.user_id = ?
    `;
    const params = [userId];

    if (rarityFilter) {
      query += ' AND c.rarity = ?';
      params.push(rarityFilter);
    }

    if (themeFilter) {
      query += ' AND c.theme = ?';
      params.push(themeFilter);
    }

    query += ' ORDER BY c.rarity DESC, c.name ASC';

    return await db.all(query, ...params);
  }

  static async addCardsToUser(userId, cardId, quantity = 1) {
    const existing = await db.get(
      'SELECT * FROM user_cards WHERE user_id = ? AND card_id = ?',
      userId, cardId
    );

    if (existing) {
      await db.run(
        'UPDATE user_cards SET quantity = quantity + ? WHERE user_id = ? AND card_id = ?',
        quantity, userId, cardId
      );
    } else {
      await db.run(
        'INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, ?)',
        userId, cardId, quantity
      );
    }

    // Vérifier les achievements après l'ajout
    await this.checkCollectionAchievements(userId);
  }

  static async removeCardsFromUser(userId, cardId, quantity = 1) {
    const card = await this.getUserCard(userId, cardId);
    if (!card) throw new Error('Carte non trouvée');
    if (card.quantity < quantity) throw new Error('Quantité insuffisante');

    if (card.quantity === quantity) {
      await db.run(
        'DELETE FROM user_cards WHERE user_id = ? AND card_id = ?',
        userId, cardId
      );
    } else {
      await db.run(
        'UPDATE user_cards SET quantity = quantity - ? WHERE user_id = ? AND card_id = ?',
        quantity, userId, cardId
      );
    }
  }

  // Méthodes de génération et gestion des cartes
  static async createNewCard(cardData) {
    const cardId = `${cardData.theme.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    await db.run(`
      INSERT INTO cards (
        card_id, name, description, rarity, base_price,
        power_level, collection, theme, is_animated, special_effect
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cardId,
      cardData.name,
      cardData.description,
      cardData.rarity,
      cardData.base_price || this.calculateBasePrice(cardData),
      cardData.power_level,
      cardData.collection,
      cardData.theme,
      cardData.is_animated || false,
      cardData.special_effect || null
    ]);

    return await this.getCardInfo(cardId);
  }

  static calculateBasePrice(cardData) {
    const rarityMultiplier = {
      COMMON: 1,
      UNCOMMON: 2,
      RARE: 4,
      EPIC: 8,
      LEGENDARY: 16,
      MYTHIC: 32,
      DIVINE: 64,
      LIMITED: 48
    };

    return cardData.power_level * rarityMultiplier[cardData.rarity];
  }

  // Méthodes de fusion et d'amélioration
  static async fuseCards(userId, cardIds) {
    if (cardIds.length !== 3) throw new Error('La fusion nécessite exactement 3 cartes');

    const cards = await Promise.all(
      cardIds.map(id => this.getUserCard(userId, id))
    );

    // Vérifier que toutes les cartes existent et sont identiques
    if (!cards.every(card => card && card.card_id === cards[0].card_id)) {
      throw new Error('Les cartes doivent être identiques');
    }

    // Vérifier la quantité
    for (const card of cards) {
      if (card.quantity < 1) throw new Error('Quantité insuffisante');
    }

    // Calculer la nouvelle rareté
    const currentRarity = cards[0].rarity;
    const rarityOrder = Object.keys(RARITIES);
    const currentIndex = rarityOrder.indexOf(currentRarity);
    
    if (currentIndex === rarityOrder.length - 1) {
      throw new Error('Cette carte est déjà à la rareté maximale');
    }

    const newRarity = rarityOrder[currentIndex + 1];

    // Créer la nouvelle carte
    const newCardData = await CardGenerator.generateCard(newRarity);
    const newCard = await this.createNewCard(newCardData);

    // Supprimer les cartes utilisées
    await db.run('BEGIN TRANSACTION');
    try {
      for (const cardId of cardIds) {
        await this.removeCardsFromUser(userId, cardId, 1);
      }
      await this.addCardsToUser(userId, newCard.card_id, 1);
      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

    return newCard;
  }

  // Méthodes de statistiques et d'information
  static async getCardStats(cardId) {
    const stats = await db.get(`
      SELECT 
        COUNT(DISTINCT uc.user_id) as owners,
        SUM(uc.quantity) as total_copies,
        AVG(ml.price) as avg_market_price,
        (
          SELECT price 
          FROM marketplace_listings 
          WHERE card_id = ? 
          AND status = 'sold' 
          ORDER BY sold_at DESC 
          LIMIT 1
        ) as last_sold_price
      FROM cards c
      LEFT JOIN user_cards uc ON c.card_id = uc.card_id
      LEFT JOIN marketplace_listings ml ON c.card_id = ml.card_id
      WHERE c.card_id = ?
      GROUP BY c.card_id
    `, cardId, cardId);

    return {
      owners: stats.owners || 0,
      totalCopies: stats.total_copies || 0,
      averagePrice: Math.round(stats.avg_market_price) || 0,
      lastSoldPrice: stats.last_sold_price || 0
    };
  }

  // Méthodes de collection et d'achievements
  static async checkCollectionAchievements(userId) {
    const collections = await db.all('SELECT * FROM collections');
    const userCards = await this.getUserCards(userId);

    for (const collection of collections) {
      const requiredCards = JSON.parse(collection.required_cards);
      const hasAllCards = requiredCards.every(cardId =>
        userCards.some(uc => uc.card_id === cardId)
      );

      if (hasAllCards) {
        await this.grantCollectionReward(userId, collection);
      }
    }
  }

  static async grantCollectionReward(userId, collection) {
    const existingReward = await db.get(
      'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
      userId, `collection_${collection.collection_id}`
    );

    if (existingReward) return;

    await db.run('BEGIN TRANSACTION');
    try {
      // Enregistrer l'achievement
      await db.run(`
        INSERT INTO user_achievements (user_id, achievement_id)
        VALUES (?, ?)
      `, userId, `collection_${collection.collection_id}`);

      // Accorder la récompense
      const reward = JSON.parse(collection.reward_value);
      if (collection.reward_type === 'coins') {
        await db.run(`
          UPDATE users 
          SET balance = balance + ? 
          WHERE user_id = ?
        `, reward, userId);
      } else if (collection.reward_type === 'card') {
        await this.addCardsToUser(userId, reward.card_id, reward.quantity || 1);
      }

      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }
  static async getUserPacks(userId) {
    return await db.all(`
      SELECT pack_type, quantity 
      FROM user_packs 
      WHERE user_id = ? AND quantity > 0
    `, userId);
  }

  static async openPack(userId, packType) {
    const pack = PACK_TYPES[packType];
    if (!pack) throw new Error('Type de pack invalide');

    await db.run('BEGIN TRANSACTION');

    try {
      // Retirer le pack
      await db.run(`
        UPDATE user_packs 
        SET quantity = quantity - 1 
        WHERE user_id = ? AND pack_type = ? AND quantity > 0
      `, userId, packType);

      // Générer les cartes
      const cards = [];
      for (let i = 0; i < pack.cards; i++) {
        const rarity = this.determineCardRarity(pack.weights);
        const card = await this.generateCard(rarity);
        cards.push(card);
        await this.addCardsToUser(userId, card.card_id, 1);
      }

      await db.run('COMMIT');
      return cards;
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  static determineCardRarity(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (const [rarity, weight] of Object.entries(weights)) {
      if (random < weight) return rarity;
      random -= weight;
    }

    return Object.keys(weights)[0];
  }
}