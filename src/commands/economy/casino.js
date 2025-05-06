import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('Jouez à divers jeux de casino pour tenter de gagner des crédits')
    .addSubcommand(subcommand =>
      subcommand
        .setName('roulette')
        .setDescription('Jouez à la roulette')
        .addIntegerOption(option =>
          option.setName('mise')
            .setDescription('Montant à miser')
            .setRequired(true)
            .setMinValue(50))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type de mise')
            .setRequired(true)
            .addChoices(
              { name: 'Rouge', value: 'red' },
              { name: 'Noir', value: 'black' },
              { name: 'Pair', value: 'even' },
              { name: 'Impair', value: 'odd' },
              { name: '1-18', value: 'low' },
              { name: '19-36', value: 'high' },
              { name: 'Tier', value: 'tier' },
              { name: 'Orphelins', value: 'orphans' },
              { name: 'Voisins du zéro', value: 'voisins' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('blackjack')
        .setDescription('Jouez au blackjack')
        .addIntegerOption(option =>
          option.setName('mise')
            .setDescription('Montant à miser')
            .setRequired(true)
            .setMinValue(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('slots')
        .setDescription('Jouez aux machines à sous')
        .addIntegerOption(option =>
          option.setName('mise')
            .setDescription('Montant à miser')
            .setRequired(true)
            .setMinValue(50)
            .setMaxValue(1000)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('craps')
        .setDescription('Jouez aux dés (craps)')
        .addIntegerOption(option =>
          option.setName('mise')
            .setDescription('Montant à miser')
            .setRequired(true)
            .setMinValue(50))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type de mise')
            .setRequired(true)
            .addChoices(
              { name: 'Passe (Pass)', value: 'pass' },
              { name: 'Ne passe pas (Don\'t Pass)', value: 'dontpass' },
              { name: 'Champ (Field)', value: 'field' },
              { name: 'Sept (Any 7)', value: 'any7' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Voir vos statistiques de jeu au casino')),

  cooldown: 10000, // 10 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Récupérer les données utilisateur
      const user = await client.db.getUser(userId);
      
      // Créer les tables nécessaires si elles n'existent pas
      await createCasinoTables(client);
      
      // Récupérer les statistiques du joueur
      const playerStats = await getPlayerStats(client, userId);
      
      if (subcommand === 'stats') {
        // Afficher les statistiques du joueur
        const totalGames = 
          playerStats.roulette_games + 
          playerStats.blackjack_games + 
          playerStats.slots_games + 
          playerStats.craps_games;
        
        const totalWins = 
          playerStats.roulette_wins + 
          playerStats.blackjack_wins + 
          playerStats.slots_wins + 
          playerStats.craps_wins;
        
        const totalProfit = 
          playerStats.roulette_profit + 
          playerStats.blackjack_profit + 
          playerStats.slots_profit + 
          playerStats.craps_profit;
        
        const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
        
        const embed = EmbedCreator.economy(
          '🎰 Statistiques de Casino',
          `Voici vos statistiques de jeux de casino:`,
          {
            fields: [
              {
                name: '📊 Total',
                value: `Parties: ${totalGames}\nVictoires: ${totalWins} (${winRate}%)\nProfit: ${formatProfit(totalProfit)}`,
                inline: false
              },
              {
                name: '🎲 Roulette',
                value: `Parties: ${playerStats.roulette_games}\nVictoires: ${playerStats.roulette_wins}\nProfit: ${formatProfit(playerStats.roulette_profit)}`,
                inline: true
              },
              {
                name: '🃏 Blackjack',
                value: `Parties: ${playerStats.blackjack_games}\nVictoires: ${playerStats.blackjack_wins}\nProfit: ${formatProfit(playerStats.blackjack_profit)}`,
                inline: true
              },
              {
                name: '🎰 Machines à sous',
                value: `Parties: ${playerStats.slots_games}\nVictoires: ${playerStats.slots_wins}\nProfit: ${formatProfit(playerStats.slots_profit)}`,
                inline: true
              },
              {
                name: '🎲 Craps',
                value: `Parties: ${playerStats.craps_games}\nVictoires: ${playerStats.craps_wins}\nProfit: ${formatProfit(playerStats.craps_profit)}`,
                inline: true
              },
              {
                name: '💰 Plus grosse victoire',
                value: `${playerStats.biggest_win} crédits`,
                inline: true
              },
              {
                name: '💸 Plus grosse perte',
                value: `${playerStats.biggest_loss} crédits`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      else if (subcommand === 'roulette') {
        const bet = interaction.options.getInteger('mise');
        const betType = interaction.options.getString('type');
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < bet) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous avez misé ${bet} crédits mais vous n'avez que ${user.balance} crédits.`
              )
            ]
          });
        }
        
        // Jouer à la roulette
        const result = playRoulette(betType);
        
        // Calculer les gains/pertes
        let winnings = 0;
        if (result.win) {
          winnings = Math.floor(bet * result.multiplier);
        } else {
          winnings = -bet;
        }
        
        // Mettre à jour les statistiques du joueur
        await updatePlayerStats(client, userId, 'roulette', result.win, winnings);
        
        // Mettre à jour le solde de l'utilisateur
        await client.db.updateUserBalance(userId, winnings);
        
        // Créer l'embed de résultat
        const embed = result.win 
          ? EmbedCreator.success(
              '🎲 Roulette - Victoire!',
              `La bille s'est arrêtée sur **${result.number} ${result.color}**. Vous avez gagné ${winnings} crédits!`,
              {
                fields: [
                  {
                    name: '🎯 Votre mise',
                    value: `${bet} crédits sur ${getBetTypeName(betType)}`,
                    inline: true
                  },
                  {
                    name: '💸 Gains',
                    value: `${winnings} crédits (x${result.multiplier})`,
                    inline: true
                  },
                  {
                    name: '💰 Nouveau solde',
                    value: `${user.balance + winnings} crédits`,
                    inline: true
                  }
                ]
              }
            )
          : EmbedCreator.error(
              '🎲 Roulette - Perdu',
              `La bille s'est arrêtée sur **${result.number} ${result.color}**. Vous avez perdu ${bet} crédits.`,
              {
                fields: [
                  {
                    name: '🎯 Votre mise',
                    value: `${bet} crédits sur ${getBetTypeName(betType)}`,
                    inline: true
                  },
                  {
                    name: '💸 Pertes',
                    value: `${bet} crédits`,
                    inline: true
                  },
                  {
                    name: '💰 Nouveau solde',
                    value: `${user.balance - bet} crédits`,
                    inline: true
                  }
                ]
              }
            );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      else if (subcommand === 'blackjack') {
        const bet = interaction.options.getInteger('mise');
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < bet) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous avez misé ${bet} crédits mais vous n'avez que ${user.balance} crédits.`
              )
            ]
          });
        }
        
        // Initialiser une partie de blackjack
        const game = initBlackjackGame(bet);
        
        // Sauvegarder la partie en cours
        if (!client.blackjackGames) client.blackjackGames = new Map();
        client.blackjackGames.set(userId, game);
        
        // Déduire le montant de la mise
        await client.db.updateUserBalance(userId, -bet);
        
        // Créer les boutons d'action
        const actionRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('blackjack_hit')
              .setLabel('Tirer')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('blackjack_stand')
              .setLabel('Rester')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('blackjack_double')
              .setLabel('Doubler')
              .setStyle(ButtonStyle.Success)
              .setDisabled(user.balance < bet) // Désactiver si pas assez pour doubler
          );
        
        // Créer l'embed de la partie
        const embed = EmbedCreator.economy(
          '🃏 Blackjack',
          `Votre mise: ${bet} crédits | Solde actuel: ${user.balance - bet} crédits`,
          {
            fields: [
              {
                name: '👤 Votre main',
                value: formatBlackjackHand(game.playerHand, game.playerValue),
                inline: true
              },
              {
                name: '🤖 Main du croupier',
                value: `${game.dealerHand[0]} et une carte cachée`,
                inline: true
              }
            ]
          }
        );
        
        // Vérifier si le joueur a un blackjack naturel
        if (game.playerValue === 21) {
          // Le joueur a un blackjack naturel
          
          // Révéler la main du croupier
          const finalDealerValue = calculateBlackjackHandValue(game.dealerHand);
          
          // Déterminer le résultat
          let result;
          
          if (finalDealerValue === 21) {
            // Égalité (push)
            result = {
              outcome: 'push',
              winnings: bet
            };
          } else {
            // Blackjack (paie 3:2)
            result = {
              outcome: 'blackjack',
              winnings: bet + Math.floor(bet * 1.5)
            };
          }
          
          // Mettre à jour les statistiques
          await updatePlayerStats(
            client, 
            userId, 
            'blackjack', 
            result.outcome !== 'lose', 
            result.winnings - bet
          );
          
          // Créditer les gains
          await client.db.updateUserBalance(userId, result.winnings);
          
          // Mettre à jour l'embed
          embed.setTitle(`🃏 Blackjack - ${getBlackjackOutcomeText(result.outcome)}`);
          embed.setDescription(`Vous avez un blackjack naturel! ${formatBlackjackResult(result.outcome, result.winnings, bet)}`);
          
          embed.data.fields = [
            {
              name: '👤 Votre main',
              value: formatBlackjackHand(game.playerHand, game.playerValue),
              inline: true
            },
            {
              name: '🤖 Main du croupier',
              value: formatBlackjackHand(game.dealerHand, finalDealerValue),
              inline: true
            },
            {
              name: '💰 Nouveau solde',
              value: `${user.balance - bet + result.winnings} crédits`,
              inline: false
            }
          ];
          
          // Supprimer la partie
          client.blackjackGames.delete(userId);
          
          return interaction.editReply({ embeds: [embed], components: [] });
        }
        
        return interaction.editReply({ embeds: [embed], components: [actionRow] });
      }
      
      else if (subcommand === 'slots') {
        const bet = interaction.options.getInteger('mise');
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < bet) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous avez misé ${bet} crédits mais vous n'avez que ${user.balance} crédits.`
              )
            ]
          });
        }
        
        // Jouer aux machines à sous
        const result = playSlots();
        
        // Calculer les gains
        let winnings = 0;
        if (result.outcome !== 'lose') {
          winnings = Math.floor(bet * result.multiplier);
        } else {
          winnings = 0;
        }
        
        // Calculer le profit/perte
        const profit = winnings - bet;
        
        // Mettre à jour les statistiques du joueur
        await updatePlayerStats(client, userId, 'slots', result.outcome !== 'lose', profit);
        
        // Mettre à jour le solde de l'utilisateur
        await client.db.updateUserBalance(userId, profit);
        
        // Créer l'embed de résultat
        const embed = EmbedCreator.economy(
          `🎰 Machine à sous - ${result.outcome !== 'lose' ? 'Victoire!' : 'Perdu'}`,
          `[ ${result.reels.join(' | ')} ]\n\n${result.outcome !== 'lose' ? `Vous avez gagné ${winnings} crédits!` : `Vous avez perdu ${bet} crédits.`}`,
          {
            fields: [
              {
                name: '🎯 Votre mise',
                value: `${bet} crédits`,
                inline: true
              },
              {
                name: result.outcome !== 'lose' ? '💸 Gains' : '💸 Pertes',
                value: result.outcome !== 'lose' ? `${winnings} crédits (x${result.multiplier})` : `${bet} crédits`,
                inline: true
              },
              {
                name: '💰 Nouveau solde',
                value: `${user.balance + profit} crédits`,
                inline: true
              },
              {
                name: '📜 Résultat',
                value: result.description,
                inline: false
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      else if (subcommand === 'craps') {
        const bet = interaction.options.getInteger('mise');
        const betType = interaction.options.getString('type');
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < bet) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous avez misé ${bet} crédits mais vous n'avez que ${user.balance} crédits.`
              )
            ]
          });
        }
        
        // Jouer aux craps
        const result = playCraps(betType);
        
        // Calculer les gains/pertes
        let winnings = 0;
        if (result.win) {
          winnings = Math.floor(bet * result.multiplier);
        } else {
          winnings = -bet;
        }
        
        // Mettre à jour les statistiques du joueur
        await updatePlayerStats(client, userId, 'craps', result.win, winnings);
        
        // Mettre à jour le solde de l'utilisateur
        await client.db.updateUserBalance(userId, winnings);
        
        // Créer l'embed de résultat
        const embed = result.win 
          ? EmbedCreator.success(
              '🎲 Craps - Victoire!',
              `Vous avez lancé: **${result.dice[0]} + ${result.dice[1]} = ${result.sum}**. Vous avez gagné ${winnings} crédits!`,
              {
                fields: [
                  {
                    name: '🎯 Votre mise',
                    value: `${bet} crédits sur ${getCrapsBetTypeName(betType)}`,
                    inline: true
                  },
                  {
                    name: '💸 Gains',
                    value: `${winnings} crédits (x${result.multiplier})`,
                    inline: true
                  },
                  {
                    name: '💰 Nouveau solde',
                    value: `${user.balance + winnings} crédits`,
                    inline: true
                  },
                  {
                    name: '📜 Résultat',
                    value: result.description,
                    inline: false
                  }
                ]
              }
            )
          : EmbedCreator.error(
              '🎲 Craps - Perdu',
              `Vous avez lancé: **${result.dice[0]} + ${result.dice[1]} = ${result.sum}**. Vous avez perdu ${bet} crédits.`,
              {
                fields: [
                  {
                    name: '🎯 Votre mise',
                    value: `${bet} crédits sur ${getCrapsBetTypeName(betType)}`,
                    inline: true
                  },
                  {
                    name: '💸 Pertes',
                    value: `${bet} crédits`,
                    inline: true
                  },
                  {
                    name: '💰 Nouveau solde',
                    value: `${user.balance - bet} crédits`,
                    inline: true
                  },
                  {
                    name: '📜 Résultat',
                    value: result.description,
                    inline: false
                  }
                ]
              }
            );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Error in casino command:', error);
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

