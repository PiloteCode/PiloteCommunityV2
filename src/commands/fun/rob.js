import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Tentez de voler des crédits à un autre utilisateur')
    .addUserOption(option =>
      option
        .setName('utilisateur')
        .setDescription('Utilisateur à voler')
        .setRequired(true)
    ),
  
  // Cooldown of 2 hours
  cooldown: 2 * 60 * 60 * 1000,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const targetUser = interaction.options.getUser('utilisateur');
      const robberId = interaction.user.id;
      
      // Prevent robbing self
      if (targetUser.id === robberId) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Action impossible',
              'Vous ne pouvez pas vous voler vous-même.'
            )
          ]
        });
      }
      
      // Prevent robbing bots
      if (targetUser.bot) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Action impossible',
              'Vous ne pouvez pas voler un bot.'
            )
          ]
        });
      }
      
      // Get data for both users
      const robber = await client.db.getUser(robberId);
      const victim = await client.db.getUser(targetUser.id);
      
      // Check if the victim has any credits
      if (victim.balance < 50) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.warning(
              'Cible inappropriée',
              `<@${targetUser.id}> n'a pas assez de crédits pour que ça vaille la peine de le voler.`
            )
          ]
        });
      }
      
      // Check if the robber has enough credits to pay a fine if caught
      const minFine = 100;
      if (robber.balance < minFine) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.warning(
              'Fonds insuffisants',
              `Vous avez besoin d'au moins **${minFine}** crédits pour payer une éventuelle amende en cas d'échec.`
            )
          ]
        });
      }
      
      // Calculate success chance based on levels
      // Higher level victims are harder to rob
      let successChance = 0.5; // Base 50% chance
      
      // Adjust based on level difference
      const levelDiff = robber.level - victim.level;
      successChance += levelDiff * 0.05; // +/- 5% per level difference
      
      // Cap the success chance
      successChance = Math.max(0.1, Math.min(0.9, successChance));
      
      // Determine success or failure
      const success = Math.random() < successChance;
      
      if (success) {
        // Robbery successful
        // Calculate amount stolen (10-20% of victim's balance)
        const stolenPercentage = (Math.random() * 10) + 10;
        const stolenAmount = Math.floor((victim.balance * stolenPercentage) / 100);
        const cappedAmount = Math.min(stolenAmount, 2000); // Cap at 2000 credits
        
        // Update balances
        await client.db.db.run('BEGIN TRANSACTION');
        
        try {
          // Remove from victim
          await client.db.updateUserBalance(targetUser.id, -cappedAmount);
          
          // Add to robber
          await client.db.updateUserBalance(robberId, cappedAmount);
          
          // Add experience to robber
          const xpGained = Math.floor(Math.random() * 6) + 5; // 5-10 XP
          const xpResult = await client.db.addExperience(robberId, xpGained);
          
          await client.db.db.run('COMMIT');
          
          // Create success embed
          const embed = EmbedCreator.create({
            title: '🦹 Vol réussi!',
            description: `<@${robberId}> a réussi à voler **${cappedAmount}** crédits à <@${targetUser.id}>!`,
            color: 'SUCCESS',
            fields: [
              {
                name: 'Nouveau solde',
                value: `${robber.balance + cappedAmount} crédits`,
                inline: true
              },
              {
                name: '⭐ XP gagnée',
                value: `+${xpGained} XP`,
                inline: true
              }
            ],
            footer: {
              text: 'N\'oubliez pas: le crime ne paie pas... sauf quand il paie.'
            },
            timestamp: true
          });
          
          // Add level up notification if applicable
          if (xpResult.leveledUp) {
            embed.addFields({
              name: '🎉 Niveau supérieur!',
              value: `Vous êtes passé au niveau **${xpResult.newLevel}**!`,
              inline: false
            });
          }
          
          // Notify the victim via DM
          try {
            await targetUser.send({
              embeds: [
                EmbedCreator.error(
                  '🚨 Vous avez été volé!',
                  `<@${robberId}> vous a volé **${cappedAmount}** crédits!`,
                  {
                    fields: [
                      {
                        name: 'Nouveau solde',
                        value: `${victim.balance - cappedAmount} crédits`,
                        inline: true
                      }
                    ],
                    timestamp: true
                  }
                )
              ]
            }).catch(() => {
              // Ignore if DMs are closed
            });
          } catch (dmError) {
            // Ignore DM errors
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          await client.db.db.run('ROLLBACK');
          throw error;
        }
        
      } else {
        // Robbery failed
        // Calculate fine (20-40% of robber's balance)
        const finePercentage = (Math.random() * 20) + 20;
        const fineAmount = Math.floor((robber.balance * finePercentage) / 100);
        const cappedFine = Math.max(minFine, Math.min(fineAmount, 1000)); // Min 100, max 1000
        
        // Update balances
        await client.db.db.run('BEGIN TRANSACTION');
        
        try {
          // Remove from robber (fine)
          await client.db.updateUserBalance(robberId, -cappedFine);
          
          // Add half to victim as compensation
          const compensation = Math.floor(cappedFine / 2);
          await client.db.updateUserBalance(targetUser.id, compensation);
          
          await client.db.db.run('COMMIT');
          
          // Create failure embed
          const embed = EmbedCreator.error(
            '🚓 Vol échoué!',
            `<@${robberId}> a été pris en flagrant délit en essayant de voler <@${targetUser.id}>!`,
            {
              fields: [
                {
                  name: 'Amende payée',
                  value: `${cappedFine} crédits`,
                  inline: true
                },
                {
                  name: 'Nouveau solde',
                  value: `${robber.balance - cappedFine} crédits`,
                  inline: true
                }
              ],
              footer: {
                text: 'Le crime ne paie pas... surtout quand on se fait prendre.'
              },
              timestamp: true
            }
          );
          
          // Notify the victim via DM
          try {
            await targetUser.send({
              embeds: [
                EmbedCreator.success(
                  '🛡️ Tentative de vol déjouée!',
                  `<@${robberId}> a essayé de vous voler mais a échoué! Vous recevez **${compensation}** crédits de compensation.`,
                  {
                    fields: [
                      {
                        name: 'Nouveau solde',
                        value: `${victim.balance + compensation} crédits`,
                        inline: true
                      }
                    ],
                    timestamp: true
                  }
                )
              ]
            }).catch(() => {
              // Ignore if DMs are closed
            });
          } catch (dmError) {
            // Ignore DM errors
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          await client.db.db.run('ROLLBACK');
          throw error;
        }
      }
      
    } catch (error) {
      console.error('Error in rob command:', error);
      
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