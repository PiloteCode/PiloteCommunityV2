import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Jouez au blackjack contre le bot')
    .addIntegerOption(option =>
      option
        .setName('mise')
        .setDescription('Montant à miser (10-1000)')
        .setRequired(true)
        .setMinValue(10)
        .setMaxValue(1000)
    ),
  
  // Cooldown of 30 seconds
  cooldown: 30000,
  
  async execute(interaction, client) {
    try {
      const betAmount = interaction.options.getInteger('mise');
      const userId = interaction.user.id;
      
      // Get user data
      const user = await client.db.getUser(userId);
      
      // Check if user has enough credits
      if (user.balance < betAmount) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants',
              `Vous n'avez pas assez de PiloCoins pour ce pari.\nVotre solde: **${user.balance}** PiloCoins`
            )
          ],
          ephemeral: true
        });
      }
      
      await interaction.deferReply();
      
      // Initialize game state
      const game = {
        playerHand: [],
        dealerHand: [],
        deck: this.createDeck(),
        bet: betAmount,
        status: 'playing' // playing, stand, bust, blackjack, dealerBust, push, win, lose
      };
      
      // Shuffle the deck
      this.shuffleDeck(game.deck);
      
      // Deal initial cards
      game.playerHand.push(this.drawCard(game.deck));
      game.dealerHand.push(this.drawCard(game.deck));
      game.playerHand.push(this.drawCard(game.deck));
      game.dealerHand.push(this.drawCard(game.deck));
      
      // Check for blackjack
      const playerValue = this.getHandValue(game.playerHand);
      const dealerValue = this.getHandValue(game.dealerHand);
      
      if (playerValue === 21 && game.playerHand.length === 2) {
        // Player has blackjack
        game.status = 'blackjack';
        
        // Update player balance (pay 3:2 for blackjack)
        const winnings = Math.floor(betAmount * 2.5);
        await client.db.updateUserBalance(userId, winnings - betAmount);
        
        // Create blackjack embed
        const blackjackEmbed = EmbedCreator.success(
          '🎰 Blackjack!',
          `Vous avez un blackjack! Vous gagnez **${winnings}** PiloCoins (mise: **${betAmount}** PiloCoins)`,
          {
            fields: [
              {
                name: '🃏 Votre main',
                value: this.formatHand(game.playerHand) + ` (${playerValue})`,
                inline: true
              },
              {
                name: '🎭 Main du croupier',
                value: this.formatHand(game.dealerHand) + ` (${dealerValue})`,
                inline: true
              },
              {
                name: '💰 Nouveau solde',
                value: `${user.balance + winnings - betAmount} PiloCoins`,
                inline: true
              }
            ],
            timestamp: true
          }
        );
        
        return interaction.editReply({ embeds: [blackjackEmbed] });
      }
      
      // Create the initial game embed
      const gameEmbed = EmbedCreator.create({
        title: '🎰 Blackjack',
        description: `Mise: **${betAmount}** PiloCoins\n\nVotre tour. Que voulez-vous faire?`,
        color: 'PRIMARY',
        fields: [
          {
            name: '🃏 Votre main',
            value: this.formatHand(game.playerHand) + ` (${playerValue})`,
            inline: true
          },
          {
            name: '🎭 Main du croupier',
            value: this.formatHand([game.dealerHand[0], { suit: '?', value: '?' }]) + ` (?)`,
            inline: true
          }
        ],
        footer: { text: 'Piochez pour prendre une carte supplémentaire, ou restez pour terminer votre tour.' },
        timestamp: true
      });
      
      // Create buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`blackjack:hit:${userId}`)
            .setLabel('Piocher')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🃏'),
          new ButtonBuilder()
            .setCustomId(`blackjack:stand:${userId}`)
            .setLabel('Rester')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛑')
        );
      
      // Send the initial game state
      const message = await interaction.editReply({
        embeds: [gameEmbed],
        components: [buttons]
      });
      
      // Store the game state in a collection for button interactions
      if (!client.blackjackGames) {
        client.blackjackGames = new Map();
      }
      
      client.blackjackGames.set(userId, {
        game,
        message,
        interaction
      });
      
      // Set up a timeout to end the game if no interaction
      setTimeout(() => {
        // Check if the game is still active
        if (client.blackjackGames.has(userId)) {
          const gameData = client.blackjackGames.get(userId);
          
          if (gameData.game.status === 'playing') {
            // Auto-stand if no interaction
            this.handleStand(client, userId);
          }
        }
      }, 60000); // 1 minute timeout
      
    } catch (error) {
      console.error('Error in blackjack command:', error);
      
      // Send error message
      const errorEmbed = EmbedCreator.error(
        'Erreur',
        'Une erreur est survenue lors de l\'exécution de la commande.'
      );
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
  
  // Helper methods for blackjack
  createDeck() {
    const suits = ['♠️', '♥️', '♦️', '♣️'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
    
    return deck;
  },
  
  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  },
  
  drawCard(deck) {
    return deck.pop();
  },
  
  getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) {
      return 10;
    } else if (card.value === 'A') {
      return 11; // Ace is initially 11
    } else {
      return parseInt(card.value);
    }
  },
  
  getHandValue(hand) {
    let value = 0;
    let aces = 0;
    
    for (const card of hand) {
      // Skip unknown cards
      if (card.value === '?') continue;
      
      const cardValue = this.getCardValue(card);
      value += cardValue;
      
      // Count aces
      if (card.value === 'A') {
        aces++;
      }
    }
    
    // Adjust for aces
    while (value > 21 && aces > 0) {
      value -= 10; // Change an ace from 11 to 1
      aces--;
    }
    
    return value;
  },
  
  formatHand(hand) {
    return hand.map(card => `${card.suit}${card.value}`).join(' ');
  },
  
  // Handler for hit action
  async handleHit(client, userId, interaction) {
    // Get game state
    const gameData = client.blackjackGames.get(userId);
    if (!gameData) return;
    
    const { game, message } = gameData;
    
    // Draw a card
    game.playerHand.push(this.drawCard(game.deck));
    
    // Calculate hand value
    const playerValue = this.getHandValue(game.playerHand);
    
    // Check for bust
    if (playerValue > 21) {
      game.status = 'bust';
      
      // Player loses bet
      await client.db.updateUserBalance(userId, -game.bet);
      
      // Get user data for updated balance
      const user = await client.db.getUser(userId);
      
      // Create bust embed
      const bustEmbed = EmbedCreator.error(
        '💥 Bust!',
        `Vous avez dépassé 21! Vous perdez votre mise de **${game.bet}** PiloCoins.`,
        {
          fields: [
            {
              name: '🃏 Votre main',
              value: this.formatHand(game.playerHand) + ` (${playerValue})`,
              inline: true
            },
            {
              name: '🎭 Main du croupier',
              value: this.formatHand(game.dealerHand) + ` (${this.getHandValue(game.dealerHand)})`,
              inline: true
            },
            {
              name: '💰 Nouveau solde',
              value: `${user.balance} PiloCoins`,
              inline: true
            }
          ],
          timestamp: true
        }
      );
      
      // Update the message
      await message.edit({
        embeds: [bustEmbed],
        components: []
      });
      
      // Remove game from collection
      client.blackjackGames.delete(userId);
      
      // Acknowledge the interaction
      if (interaction) {
        await interaction.update({
          embeds: [bustEmbed],
          components: []
        });
      }
      
      return;
    }
    
    // Update game embed
    const gameEmbed = EmbedCreator.create({
      title: '🎰 Blackjack',
      description: `Mise: **${game.bet}** PiloCoins\n\nVotre tour. Que voulez-vous faire?`,
      color: 'PRIMARY',
      fields: [
        {
          name: '🃏 Votre main',
          value: this.formatHand(game.playerHand) + ` (${playerValue})`,
          inline: true
        },
        {
          name: '🎭 Main du croupier',
          value: this.formatHand([game.dealerHand[0], { suit: '?', value: '?' }]) + ` (?)`,
          inline: true
        }
      ],
      footer: { text: 'Piochez pour prendre une carte supplémentaire, ou restez pour terminer votre tour.' },
      timestamp: true
    });
    
    // Create buttons
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`blackjack:hit:${userId}`)
          .setLabel('Piocher')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🃏'),
        new ButtonBuilder()
          .setCustomId(`blackjack:stand:${userId}`)
          .setLabel('Rester')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛑')
      );
    
    // Update the message
    if (interaction) {
      await interaction.update({
        embeds: [gameEmbed],
        components: [buttons]
      });
    } else {
      await message.edit({
        embeds: [gameEmbed],
        components: [buttons]
      });
    }
  },
  
  // Handler for stand action
  async handleStand(client, userId, interaction) {
    // Get game state
    const gameData = client.blackjackGames.get(userId);
    if (!gameData) return;
    
    const { game, message } = gameData;
    
    // Mark as standing
    game.status = 'stand';
    
    // Dealer plays
    const playerValue = this.getHandValue(game.playerHand);
    let dealerValue = this.getHandValue(game.dealerHand);
    
    // Dealer hits until 17 or higher
    while (dealerValue < 17) {
      game.dealerHand.push(this.drawCard(game.deck));
      dealerValue = this.getHandValue(game.dealerHand);
    }
    
    // Determine outcome
    let outcome;
    let winnings = 0;
    let color;
    
    if (dealerValue > 21) {
      // Dealer busts
      outcome = 'Le croupier a dépassé 21! Vous gagnez!';
      winnings = game.bet;
      game.status = 'dealerBust';
      color = 'SUCCESS';
    } else if (dealerValue === playerValue) {
      // Push (tie)
      outcome = 'Égalité! Votre mise vous est rendue.';
      winnings = 0;
      game.status = 'push';
      color = 'WARNING';
    } else if (dealerValue > playerValue) {
      // Dealer wins
      outcome = 'Le croupier gagne! Vous perdez votre mise.';
      winnings = -game.bet;
      game.status = 'lose';
      color = 'ERROR';
    } else {
      // Player wins
      outcome = 'Vous gagnez!';
      winnings = game.bet;
      game.status = 'win';
      color = 'SUCCESS';
    }
    
    // Update balance
    await client.db.updateUserBalance(userId, winnings);
    
    // Get user data for updated balance
    const user = await client.db.getUser(userId);
    
    // Create result embed
    const resultEmbed = EmbedCreator.create({
      title: '🎰 Blackjack - Résultat',
      description: `Mise: **${game.bet}** PiloCoins\n\n${outcome}`,
      color,
      fields: [
        {
          name: '🃏 Votre main',
          value: this.formatHand(game.playerHand) + ` (${playerValue})`,
          inline: true
        },
        {
          name: '🎭 Main du croupier',
          value: this.formatHand(game.dealerHand) + ` (${dealerValue})`,
          inline: true
        },
        {
          name: '💰 Résultat',
          value: winnings >= 0 
            ? `+${winnings} PiloCoins`
            : `${winnings} PiloCoins`,
          inline: true
        },
        {
          name: '💰 Nouveau solde',
          value: `${user.balance} PiloCoins`,
          inline: true
        }
      ],
      timestamp: true
    });
    
    // Update the message
    if (interaction) {
      await interaction.update({
        embeds: [resultEmbed],
        components: []
      });
    } else {
      await message.edit({
        embeds: [resultEmbed],
        components: []
      });
    }
    
    // Remove game from collection
    client.blackjackGames.delete(userId);
  }
};