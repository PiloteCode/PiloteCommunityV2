import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

export default {
  customId: 'hotpotato_play',
  execute: async (interaction) => {
    const { client, user, guild } = interaction;
    
    // Game settings
    const maxPlayers = 10;
    const roundTimeMs = 10000; // 10 seconds per round
    
    // Check if there's already a game in progress
    if (client.hotPotatoGame && client.hotPotatoGame.inProgress) {
      return interaction.reply({
        content: 'Un jeu est déjà en cours! Attendez qu\'il se termine.',
        ephemeral: true
      });
    }
    
    // Initialize game
    client.hotPotatoGame = {
      inProgress: true,
      players: [interaction.user],
      creator: interaction.user,
      channel: interaction.channel
    };
    
    // Create the join button
    const joinButton = new ButtonBuilder()
      .setCustomId('hotpotato_join')
      .setLabel('Rejoindre la partie')
      .setStyle(ButtonStyle.Primary);
    
    const startButton = new ButtonBuilder()
      .setCustomId('hotpotato_start')
      .setLabel('Démarrer la partie')
      .setStyle(ButtonStyle.Success);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId('hotpotato_cancel')
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Danger);
    
    const actionRow = new ActionRowBuilder().addComponents(joinButton, startButton, cancelButton);
    
    // Create announcement embed
    const embed = new EmbedBuilder()
      .setTitle('🔥 Hot Potato - Patate Chaude 🔥')
      .setDescription(`${interaction.user} a démarré une partie de patate chaude! Cliquez sur le bouton pour rejoindre la partie.`)
      .setColor('#FF9900')
      .addFields(
        { name: 'Joueurs', value: `${interaction.user}`, inline: false },
        { name: 'Comment jouer', value: 'Passez la patate chaude avant qu\'elle n\'explose! Le dernier joueur à tenir la patate est éliminé chaque manche.', inline: false }
      )
      .setFooter({ text: `Joueurs: 1/${maxPlayers}` });
    
    // Reply with the game invitation
    const message = await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      fetchReply: true
    });
    
    // Store the message for updating
    client.hotPotatoGame.message = message;
    
    // Set a timeout to auto-start or cancel the game if not enough players
    client.hotPotatoGame.timeout = setTimeout(() => {
      if (client.hotPotatoGame && client.hotPotatoGame.players.length < 2) {
        // Cancel the game due to not enough players
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('🔥 Hot Potato - Annulé')
          .setDescription('Pas assez de joueurs pour démarrer la partie.')
          .setColor('#FF0000');
        
        message.edit({
          embeds: [timeoutEmbed],
          components: []
        }).catch(console.error);
        
        // Clear the game
        client.hotPotatoGame = null;
      } else if (client.hotPotatoGame && !client.hotPotatoGame.started) {
        // Auto-start the game
        startHotPotatoGame(client);
      }
    }, 60000); // Wait 1 minute
  }
};

export const joinButton = {
  customId: 'hotpotato_join',
  execute: async (interaction) => {
    const { client, user } = interaction;
    
    // Check if there's a game
    if (!client.hotPotatoGame || client.hotPotatoGame.started) {
      return interaction.reply({
        content: 'Aucune partie disponible en ce moment.',
        ephemeral: true
      });
    }
    
    // Check if player is already in the game
    if (client.hotPotatoGame.players.some(p => p.id === user.id)) {
      return interaction.reply({
        content: 'Vous êtes déjà dans cette partie!',
        ephemeral: true
      });
    }
    
    // Check if game is full
    if (client.hotPotatoGame.players.length >= 10) {
      return interaction.reply({
        content: 'La partie est complète!',
        ephemeral: true
      });
    }
    
    // Add player to the game
    client.hotPotatoGame.players.push(user);
    
    // Update the embed
    const playersList = client.hotPotatoGame.players.map(p => p.toString()).join('\n');
    const updatedEmbed = EmbedBuilder.from(client.hotPotatoGame.message.embeds[0])
      .setFields(
        { name: 'Joueurs', value: playersList, inline: false },
        { name: 'Comment jouer', value: 'Passez la patate chaude avant qu\'elle n\'explose! Le dernier joueur à tenir la patate est éliminé chaque manche.', inline: false }
      )
      .setFooter({ text: `Joueurs: ${client.hotPotatoGame.players.length}/10` });
    
    await client.hotPotatoGame.message.edit({
      embeds: [updatedEmbed]
    });
    
    // Acknowledge the join
    await interaction.reply({
      content: 'Vous avez rejoint la partie de patate chaude!',
      ephemeral: true
    });
  }
};

