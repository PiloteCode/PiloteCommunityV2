import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder
} from 'discord.js';

export const randomEvents = {
  // Meteor Event - First to click gets credits
  meteor: {
    name: 'Météorite',
    description: 'Une météorite vient de tomber! Premier arrivé, premier servi!',
    async trigger(client, channel) {
      // Create event in database
      const eventId = await client.db.createEvent('meteor', channel.id, 60000, {
        reward: Math.floor(Math.random() * 300) + 200, // 200-500 credits
        claimed: false
      });
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('🌠 Une météorite est tombée!')
        .setDescription('Une météorite contenant des crédits vient de tomber! Soyez le premier à la récupérer!')
        .setColor('#FF9900')
        .setTimestamp();
      
      // Create button
      const button = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`meteor:claim:${eventId}`)
            .setLabel('Récupérer la météorite')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🌠')
        );
      
      // Send message
      const message = await channel.send({
        embeds: [embed],
        components: [button]
      });
      
      // Update event with message ID
      await client.db.updateEventMessage(eventId, message.id);
      
      // Set up collector
      const collector = message.createMessageComponentCollector({ 
        componentType: ComponentType.Button,
        time: 60000 // 1 minute
      });
      
      // Handle button clicks
      collector.on('collect', async (interaction) => {
        try {
          // Get event from database
          const events = await client.db.getActiveEvents();
          const event = events.find(e => e.id === parseInt(eventId));
          
          if (!event || event.data.claimed) {
            return interaction.reply({
              content: '❌ Cette météorite a déjà été récupérée!',
              ephemeral: true
            });
          }
          
          // Mark event as claimed
          event.data.claimed = true;
          await client.db.completeEvent(eventId);
          
          // Award credits
          await client.db.updateUserBalance(interaction.user.id, event.data.reward);
          
          // Update message
          const updatedEmbed = new EmbedBuilder()
            .setTitle('🌠 Météorite récupérée!')
            .setDescription(`<@${interaction.user.id}> a récupéré la météorite et gagné **${event.data.reward}** crédits!`)
            .setColor('#32CD32')
            .setTimestamp();
          
          await message.edit({
            embeds: [updatedEmbed],
            components: []
          });
          
          // Reply to interaction
          await interaction.reply({
            content: `✅ Vous avez récupéré la météorite et gagné **${event.data.reward}** crédits!`,
            ephemeral: true
          });
        } catch (error) {
          console.error('Error handling meteor claim:', error);
          await interaction.reply({
            content: '❌ Une erreur est survenue lors de la récupération de la météorite.',
            ephemeral: true
          });
        }
      });
      
      // When collector ends, disable button if not claimed
      collector.on('end', async () => {
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        if (event && !event.data.claimed) {
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('🌠 La météorite s\'est désintégrée!')
            .setDescription('Personne n\'a récupéré la météorite à temps!')
            .setColor('#FF0000')
            .setTimestamp();
          
          await message.edit({
            embeds: [timeoutEmbed],
            components: []
          });
          
          await client.db.completeEvent(eventId);
        }
      });
    }
  },
  
  // Quiz Event - Multiple choice question
  quiz: {
    name: 'Quiz',
    description: 'Testez vos connaissances avec un quiz!',
    async trigger(client, channel) {
      // Define questions and answers
      const questions = [
        {
          question: 'Quelle est la capitale de la France?',
          options: ['Paris', 'Lyon', 'Marseille', 'Bordeaux'],
          answer: 0,
          difficulty: 'easy'
        },
        {
          question: 'Quel est le plus grand océan du monde?',
          options: ['Atlantique', 'Arctique', 'Indien', 'Pacifique'],
          answer: 3,
          difficulty: 'easy'
        },
        {
          question: 'Quelle est la planète la plus proche du soleil?',
          options: ['Vénus', 'Mercure', 'Mars', 'Terre'],
          answer: 1,
          difficulty: 'medium'
        },
        {
          question: 'Dans quel pays se trouve le Taj Mahal?',
          options: ['Chine', 'Inde', 'Pakistan', 'Bangladesh'],
          answer: 1,
          difficulty: 'medium'
        },
        {
          question: 'Quel élément a pour symbole chimique "Fe"?',
          options: ['Fer', 'Fluor', 'Francium', 'Fermium'],
          answer: 0,
          difficulty: 'hard'
        },
        {
          question: 'Quel est le langage de programmation le plus populaire en 2023?',
          options: ['Python', 'JavaScript', 'Java', 'C++'],
          answer: 1,
          difficulty: 'medium'
        },
        {
          question: 'Qui a peint la Joconde?',
          options: ['Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Claude Monet'],
          answer: 2,
          difficulty: 'easy'
        },
        {
          question: 'Quelle est la plus grande planète du système solaire?',
          options: ['Terre', 'Mars', 'Jupiter', 'Saturne'],
          answer: 2,
          difficulty: 'easy'
        },
        {
          question: 'Quel animal est considéré comme le meilleur ami de l\'homme?',
          options: ['Chat', 'Chien', 'Cheval', 'Dauphin'],
          answer: 1,
          difficulty: 'easy'
        },
        {
          question: 'Quelle est la devise du Japon?',
          options: ['Yuan', 'Won', 'Yen', 'Dollar'],
          answer: 2,
          difficulty: 'medium'
        }
      ];
      
      // Select random question
      const question = questions[Math.floor(Math.random() * questions.length)];
      
      // Determine reward based on difficulty
      let reward;
      switch (question.difficulty) {
        case 'easy':
          reward = Math.floor(Math.random() * 100) + 100; // 100-200
          break;
        case 'medium':
          reward = Math.floor(Math.random() * 150) + 200; // 200-350
          break;
        case 'hard':
          reward = Math.floor(Math.random() * 200) + 300; // 300-500
          break;
        default:
          reward = 200;
      }
      
      // Create event in database
      const eventId = await client.db.createEvent('quiz', channel.id, 30000, {
        question: question.question,
        options: question.options,
        answer: question.answer,
        reward: reward,
        answered: false
      });
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('🧠 Quiz Time!')
        .setDescription(`**Question:** ${question.question}\n\nRépondez correctement pour gagner **${reward}** crédits!`)
        .setColor('#4B0082')
        .setFields(
          question.options.map((option, index) => ({
            name: `Option ${index + 1}`,
            value: option,
            inline: true
          }))
        )
        .setFooter({ text: 'Vous avez 30 secondes pour répondre!' })
        .setTimestamp();
      
      // Create buttons
      const row = new ActionRowBuilder()
        .addComponents(
          question.options.map((option, index) => 
            new ButtonBuilder()
              .setCustomId(`quiz:answer:${eventId}:${index}`)
              .setLabel(`${index + 1}`)
              .setStyle(ButtonStyle.Secondary)
          )
        );
      
      // Send message
      const message = await channel.send({
        embeds: [embed],
        components: [row]
      });
      
      // Update event with message ID
      await client.db.updateEventMessage(eventId, message.id);
      
      // Set up collector
      const collector = message.createMessageComponentCollector({ 
        componentType: ComponentType.Button,
        time: 30000 // 30 seconds
      });
      
      // Handle button clicks
      collector.on('collect', async (interaction) => {
        try {
          // Get event from database
          const events = await client.db.getActiveEvents();
          const event = events.find(e => e.id === parseInt(eventId));
          
          if (!event || event.data.answered) {
            return interaction.reply({
              content: '❌ Quelqu\'un a déjà répondu à cette question!',
              ephemeral: true
            });
          }
          
          // Get selected answer
          const selectedAnswer = parseInt(interaction.customId.split(':')[3]);
          
          // Check if answer is correct
          const isCorrect = selectedAnswer === event.data.answer;
          
          // Mark event as answered
          event.data.answered = true;
          await client.db.completeEvent(eventId);
          
          // Update message
          const resultEmbed = new EmbedBuilder()
            .setTitle(`🧠 Quiz - ${isCorrect ? 'Bonne réponse!' : 'Mauvaise réponse!'}`)
            .setDescription(`**Question:** ${event.data.question}\n\n**Réponse correcte:** ${event.data.options[event.data.answer]}`)
            .setColor(isCorrect ? '#32CD32' : '#FF0000')
            .setTimestamp();
          
          if (isCorrect) {
            // Award credits
            await client.db.updateUserBalance(interaction.user.id, event.data.reward);
            
            resultEmbed.addFields({
              name: 'Gagnant',
              value: `<@${interaction.user.id}> a gagné **${event.data.reward}** crédits!`
            });
          } else {
            resultEmbed.addFields({
              name: 'Dommage!',
              value: `<@${interaction.user.id}> a donné une mauvaise réponse.`
            });
          }
          
          await message.edit({
            embeds: [resultEmbed],
            components: []
          });
          
          // Reply to interaction
          await interaction.reply({
            content: isCorrect 
              ? `✅ Bonne réponse! Vous avez gagné **${event.data.reward}** crédits!`
              : `❌ Mauvaise réponse! La réponse correcte était: ${event.data.options[event.data.answer]}`,
            ephemeral: true
          });
        } catch (error) {
          console.error('Error handling quiz answer:', error);
          await interaction.reply({
            content: '❌ Une erreur est survenue lors de la réponse au quiz.',
            ephemeral: true
          });
        }
      });
      
      // When collector ends, show the answer if no one answered
      collector.on('end', async () => {
        const events = await client.db.getActiveEvents();
        const event = events.find(e => e.id === parseInt(eventId));
        
        if (event && !event.data.answered) {
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('🧠 Quiz - Temps écoulé!')
            .setDescription(`**Question:** ${event.data.question}\n\n**Réponse correcte:** ${event.data.options[event.data.answer]}`)
            .setColor('#FF9900')
            .setFooter({ text: 'Personne n\'a répondu à temps!' })
            .setTimestamp();
          
          await message.edit({
            embeds: [timeoutEmbed],
            components: []
          });
          
          await client.db.completeEvent(eventId);
        }
      });
    }
  },
  
  // Duel Event - Two random users battle
  duel: {
    name: 'Duel',
    description: 'Un duel entre deux membres!',
    async trigger(client, channel) {
      // Get recent active users in the channel
      try {
        const messages = await channel.messages.fetch({ limit: 10 });
        const activeUsers = [...new Set(
          messages
            .filter(msg => !msg.author.bot)
            .map(msg => msg.author.id)
        )];
        
        // Need at least 2 users
        if (activeUsers.length < 2) {
          console.log('Not enough active users for duel event');
          return;
        }
        
        // Shuffle and pick 2 users
        const shuffled = activeUsers.sort(() => 0.5 - Math.random());
        const selectedUsers = shuffled.slice(0, 2);
        
        // Determine reward
        const reward = Math.floor(Math.random() * 300) + 200; // 200-500 credits
        
        // Create event in database
        const eventId = await client.db.createEvent('duel', channel.id, 60000, {
          users: selectedUsers,
          reward: reward,
          clicks: {
            [selectedUsers[0]]: 0,
            [selectedUsers[1]]: 0
          },
          completed: false
        });
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle('⚔️ Duel!')
          .setDescription(`<@${selectedUsers[0]}> et <@${selectedUsers[1]}> sont appelés à se battre!\nAppuyez rapidement sur le bouton pour gagner **${reward}** crédits!`)
          .setColor('#FF0000')
          .setFields([
            {
              name: `<@${selectedUsers[0]}>`,
              value: '0 clics',
              inline: true
            },
            {
              name: `<@${selectedUsers[1]}>`,
              value: '0 clics',
              inline: true
            }
          ])
          .setFooter({ text: 'Le duel se termine dans 60 secondes!' })
          .setTimestamp();
        
        // Create buttons, one for each user
        const row = new ActionRowBuilder()
          .addComponents([
            new ButtonBuilder()
              .setCustomId(`duel:click:${eventId}:${selectedUsers[0]}`)
              .setLabel(`Combattre (Joueur 1)`)
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`duel:click:${eventId}:${selectedUsers[1]}`)
              .setLabel(`Combattre (Joueur 2)`)
              .setStyle(ButtonStyle.Danger)
          ]);
        
        // Send message
        const message = await channel.send({
          content: `<@${selectedUsers[0]}> <@${selectedUsers[1]}>`,
          embeds: [embed],
          components: [row]
        });
        
        // Update event with message ID
        await client.db.updateEventMessage(eventId, message.id);
        
        // Set up collector
        const collector = message.createMessageComponentCollector({ 
          componentType: ComponentType.Button,
          time: 60000 // 1 minute
        });
        
        // Track last click time for each user to prevent spam
        const lastClick = {
          [selectedUsers[0]]: 0,
          [selectedUsers[1]]: 0
        };
        
        // Handle button clicks
        collector.on('collect', async (interaction) => {
          try {
            // Get event from database
            const events = await client.db.getActiveEvents();
            const event = events.find(e => e.id === parseInt(eventId));
            
            if (!event || event.data.completed) {
              return interaction.reply({
                content: '❌ Ce duel est déjà terminé!',
                ephemeral: true
              });
            }
            
            // Get user ID and validate they're part of the duel
            const userId = interaction.user.id;
            const buttonUserId = interaction.customId.split(':')[3];
            
            if (!event.data.users.includes(userId)) {
              return interaction.reply({
                content: '❌ Vous n\'êtes pas participant à ce duel!',
                ephemeral: true
              });
            }
            
            if (userId !== buttonUserId) {
              return interaction.reply({
                content: '❌ Ce n\'est pas votre bouton!',
                ephemeral: true
              });
            }
            
            // Anti-spam: Check if clicked too recently (minimum 500ms between clicks)
            const now = Date.now();
            if (now - lastClick[userId] < 500) {
              return interaction.reply({
                content: '⚠️ Vous cliquez trop vite! Attendez un peu.',
                ephemeral: true
              });
            }
            lastClick[userId] = now;
            
            // Increment clicks
            event.data.clicks[userId]++;
            
            // Update embed
            const updatedEmbed = EmbedBuilder.from(message.embeds[0])
              .setFields([
                {
                  name: `<@${selectedUsers[0]}>`,
                  value: `${event.data.clicks[selectedUsers[0]]} clics`,
                  inline: true
                },
                {
                  name: `<@${selectedUsers[1]}>`,
                  value: `${event.data.clicks[selectedUsers[1]]} clics`,
                  inline: true
                }
              ]);
            
            await message.edit({
              embeds: [updatedEmbed],
              components: [row]
            });
            
            // Acknowledge the click without sending a visible message
            await interaction.deferUpdate();
          } catch (error) {
            console.error('Error handling duel click:', error);
            await interaction.reply({
              content: '❌ Une erreur est survenue lors du traitement de votre clic.',
              ephemeral: true
            });
          }
        });
        
        // When collector ends, determine the winner
        collector.on('end', async () => {
          try {
            const events = await client.db.getActiveEvents();
            const event = events.find(e => e.id === parseInt(eventId));
            
            if (event && !event.data.completed) {
              // Mark as completed
              event.data.completed = true;
              await client.db.completeEvent(eventId);
              
              // Determine winner
              let winnerId;
              let isTie = false;
              
              if (event.data.clicks[selectedUsers[0]] > event.data.clicks[selectedUsers[1]]) {
                winnerId = selectedUsers[0];
              } else if (event.data.clicks[selectedUsers[1]] > event.data.clicks[selectedUsers[0]]) {
                winnerId = selectedUsers[1];
              } else {
                isTie = true;
              }
              
              let resultEmbed;
              
              if (isTie) {
                resultEmbed = new EmbedBuilder()
                  .setTitle('⚔️ Duel terminé - Match nul!')
                  .setDescription(`Match nul entre <@${selectedUsers[0]}> et <@${selectedUsers[1]}>!\nLes deux joueurs reçoivent **${Math.floor(event.data.reward / 2)}** crédits.`)
                  .setColor('#FF9900')
                  .setFields([
                    {
                      name: `<@${selectedUsers[0]}>`,
                      value: `${event.data.clicks[selectedUsers[0]]} clics`,
                      inline: true
                    },
                    {
                      name: `<@${selectedUsers[1]}>`,
                      value: `${event.data.clicks[selectedUsers[1]]} clics`,
                      inline: true
                    }
                  ])
                  .setTimestamp();
                
                // Award half reward to both
                await client.db.updateUserBalance(selectedUsers[0], Math.floor(event.data.reward / 2));
                await client.db.updateUserBalance(selectedUsers[1], Math.floor(event.data.reward / 2));
              } else {
                resultEmbed = new EmbedBuilder()
                  .setTitle('⚔️ Duel terminé!')
                  .setDescription(`<@${winnerId}> remporte le duel et gagne **${event.data.reward}** crédits!`)
                  .setColor('#32CD32')
                  .setFields([
                    {
                      name: `<@${selectedUsers[0]}>`,
                      value: `${event.data.clicks[selectedUsers[0]]} clics`,
                      inline: true
                    },
                    {
                      name: `<@${selectedUsers[1]}>`,
                      value: `${event.data.clicks[selectedUsers[1]]} clics`,
                      inline: true
                    }
                  ])
                  .setTimestamp();
                
                // Award reward to winner
                await client.db.updateUserBalance(winnerId, event.data.reward);
              }
              
              await message.edit({
                embeds: [resultEmbed],
                components: []
              });
            }
          } catch (error) {
            console.error('Error finishing duel event:', error);
          }
        });
        
      } catch (error) {
        console.error('Error triggering duel event:', error);
      }
    }
  },
  
  // Drop Party Event - Credits for everyone
  dropParty: {
    name: 'Drop Party',
    description: 'Des crédits pour tout le monde!',
    async trigger(client, channel) {
      try {
        // Determine reward per person
        const rewardPerPerson = Math.floor(Math.random() * 50) + 50; // 50-100 credits
        
        // Create event in database
        const eventId = await client.db.createEvent('drop_party', channel.id, 45000, {
          rewardPerPerson,
          participants: []
        });
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle('🎉 Drop Party!')
          .setDescription(`Une pluie de cadeaux! Chaque participant reçoit **${rewardPerPerson}** crédits!\nCliquez sur le bouton ci-dessous pour participer!`)
          .setColor('#E91E63')
          .setFooter({ text: 'L\'événement se termine dans 45 secondes!' })
          .setTimestamp();
        
        // Create button
        const button = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`drop_party:join:${eventId}`)
              .setLabel('Participer au Drop Party')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🎁')
          );
        
        // Send message
        const message = await channel.send({
          embeds: [embed],
          components: [button]
        });
        
        // Update event with message ID
        await client.db.updateEventMessage(eventId, message.id);
        
        // Set up collector
        const collector = message.createMessageComponentCollector({ 
          componentType: ComponentType.Button,
          time: 45000 // 45 seconds
        });
        
        // Handle button clicks
        collector.on('collect', async (interaction) => {
          try {
            // Get event from database
            const events = await client.db.getActiveEvents();
            const event = events.find(e => e.id === parseInt(eventId));
            
            if (!event) {
              return interaction.reply({
                content: '❌ Cet événement n\'existe plus.',
                ephemeral: true
              });
            }
            
            // Check if user already participated
            if (event.data.participants.includes(interaction.user.id)) {
              return interaction.reply({
                content: '❌ Vous participez déjà à cet événement!',
                ephemeral: true
              });
            }
            
            // Add user to participants
            event.data.participants.push(interaction.user.id);
            
            // Update event in database
            await client.db.db.run(`
              UPDATE events
              SET data = ?
              WHERE id = ?
            `, JSON.stringify(event.data), eventId);
            
            // Update participant count in embed
            const updatedEmbed = EmbedBuilder.from(message.embeds[0])
              .setDescription(`Une pluie de cadeaux! Chaque participant reçoit **${rewardPerPerson}** crédits!\nCliquez sur le bouton ci-dessous pour participer!\n\nParticipants: **${event.data.participants.length}**`);
            
            await message.edit({
              embeds: [updatedEmbed],
              components: [button]
            });
            
            // Acknowledge participation
            await interaction.reply({
              content: `✅ Vous participez maintenant au Drop Party! Vous recevrez **${rewardPerPerson}** crédits à la fin de l'événement.`,
              ephemeral: true
            });
          } catch (error) {
            console.error('Error handling drop party join:', error);
            await interaction.reply({
              content: '❌ Une erreur est survenue lors de votre participation.',
              ephemeral: true
            });
          }
        });
        
        // When collector ends, distribute rewards
        collector.on('end', async () => {
          try {
            const events = await client.db.getActiveEvents();
            const event = events.find(e => e.id === parseInt(eventId));
            
            if (event) {
              // Mark event as completed
              await client.db.completeEvent(eventId);
              
              // Get final participant count
              const participantCount = event.data.participants.length;
              
              if (participantCount === 0) {
                // No participants
                const endEmbed = new EmbedBuilder()
                  .setTitle('🎉 Drop Party terminé!')
                  .setDescription('Personne n\'a participé au Drop Party. Les cadeaux sont retournés au magasin.')
                  .setColor('#FF0000')
                  .setTimestamp();
                
                await message.edit({
                  embeds: [endEmbed],
                  components: []
                });
                
                return;
              }
              
              // Give credits to all participants
              let successCount = 0;
              
              for (const userId of event.data.participants) {
                try {
                  await client.db.updateUserBalance(userId, event.data.rewardPerPerson);
                  successCount++;
                } catch (participantError) {
                  console.error(`Error giving credits to user ${userId}:`, participantError);
                }
              }
              
              // Create completion embed
              const endEmbed = new EmbedBuilder()
                .setTitle('🎉 Drop Party terminé!')
                .setDescription(`**${successCount}** participants ont reçu **${event.data.rewardPerPerson}** crédits chacun!\nTotal distribué: **${successCount * event.data.rewardPerPerson}** crédits`)
                .setColor('#32CD32')
                .setTimestamp();
              
              await message.edit({
                embeds: [endEmbed],
                components: []
              });
            }
          } catch (error) {
            console.error('Error finishing drop party event:', error);
          }
        });
      } catch (error) {
        console.error('Error triggering drop party event:', error);
      }
    }
  },
  
  // Emoji Game - Match the emoji sequence
  emojiGame: {
    name: 'Jeu d\'Émoji',
    description: 'Reproduisez la séquence d\'émojis!',
    async trigger(client, channel) {
      try {
        // Define possible emojis
        const emojis = ['🍎', '🍌', '🍒', '🍓', '🍊', '🍋', '🍉', '🍇', '🍍', '🥝'];
        
        // Generate a random sequence of 4 emojis
        const sequence = [];
        for (let i = 0; i < 4; i++) {
          sequence.push(emojis[Math.floor(Math.random() * emojis.length)]);
        }
        
        // Determine reward
        const reward = Math.floor(Math.random() * 200) + 300; // 300-500 credits
        
        // Create event in database
        const eventId = await client.db.createEvent('emoji_game', channel.id, 60000, {
          sequence,
          reward,
          completed: false
        });
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle('🎮 Jeu d\'Émoji!')
          .setDescription(`Mémorisez cette séquence d'émojis:\n\n**${sequence.join(' ')}**\n\nVous avez 5 secondes pour la mémoriser!`)
          .setColor('#3498DB')
          .setFooter({ text: 'La séquence disparaîtra dans 5 secondes!' })
          .setTimestamp();
        
        // Send initial message
        const message = await channel.send({
          embeds: [embed]
        });
        
        // Update event with message ID
        await client.db.updateEventMessage(eventId, message.id);
        
        // Wait 5 seconds then hide the sequence
        setTimeout(async () => {
          try {
            // Create selection menu with emojis
            const selectMenuRow = new ActionRowBuilder()
              .addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId(`emoji_game:select:${eventId}:0`)
                  .setPlaceholder('Sélectionnez le 1er émoji')
                  .addOptions(
                    emojis.map(emoji => ({
                      label: emoji,
                      value: emoji,
                      emoji: emoji
                    }))
                  )
              );
            
            // Update embed to hide sequence
            const hiddenEmbed = new EmbedBuilder()
              .setTitle('🎮 Jeu d\'Émoji!')
              .setDescription(`La séquence est cachée! Reproduisez-la dans l'ordre pour gagner **${reward}** crédits.\n\nSélectionnez le 1er émoji:`)
              .setColor('#3498DB')
              .setFooter({ text: 'Vous avez 55 secondes pour reproduire la séquence!' })
              .setTimestamp();
            
            await message.edit({
              embeds: [hiddenEmbed],
              components: [selectMenuRow]
            });
            
            // Create collector for the menu
            const collector = message.createMessageComponentCollector({ 
              componentType: ComponentType.StringSelect,
              time: 55000 // 55 seconds (60s total minus the 5s to memorize)
            });
            
            // Track user selections
            const userSelections = new Map();
            
            // Handle menu selections
            collector.on('collect', async (interaction) => {
              try {
                const userId = interaction.user.id;
                const position = parseInt(interaction.customId.split(':')[3]);
                const selectedEmoji = interaction.values[0];
                
                // Initialize user's selections if needed
                if (!userSelections.has(userId)) {
                  userSelections.set(userId, []);
                }
                
                // Get user's current selections
                const selections = userSelections.get(userId);
                
                // If position is already selected, replace it
                if (position < selections.length) {
                  selections[position] = selectedEmoji;
                } else {
                  // Otherwise, add it
                  selections.push(selectedEmoji);
                }
                
                // Determine the next position
                const nextPosition = selections.length;
                
                // If user completed the sequence
                if (nextPosition === sequence.length) {
                  // Check if sequence is correct
                  const isCorrect = selections.every((emoji, index) => emoji === sequence[index]);
                  
                  if (isCorrect) {
                    // User won
                    collector.stop('win');
                    
                    // Get event from database
                    const events = await client.db.getActiveEvents();
                    const event = events.find(e => e.id === parseInt(eventId));
                    
                    if (event && !event.data.completed) {
                      // Mark event as completed
                      event.data.completed = true;
                      event.data.winner = userId;
                      await client.db.completeEvent(eventId);
                      
                      // Award credits
                      await client.db.updateUserBalance(userId, reward);
                      
                      // Add experience
                      const xpAmount = Math.floor(Math.random() * 6) + 10; // 10-15 XP
                      const xpResult = await client.db.addExperience(userId, xpAmount);
                      
                      // Create success embed
                      const successEmbed = new EmbedBuilder()
                        .setTitle('🎮 Jeu d\'Émoji - Gagné!')
                        .setDescription(`<@${userId}> a correctement reproduit la séquence **${sequence.join(' ')}** et gagne **${reward}** crédits!`)
                        .setColor('#32CD32')
                        .setFields({
                          name: '⭐ XP gagnée',
                          value: `+${xpAmount} XP`,
                          inline: true
                        })
                        .setTimestamp();
                      
                      // Add level up notification if applicable
                      if (xpResult.leveledUp) {
                        successEmbed.addFields({
                          name: '🎉 Niveau supérieur!',
                          value: `<@${userId}> est passé au niveau **${xpResult.newLevel}**!`,
                          inline: false
                        });
                      }
                      
                      await message.edit({
                        embeds: [successEmbed],
                        components: []
                      });
                      
                      // Notify the user
                      await interaction.reply({
                        content: `✅ Félicitations! Vous avez correctement reproduit la séquence et gagné **${reward}** crédits!`,
                        ephemeral: true
                      });
                    }
                    
                    return;
                  } else {
                    // User failed
                    await interaction.reply({
                      content: `❌ Séquence incorrecte! La bonne séquence était **${sequence.join(' ')}**. Vous pouvez réessayer.`,
                      ephemeral: true
                    });
                    
                    // Reset user's selections
                    userSelections.set(userId, []);
                    
                    // Update selection menu to start over
                    await interaction.message.edit({
                      components: [
                        new ActionRowBuilder()
                          .addComponents(
                            new StringSelectMenuBuilder()
                              .setCustomId(`emoji_game:select:${eventId}:0`)
                              .setPlaceholder('Sélectionnez le 1er émoji')
                              .addOptions(
                                emojis.map(emoji => ({
                                  label: emoji,
                                  value: emoji,
                                  emoji: emoji
                                }))
                              )
                          )
                      ]
                    });
                    
                    return;
                  }
                }
                
                // Update the selection menu for the next position
                await interaction.update({
                  components: [
                    new ActionRowBuilder()
                      .addComponents(
                        new StringSelectMenuBuilder()
                          .setCustomId(`emoji_game:select:${eventId}:${nextPosition}`)
                          .setPlaceholder(`Sélectionnez le ${nextPosition + 1}e émoji`)
                          .addOptions(
                            emojis.map(emoji => ({
                              label: emoji,
                              value: emoji,
                              emoji: emoji
                            }))
                          )
                      )
                  ]
                });
              } catch (error) {
                console.error('Error handling emoji game selection:', error);
                await interaction.reply({
                  content: '❌ Une erreur est survenue lors de la sélection.',
                  ephemeral: true
                });
              }
            });
            
            // When collector ends without a winner
            collector.on('end', async (collected, reason) => {
              if (reason !== 'win') {
                // Get event from database
                const events = await client.db.getActiveEvents();
                const event = events.find(e => e.id === parseInt(eventId));
                
                if (event && !event.data.completed) {
                  // Mark event as completed
                  await client.db.completeEvent(eventId);
                  
                  // Create timeout embed
                  const timeoutEmbed = new EmbedBuilder()
                    .setTitle('🎮 Jeu d\'Émoji - Temps écoulé!')
                    .setDescription(`Personne n'a réussi à reproduire la séquence **${sequence.join(' ')}** à temps!`)
                    .setColor('#FF0000')
                    .setTimestamp();
                  
                  await message.edit({
                    embeds: [timeoutEmbed],
                    components: []
                  });
                }
              }
            });
          } catch (error) {
            console.error('Error updating emoji game:', error);
          }
        }, 5000);
      } catch (error) {
        console.error('Error triggering emoji game:', error);
      }
    }
  },
  
  // Hot Potato - Pass it or lose
  hotPotato: {
    name: 'Patate Chaude',
    description: 'Ne gardez pas la patate trop longtemps!',
    async trigger(client, channel) {
      try {
        // Get recent active users in the channel
        const messages = await channel.messages.fetch({ limit: 20 });
        const activeUsers = [...new Set(
          messages
            .filter(msg => !msg.author.bot)
            .map(msg => msg.author.id)
        )];
        
        // Need at least 3 users for this game
        if (activeUsers.length < 3) {
          console.log('Not enough active users for hot potato event');
          return;
        }
        
        // Determine reward
        const reward = Math.floor(Math.random() * 200) + 300; // 300-500 credits
        
        // Create event in database
        const eventId = await client.db.createEvent('hot_potato', channel.id, 120000, {
          activeUsers,
          reward,
          currentHolder: null,
          passes: 0,
          minPasses: Math.floor(Math.random() * 3) + 3, // 3-5 passes minimum
          maxPasses: Math.floor(Math.random() * 5) + 8, // 8-12 passes maximum
          exploded: false
        });
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle('🥔 Patate Chaude!')
          .setDescription(`Une patate chaude a été lancée dans le salon! Passez-la avant qu'elle n'explose!\n\nLe dernier à avoir la patate perdra **${Math.floor(reward * 0.5)}** crédits, et tous les autres se partageront **${reward}** crédits!\n\nCliquez sur le bouton pour recevoir la patate!`)
          .setColor('#FF5722')
          .setFooter({ text: 'Soyez rapide mais stratégique!' })
          .setTimestamp();
        
        // Create start button
        const startButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`hot_potato:start:${eventId}`)
              .setLabel('Prendre la patate')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🥔')
          );
        
        // Send message
        const message = await channel.send({
          embeds: [embed],
          components: [startButton]
        });
        
        // Update event with message ID
        await client.db.updateEventMessage(eventId, message.id);
        
        // Set up collector for the start button
        const startCollector = message.createMessageComponentCollector({ 
          componentType: ComponentType.Button,
          time: 30000 // 30 seconds to start the game
        });
        
        // Handle start button clicks
        startCollector.on('collect', async (interaction) => {
          try {
            const userId = interaction.user.id;
            
            // Get event from database
            const events = await client.db.getActiveEvents();
            const event = events.find(e => e.id === parseInt(eventId));
            
            if (!event) {
              return interaction.reply({
                content: '❌ Cet événement n\'existe plus.',
                ephemeral: true
              });
            }
            
            // If the game already started, inform the user
            if (event.data.currentHolder !== null) {
              return interaction.reply({
                content: '❌ La partie a déjà commencé!',
                ephemeral: true
              });
            }
            
            // Start the game with this user
            event.data.currentHolder = userId;
            
            // Update event in database
            await client.db.db.run(`
              UPDATE events
              SET data = ?
              WHERE id = ?
            `, JSON.stringify(event.data), eventId);
            
            // Stop the start collector
            startCollector.stop();
            
            // Create pass button
            const passButton = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`hot_potato:pass:${eventId}`)
                  .setLabel('Passer la patate!')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('🥔')
              );
            
            // Update message with new embed
            const gameEmbed = new EmbedBuilder()
              .setTitle('🥔 Patate Chaude!')
              .setDescription(`La patate est en jeu! Passez-la avant qu'elle n'explose!\n\n<@${userId}> a la patate chaude! Qui va la prendre?\n\nPasses: **0**/${event.data.minPasses}-${event.data.maxPasses}`)
              .setColor('#FF5722')
              .setFooter({ text: 'La patate peut exploser à tout moment après le nombre minimum de passes!' })
              .setTimestamp();
            
            await message.edit({
              embeds: [gameEmbed],
              components: [passButton]
            });
            
            // Reply to the interaction
            await interaction.reply({
              content: '🥔 Vous avez la patate chaude! Passez-la vite!',
              ephemeral: true
            });
            
            // Set up collector for the pass button
            const passCollector = message.createMessageComponentCollector({ 
              componentType: ComponentType.Button,
              time: 90000 // 90 seconds max game time
            });
            
            // Handle pass button clicks
            passCollector.on('collect', async (interaction) => {
              try {
                const userId = interaction.user.id;
                
                // Get event from database
                const events = await client.db.getActiveEvents();
                const event = events.find(e => e.id === parseInt(eventId));
                
                if (!event || event.data.exploded) {
                  return interaction.reply({
                    content: '❌ La partie est déjà terminée!',
                    ephemeral: true
                  });
                }
                
                // Check if user is the current holder or in case you want to allow anyone to take it
                if (event.data.currentHolder !== userId) {
                  // Allow passing only if the user isn't the current holder
                  // (this makes the game more dynamic)
                  
                  // Update holder
                  const previousHolder = event.data.currentHolder;
                  event.data.currentHolder = userId;
                  
                  // Increment passes
                  event.data.passes++;
                  
                  // Check if potato should explode
                  const shouldExplode = event.data.passes >= event.data.minPasses && 
                    (event.data.passes >= event.data.maxPasses || Math.random() < 0.3);
                  
                  // Update event in database
                  await client.db.db.run(`
                    UPDATE events
                    SET data = ?
                    WHERE id = ?
                  `, JSON.stringify(event.data), eventId);
                  
                  if (shouldExplode) {
                    // Potato explodes!
                    event.data.exploded = true;
                    
                    // Mark event as completed
                    await client.db.completeEvent(eventId);
                    
                    // Create explosion embed
                    const explosionEmbed = new EmbedBuilder()
                      .setTitle('🥔 BOOM! La patate a explosé!')
                      .setDescription(`<@${userId}> tenait la patate quand elle a explosé après **${event.data.passes}** passes!\n\n<@${userId}> perd **${Math.floor(reward * 0.5)}** crédits, et tous les autres participants se partagent **${reward}** crédits!`)
                      .setColor('#FF0000')
                      .setTimestamp();
                    
                    await message.edit({
                      embeds: [explosionEmbed],
                      components: []
                    });
                    
                    // Give penalty to the loser
                    await client.db.updateUserBalance(userId, -Math.floor(reward * 0.5));
                    
                    // Give rewards to all other participants who passed the potato
                    const participants = new Set();
                    for (let i = 0; i < event.data.passes; i++) {
                      const passerId = event.data.passHistory ? event.data.passHistory[i] : null;
                      if (passerId && passerId !== userId) {
                        participants.add(passerId);
                      }
                    }
                    
                    // Add the previous participants
                    if (previousHolder) {
                      participants.add(previousHolder);
                    }
                    
                    // Convert to array and remove the loser
                    const winners = [...participants].filter(id => id !== userId);
                    
                    if (winners.length > 0) {
                      // Split the reward
                      const sharePerPerson = Math.floor(reward / winners.length);
                      
                      for (const winnerId of winners) {
                        await client.db.updateUserBalance(winnerId, sharePerPerson);
                      }
                    }
                    
                    // Notify the loser
                    await interaction.reply({
                      content: `💥 BOOM! La patate a explosé dans vos mains! Vous perdez **${Math.floor(reward * 0.5)}** crédits.`,
                      ephemeral: true
                    });
                    
                    // Stop the collector
                    passCollector.stop();
                  } else {
                    // Continue the game
                    // Update event data to include pass history
                    if (!event.data.passHistory) {
                      event.data.passHistory = [];
                    }
                    event.data.passHistory.push(previousHolder);
                    
                    await client.db.db.run(`
                      UPDATE events
                      SET data = ?
                      WHERE id = ?
                    `, JSON.stringify(event.data), eventId);
                    
                    // Update embed
                    const updatedEmbed = new EmbedBuilder()
                      .setTitle('🥔 Patate Chaude!')
                      .setDescription(`La patate continue de circuler! Passez-la avant qu'elle n'explose!\n\n<@${userId}> a maintenant la patate chaude! Qui va la prendre?\n\nPasses: **${event.data.passes}**/${event.data.minPasses}-${event.data.maxPasses}`)
                      .setColor('#FF5722')
                      .setFooter({ text: `La patate devient de plus en plus chaude!` })
                      .setTimestamp();
                    
                    await message.edit({
                      embeds: [updatedEmbed],
                      components: [passButton]
                    });
                    
                    // Notify the new holder
                    await interaction.reply({
                      content: `🥔 Vous avez maintenant la patate chaude! Passez-la vite!`,
                      ephemeral: true
                    });
                  }
                } else {
                  // User already has the potato
                  await interaction.reply({
                    content: `⚠️ Vous avez déjà la patate chaude! Attendez que quelqu'un d'autre la prenne!`,
                    ephemeral: true
                  });
                }
              } catch (error) {
                console.error('Error handling hot potato pass:', error);
                await interaction.reply({
                  content: '❌ Une erreur est survenue lors du passage de la patate.',
                  ephemeral: true
                });
              }
            });
            
            // When collector ends without explosion
            passCollector.on('end', async (collected, reason) => {
              // Get event from database
              const events = await client.db.getActiveEvents();
              const event = events.find(e => e.id === parseInt(eventId));
              
              if (event && !event.data.exploded) {
                // Mark event as completed
                await client.db.completeEvent(eventId);
                
                // Time ran out without explosion
                const timeoutEmbed = new EmbedBuilder()
                  .setTitle('🥔 La patate a refroidi!')
                  .setDescription(`La patate chaude s'est refroidie après **${event.data.passes}** passes sans exploser. Tout le monde est sain et sauf!`)
                  .setColor('#3498DB')
                  .setTimestamp();
                
                await message.edit({
                  embeds: [timeoutEmbed],
                  components: []
                });
              }
            });
          } catch (error) {
            console.error('Error starting hot potato game:', error);
            await interaction.reply({
              content: '❌ Une erreur est survenue lors du démarrage du jeu.',
              ephemeral: true
            });
          }
        });
        
        // When start collector ends without anyone taking the potato
        startCollector.on('end', async (collected, reason) => {
          if (collected.size === 0) {
            // Get event from database
            const events = await client.db.getActiveEvents();
            const event = events.find(e => e.id === parseInt(eventId));
            
            if (event && event.data.currentHolder === null) {
              // Mark event as completed
              await client.db.completeEvent(eventId);
              
              // No one took the potato
              const abandonedEmbed = new EmbedBuilder()
                .setTitle('🥔 Patate abandonnée!')
                .setDescription('Personne n\'a voulu prendre la patate chaude. Elle refroidit tristement dans un coin...')
                .setColor('#95A5A6')
                .setTimestamp();
              
              await message.edit({
                embeds: [abandonedEmbed],
                components: []
              });
            }
          }
        });
      } catch (error) {
        console.error('Error triggering hot potato event:', error);
      }
    }
  }
};