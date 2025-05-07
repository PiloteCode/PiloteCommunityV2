import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Système de marché pour acheter et vendre des produits entre entreprises')
    .addSubcommand(subcommand =>
      subcommand
        .setName('browse')
        .setDescription('Parcourir les offres du marché')
        .addStringOption(option =>
          option
            .setName('search')
            .setDescription('Rechercher un produit spécifique')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Filtrer par catégorie d\'entreprise')
            .setRequired(false)
            .addChoices(
              { name: 'Technologie', value: 'tech_company' },
              { name: 'Cryptomonnaie', value: 'crypto_mining' },
              { name: 'Agriculture', value: 'farm' },
              { name: 'Industrie', value: 'factory' },
              { name: 'Exploitation minière', value: 'mining_company' },
              { name: 'Restaurant', value: 'restaurant' },
              { name: 'Hôtel', value: 'hotel' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('min_price')
            .setDescription('Prix minimum')
            .setRequired(false)
            .setMinValue(0)
        )
        .addIntegerOption(option =>
          option
            .setName('max_price')
            .setDescription('Prix maximum')
            .setRequired(false)
            .setMinValue(0)
        )
        .addStringOption(option =>
          option
            .setName('sort')
            .setDescription('Trier par...')
            .setRequired(false)
            .addChoices(
              { name: 'Prix (croissant)', value: 'price_asc' },
              { name: 'Prix (décroissant)', value: 'price_desc' },
              { name: 'Quantité (croissant)', value: 'quantity_asc' },
              { name: 'Quantité (décroissant)', value: 'quantity_desc' },
              { name: 'Date (plus récent)', value: 'date_desc' },
              { name: 'Date (plus ancien)', value: 'date_asc' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('listings')
        .setDescription('Voir vos annonces de vente actives')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('orders')
        .setDescription('Voir votre historique d\'achats')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('sales')
        .setDescription('Voir votre historique de ventes')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('sell')
        .setDescription('Créer une annonce pour vendre un produit')
        .addStringOption(option =>
          option
            .setName('product')
            .setDescription('ID du produit à vendre')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(option =>
          option
            .setName('quantity')
            .setDescription('Quantité à vendre')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(option =>
          option
            .setName('price')
            .setDescription('Prix par unité (en PiloCoins)')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(option =>
          option
            .setName('duration')
            .setDescription('Durée de l\'annonce (en jours)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(30)
        )
        .addBooleanOption(option =>
          option
            .setName('public')
            .setDescription('L\'annonce est-elle publique?')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Annuler une de vos annonces')
        .addStringOption(option =>
          option
            .setName('listing')
            .setDescription('ID de l\'annonce à annuler')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('Acheter un produit à partir d\'une annonce')
        .addStringOption(option =>
          option
            .setName('listing')
            .setDescription('ID de l\'annonce')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(option =>
          option
            .setName('quantity')
            .setDescription('Quantité à acheter')
            .setRequired(true)
            .setMinValue(1)
        )
        .addBooleanOption(option =>
          option
            .setName('for_business')
            .setDescription('Acheter pour votre entreprise? (sinon pour vous-même)')
            .setRequired(false)
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('trade')
        .setDescription('Gestion des accords commerciaux')
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Créer un accord commercial avec une autre entreprise')
            .addStringOption(option =>
              option
                .setName('seller')
                .setDescription('ID de l\'entreprise vendeuse')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption(option =>
              option
                .setName('buyer')
                .setDescription('ID de l\'entreprise acheteuse')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption(option =>
              option
                .setName('product')
                .setDescription('ID du produit')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addIntegerOption(option =>
              option
                .setName('quantity')
                .setDescription('Quantité par période')
                .setRequired(true)
                .setMinValue(1)
            )
            .addStringOption(option =>
              option
                .setName('period')
                .setDescription('Période de livraison')
                .setRequired(true)
                .addChoices(
                  { name: 'Quotidienne', value: 'daily' },
                  { name: 'Hebdomadaire', value: 'weekly' },
                  { name: 'Mensuelle', value: 'monthly' }
                )
            )
            .addIntegerOption(option =>
              option
                .setName('price')
                .setDescription('Prix par unité (en PiloCoins)')
                .setRequired(true)
                .setMinValue(1)
            )
            .addIntegerOption(option =>
              option
                .setName('discount')
                .setDescription('Pourcentage de remise (0-50%)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(50)
            )
            .addIntegerOption(option =>
              option
                .setName('duration')
                .setDescription('Durée de l\'accord (en jours)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(90)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('Lister vos accords commerciaux actifs')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('cancel')
            .setDescription('Annuler un accord commercial')
            .addStringOption(option =>
              option
                .setName('agreement')
                .setDescription('ID de l\'accord commercial')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('overview')
        .setDescription('Voir un aperçu du marché et des tendances')
    ),
  
  // Gestionnaire des autocompletes
  async autocomplete(interaction, client) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      const subcommand = interaction.options.getSubcommand();
      const group = interaction.options.getSubcommandGroup(false);
      
      // S'assurer que le système de marché est initialisé
      if (!client.marketSystem) {
        const { MarketSystem } = await import('../../utils/marketSystem.js');
        client.marketSystem = new MarketSystem(client);
        await client.marketSystem.initialize();
      }
      
      // Récupérer l'utilisateur
      const userId = interaction.user.id;
      
      // Gérer les différentes options d'autocomplétion
      if (focusedOption.name === 'product' && subcommand === 'sell') {
        // Autocomplete pour les produits qu'une entreprise peut vendre
        await handleProductAutocomplete(interaction, client, userId);
      }
      else if (focusedOption.name === 'listing' && subcommand === 'cancel') {
        // Autocomplete pour les annonces actives d'une entreprise
        await handleListingAutocomplete(interaction, client, userId);
      }
      else if (focusedOption.name === 'listing' && subcommand === 'buy') {
        // Autocomplete pour toutes les annonces actives sur le marché
        await handleMarketListingAutocomplete(interaction, client);
      }
      else if (group === 'trade') {
        if (focusedOption.name === 'seller' || focusedOption.name === 'buyer') {
          // Autocomplete pour les entreprises
          await handleBusinessAutocomplete(interaction, client, focusedOption.name, userId);
        }
        else if (focusedOption.name === 'product') {
          // Autocomplete pour les produits d'une entreprise vendeuse
          const sellerId = interaction.options.getString('seller');
          if (sellerId) {
            await handleSellerProductAutocomplete(interaction, client, sellerId);
          } else {
            await interaction.respond([]);
          }
        }
        else if (focusedOption.name === 'agreement' && subcommand === 'cancel') {
          // Autocomplete pour les accords commerciaux
          await handleAgreementAutocomplete(interaction, client, userId);
        }
      }
      
    } catch (error) {
      console.error('Error in market autocomplete:', error);
      await interaction.respond([]);
    }
  },
  
  async execute(interaction, client) {
    try {
      // S'assurer que le système de marché est initialisé
      if (!client.marketSystem) {
        const { MarketSystem } = await import('../../utils/marketSystem.js');
        client.marketSystem = new MarketSystem(client);
        await client.marketSystem.initialize();
      }
      
      const userId = interaction.user.id;
      const market = client.marketSystem;
      const manager = client.businessManager;
      
      // Récupérer l'entreprise de l'utilisateur (peut être null pour certaines commandes)
      const business = await manager.getUserBusiness(userId);
      
      const subcommand = interaction.options.getSubcommand();
      const group = interaction.options.getSubcommandGroup(false);
      
      // Liste des commandes qui ne nécessitent pas d'avoir une entreprise
      const publicCommands = ['browse', 'buy', 'overview'];
      
      // Vérifier si l'utilisateur a une entreprise pour les commandes qui le nécessitent
      if (!publicCommands.includes(subcommand) && !business && group !== 'trade') {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Aucune entreprise',
              'Vous ne possédez pas d\'entreprise. Utilisez `/corporation créer` pour en créer une.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Traiter les différentes sous-commandes
      if (subcommand === 'browse') {
        await handleBrowseMarket(interaction, client, userId);
      }
      else if (subcommand === 'listings') {
        await handleViewListings(interaction, client, business, userId);
      }
      else if (subcommand === 'orders') {
        await handleViewOrders(interaction, client, business, userId);
      }
      else if (subcommand === 'sales') {
        await handleViewSales(interaction, client, business, userId);
      }
      else if (subcommand === 'sell') {
        await handleSellProduct(interaction, client, business, userId);
      }
      else if (subcommand === 'cancel') {
        await handleCancelListing(interaction, client, business, userId);
      }
      else if (subcommand === 'buy') {
        await handleBuyProduct(interaction, client, business, userId);
      }
      else if (subcommand === 'overview') {
        await handleMarketOverview(interaction, client);
      }
      else if (group === 'trade') {
        if (subcommand === 'create') {
          await handleCreateTradeAgreement(interaction, client, userId);
        }
        else if (subcommand === 'list') {
          await handleListTradeAgreements(interaction, client, business, userId);
        }
        else if (subcommand === 'cancel') {
          await handleCancelTradeAgreement(interaction, client, userId);
        }
      }
      
    } catch (error) {
      console.error('Error in market command:', error);
      
      await interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue lors de l'exécution de cette commande: ${error.message}`
          )
        ],
        ephemeral: true
      });
    }
  }
};

/**
 * Gère l'autocomplétion des produits d'une entreprise
 */
async function handleProductAutocomplete(interaction, client, userId) {
  try {
    // Récupérer l'entreprise de l'utilisateur
    const business = await client.businessManager.getUserBusiness(userId);
    if (!business) return interaction.respond([]);
    
    // Récupérer les produits de l'entreprise
    const products = await client.db.db.all(`
      SELECT * FROM business_products
      WHERE business_id = ? AND stock > 0
      ORDER BY name
    `, business.id);
    
    // Format de recherche
    const searchTerm = interaction.options.getFocused().toLowerCase();
    
    // Filtrer les produits selon le terme de recherche
    const filteredProducts = products.filter(product => 
      product.name.toLowerCase().includes(searchTerm) || 
      (product.description && product.description.toLowerCase().includes(searchTerm))
    );
    
    // Formater les résultats pour l'autocomplétion
    const choices = filteredProducts.map(product => ({
      name: `${product.name} (Stock: ${product.stock})`,
      value: product.id.toString()
    }));
    
    await interaction.respond(choices.slice(0, 25));
  } catch (error) {
    console.error('Error handling product autocomplete:', error);
    await interaction.respond([]);
  }
}

/**
 * Gère l'autocomplétion des annonces d'une entreprise
 */
async function handleListingAutocomplete(interaction, client, userId) {
  try {
    // Récupérer l'entreprise de l'utilisateur
    const business = await client.businessManager.getUserBusiness(userId);
    if (!business) return interaction.respond([]);
    
    // Récupérer les annonces actives de l'entreprise
    const listings = await client.marketSystem.getBusinessListings(business.id);
    
    // Format de recherche
    const searchTerm = interaction.options.getFocused().toLowerCase();
    
    // Filtrer les annonces selon le terme de recherche
    const filteredListings = listings.filter(listing => 
      listing.product_name.toLowerCase().includes(searchTerm) || 
      (listing.product_description && listing.product_description.toLowerCase().includes(searchTerm))
    );
    
    // Formater les résultats pour l'autocomplétion
    const choices = filteredListings.map(listing => ({
      name: `${listing.product_name} (${listing.remaining_quantity}/${listing.total_quantity}) - ${listing.price_per_unit} PiloCoins/unité`,
      value: listing.id.toString()
    }));
    
    await interaction.respond(choices.slice(0, 25));
  } catch (error) {
    console.error('Error handling listing autocomplete:', error);
    await interaction.respond([]);
  }
}

/**
 * Gère l'autocomplétion des annonces du marché
 */
async function handleMarketListingAutocomplete(interaction, client) {
  try {
    // Récupérer toutes les annonces actives du marché
    const searchTerm = interaction.options.getFocused().toLowerCase();
    
    const listings = await client.marketSystem.searchListings(searchTerm);
    
    // Limiter à 25 résultats
    const choices = listings.slice(0, 25).map(listing => ({
      name: `${listing.product_name} | ${listing.business_name} | ${listing.price_per_unit} PiloCoins/unité (x${listing.quantity_available})`,
      value: listing.id.toString()
    }));
    
    await interaction.respond(choices);
  } catch (error) {
    console.error('Error handling market listing autocomplete:', error);
    await interaction.respond([]);
  }
}

/**
 * Gère l'autocomplétion des entreprises
 */
async function handleBusinessAutocomplete(interaction, client, optionName, userId) {
  try {
    // Récupérer la liste des entreprises
    const searchTerm = interaction.options.getFocused().toLowerCase();
    
    // Si c'est pour un vendeur, on exclut l'entreprise de l'acheteur, et vice-versa
    const excludeId = optionName === 'seller' ? 
                      interaction.options.getString('buyer') : 
                      interaction.options.getString('seller');
    
    const businesses = await client.db.db.all(`
      SELECT * FROM businesses
      WHERE name LIKE ? AND id != ?
      ORDER BY name
    `, `%${searchTerm}%`, excludeId || 0);
    
    // Filtrer pour s'assurer que l'utilisateur est membre des entreprises retournées
    const userBusinesses = [];
    
    for (const business of businesses) {
      const isMember = await client.db.db.get(`
        SELECT * FROM business_members
        WHERE business_id = ? AND user_id = ?
      `, business.id, userId);
      
      if (isMember) {
        userBusinesses.push({
          name: `${business.name} (${business.type})`,
          value: business.id.toString()
        });
      }
    }
    
    await interaction.respond(userBusinesses.slice(0, 25));
  } catch (error) {
    console.error('Error handling business autocomplete:', error);
    await interaction.respond([]);
  }
}

/**
 * Gère l'autocomplétion des produits d'une entreprise vendeuse
 */
async function handleSellerProductAutocomplete(interaction, client, sellerId) {
  try {
    // Récupérer les produits de l'entreprise vendeuse
    const products = await client.db.db.all(`
      SELECT * FROM business_products
      WHERE business_id = ? AND stock > 0
      ORDER BY name
    `, sellerId);
    
    // Format de recherche
    const searchTerm = interaction.options.getFocused().toLowerCase();
    
    // Filtrer les produits selon le terme de recherche
    const filteredProducts = products.filter(product => 
      product.name.toLowerCase().includes(searchTerm) || 
      (product.description && product.description.toLowerCase().includes(searchTerm))
    );
    
    // Formater les résultats pour l'autocomplétion
    const choices = filteredProducts.map(product => ({
      name: `${product.name} (Stock: ${product.stock})`,
      value: product.id.toString()
    }));
    
    await interaction.respond(choices.slice(0, 25));
  } catch (error) {
    console.error('Error handling seller product autocomplete:', error);
    await interaction.respond([]);
  }
}

/**
 * Gère l'autocomplétion des accords commerciaux
 */
async function handleAgreementAutocomplete(interaction, client, userId) {
  try {
    // Récupérer les entreprises de l'utilisateur
    const userBusinesses = await client.db.db.all(`
      SELECT business_id FROM business_members
      WHERE user_id = ?
    `, userId);
    
    if (userBusinesses.length === 0) return interaction.respond([]);
    
    // Récupérer les accords commerciaux des entreprises de l'utilisateur
    const businessIds = userBusinesses.map(b => b.business_id);
    
    let agreements = [];
    for (const businessId of businessIds) {
      const businessAgreements = await client.marketSystem.getBusinessTradeAgreements(businessId);
      agreements = [...agreements, ...businessAgreements];
    }
    
    // Format de recherche
    const searchTerm = interaction.options.getFocused().toLowerCase();
    
    // Filtrer les accords selon le terme de recherche
    const filteredAgreements = agreements.filter(agreement => 
      agreement.product_name.toLowerCase().includes(searchTerm) || 
      agreement.seller_name.toLowerCase().includes(searchTerm) ||
      agreement.buyer_name.toLowerCase().includes(searchTerm)
    );
    
    // Formater les résultats pour l'autocomplétion
    const choices = filteredAgreements.map(agreement => ({
      name: `${agreement.product_name} | ${agreement.is_seller ? 'Vous' : agreement.seller_name} → ${agreement.is_seller ? agreement.buyer_name : 'Vous'}`,
      value: agreement.id.toString()
    }));
    
    await interaction.respond(choices.slice(0, 25));
  } catch (error) {
    console.error('Error handling agreement autocomplete:', error);
    await interaction.respond([]);
  }
}

/**
 * Gère la navigation sur le marché
 */
async function handleBrowseMarket(interaction, client, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les paramètres de filtrage
    const searchTerm = interaction.options.getString('search') || '';
    const categoryFilter = interaction.options.getString('category') || '';
    const minPrice = interaction.options.getInteger('min_price') || 0;
    const maxPrice = interaction.options.getInteger('max_price') || 0;
    const sortOption = interaction.options.getString('sort') || 'price_asc';
    
    // Analyser l'option de tri
    let sortBy, sortOrder;
    if (sortOption === 'price_asc') {
      sortBy = 'price';
      sortOrder = 'asc';
    } else if (sortOption === 'price_desc') {
      sortBy = 'price';
      sortOrder = 'desc';
    } else if (sortOption === 'quantity_asc') {
      sortBy = 'quantity';
      sortOrder = 'asc';
    } else if (sortOption === 'quantity_desc') {
      sortBy = 'quantity';
      sortOrder = 'desc';
    } else if (sortOption === 'date_asc') {
      sortBy = 'date';
      sortOrder = 'asc';
    } else if (sortOption === 'date_desc') {
      sortBy = 'date';
      sortOrder = 'desc';
    }
    
    // Rechercher les annonces
    const listings = await client.marketSystem.searchListings(
      searchTerm, categoryFilter, minPrice, maxPrice, sortBy, sortOrder
    );
    
    if (listings.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '🏪 Marché',
            'Aucune annonce ne correspond à vos critères de recherche.'
          )
        ]
      });
    }
    
    // Créer l'embed pour afficher les résultats
    const embed = new EmbedBuilder()
      .setTitle('🏪 Marché')
      .setDescription(`${listings.length} produits correspondent à votre recherche${searchTerm ? ` pour "${searchTerm}"` : ''}.`)
      .setColor(0x00AAFF)
      .setFooter({ text: 'Utilisez /market buy [id] pour acheter un produit' });
    
    // Ajouter les filtres à l'embed
    let filterText = '';
    if (categoryFilter) filterText += `Catégorie: ${getCategoryName(categoryFilter)}\n`;
    if (minPrice > 0) filterText += `Prix min: ${minPrice} PiloCoins\n`;
    if (maxPrice > 0) filterText += `Prix max: ${maxPrice} PiloCoins\n`;
    filterText += `Tri: ${getSortName(sortOption)}\n`;
    
    if (filterText) {
      embed.addFields({
        name: '🔍 Filtres',
        value: filterText,
        inline: false
      });
    }
    
    // Limiter à 20 résultats pour l'affichage
    const displayListings = listings.slice(0, 20);
    
    // Regrouper les annonces par vendeur pour un affichage plus compact
    const listingsByBusiness = {};
    for (const listing of displayListings) {
      if (!listingsByBusiness[listing.business_name]) {
        listingsByBusiness[listing.business_name] = [];
      }
      listingsByBusiness[listing.business_name].push(listing);
    }
    
    // Ajouter les annonces à l'embed
    for (const [businessName, businessListings] of Object.entries(listingsByBusiness)) {
      let listingText = '';
      
      for (const listing of businessListings) {
        listingText += `• **${listing.product_name}** - ID: \`${listing.id}\`\n`;
        listingText += `   Prix: ${listing.price_per_unit} PiloCoins/unité | Quantité: ${listing.quantity_available}\n`;
        
        // Calculer l'expiration
        const expiresIn = Math.max(0, Math.floor((listing.expires_at - new Date()) / (1000 * 60 * 60 * 24)));
        listingText += `   Expire dans: ${expiresIn} jour${expiresIn !== 1 ? 's' : ''}\n\n`;
      }
      
      embed.addFields({
        name: `📦 ${businessName} - ${getBusinessTypeName(businessListings[0].business_type)}`,
        value: listingText,
        inline: false
      });
    }
    
    // Créer les composants d'interaction
    const buyButton = new ButtonBuilder()
      .setCustomId(`market:buy:${userId}`)
      .setLabel('Acheter un produit')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🛒');
    
    const refreshButton = new ButtonBuilder()
      .setCustomId(`market:refresh:${userId}`)
      .setLabel('Actualiser')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄');
    
    const buttons = new ActionRowBuilder().addComponents(buyButton, refreshButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling browse market:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de la navigation sur le marché: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'affichage des annonces d'une entreprise
 */
async function handleViewListings(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les annonces actives de l'entreprise
    const listings = await client.marketSystem.getBusinessListings(business.id);
    
    if (listings.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '📦 Vos annonces',
            'Vous n\'avez aucune annonce active. Utilisez `/market sell` pour créer une annonce.'
          )
        ]
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`📦 Annonces de ${business.name}`)
      .setDescription(`Vous avez ${listings.length} annonce${listings.length > 1 ? 's' : ''} active${listings.length > 1 ? 's' : ''}.`)
      .setColor(0x00AAFF)
      .setFooter({ text: 'Utilisez /market cancel [id] pour annuler une annonce' });
    
    // Ajouter les annonces à l'embed
    for (const listing of listings) {
      const expiresIn = Math.max(0, Math.floor((new Date(listing.expires_at) - new Date()) / (1000 * 60 * 60 * 24)));
      
      embed.addFields({
        name: `${listing.product_name} - ID: ${listing.id}`,
        value: `Prix: ${listing.price_per_unit} PiloCoins/unité\n` +
               `Quantité: ${listing.remaining_quantity}/${listing.total_quantity}\n` +
               `Valeur totale restante: ${listing.remaining_quantity * listing.price_per_unit} PiloCoins\n` +
               `Expire dans: ${expiresIn} jour${expiresIn !== 1 ? 's' : ''}\n` +
               `Visibilité: ${listing.is_public ? 'Publique' : 'Privée'}`
      });
    }
    
    // Créer les composants d'interaction
    const sellButton = new ButtonBuilder()
      .setCustomId(`market:sell:${business.id}`)
      .setLabel('Créer une annonce')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📦');
    
    const cancelButton = new ButtonBuilder()
      .setCustomId(`market:cancel:${business.id}`)
      .setLabel('Annuler une annonce')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚫');
    
    const refreshButton = new ButtonBuilder()
      .setCustomId(`market:refresh_listings:${business.id}`)
      .setLabel('Actualiser')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄');
    
    const buttons = new ActionRowBuilder().addComponents(sellButton, cancelButton, refreshButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling view listings:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage des annonces: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'affichage des achats d'une entreprise ou d'un utilisateur
 */
async function handleViewOrders(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les achats de l'entreprise et de l'utilisateur
    const businessOrders = business ? 
                        await client.marketSystem.getBuyerOrderHistory(business.id, 'business', 10) : 
                        [];
    
    const userOrders = await client.marketSystem.getBuyerOrderHistory(userId, 'user', 10);
    
    if (businessOrders.length === 0 && userOrders.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '🛒 Vos achats',
            'Vous n\'avez effectué aucun achat. Utilisez `/market buy` pour acheter des produits.'
          )
        ]
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`🛒 Historique d'achats`)
      .setDescription(`Vos derniers achats personnels et pour votre entreprise.`)
      .setColor(0x00AAFF);
    
    // Ajouter les achats de l'entreprise à l'embed
    if (businessOrders.length > 0) {
      let ordersText = '';
      
      for (const order of businessOrders) {
        const date = new Date(order.created_at).toLocaleDateString();
        
        ordersText += `• **${order.product_name}** - ${date}\n`;
        ordersText += `   Vendeur: ${order.seller_name}\n`;
        ordersText += `   Quantité: ${order.quantity} | Prix: ${order.price_per_unit} PiloCoins/unité\n`;
        ordersText += `   Total: ${order.total_price} PiloCoins\n\n`;
      }
      
      embed.addFields({
        name: `🏢 Achats pour ${business.name}`,
        value: ordersText || 'Aucun achat',
        inline: false
      });
    }
    
    // Ajouter les achats personnels à l'embed
    if (userOrders.length > 0) {
      let ordersText = '';
      
      for (const order of userOrders) {
        const date = new Date(order.created_at).toLocaleDateString();
        
        ordersText += `• **${order.product_name}** - ${date}\n`;
        ordersText += `   Vendeur: ${order.seller_name}\n`;
        ordersText += `   Quantité: ${order.quantity} | Prix: ${order.price_per_unit} PiloCoins/unité\n`;
        ordersText += `   Total: ${order.total_price} PiloCoins\n\n`;
      }
      
      embed.addFields({
        name: '👤 Achats personnels',
        value: ordersText || 'Aucun achat',
        inline: false
      });
    }
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error handling view orders:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage des achats: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'affichage des ventes d'une entreprise
 */
async function handleViewSales(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les ventes de l'entreprise
    const sales = await client.marketSystem.getSellerSalesHistory(business.id, 20);
    
    if (sales.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '💰 Vos ventes',
            'Vous n\'avez effectué aucune vente. Utilisez `/market sell` pour créer des annonces.'
          )
        ]
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`💰 Historique de ventes de ${business.name}`)
      .setDescription(`Les ${sales.length} dernières ventes de votre entreprise.`)
      .setColor(0x00AAFF);
    
    // Calculer les statistiques des ventes
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_price, 0);
    const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const avgPrice = totalQuantity > 0 ? Math.round(totalRevenue / totalQuantity) : 0;
    
    embed.addFields({
      name: '📊 Statistiques',
      value: `Revenu total: ${totalRevenue} PiloCoins\n` +
             `Quantité totale: ${totalQuantity} unités\n` +
             `Prix moyen: ${avgPrice} PiloCoins/unité`,
      inline: false
    });
    
    // Regrouper les ventes par produit
    const salesByProduct = {};
    for (const sale of sales) {
      if (!salesByProduct[sale.product_name]) {
        salesByProduct[sale.product_name] = [];
      }
      salesByProduct[sale.product_name].push(sale);
    }
    
    // Ajouter les ventes à l'embed, groupées par produit
    for (const [productName, productSales] of Object.entries(salesByProduct)) {
      let salesText = '';
      const productRevenue = productSales.reduce((sum, sale) => sum + sale.total_price, 0);
      const productQuantity = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
      
      salesText += `Revenu: ${productRevenue} PiloCoins | Quantité: ${productQuantity} unités\n\n`;
      
      // Ajouter les 3 ventes les plus récentes
      for (let i = 0; i < Math.min(3, productSales.length); i++) {
        const sale = productSales[i];
        const date = new Date(sale.created_at).toLocaleDateString();
        
        salesText += `• ${date} - `;
        if (sale.buyer_type === 'business') {
          salesText += `Entreprise: ${sale.buyer_name}\n`;
        } else {
          salesText += `Utilisateur: ${sale.buyer_name}\n`;
        }
        
        salesText += `   Quantité: ${sale.quantity} | Prix: ${sale.price_per_unit} PiloCoins/unité\n`;
        salesText += `   Total: ${sale.total_price} PiloCoins\n`;
        
        // Ne pas ajouter de ligne vide après la dernière vente
        if (i < Math.min(3, productSales.length) - 1) {
          salesText += '\n';
        }
      }
      
      embed.addFields({
        name: `📦 ${productName}`,
        value: salesText,
        inline: false
      });
    }
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error handling view sales:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage des ventes: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère la création d'une annonce
 */
async function handleSellProduct(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les paramètres
    const productId = interaction.options.getString('product');
    const quantity = interaction.options.getInteger('quantity');
    const pricePerUnit = interaction.options.getInteger('price');
    const duration = interaction.options.getInteger('duration');
    const isPublic = interaction.options.getBoolean('public') ?? true;
    
    // Créer l'annonce
    const result = await client.marketSystem.createListing(
      business.id, productId, quantity, pricePerUnit, duration, isPublic, userId
    );
    
    // Créer l'embed de confirmation
    const embed = EmbedCreator.success(
      '📦 Annonce créée!',
      `Vous avez créé une annonce pour vendre **${quantity} ${result.product_name}** à **${pricePerUnit} PiloCoins/unité**.`,
      {
        fields: [
          {
            name: '💰 Prix total',
            value: `${result.total_price} PiloCoins`,
            inline: true
          },
          {
            name: '📅 Expire le',
            value: `<t:${Math.floor(result.expires_at.getTime() / 1000)}:D>`,
            inline: true
          },
          {
            name: '👁️ Visibilité',
            value: isPublic ? 'Publique' : 'Privée',
            inline: true
          },
          {
            name: '🆔 ID de l\'annonce',
            value: result.id.toString(),
            inline: false
          }
        ]
      }
    );
    
    // Créer les composants d'interaction
    const viewButton = new ButtonBuilder()
      .setCustomId(`market:listings:${business.id}`)
      .setLabel('Voir mes annonces')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋');
    
    const buttons = new ActionRowBuilder().addComponents(viewButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling sell product:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de la création de l'annonce: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'annulation d'une annonce
 */
async function handleCancelListing(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les paramètres
    const listingId = interaction.options.getString('listing');
    
    // Annuler l'annonce
    const result = await client.marketSystem.cancelListing(listingId, userId);
    
    // Créer l'embed de confirmation
    const embed = EmbedCreator.success(
      '🚫 Annonce annulée',
      `Vous avez annulé votre annonce pour **${result.product_name}**.`,
      {
        fields: [
          {
            name: '📦 Produit retourné',
            value: `${result.returned_quantity} ${result.product_name}`,
            inline: true
          }
        ]
      }
    );
    
    // Créer les composants d'interaction
    const viewButton = new ButtonBuilder()
      .setCustomId(`market:listings:${business.id}`)
      .setLabel('Voir mes annonces')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋');
    
    const buttons = new ActionRowBuilder().addComponents(viewButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling cancel listing:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'annulation de l'annonce: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'achat d'un produit
 */
async function handleBuyProduct(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les paramètres
    const listingId = interaction.options.getString('listing');
    const quantity = interaction.options.getInteger('quantity');
    const forBusiness = interaction.options.getBoolean('for_business') ?? false;
    
    // Vérifier si l'utilisateur a une entreprise si l'achat est pour une entreprise
    if (forBusiness && !business) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Aucune entreprise',
            'Vous ne possédez pas d\'entreprise. Vous ne pouvez pas acheter pour une entreprise.'
          )
        ]
      });
    }
    
    // Déterminer le type d'acheteur et l'ID
    const buyerType = forBusiness ? 'business' : 'user';
    const buyerId = forBusiness ? business.id : userId;
    
    // Effectuer l'achat
    const result = await client.marketSystem.purchaseProduct(
      listingId, quantity, buyerId, buyerType, userId
    );
    
    // Créer l'embed de confirmation
    const embed = EmbedCreator.success(
      '🛒 Achat réussi!',
      `Vous avez acheté **${quantity} ${result.product_name}** à **${result.price_per_unit} PiloCoins/unité** de **${result.seller_name}**.`,
      {
        fields: [
          {
            name: '💰 Coût total',
            value: `${result.total_price} PiloCoins`,
            inline: true
          },
          {
            name: '🏢 Acheteur',
            value: forBusiness ? business.name : 'Vous-même',
            inline: true
          }
        ]
      }
    );
    
    // Créer les composants d'interaction
    const browseButton = new ButtonBuilder()
      .setCustomId(`market:browse:${userId}`)
      .setLabel('Continuer les achats')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛒');
    
    const historyButton = new ButtonBuilder()
      .setCustomId(`market:orders:${userId}`)
      .setLabel('Voir mes achats')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋');
    
    const buttons = new ActionRowBuilder().addComponents(browseButton, historyButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling buy product:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'achat du produit: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère la création d'un accord commercial
 */
async function handleCreateTradeAgreement(interaction, client, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les paramètres
    const sellerId = interaction.options.getString('seller');
    const buyerId = interaction.options.getString('buyer');
    const productId = interaction.options.getString('product');
    const quantityPerPeriod = interaction.options.getInteger('quantity');
    const period = interaction.options.getString('period');
    const pricePerUnit = interaction.options.getInteger('price');
    const discountPercent = interaction.options.getInteger('discount') || 0;
    const duration = interaction.options.getInteger('duration');
    
    // Créer l'accord commercial
    const result = await client.marketSystem.createTradeAgreement(
      sellerId, buyerId, productId, quantityPerPeriod, period, pricePerUnit, discountPercent, duration, userId
    );
    
    // Créer l'embed de confirmation
    const embed = EmbedCreator.success(
      '🤝 Accord commercial créé!',
      `Vous avez créé un accord commercial entre **${result.seller_name}** et **${result.buyer_name}** pour **${result.product_name}**.`,
      {
        fields: [
          {
            name: '📦 Quantité par période',
            value: `${result.quantity_per_period} unités par ${getPeriodName(result.period)}`,
            inline: true
          },
          {
            name: '💰 Prix unitaire',
            value: `${result.price_per_unit} PiloCoins`,
            inline: true
          },
          {
            name: '💸 Remise',
            value: `${result.discount_percent}%`,
            inline: true
          },
          {
            name: '💵 Valeur par livraison',
            value: `${result.total_per_delivery} PiloCoins`,
            inline: true
          },
          {
            name: '📅 Valide jusqu\'au',
            value: `<t:${Math.floor(result.valid_until.getTime() / 1000)}:D>`,
            inline: true
          },
          {
            name: '🔢 ID de l\'accord',
            value: result.id.toString(),
            inline: false
          }
        ]
      }
    );
    
    // Créer les composants d'interaction
    const viewButton = new ButtonBuilder()
      .setCustomId(`market:trade:list:${userId}`)
      .setLabel('Voir mes accords commerciaux')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋');
    
    const buttons = new ActionRowBuilder().addComponents(viewButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling create trade agreement:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de la création de l'accord commercial: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'affichage des accords commerciaux
 */
async function handleListTradeAgreements(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les entreprises de l'utilisateur
    const userBusinesses = await client.db.db.all(`
      SELECT b.* FROM businesses b
      JOIN business_members bm ON b.id = bm.business_id
      WHERE bm.user_id = ?
    `, userId);
    
    if (userBusinesses.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.warning(
            'Aucune entreprise',
            'Vous ne possédez pas d\'entreprise. Vous ne pouvez pas avoir d\'accords commerciaux.'
          )
        ]
      });
    }
    
    // Récupérer les accords commerciaux pour chaque entreprise
    let allAgreements = [];
    
    for (const business of userBusinesses) {
      const agreements = await client.marketSystem.getBusinessTradeAgreements(business.id);
      allAgreements = [...allAgreements, ...agreements];
    }
    
    if (allAgreements.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '🤝 Accords commerciaux',
            'Vous n\'avez aucun accord commercial actif. Utilisez `/market trade create` pour en créer un.'
          )
        ]
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle('🤝 Accords commerciaux')
      .setDescription(`Vous avez ${allAgreements.length} accord${allAgreements.length > 1 ? 's' : ''} commercial${allAgreements.length > 1 ? 'aux' : ''} actif${allAgreements.length > 1 ? 's' : ''}.`)
      .setColor(0x00AAFF)
      .setFooter({ text: 'Utilisez /market trade cancel [id] pour annuler un accord' });
    
    // Trier les accords par date d'expiration (plus proches d'abord)
    allAgreements.sort((a, b) => a.valid_until - b.valid_until);
    
    // Séparer les accords où l'utilisateur est vendeur et acheteur
    const sellerAgreements = allAgreements.filter(a => a.is_seller);
    const buyerAgreements = allAgreements.filter(a => !a.is_seller);
    
    // Ajouter les accords où l'utilisateur est vendeur
    if (sellerAgreements.length > 0) {
      let agreementsText = '';
      
      for (const agreement of sellerAgreements) {
        const daysRemaining = Math.max(0, Math.floor((agreement.valid_until - new Date()) / (1000 * 60 * 60 * 24)));
        
        agreementsText += `• **${agreement.product_name}** → ${agreement.buyer_name}\n`;
        agreementsText += `   ID: \`${agreement.id}\` | ${agreement.quantity_per_period} unités par ${getPeriodName(agreement.period)}\n`;
        agreementsText += `   Prix: ${agreement.price_per_unit} PiloCoins/unité (Remise: ${agreement.discount_percent}%)\n`;
        agreementsText += `   Valeur par livraison: ${agreement.total_per_delivery} PiloCoins\n`;
        agreementsText += `   Expire dans: ${daysRemaining} jour${daysRemaining !== 1 ? 's' : ''}\n\n`;
      }
      
      embed.addFields({
        name: '📤 Vous vendez',
        value: agreementsText,
        inline: false
      });
    }
    
    // Ajouter les accords où l'utilisateur est acheteur
    if (buyerAgreements.length > 0) {
      let agreementsText = '';
      
      for (const agreement of buyerAgreements) {
        const daysRemaining = Math.max(0, Math.floor((agreement.valid_until - new Date()) / (1000 * 60 * 60 * 24)));
        
        agreementsText += `• ${agreement.seller_name} → **${agreement.product_name}**\n`;
        agreementsText += `   ID: \`${agreement.id}\` | ${agreement.quantity_per_period} unités par ${getPeriodName(agreement.period)}\n`;
        agreementsText += `   Prix: ${agreement.price_per_unit} PiloCoins/unité (Remise: ${agreement.discount_percent}%)\n`;
        agreementsText += `   Valeur par livraison: ${agreement.total_per_delivery} PiloCoins\n`;
        agreementsText += `   Expire dans: ${daysRemaining} jour${daysRemaining !== 1 ? 's' : ''}\n\n`;
      }
      
      embed.addFields({
        name: '📥 Vous achetez',
        value: agreementsText,
        inline: false
      });
    }
    
    // Créer les composants d'interaction
    const createButton = new ButtonBuilder()
      .setCustomId(`market:trade:create:${userId}`)
      .setLabel('Créer un accord')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🤝');
    
    const cancelButton = new ButtonBuilder()
      .setCustomId(`market:trade:cancel:${userId}`)
      .setLabel('Annuler un accord')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚫');
    
    const buttons = new ActionRowBuilder().addComponents(createButton, cancelButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling list trade agreements:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage des accords commerciaux: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'annulation d'un accord commercial
 */
async function handleCancelTradeAgreement(interaction, client, userId) {
  await interaction.deferReply();
  
  try {
    // Récupérer les paramètres
    const agreementId = interaction.options.getString('agreement');
    
    // Annuler l'accord commercial
    const result = await client.marketSystem.cancelTradeAgreement(agreementId, userId);
    
    // Créer l'embed de confirmation
    const embed = EmbedCreator.success(
      '🚫 Accord commercial annulé',
      `Vous avez annulé l'accord commercial entre **${result.seller_name}** et **${result.buyer_name}** pour **${result.product_name}**.`,
      {
        fields: [
          {
            name: '🆔 ID de l\'accord',
            value: agreementId,
            inline: false
          }
        ]
      }
    );
    
    // Créer les composants d'interaction
    const viewButton = new ButtonBuilder()
      .setCustomId(`market:trade:list:${userId}`)
      .setLabel('Voir mes accords commerciaux')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋');
    
    const buttons = new ActionRowBuilder().addComponents(viewButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling cancel trade agreement:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'annulation de l'accord commercial: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'affichage de l'aperçu du marché
 */
async function handleMarketOverview(interaction, client) {
  await interaction.deferReply();
  
  try {
    // Générer l'aperçu du marché
    const overview = await client.marketSystem.generateMarketOverview();
    
    if (!overview || !overview.products || overview.products.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '📊 Aperçu du marché',
            'Aucune donnée de marché disponible pour le moment. Le marché se développera avec l\'activité des joueurs.'
          )
        ]
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle('📊 Aperçu du marché')
      .setDescription('Statistiques et tendances actuelles du marché.')
      .setColor(0x00AAFF)
      .setFooter({ text: `Dernière mise à jour: ${new Date(overview.timestamp).toLocaleString()}` });
    
    // Ajouter les statistiques globales
    embed.addFields({
      name: '📈 Activité du marché (7 derniers jours)',
      value: `Volume total: ${overview.market_volume.total_volume || 0} unités\n` +
             `Valeur totale: ${overview.market_volume.total_value || 0} PiloCoins`,
      inline: false
    });
    
    // Trouver les produits les plus échangés
    const topProducts = [...overview.products]
      .sort((a, b) => (b.listing_count || 0) - (a.listing_count || 0))
      .slice(0, 5);
    
    if (topProducts.length > 0) {
      let productsText = '';
      
      for (const product of topProducts) {
        const trend = product.price_trend || 0;
        const trendEmoji = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
        
        productsText += `• **${product.name}**\n`;
        productsText += `   Annonces: ${product.listing_count} | Disponibles: ${product.total_quantity || 0} unités\n`;
        productsText += `   Prix: ${product.avg_price || 0} PiloCoins (${trendEmoji} ${trend > 0 ? '+' : ''}${trend}%)\n`;
        productsText += `   Gamme de prix: ${product.min_price || 0} - ${product.max_price || 0} PiloCoins\n\n`;
      }
      
      embed.addFields({
        name: '🔝 Produits les plus populaires',
        value: productsText,
        inline: false
      });
    }
    
    // Créer un bouton pour naviguer sur le marché
    const browseButton = new ButtonBuilder()
      .setCustomId(`market:browse:${interaction.user.id}`)
      .setLabel('Parcourir le marché')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛒');
    
    const buttons = new ActionRowBuilder().addComponents(browseButton);
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling market overview:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de la génération de l'aperçu du marché: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Retourne le nom complet d'une catégorie d'entreprise
 */
function getCategoryName(category) {
  const categories = {
    'tech_company': 'Technologie',
    'crypto_mining': 'Cryptomonnaie',
    'farm': 'Agriculture',
    'orchard': 'Verger',
    'flower_shop': 'Fleuriste',
    'factory': 'Industrie',
    'mining_company': 'Exploitation minière',
    'restaurant': 'Restaurant',
    'hotel': 'Hôtel'
  };
  
  return categories[category] || category;
}

/**
 * Retourne le nom d'un type d'entreprise
 */
function getBusinessTypeName(type) {
  return getCategoryName(type);
}

/**
 * Retourne le nom d'une option de tri
 */
function getSortName(sortOption) {
  const options = {
    'price_asc': 'Prix (croissant)',
    'price_desc': 'Prix (décroissant)',
    'quantity_asc': 'Quantité (croissant)',
    'quantity_desc': 'Quantité (décroissant)',
    'date_asc': 'Date (plus ancien)',
    'date_desc': 'Date (plus récent)'
  };
  
  return options[sortOption] || sortOption;
}

/**
 * Retourne le nom d'une période
 */
function getPeriodName(period) {
  const periods = {
    'daily': 'jour',
    'weekly': 'semaine',
    'monthly': 'mois'
  };
  
  return periods[period] || period;
}