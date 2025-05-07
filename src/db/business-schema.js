/**
 * Schéma de base de données pour le système d'entreprise avancé
 */

export async function createBusinessTables(db) {
  try {
    // Table des entreprises
    await db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        capital INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_collected TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        logo_url TEXT,
        level INTEGER NOT NULL DEFAULT 1,
        description TEXT,
        public BOOLEAN NOT NULL DEFAULT 1,
        auto_collect BOOLEAN NOT NULL DEFAULT 0,
        tax_rate INTEGER NOT NULL DEFAULT 10,
        FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // Table des employés de l'entreprise
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee', -- 'owner', 'manager', 'employee'
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        salary INTEGER NOT NULL DEFAULT 100,
        last_paid TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        productivity INTEGER NOT NULL DEFAULT 100, -- En pourcentage
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(business_id, user_id)
      )
    `);

    // Table des permissions pour les rôles d'entreprise
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        role TEXT NOT NULL, -- 'owner', 'manager', 'employee'
        can_hire BOOLEAN NOT NULL DEFAULT 0,
        can_fire BOOLEAN NOT NULL DEFAULT 0,
        can_collect BOOLEAN NOT NULL DEFAULT 0,
        can_upgrade BOOLEAN NOT NULL DEFAULT 0,
        can_withdraw BOOLEAN NOT NULL DEFAULT 0,
        can_deposit BOOLEAN NOT NULL DEFAULT 0,
        can_change_salary BOOLEAN NOT NULL DEFAULT 0,
        can_change_settings BOOLEAN NOT NULL DEFAULT 0,
        can_view_finances BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        UNIQUE(business_id, role)
      )
    `);

    // Table des actifs de l'entreprise
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        asset_type TEXT NOT NULL, -- 'server', 'farm', 'field', 'mine', 'shop', etc.
        name TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        quantity INTEGER NOT NULL DEFAULT 1,
        base_production INTEGER NOT NULL,
        efficiency INTEGER NOT NULL DEFAULT 100, -- En pourcentage
        last_maintained TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        maintenance_cost INTEGER NOT NULL DEFAULT 0,
        purchase_cost INTEGER NOT NULL DEFAULT 0,
        purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      )
    `);

    // Table des transactions de l'entreprise
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'income', 'expense', 'salary', 'investment', 'upgrade', 'asset_purchase', etc.
        description TEXT NOT NULL,
        executed_by TEXT NOT NULL, -- User ID qui a fait la transaction
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      )
    `);

    // Table des upgrades d'entreprise
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_upgrades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        upgrade_name TEXT NOT NULL,
        upgrade_type TEXT NOT NULL, -- 'production', 'efficiency', 'storage', 'tax_reduction', etc.
        level INTEGER NOT NULL DEFAULT 1,
        base_effect REAL NOT NULL, -- Valeur de base de l'effet (ex: +10% de production)
        purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        cost INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      )
    `);

    // Table des relations inter-entreprises
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        partner_business_id INTEGER NOT NULL,
        relation_type TEXT NOT NULL, -- 'partner', 'supplier', 'customer', 'competitor'
        trade_discount INTEGER NOT NULL DEFAULT 0, -- Réduction sur les transactions en %
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (partner_business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        UNIQUE(business_id, partner_business_id)
      )
    `);

    // Table des produits/services d'entreprise
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        base_price INTEGER NOT NULL,
        production_cost INTEGER NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        max_stock INTEGER NOT NULL DEFAULT 1000,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        image_url TEXT,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      )
    `);

    // Table des ordres (achats/ventes)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        customer_id TEXT NOT NULL, -- Peut être user_id ou business_id (préfixe avec 'b:' pour business)
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES business_products(id) ON DELETE CASCADE
      )
    `);

    // Initialiser les permissions par défaut
    await db.run(`
      INSERT OR IGNORE INTO business_permissions (business_id, role, can_hire, can_fire, can_collect, can_upgrade, can_withdraw, can_deposit, can_change_salary, can_change_settings, can_view_finances)
      SELECT id, 'owner', 1, 1, 1, 1, 1, 1, 1, 1, 1
      FROM businesses
    `);

    await db.run(`
      INSERT OR IGNORE INTO business_permissions (business_id, role, can_hire, can_fire, can_collect, can_upgrade, can_withdraw, can_deposit, can_change_salary, can_change_settings, can_view_finances)
      SELECT id, 'manager', 1, 1, 1, 0, 0, 1, 1, 0, 1
      FROM businesses
    `);

    await db.run(`
      INSERT OR IGNORE INTO business_permissions (business_id, role, can_hire, can_fire, can_collect, can_upgrade, can_withdraw, can_deposit, can_change_salary, can_change_settings, can_view_finances)
      SELECT id, 'employee', 0, 0, 1, 0, 0, 1, 0, 0, 0
      FROM businesses
    `);

    console.log('Tables d\'entreprise créées avec succès');
    return true;
  } catch (error) {
    console.error('Error creating business tables:', error);
    throw error;
  }
}