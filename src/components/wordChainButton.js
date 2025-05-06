import { EmbedCreator } from '../utils/embedCreator.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

// Gestionnaire pour le bouton de proposition de mot
export default {
  customId: 'wordchain_answer',
  
  async execute(interaction, client, extraData) {
    try {
      if (!extraData || extraData.length < 1) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Données de bouton invalides.'
            )
          ],
          ephemeral: true
        });
      }
      
      const gameId = extraData[0];
      
      // Récupérer les informations de la partie
      const game = await client.db.db.get(`
        SELECT * FROM word_chain_games
        WHERE id = ?
      `, gameId);
      
      if (!game) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Partie introuvable',
              'Cette partie n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si la partie est toujours en cours
      if (game.status !== 'in_progress') {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Partie terminée',
              'Cette partie est déjà terminée.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Récupérer les informations du tour
      const turnInfo = client.wordChainTurns.get(gameId);
      
      if (!turnInfo) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Tour introuvable',
              'Ce tour n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si c'est le tour du joueur
      if (interaction.user.id !== turnInfo.userId) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Ce n\'est pas votre tour',
              'Ce n\'est pas votre tour de jouer.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Créer le modal pour la saisie du mot
      const modal = new ModalBuilder()
        .setCustomId(`wordchain_modal_${gameId}`)
        .setTitle('Proposer un mot');
      
      // Ajouter un champ de texte pour le mot
      const wordInput = new TextInputBuilder()
        .setCustomId('word')
        .setLabel('Votre mot')
        .setPlaceholder('Entrez votre mot ici')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(30);
      
      // Ajouter le champ de texte au modal
      const actionRow = new ActionRowBuilder().addComponents(wordInput);
      modal.addComponents(actionRow);
      
      // Afficher le modal
      await interaction.showModal(modal);
      
    } catch (error) {
      console.error('Error in word chain answer button:', error);
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement de votre action.'
          )
        ],
        ephemeral: true
      });
    }
  }
};