// Fonction pour créer les tables de casino
async function createCasinoTables(client) {
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS casino_stats (
      user_id TEXT PRIMARY KEY,
      roulette_games INTEGER NOT NULL DEFAULT 0,
      roulette_wins INTEGER NOT NULL DEFAULT 0,
      roulette_profit INTEGER NOT NULL DEFAULT 0,
      blackjack_games INTEGER NOT NULL DEFAULT 0,
      blackjack_wins INTEGER NOT NULL DEFAULT 0,
      blackjack_profit INTEGER NOT NULL DEFAULT 0,
      slots_games INTEGER NOT NULL DEFAULT 0,
      slots_wins INTEGER NOT NULL DEFAULT 0,
      slots_profit INTEGER NOT NULL DEFAULT 0,
      craps_games INTEGER NOT NULL DEFAULT 0,
      craps_wins INTEGER NOT NULL DEFAULT 0,
      craps_profit INTEGER NOT NULL DEFAULT 0,
      biggest_win INTEGER NOT NULL DEFAULT 0,
      biggest_loss INTEGER NOT NULL DEFAULT 0,
      last_played TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
}

// Fonction pour récupérer les statistiques du joueur
async function getPlayerStats(client, userId) {
  // Vérifier si le joueur a des statistiques
  const stats = await client.db.db.get(`
    SELECT * FROM casino_stats
    WHERE user_id = ?
  `, userId);
  
  if (!stats) {
    // Créer une entrée pour le joueur
    await client.db.db.run(`
      INSERT INTO casino_stats (user_id)
      VALUES (?)
    `, userId);
    
    // Retourner des statistiques vides
    return {
      user_id: userId,
      roulette_games: 0,
      roulette_wins: 0,
      roulette_profit: 0,
      blackjack_games: 0,
      blackjack_wins: 0,
      blackjack_profit: 0,
      slots_games: 0,
      slots_wins: 0,
      slots_profit: 0,
      craps_games: 0,
      craps_wins: 0,
      craps_profit: 0,
      biggest_win: 0,
      biggest_loss: 0,
      last_played: new Date().toISOString()
    };
  }
  
  return stats;
}

// Fonction pour mettre à jour les statistiques du joueur
async function updatePlayerStats(client, userId, game, win, profit) {
  // Récupérer les statistiques actuelles
  const stats = await getPlayerStats(client, userId);
  
  // Mettre à jour les statistiques en fonction du jeu
  const updates = {};
  
  updates[`${game}_games`] = stats[`${game}_games`] + 1;
  
  if (win) {
    updates[`${game}_wins`] = stats[`${game}_wins`] + 1;
  }
  
  updates[`${game}_profit`] = stats[`${game}_profit`] + profit;
  
  // Mettre à jour la plus grosse victoire/perte
  if (profit > 0 && profit > stats.biggest_win) {
    updates.biggest_win = profit;
  } else if (profit < 0 && Math.abs(profit) > Math.abs(stats.biggest_loss)) {
    updates.biggest_loss = profit;
  }
  
  // Construire la requête dynamiquement
  let query = 'UPDATE casino_stats SET ';
  const params = [];
  
  for (const [key, value] of Object.entries(updates)) {
    query += `${key} = ?, `;
    params.push(value);
  }
  
  query += 'last_played = datetime(\'now\') WHERE user_id = ?';
  params.push(userId);
  
  // Exécuter la mise à jour
  await client.db.db.run(query, ...params);
}

// Fonction pour jouer à la roulette
function playRoulette(betType) {
  // Définir les numéros et leurs couleurs
  const rouletteNumbers = [
    { number: 0, color: 'vert' },
    { number: 32, color: 'rouge' }, { number: 15, color: 'noir' }, { number: 19, color: 'rouge' },
    { number: 4, color: 'noir' }, { number: 21, color: 'rouge' }, { number: 2, color: 'noir' },
    { number: 25, color: 'rouge' }, { number: 17, color: 'noir' }, { number: 34, color: 'rouge' },
    { number: 6, color: 'noir' }, { number: 27, color: 'rouge' }, { number: 13, color: 'noir' },
    { number: 36, color: 'rouge' }, { number: 11, color: 'noir' }, { number: 30, color: 'rouge' },
    { number: 8, color: 'noir' }, { number: 23, color: 'rouge' }, { number: 10, color: 'noir' },
    { number: 5, color: 'rouge' }, { number: 24, color: 'noir' }, { number: 16, color: 'rouge' },
    { number: 33, color: 'noir' }, { number: 1, color: 'rouge' }, { number: 20, color: 'noir' },
    { number: 14, color: 'rouge' }, { number: 31, color: 'noir' }, { number: 9, color: 'rouge' },
    { number: 22, color: 'noir' }, { number: 18, color: 'rouge' }, { number: 29, color: 'noir' },
    { number: 7, color: 'rouge' }, { number: 28, color: 'noir' }, { number: 12, color: 'rouge' },
    { number: 35, color: 'noir' }, { number: 3, color: 'rouge' }, { number: 26, color: 'noir' }
  ];
  
  // Tirer un numéro aléatoire
  const result = rouletteNumbers[Math.floor(Math.random() * rouletteNumbers.length)];
  
  // Déterminer le résultat en fonction du type de mise
  let win = false;
  let multiplier = 0;
  
  switch (betType) {
    case 'red':
      win = result.color === 'rouge';
      multiplier = 2;
      break;
    case 'black':
      win = result.color === 'noir';
      multiplier = 2;
      break;
    case 'even':
      win = result.number !== 0 && result.number % 2 === 0;
      multiplier = 2;
      break;
    case 'odd':
      win = result.number !== 0 && result.number % 2 === 1;
      multiplier = 2;
      break;
    case 'low':
      win = result.number >= 1 && result.number <= 18;
      multiplier = 2;
      break;
    case 'high':
      win = result.number >= 19 && result.number <= 36;
      multiplier = 2;
      break;
    case 'tier':
      win = result.number >= 1 && result.number <= 12;
      multiplier = 3;
      break;
    case 'orphans':
      // Les orphelins: 1, 6, 9, 14, 17, 20, 31, 34
      win = [1, 6, 9, 14, 17, 20, 31, 34].includes(result.number);
      multiplier = 5;
      break;
    case 'voisins':
      // Les voisins du zéro: 0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35
      win = [0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35].includes(result.number);
      multiplier = 2.25;
      break;
  }
  
  return {
    ...result,
    win,
    multiplier
  };
}

// Fonction pour initialiser une partie de blackjack
function initBlackjackGame(bet) {
  // Créer un jeu de cartes
  const deck = createDeck();
  
  // Mélanger le jeu
  shuffleDeck(deck);
  
  // Distribuer les cartes
  const playerHand = [drawCard(deck), drawCard(deck)];
  const dealerHand = [drawCard(deck), drawCard(deck)];
  
  // Calculer les valeurs des mains
  const playerValue = calculateBlackjackHandValue(playerHand);
  const dealerValue = calculateBlackjackHandValue(dealerHand);
  
  return {
    bet,
    deck,
    playerHand,
    dealerHand,
    playerValue,
    dealerValue,
    playerCanHit: true,
    playerCanDouble: true
  };
}

// Fonction pour créer un jeu de cartes
function createDeck() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  
  const deck = [];
  
  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        suit,
        value,
        numerical: value === 'A' ? 11 : (value === 'J' || value === 'Q' || value === 'K' ? 10 : parseInt(value))
      });
    }
  }
  
  return deck;
}

