import { EmbedCreator } from '../utils/embedCreator.js';

// Gestionnaire pour le bouton de réponse aux questions du quiz
export default {
  customId: 'trivia_answer',
  
  async execute(interaction, client, extraData) {
    try {
      if (!extraData || extraData.length < 2) {
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
      
      const [questionId, encodedOption] = extraData;
      
      // Décoder l'option
      const option = decodeURIComponent(encodedOption.replace(/_/g, '%'));
      
      // Récupérer la question
      const question = await client.db.db.get(`
        SELECT * FROM trivia_battle_questions
        WHERE id = ?
      `, questionId);
      
      if (!question) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Question introuvable',
              'Cette question n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Récupérer le quiz
      const game = await client.db.db.get(`
        SELECT * FROM trivia_battle_games
        WHERE id = ?
      `, question.game_id);
      
      if (!game) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Quiz introuvable',
              'Ce quiz n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si le quiz est toujours en cours
      if (game.status !== 'in_progress') {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Quiz terminé',
              'Ce quiz est déjà terminé.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si l'utilisateur est un participant
      const participant = await client.db.db.get(`
        SELECT * FROM trivia_battle_participants
        WHERE game_id = ? AND user_id = ?
      `, game.id, interaction.user.id);
      
      if (!participant) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Non autorisé',
              'Vous ne participez pas à ce quiz.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si l'utilisateur a déjà répondu à cette question
      const existingAnswer = await client.db.db.get(`
        SELECT * FROM trivia_battle_answers
        WHERE question_id = ? AND user_id = ?
      `, questionId, interaction.user.id);
      
      if (existingAnswer) {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Déjà répondu',
              `Vous avez déjà répondu "${existingAnswer.answer}" à cette question.`
            )
          ],
          ephemeral: true
        });
      }
      
      // Calculer le temps de réponse (en millisecondes)
      const questionMessage = await interaction.channel.messages.fetch(question.message_id).catch(() => null);
      let answerTime = 15000; // Valeur par défaut
      
      if (questionMessage) {
        answerTime = Date.now() - questionMessage.createdTimestamp;
        
        // Vérifier si le temps de réponse est valide (moins de 15 secondes)
        if (answerTime > 15000) {
          return interaction.reply({
            embeds: [
              EmbedCreator.warning(
                'Temps écoulé',
                'Le temps pour répondre à cette question est écoulé.'
              )
            ],
            ephemeral: true
          });
        }
      }
      
      // Vérifier si la réponse est correcte
      const isCorrect = option === question.correct_answer;
      
      // Enregistrer la réponse
      await client.db.db.run(`
        INSERT INTO trivia_battle_answers (
          question_id, user_id, answer, is_correct, answer_time
        ) VALUES (?, ?, ?, ?, ?)
      `, questionId, interaction.user.id, option, isCorrect ? 1 : 0, answerTime);
      
      // Répondre à l'utilisateur
      return interaction.reply({
        embeds: [
          EmbedCreator[isCorrect ? 'success' : 'warning'](
            isCorrect ? '✅ Réponse enregistrée' : '❌ Réponse enregistrée',
            `Votre réponse "${option}" a été enregistrée.${isCorrect ? ' Bonne réponse !' : ''}`,
            {
              fields: [
                {
                  name: '⏱️ Temps de réponse',
                  value: `${(answerTime / 1000).toFixed(2)} secondes`,
                  inline: true
                }
              ]
            }
          )
        ],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error in trivia answer button:', error);
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement de votre réponse.'
          )
        ],
        ephemeral: true
      });
    }
  }
};

