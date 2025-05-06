import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('treasure-hunt')
    .setDescription('Partez à la chasse au trésor pour gagner des PiloCoins')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Démarrer une nouvelle chasse au trésor')
        .addStringOption(option =>
          option.setName('difficulté')
            .setDescription('Niveau de difficulté de la chasse')
            .setRequired(true)
            .addChoices(
              { name: 'Facile (5x5, 3 trésors)', value: 'easy' },
              { name: 'Moyenne (6x6, 4 trésors)', value: 'medium' },
              { name: 'Difficile (8x8, 5 trésors)', value: 'hard' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Voir vos statistiques de chasse au trésor')),

  cooldown: 30000, // 30 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Créer la table si elle n'existe pas
      await createTreasureHuntTable(client);
      
      if (subcommand === 'start') {
        // Vérifier si l'utilisateur a déjà une partie en cours
        const activeGame = await getActiveGame(client, userId);
        
        if (activeGame) {
          // Trouver le nombre de coups joués
          const movesPlayed = await getMovesCount(client, activeGame.id);
          
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                '🗺️ Chasse au trésor en cours',
                `Vous avez déjà une chasse au trésor en cours! Vous avez joué ${movesPlayed} coups et trouvé ${activeGame.treasures_found}/${activeGame.total_treasures} trésors.`,
                {
                  fields: [
                    {
                      name: '❓ Comment continuer',
                      value: 'Utilisez les boutons ci-dessous pour continuer votre chasse au trésor actuelle.',
                      inline: false
                    }
                  ]
                }
              )
            ],
            components: [await createGameButtons(client, activeGame.id)]
          });
        }
        
        // Récupérer les données utilisateur
        const user = await client.db.getUser(userId);
        
        // Récupérer la difficulté choisie
        const difficulty = interaction.options.getString('difficulté');
        
        // Coût pour commencer une partie
        const entryCost = getEntryCost(difficulty);
        
        // Vérifier si l'utilisateur a assez de PiloCoins
        if (user.balance < entryCost) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'PiloCoins insuffisants',
                `Vous avez besoin de ${entryCost} PiloCoins pour commencer une chasse au trésor en difficulté ${getDifficultyName(difficulty)}. Vous n'avez que ${user.balance} PiloCoins.`
              )
            ]
          });
        }
        
        // Déduire le coût d'entrée
        await client.db.updateUserBalance(userId, -entryCost);
        
        // Créer une nouvelle partie
        const gameId = await createNewGame(client, userId, difficulty);
        
        // Créer l'embed de démarrage
        const embed = EmbedCreator.success(
          '🗺️ Chasse au trésor commencée!',
          `Vous partez à la recherche de trésors! Utilisez les boutons de direction pour explorer la carte. Attention aux pièges!`,
          {
            fields: [
              {
                name: '🎮 Commandes',
                value: 'Utilisez les boutons de direction pour vous déplacer sur la carte. Rencontrez différents événements lors de votre exploration: trésors, pièges, monstres ou indices.',
                inline: false
              },
              {
                name: '🏆 Objectif',
                value: `Trouvez tous les ${getGameConfig(difficulty).treasures} trésors cachés sur la carte pour remporter un bonus important!`,
                inline: false
              },
              {
                name: '💰 Coût d\'entrée',
                value: `${entryCost} PiloCoins`,
                inline: true
              },
              {
                name: '🎯 Difficulté',
                value: getDifficultyName(difficulty),
                inline: true
              },
              {
                name: '💰 Nouveau solde',
                value: `${user.balance - entryCost} PiloCoins`,
                inline: true
              }
            ]
          }
        );
        
        // Créer les boutons de jeu
        const gameButtons = await createGameButtons(client, gameId);
        
        return interaction.editReply({
          embeds: [embed],
          components: [gameButtons]
        });
      }
      
      else if (subcommand === 'stats') {
        // Récupérer les statistiques de l'utilisateur
        const stats = await getTreasureHuntStats(client, userId);
        
        // Créer l'embed de statistiques
        const embed = EmbedCreator.economy(
          '📊 Statistiques de chasse au trésor',
          `Voici vos statistiques pour les chasses au trésor:`,
          {
            fields: [
              {
                name: '🎮 Parties jouées',
                value: `${stats.total_games}`,
                inline: true
              },
              {
                name: '🏆 Parties terminées',
                value: `${stats.completed_games}`,
                inline: true
              },
              {
                name: '💯 Taux de complétion',
                value: `${stats.total_games > 0 ? Math.round((stats.completed_games / stats.total_games) * 100) : 0}%`,
                inline: true
              },
              {
                name: '💰 PiloCoins gagnés',
                value: `${stats.total_earnings}`,
                inline: true
              },
              {
                name: '💸 PiloCoins dépensés',
                value: `${stats.total_spent}`,
                inline: true
              },
              {
                name: '📈 Profit net',
                value: `${stats.total_earnings - stats.total_spent}`,
                inline: true
              },
              {
                name: '🗺️ Coups joués',
                value: `${stats.total_moves}`,
                inline: true
              },
              {
                name: '🏆 Trésors trouvés',
                value: `${stats.treasures_found}`,
                inline: true
              },
              {
                name: '💀 Pièges activés',
                value: `${stats.traps_triggered}`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({
          embeds: [embed]
        });
      }
      
    } catch (error) {
      console.error('Error in treasure-hunt command:', error);
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Erreur', 
            'Une erreur est survenue lors de l\'exécution de la commande.'
          )
        ]
      });
    }
  }
};