// Gestionnaire pour le bouton de participation à une partie
export const joinButton = {
  customId: 'wordchain_join',
  
  async execute(interaction, client, extraData) {
    try {
      if (!extraData || extraData.length < 1) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Données de bouton invalides.'
            )
          ],
          ephemeral: true
        });
      }
      
      const gameId = extraData[0];
      
      // Récupérer la partie
      const game = await client.db.db.get(`
        SELECT * FROM word_chain_games
        WHERE id = ?
      `, gameId);
      
      if (!game) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Partie introuvable',
              'Cette partie n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si la partie est toujours en attente
      if (game.status !== 'waiting') {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Partie déjà commencée',
              'Cette partie a déjà commencé ou est terminée.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si l'utilisateur participe déjà
      const existingParticipant = await client.db.db.get(`
        SELECT * FROM word_chain_participants
        WHERE game_id = ? AND user_id = ?
      `, gameId, interaction.user.id);
      
      if (existingParticipant) {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Déjà inscrit',
              'Vous participez déjà à cette partie.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si la partie n'est pas pleine
      const participantCount = await client.db.db.get(`
        SELECT COUNT(*) as count FROM word_chain_participants
        WHERE game_id = ?
      `, gameId);
      
      if (participantCount.count >= 4) {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Partie complète',
              'Cette partie a déjà atteint le nombre maximum de participants (4).'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si l'utilisateur a assez de PiloCoins
      const user = await client.db.getUser(interaction.user.id);
      
      if (user.balance < game.entry_fee) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'PiloCoins insuffisants',
              `Vous avez besoin de ${game.entry_fee} PiloCoins pour participer à cette partie. Vous n'avez que ${user.balance} PiloCoins.`
            )
          ],
          ephemeral: true
        });
      }
      
      // Déduire la mise
      await client.db.updateUserBalance(interaction.user.id, -game.entry_fee);
      
      // Déterminer l'ordre du joueur
      const nextOrder = participantCount.count + 1;
      
      // Ajouter l'utilisateur comme participant
      await client.db.db.run(`
        INSERT INTO word_chain_participants (
          game_id, user_id, turn_order
        ) VALUES (?, ?, ?)
      `, gameId, interaction.user.id, nextOrder);
      
      // Mettre à jour les statistiques de l'utilisateur
      await updateWordChainStats(client, interaction.user.id, {
        games_joined: 1,
        pilocoins_spent: game.entry_fee
      });
      
      // Récupérer tous les participants
      const participants = await client.db.db.all(`
        SELECT * FROM word_chain_participants
        WHERE game_id = ?
      `, gameId);
      
      // Récupérer les noms d'utilisateurs des participants
      const participantUsers = await Promise.all(
        participants.map(async p => {
          const user = await client.users.fetch(p.user_id).catch(() => null);
          return user ? user : { id: p.user_id, toString: () => `<@${p.user_id}>` };
        })
      );
      
      // Mettre à jour l'embed d'invitation
      const messageInfo = client.wordChainMessages.get(gameId);
      
      if (messageInfo) {
        try {
          const message = await interaction.channel.messages.fetch(messageInfo.messageId).catch(() => null);
          
          if (message) {
            const embed = message.embeds[0];
            
            // Déterminer les règles en fonction du mode
            let modeDescription;
            switch (game.mode) {
              case 'normal':
                modeDescription = 'Chaque mot doit commencer par la dernière lettre du mot précédent.';
                break;
              case 'syllable':
                modeDescription = 'Chaque mot doit commencer par la dernière syllabe du mot précédent.';
                break;
              case 'theme':
                modeDescription = `Tous les mots doivent appartenir au thème "${getThemeName(game.theme)}". Ils doivent aussi commencer par la dernière lettre du mot précédent.`;
                break;
            }
            
            // Mettre à jour l'embed
            const updatedEmbed = EmbedCreator.success(
              embed.title,
              embed.description,
              {
                fields: [
                  {
                    name: '🎮 Mode',
                    value: getModeName(game.mode),
                    inline: true
                  },
                  {
                    name: '⏱️ Temps de réponse',
                    value: `${game.time_limit} secondes`,
                    inline: true
                  },
                  {
                    name: '💰 Mise d\'entrée',
                    value: `${game.entry_fee} PiloCoins`,
                    inline: true
                  },
                  {
                    name: '📏 Règles',
                    value: modeDescription,
                    inline: false
                  },
                  {
                    name: `👥 Participants (${participants.length}/4)`,
                    value: participantUsers.map(u => u.toString()).join('\n'),
                    inline: true
                  },
                  {
                    name: '⏱️ Démarrage',
                    value: embed.fields[5].value,
                    inline: true
                  }
                ]
              }
            );
            
            await message.edit({ embeds: [updatedEmbed] });
          }
        } catch (err) {
          console.error('Error updating word chain message:', err);
        }
      }
      
      // Répondre à l'utilisateur
      return interaction.reply({
        embeds: [
          EmbedCreator.success(
            '✅ Inscription réussie',
            `Vous avez rejoint la partie #${gameId}. ${game.entry_fee} PiloCoins ont été déduits de votre compte.`,
            {
              fields: [
                {
                  name: '👥 Participants',
                  value: `${participants.length}/4`,
                  inline: true
                },
                {
                  name: '💰 PiloCoins restants',
                  value: `${user.balance - game.entry_fee}`,
                  inline: true
                }
              ]
            }
          )
        ],
        ephemeral: true
      });
      
      // Si 4 participants, démarrer la partie immédiatement
      if (participants.length >= 4) {
        // Démarrer la partie après un court délai
        setTimeout(async () => {
          // Vérifier si la partie est toujours en attente
          const currentGame = await client.db.db.get(`
            SELECT * FROM word_chain_games
            WHERE id = ? AND status = 'waiting'
          `, gameId);
          
          if (currentGame) {
            await startWordChainGame(client, gameId, interaction.channel);
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('Error in word chain join button:', error);
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors de votre inscription à la partie.'
          )
        ],
        ephemeral: true
      });
    }
  }
};

