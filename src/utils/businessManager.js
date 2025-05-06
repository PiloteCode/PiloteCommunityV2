/**
 * Gestionnaire des entreprises - Fournit des fonctionnalités pour créer, gérer et interagir avec les entreprises
 */

export class BusinessManager {
  constructor(client) {
    this.client = client;
    this.db = client.db.db;
  }

  /**
   * Initialise les tables nécessaires pour le système d'entreprise
   */
  async initialize() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        type TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        balance INTEGER DEFAULT 0,
        xp INTEGER DEFAULT 0,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_production TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS business_members (
        business_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (business_id, user_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS business_assets (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        quantity INTEGER DEFAULT 1,
        production_rate INTEGER DEFAULT 0,
        maintenance_cost INTEGER DEFAULT 0,
        last_maintenance TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS business_employees (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        salary INTEGER DEFAULT 0,
        productivity INTEGER DEFAULT 100,
        hired_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_paid TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS business_inventory (
        business_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (business_id, item_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );
    `);
    
    return true;
  }

  /**
   * Obtient les informations d'une entreprise
   */
  async getBusiness(businessId) {
    const business = await this.db.get(`
      SELECT * FROM businesses WHERE id = ?
    `, businessId);
    
    return business;
  }

  /**
   * Vérifie si un utilisateur a les permissions pour une action spécifique
   */
  async checkBusinessPermission(userId, businessId, permission) {
    // Liste des permissions par rôle
    const rolePermissions = {
      'OWNER': [
        'MANAGE_BUSINESS', 'MANAGE_ASSETS', 'MANAGE_EMPLOYEES',
        'MANAGE_MEMBERS', 'MANAGE_FINANCES', 'MANAGE_INVENTORY',
        'MANAGE_PRODUCTION', 'MANAGE_RESEARCH', 'MANAGE_TRADING',
        'VIEW_FINANCES', 'VIEW_EMPLOYEES', 'VIEW_INVENTORY',
        'VIEW_PRODUCTION', 'VIEW_RESEARCH'
      ],
      'MANAGER': [
        'MANAGE_ASSETS', 'MANAGE_EMPLOYEES', 'MANAGE_INVENTORY',
        'MANAGE_PRODUCTION', 'VIEW_FINANCES', 'VIEW_EMPLOYEES',
        'VIEW_INVENTORY', 'VIEW_PRODUCTION', 'VIEW_RESEARCH'
      ],
      'EMPLOYEE': [
        'VIEW_INVENTORY', 'VIEW_PRODUCTION'
      ]
    };
    
    // Obtenir le rôle de l'utilisateur dans l'entreprise
    const member = await this.db.get(`
      SELECT role FROM business_members
      WHERE business_id = ? AND user_id = ?
    `, businessId, userId);
    
    // Si l'utilisateur n'est pas membre de l'entreprise
    if (!member) {
      // Vérifier si c'est le propriétaire principal (cas spécial)
      const business = await this.getBusiness(businessId);
      if (business && business.owner_id === userId) {
        return true; // Le propriétaire principal a toutes les permissions
      }
      return false;
    }
    
    // Vérifier si le rôle possède la permission demandée
    return rolePermissions[member.role]?.includes(permission) || false;
  }

  /**
   * Obtient la liste des propriétaires d'une entreprise
   */
  async getBusinessOwners(businessId) {
    // Obtenir l'ID du propriétaire principal
    const business = await this.getBusiness(businessId);
    if (!business) return [];
    
    // Obtenir tous les membres avec le rôle OWNER
    const owners = await this.db.all(`
      SELECT user_id FROM business_members
      WHERE business_id = ? AND role = 'OWNER'
    `, businessId);
    
    // Combiner et dédupliquer
    const ownerIds = new Set([business.owner_id, ...owners.map(o => o.user_id)]);
    return [...ownerIds];
  }

  /**
   * Calcule la production d'une entreprise
   */
  async calculateBusinessProduction(businessId) {
    const business = await this.getBusiness(businessId);
    if (!business) return { success: false, message: "Entreprise non trouvée" };
    
    // Obtenir tous les actifs productifs
    const assets = await this.db.all(`
      SELECT * FROM business_assets
      WHERE business_id = ? AND production_rate > 0
    `, businessId);
    
    // Obtenir tous les employés
    const employees = await this.db.all(`
      SELECT * FROM business_employees
      WHERE business_id = ?
    `, businessId);
    
    // Calculer la production de base
    let baseProduction = 0;
    for (const asset of assets) {
      baseProduction += asset.production_rate * asset.quantity * asset.level;
    }
    
    // Appliquer le bonus de productivité des employés
    const employeeProductivity = employees.reduce((sum, emp) => sum + emp.productivity, 0) / 100;
    const employeeBonus = 1 + (Math.min(employeeProductivity * 0.01, 0.5));
    
    // Appliquer le bonus de niveau de l'entreprise
    const levelBonus = 1 + ((business.level - 1) * 0.05);
    
    // Production totale
    let totalProduction = Math.floor(baseProduction * employeeBonus * levelBonus);
    
    // Appliquer les modificateurs économiques si le système existe
    if (this.client.economicEventSystem) {
      totalProduction = this.client.economicEventSystem.applyEconomicFactors(business, totalProduction);
    }
    
    return {
      success: true,
      baseProduction,
      totalProduction,
      employeeBonus,
      levelBonus,
      lastProduction: business.last_production
    };
  }

  /**
   * Calcule les coûts de maintenance d'une entreprise
   */
  async calculateMaintenanceCosts(businessId) {
    const business = await this.getBusiness(businessId);
    if (!business) return { success: false, message: "Entreprise non trouvée" };
    
    // Obtenir tous les actifs
    const assets = await this.db.all(`
      SELECT * FROM business_assets
      WHERE business_id = ?
    `, businessId);
    
    // Obtenir tous les employés
    const employees = await this.db.all(`
      SELECT * FROM business_employees
      WHERE business_id = ?
    `, businessId);
    
    // Calculer les coûts de maintenance des actifs
    let assetMaintenanceCost = 0;
    for (const asset of assets) {
      assetMaintenanceCost += asset.maintenance_cost * asset.quantity;
    }
    
    // Calculer les salaires des employés
    const employeeSalaries = employees.reduce((sum, emp) => sum + emp.salary, 0);
    
    // Coûts totaux
    let totalCosts = assetMaintenanceCost + employeeSalaries;
    
    // Appliquer les modificateurs économiques si le système existe
    if (this.client.economicEventSystem) {
      totalCosts = this.client.economicEventSystem.applyMaintenanceCostFactors(business, totalCosts);
    }
    
    return {
      success: true,
      assetMaintenanceCost,
      employeeSalaries,
      totalCosts
    };
  }
}