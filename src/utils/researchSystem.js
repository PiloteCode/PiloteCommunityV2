/**
 * Système de recherche et développement pour les entreprises
 */

export class ResearchSystem {
  constructor(client) {
    this.client = client;
    this.researchTrees = this.defineResearchTrees();
    this.activeResearches = new Map(); // Map des recherches en cours par entreprise
    this.completedResearches = new Map(); // Map des recherches terminées par entreprise
  }

  /**
   * Initialise le système de recherche
   */
  async initialize() {
    try {
      // Créer les tables si elles n'existent pas
      await this.createResearchTables();
      
      // Charger les recherches en cours depuis la base de données
      await this.loadActiveResearches();
      
      // Charger les recherches terminées depuis la base de données
      await this.loadCompletedResearches();
      
      console.log('Research System initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Research System:', error);
      return false;
    }
  }

  /**
   * Crée les tables nécessaires pour le système de recherche
   */
  async createResearchTables() {
    try {
      // Table des recherches actives
      await this.client.db.db.exec(`
        CREATE TABLE IF NOT EXISTS business_researches (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          research_id TEXT NOT NULL,
          start_time TEXT NOT NULL,
          completion_time TEXT NOT NULL,
          level INTEGER DEFAULT 1,
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        )
      `);
      
      // Table des recherches terminées
      await this.client.db.db.exec(`
        CREATE TABLE IF NOT EXISTS business_completed_researches (
          business_id TEXT NOT NULL,
          research_id TEXT NOT NULL,
          level INTEGER NOT NULL,
          completion_time TEXT NOT NULL,
          PRIMARY KEY (business_id, research_id),
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        )
      `);
      
      return true;
    } catch (error) {
      console.error('Error creating research tables:', error);
      throw error;
    }
  }

