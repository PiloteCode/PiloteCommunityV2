/**
 * Système de fluctuations économiques et d'événements aléatoires pour dynamiser l'économie
 */

export class EconomicEventSystem {
  constructor(client) {
    this.client = client;
    this.currentEconomicCycle = 'stable'; // 'boom', 'stable', 'recession'
    this.cycleStrength = 1.0; // Multiplicateur pour l'intensité du cycle (0.5 - 1.5)
    this.industryModifiers = {}; // Modificateurs par industrie
    this.activeEvents = []; // Événements actuellement actifs
    this.newsHistory = []; // Historique des annonces économiques
    this.lastCycleChange = Date.now();
    this.cycleDuration = 7 * 24 * 60 * 60 * 1000; // 7 jours par défaut
  }

  /**
   * Initialise le système économique
   */
  async initialize() {
    try {
      // Créer les tables si elles n'existent pas
      await this.createEconomicStateTable();
      
      // Charger l'état économique depuis la base de données s'il existe
      const economicState = await this.client.db.db.get(`
        SELECT * FROM economic_state WHERE id = 1
      `).catch(() => null);

      if (economicState) {
        this.currentEconomicCycle = economicState.cycle;
        this.cycleStrength = economicState.strength;
        this.lastCycleChange = new Date(economicState.last_change).getTime();
        this.industryModifiers = JSON.parse(economicState.industry_modifiers);
        this.activeEvents = JSON.parse(economicState.active_events);
        this.newsHistory = JSON.parse(economicState.news_history);
      } else {
        // Initialiser avec des valeurs par défaut
        this.updateIndustryModifiers();
        await this.saveEconomicState();
      }

      console.log('Economic Event System initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Economic Event System:', error);
      return false;
    }
  }

