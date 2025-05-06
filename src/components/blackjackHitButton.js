import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Gestionnaire pour le bouton "Tirer"
export default {
  customId: 'blackjack_hit',
  
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
      
      // Tirer une carte pour le joueur
      const newCard = drawCard(game.deck);
      game.playerHand.push(newCard);
      
      // Recalculer la valeur de la main du joueur
      game.playerValue = calculateHandValue(game.playerHand);
      
      // Déterminer si le joueur peut encore tirer
      game.playerCanHit = game.playerValue < 21;
      game.playerCanDouble = false; // On ne peut plus doubler après avoir tiré
      
      // Créer les boutons d'action
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('blackjack_hit')
            .setLabel('Tirer')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!game.playerCanHit),
          new ButtonBuilder()
            .setCustomId('blackjack_stand')
            .setLabel('Rester')
            .setStyle(ButtonStyle.Secondary)
        );
      
      // Si le joueur a dépassé 21 (bust)
      if (game.playerValue > 21) {
        // Révéler la main du croupier
        const finalDealerValue = calculateHandValue(game.dealerHand);
        
        // Le joueur a perdu
        const result = {
          outcome: 'lose',
          winnings: 0
        };
        
        // Mettre à jour les statistiques du joueur
        await updatePlayerStats(
          client, 
          interaction.user.id, 
          'blackjack', 
          false, 
          -game.bet
        );
        
        // Supprimer la partie
        client.blackjackGames.delete(interaction.user.id);
        
        // Créer l'embed de résultat
        const embed = EmbedCreator.error(
          '🃏 Blackjack - Perdu',
          `Vous avez dépassé 21! Vous avez perdu ${game.bet} crédits.`,
          {
            fields: [
              {
                name: '👤 Votre main',
                value: formatBlackjackHand(game.playerHand, game.playerValue),
                inline: true
              },
              {
                name: '🤖 Main du croupier',
                value: formatBlackjackHand(game.dealerHand, finalDealerValue),
                inline: true
              }
            ]
          }
        );
        
        return interaction.update({ embeds: [embed], components: [] });
      }
      
      // Si le joueur a 21 points, faire automatiquement "stand"
      if (game.playerValue === 21) {
        // Appeler directement le gestionnaire de "stand"
        const standHandler = require('./blackjackStandButton').default;
        return standHandler.execute(interaction, client);
      }
      
      // Créer l'embed pour continuer la partie
      const embed = EmbedCreator.economy(
        '🃏 Blackjack',
        `Votre mise: ${game.bet} crédits`,
        {
          fields: [
            {
              name: '👤 Votre main',
              value: formatBlackjackHand(game.playerHand, game.playerValue),
              inline: true
            },
            {
              name: '🤖 Main du croupier',
              value: `${game.dealerHand[0].value}${game.dealerHand[0].suit} et une carte cachée`,
              inline: true
            }
          ]
        }
      );
      
      return interaction.update({ embeds: [embed], components: [actionRow] });
      
    } catch (error) {
      console.error('Error in blackjack hit button:', error);
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