// Fonction pour mélanger un jeu de cartes
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Fonction pour tirer une carte
function drawCard(deck) {
  if (deck.length === 0) {
    // Si le jeu est vide, créer un nouveau jeu mélangé
    const newDeck = createDeck();
    shuffleDeck(newDeck);
    deck.push(...newDeck);
  }
  
  return deck.pop();
}

// Fonction pour calculer la valeur d'une main au blackjack
function calculateBlackjackHandValue(hand) {
  let value = 0;
  let aces = 0;
  
  for (const card of hand) {
    value += card.numerical;
    
    if (card.value === 'A') {
      aces++;
    }
  }
  
  // Réduire la valeur des as si nécessaire
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

// Fonction pour formater une main de blackjack
function formatBlackjackHand(hand, value) {
  return `${hand.map(card => `${card.value}${card.suit}`).join(' ')} (${value})`;
}

// Fonction pour formater le résultat du blackjack
function formatBlackjackResult(outcome, winnings, bet) {
  switch (outcome) {
    case 'win':
      return `Vous avez gagné ${winnings} crédits!`;
    case 'lose':
      return `Vous avez perdu ${bet} crédits.`;
    case 'push':
      return `Égalité! Votre mise de ${bet} crédits vous est rendue.`;
    case 'blackjack':
      return `Blackjack! Vous avez gagné ${winnings} crédits!`;
    default:
      return '';
  }
}

// Fonction pour obtenir le texte de résultat du blackjack
function getBlackjackOutcomeText(outcome) {
  switch (outcome) {
    case 'win':
      return 'Victoire!';
    case 'lose':
      return 'Perdu';
    case 'push':
      return 'Égalité';
    case 'blackjack':
      return 'Blackjack!';
    default:
      return '';
  }
}

// Fonction pour jouer aux machines à sous
function playSlots() {
  // Définir les symboles et leurs probabilités
  const symbols = [
    '🍒', '🍋', '🍇', '🍊', '🍉', '💰', '💎', '7️⃣'
  ];
  
  // Probabilités (poids) pour chaque symbole (du plus commun au plus rare)
  const weights = [20, 15, 15, 10, 10, 5, 3, 2];
  
  // Tirer 3 symboles aléatoires en fonction des poids
  const reels = [];
  
  for (let i = 0; i < 3; i++) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let j = 0; j < symbols.length; j++) {
      random -= weights[j];
      
      if (random <= 0) {
        reels.push(symbols[j]);
        break;
      }
    }
  }
  
  // Déterminer le résultat
  let outcome = 'lose';
  let multiplier = 0;
  let description = 'Dommage, aucune combinaison gagnante.';
  
  // 3 symboles identiques
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    outcome = 'big_win';
    
    // Multiplier en fonction du symbole
    switch (reels[0]) {
      case '🍒':
        multiplier = 5;
        description = 'Trois cerises! Petit jackpot!';
        break;
      case '🍋':
        multiplier = 5;
        description = 'Trois citrons! Petit jackpot!';
        break;
      case '🍇':
        multiplier = 8;
        description = 'Trois raisins! Bon jackpot!';
        break;
      case '🍊':
        multiplier = 8;
        description = 'Trois oranges! Bon jackpot!';
        break;
      case '🍉':
        multiplier = 10;
        description = 'Trois pastèques! Gros jackpot!';
        break;
      case '💰':
        multiplier = 15;
        description = 'Trois sacs d\'argent! Énorme jackpot!';
        break;
      case '💎':
        multiplier = 20;
        description = 'Trois diamants! Jackpot massif!';
        break;
      case '7️⃣':
        multiplier = 50;
        description = 'JACKPOT! Trois 7! Fortune extraordinaire!';
        break;
    }
  }
  // 2 symboles identiques
  else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    outcome = 'small_win';
    
    let pairSymbol;
    if (reels[0] === reels[1]) pairSymbol = reels[0];
    else if (reels[1] === reels[2]) pairSymbol = reels[1];
    else pairSymbol = reels[0];
    
    // Multiplier en fonction du symbole
    switch (pairSymbol) {
      case '🍒':
      case '🍋':
        multiplier = 1.5;
        description = `Deux ${pairSymbol}! Petit gain!`;
        break;
      case '🍇':
      case '🍊':
        multiplier = 2;
        description = `Deux ${pairSymbol}! Gain moyen!`;
        break;
      case '🍉':
        multiplier = 2.5;
        description = `Deux pastèques! Bon gain!`;
        break;
      case '💰':
        multiplier = 3;
        description = `Deux sacs d'argent! Très bon gain!`;
        break;
      case '💎':
        multiplier = 4;
        description = `Deux diamants! Excellent gain!`;
        break;
      case '7️⃣':
        multiplier = 5;
        description = `Deux 7! Gain impressionnant!`;
        break;
    }
  }
  // Au moins un 7
  else if (reels.includes('7️⃣')) {
    outcome = 'small_win';
    multiplier = 1.2;
    description = 'Un 7! Petit gain consolation!';
  }
  
  return {
    reels,
    outcome,
    multiplier,
    description
  };
}