  /**
   * Crée la table pour stocker l'état économique
   */
  async createEconomicStateTable() {
    try {
      await this.client.db.db.exec(`
        CREATE TABLE IF NOT EXISTS economic_state (
          id INTEGER PRIMARY KEY,
          cycle TEXT NOT NULL,
          strength REAL NOT NULL,
          last_change TEXT NOT NULL,
          industry_modifiers TEXT NOT NULL,
          active_events TEXT NOT NULL,
          news_history TEXT NOT NULL
        )
      `);

      // Initialiser avec des valeurs par défaut si la table est vide
      const count = await this.client.db.db.get(`
        SELECT COUNT(*) as count FROM economic_state
      `);
      
      if (!count || count.count === 0) {
        await this.client.db.db.run(`
          INSERT OR IGNORE INTO economic_state (id, cycle, strength, last_change, industry_modifiers, active_events, news_history)
          VALUES (1, 'stable', 1.0, CURRENT_TIMESTAMP, '{}', '[]', '[]')
        `);
      }

      return true;
    } catch (error) {
      console.error('Error creating economic state table:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde l'état économique actuel dans la base de données
   */
  async saveEconomicState() {
    try {
      await this.client.db.db.run(`
        UPDATE economic_state
        SET cycle = ?, strength = ?, last_change = ?, 
            industry_modifiers = ?, active_events = ?, news_history = ?
        WHERE id = 1
      `, 
      this.currentEconomicCycle,
      this.cycleStrength,
      new Date(this.lastCycleChange).toISOString(),
      JSON.stringify(this.industryModifiers),
      JSON.stringify(this.activeEvents),
      JSON.stringify(this.newsHistory)
      );

      return true;
    } catch (error) {
      console.error('Error saving economic state:', error);
      return false;
    }
  }

  /**
   * Met à jour le cycle économique avec une chance de changement
   */
  async updateEconomicCycle() {
    try {
      // Vérifier si suffisamment de temps s'est écoulé depuis le dernier changement
      const now = Date.now();
      const daysSinceLastChange = (now - this.lastCycleChange) / (24 * 60 * 60 * 1000);
      
      // Plus le temps passe, plus la probabilité de changement augmente
      const changeChance = Math.min(0.05 * daysSinceLastChange, 0.25);
      
      if (Math.random() < changeChance) {
        // Déterminer le nouveau cycle
        const cycles = ['recession', 'stable', 'boom'];
        const currentIndex = cycles.indexOf(this.currentEconomicCycle);
        
        // Tendance à revenir vers la stabilité, ou à changer progressivement
        let newIndex;
        if (currentIndex === 1) { // Si stable
          // 50/50 entre boom et recession
          newIndex = Math.random() < 0.5 ? 0 : 2;
        } else {
          // Si en boom ou recession, tendance à revenir vers stable
          newIndex = Math.random() < 0.7 ? 1 : (currentIndex === 0 ? 2 : 0);
        }
        
        const oldCycle = this.currentEconomicCycle;
        this.currentEconomicCycle = cycles[newIndex];
        this.lastCycleChange = now;
        
        // Ajuster la force du cycle (plus ou moins extrême)
        if (this.currentEconomicCycle === 'stable') {
          this.cycleStrength = 1.0;
        } else {
          this.cycleStrength = 0.8 + (Math.random() * 0.7); // Entre 0.8 et 1.5
        }
        
        // Créer une annonce pour le changement
        const newsItem = {
          type: 'cycle_change',
          title: this.getCycleChangeTitle(oldCycle, this.currentEconomicCycle),
          content: this.getCycleChangeDescription(oldCycle, this.currentEconomicCycle, this.cycleStrength),
          timestamp: now,
          effects: this.getCycleEffects(this.currentEconomicCycle, this.cycleStrength)
        };
        
        this.newsHistory.unshift(newsItem);
        if (this.newsHistory.length > 20) this.newsHistory.pop();
        
        // Mettre à jour les modificateurs d'industrie pour refléter le nouveau cycle
        this.updateIndustryModifiers();
        
        // Enregistrer les changements
        await this.saveEconomicState();
        
        // Annoncer le changement dans le canal d'économie
        this.announceEconomicNews(newsItem);
      }
      
      return this.currentEconomicCycle;
    } catch (error) {
      console.error('Error updating economic cycle:', error);
      return this.currentEconomicCycle;
    }
  }

  /**
   * Met à jour les modificateurs par industrie en fonction du cycle actuel
   */
  updateIndustryModifiers() {
    const baseModifiers = {
      'technology': 1.0,
      'cryptocurrency': 1.0,
      'agriculture': 1.0,
      'industry': 1.0,
      'mining': 1.0,
      'service': 1.0,
      'hospitality': 1.0
    };
    
    // Ajuster selon le cycle économique
    switch (this.currentEconomicCycle) {
      case 'boom':
        // En période de boom, toutes les industries se portent bien, surtout high-tech
        baseModifiers.technology *= 1.2 + (this.cycleStrength - 1) * 0.5;
        baseModifiers.cryptocurrency *= 1.3 + (this.cycleStrength - 1) * 0.7; // Très volatil
        baseModifiers.industry *= 1.15 + (this.cycleStrength - 1) * 0.3;
        baseModifiers.service *= 1.1 + (this.cycleStrength - 1) * 0.2;
        baseModifiers.hospitality *= 1.15 + (this.cycleStrength - 1) * 0.3;
        baseModifiers.mining *= 1.1 + (this.cycleStrength - 1) * 0.2;
        baseModifiers.agriculture *= 1.05 + (this.cycleStrength - 1) * 0.1; // Moins volatile
        break;
        
      case 'recession':
        // En récession, industries de base plus stables
        baseModifiers.technology *= 0.8 - (this.cycleStrength - 1) * 0.3;
        baseModifiers.cryptocurrency *= 0.7 - (this.cycleStrength - 1) * 0.5; // Très impacté
        baseModifiers.industry *= 0.85 - (this.cycleStrength - 1) * 0.2;
        baseModifiers.service *= 0.9 - (this.cycleStrength - 1) * 0.1;
        baseModifiers.hospitality *= 0.8 - (this.cycleStrength - 1) * 0.3; // Fortement impacté
        baseModifiers.mining *= 0.9 - (this.cycleStrength - 1) * 0.1;
        baseModifiers.agriculture *= 0.95 - (this.cycleStrength - 1) * 0.05; // Plus stable
        break;
    }
    
    // Ajouter une petite variation aléatoire pour chaque industrie
    for (const [industry, value] of Object.entries(baseModifiers)) {
      // Variation de ±5%
      const randomFactor = 0.95 + Math.random() * 0.1;
      baseModifiers[industry] = Math.round(value * randomFactor * 100) / 100;
    }
    
    this.industryModifiers = baseModifiers;
  }

  /**
   * Génère un événement économique aléatoire
   */
  async generateRandomEvent() {
    // Probabilité d'événement: 15%
    if (Math.random() > 0.15) return null;
    
    try {
      const events = this.getPossibleEvents();
      const selectedEvent = events[Math.floor(Math.random() * events.length)];
      
      // Vérifier si cet événement n'est pas déjà actif
      if (this.activeEvents.some(e => e.id === selectedEvent.id)) {
        return null;
      }
      
      // Déterminer l'intensité et la durée
      const intensity = 0.8 + Math.random() * 0.6; // Entre 0.8 et 1.4
      const durationDays = selectedEvent.minDuration + 
                          Math.floor(Math.random() * (selectedEvent.maxDuration - selectedEvent.minDuration));
      
      // Ajouter l'événement aux événements actifs
      const eventInstance = {
        id: selectedEvent.id,
        name: selectedEvent.name,
        description: selectedEvent.description,
        affectedIndustries: selectedEvent.affectedIndustries,
        effects: selectedEvent.getEffects(intensity),
        startTime: Date.now(),
        endTime: Date.now() + (durationDays * 24 * 60 * 60 * 1000),
        intensity: intensity
      };
      
      this.activeEvents.push(eventInstance);
      
      // Créer une annonce pour l'événement
      const newsItem = {
        type: 'event',
        title: `🌐 ${selectedEvent.name}`,
        content: `${selectedEvent.description}\n\n${this.formatEventEffects(eventInstance.effects)}`,
        timestamp: Date.now(),
        eventId: selectedEvent.id,
        effects: eventInstance.effects
      };
      
      this.newsHistory.unshift(newsItem);
      if (this.newsHistory.length > 20) this.newsHistory.pop();
      
      // Enregistrer les changements
      await this.saveEconomicState();
      
      // Annoncer l'événement
      this.announceEconomicNews(newsItem);
      
      return eventInstance;
    } catch (error) {
      console.error('Error generating random event:', error);
      return null;
    }
  }

  /**
   * Met à jour les événements actifs, supprime ceux expirés
   */
  async updateActiveEvents() {
    try {
      const now = Date.now();
      const expiredEvents = this.activeEvents.filter(event => event.endTime <= now);
      
      if (expiredEvents.length > 0) {
        // Créer des annonces pour les événements qui se terminent
        for (const event of expiredEvents) {
          const newsItem = {
            type: 'event_end',
            title: `🔚 Fin: ${event.name}`,
            content: `L'événement "${event.name}" est maintenant terminé. Les conditions de marché reviennent progressivement à la normale.`,
            timestamp: now,
            eventId: event.id
          };
          
          this.newsHistory.unshift(newsItem);
          if (this.newsHistory.length > 20) this.newsHistory.pop();
          
          // Annoncer la fin de l'événement
          this.announceEconomicNews(newsItem);
        }
        
        // Supprimer les événements expirés
        this.activeEvents = this.activeEvents.filter(event => event.endTime > now);
        
        // Enregistrer les changements
        await this.saveEconomicState();
      }
      
      return this.activeEvents;
    } catch (error) {
      console.error('Error updating active events:', error);
      return this.activeEvents;
    }
  }

  /**
   * Obtient le modificateur actuel pour une industrie spécifique
   */
  getIndustryModifier(industry) {
    // Récupérer le modificateur de base pour le cycle actuel
    const baseModifier = this.industryModifiers[industry] || 1.0;
    
    // Appliquer les effets des événements actifs
    let eventModifier = 1.0;
    for (const event of this.activeEvents) {
      if (event.effects.industries && event.effects.industries[industry]) {
        eventModifier *= event.effects.industries[industry];
      }
    }
    
    return baseModifier * eventModifier;
  }

  /**
   * Retourne le titre pour un changement de cycle économique
   */
  getCycleChangeTitle(oldCycle, newCycle) {
    if (oldCycle === 'stable' && newCycle === 'boom') {
      return '📈 Boom économique en cours!';
    } else if (oldCycle === 'stable' && newCycle === 'recession') {
      return '📉 Récession économique';
    } else if (oldCycle === 'boom' && newCycle === 'stable') {
      return '🔄 Stabilisation de l\'économie';
    } else if (oldCycle === 'recession' && newCycle === 'stable') {
      return '🔄 Reprise économique';
    } else if (oldCycle === 'boom' && newCycle === 'recession') {
      return '💥 Effondrement économique!';
    } else if (oldCycle === 'recession' && newCycle === 'boom') {
      return '🚀 Reprise économique fulgurante!';
    }
    
    return '🔄 Changement économique';
  }

  /**
   * Retourne une description pour un changement de cycle économique
   */
  getCycleChangeDescription(oldCycle, newCycle, strength) {
    let description = '';
    const strengthDesc = strength > 1.2 ? 'majeur' : 'modéré';
    
    if (oldCycle === 'stable' && newCycle === 'boom') {
      description = `Un boom économique ${strengthDesc} a commencé! Les entreprises connaissent une forte croissance et les opportunités sont nombreuses.`;
    } else if (oldCycle === 'stable' && newCycle === 'recession') {
      description = `Une récession économique ${strengthDesc} a débuté. Les entreprises doivent réduire leurs coûts et s'adapter à des conditions de marché difficiles.`;
    } else if (oldCycle === 'boom' && newCycle === 'stable') {
      description = `Le boom économique prend fin. L'économie retrouve un rythme de croissance normal et stable.`;
    } else if (oldCycle === 'recession' && newCycle === 'stable') {
      description = `La récession est terminée. L'économie se stabilise et les conditions de marché reviennent progressivement à la normale.`;
    } else if (oldCycle === 'boom' && newCycle === 'recession') {
      description = `Après une période d'expansion, l'économie s'effondre brutalement! Les entreprises doivent s'adapter rapidement à cette crise ${strengthDesc}.`;
    } else if (oldCycle === 'recession' && newCycle === 'boom') {
      description = `Après une période difficile, l'économie connaît une reprise exceptionnelle! C'est le moment idéal pour investir et développer votre entreprise.`;
    }
    
    return description;
  }

  /**
   * Retourne les effets d'un cycle économique
   */
  getCycleEffects(cycle, strength) {
    const effects = {
      productionMultiplier: 1.0,
      maintenanceCostMultiplier: 1.0,
      industries: {}
    };
    
    switch (cycle) {
      case 'boom':
        effects.productionMultiplier = 1.15 + (strength - 1) * 0.3;
        effects.maintenanceCostMultiplier = 1.05 + (strength - 1) * 0.1;
        break;
      case 'recession':
        effects.productionMultiplier = 0.85 - (strength - 1) * 0.2;
        effects.maintenanceCostMultiplier = 1.1 + (strength - 1) * 0.2;
        break;
      case 'stable':
      default:
        break;
    }
    
    return effects;
  }

  /**
   * Retourne la liste des événements économiques possibles
   */
  getPossibleEvents() {
    return [
      {
        id: 'tech_boom',
        name: 'Révolution technologique',
        description: 'Une avancée technologique majeure crée une opportunité importante pour les entreprises tech.',
        affectedIndustries: ['technology', 'cryptocurrency'],
        minDuration: 3,
        maxDuration: 7,
        getEffects: (intensity) => ({
          industries: {
            'technology': 1.2 + (intensity - 1) * 0.5,
            'cryptocurrency': 1.15 + (intensity - 1) * 0.4
          }
        })
      },
      {
        id: 'crypto_crash',
        name: 'Effondrement des cryptomonnaies',
        description: 'Un crash majeur affecte le marché des cryptomonnaies, impactant sévèrement les entreprises de ce secteur.',
        affectedIndustries: ['cryptocurrency', 'technology'],
        minDuration: 2,
        maxDuration: 5,
        getEffects: (intensity) => ({
          industries: {
            'cryptocurrency': 0.6 - (intensity - 1) * 0.2,
            'technology': 0.9 - (intensity - 1) * 0.1
          }
        })
      },
      {
        id: 'agricultural_boom',
        name: 'Récolte exceptionnelle',
        description: 'Des conditions climatiques idéales ont permis une récolte record, bénéfique pour le secteur agricole.',
        affectedIndustries: ['agriculture'],
        minDuration: 3,
        maxDuration: 6,
        getEffects: (intensity) => ({
          industries: {
            'agriculture': 1.25 + (intensity - 1) * 0.3
          }
        })
      },
      {
        id: 'drought',
        name: 'Sécheresse',
        description: 'Une sécheresse prolongée affecte négativement le secteur agricole.',
        affectedIndustries: ['agriculture'],
        minDuration: 4,
        maxDuration: 8,
        getEffects: (intensity) => ({
          industries: {
            'agriculture': 0.7 - (intensity - 1) * 0.2
          }
        })
      },
      {
        id: 'tourism_boom',
        name: 'Boom touristique',
        description: 'Une augmentation spectaculaire du tourisme booste l\'industrie hôtelière et les services.',
        affectedIndustries: ['hospitality', 'service'],
        minDuration: 2,
        maxDuration: 5,
        getEffects: (intensity) => ({
          industries: {
            'hospitality': 1.3 + (intensity - 1) * 0.4,
            'service': 1.15 + (intensity - 1) * 0.2
          }
        })
      },
      {
        id: 'global_pandemic',
        name: 'Crise sanitaire',
        description: 'Une crise sanitaire mondiale impacte négativement le tourisme et les services, mais stimule la technologie.',
        affectedIndustries: ['hospitality', 'service', 'technology'],
        minDuration: 5,
        maxDuration: 10,
        getEffects: (intensity) => ({
          industries: {
            'hospitality': 0.6 - (intensity - 1) * 0.2,
            'service': 0.8 - (intensity - 1) * 0.1,
            'technology': 1.2 + (intensity - 1) * 0.2
          }
        })
      },
      {
        id: 'industrial_innovation',
        name: 'Innovation industrielle',
        description: 'De nouvelles techniques de production révolutionnent l\'industrie manufacturière.',
        affectedIndustries: ['industry'],
        minDuration: 4,
        maxDuration: 7,
        getEffects: (intensity) => ({
          industries: {
            'industry': 1.25 + (intensity - 1) * 0.3
          }
        })
      },
      {
        id: 'mining_discovery',
        name: 'Découverte minière',
        description: 'Une importante découverte de ressources minérales booste l\'industrie minière.',
        affectedIndustries: ['mining'],
        minDuration: 3,
        maxDuration: 6,
        getEffects: (intensity) => ({
          industries: {
            'mining': 1.3 + (intensity - 1) * 0.4
          }
        })
      },
      {
        id: 'global_recession',
        name: 'Crise financière mondiale',
        description: 'Une crise financière majeure affecte négativement tous les secteurs de l\'économie.',
        affectedIndustries: ['technology', 'cryptocurrency', 'industry', 'service', 'hospitality', 'mining'],
        minDuration: 5,
        maxDuration: 10,
        getEffects: (intensity) => ({
          industries: {
            'technology': 0.8 - (intensity - 1) * 0.1,
            'cryptocurrency': 0.7 - (intensity - 1) * 0.2,
            'industry': 0.85 - (intensity - 1) * 0.1,
            'service': 0.9 - (intensity - 1) * 0.05,
            'hospitality': 0.8 - (intensity - 1) * 0.1,
            'mining': 0.85 - (intensity - 1) * 0.1
          },
          productionMultiplier: 0.9 - (intensity - 1) * 0.1,
          maintenanceCostMultiplier: 1.1 + (intensity - 1) * 0.1
        })
      },
      {
        id: 'luxury_boom',
        name: 'Boom du luxe',
        description: 'Une augmentation significative de la demande pour les produits et services de luxe.',
        affectedIndustries: ['hospitality', 'service'],
        minDuration: 2,
        maxDuration: 5,
        getEffects: (intensity) => ({
          industries: {
            'hospitality': 1.2 + (intensity - 1) * 0.3,
            'service': 1.15 + (intensity - 1) * 0.25
          }
        })
      }
    ];
  }

  /**
   * Formate les effets d'un événement pour l'affichage
   */
  formatEventEffects(effects) {
    let text = '**Effets:**\n';
    
    // Effets sur les industries
    if (effects.industries) {
      text += '• Secteurs affectés:\n';
      for (const [industry, multiplier] of Object.entries(effects.industries)) {
        const sign = multiplier > 1 ? '📈' : '📉';
        const percentChange = Math.abs(Math.round((multiplier - 1) * 100));
        text += `  - ${this.getIndustryName(industry)}: ${sign} ${percentChange}% ${multiplier > 1 ? 'de productivité' : 'de réduction'}\n`;
      }
    }
    
    // Autres effets globaux
    if (effects.productionMultiplier && effects.productionMultiplier !== 1) {
      const sign = effects.productionMultiplier > 1 ? '📈' : '📉';
      const percentChange = Math.abs(Math.round((effects.productionMultiplier - 1) * 100));
      text += `• Production globale: ${sign} ${percentChange}%\n`;
    }
    
    if (effects.maintenanceCostMultiplier && effects.maintenanceCostMultiplier !== 1) {
      const sign = effects.maintenanceCostMultiplier > 1 ? '📈' : '📉';
      const percentChange = Math.abs(Math.round((effects.maintenanceCostMultiplier - 1) * 100));
      text += `• Coûts de maintenance: ${sign} ${percentChange}%\n`;
    }
    
    return text;
  }

  /**
   * Retourne le nom formaté d'une industrie
   */
  getIndustryName(industryKey) {
    const industryNames = {
      'technology': 'Technologie 💻',
      'cryptocurrency': 'Cryptomonnaie ⛏️',
      'agriculture': 'Agriculture 🚜',
      'industry': 'Industrie 🏭',
      'mining': 'Exploitation minière ⚒️',
      'service': 'Services 👨‍💼',
      'hospitality': 'Hôtellerie 🏨'
    };
    
    return industryNames[industryKey] || industryKey;
  }

  /**
   * Annonce une nouvelle économique dans le canal approprié
   */
  async announceEconomicNews(newsItem) {
    try {
      // Trouver le canal d'annonces économiques
      const announcementChannelId = process.env.ECONOMIC_NEWS_CHANNEL;
      if (!announcementChannelId) {
        console.log('No economic news channel configured');
        return;
      }
      
      const channel = await this.client.channels.fetch(announcementChannelId).catch(err => {
        console.error(`Error fetching channel: ${err}`);
        return null;
      });
      
      if (!channel) {
        console.error(`Channel with ID ${announcementChannelId} not found`);
        return;
      }
      
      // Créer l'embed pour l'annonce
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(newsItem.title)
        .setDescription(newsItem.content)
        .setColor(this.getColorForNewsType(newsItem.type))
        .setTimestamp(new Date(newsItem.timestamp))
        .setFooter({ text: 'Système économique de PiloteCommunity' });
      
      // Envoyer l'annonce
      await channel.send({ embeds: [embed] }).catch(err => {
        console.error(`Error sending message to channel: ${err}`);
      });
    } catch (error) {
      console.error('Error announcing economic news:', error);
    }
  }

  /**
   * Retourne une couleur en fonction du type d'annonce
   */
  getColorForNewsType(type) {
    switch (type) {
      case 'cycle_change':
        return this.currentEconomicCycle === 'boom' ? 0x00FF00 : 
               this.currentEconomicCycle === 'recession' ? 0xFF0000 : 0xFFAA00;
      case 'event':
        return 0x0099FF;
      case 'event_end':
        return 0xAAAAAA;
      default:
        return 0x555555;
    }
  }

  /**
   * Applique tous les modificateurs économiques au calcul de production d'une entreprise
   */
  applyEconomicFactors(business, baseProduction) {
    try {
      // Récupérer le type d'industrie correspondant au type d'entreprise
      const industryType = this.getIndustryTypeForBusiness(business.type);
      
      // Appliquer le modificateur d'industrie
      let modifiedProduction = baseProduction * this.getIndustryModifier(industryType);
      
      // Appliquer le modificateur global de production du cycle économique
      let globalProductionMultiplier = 1.0;
      if (this.currentEconomicCycle === 'boom') {
        globalProductionMultiplier = 1.1 + (this.cycleStrength - 1) * 0.2;
      } else if (this.currentEconomicCycle === 'recession') {
        globalProductionMultiplier = 0.9 - (this.cycleStrength - 1) * 0.15;
      }
      
      // Appliquer les modificateurs globaux des événements actifs
      for (const event of this.activeEvents) {
        if (event.effects.productionMultiplier) {
          globalProductionMultiplier *= event.effects.productionMultiplier;
        }
      }
      
      modifiedProduction *= globalProductionMultiplier;
      
      return Math.round(modifiedProduction);
    } catch (error) {
      console.error('Error applying economic factors:', error);
      return baseProduction; // En cas d'erreur, retourner la production de base
    }
  }

  /**
   * Applique tous les modificateurs économiques au calcul des coûts de maintenance
   */
  applyMaintenanceCostFactors(business, baseCost) {
    try {
      // Récupérer le type d'industrie correspondant au type d'entreprise
      const industryType = this.getIndustryTypeForBusiness(business.type);
      
      // Appliquer le modificateur global des coûts de maintenance du cycle économique
      let globalCostMultiplier = 1.0;
      if (this.currentEconomicCycle === 'boom') {
        globalCostMultiplier = 1.05 + (this.cycleStrength - 1) * 0.1;
      } else if (this.currentEconomicCycle === 'recession') {
        globalCostMultiplier = 1.1 + (this.cycleStrength - 1) * 0.2;
      }
      
      // Appliquer les modificateurs globaux des événements actifs
      for (const event of this.activeEvents) {
        if (event.effects.maintenanceCostMultiplier) {
          globalCostMultiplier *= event.effects.maintenanceCostMultiplier;
        }
      }
      
      const modifiedCost = baseCost * globalCostMultiplier;
      
      return Math.round(modifiedCost);
    } catch (error) {
      console.error('Error applying maintenance cost factors:', error);
      return baseCost; // En cas d'erreur, retourner le coût de base
    }
  }

  /**
   * Mappe les types d'entreprise aux types d'industrie
   */
  getIndustryTypeForBusiness(businessType) {
    const mapping = {
      'tech_company': 'technology',
      'crypto_mining': 'cryptocurrency',
      'farm': 'agriculture',
      'orchard': 'agriculture',
      'flower_shop': 'agriculture',
      'factory': 'industry',
      'mining_company': 'mining',
      'restaurant': 'service',
      'hotel': 'hospitality'
    };
    
    return mapping[businessType] || 'service'; // Par défaut, considérer comme service
  }

  /**
   * Récupère les actualités économiques récentes
   */
  getEconomicNews(limit = 5) {
    return this.newsHistory.slice(0, limit);
  }

  /**
   * Génère un rapport économique complet
   */
  generateEconomicReport() {
    const report = {
      cycle: this.currentEconomicCycle,
      cycleStrength: this.cycleStrength,
      daysSinceLastCycleChange: Math.round((Date.now() - this.lastCycleChange) / (24 * 60 * 60 * 1000)),
      industryModifiers: this.industryModifiers,
      activeEvents: this.activeEvents,
      recentNews: this.newsHistory.slice(0, 3)
    };
    
    return report;
  }
}