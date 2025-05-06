import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('word-chain')
    .setDescription('Jouez à une partie de chaîne de mots avec d\'autres membres')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Démarrer une nouvelle partie de chaîne de mots')
        .addStringOption(option =>
          option.setName('mode')
            .setDescription('Mode de jeu')
            .setRequired(true)
            .addChoices(
              { name: 'Normal - Commence par la dernière lettre', value: 'normal' },
              { name: 'Syllabe - Commence par la dernière syllabe', value: 'syllable' },
              { name: 'Thématique - Mots du même thème', value: 'theme' }
            ))
        .addStringOption(option =>
          option.setName('theme')
            .setDescription('Thème (uniquement pour le mode thématique)')
            .setRequired(false)
            .addChoices(
              { name: 'Animaux', value: 'animals' },
              { name: 'Pays/Villes', value: 'places' },
              { name: 'Nourriture', value: 'food' },
              { name: 'Sports', value: 'sports' },
              { name: 'Films/Séries', value: 'movies' }
            ))
        .addIntegerOption(option =>
          option.setName('mise')
            .setDescription('Mise pour participer (50-500 PiloCoins)')
            .setRequired(false)
            .setMinValue(50)
            .setMaxValue(500))
        .addIntegerOption(option =>
          option.setName('temps')
            .setDescription('Temps pour répondre en secondes (15-120)')
            .setRequired(false)
            .setMinValue(15)
            .setMaxValue(120)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Rejoindre une partie de chaîne de mots en cours'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Voir vos statistiques de chaîne de mots')),

  cooldown: 10000, // 10 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Créer la table si elle n'existe pas
      await createWordChainTable(client);
      
      if (subcommand === 'start') {
        // Vérifier si l'utilisateur a déjà une partie en cours
        const activeGame = await getActiveGame(client, userId);
        
        if (activeGame) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                '🔤 Partie déjà en cours',
                `Vous avez déjà une partie de chaîne de mots en cours. Vous devez terminer ou annuler cette partie avant d'en commencer une nouvelle.`
              )
            ]
          });
        }
        
        // Récupérer les options
        const mode = interaction.options.getString('mode');
        const theme = interaction.options.getString('theme');
        const bet = interaction.options.getInteger('mise') || 50; // Valeur par défaut: 50
        const timeLimit = interaction.options.getInteger('temps') || 30; // Valeur par défaut: 30 secondes
        
        // Vérifier que le thème est spécifié si le mode est thématique
        if (mode === 'theme' && !theme) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Thème requis',
                `Le mode thématique nécessite de spécifier un thème. Utilisez l'option 'theme' pour en sélectionner un.`
              )
            ]
          });
        }
        
        // Récupérer les données utilisateur
        const user = await client.db.getUser(userId);
        
        // Vérifier si l'utilisateur a assez de PiloCoins
        if (user.balance < bet) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'PiloCoins insuffisants',
                `Vous avez besoin de ${bet} PiloCoins pour créer cette partie. Vous n'avez que ${user.balance} PiloCoins.`
              )
            ]
          });
        }
        
        // Déduire la mise
        await client.db.updateUserBalance(userId, -bet);
        
        // Créer la partie
        const gameId = await createNewWordChainGame(client, userId, mode, theme, bet, timeLimit);
        
        // Mettre à jour les statistiques de l'utilisateur
        await updateWordChainStats(client, userId, {
          games_started: 1,
          games_joined: 1,
          pilocoins_spent: bet
        });
        
        // Créer l'embed d'invitation
        let modeDescription;
        switch (mode) {
          case 'normal':
            modeDescription = 'Chaque mot doit commencer par la dernière lettre du mot précédent.';
            break;
          case 'syllable':
            modeDescription = 'Chaque mot doit commencer par la dernière syllabe du mot précédent.';
            break;
          case 'theme':
            modeDescription = `Tous les mots doivent appartenir au thème "${getThemeName(theme)}". Ils doivent aussi commencer par la dernière lettre du mot précédent.`;
            break;
        }
        
        const embed = EmbedCreator.success(
          '🔤 Chaîne de mots - Nouvelle partie!',
          `${interaction.user} a créé une nouvelle partie de chaîne de mots! Pour participer, utilisez la commande \`/word-chain join\` ou cliquez sur le bouton ci-dessous. La partie commencera dans 60 secondes ou lorsque 4 joueurs auront rejoint.`,
          {
            fields: [
              {
                name: '🎮 Mode',
                value: `${getModeName(mode)}`,
                inline: true
              },
              {
                name: '⏱️ Temps de réponse',
                value: `${timeLimit} secondes`,
                inline: true
              },
              {
                name: '💰 Mise d\'entrée',
                value: `${bet} PiloCoins`,
                inline: true
              },
              {
                name: '📏 Règles',
                value: modeDescription,
                inline: false
              },
              {
                name: '👥 Participants (1/4)',
                value: `${interaction.user}`,
                inline: true
              },
              {
                name: '⏱️ Démarrage',
                value: `<t:${Math.floor(Date.now() / 1000) + 60}:R>`,
                inline: true
              }
            ]
          }
        );
        
        // Créer le bouton pour rejoindre
        const joinButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`wordchain_join_${gameId}`)
              .setLabel('Rejoindre la partie')
              .setStyle(ButtonStyle.Success)
          );
        
        // Envoyer le message d'invitation
        const reply = await interaction.editReply({
          embeds: [embed],
          components: [joinButton]
        });
        
        // Enregistrer l'ID du message
        await client.db.db.run(`
          UPDATE word_chain_games
          SET message_id = ?, channel_id = ?
          WHERE id = ?
        `, reply.id, interaction.channelId, gameId);
        
        // Stocker le message dans une map pour faciliter les mises à jour
        if (!client.wordChainMessages) client.wordChainMessages = new Map();
        client.wordChainMessages.set(gameId, {
          channelId: interaction.channelId,
          messageId: reply.id
        });
        
        // Démarrer le timer pour lancer la partie
        setTimeout(async () => {
          try {
            // Vérifier si la partie est toujours en attente
            const game = await client.db.db.get(`
              SELECT * FROM word_chain_games
              WHERE id = ? AND status = 'waiting'
            `, gameId);
            
            if (game) {
              // Récupérer les participants
              const participants = await client.db.db.all(`
                SELECT * FROM word_chain_participants
                WHERE game_id = ?
              `, gameId);
              
              // S'il y a au moins 2 participants, démarrer la partie
              if (participants.length >= 2) {
                await startWordChainGame(client, gameId, interaction.channel);
              } else {
                // Annuler la partie et rembourser les participants
                await cancelWordChainGame(client, gameId, 'Pas assez de participants (2 minimum requis).');
                
                // Créer l'embed d'annulation
                const cancelEmbed = EmbedCreator.error(
                  '❌ Partie annulée',
                  `La partie a été annulée car il n'y avait pas assez de participants (2 minimum requis). Les PiloCoins ont été remboursés.`
                );
                
                // Mettre à jour le message
                try {
                  await interaction.channel.messages.edit(reply.id, {
                    embeds: [cancelEmbed],
                    components: []
                  });
                } catch (err) {
                  console.error('Error updating word chain message:', err);
                }
              }
            }
          } catch (error) {
            console.error('Error starting word chain game:', error);
          }
        }, 60000); // 60 secondes
        
        return;
      }
      
      else if (subcommand === 'join') {
        // Récupérer les parties en attente
        const waitingGames = await client.db.db.all(`
          SELECT g.*, 
                 (SELECT COUNT(*) FROM word_chain_participants WHERE game_id = g.id) AS participant_count,
                 (SELECT GROUP_CONCAT(user_id) FROM word_chain_participants WHERE game_id = g.id) AS participant_ids
          FROM word_chain_games g
          WHERE g.status = 'waiting'
          ORDER BY g.created_at DESC
          LIMIT 5
        `);
        
        if (waitingGames.length === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.info(
                '🔤 Aucune partie en attente',
                `Il n'y a actuellement aucune partie de chaîne de mots en attente de joueurs. Utilisez \`/word-chain start\` pour en créer une nouvelle.`
              )
            ]
          });
        }
        
        // Vérifier si l'utilisateur participe déjà à une partie
        for (const game of waitingGames) {
          const participantIds = game.participant_ids ? game.participant_ids.split(',') : [];
          
          if (participantIds.includes(userId)) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.warning(
                  '🔤 Déjà inscrit',
                  `Vous participez déjà à une partie de chaîne de mots en attente. Attendez qu'elle démarre ou qu'elle soit annulée.`
                )
              ]
            });
          }
        }
        
        // Récupérer les données utilisateur
        const user = await client.db.getUser(userId);
        
        // Préparer les boutons pour rejoindre les parties
        const buttonRows = [];
        const gameOptions = [];
        
        for (let i = 0; i < waitingGames.length; i++) {
          const game = waitingGames[i];
          
          // Vérifier si la partie n'est pas pleine
          if (game.participant_count >= 4) continue;
          
          // Vérifier si l'utilisateur a assez de PiloCoins
          const canAfford = user.balance >= game.entry_fee;
          
          const creator = await client.users.fetch(game.creator_id).catch(() => null);
          
          gameOptions.push({
            name: `Partie #${game.id} par ${creator ? creator.username : 'Inconnu'}`,
            value: `${game.id}`,
            description: `${getModeName(game.mode)} - ${game.entry_fee} PiloCoins - ${game.participant_count}/4 joueurs`,
            disabled: !canAfford
          });
          
          if (gameOptions.length % 5 === 0 || i === waitingGames.length - 1) {
            const row = new ActionRowBuilder();
            
            for (const option of gameOptions) {
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`wordchain_join_${option.value}`)
                  .setLabel(option.name)
                  .setStyle(ButtonStyle.Success)
                  .setDisabled(option.disabled)
              );
            }
            
            if (row.components.length > 0) {
              buttonRows.push(row);
            }
            
            gameOptions.length = 0;
          }
        }
        
        if (buttonRows.length === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.info(
                '🔤 Aucune partie disponible',
                `Il n'y a actuellement aucune partie de chaîne de mots disponible que vous puissiez rejoindre. Les parties existantes sont soit pleines, soit vous n'avez pas assez de PiloCoins pour la mise d'entrée. Utilisez \`/word-chain start\` pour en créer une nouvelle.`
              )
            ]
          });
        }
        
        // Créer l'embed de liste de parties
        const embed = EmbedCreator.info(
          '🔤 Parties disponibles',
          `Voici les parties de chaîne de mots disponibles auxquelles vous pouvez participer. Cliquez sur un bouton pour rejoindre une partie.`,
          {
            fields: [
              {
                name: '💰 Votre solde',
                value: `${user.balance} PiloCoins`,
                inline: false
              }
            ]
          }
        );
        
        return interaction.editReply({
          embeds: [embed],
          components: buttonRows.slice(0, 5) // Discord limite à 5 rangées de boutons
        });
      }
      
      else if (subcommand === 'stats') {
        // Récupérer les statistiques de l'utilisateur
        const stats = await getWordChainStats(client, userId);
        
        // Créer l'embed de statistiques
        const embed = EmbedCreator.economy(
          '📊 Statistiques de chaîne de mots',
          `Voici vos statistiques pour les parties de chaîne de mots:`,
          {
            fields: [
              {
                name: '🎮 Parties créées',
                value: `${stats.games_started}`,
                inline: true
              },
              {
                name: '🎲 Parties jouées',
                value: `${stats.games_joined}`,
                inline: true
              },
              {
                name: '🥇 Victoires',
                value: `${stats.games_won}`,
                inline: true
              },
              {
                name: '💯 Taux de victoire',
                value: `${stats.games_joined > 0 ? Math.round((stats.games_won / stats.games_joined) * 100) : 0}%`,
                inline: true
              },
              {
                name: '🔤 Mots soumis',
                value: `${stats.words_submitted}`,
                inline: true
              },
              {
                name: '❌ Mots invalides',
                value: `${stats.invalid_words}`,
                inline: true
              },
              {
                name: '🏆 Plus longue chaîne',
                value: `${stats.longest_chain} mots`,
                inline: true
              },
              {
                name: '💰 PiloCoins gagnés',
                value: `${stats.pilocoins_earned}`,
                inline: true
              },
              {
                name: '💸 PiloCoins dépensés',
                value: `${stats.pilocoins_spent}`,
                inline: true
              },
              {
                name: '📈 Profit net',
                value: `${stats.pilocoins_earned - stats.pilocoins_spent}`,
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
      console.error('Error in word-chain command:', error);
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

// Fonction pour créer les tables de chaîne de mots
async function createWordChainTable(client) {
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS word_chain_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      theme TEXT,
      entry_fee INTEGER NOT NULL,
      time_limit INTEGER NOT NULL,
      current_turn INTEGER DEFAULT 0,
      last_word TEXT,
      last_letter TEXT,
      chain_length INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting',
      message_id TEXT,
      channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS word_chain_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      turn_order INTEGER NOT NULL,
      is_eliminated INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES word_chain_games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE(game_id, user_id)
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS word_chain_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      word TEXT NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      turn_number INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES word_chain_games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS word_chain_stats (
      user_id TEXT PRIMARY KEY,
      games_started INTEGER NOT NULL DEFAULT 0,
      games_joined INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      words_submitted INTEGER NOT NULL DEFAULT 0,
      invalid_words INTEGER NOT NULL DEFAULT 0,
      longest_chain INTEGER NOT NULL DEFAULT 0,
      pilocoins_earned INTEGER NOT NULL DEFAULT 0,
      pilocoins_spent INTEGER NOT NULL DEFAULT 0,
      last_played TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
}

// Fonction pour récupérer une partie active
async function getActiveGame(client, userId) {
  // Vérifier si l'utilisateur a créé une partie en attente ou en cours
  const createdGame = await client.db.db.get(`
    SELECT * FROM word_chain_games
    WHERE creator_id = ? AND status IN ('waiting', 'in_progress')
    ORDER BY created_at DESC
    LIMIT 1
  `, userId);
  
  if (createdGame) return createdGame;
  
  // Vérifier si l'utilisateur participe à une partie en cours
  const participatedGame = await client.db.db.get(`
    SELECT g.*
    FROM word_chain_games g
    JOIN word_chain_participants p ON g.id = p.game_id
    WHERE p.user_id = ? AND g.status = 'in_progress'
    ORDER BY g.created_at DESC
    LIMIT 1
  `, userId);
  
  return participatedGame;
}

// Fonction pour créer une nouvelle partie
async function createNewWordChainGame(client, creatorId, mode, theme, entryFee, timeLimit) {
  // Insérer la nouvelle partie
  const result = await client.db.db.run(`
    INSERT INTO word_chain_games (
      creator_id, mode, theme, entry_fee, time_limit, status
    ) VALUES (?, ?, ?, ?, ?, 'waiting')
  `, creatorId, mode, theme, entryFee, timeLimit);
  
  const gameId = result.lastID;
  
  // Ajouter le créateur comme premier participant
  await client.db.db.run(`
    INSERT INTO word_chain_participants (
      game_id, user_id, turn_order
    ) VALUES (?, ?, 1)
  `, gameId, creatorId);
  
  return gameId;
}

// Fonction pour démarrer une partie
async function startWordChainGame(client, gameId, channel) {
  try {
    // Mettre à jour le statut de la partie
    await client.db.db.run(`
      UPDATE word_chain_games
      SET status = 'in_progress', current_turn = 1, updated_at = datetime('now')
      WHERE id = ?
    `, gameId);
    
    // Récupérer les informations de la partie
    const game = await client.db.db.get(`
      SELECT * FROM word_chain_games
      WHERE id = ?
    `, gameId);
    
    // Récupérer les participants
    let participants = await client.db.db.all(`
      SELECT * FROM word_chain_participants
      WHERE game_id = ?
    `, gameId);
    
    // Mélanger l'ordre des participants
    shuffleArray(participants);
    
    // Mettre à jour l'ordre des tours
    for (let i = 0; i < participants.length; i++) {
      await client.db.db.run(`
        UPDATE word_chain_participants
        SET turn_order = ?
        WHERE id = ?
      `, i + 1, participants[i].id);
    }
    
    // Récupérer les participants mis à jour
    participants = await client.db.db.all(`
      SELECT * FROM word_chain_participants
      WHERE game_id = ?
      ORDER BY turn_order
    `, gameId);
    
    // Créer l'embed d'annonce de démarrage
    const participantsList = await Promise.all(
      participants.map(async (p, index) => {
        const user = await client.users.fetch(p.user_id).catch(() => null);
        return user ? `${index + 1}. ${user.toString()}` : `${index + 1}. Inconnu`;
      })
    );
    
    const startEmbed = EmbedCreator.success(
      '🔤 La partie commence!',
      `La partie de chaîne de mots #${gameId} commence maintenant! Voici l'ordre des joueurs:`,
      {
        fields: [
          {
            name: '👥 Ordre des tours',
            value: participantsList.join('\n'),
            inline: false
          },
          {
            name: '🏆 Prix',
            value: `${game.entry_fee * participants.length} PiloCoins`,
            inline: true
          },
          {
            name: '⏱️ Temps de réponse',
            value: `${game.time_limit} secondes`,
            inline: true
          },
          {
            name: '🎮 Mode',
            value: getModeName(game.mode),
            inline: true
          }
        ]
      }
    );
    
    // Mettre à jour le message d'invitation
    const messageInfo = client.wordChainMessages.get(gameId);
    if (messageInfo) {
      try {
        await channel.messages.edit(messageInfo.messageId, {
          embeds: [startEmbed],
          components: []
        });
      } catch (err) {
        console.error('Error updating word chain message:', err);
      }
    }
    
    // Attendre 3 secondes avant de commencer le premier tour
    setTimeout(async () => {
      await startNextTurn(client, gameId, channel);
    }, 3000);
    
  } catch (error) {
    console.error('Error starting word chain game:', error);
    await cancelWordChainGame(client, gameId, 'Une erreur est survenue lors du démarrage de la partie.');
  }
}

// Fonction pour commencer le tour suivant
async function startNextTurn(client, gameId, channel) {
  try {
    // Récupérer les informations de la partie
    const game = await client.db.db.get(`
      SELECT * FROM word_chain_games
      WHERE id = ?
    `, gameId);
    
    // Vérifier si la partie est toujours en cours
    if (game.status !== 'in_progress') {
      return;
    }
    
    // Récupérer les participants non éliminés
    const participants = await client.db.db.all(`
      SELECT * FROM word_chain_participants
      WHERE game_id = ? AND is_eliminated = 0
      ORDER BY turn_order
    `, gameId);
    
    // Si un seul participant reste, c'est le gagnant
    if (participants.length === 1) {
      return endWordChainGame(client, gameId, channel, participants[0].user_id);
    }
    
    // Déterminer le joueur actuel
    const currentTurnOrder = (game.current_turn - 1) % participants.length + 1;
    const currentPlayer = participants.find(p => p.turn_order === currentTurnOrder);
    
    if (!currentPlayer) {
      // Si aucun joueur correspondant n'est trouvé, utiliser le premier joueur
      const firstPlayer = participants[0];
      
      // Mettre à jour le numéro de tour
      await client.db.db.run(`
        UPDATE word_chain_games
        SET current_turn = ?
        WHERE id = ?
      `, firstPlayer.turn_order, gameId);
      
      return startNextTurn(client, gameId, channel);
    }
    
    // Récupérer l'utilisateur Discord
    const user = await client.users.fetch(currentPlayer.user_id).catch(() => null);
    
    if (!user) {
      // Si l'utilisateur n'est pas trouvé, passer au joueur suivant
      await client.db.db.run(`
        UPDATE word_chain_games
        SET current_turn = current_turn + 1
        WHERE id = ?
      `, gameId);
      
      return startNextTurn(client, gameId, channel);
    }
    
    // Créer l'embed pour le tour
    let turnEmbed;
    
    if (game.last_word) {
      // Tour normal
      turnEmbed = EmbedCreator.info(
        `🔤 Tour ${game.current_turn}`,
        `C'est au tour de ${user} de trouver un mot!`,
        {
          fields: [
            {
              name: '🔤 Dernier mot',
              value: game.last_word,
              inline: true
            },
            {
              name: game.mode === 'syllable' ? '🔤 Dernière syllabe' : '🔤 Dernière lettre',
              value: game.last_letter,
              inline: true
            },
            {
              name: '⏱️ Temps restant',
              value: `${game.time_limit} secondes`,
              inline: true
            },
            {
              name: '📏 Instructions',
              value: getInstructions(game),
              inline: false
            }
          ]
        }
      );
    } else {
      // Premier tour
      turnEmbed = EmbedCreator.info(
        `🔤 Tour ${game.current_turn}`,
        `C'est au tour de ${user} de trouver le premier mot!`,
        {
          fields: [
            {
              name: '⏱️ Temps restant',
              value: `${game.time_limit} secondes`,
              inline: true
            },
            {
              name: '📏 Instructions',
              value: getInstructions(game),
              inline: false
            }
          ]
        }
      );
    }
    
    // Créer le bouton pour répondre
    const answerButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`wordchain_answer_${gameId}`)
          .setLabel('Proposer un mot')
          .setStyle(ButtonStyle.Primary)
      );
    
    // Envoyer le message du tour
    const turnMessage = await channel.send({
      embeds: [turnEmbed],
      components: [answerButton]
    });
    
    // Stocker l'ID du message dans une map
    if (!client.wordChainTurns) client.wordChainTurns = new Map();
    client.wordChainTurns.set(gameId, {
      messageId: turnMessage.id,
      channelId: channel.id,
      userId: currentPlayer.user_id,
      timeout: setTimeout(async () => {
        await handleTimeout(client, gameId, channel, currentPlayer.user_id);
      }, game.time_limit * 1000)
    });
    
  } catch (error) {
    console.error('Error starting next turn:', error);
    await cancelWordChainGame(client, gameId, 'Une erreur est survenue lors du démarrage du tour suivant.');
  }
}

// Fonction pour gérer un timeout
async function handleTimeout(client, gameId, channel, userId) {
  try {
    // Récupérer les informations du tour
    const turnInfo = client.wordChainTurns.get(gameId);
    
    if (!turnInfo) return;
    
    // Nettoyer les ressources
    clearTimeout(turnInfo.timeout);
    client.wordChainTurns.delete(gameId);
    
    // Récupérer les informations de la partie
    const game = await client.db.db.get(`
      SELECT * FROM word_chain_games
      WHERE id = ?
    `, gameId);
    
    // Vérifier si la partie est toujours en cours
    if (game.status !== 'in_progress') {
      return;
    }
    
    // Récupérer l'utilisateur Discord
    const user = await client.users.fetch(userId).catch(() => null);
    
    // Marquer le joueur comme éliminé
    await client.db.db.run(`
      UPDATE word_chain_participants
      SET is_eliminated = 1
      WHERE game_id = ? AND user_id = ?
    `, gameId, userId);
    
    // Mettre à jour les statistiques du joueur
    await updateWordChainStats(client, userId, {
      invalid_words: 1
    });
    
    // Créer l'embed d'élimination
    const timeoutEmbed = EmbedCreator.error(
      '⏱️ Temps écoulé!',
      `${user ? user.toString() : 'Le joueur'} n'a pas répondu à temps et est éliminé!`,
      {
        fields: [
          {
            name: '🔤 Chaîne actuelle',
            value: `${game.chain_length} mots`,
            inline: true
          }
        ]
      }
    );
    
    // Envoyer le message d'élimination
    await channel.send({ embeds: [timeoutEmbed] });
    
    // Passer au joueur suivant
    await client.db.db.run(`
      UPDATE word_chain_games
      SET current_turn = current_turn + 1
      WHERE id = ?
    `, gameId);
    
    // Attendre 2 secondes avant de passer au tour suivant
    setTimeout(async () => {
      await startNextTurn(client, gameId, channel);
    }, 2000);
    
  } catch (error) {
    console.error('Error handling timeout:', error);
  }
}

// Fonction pour annuler une partie
async function cancelWordChainGame(client, gameId, reason) {
  try {
    // Mettre à jour le statut de la partie
    await client.db.db.run(`
      UPDATE word_chain_games
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `, gameId);
    
    // Récupérer les participants
    const participants = await client.db.db.all(`
      SELECT * FROM word_chain_participants
      WHERE game_id = ?
    `, gameId);
    
    // Récupérer les informations de la partie
    const game = await client.db.db.get(`
      SELECT * FROM word_chain_games
      WHERE id = ?
    `, gameId);
    
    // Rembourser les participants
    for (const participant of participants) {
      await client.db.updateUserBalance(participant.user_id, game.entry_fee);
    }
    
    // Nettoyer les ressources
    client.wordChainMessages.delete(gameId);
    
    const turnInfo = client.wordChainTurns.get(gameId);
    if (turnInfo) {
      clearTimeout(turnInfo.timeout);
      client.wordChainTurns.delete(gameId);
    }
    
    console.log(`Word chain game #${gameId} cancelled: ${reason}`);
    
  } catch (error) {
    console.error('Error cancelling word chain game:', error);
  }
}

// Fonction pour terminer une partie
async function endWordChainGame(client, gameId, channel, winnerId) {
  try {
    // Mettre à jour le statut de la partie
    await client.db.db.run(`
      UPDATE word_chain_games
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `, gameId);
    
    // Récupérer les informations de la partie
    const game = await client.db.db.get(`
      SELECT * FROM word_chain_games
      WHERE id = ?
    `, gameId);
    
    // Récupérer les participants
    const participants = await client.db.db.all(`
      SELECT * FROM word_chain_participants
      WHERE game_id = ?
    `, gameId);
    
    // Récupérer les mots utilisés
    const words = await client.db.db.all(`
      SELECT * FROM word_chain_words
      WHERE game_id = ? AND is_valid = 1
      ORDER BY turn_number
    `, gameId);
    
    // Calculer les gains
    const totalPrize = game.entry_fee * participants.length;
    
    // Attribuer le prix au gagnant
    await client.db.updateUserBalance(winnerId, totalPrize);
    
    // Mettre à jour les statistiques du gagnant
    await updateWordChainStats(client, winnerId, {
      games_won: 1,
      pilocoins_earned: totalPrize,
      longest_chain: Math.max(game.chain_length, 0)
    });
    
    // Récupérer l'utilisateur Discord
    const winner = await client.users.fetch(winnerId).catch(() => null);
    
    // Créer l'embed de fin de partie
    const endEmbed = EmbedCreator.success(
      '🏆 Partie terminée!',
      `La partie de chaîne de mots #${gameId} est terminée! ${winner ? winner.toString() : 'Le joueur'} remporte ${totalPrize} PiloCoins!`,
      {
        fields: [
          {
            name: '🔤 Mots de la chaîne',
            value: words.length > 0 
              ? words.map(w => w.word).join(' → ')
              : 'Aucun mot n\'a été proposé.',
            inline: false
          },
          {
            name: '📏 Longueur de la chaîne',
            value: `${game.chain_length} mots`,
            inline: true
          },
          {
            name: '🎮 Mode',
            value: getModeName(game.mode),
            inline: true
          },
          {
            name: '👥 Participants',
            value: `${participants.length}`,
            inline: true
          }
        ]
      }
    );
    
    // Envoyer l'embed de fin
    await channel.send({ embeds: [endEmbed] });
    
    // Nettoyer les ressources
    client.wordChainMessages.delete(gameId);
    
    const turnInfo = client.wordChainTurns.get(gameId);
    if (turnInfo) {
      clearTimeout(turnInfo.timeout);
      client.wordChainTurns.delete(gameId);
    }
    
  } catch (error) {
    console.error('Error ending word chain game:', error);
  }
}

// Fonction pour mettre à jour les statistiques de chaîne de mots
async function updateWordChainStats(client, userId, updates) {
  // Vérifier si l'utilisateur a déjà des statistiques
  const stats = await client.db.db.get(`
    SELECT * FROM word_chain_stats
    WHERE user_id = ?
  `, userId);
  
  if (!stats) {
    // Créer une entrée pour l'utilisateur
    await client.db.db.run(`
      INSERT INTO word_chain_stats (
        user_id, 
        games_started, 
        games_joined, 
        games_won, 
        words_submitted, 
        invalid_words, 
        longest_chain, 
        pilocoins_earned, 
        pilocoins_spent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 
      userId, 
      updates.games_started || 0, 
      updates.games_joined || 0, 
      updates.games_won || 0, 
      updates.words_submitted || 0, 
      updates.invalid_words || 0, 
      updates.longest_chain || 0, 
      updates.pilocoins_earned || 0, 
      updates.pilocoins_spent || 0
    );
    
    return;
  }
  
  // Construire la requête de mise à jour
  let query = 'UPDATE word_chain_stats SET ';
  const params = [];
  
  // Ajouter les champs à mettre à jour
  if (updates.games_started) {
    query += 'games_started = games_started + ?, ';
    params.push(updates.games_started);
  }
  
  if (updates.games_joined) {
    query += 'games_joined = games_joined + ?, ';
    params.push(updates.games_joined);
  }
  
  if (updates.games_won) {
    query += 'games_won = games_won + ?, ';
    params.push(updates.games_won);
  }
  
  if (updates.words_submitted) {
    query += 'words_submitted = words_submitted + ?, ';
    params.push(updates.words_submitted);
  }
  
  if (updates.invalid_words) {
    query += 'invalid_words = invalid_words + ?, ';
    params.push(updates.invalid_words);
  }
  
  if (updates.longest_chain) {
    query += 'longest_chain = CASE WHEN longest_chain < ? THEN ? ELSE longest_chain END, ';
    params.push(updates.longest_chain, updates.longest_chain);
  }
  
  if (updates.pilocoins_earned) {
    query += 'pilocoins_earned = pilocoins_earned + ?, ';
    params.push(updates.pilocoins_earned);
  }
  
  if (updates.pilocoins_spent) {
    query += 'pilocoins_spent = pilocoins_spent + ?, ';
    params.push(updates.pilocoins_spent);
  }
  
  query += 'last_played = datetime(\'now\') WHERE user_id = ?';
  params.push(userId);
  
  // Exécuter la mise à jour
  await client.db.db.run(query, ...params);
}

// Fonction pour récupérer les statistiques de chaîne de mots
async function getWordChainStats(client, userId) {
  // Vérifier si l'utilisateur a déjà des statistiques
  const stats = await client.db.db.get(`
    SELECT * FROM word_chain_stats
    WHERE user_id = ?
  `, userId);
  
  if (!stats) {
    // Retourner des statistiques vides
    return {
      user_id: userId,
      games_started: 0,
      games_joined: 0,
      games_won: 0,
      words_submitted: 0,
      invalid_words: 0,
      longest_chain: 0,
      pilocoins_earned: 0,
      pilocoins_spent: 0,
      last_played: null
    };
  }
  
  return stats;
}

// Fonction pour obtenir les instructions en fonction du mode de jeu
function getInstructions(game) {
  switch (game.mode) {
    case 'normal':
      return `Proposez un mot qui commence par ${game.last_letter ? `la lettre "${game.last_letter.toUpperCase()}"` : "n'importe quelle lettre"}.`;
    case 'syllable':
      return `Proposez un mot qui commence par ${game.last_letter ? `la syllabe "${game.last_letter}"` : "n'importe quelle syllabe"}.`;
    case 'theme':
      return `Proposez un mot du thème "${getThemeName(game.theme)}" qui commence par ${game.last_letter ? `la lettre "${game.last_letter.toUpperCase()}"` : "n'importe quelle lettre"}.`;
    default:
      return 'Proposez un mot.';
  }
}

// Fonction pour obtenir le nom d'un mode
function getModeName(mode) {
  switch (mode) {
    case 'normal':
      return 'Mode Normal';
    case 'syllable':
      return 'Mode Syllabe';
    case 'theme':
      return 'Mode Thématique';
    default:
      return mode;
  }
}

// Fonction pour obtenir le nom d'un thème
function getThemeName(theme) {
  switch (theme) {
    case 'animals':
      return 'Animaux';
    case 'places':
      return 'Pays/Villes';
    case 'food':
      return 'Nourriture';
    case 'sports':
      return 'Sports';
    case 'movies':
      return 'Films/Séries';
    default:
      return theme;
  }
}

// Fonction pour mélanger un tableau
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}