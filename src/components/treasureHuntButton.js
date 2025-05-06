import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  customId: 'treasure', // Le préfixe du customId
  
  async execute(interaction, client, extraData) {
    try {
      // Extraire la direction et l'ID de la partie
      if (!extraData || extraData.length < 2) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur de bouton',
              'Données de bouton invalides.'
            )
          ],
          ephemeral: true
        });
      }
      
      const [direction, gameId] = extraData;
      
      // Récupérer les informations sur la partie
      const game = await client.db.db.get(`
        SELECT * FROM treasure_hunt_games
        WHERE id = ?
      `, gameId);
      
      if (!game) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Partie introuvable',
              'Cette partie de chasse au trésor n\'existe plus.'
            )
          ],
          components: []
        });
      }
      
      // Vérifier que c'est bien le joueur de la partie
      if (interaction.user.id !== game.user_id) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Non autorisé',
              'Vous ne pouvez pas jouer à la partie de quelqu\'un d\'autre.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si la partie est déjà terminée
      if (game.completed) {
        return interaction.update({
          embeds: [
            EmbedCreator.info(
              '🏆 Partie terminée',
              'Cette partie de chasse au trésor est déjà terminée. Démarrez-en une nouvelle avec `/treasure-hunt start`.'
            )
          ],
          components: []
        });
      }
      
      // Calculer les nouvelles coordonnées en fonction de la direction
      let newX = game.player_x;
      let newY = game.player_y;
      
      switch (direction) {
        case 'north':
          newY--;
          break;
        case 'south':
          newY++;
          break;
        case 'west':
          newX--;
          break;
        case 'east':
          newX++;
          break;
        default:
          return interaction.reply({
            embeds: [
              EmbedCreator.error(
                'Direction invalide',
                'Cette direction n\'est pas valide.'
              )
            ],
            ephemeral: true
          });
      }
      
      // Vérifier si le déplacement est valide
      if (newX < 0 || newX >= game.grid_size || newY < 0 || newY >= game.grid_size) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Déplacement invalide',
              'Vous ne pouvez pas sortir de la carte.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Récupérer le contenu de la case
      let cell = await client.db.db.get(`
        SELECT * FROM treasure_hunt_grid
        WHERE game_id = ? AND x = ? AND y = ?
      `, gameId, newX, newY);
      
      // Si la case n'existe pas dans la base de données, c'est une case vide
      let cellContent = 'empty';
      if (cell) {
        cellContent = cell.content;
      } else {
        // Créer la case vide dans la base de données
        await client.db.db.run(`
          INSERT INTO treasure_hunt_grid (game_id, x, y, content, discovered)
          VALUES (?, ?, ?, ?, ?)
        `, gameId, newX, newY, 'empty', 1);
      }
      
      // Enregistrer le déplacement
      await client.db.db.run(`
        INSERT INTO treasure_hunt_moves (game_id, direction, result)
        VALUES (?, ?, ?)
      `, gameId, direction, cellContent);
      
      // Mettre à jour les statistiques du joueur (total_moves)
      await updateTreasureHuntStats(client, game.user_id, { total_moves: 1 });
      
      // Mettre à jour la position du joueur
      await client.db.db.run(`
        UPDATE treasure_hunt_games
        SET player_x = ?, player_y = ?, updated_at = datetime('now')
        WHERE id = ?
      `, newX, newY, gameId);
      
      // Marquer la case comme découverte
      if (cell) {
        await client.db.db.run(`
          UPDATE treasure_hunt_grid
          SET discovered = 1
          WHERE id = ?
        `, cell.id);
      }
      
      // Initialiser les variables pour la réponse
      let embedTitle = '🗺️ Chasse au trésor';
      let embedDescription = '';
      let embedColor = '';
      let reward = 0;
      
      // Traiter le résultat en fonction du contenu de la case
      switch (cellContent) {
        case 'empty':
          embedTitle = '🗺️ Lieu vide';
          embedDescription = 'Vous explorez une zone vide. Rien d\'intéressant ici.';
          embedColor = 'PRIMARY'; // Bleu
          break;
          
        case 'treasure':
          embedTitle = '💰 Trésor trouvé!';
          embedDescription = 'Vous avez trouvé un trésor caché!';
          embedColor = 'SUCCESS'; // Vert
          
          // Calculer la récompense (basée sur la difficulté)
          const difficultyMultiplier = {
            'easy': 100,
            'medium': 150,
            'hard': 250
          };
          
          reward = difficultyMultiplier[game.difficulty] || 100;
          
          // Ajouter la récompense au joueur
          await client.db.updateUserBalance(game.user_id, reward);
          
          // Mettre à jour le nombre de trésors trouvés dans la partie
          await client.db.db.run(`
            UPDATE treasure_hunt_games
            SET treasures_found = treasures_found + 1
            WHERE id = ?
          `, gameId);
          
          // Mettre à jour les statistiques du joueur
          await updateTreasureHuntStats(client, game.user_id, {
            treasures_found: 1,
            total_earnings: reward
          });
          
          embedDescription += ` Vous recevez ${reward} PiloCoins!`;
          break;
          
        case 'trap':
          embedTitle = '⚠️ Piège!';
          embedDescription = 'Vous êtes tombé dans un piège!';
          embedColor = 'ERROR'; // Rouge
          
          // Calculer la pénalité (basée sur la difficulté)
          const penaltyMultiplier = {
            'easy': 50,
            'medium': 75,
            'hard': 125
          };
          
          const penalty = penaltyMultiplier[game.difficulty] || 50;
          
          // Mettre à jour les statistiques du joueur
          await updateTreasureHuntStats(client, game.user_id, {
            traps_triggered: 1
          });
          
          embedDescription += ` Vous perdez ${penalty} PiloCoins!`;
          
          // Vérifier si le joueur a assez de PiloCoins
          const user = await client.db.getUser(game.user_id);
          
          if (user.balance >= penalty) {
            // Déduire la pénalité
            await client.db.updateUserBalance(game.user_id, -penalty);
          } else {
            // Déduire ce que le joueur a
            await client.db.updateUserBalance(game.user_id, -user.balance);
            embedDescription += ` (Vous n'aviez que ${user.balance} PiloCoins, donc vous avez tout perdu.)`;
          }
          break;
          
        case 'clue':
          embedTitle = '🔍 Indice trouvé!';
          embedColor = 'INFO'; // Violet
          
          // Trouver le trésor le plus proche
          const nearestTreasure = await findNearestTreasure(client, gameId, newX, newY);
          
          if (nearestTreasure) {
            // Déterminer la direction vers le trésor
            let directionX = '';
            if (nearestTreasure.x > newX) directionX = 'est';
            else if (nearestTreasure.x < newX) directionX = 'ouest';
            
            let directionY = '';
            if (nearestTreasure.y > newY) directionY = 'sud';
            else if (nearestTreasure.y < newY) directionY = 'nord';
            
            let direction = '';
            if (directionX && directionY) direction = `${directionY}-${directionX}`;
            else if (directionX) direction = directionX;
            else if (directionY) direction = directionY;
            else direction = 'proche'; // Même position (ne devrait pas arriver)
            
            embedDescription = `Vous avez trouvé un indice! Un trésor se trouve au ${direction} d'ici.`;
          } else {
            embedDescription = `Vous avez trouvé un indice, mais il semble que tous les trésors ont déjà été découverts.`;
          }
          break;
          
        case 'monster':
          embedTitle = '👹 Monstre!';
          embedDescription = 'Vous avez rencontré un monstre!';
          embedColor = 'WARNING'; // Orange
          
          // 50% de chance de perdre des PiloCoins, 50% de chance de gagner
          if (Math.random() < 0.5) {
            const loss = Math.floor(Math.random() * 100) + 50; // Perte entre 50 et 150
            
            // Vérifier si le joueur a assez de PiloCoins
            const user = await client.db.getUser(game.user_id);
            
            if (user.balance >= loss) {
              // Déduire la perte
              await client.db.updateUserBalance(game.user_id, -loss);
              embedDescription += ` Le monstre vous vole ${loss} PiloCoins avant de s'enfuir!`;
            } else {
              // Déduire ce que le joueur a
              await client.db.updateUserBalance(game.user_id, -user.balance);
              embedDescription += ` Le monstre vous vole tous vos PiloCoins (${user.balance}) avant de s'enfuir!`;
            }
          } else {
            const gain = Math.floor(Math.random() * 100) + 50; // Gain entre 50 et 150
            
            // Ajouter le gain
            await client.db.updateUserBalance(game.user_id, gain);
            
            // Mettre à jour les statistiques du joueur
            await updateTreasureHuntStats(client, game.user_id, {
              total_earnings: gain
            });
            
            embedDescription += ` Vous avez vaincu le monstre et trouvé ${gain} PiloCoins!`;
          }
          break;
      }
      
      // Vérifier si la partie est terminée (tous les trésors trouvés)
      const updatedGame = await client.db.db.get(`
        SELECT * FROM treasure_hunt_games
        WHERE id = ?
      `, gameId);
      
      let gameCompleted = false;
      let completionBonus = 0;
      
      if (updatedGame.treasures_found >= updatedGame.total_treasures) {
        // La partie est terminée, attribuer un bonus
        gameCompleted = true;
        
        // Calculer le bonus de complétion (basé sur la difficulté)
        const bonusMultiplier = {
          'easy': 500,
          'medium': 1000,
          'hard': 2000
        };
        
        completionBonus = bonusMultiplier[updatedGame.difficulty] || 500;
        
        // Ajouter le bonus au joueur
        await client.db.updateUserBalance(updatedGame.user_id, completionBonus);
        
        // Marquer la partie comme terminée
        await client.db.db.run(`
          UPDATE treasure_hunt_games
          SET completed = 1
          WHERE id = ?
        `, gameId);
        
        // Mettre à jour les statistiques du joueur
        await updateTreasureHuntStats(client, updatedGame.user_id, {
          completed_games: 1,
          total_earnings: completionBonus
        });
      }
      
      // Récupérer les statistiques du joueur pour afficher le total de PiloCoins
      const user = await client.db.getUser(game.user_id);
      
      // Créer l'embed de réponse
      const embed = EmbedCreator.create({
        title: embedTitle,
        description: embedDescription + (gameCompleted ? `\n\n🎉 **Félicitations!** Vous avez trouvé tous les trésors! Vous recevez un bonus de complétion de ${completionBonus} PiloCoins!` : ''),
        color: embedColor,
        fields: [
          {
            name: '📊 Progression',
            value: `Trésors: ${updatedGame.treasures_found}/${updatedGame.total_treasures}`,
            inline: true
          },
          {
            name: '🗺️ Position',
            value: `(${newX}, ${newY})`,
            inline: true
          },
          {
            name: '💰 PiloCoins',
            value: `${user.balance}`,
            inline: true
          }
        ]
      });
      
      // Si la partie est terminée, pas besoin de boutons
      if (gameCompleted) {
        return interaction.update({
          embeds: [embed],
          components: []
        });
      }
      
      // Créer les boutons pour continuer la partie
      const gameButtons = await createGameButtons(client, gameId, newX, newY, updatedGame.grid_size);
      
      return interaction.update({
        embeds: [embed],
        components: [gameButtons]
      });
      
    } catch (error) {
      console.error('Error in treasure hunt button:', error);
      return interaction.update({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement de votre action.'
          )
        ],
        components: []
      });
    }
  }
};

