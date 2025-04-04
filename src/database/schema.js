// src/database/schema.js
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
        last_mined DATETIME,
        is_premium INTEGER DEFAULT 0,
        premium_expiry DATETIME
      )
    `,
    
    monitors: `
      CREATE TABLE IF NOT EXISTS monitors (
        monitor_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        target TEXT NOT NULL,
        description TEXT,
        interval INTEGER DEFAULT 300,
        timeout INTEGER DEFAULT 10000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_check DATETIME,
        status TEXT DEFAULT 'pending',
        is_active INTEGER DEFAULT 1,
        is_premium INTEGER DEFAULT 0,
        options TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `,
    
    monitor_logs: `
      CREATE TABLE IF NOT EXISTS monitor_logs (
        log_id TEXT PRIMARY KEY,
        monitor_id TEXT NOT NULL,
        status TEXT NOT NULL,
        response_time INTEGER,
        message TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (monitor_id) REFERENCES monitors(monitor_id)
      )
    `,
    
    monitor_stats: `
      CREATE TABLE IF NOT EXISTS monitor_stats (
        stat_id TEXT PRIMARY KEY,
        monitor_id TEXT NOT NULL,
        uptime_24h REAL DEFAULT 100,
        uptime_7d REAL DEFAULT 100,
        uptime_30d REAL DEFAULT 100,
        avg_response_24h REAL,
        avg_response_7d REAL,
        avg_response_30d REAL,
        checks_count INTEGER DEFAULT 0,
        failures_count INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (monitor_id) REFERENCES monitors(monitor_id)
      )
    `,
    
    monitor_alerts: `
      CREATE TABLE IF NOT EXISTS monitor_alerts (
        alert_id TEXT PRIMARY KEY,
        monitor_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        threshold INTEGER,
        channel_id TEXT,
        role_id TEXT,
        webhook_url TEXT,
        is_active INTEGER DEFAULT 1,
        consecutive_failures INTEGER DEFAULT 1,
        cooldown INTEGER DEFAULT 300,
        last_triggered DATETIME,
        FOREIGN KEY (monitor_id) REFERENCES monitors(monitor_id)
      )
    `,
    
    premium_features: `
      CREATE TABLE IF NOT EXISTS premium_features (
        feature_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        duration INTEGER NOT NULL
      )
    `,
    
    user_premium_features: `
      CREATE TABLE IF NOT EXISTS user_premium_features (
        user_id TEXT NOT NULL,
        feature_id TEXT NOT NULL,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        PRIMARY KEY (user_id, feature_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (feature_id) REFERENCES premium_features(feature_id)
      )
    `,
    
    monitor_reports: `
      CREATE TABLE IF NOT EXISTS monitor_reports (
        report_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        monitors TEXT NOT NULL,
        schedule TEXT,
        last_generated DATETIME,
        channel_id TEXT,
        is_active INTEGER DEFAULT 1,
        is_premium INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `,
    
    // Autres tables existantes...
    shop: `
      CREATE TABLE IF NOT EXISTS shop (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        type TEXT NOT NULL
      )
    `,
    
    inventory: `
      CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        PRIMARY KEY (user_id, item_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (item_id) REFERENCES shop(item_id)
      )
    `,
    
    achievements: `
      CREATE TABLE IF NOT EXISTS achievements (
        user_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, achievement_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `,
    
    transactions: `
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user TEXT,
        to_user TEXT,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user) REFERENCES users(user_id),
        FOREIGN KEY (to_user) REFERENCES users(user_id)
      )
    `,
};