// Gestionnaire pour le modal de saisie de mot
export const modalHandler = {
  customId: 'wordchain_modal',
  
  async execute(interaction, client, extraData) {
    try {
      if (!extraData || extraData.length < 1) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Données de modal invalides.'
            )
          ],
          ephemeral: true
        });
      }
      
      const gameId = extraData[0];
      
      // Récupérer les informations de la partie
      const game = await client.db.db.get(`
        SELECT * FROM word_chain_games
        WHERE id = ?
      `, gameId);
      
      if (!game) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Partie introuvable',
              'Cette partie n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si la partie est toujours en cours
      if (game.status !== 'in_progress') {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Partie terminée',
              'Cette partie est déjà terminée.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Récupérer les informations du tour
      const turnInfo = client.wordChainTurns.get(gameId);
      
      if (!turnInfo) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Tour introuvable',
              'Ce tour n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si c'est le tour du joueur
      if (interaction.user.id !== turnInfo.userId) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Ce n\'est pas votre tour',
              'Ce n\'est pas votre tour de jouer.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Annuler le timeout
      clearTimeout(turnInfo.timeout);
      
      // Récupérer le mot saisi
      const word = interaction.fields.getTextInputValue('word').trim().toLowerCase();
      
      // Vérifier si le mot est valide
      const isValid = validateWord(game, word);
      
      // Enregistrer le mot
      await client.db.db.run(`
        INSERT INTO word_chain_words (
          game_id, user_id, word, is_valid, turn_number
        ) VALUES (?, ?, ?, ?, ?)
      `, gameId, interaction.user.id, word, isValid ? 1 : 0, game.current_turn);
      
      // Mettre à jour les statistiques du joueur
      await updateWordChainStats(client, interaction.user.id, {
        words_submitted: 1,
        invalid_words: isValid ? 0 : 1
      });
      
      if (isValid) {
        // Mettre à jour la partie avec le nouveau mot
        let newLastLetter;
        
        if (game.mode === 'syllable') {
          // Pour le mode syllabe, on prend la dernière syllabe
          newLastLetter = getLastSyllable(word);
        } else {
          // Pour les autres modes, on prend la dernière lettre
          newLastLetter = word.charAt(word.length - 1);
        }
        
        await client.db.db.run(`
          UPDATE word_chain_games
          SET last_word = ?, last_letter = ?, chain_length = chain_length + 1,
              current_turn = current_turn + 1, updated_at = datetime('now')
          WHERE id = ?
        `, word, newLastLetter, gameId);
        
        // Répondre au joueur
        await interaction.reply({
          embeds: [
            EmbedCreator.success(
              '✅ Mot accepté',
              `Votre mot "${word}" a été accepté!`,
              {
                fields: [
                  {
                    name: game.mode === 'syllable' ? '🔤 Nouvelle syllabe' : '🔤 Nouvelle lettre',
                    value: newLastLetter,
                    inline: true
                  },
                  {
                    name: '🔄 Chaîne actuelle',
                    value: `${game.chain_length + 1} mots`,
                    inline: true
                  }
                ]
              }
            )
          ],
          ephemeral: true
        });
        
        // Afficher le mot dans le canal
        const wordEmbed = EmbedCreator.info(
          `🔤 Tour ${game.current_turn}`,
          `${interaction.user} a proposé le mot: **${word}**`,
          {
            fields: [
              {
                name: '🔄 Chaîne actuelle',
                value: `${game.chain_length + 1} mots`,
                inline: true
              },
              {
                name: game.mode === 'syllable' ? '🔤 Prochaine syllabe' : '🔤 Prochaine lettre',
                value: newLastLetter,
                inline: true
              }
            ]
          }
        );
        
        await interaction.channel.send({ embeds: [wordEmbed] });
        
      } else {
        // Le mot est invalide, le joueur est éliminé
        await client.db.db.run(`
          UPDATE word_chain_participants
          SET is_eliminated = 1
          WHERE game_id = ? AND user_id = ?
        `, gameId, interaction.user.id);
        
        // Déterminer la raison de l'invalidité
        let rejectionReason;
        
        if (game.last_letter && (game.mode === 'normal' || game.mode === 'theme') && word.charAt(0) !== game.last_letter) {
          rejectionReason = `Le mot doit commencer par la lettre "${game.last_letter}".`;
        } else if (game.last_letter && game.mode === 'syllable' && !word.startsWith(game.last_letter)) {
          rejectionReason = `Le mot doit commencer par la syllabe "${game.last_letter}".`;
        } else if (game.mode === 'theme') {
          rejectionReason = `Le mot ne correspond pas au thème "${getThemeName(game.theme)}".`;
        } else {
          rejectionReason = 'Le mot est invalide.';
        }
        
        // Répondre au joueur
        await interaction.reply({
          embeds: [
            EmbedCreator.error(
              '❌ Mot refusé',
              `Votre mot "${word}" a été refusé! ${rejectionReason} Vous êtes éliminé de la partie.`
            )
          ],
          ephemeral: true
        });
        
        // Afficher l'élimination dans le canal
        const eliminationEmbed = EmbedCreator.error(
          '❌ Mot invalide!',
          `${interaction.user} a proposé un mot invalide et est éliminé!`,
          {
            fields: [
              {
                name: '🔤 Mot refusé',
                value: word,
                inline: true
              },
              {
                name: '❓ Raison',
                value: rejectionReason,
                inline: true
              }
            ]
          }
        );
        
        await interaction.channel.send({ embeds: [eliminationEmbed] });
        
        // Incrémenter le numéro de tour
        await client.db.db.run(`
          UPDATE word_chain_games
          SET current_turn = current_turn + 1
          WHERE id = ?
        `, gameId);
      }
      
      // Nettoyer les ressources
      client.wordChainTurns.delete(gameId);
      
      // Passer au tour suivant après un court délai
      setTimeout(async () => {
        await startNextTurn(client, gameId, interaction.channel);
      }, 2000);
      
    } catch (error) {
      console.error('Error in word chain modal:', error);
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement de votre mot.'
          )
        ],
        ephemeral: true
      });
    }
  }
};