export const startButton = {
  customId: 'hotpotato_start',
  execute: async (interaction) => {
    const { client, user } = interaction;
    
    // Check if there's a game
    if (!client.hotPotatoGame) {
      return interaction.reply({
        content: 'Aucune partie n\'a été créée.',
        ephemeral: true
      });
    }
    
    // Check if user is the creator
    if (client.hotPotatoGame.creator.id !== user.id) {
      return interaction.reply({
        content: 'Seul le créateur de la partie peut la démarrer.',
        ephemeral: true
      });
    }
    
    // Check if game is already started
    if (client.hotPotatoGame.started) {
      return interaction.reply({
        content: 'La partie est déjà en cours!',
        ephemeral: true
      });
    }
    
    // Check if there are enough players (at least 2)
    if (client.hotPotatoGame.players.length < 2) {
      return interaction.reply({
        content: 'Il faut au moins 2 joueurs pour démarrer la partie.',
        ephemeral: true
      });
    }
    
    // Acknowledge the start
    await interaction.reply({
      content: 'La partie de patate chaude commence!',
      ephemeral: true
    });
    
    // Start the game
    startHotPotatoGame(client);
  }
};

export const cancelButton = {
  customId: 'hotpotato_cancel',
  execute: async (interaction) => {
    const { client, user } = interaction;
    
    // Check if there's a game
    if (!client.hotPotatoGame) {
      return interaction.reply({
        content: 'Aucune partie n\'a été créée.',
        ephemeral: true
      });
    }
    
    // Check if user is the creator
    if (client.hotPotatoGame.creator.id !== user.id) {
      return interaction.reply({
        content: 'Seul le créateur de la partie peut l\'annuler.',
        ephemeral: true
      });
    }
    
    // Check if game is already started
    if (client.hotPotatoGame.started) {
      return interaction.reply({
        content: 'La partie est déjà en cours et ne peut pas être annulée.',
        ephemeral: true
      });
    }
    
    // Clear timeout
    if (client.hotPotatoGame.timeout) {
      clearTimeout(client.hotPotatoGame.timeout);
    }
    
    // Update the message
    const cancelledEmbed = new EmbedBuilder()
      .setTitle('🔥 Hot Potato - Annulé')
      .setDescription(`${user} a annulé la partie.`)
      .setColor('#FF0000');
    
    await client.hotPotatoGame.message.edit({
      embeds: [cancelledEmbed],
      components: []
    });
    
    // Clear the game
    client.hotPotatoGame = null;
    
    // Acknowledge the cancellation
    await interaction.reply({
      content: 'Vous avez annulé la partie de patate chaude.',
      ephemeral: true
    });
  }
};

export const passButton = {
  customId: 'hotpotato_pass',
  execute: async (interaction) => {
    const { client, user } = interaction;
    
    // Check if there's a game in progress
    if (!client.hotPotatoGame || !client.hotPotatoGame.inProgress) {
      return interaction.reply({
        content: 'Aucune partie en cours.',
        ephemeral: true
      });
    }
    
    // Check if the user has the potato
    if (client.hotPotatoGame.currentPlayer.id !== user.id) {
      return interaction.reply({
        content: 'Vous n\'avez pas la patate!',
        ephemeral: true
      });
    }
    
    // Pass the potato to a random next player
    const remainingPlayers = client.hotPotatoGame.activePlayers.filter(p => p.id !== user.id);
    const nextPlayerIndex = Math.floor(Math.random() * remainingPlayers.length);
    const nextPlayer = remainingPlayers[nextPlayerIndex];
    
    // Update game state
    client.hotPotatoGame.currentPlayer = nextPlayer;
    client.hotPotatoGame.passHistory.push(user);
    
    // Reset the timer
    if (client.hotPotatoGame.timer) {
      clearTimeout(client.hotPotatoGame.timer);
    }
    
    // Set the timeout for the next player
    client.hotPotatoGame.timer = setTimeout(() => {
      if (client.hotPotatoGame && client.hotPotatoGame.inProgress) {
        handleExplosion(client);
      }
    }, client.hotPotatoGame.timeLimit);
    
    // Update the message
    const updatedEmbed = EmbedBuilder.from(client.hotPotatoGame.gameMessage.embeds[0])
      .setDescription(`${user} a passé la patate à ${nextPlayer}! ⏱️ ${Math.floor(client.hotPotatoGame.timeLimit / 1000)} secondes!`)
      .setColor('#FFA500');
    
    // Create the pass button
    const passButton = new ButtonBuilder()
      .setCustomId('hotpotato_pass')
      .setLabel('Passer la patate! 🔥')
      .setStyle(ButtonStyle.Danger);
    
    const actionRow = new ActionRowBuilder().addComponents(passButton);
    
    await client.hotPotatoGame.gameMessage.edit({
      embeds: [updatedEmbed],
      components: [actionRow]
    });
    
    // Acknowledge the pass
    await interaction.reply({
      content: `Vous avez passé la patate à ${nextPlayer}!`,
      ephemeral: true
    });
  }
};

