export const RARITIES = {
    COMMON: { 
      name: 'Commun', 
      weight: 50, 
      color: '#b8b8b8', 
      emoji: '⚪',
      drop_rate: 50,
      power_range: { min: 100, max: 200 }
    },
    UNCOMMON: { 
      name: 'Peu commun', 
      weight: 25, 
      color: '#2ecc71', 
      emoji: '🟢',
      drop_rate: 25,
      power_range: { min: 200, max: 350 }
    },
    RARE: { 
      name: 'Rare', 
      weight: 12, 
      color: '#3498db', 
      emoji: '🔵',
      drop_rate: 12,
      power_range: { min: 350, max: 500 }
    },
    EPIC: { 
      name: 'Épique', 
      weight: 6, 
      color: '#9b59b6', 
      emoji: '🟣',
      drop_rate: 6,
      power_range: { min: 500, max: 650 }
    },
    LEGENDARY: { 
      name: 'Légendaire', 
      weight: 3, 
      color: '#f1c40f', 
      emoji: '🟡',
      drop_rate: 3,
      power_range: { min: 650, max: 800 }
    },
    MYTHIC: { 
      name: 'Mythique', 
      weight: 2, 
      color: '#e74c3c', 
      emoji: '🔴',
      drop_rate: 2,
      power_range: { min: 800, max: 900 }
    },
    DIVINE: { 
      name: 'Divin', 
      weight: 1, 
      color: '#fd79a8', 
      emoji: '💗',
      drop_rate: 1,
      power_range: { min: 900, max: 1000 }
    },
    LIMITED: { 
      name: 'Édition Limitée', 
      weight: 1, 
      color: '#6c5ce7', 
      emoji: '⭐',
      drop_rate: 1,
      power_range: { min: 750, max: 950 }
    }
  };
  
  export const PACK_TYPES = {
    BASIC: {
      id: 'basic',
      name: 'Pack Basique',
      description: 'Un pack de base pour débuter',
      price: 1000,
      cards: 5,
      weights: {
        COMMON: 60,
        UNCOMMON: 30,
        RARE: 8,
        EPIC: 1.7,
        LEGENDARY: 0.3
      }
    },
    PREMIUM: {
      id: 'premium',
      name: 'Pack Premium',
      description: 'Un pack avec de meilleures chances',
      price: 2500,
      cards: 5,
      weights: {
        COMMON: 40,
        UNCOMMON: 35,
        RARE: 15,
        EPIC: 7,
        LEGENDARY: 2.5,
        MYTHIC: 0.5
      }
    },
    ULTIMATE: {
      id: 'ultimate',
      name: 'Pack Ultimate',
      description: 'Les meilleures cartes possibles',
      price: 5000,
      cards: 5,
      weights: {
        UNCOMMON: 35,
        RARE: 30,
        EPIC: 20,
        LEGENDARY: 10,
        MYTHIC: 4,
        DIVINE: 1
      }
    },
    SPECIAL: {
      id: 'special',
      name: 'Pack Spécial',
      description: 'Contient uniquement des cartes spéciales',
      price: 10000,
      cards: 3,
      weights: {
        LIMITED: 70,
        DIVINE: 30
      }
    }
  };
  