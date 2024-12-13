export const SCHEMA = {
    users: `
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        experience INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        last_daily DATETIME,
        last_worked DATETIME,
        last_fished DATETIME,
        last_mined DATETIME
      )
    `,
    
    inventory: `
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        item_id TEXT,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `,
    
    shop: `
      CREATE TABLE IF NOT EXISTS shop (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        type TEXT NOT NULL,
        role_id TEXT
      )
    `,
  
    transactions: `
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user TEXT,
        to_user TEXT,
        amount INTEGER,
        type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user) REFERENCES users(user_id),
        FOREIGN KEY (to_user) REFERENCES users(user_id)
      )
    `,
  
    achievements: `
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        achievement_id TEXT,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `,
    cards: `
    CREATE TABLE IF NOT EXISTS cards (
      card_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      image_url TEXT,
      collection TEXT NOT NULL,
      is_animated BOOLEAN DEFAULT 0,
      power_level INTEGER DEFAULT 100
    )
  `,
  
  user_cards: `
    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_favorite BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (card_id) REFERENCES cards(card_id)
    )
  `,

  user_packs: `
    CREATE TABLE IF NOT EXISTS user_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      pack_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
  `,

  card_packs: `
    CREATE TABLE IF NOT EXISTS card_packs (
      pack_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      cards_per_pack INTEGER NOT NULL,
      rarity_weights TEXT NOT NULL,
      is_limited BOOLEAN DEFAULT 0,
      available_until DATETIME
    )
  `,

  marketplace_listings: `
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      listing_id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (seller_id) REFERENCES users(user_id),
      FOREIGN KEY (card_id) REFERENCES cards(card_id)
    )
  `,
  cards: `
    CREATE TABLE IF NOT EXISTS cards (
      card_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      power_level INTEGER DEFAULT 100,
      collection TEXT NOT NULL,
      theme TEXT NOT NULL,
      is_animated BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      special_effect TEXT
    )
  `,
  
  user_cards: `
    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_favorite BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (card_id) REFERENCES cards(card_id)
    )
  `,

  user_packs: `
    CREATE TABLE IF NOT EXISTS user_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      pack_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
  `,

  marketplace_listings: `
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      listing_id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (seller_id) REFERENCES users(user_id),
      FOREIGN KEY (card_id) REFERENCES cards(card_id)
    )
  `,

  trade_offers: `
    CREATE TABLE IF NOT EXISTS trade_offers (
      trade_id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      sender_cards TEXT NOT NULL, -- JSON array of {card_id, quantity}
      receiver_cards TEXT NOT NULL, -- JSON array of {card_id, quantity}
      coins_offered INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (sender_id) REFERENCES users(user_id),
      FOREIGN KEY (receiver_id) REFERENCES users(user_id)
    )
  `,

  collections: `
    CREATE TABLE IF NOT EXISTS collections (
      collection_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      reward_type TEXT,
      reward_value TEXT,
      required_cards TEXT -- JSON array of card_ids
    )
  `
    
  };
  