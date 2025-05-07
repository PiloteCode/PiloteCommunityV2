/**
 * Système de marché pour les échanges entre entreprises
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';

export class MarketSystem {
  constructor(client) {
    this.client = client;
    this.db = client.db.db;
    this.activeListings = new Map(); // Map des annonces actives
    this.activeOrders = new Map(); // Map des commandes en cours
    this.tradeAgreements = new Map(); // Map des accords commerciaux actifs
  }

  /**
   * Initialise le système de marché
   */
  async initialize() {
    try {
      // Créer les tables si elles n'existent pas
      await this.createMarketTables();
      
      // Charger les annonces actives
      await this.loadActiveListings();
      
      // Charger les commandes en cours
      await this.loadActiveOrders();
      
      // Charger les accords commerciaux
      await this.loadTradeAgreements();
      
      console.log('Market System initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Market System:', error);
      return false;
    }
  }

  /**
   * Crée les tables nécessaires pour le système de marché
   */
  async createMarketTables() {
    try {
      // Table des annonces
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS market_listings (
          id TEXT PRIMARY KEY,
          seller_id TEXT NOT NULL,
          seller_name TEXT NOT NULL,
          product_name TEXT NOT NULL,
          description TEXT,
          quantity INTEGER NOT NULL,
          price INTEGER NOT NULL,
          category TEXT NOT NULL,
          creation_time TEXT NOT NULL,
          expiration_time TEXT NOT NULL,
          status TEXT NOT NULL,
          FOREIGN KEY (seller_id) REFERENCES businesses(id) ON DELETE CASCADE
        )
      `);
      
      // Table des commandes/transactions
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS market_orders (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL,
          buyer_id TEXT NOT NULL,
          seller_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          price INTEGER NOT NULL,
          order_time TEXT NOT NULL,
          status TEXT NOT NULL
        )
      `);
      
      // Table des accords commerciaux
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS trade_agreements (
          id TEXT PRIMARY KEY,
          seller_id TEXT NOT NULL,
          seller_name TEXT NOT NULL,
          buyer_id TEXT NOT NULL,
          buyer_name TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          price INTEGER NOT NULL,
          frequency INTEGER NOT NULL, /* en millisecondes */
          next_delivery TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          status TEXT NOT NULL
        )
      `);
      
      // Table des livraisons d'accords commerciaux
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS agreement_deliveries (
          id TEXT PRIMARY KEY,
          agreement_id TEXT NOT NULL,
          delivery_time TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          price INTEGER NOT NULL,
          status TEXT NOT NULL,
          FOREIGN KEY (agreement_id) REFERENCES trade_agreements(id) ON DELETE CASCADE
        )
      `);
      
      return true;
    } catch (error) {
      console.error('Error creating market tables:', error);
      throw error;
    }
  }

  /**
   * Charge les annonces actives depuis la base de données
   */
  async loadActiveListings() {
    try {
      const listings = await this.db.all(`
        SELECT * FROM market_listings 
        WHERE status = 'active'
      `);
      
      for (const listing of listings) {
        this.activeListings.set(listing.id, {
          id: listing.id,
          sellerId: listing.seller_id,
          sellerName: listing.seller_name,
          productName: listing.product_name,
          description: listing.description,
          quantity: listing.quantity,
          price: listing.price,
          category: listing.category,
          creationTime: new Date(listing.creation_time),
          expirationTime: new Date(listing.expiration_time),
          status: listing.status
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error loading active listings:', error);
      return false;
    }
  }

  /**
   * Charge les commandes en cours depuis la base de données
   */
  async loadActiveOrders() {
    try {
      const orders = await this.db.all(`
        SELECT * FROM market_orders 
        WHERE status = 'processing'
      `);
      
      for (const order of orders) {
        this.activeOrders.set(order.id, {
          id: order.id,
          listingId: order.listing_id,
          buyerId: order.buyer_id,
          sellerId: order.seller_id,
          productName: order.product_name,
          quantity: order.quantity,
          price: order.price,
          orderTime: new Date(order.order_time),
          status: order.status
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error loading active orders:', error);
      return false;
    }
  }

  /**
   * Charge les accords commerciaux depuis la base de données
   */
  async loadTradeAgreements() {
    try {
      const agreements = await this.db.all(`
        SELECT * FROM trade_agreements 
        WHERE status IN ('active', 'pending')
      `);
      
      for (const agreement of agreements) {
        this.tradeAgreements.set(agreement.id, {
          id: agreement.id,
          sellerId: agreement.seller_id,
          sellerName: agreement.seller_name,
          buyerId: agreement.buyer_id,
          buyerName: agreement.buyer_name,
          productName: agreement.product_name,
          quantity: agreement.quantity,
          price: agreement.price,
          frequency: agreement.frequency,
          nextDelivery: new Date(agreement.next_delivery),
          startTime: new Date(agreement.start_time),
          endTime: new Date(agreement.end_time),
          status: agreement.status
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error loading trade agreements:', error);
      return false;
    }
  }

  /**
   * Crée une nouvelle annonce sur le marché
   */
  async createListing(listingData) {
    try {
      // Vérifier les données minimales requises
      if (!listingData.sellerId || !listingData.productName || !listingData.quantity || !listingData.price) {
        return { success: false, message: "Données d'annonce incomplètes" };
      }
      
      // Générer un ID unique
      const listingId = uuidv4();
      
      // Définir des temps par défaut
      const creationTime = new Date();
      const expirationTime = new Date(creationTime.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 jours par défaut
      
      // Valider la catégorie
      const validCategories = ['matières premières', 'composants', 'produits finis', 'services', 'autres'];
      const category = validCategories.includes(listingData.category) ? listingData.category : 'autres';
      
      // Insérer dans la base de données
      await this.db.run(`
        INSERT INTO market_listings (
          id, seller_id, seller_name, product_name, description, 
          quantity, price, category, creation_time, expiration_time, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      listingId,
      listingData.sellerId,
      listingData.sellerName,
      listingData.productName,
      listingData.description || '',
      listingData.quantity,
      listingData.price,
      category,
      creationTime.toISOString(),
      expirationTime.toISOString(),
      'active'
      );
      
      // Ajouter à la liste en mémoire
      this.activeListings.set(listingId, {
        id: listingId,
        sellerId: listingData.sellerId,
        sellerName: listingData.sellerName,
        productName: listingData.productName,
        description: listingData.description || '',
        quantity: listingData.quantity,
        price: listingData.price,
        category,
        creationTime,
        expirationTime,
        status: 'active'
      });
      
      return {
        success: true,
        listingId,
        message: "Annonce créée avec succès"
      };
    } catch (error) {
      console.error('Error creating listing:', error);
      return { success: false, message: "Erreur lors de la création de l'annonce" };
    }
  }

  /**
   * Récupère une annonce par son ID
   */
  async getListingById(listingId) {
    try {
      // Vérifier d'abord en mémoire
      if (this.activeListings.has(listingId)) {
        return this.activeListings.get(listingId);
      }
      
      // Sinon, chercher dans la base de données
      const listing = await this.db.get(`
        SELECT * FROM market_listings WHERE id = ?
      `, listingId);
      
      if (!listing) {
        return null;
      }
      
      return {
        id: listing.id,
        sellerId: listing.seller_id,
        sellerName: listing.seller_name,
        productName: listing.product_name,
        description: listing.description,
        quantity: listing.quantity,
        price: listing.price,
        category: listing.category,
        creationTime: new Date(listing.creation_time),
        expirationTime: new Date(listing.expiration_time),
        status: listing.status
      };
    } catch (error) {
      console.error('Error getting listing:', error);
      return null;
    }
  }

  /**
   * Recherche des annonces avec filtres
   */
  async searchListings(filters = {}) {
    try {
      let query = `
        SELECT * FROM market_listings 
        WHERE status = 'active'
      `;
      const queryParams = [];
      
      // Filtrer par catégorie
      if (filters.category) {
        query += ` AND category = ?`;
        queryParams.push(filters.category);
      }
      
      // Filtrer par nom de produit
      if (filters.productName) {
        query += ` AND product_name LIKE ?`;
        queryParams.push(`%${filters.productName}%`);
      }
      
      // Filtrer par prix maximum
      if (filters.maxPrice && !isNaN(filters.maxPrice)) {
        query += ` AND price <= ?`;
        queryParams.push(filters.maxPrice);
      }
      
      // Filtrer par vendeur
      if (filters.sellerId) {
        query += ` AND seller_id = ?`;
        queryParams.push(filters.sellerId);
      }
      
      // Trier les résultats
      let orderBy = ' ORDER BY creation_time DESC';
      if (filters.sort) {
        switch (filters.sort) {
          case 'price_asc':
            orderBy = ' ORDER BY price ASC';
            break;
          case 'price_desc':
            orderBy = ' ORDER BY price DESC';
            break;
          case 'newest':
            orderBy = ' ORDER BY creation_time DESC';
            break;
          case 'oldest':
            orderBy = ' ORDER BY creation_time ASC';
            break;
        }
      }
      
      query += orderBy;
      
      // Limiter le nombre de résultats
      if (filters.limit && !isNaN(filters.limit)) {
        query += ` LIMIT ?`;
        queryParams.push(filters.limit);
      } else {
        query += ` LIMIT 50`; // Limite par défaut
      }
      
      // Décalage pour la pagination
      if (filters.offset && !isNaN(filters.offset)) {
        query += ` OFFSET ?`;
        queryParams.push(filters.offset);
      }
      
      const listings = await this.db.all(query, ...queryParams);
      
      return listings.map(listing => ({
        id: listing.id,
        sellerId: listing.seller_id,
        sellerName: listing.seller_name,
        productName: listing.product_name,
        description: listing.description,
        quantity: listing.quantity,
        price: listing.price,
        category: listing.category,
        creationTime: new Date(listing.creation_time),
        expirationTime: new Date(listing.expiration_time),
        status: listing.status
      }));
    } catch (error) {
      console.error('Error searching listings:', error);
      return [];
    }
  }

  /**
   * Achète un produit d'une annonce
   */
  async purchaseListing(listingId, buyerId) {
    try {
      // Vérifier si l'annonce existe et est active
      const listing = await this.getListingById(listingId);
      if (!listing || listing.status !== 'active') {
        return { success: false, message: "Cette annonce n'est plus disponible" };
      }
      
      // Vérifier si l'entreprise acheteuse a assez de fonds
      const { BusinessManager } = await import('./businessManager.js');
      const businessManager = new BusinessManager(this.client);
      
      const buyerBusiness = await businessManager.getBusiness(buyerId);
      if (!buyerBusiness) {
        return { success: false, message: "Entreprise acheteuse non trouvée" };
      }
      
      if (buyerBusiness.balance < listing.price) {
        return { 
          success: false, 
          message: `Fonds insuffisants. Prix: ${listing.price}€, Solde: ${buyerBusiness.balance}€` 
        };
      }
      
      // Créer la transaction
      const orderId = uuidv4();
      const orderTime = new Date();
      
      // Générer la transaction
      await this.db.run(`
        INSERT INTO market_orders (
          id, listing_id, buyer_id, seller_id, product_name,
          quantity, price, order_time, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      orderId,
      listing.id,
      buyerId,
      listing.sellerId,
      listing.productName,
      listing.quantity,
      listing.price,
      orderTime.toISOString(),
      'completed'
      );
      
      // Mettre à jour le statut de l'annonce
      await this.db.run(`
        UPDATE market_listings
        SET status = 'sold'
        WHERE id = ?
      `, listing.id);
      
      // Retirer l'annonce des annonces actives
      this.activeListings.delete(listing.id);
      
      // Transférer les fonds du vendeur à l'acheteur
      await this.db.run(`
        UPDATE businesses
        SET balance = balance - ?
        WHERE id = ?
      `, listing.price, buyerId);
      
      await this.db.run(`
        UPDATE businesses
        SET balance = balance + ?
        WHERE id = ?
      `, listing.price, listing.sellerId);
      
      return {
        success: true,
        transactionId: orderId,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        buyerId,
        productName: listing.productName,
        quantity: listing.quantity,
        price: listing.price,
        orderTime
      };
    } catch (error) {
      console.error('Error purchasing listing:', error);
      return { success: false, message: "Erreur lors de l'achat" };
    }
  }

  /**
   * Annule une annonce
   */
  async cancelListing(listingId, sellerId) {
    try {
      // Vérifier si l'annonce existe et appartient au vendeur
      const listing = await this.getListingById(listingId);
      if (!listing) {
        return { success: false, message: "Annonce non trouvée" };
      }
      
      if (listing.sellerId !== sellerId) {
        return { success: false, message: "Vous n'êtes pas le propriétaire de cette annonce" };
      }
      
      if (listing.status !== 'active') {
        return { success: false, message: "Cette annonce n'est plus active" };
      }
      
      // Mettre à jour le statut de l'annonce
      await this.db.run(`
        UPDATE market_listings
        SET status = 'cancelled'
        WHERE id = ?
      `, listingId);
      
      // Retirer l'annonce des annonces actives
      this.activeListings.delete(listingId);
      
      return {
        success: true,
        productName: listing.productName,
        message: "Annonce annulée avec succès"
      };
    } catch (error) {
      console.error('Error cancelling listing:', error);
      return { success: false, message: "Erreur lors de l'annulation de l'annonce" };
    }
  }

  /**
   * Crée un accord commercial entre deux entreprises
   */
  async createTradeAgreement(agreementData) {
    try {
      // Vérifier les données minimales requises
      if (!agreementData.sellerId || !agreementData.buyerId || 
          !agreementData.productName || !agreementData.quantity || 
          !agreementData.price || !agreementData.frequency) {
        return { success: false, message: "Données d'accord commercial incomplètes" };
      }
      
      // Générer un ID unique
      const agreementId = uuidv4();
      
      // Définir des temps
      const startTime = new Date();
      const nextDelivery = new Date(startTime.getTime() + agreementData.frequency);
      
      // Durée par défaut : 30 jours si non spécifié
      const duration = agreementData.duration || (30 * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + duration);
      
      // Insérer dans la base de données
      await this.db.run(`
        INSERT INTO trade_agreements (
          id, seller_id, seller_name, buyer_id, buyer_name, product_name,
          quantity, price, frequency, next_delivery, start_time, end_time, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      agreementId,
      agreementData.sellerId,
      agreementData.sellerName,
      agreementData.buyerId,
      agreementData.buyerName,
      agreementData.productName,
      agreementData.quantity,
      agreementData.price,
      agreementData.frequency,
      nextDelivery.toISOString(),
      startTime.toISOString(),
      endTime.toISOString(),
      agreementData.status || 'pending'
      );
      
      // Ajouter à la liste en mémoire
      this.tradeAgreements.set(agreementId, {
        id: agreementId,
        sellerId: agreementData.sellerId,
        sellerName: agreementData.sellerName,
        buyerId: agreementData.buyerId,
        buyerName: agreementData.buyerName,
        productName: agreementData.productName,
        quantity: agreementData.quantity,
        price: agreementData.price,
        frequency: agreementData.frequency,
        nextDelivery,
        startTime,
        endTime,
        status: agreementData.status || 'pending'
      });
      
      return {
        success: true,
        agreementId,
        message: "Accord commercial créé avec succès"
      };
    } catch (error) {
      console.error('Error creating trade agreement:', error);
      return { success: false, message: "Erreur lors de la création de l'accord commercial" };
    }
  }

  /**
   * Accepte un accord commercial
   */
  async acceptTradeAgreement(agreementId, buyerId) {
    try {
      // Vérifier si l'accord existe et concerne l'acheteur
      const agreement = await this.getTradeAgreementById(agreementId);
      if (!agreement) {
        return { success: false, message: "Accord commercial non trouvé" };
      }
      
      if (agreement.buyerId !== buyerId) {
        return { success: false, message: "Vous n'êtes pas l'acheteur concerné par cet accord" };
      }
      
      if (agreement.status !== 'pending') {
        return { success: false, message: "Cet accord n'est plus en attente d'acceptation" };
      }
      
      // Mettre à jour le statut de l'accord
      await this.db.run(`
        UPDATE trade_agreements
        SET status = 'active'
        WHERE id = ?
      `, agreementId);
      
      // Mettre à jour en mémoire
      if (this.tradeAgreements.has(agreementId)) {
        const updatedAgreement = this.tradeAgreements.get(agreementId);
        updatedAgreement.status = 'active';
        this.tradeAgreements.set(agreementId, updatedAgreement);
      }
      
      return {
        success: true,
        sellerId: agreement.sellerId,
        message: "Accord commercial accepté avec succès"
      };
    } catch (error) {
      console.error('Error accepting trade agreement:', error);
      return { success: false, message: "Erreur lors de l'acceptation de l'accord commercial" };
    }
  }

  /**
   * Rejette un accord commercial
   */
  async rejectTradeAgreement(agreementId, buyerId) {
    try {
      // Vérifier si l'accord existe et concerne l'acheteur
      const agreement = await this.getTradeAgreementById(agreementId);
      if (!agreement) {
        return { success: false, message: "Accord commercial non trouvé" };
      }
      
      if (agreement.buyerId !== buyerId) {
        return { success: false, message: "Vous n'êtes pas l'acheteur concerné par cet accord" };
      }
      
      if (agreement.status !== 'pending') {
        return { success: false, message: "Cet accord n'est plus en attente d'acceptation" };
      }
      
      // Mettre à jour le statut de l'accord
      await this.db.run(`
        UPDATE trade_agreements
        SET status = 'rejected'
        WHERE id = ?
      `, agreementId);
      
      // Retirer l'accord des accords actifs
      this.tradeAgreements.delete(agreementId);
      
      return {
        success: true,
        sellerId: agreement.sellerId,
        message: "Accord commercial rejeté"
      };
    } catch (error) {
      console.error('Error rejecting trade agreement:', error);
      return { success: false, message: "Erreur lors du rejet de l'accord commercial" };
    }
  }

  /**
   * Annule un accord commercial
   */
  async cancelTradeAgreement(agreementId, userId) {
    try {
      // Vérifier si l'accord existe
      const agreement = await this.getTradeAgreementById(agreementId);
      if (!agreement) {
        return { success: false, message: "Accord commercial non trouvé" };
      }
      
      // Vérifier si l'utilisateur est impliqué dans l'accord
      if (agreement.sellerId !== userId && agreement.buyerId !== userId) {
        return { success: false, message: "Vous n'êtes pas impliqué dans cet accord commercial" };
      }
      
      if (agreement.status !== 'active' && agreement.status !== 'pending') {
        return { success: false, message: "Cet accord n'est plus actif" };
      }
      
      // Mettre à jour le statut de l'accord
      await this.db.run(`
        UPDATE trade_agreements
        SET status = 'cancelled'
        WHERE id = ?
      `, agreementId);
      
      // Retirer l'accord des accords actifs
      this.tradeAgreements.delete(agreementId);
      
      return {
        success: true,
        productName: agreement.productName,
        message: "Accord commercial annulé avec succès"
      };
    } catch (error) {
      console.error('Error cancelling trade agreement:', error);
      return { success: false, message: "Erreur lors de l'annulation de l'accord commercial" };
    }
  }

  /**
   * Récupère un accord commercial par son ID
   */
  async getTradeAgreementById(agreementId) {
    try {
      // Vérifier d'abord en mémoire
      if (this.tradeAgreements.has(agreementId)) {
        return this.tradeAgreements.get(agreementId);
      }
      
      // Sinon, chercher dans la base de données
      const agreement = await this.db.get(`
        SELECT * FROM trade_agreements WHERE id = ?
      `, agreementId);
      
      if (!agreement) {
        return null;
      }
      
      return {
        id: agreement.id,
        sellerId: agreement.seller_id,
        sellerName: agreement.seller_name,
        buyerId: agreement.buyer_id,
        buyerName: agreement.buyer_name,
        productName: agreement.product_name,
        quantity: agreement.quantity,
        price: agreement.price,
        frequency: agreement.frequency,
        nextDelivery: new Date(agreement.next_delivery),
        startTime: new Date(agreement.start_time),
        endTime: new Date(agreement.end_time),
        status: agreement.status
      };
    } catch (error) {
      console.error('Error getting trade agreement:', error);
      return null;
    }
  }

  /**
   * Traite les livraisons des accords commerciaux
   */
  async processTradeAgreements() {
    try {
      const now = new Date();
      const processedAgreements = [];
      
      // Récupérer tous les accords actifs
      const activeAgreements = await this.db.all(`
        SELECT * FROM trade_agreements 
        WHERE status = 'active' AND next_delivery <= ?
      `, now.toISOString());
      
      // Traiter chaque accord
      for (const agreement of activeAgreements) {
        // Vérifier si l'accord est expiré
        const endTime = new Date(agreement.end_time);
        if (endTime <= now) {
          // Marquer l'accord comme terminé
          await this.db.run(`
            UPDATE trade_agreements
            SET status = 'completed'
            WHERE id = ?
          `, agreement.id);
          
          // Retirer de la mémoire
          this.tradeAgreements.delete(agreement.id);
          
          processedAgreements.push({
            id: agreement.id,
            action: 'completed',
            reason: 'expiration'
          });
          
          continue;
        }
        
        // Vérifier si l'acheteur a assez de fonds
        const { BusinessManager } = await import('./businessManager.js');
        const businessManager = new BusinessManager(this.client);
        
        const buyerBusiness = await businessManager.getBusiness(agreement.buyer_id);
        if (!buyerBusiness || buyerBusiness.balance < agreement.price) {
          // Enregistrer l'échec
          const deliveryId = uuidv4();
          await this.db.run(`
            INSERT INTO agreement_deliveries
            (id, agreement_id, delivery_time, quantity, price, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          deliveryId,
          agreement.id,
          now.toISOString(),
          agreement.quantity,
          agreement.price,
          'failed'
          );
          
          processedAgreements.push({
            id: agreement.id,
            action: 'delivery_failed',
            reason: 'insufficient_funds',
            deliveryId
          });
        } else {
          // Effectuer la transaction
          const deliveryId = uuidv4();
          
          // Enregistrer la livraison
          await this.db.run(`
            INSERT INTO agreement_deliveries
            (id, agreement_id, delivery_time, quantity, price, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          deliveryId,
          agreement.id,
          now.toISOString(),
          agreement.quantity,
          agreement.price,
          'completed'
          );
          
          // Transférer les fonds
          await this.db.run(`
            UPDATE businesses
            SET balance = balance - ?
            WHERE id = ?
          `, agreement.price, agreement.buyer_id);
          
          await this.db.run(`
            UPDATE businesses
            SET balance = balance + ?
            WHERE id = ?
          `, agreement.price, agreement.seller_id);
          
          processedAgreements.push({
            id: agreement.id,
            action: 'delivery_completed',
            deliveryId
          });
        }
        
        // Mettre à jour la prochaine livraison
        const nextDelivery = new Date(now.getTime() + parseInt(agreement.frequency));
        await this.db.run(`
          UPDATE trade_agreements
          SET next_delivery = ?
          WHERE id = ?
        `, nextDelivery.toISOString(), agreement.id);
        
        // Mettre à jour en mémoire
        if (this.tradeAgreements.has(agreement.id)) {
          const updatedAgreement = this.tradeAgreements.get(agreement.id);
          updatedAgreement.nextDelivery = nextDelivery;
          this.tradeAgreements.set(agreement.id, updatedAgreement);
        }
      }
      
      return {
        success: true,
        processedCount: processedAgreements.length,
        processedAgreements
      };
    } catch (error) {
      console.error('Error processing trade agreements:', error);
      return { success: false, message: "Erreur lors du traitement des accords commerciaux" };
    }
  }

  /**
   * Génère un embed pour afficher les annonces du marché
   */
  async generateMarketListingsEmbed(page = 1, filters = {}) {
    try {
      const pageSize = 10;
      const offset = (page - 1) * pageSize;
      
      // Ajouter l'offset à nos filtres
      const searchFilters = {
        ...filters,
        offset,
        limit: pageSize
      };
      
      // Récupérer les annonces
      const listings = await this.searchListings(searchFilters);
      
      // Calculer le nombre total d'annonces (pour la pagination)
      let countQuery = `
        SELECT COUNT(*) as total FROM market_listings 
        WHERE status = 'active'
      `;
      const countParams = [];
      
      if (filters.category) {
        countQuery += ` AND category = ?`;
        countParams.push(filters.category);
      }
      
      if (filters.productName) {
        countQuery += ` AND product_name LIKE ?`;
        countParams.push(`%${filters.productName}%`);
      }
      
      if (filters.maxPrice) {
        countQuery += ` AND price <= ?`;
        countParams.push(filters.maxPrice);
      }
      
      if (filters.sellerId) {
        countQuery += ` AND seller_id = ?`;
        countParams.push(filters.sellerId);
      }
      
      const countResult = await this.db.get(countQuery, ...countParams);
      const totalListings = countResult ? countResult.total : 0;
      const totalPages = Math.ceil(totalListings / pageSize);
      
      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle('🛒 Marché des entreprises')
        .setColor('#0099ff')
        .setFooter({ text: `Page ${page}/${Math.max(1, totalPages)} • ${totalListings} annonces` });
      
      // Ajouter les filtres actifs dans la description
      let description = 'Annonces actuellement disponibles sur le marché.\n\n';
      if (filters.category) {
        description += `**Catégorie:** ${filters.category}\n`;
      }
      if (filters.productName) {
        description += `**Recherche:** ${filters.productName}\n`;
      }
      if (filters.maxPrice) {
        description += `**Prix max:** ${filters.maxPrice}€\n`;
      }
      if (filters.sort) {
        const sortLabels = {
          'price_asc': 'Prix (croissant)',
          'price_desc': 'Prix (décroissant)',
          'newest': 'Plus récentes',
          'oldest': 'Plus anciennes'
        };
        description += `**Tri:** ${sortLabels[filters.sort] || filters.sort}\n`;
      }
      
      embed.setDescription(description);
      
      // Ajouter les annonces
      if (listings.length === 0) {
        embed.addFields({ name: 'Aucune annonce', value: 'Aucune annonce ne correspond à vos critères.' });
      } else {
        for (const listing of listings) {
          const formattedPrice = new Intl.NumberFormat('fr-FR').format(listing.price);
          const unitPrice = (listing.price / listing.quantity).toFixed(2);
          
          embed.addFields({
            name: `${listing.productName} (${listing.quantity} unités)`,
            value: `Vendeur: ${listing.sellerName}\nPrix: ${formattedPrice}€ (${unitPrice}€/unité)\nCatégorie: ${listing.category}\nID: ${listing.id}`
          });
        }
      }
      
      // Créer les composants d'interaction
      const components = [];
      
      // Boutons de pagination
      const paginationRow = new ActionRowBuilder();
      
      paginationRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`market_page_${Math.max(1, page - 1)}_${JSON.stringify(filters)}`)
          .setLabel('◀️ Précédent')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 1)
      );
      
      paginationRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`market_page_${Math.min(totalPages, page + 1)}_${JSON.stringify(filters)}`)
          .setLabel('Suivant ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages)
      );
      
      components.push(paginationRow);
      
      // Sélecteur de catégorie
      const categoryRow = new ActionRowBuilder();
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(`market_filter_category_${page}_${JSON.stringify(filters)}`)
        .setPlaceholder('Filtrer par catégorie')
        .addOptions([
          { label: 'Toutes les catégories', value: 'all' },
          { label: 'Matières premières', value: 'matières premières' },
          { label: 'Composants', value: 'composants' },
          { label: 'Produits finis', value: 'produits finis' },
          { label: 'Services', value: 'services' },
          { label: 'Autres', value: 'autres' }
        ]);
      
      categoryRow.addComponents(categorySelect);
      components.push(categoryRow);
      
      // Sélecteur de tri
      const sortRow = new ActionRowBuilder();
      const sortSelect = new StringSelectMenuBuilder()
        .setCustomId(`market_filter_sort_${page}_${JSON.stringify(filters)}`)
        .setPlaceholder('Trier les résultats')
        .addOptions([
          { label: 'Plus récentes', value: 'newest' },
          { label: 'Plus anciennes', value: 'oldest' },
          { label: 'Prix (croissant)', value: 'price_asc' },
          { label: 'Prix (décroissant)', value: 'price_desc' }
        ]);
      
      sortRow.addComponents(sortSelect);
      components.push(sortRow);
      
      return { embed, components };
    } catch (error) {
      console.error('Error generating market listings embed:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('🛒 Marché des entreprises')
        .setDescription('Une erreur est survenue lors du chargement des annonces.')
        .setColor('#FF0000');
      
      return { embed: errorEmbed, components: [] };
    }
  }

  /**
   * Génère un embed pour afficher les détails d'une annonce
   */
  async generateListingDetailsEmbed(listingId, businessId = null) {
    try {
      const listing = await this.getListingById(listingId);
      
      if (!listing) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('🛒 Détails de l\'annonce')
          .setDescription('Cette annonce n\'existe pas ou a été supprimée.')
          .setColor('#FF0000');
        
        return { embed: errorEmbed, components: [] };
      }
      
      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle(`🛒 ${listing.productName}`)
        .setColor('#0099ff')
        .setDescription(listing.description || '*Pas de description*')
        .addFields(
          { name: 'Vendeur', value: listing.sellerName, inline: true },
          { name: 'Catégorie', value: listing.category, inline: true },
          { name: 'Quantité', value: listing.quantity.toString(), inline: true },
          { name: 'Prix total', value: `${listing.price}€`, inline: true },
          { name: 'Prix unitaire', value: `${(listing.price / listing.quantity).toFixed(2)}€`, inline: true },
          { name: 'Date de création', value: listing.creationTime.toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `ID: ${listing.id}` });
      
      // Créer les composants d'interaction
      const components = [];
      
      // Bouton d'achat et de retour
      const actionRow = new ActionRowBuilder();
      
      // Ajouter le bouton d'achat si un business ID est fourni
      if (businessId && listing.sellerId !== businessId) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`market_buy_${businessId}_${listing.id}`)
            .setLabel(`Acheter (${listing.price}€)`)
            .setStyle(ButtonStyle.Success)
        );
      }
      
      // Ajouter le bouton d'annulation si c'est le vendeur
      if (businessId && listing.sellerId === businessId) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`market_cancel_${businessId}_${listing.id}`)
            .setLabel('Annuler l\'annonce')
            .setStyle(ButtonStyle.Danger)
        );
      }
      
      // Ajouter le bouton de retour
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('market_page_1_{}')
          .setLabel('Retour au marché')
          .setStyle(ButtonStyle.Secondary)
      );
      
      if (actionRow.components.length > 0) {
        components.push(actionRow);
      }
      
      return { embed, components };
    } catch (error) {
      console.error('Error generating listing details embed:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('🛒 Détails de l\'annonce')
        .setDescription('Une erreur est survenue lors du chargement des détails de l\'annonce.')
        .setColor('#FF0000');
      
      return { embed: errorEmbed, components: [] };
    }
  }
}