// Gestionnaire pour le bouton de participation à un quiz
export const joinButton = {
  customId: 'trivia_join',
  
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
      
      // Récupérer le quiz
      const game = await client.db.db.get(`
        SELECT * FROM trivia_battle_games
        WHERE id = ?
      `, gameId);
      
      if (!game) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Quiz introuvable',
              'Ce quiz n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si le quiz est toujours en attente
      if (game.status !== 'waiting') {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Quiz déjà commencé',
              'Ce quiz a déjà commencé ou est terminé.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si l'utilisateur participe déjà
      const existingParticipant = await client.db.db.get(`
        SELECT * FROM trivia_battle_participants
        WHERE game_id = ? AND user_id = ?
      `, gameId, interaction.user.id);
      
      if (existingParticipant) {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Déjà inscrit',
              'Vous participez déjà à ce quiz.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier si le quiz n'est pas plein
      const participantCount = await client.db.db.get(`
        SELECT COUNT(*) as count FROM trivia_battle_participants
        WHERE game_id = ?
      `, gameId);
      
      if (participantCount.count >= 4) {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Quiz complet',
              'Ce quiz a déjà atteint le nombre maximum de participants (4).'
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
              `Vous avez besoin de ${game.entry_fee} PiloCoins pour participer à ce quiz. Vous n'avez que ${user.balance} PiloCoins.`
            )
          ],
          ephemeral: true
        });
      }
      
      // Déduire la mise
      await client.db.updateUserBalance(interaction.user.id, -game.entry_fee);
      
      // Ajouter l'utilisateur comme participant
      await client.db.db.run(`
        INSERT INTO trivia_battle_participants (
          game_id, user_id
        ) VALUES (?, ?)
      `, gameId, interaction.user.id);
      
      // Mettre à jour les statistiques de l'utilisateur
      await updateTriviaStats(client, interaction.user.id, {
        games_joined: 1,
        pilocoins_spent: game.entry_fee
      });
      
      // Récupérer tous les participants
      const participants = await client.db.db.all(`
        SELECT * FROM trivia_battle_participants
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
      const messageInfo = client.triviaMessages.get(gameId);
      
      if (messageInfo) {
        try {
          const message = await interaction.channel.messages.fetch(messageInfo.messageId).catch(() => null);
          
          if (message) {
            const embed = message.embeds[0];
            
            // Mettre à jour l'embed
            const updatedEmbed = EmbedCreator.success(
              embed.title,
              embed.description,
              {
                fields: [
                  {
                    name: '📊 Catégorie',
                    value: embed.fields[0].value,
                    inline: true
                  },
                  {
                    name: '❓ Questions',
                    value: embed.fields[1].value,
                    inline: true
                  },
                  {
                    name: '💰 Mise d\'entrée',
                    value: embed.fields[2].value,
                    inline: true
                  },
                  {
                    name: `👥 Participants (${participants.length}/4)`,
                    value: participantUsers.map(u => u.toString()).join('\n'),
                    inline: false
                  },
                  {
                    name: '⏱️ Démarrage',
                    value: embed.fields[4].value,
                    inline: false
                  }
                ]
              }
            );
            
            await message.edit({ embeds: [updatedEmbed] });
          }
        } catch (err) {
          console.error('Error updating trivia message:', err);
        }
      }
      
      // Répondre à l'utilisateur
      return interaction.reply({
        embeds: [
          EmbedCreator.success(
            '✅ Inscription réussie',
            `Vous avez rejoint le quiz #${gameId}. ${game.entry_fee} PiloCoins ont été déduits de votre compte.`,
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
      
      // Si 4 participants, démarrer le quiz immédiatement
      if (participants.length >= 4) {
        // Démarrer le quiz après un court délai
        setTimeout(async () => {
          // Vérifier si le quiz est toujours en attente
          const currentGame = await client.db.db.get(`
            SELECT * FROM trivia_battle_games
            WHERE id = ? AND status = 'waiting'
          `, gameId);
          
          if (currentGame) {
            await startTriviaGame(client, gameId, interaction.channel);
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('Error in trivia join button:', error);
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors de votre inscription au quiz.'
          )
        ],
        ephemeral: true
      });
    }
  }
};

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
  } catch (error) {
    console.error('Error starting trivia game:', error);
  }
}