// Fonction pour créer les boutons de jeu
async function createGameButtons(client, gameId, playerX, playerY, gridSize) {
  // Vérifier les limites de la carte pour désactiver certains boutons
  const canMoveNorth = playerY > 0;
  const canMoveSouth = playerY < gridSize - 1;
  const canMoveWest = playerX > 0;
  const canMoveEast = playerX < gridSize - 1;
  
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

// Fonction pour trouver le trésor le plus proche
async function findNearestTreasure(client, gameId, playerX, playerY) {
  // Récupérer tous les trésors non découverts
  const treasures = await client.db.db.all(`
    SELECT * FROM treasure_hunt_grid
    WHERE game_id = ? AND content = 'treasure' AND discovered = 0
  `, gameId);
  
  if (treasures.length === 0) return null;
  
  // Trouver le trésor le plus proche (distance euclidienne)
  let nearestTreasure = treasures[0];
  let minDistance = Math.sqrt(
    Math.pow(nearestTreasure.x - playerX, 2) + 
    Math.pow(nearestTreasure.y - playerY, 2)
  );
  
  for (let i = 1; i < treasures.length; i++) {
    const treasure = treasures[i];
    const distance = Math.sqrt(
      Math.pow(treasure.x - playerX, 2) + 
      Math.pow(treasure.y - playerY, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestTreasure = treasure;
    }
  }
  
  return nearestTreasure;
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