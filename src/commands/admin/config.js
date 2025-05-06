import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure les paramètres du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('event_probability')
        .setDescription('Définit la probabilité d\'apparition des événements aléatoires')
        .addNumberOption(option =>
          option
            .setName('valeur')
            .setDescription('Probabilité (entre 0.01 et 0.5)')
            .setRequired(true)
            .setMinValue(0.01)
            .setMaxValue(0.5)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('min_messages')
        .setDescription('Définit le nombre minimum de messages avant le déclenchement d\'un événement')
        .addIntegerOption(option =>
          option
            .setName('valeur')
            .setDescription('Nombre de messages (entre 5 et 100)')
            .setRequired(true)
            .setMinValue(5)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reward_multiplier')
        .setDescription('Définit le multiplicateur de récompenses globales')
        .addNumberOption(option =>
          option
            .setName('valeur')
            .setDescription('Multiplicateur (entre 0.5 et 5)')
            .setRequired(true)
            .setMinValue(0.5)
            .setMaxValue(5)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset_user')
        .setDescription('Réinitialise les données d\'un utilisateur')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('Utilisateur à réinitialiser')
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option
            .setName('confirmation')
            .setDescription('Confirmer la réinitialisation (TRUE pour confirmer)')
            .setRequired(true)
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
      
      await interaction.deferReply({ ephemeral: true });
      
      const subcommand = interaction.options.getSubcommand();
      
      // Handle event_probability subcommand
      if (subcommand === 'event_probability') {
        const value = interaction.options.getNumber('valeur');
        
        // Store in .env or database settings table
        // For this example, we'll create a settings table if it doesn't exist
        await client.db.db.exec(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `);
        
        await client.db.db.run(`
          INSERT INTO settings (key, value)
          VALUES ('EVENT_PROBABILITY', ?)
          ON CONFLICT(key) DO UPDATE SET
          value = excluded.value
        `, value.toString());
        
        // Update in-memory value
        process.env.EVENT_PROBABILITY = value.toString();
        
        await interaction.editReply({
          embeds: [
            EmbedCreator.success(
              'Configuration mise à jour',
              `La probabilité d'événements aléatoires a été définie à **${value}** (${value * 100}%).`
            )
          ]
        });
      }
      
      // Handle min_messages subcommand
      else if (subcommand === 'min_messages') {
        const value = interaction.options.getInteger('valeur');
        
        await client.db.db.run(`
          INSERT INTO settings (key, value)
          VALUES ('MIN_MESSAGES_BETWEEN_EVENTS', ?)
          ON CONFLICT(key) DO UPDATE SET
          value = excluded.value
        `, value.toString());
        
        // Update in-memory value
        process.env.MIN_MESSAGES_BETWEEN_EVENTS = value.toString();
        
        await interaction.editReply({
          embeds: [
            EmbedCreator.success(
              'Configuration mise à jour',
              `Le nombre minimum de messages entre les événements a été défini à **${value}**.`
            )
          ]
        });
      }
      
      // Handle reward_multiplier subcommand
      else if (subcommand === 'reward_multiplier') {
        const value = interaction.options.getNumber('valeur');
        
        await client.db.db.run(`
          INSERT INTO settings (key, value)
          VALUES ('REWARD_MULTIPLIER', ?)
          ON CONFLICT(key) DO UPDATE SET
          value = excluded.value
        `, value.toString());
        
        // Update in-memory value
        process.env.REWARD_MULTIPLIER = value.toString();
        
        await interaction.editReply({
          embeds: [
            EmbedCreator.success(
              'Configuration mise à jour',
              `Le multiplicateur de récompenses a été défini à **${value}x**.`
            )
          ]
        });
      }
      
      // Handle reset_user subcommand
      else if (subcommand === 'reset_user') {
        const targetUser = interaction.options.getUser('utilisateur');
        const confirmation = interaction.options.getBoolean('confirmation');
        
        if (!confirmation) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                'Réinitialisation annulée',
                'Vous devez confirmer avec `TRUE` pour réinitialiser les données d\'un utilisateur.'
              )
            ]
          });
        }
        
        await client.db.db.run('BEGIN TRANSACTION');
        
        try {
          // Delete user from all tables
          await client.db.db.run('DELETE FROM users WHERE user_id = ?', targetUser.id);
          await client.db.db.run('DELETE FROM inventory WHERE user_id = ?', targetUser.id);
          await client.db.db.run('DELETE FROM cooldowns WHERE user_id = ?', targetUser.id);
          await client.db.db.run('DELETE FROM transactions WHERE user_id = ?', targetUser.id);
          
          // Recreate user with default values (will be done automatically when user interacts again)
          
          await client.db.db.run('COMMIT');
          
          await interaction.editReply({
            embeds: [
              EmbedCreator.success(
                'Utilisateur réinitialisé',
                `Les données de **${targetUser.username}** (${targetUser.id}) ont été réinitialisées.`
              )
            ]
          });
        } catch (error) {
          await client.db.db.run('ROLLBACK');
          throw error;
        }
      }
      
    } catch (error) {
      console.error('Error in config command:', error);
      
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