// Fonction pour valider un mot
function validateWord(game, word) {
  // Vérifier que le mot n'est pas vide
  if (!word || word.length === 0) return false;
  
  // Vérifier que le mot ne contient que des lettres
  if (!/^[a-zàáâäæçèéêëìíîïòóôöœùúûüñ-]+$/i.test(word)) return false;
  
  // Si c'est le premier mot, il est valide
  if (!game.last_word) return true;
  
  // Vérifier les règles en fonction du mode
  switch (game.mode) {
    case 'normal':
      // Le mot doit commencer par la dernière lettre du mot précédent
      return word.charAt(0) === game.last_letter;
    
    case 'syllable':
      // Le mot doit commencer par la dernière syllabe du mot précédent
      return word.startsWith(game.last_letter);
    
    case 'theme':
      // Le mot doit être du thème et commencer par la dernière lettre
      return word.charAt(0) === game.last_letter && isWordInTheme(word, game.theme);
    
    default:
      return true;
  }
}

// Fonction pour déterminer si un mot est dans un thème
function isWordInTheme(word, theme) {
  // Cette fonction devrait idéalement utiliser une API ou une base de données de mots par thème
  // Pour simplifier, nous utilisons des listes prédéfinies pour chaque thème
  
  // Liste d'exemples pour chaque thème
  const themes = {
    animals: ['chat', 'chien', 'lion', 'tigre', 'elephant', 'girafe', 'zebre', 'singe', 'ours', 'loup', 'renard', 'aigle', 'faucon', 'serpent', 'crocodile', 'tortue', 'baleine', 'dauphin', 'requin', 'poisson', 'fourmi', 'abeille', 'mouche', 'araignee', 'scorpion'],
    places: ['paris', 'londres', 'berlin', 'madrid', 'rome', 'tokyo', 'pekin', 'moscou', 'newyork', 'france', 'allemagne', 'espagne', 'italie', 'japon', 'chine', 'russie', 'etatsunis', 'canada', 'mexique', 'bresil', 'argentine', 'australie', 'egypte', 'algerie', 'maroc'],
    food: ['pizza', 'pates', 'riz', 'pain', 'fromage', 'beurre', 'lait', 'yaourt', 'viande', 'poulet', 'boeuf', 'porc', 'poisson', 'salade', 'tomate', 'carotte', 'pomme', 'banane', 'orange', 'fraise', 'chocolat', 'gateau', 'tarte', 'glace', 'bonbon'],
    sports: ['football', 'basketball', 'tennis', 'rugby', 'natation', 'athletisme', 'gymnastique', 'boxe', 'judo', 'karate', 'golf', 'hockey', 'volleyball', 'badminton', 'cyclisme', 'equitation', 'ski', 'snowboard', 'surf', 'plongee', 'escalade', 'voile', 'aviron', 'marathon', 'triathlon'],
    movies: ['acteur', 'actrice', 'realisateur', 'scenario', 'film', 'cinema', 'hollywood', 'oscar', 'comedie', 'drame', 'thriller', 'horreur', 'action', 'aventure', 'romance', 'fantasy', 'scifi', 'animation', 'documentaire', 'western', 'musical', 'biopic', 'policier', 'superheros', 'blockbuster']
  };
  
  // Vérifier si le mot est dans la liste correspondant au thème
  return themes[theme] && themes[theme].includes(word);
}

// Fonction pour obtenir la dernière syllabe d'un mot
function getLastSyllable(word) {
  // Cette fonction est très simplifiée et ne reflète pas toutes les règles de syllabation du français
  // Pour une implémentation plus précise, il faudrait utiliser une bibliothèque dédiée
  
  // Règle simple: prendre la dernière voyelle et tout ce qui la suit
  const vowels = ['a', 'e', 'i', 'o', 'u', 'y', 'à', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'ù', 'û'];
  
  for (let i = word.length - 1; i >= 0; i--) {
    if (vowels.includes(word[i])) {
      // Si c'est une voyelle, on prend depuis cette position jusqu'à la fin du mot
      return word.substring(i);
    }
  }
  
  // Si pas de voyelle trouvée, on prend juste la dernière lettre
  return word.charAt(word.length - 1);
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
    
    // Envoyer le message d'annonce
    await channel.send({ embeds: [startEmbed] });
    
  } catch (error) {
    console.error('Error starting word chain game:', error);
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
    if (!game || game.status !== 'in_progress') {
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
    if (!game || game.status !== 'in_progress') {
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

// Fonction pour mélanger un tableau
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}