// Function to start the hot potato game
function startHotPotatoGame(client) {
  const game = client.hotPotatoGame;
  
  // Mark game as started
  game.started = true;
  
  // Clear the join timeout
  if (game.timeout) {
    clearTimeout(game.timeout);
  }
  
  // Setup the active players
  game.activePlayers = [...game.players];
  game.eliminatedPlayers = [];
  game.round = 1;
  
  // Update the original message
  const startEmbed = new EmbedBuilder()
    .setTitle('🔥 Hot Potato - Partie en cours! 🔥')
    .setDescription('La partie a commencé! Surveillez le canal pour voir qui a la patate chaude!')
    .setColor('#00FF00')
    .addFields(
      { name: 'Joueurs', value: game.players.map(p => p.toString()).join('\n'), inline: false }
    );
  
  game.message.edit({
    embeds: [startEmbed],
    components: []
  }).catch(console.error);
  
  // Start the first round
  startNewRound(client);
}

// Function to start a new round
async function startNewRound(client) {
  const game = client.hotPotatoGame;
  
  // Clear any existing timers
  if (game.timer) {
    clearTimeout(game.timer);
  }
  
  // Select a random player to start with the potato
  const randomIndex = Math.floor(Math.random() * game.activePlayers.length);
  game.currentPlayer = game.activePlayers[randomIndex];
  game.passHistory = [];
  
  // Set time limit (gets shorter each round)
  const baseTime = 10000; // 10 seconds
  const minTime = 3000; // 3 seconds
  game.timeLimit = Math.max(baseTime - (game.round - 1) * 1000, minTime);
  
  // Create the round announcement
  const roundEmbed = new EmbedBuilder()
    .setTitle(`🔥 Hot Potato - Manche ${game.round} 🔥`)
    .setDescription(`${game.currentPlayer} a la patate chaude! ⏱️ ${Math.floor(game.timeLimit / 1000)} secondes!`)
    .setColor('#FF9900')
    .addFields(
      { name: 'Joueurs restants', value: game.activePlayers.map(p => p.toString()).join('\n'), inline: false }
    );
  
  if (game.eliminatedPlayers.length > 0) {
    roundEmbed.addFields({ 
      name: 'Joueurs éliminés', 
      value: game.eliminatedPlayers.map(p => p.toString()).join('\n'), 
      inline: false 
    });
  }
  
  // Create the pass button
  const passButton = new ButtonBuilder()
    .setCustomId('hotpotato_pass')
    .setLabel('Passer la patate! 🔥')
    .setStyle(ButtonStyle.Danger);
  
  const actionRow = new ActionRowBuilder().addComponents(passButton);
  
  // Send the round message
  const gameMessage = await game.channel.send({
    embeds: [roundEmbed],
    components: [actionRow]
  });
  
  // Store the game message for updating
  game.gameMessage = gameMessage;
  
  // Set the timer for explosion
  game.timer = setTimeout(() => {
    if (client.hotPotatoGame && client.hotPotatoGame.inProgress) {
      handleExplosion(client);
    }
  }, game.timeLimit);
}

// Function to handle the explosion
async function handleExplosion(client) {
  const game = client.hotPotatoGame;
  
  // Announce the explosion
  const explosionEmbed = new EmbedBuilder()
    .setTitle('💥 BOOM! 💥')
    .setDescription(`La patate a explosé! ${game.currentPlayer} est éliminé!`)
    .setColor('#FF0000');
  
  await game.channel.send({
    embeds: [explosionEmbed]
  });
  
  // Remove the player from active players
  game.eliminatedPlayers.push(game.currentPlayer);
  game.activePlayers = game.activePlayers.filter(p => p.id !== game.currentPlayer.id);
  
  // Check if the game is over
  if (game.activePlayers.length <= 1) {
    // We have a winner!
    const winner = game.activePlayers[0];
    
    const winnerEmbed = new EmbedBuilder()
      .setTitle('🎉 Hot Potato - Fin de la partie! 🎉')
      .setDescription(`${winner} a gagné la partie!`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Gagnant', value: winner.toString(), inline: false },
        { name: 'Joueurs éliminés', value: game.eliminatedPlayers.map(p => p.toString()).join('\n'), inline: false }
      );
    
    await game.channel.send({
      embeds: [winnerEmbed]
    });
    
    // Clean up the game
    client.hotPotatoGame = null;
  } else {
    // Start the next round
    game.round++;
    setTimeout(() => startNewRound(client), 3000);
  }
}