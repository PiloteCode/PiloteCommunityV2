import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stocks')
    .setDescription('Investissez dans le marché boursier virtuel')
    .addSubcommand(subcommand =>
      subcommand
        .setName('liste')
        .setDescription('Affiche la liste des actions disponibles'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('portefeuille')
        .setDescription('Affiche votre portefeuille d\'actions'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('acheter')
        .setDescription('Acheter des actions')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Symbole de l\'action à acheter')
            .setRequired(true)
            .addChoices(
              { name: 'Tech Solutions (TECH)', value: 'TECH' },
              { name: 'Global Foods (FOOD)', value: 'FOOD' },
              { name: 'Energy Corp (NRGY)', value: 'NRGY' },
              { name: 'Luxury Brands (LUXE)', value: 'LUXE' },
              { name: 'Health Services (HLTH)', value: 'HLTH' },
              { name: 'Banking Group (BANK)', value: 'BANK' },
              { name: 'Gaming Enterprises (GAME)', value: 'GAME' },
              { name: 'Industrial Systems (INDS)', value: 'INDS' }
            ))
        .addIntegerOption(option =>
          option.setName('quantité')
            .setDescription('Nombre d\'actions à acheter')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('vendre')
        .setDescription('Vendre des actions')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Symbole de l\'action à vendre')
            .setRequired(true)
            .addChoices(
              { name: 'Tech Solutions (TECH)', value: 'TECH' },
              { name: 'Global Foods (FOOD)', value: 'FOOD' },
              { name: 'Energy Corp (NRGY)', value: 'NRGY' },
              { name: 'Luxury Brands (LUXE)', value: 'LUXE' },
              { name: 'Health Services (HLTH)', value: 'HLTH' },
              { name: 'Banking Group (BANK)', value: 'BANK' },
              { name: 'Gaming Enterprises (GAME)', value: 'GAME' },
              { name: 'Industrial Systems (INDS)', value: 'INDS' }
            ))
        .addIntegerOption(option =>
          option.setName('quantité')
            .setDescription('Nombre d\'actions à vendre')
            .setRequired(true)
            .setMinValue(1))),

  cooldown: 5000, // 5 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Récupérer les données utilisateur
      const user = await client.db.getUser(userId);
      
      // Créer les tables nécessaires si elles n'existent pas
      await createStockTables(client);
      
      // Mettre à jour les prix des actions si nécessaire
      await updateStockPrices(client);
      
      if (subcommand === 'liste') {
        // Récupérer toutes les actions
        const stocks = await getStocks(client);
        
        // Créer l'embed pour afficher les actions
        const embed = EmbedCreator.economy(
          '📊 Marché Boursier',
          'Voici la liste des actions disponibles. Utilisez `/stocks acheter` pour investir.',
          {
            fields: stocks.map(stock => ({
              name: `${getStockEmoji(stock.symbol)} ${stock.name} (${stock.symbol})`,
              value: `Prix: ${stock.current_price} crédits\nVariation: ${formatPriceChange(stock.price_change)}`,
              inline: true
            }))
          }
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      else if (subcommand === 'portefeuille') {
        // Récupérer les actions de l'utilisateur
        const portfolio = await getUserPortfolio(client, userId);
        
        if (portfolio.length === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.info(
                '📈 Portefeuille vide',
                'Vous ne possédez aucune action. Utilisez `/stocks liste` pour voir les actions disponibles puis `/stocks acheter` pour investir.'
              )
            ]
          });
        }
        
        // Calculer la valeur totale du portefeuille
        let totalValue = 0;
        let totalInvestment = 0;
        
        const portfolioFields = [];
        
        for (const holding of portfolio) {
          const currentValue = holding.quantity * holding.current_price;
          const investment = holding.quantity * holding.purchase_price;
          const profit = currentValue - investment;
          
          totalValue += currentValue;
          totalInvestment += investment;
          
          portfolioFields.push({
            name: `${getStockEmoji(holding.symbol)} ${holding.name} (${holding.symbol})`,
            value: `Quantité: ${holding.quantity} actions\nPrix actuel: ${holding.current_price} crédits\nTotal: ${currentValue} crédits\nProfit: ${formatProfit(profit)}`,
            inline: true
          });
        }
        
        const totalProfit = totalValue - totalInvestment;
        
        // Ajouter un résumé
        portfolioFields.push({
          name: '💼 Résumé du portefeuille',
          value: `Valeur totale: ${totalValue} crédits\nInvestissement: ${totalInvestment} crédits\nProfit: ${formatProfit(totalProfit)}`,
          inline: false
        });
        
        // Créer l'embed
        const embed = EmbedCreator.economy(
          '📈 Votre Portefeuille',
          'Voici les actions que vous possédez actuellement.',
          {
            fields: portfolioFields
          }
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      else if (subcommand === 'acheter') {
        const stockSymbol = interaction.options.getString('action');
        const quantity = interaction.options.getInteger('quantité');
        
        // Récupérer l'action
        const stock = await getStock(client, stockSymbol);
        
        if (!stock) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Action introuvable',
                'Cette action n\'existe pas ou n\'est plus disponible.'
              )
            ]
          });
        }
        
        // Calculer le coût total
        const totalCost = stock.current_price * quantity;
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < totalCost) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `L'achat de ${quantity} actions de ${stock.symbol} coûte ${totalCost} crédits. Vous n'avez que ${user.balance} crédits.`
              )
            ]
          });
        }
        
        // Effectuer l'achat
        await buyStock(client, userId, stock.id, quantity, stock.current_price);
        
        // Déduire le coût
        await client.db.updateUserBalance(userId, -totalCost);
        
        // Confirmer l'achat
        return interaction.editReply({
          embeds: [
            EmbedCreator.success(
              '📈 Achat d\'actions réussi',
              `Vous avez acheté ${quantity} actions de ${stock.name} (${stock.symbol}) pour ${totalCost} crédits.`,
              {
                fields: [
                  {
                    name: '💰 Prix unitaire',
                    value: `${stock.current_price} crédits`,
                    inline: true
                  },
                  {
                    name: '🔢 Quantité',
                    value: `${quantity} actions`,
                    inline: true
                  },
                  {
                    name: '💵 Solde restant',
                    value: `${user.balance - totalCost} crédits`,
                    inline: true
                  }
                ]
              }
            )
          ]
        });
      }
      
      else if (subcommand === 'vendre') {
        const stockSymbol = interaction.options.getString('action');
        const quantity = interaction.options.getInteger('quantité');
        
        // Récupérer l'action
        const stock = await getStock(client, stockSymbol);
        
        if (!stock) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Action introuvable',
                'Cette action n\'existe pas ou n\'est plus disponible.'
              )
            ]
          });
        }
        
        // Vérifier si l'utilisateur possède assez d'actions
        const userHolding = await getUserHolding(client, userId, stock.id);
        
        if (!userHolding || userHolding.quantity < quantity) {
          const ownedQuantity = userHolding ? userHolding.quantity : 0;
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Actions insuffisantes',
                `Vous ne possédez que ${ownedQuantity} actions de ${stock.symbol}, mais vous essayez d'en vendre ${quantity}.`
              )
            ]
          });
        }
        
        // Calculer le gain
        const saleValue = stock.current_price * quantity;
        
        // Calculer le profit/perte
        const purchaseValue = userHolding.purchase_price * quantity;
        const profit = saleValue - purchaseValue;
        
        // Effectuer la vente
        await sellStock(client, userId, stock.id, quantity);
        
        // Ajouter l'argent
        await client.db.updateUserBalance(userId, saleValue);
        
        // Confirmer la vente
        return interaction.editReply({
          embeds: [
            EmbedCreator.success(
              '📉 Vente d\'actions réussie',
              `Vous avez vendu ${quantity} actions de ${stock.name} (${stock.symbol}) pour ${saleValue} crédits.`,
              {
                fields: [
                  {
                    name: '💰 Prix unitaire',
                    value: `${stock.current_price} crédits`,
                    inline: true
                  },
                  {
                    name: '📊 Profit/Perte',
                    value: formatProfit(profit),
                    inline: true
                  },
                  {
                    name: '💵 Nouveau solde',
                    value: `${user.balance + saleValue} crédits`,
                    inline: true
                  }
                ]
              }
            )
          ]
        });
      }
      
    } catch (error) {
      console.error('Error in stocks command:', error);
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Erreur', 
            'Une erreur est survenue lors de l\'exécution de la commande.'
          )
        ]
      });
    }
  }
};