// Fonction pour jouer aux craps
function playCraps(betType) {
  // Lancer deux dés
  const dice = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
  
  // Calculer la somme
  const sum = dice[0] + dice[1];
  
  // Déterminer le résultat en fonction du type de mise
  let win = false;
  let multiplier = 0;
  let description = '';
  
  switch (betType) {
    case 'pass':
      // Gagner avec 7 ou 11, perdre avec 2, 3 ou 12
      if (sum === 7 || sum === 11) {
        win = true;
        multiplier = 2;
        description = 'Votre mise Pass gagne avec un 7 ou 11!';
      } else if (sum === 2 || sum === 3 || sum === 12) {
        win = false;
        description = 'Votre mise Pass perd avec un 2, 3 ou 12.';
      } else {
        // Dans un vrai jeu de craps, on établirait un "point" ici
        // Mais pour simplifier, on considère que tout autre résultat est un gain
        win = true;
        multiplier = 1.5;
        description = `Vous établissez un point avec ${sum}. Simplification: vous gagnez!`;
      }
      break;
      
    case 'dontpass':
      // Gagner avec 2, 3, perdre avec 7 ou 11, match nul avec 12
      if (sum === 2 || sum === 3) {
        win = true;
        multiplier = 2;
        description = 'Votre mise Don\'t Pass gagne avec un 2 ou 3!';
      } else if (sum === 7 || sum === 11) {
        win = false;
        description = 'Votre mise Don\'t Pass perd avec un 7 ou 11.';
      } else if (sum === 12) {
        win = false; // En réalité ce serait un match nul, mais simplifions
        description = 'Votre mise Don\'t Pass donne un match nul avec 12. Simplification: vous perdez.';
      } else {
        // Simplification: tout autre résultat est une perte
        win = false;
        description = `Vous établissez un point avec ${sum}. Simplification: vous perdez.`;
      }
      break;
      
    case 'field':
      // Gagner avec 2, 3, 4, 9, 10, 11, 12. Payer double sur 2 et 12.
      if ([2, 3, 4, 9, 10, 11, 12].includes(sum)) {
        win = true;
        
        if (sum === 2 || sum === 12) {
          multiplier = 3; // Paie double
          description = `Votre mise Field gagne double avec un ${sum}!`;
        } else {
          multiplier = 2;
          description = `Votre mise Field gagne avec un ${sum}!`;
        }
      } else {
        win = false;
        description = `Votre mise Field perd avec un ${sum}.`;
      }
      break;
      
    case 'any7':
      // Gagner seulement avec un 7
      if (sum === 7) {
        win = true;
        multiplier = 5;
        description = 'Votre mise Any 7 gagne! Les chances étaient de 1 sur 6.';
      } else {
        win = false;
        description = `Votre mise Any 7 perd avec un ${sum}.`;
      }
      break;
  }
  
  return {
    dice,
    sum,
    win,
    multiplier,
    description
  };
}

// Fonction pour obtenir le nom d'un type de mise de roulette
function getBetTypeName(betType) {
  switch (betType) {
    case 'red':
      return 'Rouge';
    case 'black':
      return 'Noir';
    case 'even':
      return 'Pair';
    case 'odd':
      return 'Impair';
    case 'low':
      return '1-18';
    case 'high':
      return '19-36';
    case 'tier':
      return 'Tier';
    case 'orphans':
      return 'Orphelins';
    case 'voisins':
      return 'Voisins du zéro';
    default:
      return betType;
  }
}

// Fonction pour obtenir le nom d'un type de mise de craps
function getCrapsBetTypeName(betType) {
  switch (betType) {
    case 'pass':
      return 'Passe';
    case 'dontpass':
      return 'Ne passe pas';
    case 'field':
      return 'Champ';
    case 'any7':
      return 'Sept';
    default:
      return betType;
  }
}

// Fonction pour formater le profit
function formatProfit(profit) {
  if (profit > 0) {
    return `+${profit} crédits`;
  } else if (profit < 0) {
    return `${profit} crédits`;
  } else {
    return `0 crédits`;
  }
}