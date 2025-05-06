import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { randomEvents } from '../../utils/randomEvents.js';

export default {
  data: new SlashCommandBuilder()
    .setName('event-trigger')
    .setDescription('Déclenche manuellement un événement aléatoire (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type d\'événement à déclencher')
        .setRequired(true)
        .addChoices(
          { name: 'Météorite (premier arrivé)', value: 'meteor' },
          { name: 'Quiz (question/réponse)', value: 'quiz' },
          { name: 'Duel (click battle)', value: 'duel' },
          { name: 'Pluie de crédits', value: 'credits_rain' },
          { name: 'Chasse au trésor', value: 'treasure_hunt' },
          { name: 'Aléatoire', value: 'random' }
        )
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Canal où déclencher l\'événement (par défaut: canal actuel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  
  // Cooldown of 1 minute to prevent spam
  cooldown: 60000,
  
  async execute(interaction, client) {
    try {
      // Check if user is actually an administrator
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Permission refusée',
              'Vous devez être administrateur pour utiliser cette commande.'
            )
          ],
          ephemeral: true
        });
      }
      
      await interaction.deferReply({ ephemeral: true });
      
      const eventType = interaction.options.getString('type');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      
      // Verify that the bot has permissions to send messages in the target channel
      const botMember = await interaction.guild.members.fetchMe();
      const permissions = targetChannel.permissionsFor(botMember);
      
      if (!permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Permissions insuffisantes',
              `Le bot n'a pas les permissions nécessaires pour envoyer des messages dans <#${targetChannel.id}>.`
            )
          ]
        });
      }
      
      // Determine which event to trigger
      let eventToTrigger;
      
      if (eventType === 'random') {
        // Choose a random event
        const eventKeys = Object.keys(randomEvents);
        const randomKey = eventKeys[Math.floor(Math.random() * eventKeys.length)];
        eventToTrigger = randomEvents[randomKey];
      } else if (randomEvents[eventType]) {
        // Trigger the specified event
        eventToTrigger = randomEvents[eventType];
      } else if (eventType === 'credits_rain') {
        // Define a new "credits rain" event
        eventToTrigger = {
          name: 'Pluie de crédits',
          description: 'Des crédits tombent du ciel! Récupérez-les rapidement!',
          async trigger(client, channel) {
            // Implementation will be handled below
          }
        };
      } else if (eventType === 'treasure_hunt') {
        // Define a new "treasure hunt" event
        eventToTrigger = {
          name: 'Chasse au trésor',
          description: 'Un trésor est caché quelque part! Trouvez-le!',
          async trigger(client, channel) {
            // Implementation will be handled below
          }
        };
      } else {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Type d\'événement invalide',
              `Le type d'événement "${eventType}" n'existe pas.`
            )
          ]
        });
      }
      
      // Special handling for the two new event types
      if (eventType === 'credits_rain') {
        // Implement credits rain event here directly
        await interaction.editReply({
          embeds: [
            EmbedCreator.success(
              'Événement déclenché',
              `Une pluie de crédits a été déclenchée dans <#${targetChannel.id}>.`
            )
          ]
        });
        
        // Send event to channel
        const embed = EmbedCreator.create({
          title: '💸 Une pluie de crédits!',
          description: 'Des crédits tombent du ciel! Cliquez sur les boutons ci-dessous pour en récupérer!',
          color: 'ECONOMY',
          timestamp: true
        });
        
        // Create buttons for credit collection
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('credits_rain:collect:10')
            .setLabel('10 crédits')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId('credits_rain:collect:20')
            .setLabel('20 crédits')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId('credits_rain:collect:30')
            .setLabel('30 crédits')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('credits_rain:collect:50')
            .setLabel('50 crédits')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💎'),
          new ButtonBuilder()
            .setCustomId('credits_rain:collect:100')
            .setLabel('100 crédits')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('💎')
        );
        
        // Each button can be claimed only once per user
        const message = await targetChannel.send({
          embeds: [embed],
          components: [row1, row2]
        });
        
        // The component handler will handle the button clicks
        
        // End the event after 2 minutes
        setTimeout(async () => {
          try {
            const fetchedMessage = await targetChannel.messages.fetch(message.id);
            
            const endEmbed = EmbedCreator.create({
              title: '💸 Fin de la pluie de crédits',
              description: 'La pluie de crédits est terminée! Revenez pour le prochain événement!',
              color: 'ECONOMY',
              timestamp: true
            });
            
            await fetchedMessage.edit({
              embeds: [endEmbed],
              components: []
            });
          } catch (error) {
            console.error('Error ending credits rain event:', error);
          }
        }, 120000); // 2 minutes
        
        return;
      }
      
      if (eventType === 'treasure_hunt') {
        // Implement treasure hunt event here directly
        await interaction.editReply({
          embeds: [
            EmbedCreator.success(
              'Événement déclenché',
              `Une chasse au trésor a été déclenchée dans <#${targetChannel.id}>.`
            )
          ]
        });
        
        // Define clues and answers
        const treasureHunt = {
          clues: [
            {
              question: "Je suis rond, mais je ne suis pas une roue. Je brille, mais je ne suis pas une lampe. Je suis un astre, mais je ne suis pas une étoile. Qui suis-je?",
              answer: "lune"
            },
            {
              question: "On me dépose quand on me confie quelque chose, et on me retire quand on me le reprend. Qui suis-je?",
              answer: "confiance"
            },
            {
              question: "Plus on en prend, plus on en laisse. Qui suis-je?",
              answer: "pas"
            }
          ],
          reward: Math.floor(Math.random() * 300) + 200 // 200-500 credits
        };
        
        // Select a random clue
        const selectedClue = treasureHunt.clues[Math.floor(Math.random() * treasureHunt.clues.length)];
        
        // Send the treasure hunt message
        const embed = EmbedCreator.create({
          title: '🗺️ Chasse au trésor!',
          description: `Un trésor a été caché! Résolvez l'énigme pour le trouver:\n\n**${selectedClue.question}**\n\nÉcrivez simplement votre réponse dans ce canal. Le premier à trouver gagne **${treasureHunt.reward}** crédits!`,
          color: '#8B4513', // Brown color for treasure
          timestamp: true
        });
        
        const huntMessage = await targetChannel.send({
          embeds: [embed]
        });
        
        // Create a message collector
        const filter = m => !m.author.bot;
        const collector = targetChannel.createMessageCollector({ filter, time: 300000 }); // 5 minutes
        
        // Store the correct answer in lowercase for easier comparison
        const correctAnswer = selectedClue.answer.toLowerCase();
        let solved = false;
        
        // Listen for answers
        collector.on('collect', async message => {
          // If already solved, ignore
          if (solved) return;
          
          // Check if the answer is correct (case insensitive and trim whitespace)
          const userAnswer = message.content.toLowerCase().trim();
          
          if (userAnswer === correctAnswer) {
            solved = true;
            collector.stop();
            
            // Award the user
            await client.db.updateUserBalance(message.author.id, treasureHunt.reward);
            
            // Add experience points (10-20 XP)
            const xpAmount = Math.floor(Math.random() * 11) + 10;
            const xpResult = await client.db.addExperience(message.author.id, xpAmount);
            
            // Create success embed
            const successEmbed = EmbedCreator.success(
              '🎉 Trésor trouvé!',
              `<@${message.author.id}> a résolu l'énigme et trouvé le trésor!\nRéponse: **${correctAnswer}**\nRécompense: **${treasureHunt.reward}** crédits`,
              {
                fields: [
                  {
                    name: '⭐ XP gagnée',
                    value: `+${xpAmount} XP`,
                    inline: true
                  }
                ]
              }
            );
            
            // Add level up notification if applicable
            if (xpResult.leveledUp) {
              successEmbed.addFields({
                name: '🎉 Niveau supérieur!',
                value: `<@${message.author.id}> est passé au niveau **${xpResult.newLevel}**!`,
                inline: false
              });
            }
            
            await huntMessage.edit({
              embeds: [successEmbed]
            });
          }
        });
        
        // When collector ends
        collector.on('end', async collected => {
          if (!solved) {
            // No one solved it
            const timeoutEmbed = EmbedCreator.error(
              '⏱️ Temps écoulé!',
              `Personne n'a résolu l'énigme!\nLa réponse était: **${correctAnswer}**`,
              {
                timestamp: true
              }
            );
            
            await huntMessage.edit({
              embeds: [timeoutEmbed]
            });
          }
        });
        
        return;
      }
      
      // Standard events from randomEvents.js
      await interaction.editReply({
        embeds: [
          EmbedCreator.success(
            'Événement déclenché',
            `Un événement "${eventToTrigger.name}" a été déclenché dans <#${targetChannel.id}>.`
          )
        ]
      });
      
      // Trigger the event
      await eventToTrigger.trigger(client, targetChannel);
      
    } catch (error) {
      console.error('Error in event-trigger command:', error);
      
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
  }
};