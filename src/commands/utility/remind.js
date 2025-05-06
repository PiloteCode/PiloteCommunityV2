import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Crée un rappel après un délai spécifié')
    .addStringOption(option =>
      option
        .setName('rappel')
        .setDescription('Le texte du rappel')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('minutes')
        .setDescription('Nombre de minutes avant le rappel')
        .setRequired(false)
        .setMinValue(0)
    )
    .addIntegerOption(option =>
      option
        .setName('heures')
        .setDescription('Nombre d\'heures avant le rappel')
        .setRequired(false)
        .setMinValue(0)
    )
    .addIntegerOption(option =>
      option
        .setName('jours')
        .setDescription('Nombre de jours avant le rappel')
        .setRequired(false)
        .setMinValue(0)
    )
    .addBooleanOption(option =>
      option
        .setName('privé')
        .setDescription('Envoyer le rappel en message privé (par défaut: false)')
        .setRequired(false)
    ),
  
  cooldown: 5000, // 5 seconds
  
  async execute(interaction, client) {
    try {
      // Get options
      const reminder = interaction.options.getString('rappel');
      const minutes = interaction.options.getInteger('minutes') || 0;
      const hours = interaction.options.getInteger('heures') || 0;
      const days = interaction.options.getInteger('jours') || 0;
      const isPrivate = interaction.options.getBoolean('privé') || false;
      
      // Calculate total time in milliseconds
      const totalMilliseconds = (minutes * 60 + hours * 60 * 60 + days * 24 * 60 * 60) * 1000;
      
      // Check if time is provided
      if (totalMilliseconds === 0) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Temps non spécifié',
              'Vous devez spécifier un délai (minutes, heures et/ou jours) pour le rappel.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Check if total time is too long (maximum 30 days)
      const maxReminderTime = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      if (totalMilliseconds > maxReminderTime) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Délai trop long',
              'Le délai maximum pour un rappel est de 30 jours.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Calculate when the reminder will trigger
      const reminderTime = new Date(Date.now() + totalMilliseconds);
      const reminderTimestamp = Math.floor(reminderTime.getTime() / 1000);
      
      // Format time for display
      let timeString = '';
      if (days > 0) {
        timeString += `${days} jour${days > 1 ? 's' : ''} `;
      }
      if (hours > 0) {
        timeString += `${hours} heure${hours > 1 ? 's' : ''} `;
      }
      if (minutes > 0) {
        timeString += `${minutes} minute${minutes > 1 ? 's' : ''} `;
      }
      
      // Create reminder in database
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
      
      const result = await client.db.db.run(`
        INSERT INTO reminders (user_id, channel_id, guild_id, message, remind_at, is_private)
        VALUES (?, ?, ?, ?, datetime('now', '+${minutes} minutes', '+${hours} hours', '+${days} days'), ?)
      `, interaction.user.id, isPrivate ? null : interaction.channelId, 
         interaction.guildId, reminder, isPrivate ? 1 : 0);
      
      const reminderId = result.lastID;
      
      // Confirm reminder creation
      const confirmEmbed = EmbedCreator.success(
        '⏰ Rappel créé',
        `Je vous rappellerai dans **${timeString.trim()}** (<t:${reminderTimestamp}:R>).`,
        {
          fields: [
            {
              name: '📝 Rappel',
              value: reminder,
              inline: false
            },
            {
              name: '🕒 Date et heure',
              value: `<t:${reminderTimestamp}:F>`,
              inline: true
            },
            {
              name: '📨 Méthode',
              value: isPrivate ? 'Message privé' : 'Dans ce salon',
              inline: true
            }
          ],
          footer: {
            text: `ID du rappel: ${reminderId}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          }
        }
      );
      
      await interaction.reply({
        embeds: [confirmEmbed],
        ephemeral: isPrivate
      });
      
      // Set up the timeout for the reminder
      setTimeout(async () => {
        try {
          // Check if reminder still exists in database
          const reminder = await client.db.db.get('SELECT * FROM reminders WHERE id = ?', reminderId);
          
          if (!reminder) {
            // Reminder was deleted
            return;
          }
          
          // Delete the reminder from database
          await client.db.db.run('DELETE FROM reminders WHERE id = ?', reminderId);
          
          // Create the reminder embed
          const reminderEmbed = EmbedCreator.create({
            title: '⏰ Rappel',
            description: reminder.message,
            color: 'PRIMARY',
            footer: {
              text: `Rappel créé ${new Date(reminder.created_at).toLocaleString()}`,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            },
            timestamp: true
          });
          
          // Send the reminder
          if (reminder.is_private) {
            // Send in DM
            try {
              const user = await client.users.fetch(reminder.user_id);
              await user.send({
                content: `<@${reminder.user_id}>`,
                embeds: [reminderEmbed]
              });
            } catch (err) {
              console.error('Failed to send reminder DM:', err);
            }
          } else {
            // Send in channel
            try {
              const channel = await client.channels.fetch(reminder.channel_id);
              await channel.send({
                content: `<@${reminder.user_id}>`,
                embeds: [reminderEmbed]
              });
            } catch (err) {
              console.error('Failed to send reminder to channel:', err);
              
              // Try to send in DM as fallback
              try {
                const user = await client.users.fetch(reminder.user_id);
                await user.send({
                  content: 'Je n\'ai pas pu envoyer ce rappel dans le salon d\'origine, alors je vous l\'envoie en message privé:',
                  embeds: [reminderEmbed]
                });
              } catch (dmErr) {
                console.error('Failed to send fallback reminder DM:', dmErr);
              }
            }
          }
        } catch (error) {
          console.error('Error sending reminder:', error);
        }
      }, totalMilliseconds);
      
    } catch (error) {
      console.error('Error in remind command:', error);
      
      await interaction.reply({
        embeds: [
          EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la création du rappel.')
        ],
        ephemeral: true
      });
    }
  }
};