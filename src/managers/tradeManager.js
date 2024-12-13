import { db } from '../database/manager.js';
import { LIMITS, SYSTEM_MESSAGES } from '../config/constants.js';
import { CardManager } from './cardManager.js';

export class TradeManager {
  static async createTrade(senderId, receiverId, senderCards, receiverCards, coinsOffered = 0) {
    if (senderCards.length > LIMITS.MAX_CARDS_PER_TRADE || 
        receiverCards.length > LIMITS.MAX_CARDS_PER_TRADE) {
      throw new Error('Trop de cartes dans l\'échange');
    }

    // Vérifier les cartes du sender
    for (const card of senderCards) {
      const userCard = await CardManager.getUserCard(senderId, card.card_id);
      if (!userCard || userCard.quantity < card.quantity) {
        throw new Error(`Cartes insuffisantes: ${card.card_id}`);
      }
    }

    const tradeData = {
      sender_id: senderId,
      receiver_id: receiverId,
      sender_cards: JSON.stringify(senderCards),
      receiver_cards: JSON.stringify(receiverCards),
      coins_offered: coinsOffered,
      status: 'pending',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    };

    const result = await db.run(`
      INSERT INTO trade_offers 
      (sender_id, receiver_id, sender_cards, receiver_cards, coins_offered, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tradeData.sender_id,
      tradeData.receiver_id,
      tradeData.sender_cards,
      tradeData.receiver_cards,
      tradeData.coins_offered,
      tradeData.status,
      tradeData.expires_at
    ]);

    return { trade_id: result.lastID, ...tradeData };
  }

  static async acceptTrade(tradeId, receiverId) {
    await db.run('BEGIN TRANSACTION');

    try {
      const trade = await this.getTrade(tradeId);
      if (!trade || trade.status !== 'pending') {
        throw new Error('Échange invalide');
      }

      // Vérifier les cartes du receiver
      const receiverCards = JSON.parse(trade.receiver_cards);
      for (const card of receiverCards) {
        const userCard = await CardManager.getUserCard(receiverId, card.card_id);
        if (!userCard || userCard.quantity < card.quantity) {
          throw new Error(`Cartes insuffisantes: ${card.card_id}`);
        }
      }

      // Transférer les cartes
      const senderCards = JSON.parse(trade.sender_cards);
      
      // Retirer les cartes du sender
      for (const card of senderCards) {
        await CardManager.removeCardsFromUser(trade.sender_id, card.card_id, card.quantity);
        await CardManager.addCardsToUser(receiverId, card.card_id, card.quantity);
      }

      // Retirer les cartes du receiver
      for (const card of receiverCards) {
        await CardManager.removeCardsFromUser(receiverId, card.card_id, card.quantity);
        await CardManager.addCardsToUser(trade.sender_id, card.card_id, card.quantity);
      }

      // Mettre à jour le statut
      await db.run(
        'UPDATE trade_offers SET status = "completed" WHERE trade_id = ?',
        tradeId
      );

      await db.run('COMMIT');
      return true;
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  static async getTrade(tradeId) {
    return await db.get('SELECT * FROM trade_offers WHERE trade_id = ?', tradeId);
  }

  static async getUserTrades(userId) {
    return await db.all(`
      SELECT * FROM trade_offers 
      WHERE (sender_id = ? OR receiver_id = ?) 
      AND status = 'pending'
      ORDER BY created_at DESC
    `, userId, userId);
  }

  static async cancelTrade(tradeId, userId) {
    const trade = await this.getTrade(tradeId);
    if (!trade || trade.sender_id !== userId) {
      throw new Error('Trade invalide');
    }

    await db.run(
      'UPDATE trade_offers SET status = "cancelled" WHERE trade_id = ?',
      tradeId
    );

    return true;
  }
}
