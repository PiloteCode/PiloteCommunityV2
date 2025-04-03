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
  };
  