// Fonction pour créer la table de chasse au trésor
async function createTreasureHuntTable(client) {
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS treasure_hunt_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      grid_size INTEGER NOT NULL,
      total_treasures INTEGER NOT NULL,
      treasures_found INTEGER NOT NULL DEFAULT 0,
      player_x INTEGER NOT NULL DEFAULT 0,
      player_y INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS treasure_hunt_grid (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      content TEXT NOT NULL,
      discovered INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES treasure_hunt_games(id) ON DELETE CASCADE,
      UNIQUE(game_id, x, y)
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS treasure_hunt_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES treasure_hunt_games(id) ON DELETE CASCADE
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS treasure_hunt_stats (
      user_id TEXT PRIMARY KEY,
      total_games INTEGER NOT NULL DEFAULT 0,
      completed_games INTEGER NOT NULL DEFAULT 0,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      total_spent INTEGER NOT NULL DEFAULT 0,
      total_moves INTEGER NOT NULL DEFAULT 0,
      treasures_found INTEGER NOT NULL DEFAULT 0,
      traps_triggered INTEGER NOT NULL DEFAULT 0,
      last_played TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
}

// Fonction pour récupérer une partie active
async function getActiveGame(client, userId) {
  return await client.db.db.get(`
    SELECT * FROM treasure_hunt_games
    WHERE user_id = ? AND completed = 0
    ORDER BY created_at DESC
    LIMIT 1
  `, userId);
}

// Fonction pour créer une nouvelle partie
async function createNewGame(client, userId, difficulty) {
  // Récupérer la configuration de la difficulté
  const config = getGameConfig(difficulty);
  
  // Insérer la nouvelle partie
  const result = await client.db.db.run(`
    INSERT INTO treasure_hunt_games (
      user_id, difficulty, grid_size, total_treasures,
      player_x, player_y
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, userId, difficulty, config.gridSize, config.treasures, 0, 0);
  
  const gameId = result.lastID;
  
  // Générer la grille
  await generateGrid(client, gameId, config);
  
  // Mettre à jour les statistiques de l'utilisateur
  await updateTreasureHuntStats(client, userId, {
    total_games: 1,
    total_spent: getEntryCost(difficulty)
  });
  
  return gameId;
}

// Fonction pour générer la grille de jeu
async function generateGrid(client, gameId, config) {
  const { gridSize, treasures } = config;
  
  // Placer le joueur à l'origine (0,0)
  await client.db.db.run(`
    INSERT INTO treasure_hunt_grid (game_id, x, y, content, discovered)
    VALUES (?, ?, ?, ?, ?)
  `, gameId, 0, 0, 'empty', 1);
  
  // Placer les trésors aléatoirement
  for (let i = 0; i < treasures; i++) {
    let x, y;
    let placed = false;
    
    while (!placed) {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
      
      // Ne pas placer de trésor à l'origine
      if (x === 0 && y === 0) continue;
      
      // Vérifier si la case est déjà occupée
      const cell = await client.db.db.get(`
        SELECT * FROM treasure_hunt_grid
        WHERE game_id = ? AND x = ? AND y = ?
      `, gameId, x, y);
      
      if (!cell) {
        // Placer le trésor
        await client.db.db.run(`
          INSERT INTO treasure_hunt_grid (game_id, x, y, content, discovered)
          VALUES (?, ?, ?, ?, ?)
        `, gameId, x, y, 'treasure', 0);
        
        placed = true;
      }
    }
  }
  
  // Placer des pièges aléatoirement (environ 1/4 de la grille)
  const traps = Math.floor((gridSize * gridSize) / 4);
  
  for (let i = 0; i < traps; i++) {
    let x, y;
    let placed = false;
    
    while (!placed) {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
      
      // Ne pas placer de piège à l'origine
      if (x === 0 && y === 0) continue;
      
      // Vérifier si la case est déjà occupée
      const cell = await client.db.db.get(`
        SELECT * FROM treasure_hunt_grid
        WHERE game_id = ? AND x = ? AND y = ?
      `, gameId, x, y);
      
      if (!cell) {
        // Placer le piège
        await client.db.db.run(`
          INSERT INTO treasure_hunt_grid (game_id, x, y, content, discovered)
          VALUES (?, ?, ?, ?, ?)
        `, gameId, x, y, 'trap', 0);
        
        placed = true;
      }
    }
  }
  
  // Placer des indices aléatoirement (environ 1/8 de la grille)
  const clues = Math.floor((gridSize * gridSize) / 8);
  
  for (let i = 0; i < clues; i++) {
    let x, y;
    let placed = false;
    
    while (!placed) {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
      
      // Ne pas placer d'indice à l'origine
      if (x === 0 && y === 0) continue;
      
      // Vérifier si la case est déjà occupée
      const cell = await client.db.db.get(`
        SELECT * FROM treasure_hunt_grid
        WHERE game_id = ? AND x = ? AND y = ?
      `, gameId, x, y);
      
      if (!cell) {
        // Placer l'indice
        await client.db.db.run(`
          INSERT INTO treasure_hunt_grid (game_id, x, y, content, discovered)
          VALUES (?, ?, ?, ?, ?)
        `, gameId, x, y, 'clue', 0);
        
        placed = true;
      }
    }
  }
  
  // Placer des monstres aléatoirement (environ 1/6 de la grille)
  const monsters = Math.floor((gridSize * gridSize) / 6);
  
  for (let i = 0; i < monsters; i++) {
    let x, y;
    let placed = false;
    
    while (!placed) {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
      
      // Ne pas placer de monstre à l'origine
      if (x === 0 && y === 0) continue;
      
      // Vérifier si la case est déjà occupée
      const cell = await client.db.db.get(`
        SELECT * FROM treasure_hunt_grid
        WHERE game_id = ? AND x = ? AND y = ?
      `, gameId, x, y);
      
      if (!cell) {
        // Placer le monstre
        await client.db.db.run(`
          INSERT INTO treasure_hunt_grid (game_id, x, y, content, discovered)
          VALUES (?, ?, ?, ?, ?)
        `, gameId, x, y, 'monster', 0);
        
        placed = true;
      }
    }
  }
  
  // Les cases restantes sont vides par défaut (on ne les stocke pas pour économiser de l'espace)
}

// Fonction pour récupérer le nombre de coups joués
async function getMovesCount(client, gameId) {
  const result = await client.db.db.get(`
    SELECT COUNT(*) as count FROM treasure_hunt_moves
    WHERE game_id = ?
  `, gameId);
  
  return result.count || 0;
}

// Fonction pour créer les boutons de jeu
async function createGameButtons(client, gameId) {
  // Récupérer les informations sur la partie
  const game = await client.db.db.get(`
    SELECT * FROM treasure_hunt_games
    WHERE id = ?
  `, gameId);
  
  // Vérifier les limites de la carte pour désactiver certains boutons
  const canMoveNorth = game.player_y > 0;
  const canMoveSouth = game.player_y < game.grid_size - 1;
  const canMoveWest = game.player_x > 0;
  const canMoveEast = game.player_x < game.grid_size - 1;
  
  // Créer les boutons de direction
  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`treasure_north_${gameId}`)
        .setLabel('⬆️ Nord')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canMoveNorth),
      new ButtonBuilder()
        .setCustomId(`treasure_south_${gameId}`)
        .setLabel('⬇️ Sud')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canMoveSouth),
      new ButtonBuilder()
        .setCustomId(`treasure_west_${gameId}`)
        .setLabel('⬅️ Ouest')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canMoveWest),
      new ButtonBuilder()
        .setCustomId(`treasure_east_${gameId}`)
        .setLabel('➡️ Est')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canMoveEast),
    );
  
  return buttons;
}

// Fonction pour récupérer la configuration de jeu en fonction de la difficulté
function getGameConfig(difficulty) {
  switch (difficulty) {
    case 'easy':
      return { gridSize: 5, treasures: 3 };
    case 'medium':
      return { gridSize: 6, treasures: 4 };
    case 'hard':
      return { gridSize: 8, treasures: 5 };
    default:
      return { gridSize: 5, treasures: 3 };
  }
}

// Fonction pour récupérer le coût d'entrée en fonction de la difficulté
function getEntryCost(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 100;
    case 'medium':
      return 200;
    case 'hard':
      return 300;
    default:
      return 100;
  }
}

// Fonction pour récupérer le nom de la difficulté
function getDifficultyName(difficulty) {
  switch (difficulty) {
    case 'easy':
      return 'Facile';
    case 'medium':
      return 'Moyenne';
    case 'hard':
      return 'Difficile';
    default:
      return 'Inconnue';
  }
}

// Fonction pour mettre à jour les statistiques de chasse au trésor
async function updateTreasureHuntStats(client, userId, updates) {
  // Vérifier si l'utilisateur a déjà des statistiques
  const stats = await client.db.db.get(`
    SELECT * FROM treasure_hunt_stats
    WHERE user_id = ?
  `, userId);
  
  if (!stats) {
    // Créer une entrée pour l'utilisateur
    await client.db.db.run(`
      INSERT INTO treasure_hunt_stats (
        user_id, 
        total_games, 
        completed_games, 
        total_earnings, 
        total_spent, 
        total_moves, 
        treasures_found, 
        traps_triggered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, 
      userId, 
      updates.total_games || 0, 
      updates.completed_games || 0, 
      updates.total_earnings || 0, 
      updates.total_spent || 0, 
      updates.total_moves || 0, 
      updates.treasures_found || 0, 
      updates.traps_triggered || 0
    );
    
    return;
  }
  
  // Construire la requête de mise à jour
  let query = 'UPDATE treasure_hunt_stats SET ';
  const params = [];
  
  // Ajouter les champs à mettre à jour
  if (updates.total_games) {
    query += 'total_games = total_games + ?, ';
    params.push(updates.total_games);
  }
  
  if (updates.completed_games) {
    query += 'completed_games = completed_games + ?, ';
    params.push(updates.completed_games);
  }
  
  if (updates.total_earnings) {
    query += 'total_earnings = total_earnings + ?, ';
    params.push(updates.total_earnings);
  }
  
  if (updates.total_spent) {
    query += 'total_spent = total_spent + ?, ';
    params.push(updates.total_spent);
  }
  
  if (updates.total_moves) {
    query += 'total_moves = total_moves + ?, ';
    params.push(updates.total_moves);
  }
  
  if (updates.treasures_found) {
    query += 'treasures_found = treasures_found + ?, ';
    params.push(updates.treasures_found);
  }
  
  if (updates.traps_triggered) {
    query += 'traps_triggered = traps_triggered + ?, ';
    params.push(updates.traps_triggered);
  }
  
  query += 'last_played = datetime(\'now\') WHERE user_id = ?';
  params.push(userId);
  
  // Exécuter la mise à jour
  await client.db.db.run(query, ...params);
}

// Fonction pour récupérer les statistiques de chasse au trésor
async function getTreasureHuntStats(client, userId) {
  // Vérifier si l'utilisateur a déjà des statistiques
  const stats = await client.db.db.get(`
    SELECT * FROM treasure_hunt_stats
    WHERE user_id = ?
  `, userId);
  
  if (!stats) {
    // Retourner des statistiques vides
    return {
      user_id: userId,
      total_games: 0,
      completed_games: 0,
      total_earnings: 0,
      total_spent: 0,
      total_moves: 0,
      treasures_found: 0,
      traps_triggered: 0,
      last_played: null
    };
  }
  
  return stats;
}