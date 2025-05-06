import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('give-pilocoins')
    .setDescription('Donne des PiloCoins à un ou plusieurs utilisateurs (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Donne des PiloCoins à un utilisateur spécifique')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('Utilisateur à qui donner des PiloCoins')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Montant de PiloCoins à donner')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison de l\'attribution des PiloCoins')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Donne des PiloCoins à tous les utilisateurs ayant un rôle spécifique')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Rôle ciblé')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Montant de PiloCoins à donner à chaque utilisateur')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison de l\'attribution des PiloCoins')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Donne des PiloCoins à tous les utilisateurs du serveur')
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Montant de PiloCoins à donner à chaque utilisateur')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison de l\'attribution des PiloCoins')
            .setRequired(false)
        )
    ),
  
  // No cooldown for admin commands
  cooldown: 0,
  
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
      
      await interaction.deferReply();
      
      const subcommand = interaction.options.getSubcommand();
      const amount = interaction.options.getInteger('montant');
      const reason = interaction.options.getString('raison') || 'Attribution administrative';
      
      // Handle user subcommand
      if (subcommand === 'user') {
        const targetUser = interaction.options.getUser('utilisateur');
        
        // Update user balance
        await client.db.updateUserBalance(targetUser.id, amount);
        
        // Log the transaction with reason
        await client.db.db.run(`
          INSERT INTO transactions (user_id, amount, type, description)
          VALUES (?, ?, ?, ?)
        `, targetUser.id, amount, 'admin', reason);
        
        await interaction.editReply({
          embeds: [
            EmbedCreator.success(
              'PiloCoins attribués',
              `**${amount}** PiloCoins ont été attribués à <@${targetUser.id}>.`,
              {
                fields: [
                  {
                    name: 'Raison',
                    value: reason,
                    inline: true
                  }
                ]
              }
            )
          ]
        });
      }
      
      // Handle role subcommand
      else if (subcommand === 'role') {
        const role = interaction.options.getRole('role');
        
        // Get all members with this role
        await interaction.guild.members.fetch();
        const membersWithRole = interaction.guild.members.cache.filter(member => 
          member.roles.cache.has(role.id) && !member.user.bot
        );
        
        if (membersWithRole.size === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                'Aucun membre trouvé',
                `Aucun membre avec le rôle ${role.name} n'a été trouvé.`
              )
            ]
          });
        }
        
        // Start a transaction for bulk update
        await client.db.db.run('BEGIN TRANSACTION');
        
        try {
          let successCount = 0;
          
          // Update each member's balance
          for (const [id, member] of membersWithRole) {
            try {
              await client.db.updateUserBalance(id, amount);
              
              // Log the transaction with reason
              await client.db.db.run(`
                INSERT INTO transactions (user_id, amount, type, description)
                VALUES (?, ?, ?, ?)
              `, id, amount, 'admin', `${reason} (Attribution de masse: Rôle ${role.name})`);
              
              successCount++;
            } catch (memberError) {
              console.error(`Error giving PiloCoins to user ${id}:`, memberError);
            }
          }
          
          await client.db.db.run('COMMIT');
          
          await interaction.editReply({
            embeds: [
              EmbedCreator.success(
                'PiloCoins attribués',
                `**${amount}** PiloCoins ont été attribués à **${successCount}** membres avec le rôle **${role.name}**.`,
                {
                  fields: [
                    {
                      name: 'Raison',
                      value: reason,
                      inline: true
                    }
                  ]
                }
              )
            ]
          });
        } catch (error) {
          await client.db.db.run('ROLLBACK');
          throw error;
        }
      }
      
      // Handle all subcommand
      else if (subcommand === 'all') {
        // Get all members (non-bots)
        await interaction.guild.members.fetch();
        const allMembers = interaction.guild.members.cache.filter(member => !member.user.bot);
        
        if (allMembers.size === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                'Aucun membre trouvé',
                'Aucun membre n\'a été trouvé sur le serveur.'
              )
            ]
          });
        }
        
        // Start a transaction for bulk update
        await client.db.db.run('BEGIN TRANSACTION');
        
        try {
          let successCount = 0;
          
          // Update each member's balance
          for (const [id, member] of allMembers) {
            try {
              await client.db.updateUserBalance(id, amount);
              
              // Log the transaction with reason
              await client.db.db.run(`
                INSERT INTO transactions (user_id, amount, type, description)
                VALUES (?, ?, ?, ?)
              `, id, amount, 'admin', `${reason} (Attribution de masse: Tous les membres)`);
              
              successCount++;
            } catch (memberError) {
              console.error(`Error giving PiloCoins to user ${id}:`, memberError);
            }
          }
          
          await client.db.db.run('COMMIT');
          
          await interaction.editReply({
            embeds: [
              EmbedCreator.success(
                'PiloCoins attribués',
                `**${amount}** PiloCoins ont été attribués à **${successCount}** membres du serveur.`,
                {
                  fields: [
                    {
                      name: 'Raison',
                      value: reason,
                      inline: true
                    }
                  ]
                }
              )
            ]
          });
        } catch (error) {
          await client.db.db.run('ROLLBACK');
          throw error;
        }
      }
      
    } catch (error) {
      console.error('Error in give-pilocoins command:', error);
      
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