  /**
   * Charge les recherches actives depuis la base de données
   */
  async loadActiveResearches() {
    try {
      const activeResearches = await this.client.db.db.all(`
        SELECT * FROM business_researches
      `);
      
      for (const research of activeResearches) {
        if (!this.activeResearches.has(research.business_id)) {
          this.activeResearches.set(research.business_id, []);
        }
        
        this.activeResearches.get(research.business_id).push({
          id: research.id,
          researchId: research.research_id,
          startTime: new Date(research.start_time),
          completionTime: new Date(research.completion_time),
          level: research.level
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error loading active researches:', error);
      return false;
    }
  }

  /**
   * Charge les recherches terminées depuis la base de données
   */
  async loadCompletedResearches() {
    try {
      const completedResearches = await this.client.db.db.all(`
        SELECT * FROM business_completed_researches
      `);
      
      for (const research of completedResearches) {
        if (!this.completedResearches.has(research.business_id)) {
          this.completedResearches.set(research.business_id, new Map());
        }
        
        this.completedResearches.get(research.business_id).set(research.research_id, {
          level: research.level,
          completionTime: new Date(research.completion_time)
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error loading completed researches:', error);
      return false;
    }
  }

  /**
   * Définit les arbres de recherche pour chaque type d'entreprise
   */
  defineResearchTrees() {
    return {
      // Entreprise technologique
      tech_company: {
        // Recherches de base disponibles dès le début
        'automation': {
          name: 'Automatisation',
          description: 'Automatise certains processus de production pour augmenter l\'efficacité.',
          baseCost: 5000,
          baseTime: 12, // heures
          maxLevel: 5,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.1) // +10% de production par niveau
          }),
          prerequisites: []
        },
        'quality_control': {
          name: 'Contrôle qualité',
          description: 'Améliore la qualité des produits, réduisant les coûts de maintenance.',
          baseCost: 3000,
          baseTime: 8,
          maxLevel: 5,
          effects: level => ({
            maintenanceCostMultiplier: 1 - (level * 0.05) // -5% de coûts de maintenance par niveau
          }),
          prerequisites: []
        },
        // Recherches avancées nécessitant des prérequis
        'ai_development': {
          name: 'Développement IA',
          description: 'Intègre l\'intelligence artificielle pour optimiser les opérations.',
          baseCost: 15000,
          baseTime: 36,
          maxLevel: 3,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.15),
            maintenanceCostMultiplier: 1 - (level * 0.03)
          }),
          prerequisites: [
            { id: 'automation', level: 3 }
          ]
        },
        'cloud_computing': {
          name: 'Cloud Computing',
          description: 'Migre les systèmes vers le cloud pour une meilleure évolutivité.',
          baseCost: 12000,
          baseTime: 24,
          maxLevel: 3,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.12)
          }),
          prerequisites: [
            { id: 'automation', level: 2 }
          ]
        }
      },
      
      // Restaurant
      restaurant: {
        'menu_optimization': {
          name: 'Optimisation du menu',
          description: 'Analyse les plats les plus rentables et optimise le menu.',
          baseCost: 2000,
          baseTime: 6,
          maxLevel: 5,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.08)
          }),
          prerequisites: []
        },
        'kitchen_efficiency': {
          name: 'Efficacité en cuisine',
          description: 'Améliore les procédures en cuisine pour réduire les coûts.',
          baseCost: 3000,
          baseTime: 10,
          maxLevel: 5,
          effects: level => ({
            maintenanceCostMultiplier: 1 - (level * 0.05)
          }),
          prerequisites: []
        },
        'gourmet_techniques': {
          name: 'Techniques gastronomiques',
          description: 'Intègre des techniques de cuisine haut de gamme pour attirer une clientèle premium.',
          baseCost: 8000,
          baseTime: 18,
          maxLevel: 3,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.2)
          }),
          prerequisites: [
            { id: 'menu_optimization', level: 3 },
            { id: 'kitchen_efficiency', level: 2 }
          ]
        }
      },
      
      // Usine
      factory: {
        'assembly_line': {
          name: 'Chaîne de montage',
          description: 'Optimise la chaîne de montage pour une production plus rapide.',
          baseCost: 8000,
          baseTime: 16,
          maxLevel: 5,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.12)
          }),
          prerequisites: []
        },
        'quality_assurance': {
          name: 'Assurance qualité',
          description: 'Implémente des processus stricts de contrôle qualité.',
          baseCost: 5000,
          baseTime: 12,
          maxLevel: 5,
          effects: level => ({
            maintenanceCostMultiplier: 1 - (level * 0.04)
          }),
          prerequisites: []
        },
        'robotic_automation': {
          name: 'Automatisation robotique',
          description: 'Introduit des robots industriels dans la production.',
          baseCost: 20000,
          baseTime: 48,
          maxLevel: 3,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.25),
            maintenanceCostMultiplier: 1 + (level * 0.05) // Augmentation des coûts de maintenance
          }),
          prerequisites: [
            { id: 'assembly_line', level: 4 }
          ]
        }
      },
      
      // Ferme
      farm: {
        'crop_rotation': {
          name: 'Rotation des cultures',
          description: 'Implémente un système de rotation des cultures pour optimiser les rendements.',
          baseCost: 2500,
          baseTime: 10,
          maxLevel: 5,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.08)
          }),
          prerequisites: []
        },
        'irrigation_systems': {
          name: 'Systèmes d\'irrigation',
          description: 'Améliore les systèmes d\'irrigation pour réduire les coûts en eau.',
          baseCost: 3500,
          baseTime: 14,
          maxLevel: 5,
          effects: level => ({
            maintenanceCostMultiplier: 1 - (level * 0.05)
          }),
          prerequisites: []
        },
        'gmo_crops': {
          name: 'Cultures OGM',
          description: 'Développe des cultures génétiquement modifiées pour des rendements exceptionnels.',
          baseCost: 12000,
          baseTime: 36,
          maxLevel: 3,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.2)
          }),
          prerequisites: [
            { id: 'crop_rotation', level: 3 }
          ]
        }
      },
      
      // Entreprise minière
      mining_company: {
        'drilling_techniques': {
          name: 'Techniques de forage',
          description: 'Améliore les techniques de forage pour extraire plus efficacement.',
          baseCost: 7000,
          baseTime: 18,
          maxLevel: 5,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.1)
          }),
          prerequisites: []
        },
        'safety_protocols': {
          name: 'Protocoles de sécurité',
          description: 'Renforce les protocoles de sécurité pour réduire les incidents coûteux.',
          baseCost: 5000,
          baseTime: 12,
          maxLevel: 5,
          effects: level => ({
            maintenanceCostMultiplier: 1 - (level * 0.05)
          }),
          prerequisites: []
        },
        'advanced_mineral_detection': {
          name: 'Détection minérale avancée',
          description: 'Utilise des technologies avancées pour détecter les gisements de haute qualité.',
          baseCost: 18000,
          baseTime: 48,
          maxLevel: 3,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.25)
          }),
          prerequisites: [
            { id: 'drilling_techniques', level: 3 }
          ]
        }
      },
      
      // Hôtel
      hotel: {
        'customer_service': {
          name: 'Service clientèle',
          description: 'Améliore la formation du personnel pour un meilleur service.',
          baseCost: 4000,
          baseTime: 12,
          maxLevel: 5,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.09)
          }),
          prerequisites: []
        },
        'energy_efficiency': {
          name: 'Efficacité énergétique',
          description: 'Implémente des solutions d\'économie d\'énergie.',
          baseCost: 6000,
          baseTime: 14,
          maxLevel: 5,
          effects: level => ({
            maintenanceCostMultiplier: 1 - (level * 0.06)
          }),
          prerequisites: []
        },
        'luxury_amenities': {
          name: 'Équipements de luxe',
          description: 'Ajoute des équipements premium pour attirer une clientèle haut de gamme.',
          baseCost: 15000,
          baseTime: 36,
          maxLevel: 3,
          effects: level => ({
            productionMultiplier: 1 + (level * 0.2),
            maintenanceCostMultiplier: 1 + (level * 0.02) // Légère augmentation des coûts
          }),
          prerequisites: [
            { id: 'customer_service', level: 4 }
          ]
        }
      }
    };
  }

  /**
   * Récupère l'arbre de recherche pour un type d'entreprise
   */
  getResearchTree(businessType) {
    // Si le type d'entreprise n'a pas d'arbre spécifique, utiliser un arbre générique
    return this.researchTrees[businessType] || this.researchTrees.tech_company;
  }

  /**
   * Calcule le coût et le temps d'une recherche en fonction du niveau
   */
  calculateResearchDetails(research, level) {
    // Coût qui augmente exponentiellement avec le niveau
    const cost = Math.floor(research.baseCost * Math.pow(1.5, level - 1));
    
    // Temps qui augmente linéairement avec le niveau
    const time = research.baseTime * (1 + (level - 1) * 0.5); // +50% par niveau
    
    return {
      cost,
      timeHours: time
    };
  }

  /**
   * Vérifie si les prérequis d'une recherche sont satisfaits
   */
  async checkPrerequisites(businessId, researchInfo) {
    // Si pas de prérequis, toujours vrai
    if (!researchInfo.prerequisites || researchInfo.prerequisites.length === 0) {
      return true;
    }
    
    // Récupérer les recherches terminées pour cette entreprise
    let completedResearches = this.completedResearches.get(businessId);
    if (!completedResearches) {
      // Charger depuis la base de données si pas en mémoire
      completedResearches = new Map();
      
      const dbCompletedResearches = await this.client.db.db.all(`
        SELECT research_id, level FROM business_completed_researches
        WHERE business_id = ?
      `, businessId);
      
      for (const research of dbCompletedResearches) {
        completedResearches.set(research.research_id, {
          level: research.level
        });
      }
      
      this.completedResearches.set(businessId, completedResearches);
    }
    
    // Vérifier que tous les prérequis sont satisfaits
    for (const prereq of researchInfo.prerequisites) {
      const completedResearch = completedResearches.get(prereq.id);
      if (!completedResearch || completedResearch.level < prereq.level) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Démarre une nouvelle recherche
   */
  async startResearch(businessId, researchId, level = 1) {
    try {
      // Vérifier si l'entreprise existe
      const business = await this.client.db.db.get(`
        SELECT * FROM businesses WHERE id = ?
      `, businessId);
      
      if (!business) {
        return { success: false, message: "Entreprise non trouvée" };
      }
      
      // Vérifier si la recherche existe pour ce type d'entreprise
      const researchTree = this.getResearchTree(business.type);
      const researchInfo = researchTree[researchId];
      
      if (!researchInfo) {
        return { success: false, message: "Recherche non disponible pour ce type d'entreprise" };
      }
      
      // Vérifier si le niveau demandé est valide
      if (level < 1 || level > researchInfo.maxLevel) {
        return { success: false, message: `Niveau invalide. Min: 1, Max: ${researchInfo.maxLevel}` };
      }
      
      // Vérifier si l'entreprise a déjà cette recherche en cours
      const activeResearches = this.activeResearches.get(businessId) || [];
      if (activeResearches.some(r => r.researchId === researchId)) {
        return { success: false, message: "Cette recherche est déjà en cours" };
      }
      
      // Vérifier si l'entreprise a déjà cette recherche au niveau demandé ou supérieur
      const completedResearchesMap = this.completedResearches.get(businessId) || new Map();
      const completedResearch = completedResearchesMap.get(researchId);
      
      if (completedResearch && completedResearch.level >= level) {
        return { success: false, message: `Cette recherche est déjà complétée au niveau ${completedResearch.level}` };
      }
      
      // Vérifier le niveau précédent
      if (level > 1 && (!completedResearch || completedResearch.level < level - 1)) {
        return { success: false, message: `Vous devez d'abord compléter le niveau ${level - 1}` };
      }
      
      // Vérifier les prérequis
      const prerequisitesMet = await this.checkPrerequisites(businessId, researchInfo);
      if (!prerequisitesMet) {
        return { success: false, message: "Prérequis non satisfaits pour cette recherche" };
      }
      
      // Calculer le coût et le temps
      const { cost, timeHours } = this.calculateResearchDetails(researchInfo, level);
      
      // Vérifier si l'entreprise a assez de fonds
      if (business.balance < cost) {
        return { success: false, message: `Fonds insuffisants. Coût: ${cost}€, Solde: ${business.balance}€` };
      }
      
      // Déduire le coût
      await this.client.db.db.run(`
        UPDATE businesses
        SET balance = balance - ?
        WHERE id = ?
      `, cost, businessId);
      
      // Calculer le temps de fin
      const startTime = new Date();
      const completionTime = new Date(startTime.getTime() + (timeHours * 60 * 60 * 1000));
      
      // Générer un ID unique pour cette recherche
      const researchInstanceId = `${businessId}_${researchId}_${Date.now()}`;
      
      // Enregistrer la recherche en cours
      await this.client.db.db.run(`
        INSERT INTO business_researches
        (id, business_id, research_id, start_time, completion_time, level)
        VALUES (?, ?, ?, ?, ?, ?)
      `, researchInstanceId, businessId, researchId, startTime.toISOString(), completionTime.toISOString(), level);
      
      // Ajouter à la mémoire
      if (!this.activeResearches.has(businessId)) {
        this.activeResearches.set(businessId, []);
      }
      
      this.activeResearches.get(businessId).push({
        id: researchInstanceId,
        researchId,
        startTime,
        completionTime,
        level
      });
      
      return {
        success: true,
        researchId,
        name: researchInfo.name,
        level,
        cost,
        timeHours,
        startTime,
        completionTime
      };
    } catch (error) {
      console.error('Error starting research:', error);
      return { success: false, message: "Une erreur est survenue lors du démarrage de la recherche" };
    }
  }

  /**
   * Vérifie et finalise les recherches terminées
   */
  async checkCompletedResearches(businessId) {
    try {
      const now = new Date();
      const completedResearches = [];
      
      // Récupérer les recherches actives de l'entreprise
      const activeResearches = this.activeResearches.get(businessId) || [];
      const completedResearchIds = [];
      
      for (const research of activeResearches) {
        if (research.completionTime <= now) {
          // Cette recherche est terminée
          completedResearchIds.push(research.id);
          
          // Ajouter aux recherches terminées en mémoire
          if (!this.completedResearches.has(businessId)) {
            this.completedResearches.set(businessId, new Map());
          }
          
          const businessCompletedResearches = this.completedResearches.get(businessId);
          const researchTree = await this.getResearchTreeForBusiness(businessId);
          const researchInfo = researchTree[research.researchId];
          
          // Mettre à jour le niveau terminé
          businessCompletedResearches.set(research.researchId, {
            level: research.level,
            completionTime: research.completionTime
          });
          
          completedResearches.push({
            researchId: research.researchId,
            name: researchInfo ? researchInfo.name : research.researchId,
            level: research.level,
            completionTime: research.completionTime
          });
        }
      }
      
      if (completedResearchIds.length > 0) {
        // Mise à jour de la base de données pour les recherches terminées
        for (const researchId of completedResearchIds) {
          const research = activeResearches.find(r => r.id === researchId);
          
          // Ajouter à la table des recherches complétées
          await this.client.db.db.run(`
            INSERT OR REPLACE INTO business_completed_researches
            (business_id, research_id, level, completion_time)
            VALUES (?, ?, ?, ?)
          `, businessId, research.researchId, research.level, research.completionTime.toISOString());
          
          // Supprimer de la table des recherches actives
          await this.client.db.db.run(`
            DELETE FROM business_researches
            WHERE id = ?
          `, researchId);
        }
        
        // Mettre à jour la liste en mémoire
        this.activeResearches.set(
          businessId,
          activeResearches.filter(r => !completedResearchIds.includes(r.id))
        );
      }
      
      return {
        success: true,
        completedCount: completedResearches.length,
        completedResearches
      };
    } catch (error) {
      console.error('Error checking completed researches:', error);
      return { success: false, message: "Une erreur est survenue lors de la vérification des recherches" };
    }
  }

  /**
   * Obtient l'arbre de recherche pour une entreprise spécifique
   */
  async getResearchTreeForBusiness(businessId) {
    try {
      const business = await this.client.db.db.get(`
        SELECT type FROM businesses WHERE id = ?
      `, businessId);
      
      if (!business) {
        return null;
      }
      
      return this.getResearchTree(business.type);
    } catch (error) {
      console.error('Error getting research tree for business:', error);
      return null;
    }
  }

  /**
   * Obtient les recherches disponibles pour une entreprise
   */
  async getAvailableResearches(businessId) {
    try {
      // Récupérer l'arbre de recherche
      const researchTree = await this.getResearchTreeForBusiness(businessId);
      if (!researchTree) {
        return { success: false, message: "Entreprise non trouvée" };
      }
      
      // Récupérer les recherches déjà complétées
      const completedResearchesMap = this.completedResearches.get(businessId) || new Map();
      
      // Récupérer les recherches en cours
      const activeResearches = this.activeResearches.get(businessId) || [];
      const activeResearchIds = activeResearches.map(r => r.researchId);
      
      // Construire la liste des recherches disponibles
      const availableResearches = [];
      const lockedResearches = [];
      
      for (const [researchId, researchInfo] of Object.entries(researchTree)) {
        // Vérifier si la recherche est déjà en cours
        if (activeResearchIds.includes(researchId)) {
          continue;
        }
        
        // Récupérer le niveau actuel
        const completedResearch = completedResearchesMap.get(researchId);
        const currentLevel = completedResearch ? completedResearch.level : 0;
        
        // Vérifier si la recherche est déjà au niveau maximum
        if (currentLevel >= researchInfo.maxLevel) {
          continue;
        }
        
        // Vérifier les prérequis
        const nextLevel = currentLevel + 1;
        const prerequisitesMet = await this.checkPrerequisites(businessId, researchInfo);
        
        const { cost, timeHours } = this.calculateResearchDetails(researchInfo, nextLevel);
        
        const researchData = {
          id: researchId,
          name: researchInfo.name,
          description: researchInfo.description,
          level: nextLevel,
          maxLevel: researchInfo.maxLevel,
          cost,
          timeHours,
          prerequisites: researchInfo.prerequisites || []
        };
        
        if (prerequisitesMet) {
          availableResearches.push(researchData);
        } else {
          lockedResearches.push(researchData);
        }
      }
      
      return {
        success: true,
        availableResearches,
        lockedResearches,
        activeResearches
      };
    } catch (error) {
      console.error('Error getting available researches:', error);
      return { success: false, message: "Une erreur est survenue lors de la récupération des recherches" };
    }
  }

  /**
   * Obtient les recherches terminées pour une entreprise
   */
  async getCompletedResearches(businessId) {
    try {
      // Récupérer l'arbre de recherche
      const researchTree = await this.getResearchTreeForBusiness(businessId);
      if (!researchTree) {
        return { success: false, message: "Entreprise non trouvée" };
      }
      
      // Récupérer les recherches complétées
      let completedResearchesMap = this.completedResearches.get(businessId);
      
      if (!completedResearchesMap) {
        // Charger depuis la base de données si pas en mémoire
        completedResearchesMap = new Map();
        
        const dbCompletedResearches = await this.client.db.db.all(`
          SELECT research_id, level, completion_time FROM business_completed_researches
          WHERE business_id = ?
        `, businessId);
        
        for (const research of dbCompletedResearches) {
          completedResearchesMap.set(research.research_id, {
            level: research.level,
            completionTime: new Date(research.completion_time)
          });
        }
        
        this.completedResearches.set(businessId, completedResearchesMap);
      }
      
      // Construire la liste des recherches terminées
      const completedResearches = [];
      
      for (const [researchId, info] of completedResearchesMap.entries()) {
        const researchInfo = researchTree[researchId];
        if (researchInfo) {
          completedResearches.push({
            id: researchId,
            name: researchInfo.name,
            description: researchInfo.description,
            level: info.level,
            maxLevel: researchInfo.maxLevel,
            completionTime: info.completionTime,
            effects: researchInfo.effects(info.level)
          });
        }
      }
      
      return {
        success: true,
        completedResearches
      };
    } catch (error) {
      console.error('Error getting completed researches:', error);
      return { success: false, message: "Une erreur est survenue lors de la récupération des recherches terminées" };
    }
  }

  /**
   * Récupère toutes les recherches en cours
   */
  async getAllActiveResearches() {
    try {
      // Récupérer toutes les recherches actives de la base de données
      const dbActiveResearches = await this.client.db.db.all(`
        SELECT * FROM business_researches
      `);
      
      // Traiter les résultats
      const nowTime = new Date().getTime();
      const upcomingCompletions = [];
      
      for (const research of dbActiveResearches) {
        const businessId = research.business_id;
        const completionTime = new Date(research.completion_time);
        
        // Vérifier si la recherche est terminée
        if (completionTime.getTime() <= nowTime) {
          // Si terminée, ajouter à la liste des recherches à finaliser
          upcomingCompletions.push({
            businessId,
            researchInstanceId: research.id
          });
        }
      }
      
      return {
        success: true,
        activeResearchCount: dbActiveResearches.length,
        upcomingCompletions
      };
    } catch (error) {
      console.error('Error getting all active researches:', error);
      return { success: false, message: "Une erreur est survenue lors de la récupération des recherches actives" };
    }
  }

  /**
   * Vérifie et finalise les recherches terminées pour toutes les entreprises
   */
  async processCompletedResearches() {
    try {
      // Récupérer toutes les recherches terminées
      const result = await this.getAllActiveResearches();
      
      if (!result.success) {
        return result;
      }
      
      // Traiter les recherches terminées
      let processedCount = 0;
      for (const completion of result.upcomingCompletions) {
        await this.checkCompletedResearches(completion.businessId);
        processedCount++;
      }
      
      return {
        success: true,
        processedCount
      };
    } catch (error) {
      console.error('Error processing completed researches:', error);
      return { success: false, message: "Une erreur est survenue lors du traitement des recherches terminées" };
    }
  }

  /**
   * Calcule les effets de recherche pour une entreprise
   */
  async calculateResearchEffects(businessId) {
    try {
      // Obtenir les recherches terminées
      const result = await this.getCompletedResearches(businessId);
      
      if (!result.success) {
        return { 
          success: false, 
          productionMultiplier: 1.0, 
          maintenanceCostMultiplier: 1.0 
        };
      }
      
      // Calculer les multiplicateurs combinés
      let productionMultiplier = 1.0;
      let maintenanceCostMultiplier = 1.0;
      
      for (const research of result.completedResearches) {
        const effects = research.effects;
        
        if (effects.productionMultiplier) {
          productionMultiplier *= effects.productionMultiplier;
        }
        
        if (effects.maintenanceCostMultiplier) {
          maintenanceCostMultiplier *= effects.maintenanceCostMultiplier;
        }
      }
      
      return {
        success: true,
        productionMultiplier,
        maintenanceCostMultiplier,
        completedResearchCount: result.completedResearches.length
      };
    } catch (error) {
      console.error('Error calculating research effects:', error);
      return { 
        success: false, 
        productionMultiplier: 1.0, 
        maintenanceCostMultiplier: 1.0 
      };
    }
  }

  /**
   * Accélère une recherche en cours moyennant un coût
   */
  async boostResearch(businessId, researchInstanceId) {
    try {
      // Vérifier si la recherche existe et appartient à cette entreprise
      const research = await this.client.db.db.get(`
        SELECT * FROM business_researches
        WHERE id = ? AND business_id = ?
      `, researchInstanceId, businessId);
      
      if (!research) {
        return { success: false, message: "Recherche non trouvée" };
      }
      
      // Calculer le temps restant
      const completionTime = new Date(research.completion_time);
      const now = new Date();
      
      if (completionTime <= now) {
        return { success: false, message: "Cette recherche est déjà terminée" };
      }
      
      const hoursRemaining = (completionTime - now) / (60 * 60 * 1000);
      
      // Calculer le coût du boost (50€ par heure restante)
      const boostCost = Math.ceil(hoursRemaining * 50);
      
      // Vérifier si l'entreprise a assez de fonds
      const business = await this.client.db.db.get(`
        SELECT balance FROM businesses WHERE id = ?
      `, businessId);
      
      if (business.balance < boostCost) {
        return { success: false, message: `Fonds insuffisants. Coût: ${boostCost}€, Solde: ${business.balance}€` };
      }
      
      // Réduire le temps de 30%
      const newCompletionTime = new Date(now.getTime() + (completionTime - now) * 0.7);
      
      // Mettre à jour la base de données
      await this.client.db.db.run(`
        UPDATE business_researches
        SET completion_time = ?
        WHERE id = ?
      `, newCompletionTime.toISOString(), researchInstanceId);
      
      // Déduire le coût
      await this.client.db.db.run(`
        UPDATE businesses
        SET balance = balance - ?
        WHERE id = ?
      `, boostCost, businessId);
      
      // Mettre à jour en mémoire
      const activeResearches = this.activeResearches.get(businessId) || [];
      const researchIndex = activeResearches.findIndex(r => r.id === researchInstanceId);
      
      if (researchIndex !== -1) {
        activeResearches[researchIndex].completionTime = newCompletionTime;
      }
      
      return {
        success: true,
        cost: boostCost,
        oldCompletionTime: completionTime,
        newCompletionTime: newCompletionTime
      };
    } catch (error) {
      console.error('Error boosting research:', error);
      return { success: false, message: "Une erreur est survenue lors de l'accélération de la recherche" };
    }
  }
}