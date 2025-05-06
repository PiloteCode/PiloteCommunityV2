import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'blackjack_stand',
  
  async execute(interaction, client) {
    try {
      // Récupérer la partie en cours
      if (!client.blackjackGames || !client.blackjackGames.has(interaction.user.id)) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Aucune partie en cours',
              'Vous n\'avez pas de partie de blackjack en cours. Utilisez `/casino blackjack` pour commencer.'
            )
          ],
          components: []
        });
      }
      
      const game = client.blackjackGames.get(interaction.user.id);
      
      // Vérifier que c'est bien le bon joueur
      if (interaction.user.id !== game.userId && interaction.user.id !== interaction.user.id) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Non autorisé',
              'Vous ne pouvez pas jouer avec la partie de quelqu\'un d\'autre.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Fonction pour calculer la valeur d'une main
      function calculateHandValue(hand) {
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
      
      // Tour du croupier
      let dealerValue = calculateHandValue(game.dealerHand);
      
      // Le croupier tire des cartes jusqu'à avoir au moins 17
      while (dealerValue < 17) {
        const newCard = drawCard(game.deck);
        game.dealerHand.push(newCard);
        dealerValue = calculateHandValue(game.dealerHand);
      }
      
      // Déterminer le résultat
      let result = { outcome: '', winnings: 0 };
      
      if (game.playerValue > 21) {
        // Le joueur a dépassé 21
        result.outcome = 'lose';
        result.winnings = 0;
      } else if (dealerValue > 21) {
        // Le croupier a dépassé 21
        result.outcome = 'win';
        result.winnings = game.bet * 2;
      } else if (game.playerValue > dealerValue) {
        // Le joueur a une meilleure main
        result.outcome = 'win';
        result.winnings = game.bet * 2;
      } else if (game.playerValue < dealerValue) {
        // Le croupier a une meilleure main
        result.outcome = 'lose';
        result.winnings = 0;
      } else {
        // Égalité
        result.outcome = 'push';
        result.winnings = game.bet;
      }
      
      // Calculer le profit/perte
      const profit = result.winnings - game.bet;
      
      // Mettre à jour les statistiques du joueur
      await updatePlayerStats(
        client, 
        interaction.user.id, 
        'blackjack', 
        result.outcome !== 'lose', 
        profit
      );
      
      // Mettre à jour le solde de l'utilisateur si nécessaire
      if (result.winnings > 0) {
        await client.db.updateUserBalance(interaction.user.id, result.winnings);
      }
      
      // Supprimer la partie
      client.blackjackGames.delete(interaction.user.id);
      
      // Créer l'embed de résultat
      const embed = result.outcome === 'win' 
        ? EmbedCreator.success(
            '🃏 Blackjack - Victoire!',
            formatBlackjackResult(result.outcome, result.winnings, game.bet),
            {
              fields: [
                {
                  name: '👤 Votre main',
                  value: formatBlackjackHand(game.playerHand, game.playerValue),
                  inline: true
                },
                {
                  name: '🤖 Main du croupier',
                  value: formatBlackjackHand(game.dealerHand, dealerValue),
                  inline: true
                },
                {
                  name: '💰 Gains',
                  value: `${profit > 0 ? '+' : ''}${profit} crédits`,
                  inline: false
                }
              ]
            }
          )
        : (result.outcome === 'push'
            ? EmbedCreator.info(
                '🃏 Blackjack - Égalité',
                formatBlackjackResult(result.outcome, result.winnings, game.bet),
                {
                  fields: [
                    {
                      name: '👤 Votre main',
                      value: formatBlackjackHand(game.playerHand, game.playerValue),
                      inline: true
                    },
                    {
                      name: '🤖 Main du croupier',
                      value: formatBlackjackHand(game.dealerHand, dealerValue),
                      inline: true
                    },
                    {
                      name: '💰 Résultat',
                      value: 'Mise remboursée (0 crédits)',
                      inline: false
                    }
                  ]
                }
              )
            : EmbedCreator.error(
                '🃏 Blackjack - Perdu',
                formatBlackjackResult(result.outcome, result.winnings, game.bet),
                {
                  fields: [
                    {
                      name: '👤 Votre main',
                      value: formatBlackjackHand(game.playerHand, game.playerValue),
                      inline: true
                    },
                    {
                      name: '🤖 Main du croupier',
                      value: formatBlackjackHand(game.dealerHand, dealerValue),
                      inline: true
                    },
                    {
                      name: '💰 Pertes',
                      value: `-${game.bet} crédits`,
                      inline: false
                    }
                  ]
                }
              )
          );
      
      return interaction.update({ embeds: [embed], components: [] });
      
    } catch (error) {
      console.error('Error in blackjack stand button:', error);
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

// Gestionnaire pour le bouton "Doubler"
export const doubleButton = {
  customId: 'blackjack_double',
  
  async execute(interaction, client) {
    try {
      // Récupérer la partie en cours
      if (!client.blackjackGames || !client.blackjackGames.has(interaction.user.id)) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Aucune partie en cours',
              'Vous n\'avez pas de partie de blackjack en cours. Utilisez `/casino blackjack` pour commencer.'
            )
          ],
          components: []
        });
      }
      
      const game = client.blackjackGames.get(interaction.user.id);
      
      // Vérifier que c'est bien le bon joueur
      if (interaction.user.id !== game.userId && interaction.user.id !== interaction.user.id) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Non autorisé',
              'Vous ne pouvez pas jouer avec la partie de quelqu\'un d\'autre.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si le joueur peut encore doubler
      if (!game.playerCanDouble) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Action non autorisée',
              'Vous ne pouvez plus doubler votre mise à ce stade de la partie.'
            )
          ],
          components: []
        });
      }
      
      // Vérifier si le joueur a assez d'argent pour doubler
      const user = await client.db.getUser(interaction.user.id);
      
      if (user.balance < game.bet) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants',
              `Vous n'avez pas assez de crédits pour doubler votre mise. Il vous faut ${game.bet} crédits supplémentaires.`
            )
          ],
          components: []
        });
      }
      
      // Doubler la mise
      await client.db.updateUserBalance(interaction.user.id, -game.bet);
      game.bet *= 2;
      
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
      
      // Tirer exactement une carte supplémentaire
      const newCard = drawCard(game.deck);
      game.playerHand.push(newCard);
      
      // Fonction pour calculer la valeur d'une main
      function calculateHandValue(hand) {
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
      
      // Recalculer la valeur de la main du joueur
      game.playerValue = calculateHandValue(game.playerHand);
      
      // Après avoir doublé, le joueur ne peut plus tirer ni doubler
      game.playerCanHit = false;
      game.playerCanDouble = false;
      
      // Continuer directement avec le "stand" (tour du croupier)
      const standHandler = require('./blackjackStandButton').default;
      return standHandler.execute(interaction, client);
      
    } catch (error) {
      console.error('Error in blackjack double button:', error);
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

// Fonction pour formater une main de blackjack
function formatBlackjackHand(hand, value) {
  return `${hand.map(card => `${card.value}${card.suit}`).join(' ')} (${value})`;
}

// Fonction pour formater le résultat du blackjack
function formatBlackjackResult(outcome, winnings, bet) {
  switch (outcome) {
    case 'win':
      return `Vous avez gagné ${winnings - bet} crédits!`;
    case 'lose':
      return `Vous avez perdu ${bet} crédits.`;
    case 'push':
      return `Égalité! Votre mise de ${bet} crédits vous est rendue.`;
    case 'blackjack':
      return `Blackjack! Vous avez gagné ${winnings - bet} crédits!`;
    default:
      return '';
  }
}

// Fonction pour mettre à jour les statistiques du joueur
async function updatePlayerStats(client, userId, game, win, profit) {
  // Récupérer les statistiques actuelles
  let stats = await client.db.db.get(`
    SELECT * FROM casino_stats
    WHERE user_id = ?
  `, userId);
  
  // Si le joueur n'a pas encore de statistiques, créer une entrée
  if (!stats) {
    await client.db.db.run(`
      INSERT INTO casino_stats (user_id)
      VALUES (?)
    `, userId);
    
    stats = {
      user_id: userId,
      blackjack_games: 0,
      blackjack_wins: 0,
      blackjack_profit: 0,
      biggest_win: 0,
      biggest_loss: 0
    };
  }
  
  // Mettre à jour les statistiques en fonction du jeu
  const updates = {};
  
  updates.blackjack_games = stats.blackjack_games + 1;
  
  if (win) {
    updates.blackjack_wins = stats.blackjack_wins + 1;
  }
  
  updates.blackjack_profit = stats.blackjack_profit + profit;
  
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