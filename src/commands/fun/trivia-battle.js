import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('trivia-battle')
    .setDescription('Lancez un quiz multijoueur pour gagner des PiloCoins')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Démarrer un nouveau quiz multijoueur')
        .addStringOption(option =>
          option.setName('catégorie')
            .setDescription('Catégorie des questions')
            .setRequired(true)
            .addChoices(
              { name: 'Culture Générale', value: 'general' },
              { name: 'Jeux Vidéo', value: 'games' },
              { name: 'Films et Séries', value: 'movies' },
              { name: 'Musique', value: 'music' },
              { name: 'Sciences', value: 'science' },
              { name: 'Informatique', value: 'computers' },
              { name: 'Sport', value: 'sports' },
              { name: 'Histoire', value: 'history' },
              { name: 'Géographie', value: 'geography' },
              { name: 'Aléatoire', value: 'random' }
            ))
        .addIntegerOption(option =>
          option.setName('mise')
            .setDescription('Mise d\'entrée pour participer (min. 50 PiloCoins)')
            .setMinValue(50)
            .setMaxValue(1000)
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('questions')
            .setDescription('Nombre de questions (3-10)')
            .setMinValue(3)
            .setMaxValue(10)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Rejoindre un quiz en attente de joueurs'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Voir vos statistiques de quiz')),

  cooldown: 15000, // 15 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Créer la table si elle n'existe pas
      await createTriviaBattleTable(client);
      
      if (subcommand === 'start') {
        // Vérifier si l'utilisateur a déjà un quiz en cours
        const existingGame = await client.db.db.get(`
          SELECT * FROM trivia_battle_games
          WHERE creator_id = ? AND status IN ('waiting', 'in_progress')
        `, userId);
        
        if (existingGame) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                '❓ Quiz déjà en cours',
                `Vous avez déjà un quiz en cours ou en attente de joueurs. Vous ne pouvez pas en créer un nouveau pour le moment.`
              )
            ]
          });
        }
        
        // Récupérer les options
        const category = interaction.options.getString('catégorie');
        const entryFee = interaction.options.getInteger('mise');
        const questionCount = interaction.options.getInteger('questions');
        
        // Récupérer les données utilisateur
        const user = await client.db.getUser(userId);
        
        // Vérifier si l'utilisateur a assez de PiloCoins
        if (user.balance < entryFee) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'PiloCoins insuffisants',
                `Vous avez besoin de ${entryFee} PiloCoins pour créer ce quiz. Vous n'avez que ${user.balance} PiloCoins.`
              )
            ]
          });
        }
        
        // Déduire la mise
        await client.db.updateUserBalance(userId, -entryFee);
        
        // Créer le quiz
        const gameId = await createNewTriviaBattle(client, userId, category, entryFee, questionCount);
        
        // Mettre à jour les statistiques de l'utilisateur
        await updateTriviaStats(client, userId, {
          games_created: 1,
          games_joined: 1,
          pilocoins_spent: entryFee
        });
        
        // Créer l'embed d'invitation
        const embed = EmbedCreator.success(
          '❓ Quiz multijoueur créé!',
          `${interaction.user} a créé un quiz multijoueur! Pour participer, utilisez la commande \`/trivia-battle join\` ou cliquez sur le bouton ci-dessous. Le quiz commencera dans 60 secondes ou lorsque 4 joueurs auront rejoint.`,
          {
            fields: [
              {
                name: '📊 Catégorie',
                value: getCategoryName(category),
                inline: true
              },
              {
                name: '❓ Questions',
                value: `${questionCount} questions`,
                inline: true
              },
              {
                name: '💰 Mise d\'entrée',
                value: `${entryFee} PiloCoins`,
                inline: true
              },
              {
                name: '👥 Participants (1/4)',
                value: `${interaction.user}`,
                inline: false
              },
              {
                name: '⏱️ Démarrage',
                value: `<t:${Math.floor(Date.now() / 1000) + 60}:R>`,
                inline: false
              }
            ]
          }
        );
        
        // Créer le bouton pour rejoindre
        const joinButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`trivia_join_${gameId}`)
              .setLabel('Rejoindre le quiz')
              .setStyle(ButtonStyle.Success)
          );
        
        // Envoyer le message d'invitation
        const reply = await interaction.editReply({
          embeds: [embed],
          components: [joinButton]
        });
        
        // Enregistrer l'ID du message
        await client.db.db.run(`
          UPDATE trivia_battle_games
          SET message_id = ?
          WHERE id = ?
        `, reply.id, gameId);
        
        // Stocker le message dans une map pour faciliter les mises à jour
        if (!client.triviaMessages) client.triviaMessages = new Map();
        client.triviaMessages.set(gameId, {
          channelId: interaction.channelId,
          messageId: reply.id
        });
        
        // Démarrer le timer pour lancer le quiz
        setTimeout(async () => {
          try {
            // Vérifier si le quiz est toujours en attente
            const game = await client.db.db.get(`
              SELECT * FROM trivia_battle_games
              WHERE id = ? AND status = 'waiting'
            `, gameId);
            
            if (game) {
              // Récupérer les participants
              const participants = await client.db.db.all(`
                SELECT * FROM trivia_battle_participants
                WHERE game_id = ?
              `, gameId);
              
              // S'il y a au moins 2 participants, démarrer le quiz
              if (participants.length >= 2) {
                await startTriviaGame(client, gameId, interaction.channel);
              } else {
                // Annuler le quiz et rembourser les participants
                await cancelTriviaGame(client, gameId, 'Pas assez de participants (2 minimum requis).');
                
                // Créer l'embed d'annulation
                const cancelEmbed = EmbedCreator.error(
                  '❌ Quiz annulé',
                  `Le quiz a été annulé car il n'y avait pas assez de participants (2 minimum requis). Les PiloCoins ont été remboursés.`
                );
                
                // Mettre à jour le message
                try {
                  await interaction.channel.messages.edit(reply.id, {
                    embeds: [cancelEmbed],
                    components: []
                  });
                } catch (err) {
                  console.error('Error updating trivia message:', err);
                }
              }
            }
          } catch (error) {
            console.error('Error starting trivia game:', error);
          }
        }, 60000); // 60 secondes
        
        return;
      }
      
      else if (subcommand === 'join') {
        // Récupérer les quiz en attente
        const waitingGames = await client.db.db.all(`
          SELECT g.*, 
                 (SELECT COUNT(*) FROM trivia_battle_participants WHERE game_id = g.id) AS participant_count,
                 (SELECT GROUP_CONCAT(user_id) FROM trivia_battle_participants WHERE game_id = g.id) AS participant_ids
          FROM trivia_battle_games g
          WHERE g.status = 'waiting'
          ORDER BY g.created_at DESC
          LIMIT 5
        `);
        
        if (waitingGames.length === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.info(
                '❓ Aucun quiz en attente',
                `Il n'y a actuellement aucun quiz en attente de joueurs. Utilisez \`/trivia-battle start\` pour en créer un nouveau.`
              )
            ]
          });
        }
        
        // Vérifier si l'utilisateur participe déjà à un quiz
        for (const game of waitingGames) {
          const participantIds = game.participant_ids ? game.participant_ids.split(',') : [];
          
          if (participantIds.includes(userId)) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.warning(
                  '❓ Déjà inscrit',
                  `Vous participez déjà à un quiz en attente. Attendez qu'il démarre ou qu'il soit annulé.`
                )
              ]
            });
          }
        }
        
        // Récupérer les données utilisateur
        const user = await client.db.getUser(userId);
        
        // Préparer les boutons pour rejoindre les quiz
        const buttonRows = [];
        const gameOptions = [];
        
        for (let i = 0; i < waitingGames.length; i++) {
          const game = waitingGames[i];
          
          // Vérifier si le quiz n'est pas plein
          if (game.participant_count >= 4) continue;
          
          // Vérifier si l'utilisateur a assez de PiloCoins
          const canAfford = user.balance >= game.entry_fee;
          
          const creator = await client.users.fetch(game.creator_id).catch(() => null);
          
          gameOptions.push({
            name: `Quiz #${game.id} par ${creator ? creator.username : 'Inconnu'}`,
            value: `${game.id}`,
            description: `${getCategoryName(game.category)} - ${game.entry_fee} PiloCoins - ${game.question_count} questions - ${game.participant_count}/4 joueurs`,
            disabled: !canAfford
          });
          
          if (gameOptions.length % 5 === 0 || i === waitingGames.length - 1) {
            const row = new ActionRowBuilder();
            
            for (const option of gameOptions) {
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`trivia_join_${option.value}`)
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
                '❓ Aucun quiz disponible',
                `Il n'y a actuellement aucun quiz disponible que vous puissiez rejoindre. Les quiz existants sont soit pleins, soit vous n'avez pas assez de PiloCoins pour la mise d'entrée. Utilisez \`/trivia-battle start\` pour en créer un nouveau.`
              )
            ]
          });
        }
        
        // Créer l'embed de liste de quiz
        const embed = EmbedCreator.info(
          '❓ Quiz disponibles',
          `Voici les quiz disponibles auxquels vous pouvez participer. Cliquez sur un bouton pour rejoindre un quiz.`,
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
        const stats = await getTriviaStats(client, userId);
        
        // Créer l'embed de statistiques
        const embed = EmbedCreator.economy(
          '📊 Statistiques de quiz',
          `Voici vos statistiques pour les quiz multijoueurs:`,
          {
            fields: [
              {
                name: '🎮 Quiz créés',
                value: `${stats.games_created}`,
                inline: true
              },
              {
                name: '🎲 Quiz rejoints',
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
                name: '❓ Questions correctes',
                value: `${stats.correct_answers}/${stats.total_answers} (${stats.total_answers > 0 ? Math.round((stats.correct_answers / stats.total_answers) * 100) : 0}%)`,
                inline: true
              },
              {
                name: '⚡ Réponses les plus rapides',
                value: `${stats.fastest_answers}`,
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
      console.error('Error in trivia-battle command:', error);
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

// Fonction pour créer les tables de quiz
async function createTriviaBattleTable(client) {
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS trivia_battle_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id TEXT NOT NULL,
      category TEXT NOT NULL,
      entry_fee INTEGER NOT NULL,
      question_count INTEGER NOT NULL,
      current_question INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting',
      message_id TEXT,
      channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS trivia_battle_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      correct_answers INTEGER NOT NULL DEFAULT 0,
      fastest_answers INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES trivia_battle_games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE(game_id, user_id)
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS trivia_battle_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      options TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      question_number INTEGER NOT NULL,
      message_id TEXT,
      FOREIGN KEY (game_id) REFERENCES trivia_battle_games(id) ON DELETE CASCADE
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS trivia_battle_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answer_time INTEGER NOT NULL,
      answered_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (question_id) REFERENCES trivia_battle_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE(question_id, user_id)
    )
  `);
  
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS trivia_battle_stats (
      user_id TEXT PRIMARY KEY,
      games_created INTEGER NOT NULL DEFAULT 0,
      games_joined INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      total_answers INTEGER NOT NULL DEFAULT 0,
      correct_answers INTEGER NOT NULL DEFAULT 0,
      fastest_answers INTEGER NOT NULL DEFAULT 0,
      pilocoins_earned INTEGER NOT NULL DEFAULT 0,
      pilocoins_spent INTEGER NOT NULL DEFAULT 0,
      last_played TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
}

// Fonction pour créer un nouveau quiz
async function createNewTriviaBattle(client, creatorId, category, entryFee, questionCount) {
  // Insérer le nouveau quiz
  const result = await client.db.db.run(`
    INSERT INTO trivia_battle_games (
      creator_id, category, entry_fee, question_count, status
    ) VALUES (?, ?, ?, ?, 'waiting')
  `, creatorId, category, entryFee, questionCount);
  
  const gameId = result.lastID;
  
  // Ajouter le créateur comme premier participant
  await client.db.db.run(`
    INSERT INTO trivia_battle_participants (
      game_id, user_id
    ) VALUES (?, ?)
  `, gameId, creatorId);
  
  return gameId;
}

// Fonction pour démarrer un quiz
async function startTriviaGame(client, gameId, channel) {
  try {
    // Mettre à jour le statut du quiz
    await client.db.db.run(`
      UPDATE trivia_battle_games
      SET status = 'in_progress', current_question = 1, updated_at = datetime('now')
      WHERE id = ?
    `, gameId);
    
    // Récupérer les informations du quiz
    const game = await client.db.db.get(`
      SELECT * FROM trivia_battle_games
      WHERE id = ?
    `, gameId);
    
    // Récupérer les participants
    const participants = await client.db.db.all(`
      SELECT * FROM trivia_battle_participants
      WHERE game_id = ?
    `, gameId);
    
    // Préparer les questions
    await prepareQuestions(client, gameId, game.category, game.question_count);
    
    // Créer l'embed d'annonce de démarrage
    const participantsList = await Promise.all(
      participants.map(async p => {
        const user = await client.users.fetch(p.user_id).catch(() => null);
        return user ? user.toString() : 'Inconnu';
      })
    );
    
    const startEmbed = EmbedCreator.success(
      '🎮 Le quiz commence!',
      `Le quiz multijoueur #${gameId} commence maintenant! Préparez-vous pour la première question.`,
      {
        fields: [
          {
            name: '👥 Participants',
            value: participantsList.join('\n'),
            inline: false
          },
          {
            name: '🏆 Prix',
            value: `${game.entry_fee * participants.length} PiloCoins`,
            inline: true
          },
          {
            name: '❓ Questions',
            value: `${game.question_count} questions`,
            inline: true
          }
        ]
      }
    );
    
    // Mettre à jour le message d'invitation
    const messageInfo = client.triviaMessages.get(gameId);
    if (messageInfo) {
      try {
        await channel.messages.edit(messageInfo.messageId, {
          embeds: [startEmbed],
          components: []
        });
      } catch (err) {
        console.error('Error updating trivia message:', err);
      }
    }
    
    // Attendre 3 secondes avant de poser la première question
    setTimeout(async () => {
      await askNextQuestion(client, gameId, channel);
    }, 3000);
    
  } catch (error) {
    console.error('Error starting trivia game:', error);
    await cancelTriviaGame(client, gameId, 'Une erreur est survenue lors du démarrage du quiz.');
  }
}

// Fonction pour annuler un quiz
async function cancelTriviaGame(client, gameId, reason) {
  try {
    // Mettre à jour le statut du quiz
    await client.db.db.run(`
      UPDATE trivia_battle_games
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `, gameId);
    
    // Récupérer les participants
    const participants = await client.db.db.all(`
      SELECT * FROM trivia_battle_participants
      WHERE game_id = ?
    `, gameId);
    
    // Récupérer les informations du quiz
    const game = await client.db.db.get(`
      SELECT * FROM trivia_battle_games
      WHERE id = ?
    `, gameId);
    
    // Rembourser les participants
    for (const participant of participants) {
      await client.db.updateUserBalance(participant.user_id, game.entry_fee);
    }
    
    // Nettoyer les ressources
    client.triviaMessages.delete(gameId);
    
    console.log(`Trivia game #${gameId} cancelled: ${reason}`);
    
  } catch (error) {
    console.error('Error cancelling trivia game:', error);
  }
}

// Fonction pour préparer les questions
async function prepareQuestions(client, gameId, category, questionCount) {
  try {
    // Les catégories de questions
    const categories = {
      general: 'Catégorie Générale',
      games: 'Jeux Vidéo',
      movies: 'Films et Séries',
      music: 'Musique',
      science: 'Sciences',
      computers: 'Informatique',
      sports: 'Sport',
      history: 'Histoire',
      geography: 'Géographie',
      random: 'Aléatoire'
    };
    
    // Les difficultés (distribution)
    const difficulties = ['facile', 'moyen', 'difficile'];
    const difficultyDistribution = [0.4, 0.4, 0.2]; // 40% facile, 40% moyen, 20% difficile
    
    // Questions prédéfinies par catégorie
    const questionBank = {
      general: [
        {
          question: "Quelle est la capitale de la France?",
          correct_answer: "Paris",
          options: ["Londres", "Berlin", "Madrid", "Paris"],
          difficulty: "facile"
        },
        {
          question: "Qui a peint la Joconde?",
          correct_answer: "Léonard de Vinci",
          options: ["Michel-Ange", "Raphaël", "Léonard de Vinci", "Picasso"],
          difficulty: "facile"
        },
        {
          question: "Combien de dents possède un adulte humain?",
          correct_answer: "32",
          options: ["28", "30", "32", "36"],
          difficulty: "moyen"
        },
        {
          question: "Quel est le plus grand océan du monde?",
          correct_answer: "Océan Pacifique",
          options: ["Océan Atlantique", "Océan Indien", "Océan Pacifique", "Océan Arctique"],
          difficulty: "facile"
        },
        {
          question: "Qui a découvert la pénicilline?",
          correct_answer: "Alexander Fleming",
          options: ["Alexander Fleming", "Louis Pasteur", "Marie Curie", "Albert Einstein"],
          difficulty: "moyen"
        },
        {
          question: "Quel est l'élément chimique le plus abondant dans l'univers?",
          correct_answer: "Hydrogène",
          options: ["Oxygène", "Carbone", "Hydrogène", "Hélium"],
          difficulty: "moyen"
        },
        {
          question: "Quel est le plus petit pays du monde?",
          correct_answer: "Vatican",
          options: ["Monaco", "Nauru", "Vatican", "Saint-Marin"],
          difficulty: "facile"
        },
        {
          question: "Quel est l'animal terrestre le plus rapide du monde?",
          correct_answer: "Guépard",
          options: ["Lion", "Guépard", "Gazelle", "Autruche"],
          difficulty: "facile"
        },
        {
          question: "Dans quelle ville se trouve la Tour Eiffel?",
          correct_answer: "Paris",
          options: ["Londres", "New York", "Paris", "Tokyo"],
          difficulty: "facile"
        },
        {
          question: "Qui a écrit 'Roméo et Juliette'?",
          correct_answer: "William Shakespeare",
          options: ["Victor Hugo", "William Shakespeare", "Molière", "Charles Dickens"],
          difficulty: "facile"
        }
      ],
      games: [
        {
          question: "Quel est le personnage principal de la série 'The Legend of Zelda'?",
          correct_answer: "Link",
          options: ["Zelda", "Link", "Ganon", "Mario"],
          difficulty: "facile"
        },
        {
          question: "Dans quel jeu vidéo incarne-t-on un gardien de phare nommé Jack?",
          correct_answer: "Bioshock",
          options: ["Half-Life", "Bioshock", "Fallout", "Dishonored"],
          difficulty: "difficile"
        },
        {
          question: "Quelle entreprise a créé la console PlayStation?",
          correct_answer: "Sony",
          options: ["Microsoft", "Nintendo", "Sony", "Sega"],
          difficulty: "facile"
        },
        {
          question: "Dans quel jeu vidéo trouve-t-on les personnages Cloud Strife et Sephiroth?",
          correct_answer: "Final Fantasy VII",
          options: ["Final Fantasy VII", "Kingdom Hearts", "Chrono Trigger", "Dragon Quest"],
          difficulty: "moyen"
        },
        {
          question: "Quelle est la date de sortie de Minecraft?",
          correct_answer: "2011",
          options: ["2009", "2010", "2011", "2012"],
          difficulty: "moyen"
        },
        {
          question: "Quel jeu vidéo détient le record du jeu vidéo le plus vendu de tous les temps?",
          correct_answer: "Minecraft",
          options: ["Tetris", "Minecraft", "Grand Theft Auto V", "Wii Sports"],
          difficulty: "moyen"
        },
        {
          question: "Dans quel jeu vidéo incarne-t-on un courrier dans un monde post-apocalyptique?",
          correct_answer: "Fallout: New Vegas",
          options: ["The Last of Us", "Fallout 3", "Fallout: New Vegas", "Metro 2033"],
          difficulty: "difficile"
        },
        {
          question: "Quel est le nom du monde dans lequel se déroule The Legend of Zelda?",
          correct_answer: "Hyrule",
          options: ["Midgard", "Hyrule", "Tamriel", "Azeroth"],
          difficulty: "facile"
        },
        {
          question: "Qui est le créateur de la série Metal Gear Solid?",
          correct_answer: "Hideo Kojima",
          options: ["Shigeru Miyamoto", "Hideo Kojima", "Hidetaka Miyazaki", "Todd Howard"],
          difficulty: "moyen"
        },
        {
          question: "Quel est le nom du protagoniste de la série God of War?",
          correct_answer: "Kratos",
          options: ["Zeus", "Ares", "Kratos", "Perseus"],
          difficulty: "facile"
        }
      ],
      movies: [
        {
          question: "Qui a réalisé le film 'Pulp Fiction'?",
          correct_answer: "Quentin Tarantino",
          options: ["Martin Scorsese", "Steven Spielberg", "Quentin Tarantino", "Francis Ford Coppola"],
          difficulty: "facile"
        },
        {
          question: "Quel acteur a joué le rôle de Jack Dawson dans le film 'Titanic'?",
          correct_answer: "Leonardo DiCaprio",
          options: ["Brad Pitt", "Tom Cruise", "Leonardo DiCaprio", "Johnny Depp"],
          difficulty: "facile"
        },
        {
          question: "Quel film a remporté l'Oscar du meilleur film en 2020?",
          correct_answer: "Parasite",
          options: ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"],
          difficulty: "moyen"
        },
        {
          question: "Dans quel film entend-on la phrase 'May the Force be with you'?",
          correct_answer: "Star Wars",
          options: ["Star Trek", "Star Wars", "Blade Runner", "Le Seigneur des Anneaux"],
          difficulty: "facile"
        },
        {
          question: "Qui est le réalisateur du film 'Inception'?",
          correct_answer: "Christopher Nolan",
          options: ["Christopher Nolan", "James Cameron", "Ridley Scott", "Denis Villeneuve"],
          difficulty: "moyen"
        },
        {
          question: "Dans quel film le personnage principal se nomme-t-il Forrest Gump?",
          correct_answer: "Forrest Gump",
          options: ["Rain Man", "Forrest Gump", "Big", "Le Terminal"],
          difficulty: "facile"
        },
        {
          question: "Quel est le premier film de la saga 'Le Seigneur des Anneaux'?",
          correct_answer: "La Communauté de l'Anneau",
          options: ["La Communauté de l'Anneau", "Les Deux Tours", "Le Retour du Roi", "Le Hobbit"],
          difficulty: "facile"
        },
        {
          question: "Qui a joué le rôle de Iron Man dans l'univers cinématographique Marvel?",
          correct_answer: "Robert Downey Jr.",
          options: ["Chris Evans", "Chris Hemsworth", "Robert Downey Jr.", "Mark Ruffalo"],
          difficulty: "facile"
        },
        {
          question: "Dans quel film entend-on la réplique 'I'll be back'?",
          correct_answer: "Terminator",
          options: ["Predator", "Terminator", "Commando", "Total Recall"],
          difficulty: "facile"
        },
        {
          question: "Qui a réalisé le film 'E.T. l'extra-terrestre'?",
          correct_answer: "Steven Spielberg",
          options: ["George Lucas", "Steven Spielberg", "James Cameron", "Robert Zemeckis"],
          difficulty: "moyen"
        }
      ],
      music: [
        {
          question: "Quel groupe a sorti l'album 'Dark Side of the Moon'?",
          correct_answer: "Pink Floyd",
          options: ["The Beatles", "Led Zeppelin", "Pink Floyd", "The Rolling Stones"],
          difficulty: "facile"
        },
        {
          question: "Qui a écrit la chanson 'Imagine'?",
          correct_answer: "John Lennon",
          options: ["Paul McCartney", "John Lennon", "Freddie Mercury", "Bob Dylan"],
          difficulty: "facile"
        },
        {
          question: "Quel est le vrai nom de Lady Gaga?",
          correct_answer: "Stefani Germanotta",
          options: ["Katheryn Hudson", "Stefani Germanotta", "Alecia Moore", "Ashley Frangipane"],
          difficulty: "moyen"
        },
        {
          question: "Quel groupe a sorti l'album 'Nevermind' en 1991?",
          correct_answer: "Nirvana",
          options: ["Pearl Jam", "Soundgarden", "Nirvana", "Alice in Chains"],
          difficulty: "facile"
        },
        {
          question: "Qui est considéré comme le 'Roi du Pop'?",
          correct_answer: "Michael Jackson",
          options: ["Elvis Presley", "Michael Jackson", "Prince", "David Bowie"],
          difficulty: "facile"
        },
        {
          question: "Dans quelle ville les Beatles se sont-ils formés?",
          correct_answer: "Liverpool",
          options: ["Londres", "Manchester", "Liverpool", "Birmingham"],
          difficulty: "facile"
        },
        {
          question: "Qui a chanté 'Hello'?",
          correct_answer: "Adele",
          options: ["Beyoncé", "Adele", "Rihanna", "Taylor Swift"],
          difficulty: "facile"
        },
        {
          question: "Quel album de Daft Punk contient la chanson 'Get Lucky'?",
          correct_answer: "Random Access Memories",
          options: ["Discovery", "Homework", "Human After All", "Random Access Memories"],
          difficulty: "moyen"
        },
        {
          question: "Qui a chanté 'Bohemian Rhapsody'?",
          correct_answer: "Queen",
          options: ["The Beatles", "Queen", "Led Zeppelin", "The Rolling Stones"],
          difficulty: "facile"
        },
        {
          question: "Quel était l'instrument principal de Jimi Hendrix?",
          correct_answer: "Guitare",
          options: ["Batterie", "Basse", "Guitare", "Piano"],
          difficulty: "facile"
        }
      ],
      science: [
        {
          question: "Quel est le symbole chimique de l'or?",
          correct_answer: "Au",
          options: ["Ag", "Au", "Fe", "Cu"],
          difficulty: "facile"
        },
        {
          question: "Quelle est la planète la plus proche du Soleil?",
          correct_answer: "Mercure",
          options: ["Vénus", "Mercure", "Mars", "Terre"],
          difficulty: "facile"
        },
        {
          question: "Quelle est la formule chimique de l'eau?",
          correct_answer: "H2O",
          options: ["CO2", "H2O", "O2", "NaCl"],
          difficulty: "facile"
        },
        {
          question: "Qui a formulé la théorie de la relativité?",
          correct_answer: "Albert Einstein",
          options: ["Isaac Newton", "Albert Einstein", "Stephen Hawking", "Niels Bohr"],
          difficulty: "facile"
        },
        {
          question: "Quel est l'os le plus long du corps humain?",
          correct_answer: "Fémur",
          options: ["Tibia", "Fémur", "Humérus", "Radius"],
          difficulty: "moyen"
        },
        {
          question: "Quel est le processus par lequel les plantes produisent leur nourriture?",
          correct_answer: "Photosynthèse",
          options: ["Respiration", "Photosynthèse", "Fermentation", "Digestion"],
          difficulty: "facile"
        },
        {
          question: "Quel est l'élément le plus abondant dans la croûte terrestre?",
          correct_answer: "Oxygène",
          options: ["Silicium", "Aluminium", "Fer", "Oxygène"],
          difficulty: "moyen"
        },
        {
          question: "Quelle est l'unité de mesure de la force?",
          correct_answer: "Newton",
          options: ["Joule", "Watt", "Newton", "Pascal"],
          difficulty: "facile"
        },
        {
          question: "Quel est le système d'exploitation créé par Microsoft?",
          correct_answer: "Windows",
          options: ["macOS", "Linux", "Windows", "Android"],
          difficulty: "facile"
        },
        {
          question: "Comment s'appelle la galaxie dans laquelle se trouve notre système solaire?",
          correct_answer: "Voie Lactée",
          options: ["Andromède", "Voie Lactée", "Triangulum", "Centaurus A"],
          difficulty: "facile"
        }
      ],
      computers: [
        {
          question: "Qui est le fondateur de Microsoft?",
          correct_answer: "Bill Gates",
          options: ["Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Larry Page"],
          difficulty: "facile"
        },
        {
          question: "Que signifie l'acronyme HTML?",
          correct_answer: "HyperText Markup Language",
          options: ["HyperText Markup Language", "High Tech Modern Language", "Hyper Transfer Mode Language", "Home Tool Markup Language"],
          difficulty: "facile"
        },
        {
          question: "Quel animal représente le logo du navigateur Firefox?",
          correct_answer: "Renard",
          options: ["Loup", "Renard", "Tigre", "Dragon"],
          difficulty: "facile"
        },
        {
          question: "Quel est le langage de programmation créé par Apple en 2014?",
          correct_answer: "Swift",
          options: ["Swift", "Objective-C", "Java", "C#"],
          difficulty: "moyen"
        },
        {
          question: "Que signifie l'acronyme URL?",
          correct_answer: "Uniform Resource Locator",
          options: ["Universal Resource Link", "Uniform Resource Locator", "Universal Remote Location", "Unified Resource Locator"],
          difficulty: "moyen"
        },
        {
          question: "Quelle société a créé le système d'exploitation Android?",
          correct_answer: "Google",
          options: ["Apple", "Microsoft", "Google", "Samsung"],
          difficulty: "facile"
        },
        {
          question: "En quelle année a été créé le World Wide Web?",
          correct_answer: "1989",
          options: ["1985", "1989", "1991", "1995"],
          difficulty: "moyen"
        },
        {
          question: "Quel est le plus populaire des systèmes de gestion de bases de données relationnelles?",
          correct_answer: "MySQL",
          options: ["Oracle", "MySQL", "Microsoft SQL Server", "PostgreSQL"],
          difficulty: "moyen"
        },
        {
          question: "Quel est le langage de programmation le plus populaire pour le développement web côté serveur?",
          correct_answer: "JavaScript (Node.js)",
          options: ["PHP", "Python", "Ruby", "JavaScript (Node.js)"],
          difficulty: "moyen"
        },
        {
          question: "Quelle entreprise a développé le premier iPhone?",
          correct_answer: "Apple",
          options: ["Samsung", "Google", "Apple", "Nokia"],
          difficulty: "facile"
        }
      ],
      sports: [
        {
          question: "Dans quel sport utilise-t-on un ballon ovale?",
          correct_answer: "Rugby",
          options: ["Football", "Basketball", "Rugby", "Volleyball"],
          difficulty: "facile"
        },
        {
          question: "Combien de joueurs composent une équipe de football sur le terrain?",
          correct_answer: "11",
          options: ["9", "10", "11", "12"],
          difficulty: "facile"
        },
        {
          question: "Qui détient le record du nombre de médailles d'or olympiques?",
          correct_answer: "Michael Phelps",
          options: ["Usain Bolt", "Michael Phelps", "Carl Lewis", "Larisa Latynina"],
          difficulty: "moyen"
        },
        {
          question: "Dans quel pays ont eu lieu les premiers Jeux Olympiques modernes?",
          correct_answer: "Grèce",
          options: ["France", "Grèce", "États-Unis", "Royaume-Uni"],
          difficulty: "facile"
        },
        {
          question: "Quel sport se pratique avec une raquette et un volant?",
          correct_answer: "Badminton",
          options: ["Tennis", "Squash", "Badminton", "Ping-pong"],
          difficulty: "facile"
        },
        {
          question: "Qui est considéré comme le plus grand joueur de basket-ball de tous les temps?",
          correct_answer: "Michael Jordan",
          options: ["LeBron James", "Michael Jordan", "Kobe Bryant", "Magic Johnson"],
          difficulty: "facile"
        },
        {
          question: "Dans quelle ville se sont déroulés les Jeux Olympiques d'été de 2016?",
          correct_answer: "Rio de Janeiro",
          options: ["Londres", "Tokyo", "Rio de Janeiro", "Pékin"],
          difficulty: "facile"
        },
        {
          question: "Quel pays a remporté la Coupe du Monde de football en 2018?",
          correct_answer: "France",
          options: ["Brésil", "Allemagne", "France", "Espagne"],
          difficulty: "facile"
        },
        {
          question: "Combien de fois la France a-t-elle remporté la Coupe du Monde de football?",
          correct_answer: "2",
          options: ["1", "2", "3", "4"],
          difficulty: "moyen"
        },
        {
          question: "Dans quel sport peut-on réaliser un 'home run'?",
          correct_answer: "Baseball",
          options: ["Golf", "Cricket", "Baseball", "Football américain"],
          difficulty: "facile"
        }
      ],
      history: [
        {
          question: "En quelle année a eu lieu la prise de la Bastille?",
          correct_answer: "1789",
          options: ["1769", "1789", "1799", "1805"],
          difficulty: "facile"
        },
        {
          question: "Qui était le premier président des États-Unis?",
          correct_answer: "George Washington",
          options: ["Thomas Jefferson", "Abraham Lincoln", "George Washington", "Benjamin Franklin"],
          difficulty: "facile"
        },
        {
          question: "En quelle année a commencé la Première Guerre mondiale?",
          correct_answer: "1914",
          options: ["1905", "1914", "1918", "1939"],
          difficulty: "facile"
        },
        {
          question: "Qui a été le premier homme à marcher sur la Lune?",
          correct_answer: "Neil Armstrong",
          options: ["Buzz Aldrin", "Neil Armstrong", "Yuri Gagarin", "Alan Shepard"],
          difficulty: "facile"
        },
        {
          question: "Quelle dynastie a régné sur la Chine de 1368 à 1644?",
          correct_answer: "Ming",
          options: ["Han", "Tang", "Ming", "Qing"],
          difficulty: "difficile"
        },
        {
          question: "Qui a écrit 'Le Prince'?",
          correct_answer: "Machiavel",
          options: ["Dante", "Machiavel", "Pétrarque", "Boccace"],
          difficulty: "moyen"
        },
        {
          question: "En quelle année est tombé le mur de Berlin?",
          correct_answer: "1989",
          options: ["1985", "1989", "1991", "1995"],
          difficulty: "facile"
        },
        {
          question: "Qui était le pharaon pour lequel a été construite la plus grande pyramide de Gizeh?",
          correct_answer: "Khéops",
          options: ["Ramsès II", "Toutânkhamon", "Khéops", "Cléopâtre"],
          difficulty: "moyen"
        },
        {
          question: "Quelle était la capitale de l'Empire byzantin?",
          correct_answer: "Constantinople",
          options: ["Rome", "Athènes", "Constantinople", "Alexandrie"],
          difficulty: "moyen"
        },
        {
          question: "Qui a dirigé l'URSS pendant la Seconde Guerre mondiale?",
          correct_answer: "Joseph Staline",
          options: ["Vladimir Lénine", "Joseph Staline", "Léon Trotski", "Nikita Khrouchtchev"],
          difficulty: "facile"
        }
      ],
      geography: [
        {
          question: "Quel est le plus grand océan du monde?",
          correct_answer: "Océan Pacifique",
          options: ["Océan Atlantique", "Océan Indien", "Océan Pacifique", "Océan Arctique"],
          difficulty: "facile"
        },
        {
          question: "Quel est le plus grand pays du monde en termes de superficie?",
          correct_answer: "Russie",
          options: ["Canada", "Chine", "États-Unis", "Russie"],
          difficulty: "facile"
        },
        {
          question: "Quelle est la capitale de l'Australie?",
          correct_answer: "Canberra",
          options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
          difficulty: "moyen"
        },
        {
          question: "Quel est le plus long fleuve du monde?",
          correct_answer: "Nil",
          options: ["Amazone", "Nil", "Mississippi", "Yangtsé"],
          difficulty: "facile"
        },
        {
          question: "Quel est le désert le plus grand du monde?",
          correct_answer: "Sahara",
          options: ["Sahara", "Gobi", "Kalahari", "Antarctique"],
          difficulty: "facile"
        },
        {
          question: "Quel est le plus haut sommet du monde?",
          correct_answer: "Everest",
          options: ["K2", "Everest", "Mont Blanc", "Kilimandjaro"],
          difficulty: "facile"
        },
        {
          question: "Dans quel pays se trouve la ville de Marrakech?",
          correct_answer: "Maroc",
          options: ["Algérie", "Tunisie", "Maroc", "Égypte"],
          difficulty: "facile"
        },
        {
          question: "Quel est le plus petit continent?",
          correct_answer: "Océanie",
          options: ["Europe", "Antarctique", "Océanie", "Amérique du Sud"],
          difficulty: "facile"
        },
        {
          question: "Dans quel pays se trouve la ville de Stockholm?",
          correct_answer: "Suède",
          options: ["Norvège", "Danemark", "Finlande", "Suède"],
          difficulty: "facile"
        },
        {
          question: "Quel pays a la forme d'une botte?",
          correct_answer: "Italie",
          options: ["Espagne", "Portugal", "Italie", "Grèce"],
          difficulty: "facile"
        }
      ]
    };
    
    // Sélectionner la catégorie
    let selectedCategory = category;
    if (category === 'random') {
      const categories = Object.keys(questionBank).filter(c => c !== 'random');
      selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    }
    
    // Sélectionner les questions
    let selectedQuestions = [];
    
    if (questionBank[selectedCategory]) {
      // Copier et mélanger les questions de la catégorie
      const questions = [...questionBank[selectedCategory]];
      shuffleArray(questions);
      
      // Sélectionner le nombre de questions demandé
      selectedQuestions = questions.slice(0, questionCount);
      
      // Si pas assez de questions, compléter avec des questions d'autres catégories
      if (selectedQuestions.length < questionCount) {
        const remainingCount = questionCount - selectedQuestions.length;
        const otherCategories = Object.keys(questionBank).filter(c => c !== selectedCategory && c !== 'random');
        
        for (let i = 0; i < remainingCount; i++) {
          const randomCategory = otherCategories[Math.floor(Math.random() * otherCategories.length)];
          const randomQuestions = [...questionBank[randomCategory]];
          shuffleArray(randomQuestions);
          
          if (randomQuestions.length > 0) {
            selectedQuestions.push(randomQuestions[0]);
            // Supprimer la question sélectionnée pour éviter les doublons
            questionBank[randomCategory] = questionBank[randomCategory].filter(q => q.question !== randomQuestions[0].question);
          }
        }
      }
    } else {
      // Si la catégorie n'existe pas, sélectionner des questions aléatoires
      const allQuestions = [];
      Object.values(questionBank).forEach(categoryQuestions => {
        allQuestions.push(...categoryQuestions);
      });
      
      shuffleArray(allQuestions);
      selectedQuestions = allQuestions.slice(0, questionCount);
    }
    
    // Insérer les questions dans la base de données
    for (let i = 0; i < selectedQuestions.length; i++) {
      const question = selectedQuestions[i];
      
      await client.db.db.run(`
        INSERT INTO trivia_battle_questions (
          game_id, question, correct_answer, options, category, difficulty, question_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, 
        gameId, 
        question.question, 
        question.correct_answer, 
        JSON.stringify(question.options), 
        selectedCategory, 
        question.difficulty, 
        i + 1
      );
    }
    
  } catch (error) {
    console.error('Error preparing questions:', error);
    throw error;
  }
}

// Fonction pour poser la question suivante
async function askNextQuestion(client, gameId, channel) {
  try {
    // Récupérer les informations du quiz
    const game = await client.db.db.get(`
      SELECT * FROM trivia_battle_games
      WHERE id = ?
    `, gameId);
    
    // Vérifier si le quiz est toujours en cours
    if (game.status !== 'in_progress') {
      return;
    }
    
    // Récupérer la question actuelle
    const question = await client.db.db.get(`
      SELECT * FROM trivia_battle_questions
      WHERE game_id = ? AND question_number = ?
    `, gameId, game.current_question);
    
    if (!question) {
      // Plus de questions, le quiz est terminé
      return endTriviaGame(client, gameId, channel);
    }
    
    // Parsez les options
    const options = JSON.parse(question.options);
    
    // Mélanger les options
    shuffleArray(options);
    
    // Créer les boutons pour les options
    const optionButtons = [];
    
    // Créer les rangées de boutons (2 boutons par rangée)
    for (let i = 0; i < options.length; i += 2) {
      const row = new ActionRowBuilder();
      
      // Ajouter le premier bouton de la paire
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`trivia_answer_${question.id}_${encodeOption(options[i])}`)
          .setLabel(options[i])
          .setStyle(ButtonStyle.Primary)
      );
      
      // Ajouter le deuxième bouton de la paire (s'il existe)
      if (i + 1 < options.length) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`trivia_answer_${question.id}_${encodeOption(options[i + 1])}`)
            .setLabel(options[i + 1])
            .setStyle(ButtonStyle.Primary)
        );
      }
      
      optionButtons.push(row);
    }
    
    // Créer l'embed de question
    const questionEmbed = EmbedCreator.info(
      `Question ${game.current_question}/${game.question_count}`,
      `${question.question}`,
      {
        fields: [
          {
            name: '⏱️ Temps',
            value: '15 secondes',
            inline: true
          },
          {
            name: '📊 Difficulté',
            value: question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1),
            inline: true
          },
          {
            name: '🏷️ Catégorie',
            value: getCategoryName(question.category),
            inline: true
          }
        ]
      }
    );
    
    // Envoyer la question
    const questionMessage = await channel.send({
      embeds: [questionEmbed],
      components: optionButtons
    });
    
    // Enregistrer l'ID du message
    await client.db.db.run(`
      UPDATE trivia_battle_questions
      SET message_id = ?
      WHERE id = ?
    `, questionMessage.id, question.id);
    
    // Attendre 15 secondes
    setTimeout(async () => {
      await showQuestionResults(client, gameId, question.id, channel);
      
      // Passer à la question suivante après 5 secondes supplémentaires
      setTimeout(async () => {
        // Mettre à jour la question actuelle
        await client.db.db.run(`
          UPDATE trivia_battle_games
          SET current_question = current_question + 1
          WHERE id = ?
        `, gameId);
        
        // Poser la question suivante
        await askNextQuestion(client, gameId, channel);
      }, 5000);
    }, 15000);
    
  } catch (error) {
    console.error('Error asking next question:', error);
    await cancelTriviaGame(client, gameId, 'Une erreur est survenue lors de l\'envoi de la question.');
  }
}

// Fonction pour montrer les résultats d'une question
async function showQuestionResults(client, gameId, questionId, channel) {
  try {
    // Récupérer la question
    const question = await client.db.db.get(`
      SELECT * FROM trivia_battle_questions
      WHERE id = ?
    `, questionId);
    
    // Récupérer les réponses des participants
    const answers = await client.db.db.all(`
      SELECT a.*, u.user_id 
      FROM trivia_battle_answers a
      JOIN trivia_battle_participants u ON a.user_id = u.user_id AND u.game_id = ?
      WHERE a.question_id = ?
      ORDER BY a.answer_time ASC
    `, gameId, questionId);
    
    // Récupérer tous les participants
    const participants = await client.db.db.all(`
      SELECT * FROM trivia_battle_participants
      WHERE game_id = ?
    `, gameId);
    
    // Trouver les réponses correctes et la plus rapide
    const correctAnswers = answers.filter(a => a.is_correct);
    const fastestAnswer = correctAnswers.length > 0 ? correctAnswers[0] : null;
    
    // Attribuer les points
    for (const answer of answers) {
      let points = 0;
      let isFastest = false;
      
      if (answer.is_correct) {
        // Points de base pour une réponse correcte
        points += 10;
        
        // Points bonus pour la réponse la plus rapide
        if (fastestAnswer && answer.id === fastestAnswer.id) {
          points += 5;
          isFastest = true;
        }
        
        // Mettre à jour le score et les statistiques du participant
        await client.db.db.run(`
          UPDATE trivia_battle_participants
          SET score = score + ?, correct_answers = correct_answers + 1, fastest_answers = fastest_answers + ?
          WHERE game_id = ? AND user_id = ?
        `, points, isFastest ? 1 : 0, gameId, answer.user_id);
        
        // Mettre à jour les statistiques globales de l'utilisateur
        await updateTriviaStats(client, answer.user_id, {
          correct_answers: 1,
          fastest_answers: isFastest ? 1 : 0,
          total_answers: 1
        });
      } else {
        // Mettre à jour les statistiques globales de l'utilisateur
        await updateTriviaStats(client, answer.user_id, {
          total_answers: 1
        });
      }
    }
    
    // Pour les participants qui n'ont pas répondu
    for (const participant of participants) {
      const hasAnswered = answers.some(a => a.user_id === participant.user_id);
      
      if (!hasAnswered) {
        // Mettre à jour les statistiques globales de l'utilisateur
        await updateTriviaStats(client, participant.user_id, {
          total_answers: 1
        });
      }
    }
    
    // Récupérer le message de la question
    const questionMessage = await channel.messages.fetch(question.message_id).catch(() => null);
    
    if (questionMessage) {
      // Créer l'embed de résultats
      const resultsEmbed = EmbedCreator.info(
        `Résultats - Question ${question.question_number}`,
        `${question.question}`,
        {
          fields: [
            {
              name: '✅ Réponse correcte',
              value: question.correct_answer,
              inline: false
            },
            {
              name: '👥 Participants ayant répondu',
              value: answers.length > 0 
                ? answers.map(a => `${a.is_correct ? '✅' : '❌'} <@${a.user_id}> (${a.answer})`).join('\n')
                : 'Personne n\'a répondu à cette question.',
              inline: false
            },
            {
              name: '⚡ Réponse la plus rapide',
              value: fastestAnswer 
                ? `<@${fastestAnswer.user_id}> (${fastestAnswer.answer_time / 1000} secondes)`
                : 'Aucune réponse correcte.',
              inline: false
            }
          ]
        }
      );
      
      // Désactiver les boutons
      await questionMessage.edit({
        embeds: [resultsEmbed],
        components: []
      });
    }
    
  } catch (error) {
    console.error('Error showing question results:', error);
  }
}

// Fonction pour terminer un quiz
async function endTriviaGame(client, gameId, channel) {
  try {
    // Mettre à jour le statut du quiz
    await client.db.db.run(`
      UPDATE trivia_battle_games
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `, gameId);
    
    // Récupérer les informations du quiz
    const game = await client.db.db.get(`
      SELECT * FROM trivia_battle_games
      WHERE id = ?
    `, gameId);
    
    // Récupérer les participants triés par score
    const participants = await client.db.db.all(`
      SELECT p.*, u.user_id 
      FROM trivia_battle_participants p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.game_id = ?
      ORDER BY p.score DESC
    `, gameId);
    
    // Calculer les gains
    const totalPrize = game.entry_fee * participants.length;
    const prizes = calculatePrizes(totalPrize, participants.length);
    
    // Attribuer les prix
    const results = [];
    
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const prize = prizes[i] || 0;
      
      if (prize > 0) {
        // Ajouter les PiloCoins
        await client.db.updateUserBalance(participant.user_id, prize);
        
        // Mettre à jour les statistiques de l'utilisateur
        const stats = {
          pilocoins_earned: prize
        };
        
        // Si c'est le gagnant (1ère place), incrémenter les victoires
        if (i === 0) {
          stats.games_won = 1;
        }
        
        await updateTriviaStats(client, participant.user_id, stats);
      }
      
      // Récupérer le nom d'utilisateur
      const user = await client.users.fetch(participant.user_id).catch(() => null);
      const username = user ? user.username : 'Inconnu';
      
      results.push({
        userId: participant.user_id,
        username,
        score: participant.score,
        correctAnswers: participant.correct_answers,
        fastestAnswers: participant.fastest_answers,
        prize
      });
    }
    
    // Créer l'embed de résultats finaux
    const resultsEmbed = EmbedCreator.success(
      '🏆 Quiz terminé!',
      `Le quiz multijoueur #${gameId} est terminé! Voici les résultats:`,
      {
        fields: [
          {
            name: '🥇 Classement',
            value: results.length > 0 
              ? results.map((r, i) => `${getPositionEmoji(i)} **${r.username}** - ${r.score} points (${r.correctAnswers} correctes, ${r.fastestAnswers} rapides) - Gains: ${r.prize} PiloCoins`).join('\n')
              : 'Aucun participant.',
            inline: false
          },
          {
            name: '💰 Cagnotte totale',
            value: `${totalPrize} PiloCoins`,
            inline: true
          },
          {
            name: '❓ Questions',
            value: `${game.question_count} questions`,
            inline: true
          }
        ]
      }
    );
    
    // Envoyer l'embed de résultats
    await channel.send({ embeds: [resultsEmbed] });
    
    // Nettoyer les ressources
    client.triviaMessages.delete(gameId);
    
  } catch (error) {
    console.error('Error ending trivia game:', error);
  }
}

// Fonction pour calculer les prix en fonction du nombre de participants
function calculatePrizes(totalPrize, participantCount) {
  const prizes = [];
  
  if (participantCount <= 1) {
    // Si un seul participant, il récupère sa mise
    prizes.push(totalPrize);
  } else if (participantCount === 2) {
    // Si deux participants, le premier gagne tout
    prizes.push(totalPrize, 0);
  } else if (participantCount === 3) {
    // Si trois participants, 70% pour le 1er, 30% pour le 2ème
    prizes.push(
      Math.floor(totalPrize * 0.7),
      Math.floor(totalPrize * 0.3),
      0
    );
  } else {
    // Si quatre participants, 60% pour le 1er, 25% pour le 2ème, 15% pour le 3ème
    prizes.push(
      Math.floor(totalPrize * 0.6),
      Math.floor(totalPrize * 0.25),
      Math.floor(totalPrize * 0.15),
      0
    );
  }
  
  return prizes;
}

// Fonction pour mettre à jour les statistiques de trivia
async function updateTriviaStats(client, userId, updates) {
  // Vérifier si l'utilisateur a déjà des statistiques
  const stats = await client.db.db.get(`
    SELECT * FROM trivia_battle_stats
    WHERE user_id = ?
  `, userId);
  
  if (!stats) {
    // Créer une entrée pour l'utilisateur
    await client.db.db.run(`
      INSERT INTO trivia_battle_stats (
        user_id, 
        games_created, 
        games_joined, 
        games_won, 
        total_answers, 
        correct_answers, 
        fastest_answers, 
        pilocoins_earned, 
        pilocoins_spent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 
      userId, 
      updates.games_created || 0, 
      updates.games_joined || 0, 
      updates.games_won || 0, 
      updates.total_answers || 0, 
      updates.correct_answers || 0, 
      updates.fastest_answers || 0, 
      updates.pilocoins_earned || 0, 
      updates.pilocoins_spent || 0
    );
    
    return;
  }
  
  // Construire la requête de mise à jour
  let query = 'UPDATE trivia_battle_stats SET ';
  const params = [];
  
  // Ajouter les champs à mettre à jour
  if (updates.games_created) {
    query += 'games_created = games_created + ?, ';
    params.push(updates.games_created);
  }
  
  if (updates.games_joined) {
    query += 'games_joined = games_joined + ?, ';
    params.push(updates.games_joined);
  }
  
  if (updates.games_won) {
    query += 'games_won = games_won + ?, ';
    params.push(updates.games_won);
  }
  
  if (updates.total_answers) {
    query += 'total_answers = total_answers + ?, ';
    params.push(updates.total_answers);
  }
  
  if (updates.correct_answers) {
    query += 'correct_answers = correct_answers + ?, ';
    params.push(updates.correct_answers);
  }
  
  if (updates.fastest_answers) {
    query += 'fastest_answers = fastest_answers + ?, ';
    params.push(updates.fastest_answers);
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

// Fonction pour récupérer les statistiques de trivia
async function getTriviaStats(client, userId) {
  // Vérifier si l'utilisateur a déjà des statistiques
  const stats = await client.db.db.get(`
    SELECT * FROM trivia_battle_stats
    WHERE user_id = ?
  `, userId);
  
  if (!stats) {
    // Retourner des statistiques vides
    return {
      user_id: userId,
      games_created: 0,
      games_joined: 0,
      games_won: 0,
      total_answers: 0,
      correct_answers: 0,
      fastest_answers: 0,
      pilocoins_earned: 0,
      pilocoins_spent: 0,
      last_played: null
    };
  }
  
  return stats;
}

// Fonction pour récupérer le nom d'une catégorie
function getCategoryName(category) {
  const categories = {
    general: 'Culture Générale',
    games: 'Jeux Vidéo',
    movies: 'Films et Séries',
    music: 'Musique',
    science: 'Sciences',
    computers: 'Informatique',
    sports: 'Sport',
    history: 'Histoire',
    geography: 'Géographie',
    random: 'Aléatoire'
  };
  
  return categories[category] || 'Inconnue';
}

// Fonction pour obtenir l'emoji de position
function getPositionEmoji(position) {
  switch (position) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return `${position + 1}.`;
  }
}

// Fonction pour mélanger un tableau
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Fonction pour encoder une option (pour les ID de bouton)
function encodeOption(option) {
  // Limiter la longueur et encoder les caractères spéciaux
  return encodeURIComponent(option.substring(0, 20)).replace(/%/g, '_');
}