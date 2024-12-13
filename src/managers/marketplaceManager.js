export class MarketplaceManager {
  static async createListing(sellerId, cardId, price, quantity) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire après 7 jours

    const result = await db.run(`
      INSERT INTO marketplace_listings (
        seller_id, card_id, price, quantity, expires_at
      ) VALUES (?, ?, ?, ?, ?)
    `, sellerId, cardId, price, quantity, expiresAt.toISOString());

    await CardManager.removeCardsFromUser(sellerId, cardId, quantity);

    return {
      listing_id: result.lastID,
      seller_id: sellerId,
      card_id: cardId,
      price,
      quantity,
      expires_at: expiresAt
    };
  }

  static async getListing(listingId) {
    return await db.get(
      'SELECT * FROM marketplace_listings WHERE listing_id = ? AND status = "active"',
      listingId
    );
  }

  static async executePurchase(listing, buyerId) {
    const { seller_id, card_id, price, quantity } = listing;
    const totalPrice = price * quantity;

    // Démarrer une transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Mettre à jour le solde de l'acheteur
      await updateUser(buyerId, {
        balance: { decrement: totalPrice }
      });

      // Mettre à jour le solde du vendeur
      await updateUser(seller_id, {
        balance: { increment: totalPrice }
      });

      // Ajouter les cartes à l'acheteur
      await CardManager.addCardsToUser(buyerId, card_id, quantity);

      // Marquer l'annonce comme vendue
      await db.run(`
        UPDATE marketplace_listings 
        SET status = "sold", 
            buyer_id = ?,
            sold_at = CURRENT_TIMESTAMP
        WHERE listing_id = ?
      `, buyerId, listing.listing_id);

      // Enregistrer la transaction
      await db.run(`
        INSERT INTO transactions (
          from_user, to_user, amount, type, details
        ) VALUES (?, ?, ?, "marketplace", ?)
      `, buyerId, seller_id, totalPrice, JSON.stringify({
        card_id,
        quantity,
        listing_id: listing.listing_id
      }));

      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  static async searchListings(name, rarity, maxPrice) {
    let query = `
      SELECT ml.*, c.name, c.rarity
      FROM marketplace_listings ml
      JOIN cards c ON ml.card_id = c.card_id
      WHERE ml.status = "active"
    `;
    const params = [];

    if (name) {
      query += ' AND c.name LIKE ?';
      params.push(`%${name}%`);
    }

    if (rarity) {
      query += ' AND c.rarity = ?';
      params.push(rarity);
    }

    if (maxPrice) {
      query += ' AND ml.price <= ?';
      params.push(maxPrice);
    }

    query += ' ORDER BY ml.price ASC';

    return await db.all(query, ...params);
  }
}
