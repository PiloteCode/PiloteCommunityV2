import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('Gère vos rappels')
    .addSubcommand(subcommand =>
      subcommand
        .setName('liste')
        .setDescription('Affiche la liste de vos rappels actifs')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('supprimer')
        .setDescription('Supprime un rappel existant')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID du rappel à supprimer')
            .setRequired(true)
        )
    ),
  
  cooldown: 5000, // 5 seconds
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const subcommand = interaction.options.getSubcommand();
      
      // Create reminders table if it doesn't exist
      await client.db.db.exec(`
        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          channel_id TEXT,
          guild_id TEXT,
          message TEXT NOT NULL,
          remind_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          is_private BOOLEAN NOT NULL DEFAULT 0
        )
      `);
      
      // List reminders
      if (subcommand === 'liste') {
        const reminders = await client.db.db.all(`
          SELECT * FROM reminders
          WHERE user_id = ?
          ORDER BY remind_at ASC
        `, interaction.user.id);
        
        if (reminders.length === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                'Aucun rappel',
                'Vous n\'avez aucun rappel actif. Utilisez la commande `/remind` pour en créer un.'
              )
            ]
          });
        }
        
        // Format reminders for display
        const reminderList = reminders.map(reminder => {
          const reminderDate = new Date(reminder.remind_at);
          const timestamp = Math.floor(reminderDate.getTime() / 1000);
          
          return `**ID ${reminder.id}**: ${reminder.message.substring(0, 50)}${reminder.message.length > 50 ? '...' : ''}\n⏰ <t:${timestamp}:R> (<t:${timestamp}:F>)\n📨 ${reminder.is_private ? 'Message privé' : 'Dans un salon'}\n`;
        }).join('\n');
        
        // Create embed
        const embed = EmbedCreator.create({
          title: '⏰ Vos rappels',
          description: `Vous avez **${reminders.length}** rappel${reminders.length > 1 ? 's' : ''} actif${reminders.length > 1 ? 's' : ''}:\n\n${reminderList}`,
          color: 'PRIMARY',
          footer: {
            text: 'Utilisez /reminders supprimer [id] pour supprimer un rappel',
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          },
          timestamp: true
        });
        
        await interaction.editReply({ embeds: [embed] });
      }
      
      // Delete a reminder
      else if (subcommand === 'supprimer') {
        const reminderId = interaction.options.getInteger('id');
        
        // Check if reminder exists and belongs to user
        const reminder = await client.db.db.get(`
          SELECT * FROM reminders
          WHERE id = ? AND user_id = ?
        `, reminderId, interaction.user.id);
        
        if (!reminder) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Rappel introuvable',
                `Aucun rappel avec l'ID ${reminderId} n'a été trouvé, ou il ne vous appartient pas.`
              )
            ]
          });
        }
        
        // Delete the reminder
        await client.db.db.run('DELETE FROM reminders WHERE id = ?', reminderId);
        
        // Format reminder details
        const reminderDate = new Date(reminder.remind_at);
        const timestamp = Math.floor(reminderDate.getTime() / 1000);
        
        // Confirm deletion
        const embed = EmbedCreator.success(
          '⏰ Rappel supprimé',
          `Le rappel suivant a été supprimé avec succès:`,
          {
            fields: [
              {
                name: '📝 Rappel',
                value: reminder.message,
                inline: false
              },
              {
                name: '🕒 Date et heure',
                value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`,
                inline: true
              }
            ]
          }
        );
        
        await interaction.editReply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Error in reminders command:', error);
      
      await interaction.editReply({
        embeds: [
          EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la gestion des rappels.')
        ]
      });
    }
  }
};