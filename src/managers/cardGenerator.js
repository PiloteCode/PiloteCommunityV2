// cardGenerator.js
const THEMES = {
    CREATURES: {
      prefixes: [
        'Dragon', 'Phénix', 'Griffon', 'Hydre', 'Titan', 'Golem', 'Chimère', 
        'Sphinx', 'Kraken', 'Léviathan', 'Béhémoth', 'Wyverne', 'Basilic'
      ],
      suffixes: [
        'Ancestral', 'Céleste', 'des Abysses', 'Éternel', 'Primordial', 
        'Mythique', 'Légendaire', 'Ancien', 'Divin', 'Astral', 'Élémentaire'
      ],
      attributes: [
        'de Feu', 'de Glace', 'de Foudre', 'des Ténèbres', 'de Lumière',
        'du Chaos', 'de l\'Ordre', 'de la Nature', 'du Temps', 'de l\'Espace'
      ]
    },
    WARRIORS: {
      prefixes: [
        'Chevalier', 'Paladin', 'Guerrier', 'Champion', 'Gardien', 'Sentinelle',
        'Protecteur', 'Conquérant', 'Commandant', 'Maître'
      ],
      suffixes: [
        'Vaillant', 'Intrépide', 'Courageux', 'Héroïque', 'Honorable',
        'Glorieux', 'Indomptable', 'Victorieux', 'Légendaire'
      ],
      attributes: [
        'des Tempêtes', 'du Soleil', 'de la Lune', 'de l\'Aube', 'du Crépuscule',
        'des Étoiles', 'du Destin', 'de la Justice', 'de la Victoire'
      ]
    },
    MAGES: {
      prefixes: [
        'Archimage', 'Sorcier', 'Enchanteur', 'Mage', 'Oracle', 'Prophète',
        'Sage', 'Mystique', 'Thaumaturge', 'Invocat'
      ],
      suffixes: [
        'Mystérieux', 'Omniscient', 'Illuminé', 'Transcendant', 'Érudit',
        'Éveillé', 'Visionnaire', 'Ancien', 'Éternel'
      ],
      attributes: [
        'des Arcanes', 'de la Sagesse', 'du Savoir', 'des Mystères',
        'de la Prophétie', 'des Secrets', 'de l\'Infini', 'des Dimensions'
      ]
    }
  };
  
  const SPECIAL_CARDS = {
    LIMITED: [
      'Éclipse Éternelle',
      'Avatar du Néant',
      'Gardien des Mondes',
      'Essence Primordiale',
      'Maître du Temps',
      'Entité Cosmique',
      'Dévoreur d\'Âmes',
      'Oracle des Destinées'
    ],
    DIVINE: [
      'Alpha et Oméga',
      'Créateur des Mondes',
      'Essence Divine',
      'Architecte Céleste',
      'Arbitre du Destin',
      'Manifestation Ultime'
    ]
  };
  
  // Générateur de descriptions uniques
  const DESCRIPTION_TEMPLATES = [
    "Une entité [ATTRIBUTE] qui maîtrise [POWER]. Sa présence [EFFECT].",
    "Né(e) des [ORIGIN], ce(tte) [TYPE] possède [POWER]. [EFFECT].",
    "Légende vivante [ATTRIBUTE], capable de [POWER]. [EFFECT].",
    "Ancient(e) [TYPE] [ATTRIBUTE], qui [POWER]. [EFFECT]."
  ];
  
  const DESCRIPTION_COMPONENTS = {
    ATTRIBUTE: [
      'des temps anciens', 'des royaumes oubliés', 'des dimensions parallèles',
      'du cosmos infini', 'des prophéties ancestrales', 'des légendes immortelles'
    ],
    POWER: [
      'manipuler le temps et l\'espace',
      'invoquer les forces primordiales',
      'commander aux éléments',
      'transcender la réalité',
      'façonner la matière à volonté'
    ],
    EFFECT: [
      'inspire crainte et admiration',
      'bouleverse l\'ordre établi',
      'change le cours du destin',
      'ébranle les fondements mêmes de l\'existence',
      'apporte l\'harmonie ou le chaos selon sa volonté'
    ],
    ORIGIN: [
      'flammes éternelles',
      'abysses insondables',
      'cieux ancestraux',
      'forces primordiales',
      'prophéties oubliées'
    ],
    TYPE: [
      'gardien', 'protecteur', 'champion', 'maître', 'sage'
    ]
  };
  
  export class CardGenerator {
    static generateCard(rarity) {
      if (rarity === 'LIMITED') {
        return this.generateSpecialCard('LIMITED');
      } else if (rarity === 'DIVINE') {
        return this.generateSpecialCard('DIVINE');
      }
  
      const theme = this.getRandomTheme();
      const name = this.generateName(theme);
      const description = this.generateDescription();
      const powerLevel = this.calculatePowerLevel(rarity);
  
      return {
        name,
        description,
        rarity,
        power_level: powerLevel,
        theme: theme.name
      };
    }
  
    static generateName(theme) {
      const prefix = theme.prefixes[Math.floor(Math.random() * theme.prefixes.length)];
      const suffix = theme.suffixes[Math.floor(Math.random() * theme.suffixes.length)];
      const attribute = theme.attributes[Math.floor(Math.random() * theme.attributes.length)];
  
      // 70% de chance d'avoir un attribut
      const includeAttribute = Math.random() < 0.7;
  
      return includeAttribute 
        ? `${prefix} ${suffix} ${attribute}`
        : `${prefix} ${suffix}`;
    }
  
    static generateSpecialCard(type) {
      const name = SPECIAL_CARDS[type][Math.floor(Math.random() * SPECIAL_CARDS[type].length)];
      const description = this.generateDescription();
      const powerLevel = type === 'DIVINE' ? 1000 : 800;
  
      return {
        name,
        description,
        rarity: type,
        power_level: powerLevel,
        theme: type.toLowerCase()
      };
    }
  
    static generateDescription() {
      const template = DESCRIPTION_TEMPLATES[Math.floor(Math.random() * DESCRIPTION_TEMPLATES.length)];
      
      return template.replace(/\[(\w+)\]/g, (match, type) => {
        const options = DESCRIPTION_COMPONENTS[type];
        return options[Math.floor(Math.random() * options.length)];
      });
    }
  
    static getRandomTheme() {
      const themes = Object.values(THEMES);
      return themes[Math.floor(Math.random() * themes.length)];
    }
  
    static calculatePowerLevel(rarity) {
      const basePower = {
        COMMON: { min: 100, max: 200 },
        UNCOMMON: { min: 200, max: 350 },
        RARE: { min: 350, max: 500 },
        EPIC: { min: 500, max: 650 },
        LEGENDARY: { min: 650, max: 800 },
        MYTHIC: { min: 800, max: 900 },
        DIVINE: { min: 900, max: 1000 },
        LIMITED: { min: 750, max: 950 }
      };
  
      const power = basePower[rarity];
      return Math.floor(Math.random() * (power.max - power.min + 1) + power.min);
    }
  }