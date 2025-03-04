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
    
    ticket_settings: `
    CREATE TABLE IF NOT EXISTS ticket_settings (
      guild_id TEXT PRIMARY KEY,
      welcome_message TEXT,
      support_team_role TEXT,
      ticket_category TEXT,
      logs_channel TEXT,
      max_tickets INTEGER DEFAULT 5,
      enabled BOOLEAN DEFAULT 1
    )
  `,
  
  ticket_categories: `
    CREATE TABLE IF NOT EXISTS ticket_categories (
      category_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      emoji TEXT,
      button_label TEXT,
      button_style TEXT DEFAULT 'PRIMARY',
      FOREIGN KEY (guild_id) REFERENCES ticket_settings(guild_id)
    )
  `,
  
  tickets: `
    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      category_id TEXT,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      closed_by TEXT,
      transcript TEXT,
      FOREIGN KEY (guild_id) REFERENCES ticket_settings(guild_id),
      FOREIGN KEY (category_id) REFERENCES ticket_categories(category_id)
    )
  `,
  
  ticket_responses: `
    CREATE TABLE IF NOT EXISTS ticket_responses (
      response_id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      response TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      FOREIGN KEY (guild_id) REFERENCES ticket_settings(guild_id)
    )
  `,
  
  ticket_messages: `
    CREATE TABLE IF NOT EXISTS ticket_messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
    )
  `
    
  };
  