// Fonction pour créer les tables des actions
async function createStockTables(client) {
  // Table des actions
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      current_price INTEGER NOT NULL,
      previous_price INTEGER NOT NULL,
      price_change REAL NOT NULL,
      volatility REAL NOT NULL,
      last_update TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  // Table des avoirs en actions des utilisateurs
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS user_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      stock_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      purchase_price REAL NOT NULL,
      purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE,
      UNIQUE(user_id, stock_id)
    )
  `);
  
  // Vérifier s'il y a des actions existantes
  const stockCount = await client.db.db.get('SELECT COUNT(*) as count FROM stocks');
  
  // Si aucune action n'existe, initialiser avec des actions par défaut
  if (stockCount.count === 0) {
    const defaultStocks = [
      { symbol: 'TECH', name: 'Tech Solutions', price: 250, volatility: 0.15 },
      { symbol: 'FOOD', name: 'Global Foods', price: 100, volatility: 0.08 },
      { symbol: 'NRGY', name: 'Energy Corp', price: 180, volatility: 0.12 },
      { symbol: 'LUXE', name: 'Luxury Brands', price: 350, volatility: 0.18 },
      { symbol: 'HLTH', name: 'Health Services', price: 200, volatility: 0.10 },
      { symbol: 'BANK', name: 'Banking Group', price: 150, volatility: 0.09 },
      { symbol: 'GAME', name: 'Gaming Enterprises', price: 120, volatility: 0.20 },
      { symbol: 'INDS', name: 'Industrial Systems', price: 170, volatility: 0.11 }
    ];
    
    // Insérer les actions par défaut
    for (const stock of defaultStocks) {
      await client.db.db.run(`
        INSERT INTO stocks (symbol, name, current_price, previous_price, price_change, volatility)
        VALUES (?, ?, ?, ?, 0, ?)
      `, stock.symbol, stock.name, stock.price, stock.price, stock.volatility);
    }
  }
}

// Fonction pour mettre à jour les prix des actions (simulant le marché)
async function updateStockPrices(client) {
  // Vérifier quand la dernière mise à jour a eu lieu
  const lastUpdate = await client.db.db.get(`
    SELECT min(datetime(last_update)) as last_update FROM stocks
  `);
  
  // Si la dernière mise à jour date de moins d'une heure, ne rien faire
  const lastUpdateTime = new Date(lastUpdate.last_update);
  const now = new Date();
  
  if ((now - lastUpdateTime) < 60 * 60 * 1000) {
    return; // Moins d'une heure s'est écoulée
  }
  
  // Récupérer toutes les actions
  const stocks = await client.db.db.all('SELECT * FROM stocks');
  
  // Mettre à jour chaque action
  for (const stock of stocks) {
    // Calculer la variation de prix (basée sur la volatilité)
    const volatility = stock.volatility;
    const randomChange = (Math.random() * 2 - 1) * volatility; // Entre -volatility et +volatility
    
    // Calculer le nouveau prix (avec un minimum de 10)
    const previousPrice = stock.current_price;
    let newPrice = Math.max(10, Math.round(previousPrice * (1 + randomChange)));
    
    // Calculer le pourcentage de changement
    const priceChange = ((newPrice - previousPrice) / previousPrice) * 100;
    
    // Mettre à jour l'action
    await client.db.db.run(`
      UPDATE stocks
      SET previous_price = current_price,
          current_price = ?,
          price_change = ?,
          last_update = datetime('now')
      WHERE id = ?
    `, newPrice, priceChange, stock.id);
  }
}

// Fonction pour récupérer toutes les actions
async function getStocks(client) {
  return await client.db.db.all('SELECT * FROM stocks ORDER BY symbol');
}

// Fonction pour récupérer une action spécifique
async function getStock(client, symbol) {
  return await client.db.db.get(
    'SELECT * FROM stocks WHERE symbol = ?',
    symbol
  );
}

// Fonction pour récupérer le portefeuille d'un utilisateur
async function getUserPortfolio(client, userId) {
  return await client.db.db.all(`
    SELECT us.*, s.symbol, s.name, s.current_price
    FROM user_stocks us
    JOIN stocks s ON us.stock_id = s.id
    WHERE us.user_id = ? AND us.quantity > 0
  `, userId);
}

// Fonction pour récupérer une action spécifique détenue par un utilisateur
async function getUserHolding(client, userId, stockId) {
  return await client.db.db.get(`
    SELECT * FROM user_stocks
    WHERE user_id = ? AND stock_id = ?
  `, userId, stockId);
}

// Fonction pour acheter des actions
async function buyStock(client, userId, stockId, quantity, price) {
  // Vérifier si l'utilisateur possède déjà cette action
  const existingHolding = await getUserHolding(client, userId, stockId);
  
  if (existingHolding) {
    // Mettre à jour le prix d'achat moyen et la quantité
    const newQuantity = existingHolding.quantity + quantity;
    const newTotalCost = (existingHolding.purchase_price * existingHolding.quantity) + (price * quantity);
    const newAveragePrice = newTotalCost / newQuantity;
    
    await client.db.db.run(`
      UPDATE user_stocks
      SET quantity = ?,
          purchase_price = ?
      WHERE id = ?
    `, newQuantity, newAveragePrice, existingHolding.id);
  } else {
    // Créer une nouvelle entrée
    await client.db.db.run(`
      INSERT INTO user_stocks (user_id, stock_id, quantity, purchase_price)
      VALUES (?, ?, ?, ?)
    `, userId, stockId, quantity, price);
  }
}

// Fonction pour vendre des actions
async function sellStock(client, userId, stockId, quantity) {
  const holding = await getUserHolding(client, userId, stockId);
  
  if (!holding) return;
  
  const newQuantity = holding.quantity - quantity;
  
  if (newQuantity <= 0) {
    // Supprimer l'entrée si toutes les actions sont vendues
    await client.db.db.run(`
      DELETE FROM user_stocks
      WHERE id = ?
    `, holding.id);
  } else {
    // Mettre à jour la quantité
    await client.db.db.run(`
      UPDATE user_stocks
      SET quantity = ?
      WHERE id = ?
    `, newQuantity, holding.id);
  }
}

// Fonction pour formater la variation de prix
function formatPriceChange(change) {
  const rounded = Math.round(change * 100) / 100; // Arrondir à 2 décimales
  const sign = rounded >= 0 ? '+' : '';
  const color = rounded >= 0 ? '🟢' : '🔴';
  
  return `${color} ${sign}${rounded}%`;
}

// Fonction pour formater le profit
function formatProfit(profit) {
  const color = profit >= 0 ? '🟢' : '🔴';
  const sign = profit >= 0 ? '+' : '';
  
  return `${color} ${sign}${profit} crédits`;
}

// Fonction pour obtenir un emoji basé sur le symbole de l'action
function getStockEmoji(symbol) {
  switch (symbol) {
    case 'TECH': return '💻';
    case 'FOOD': return '🍔';
    case 'NRGY': return '⚡';
    case 'LUXE': return '💎';
    case 'HLTH': return '🏥';
    case 'BANK': return '🏦';
    case 'GAME': return '🎮';
    case 'INDS': return '🏭';
    default: return '📈';
  }
}