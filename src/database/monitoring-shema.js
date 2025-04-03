// src/database/monitoring-schema.js
export const MONITORING_SCHEMA = {
    // Table pour stocker les métriques de base du bot
    bot_metrics: `
      CREATE TABLE IF NOT EXISTS bot_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        uptime INTEGER NOT NULL,
        memory_usage REAL NOT NULL,
        cpu_usage REAL NOT NULL,
        connected_servers INTEGER NOT NULL,
        active_users INTEGER NOT NULL,
        command_count INTEGER NOT NULL,
        latency INTEGER NOT NULL
      )
    `,
    
    // Table pour suivre l'utilisation des commandes
    command_usage: `
      CREATE TABLE IF NOT EXISTS command_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        execution_time INTEGER NOT NULL
      )
    `,
    
    // Table pour les erreurs et exceptions
    error_logs: `
      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        command_name TEXT,
        user_id TEXT,
        guild_id TEXT
      )
    `,
    
    // Table pour les capteurs personnalisés
    sensors: `
      CREATE TABLE IF NOT EXISTS sensors (
        sensor_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        check_interval INTEGER DEFAULT 60000,
        warning_threshold REAL,
        critical_threshold REAL,
        last_check DATETIME,
        last_status TEXT DEFAULT 'unknown'
      )
    `,
    
    // Table pour les données des capteurs
    sensor_data: `
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        value REAL NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (sensor_id) REFERENCES sensors (sensor_id)
      )
    `,
    
    // Table pour les alertes
    alerts: `
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        sensor_id TEXT,
        alert_type TEXT NOT NULL,
        message TEXT NOT NULL,
        value REAL,
        acknowledged INTEGER DEFAULT 0,
        FOREIGN KEY (sensor_id) REFERENCES sensors (sensor_id)
      )
    `,
    
    // Table pour la configuration du monitoring
    monitoring_config: `
      CREATE TABLE IF NOT EXISTS monitoring_config (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        alert_channel TEXT,
        metrics_interval INTEGER DEFAULT 60000,
        data_retention_days INTEGER DEFAULT 30,
        notification_level TEXT DEFAULT 'warning'
      )
    `,
    
    // Table pour l'état des serveurs
    server_status: `
      CREATE TABLE IF NOT EXISTS server_status (
        guild_id TEXT PRIMARY KEY,
        last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
        member_count INTEGER NOT NULL,
        online_count INTEGER NOT NULL,
        bot_commands_used INTEGER DEFAULT 0,
        bot_errors INTEGER DEFAULT 0,
        status TEXT DEFAULT 'normal'
      )
    `,
    
    // Table pour les statistiques d'utilisation quotidiennes
    daily_stats: `
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        commands_used INTEGER DEFAULT 0,
        active_users INTEGER DEFAULT 0,
        new_tickets INTEGER DEFAULT 0,
        economy_transactions INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        UNIQUE(date, guild_id)
      )
    `
  };
  
  // Requêtes préparées pour l'insertion de données
  export const MONITORING_QUERIES = {
    insertBotMetrics: `
      INSERT INTO bot_metrics 
      (uptime, memory_usage, cpu_usage, connected_servers, active_users, command_count, latency)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    
    insertCommandUsage: `
      INSERT INTO command_usage 
      (command_name, user_id, guild_id, execution_time)
      VALUES (?, ?, ?, ?)
    `,
    
    insertErrorLog: `
      INSERT INTO error_logs 
      (error_type, error_message, error_stack, command_name, user_id, guild_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    
    insertSensorData: `
      INSERT INTO sensor_data 
      (sensor_id, value, status)
      VALUES (?, ?, ?)
    `,
    
    insertAlert: `
      INSERT INTO alerts 
      (sensor_id, alert_type, message, value)
      VALUES (?, ?, ?, ?)
    `,
    
    updateSensorStatus: `
      UPDATE sensors
      SET last_check = CURRENT_TIMESTAMP, last_status = ?
      WHERE sensor_id = ?
    `,
    
    updateServerStatus: `
      INSERT OR REPLACE INTO server_status 
      (guild_id, last_check, member_count, online_count, status)
      VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)
    `,
    
    updateDailyStats: `
      INSERT INTO daily_stats 
      (date, guild_id, commands_used, active_users, new_tickets, economy_transactions, errors_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, guild_id) DO UPDATE SET
      commands_used = commands_used + excluded.commands_used,
      active_users = CASE WHEN active_users < excluded.active_users THEN excluded.active_users ELSE active_users END,
      new_tickets = new_tickets + excluded.new_tickets,
      economy_transactions = economy_transactions + excluded.economy_transactions,
      errors_count = errors_count + excluded.errors_count
    `
  };
  
  // Requêtes pour obtenir des statistiques
  export const MONITORING_STATS_QUERIES = {
    getBotMetricsLastHour: `
      SELECT * FROM bot_metrics
      WHERE timestamp > datetime('now', '-1 hour')
      ORDER BY timestamp ASC
    `,
    
    getTopCommandsToday: `
      SELECT command_name, COUNT(*) as usage_count
      FROM command_usage
      WHERE timestamp > datetime('now', 'start of day')
      GROUP BY command_name
      ORDER BY usage_count DESC
      LIMIT 10
    `,
    
    getMostActiveUsers: `
      SELECT user_id, COUNT(*) as command_count
      FROM command_usage
      WHERE timestamp > datetime('now', '-7 day')
      GROUP BY user_id
      ORDER BY command_count DESC
      LIMIT 10
    `,
    
    getErrorCountByType: `
      SELECT error_type, COUNT(*) as error_count
      FROM error_logs
      WHERE timestamp > datetime('now', '-7 day')
      GROUP BY error_type
      ORDER BY error_count DESC
    `,
    
    getSensorHistory: `
      SELECT timestamp, value, status
      FROM sensor_data
      WHERE sensor_id = ?
      AND timestamp > datetime('now', ?)
      ORDER BY timestamp ASC
    `,
    
    getActiveAlerts: `
      SELECT * FROM alerts
      WHERE acknowledged = 0
      ORDER BY timestamp DESC
    `,
    
    getDailyStatsLast30Days: `
      SELECT date, SUM(commands_used) as total_commands,
      SUM(active_users) as total_active_users,
      SUM(new_tickets) as total_tickets,
      SUM(economy_transactions) as total_transactions,
      SUM(errors_count) as total_errors
      FROM daily_stats
      WHERE date >= date('now', '-30 day')
      GROUP BY date
      ORDER BY date ASC
    `,
    
    getServerHealthOverview: `
      SELECT guild_id, member_count, online_count, status,
      (julianday('now') - julianday(last_check)) * 24 * 60 as minutes_since_update
      FROM server_status
      ORDER BY last_check DESC
    `
  };
  
  // Requêtes de maintenance
  export const MONITORING_MAINTENANCE_QUERIES = {
    cleanOldData: `
      DELETE FROM bot_metrics
      WHERE timestamp < datetime('now', ? || ' days')
    `,
    
    cleanOldSensorData: `
      DELETE FROM sensor_data
      WHERE timestamp < datetime('now', ? || ' days')
    `,
    
    cleanOldCommandUsage: `
      DELETE FROM command_usage
      WHERE timestamp < datetime('now', ? || ' days')
    `,
    
    cleanOldErrorLogs: `
      DELETE FROM error_logs
      WHERE timestamp < datetime('now', ? || ' days')
    `
  };