import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Vous marque comme absent (AFK)')
    .addStringOption(option =>
      option
        .setName('raison')
        .setDescription('Raison de votre absence')
        .setRequired(false)
    ),
  
  cooldown: 5000, // 5 seconds
  
  async execute(interaction, client) {
    try {
      // Get reason (or default)
      const reason = interaction.options.getString('raison') || 'Absent(e)';
      
      // Create AFK table if it doesn't exist
      await client.db.db.exec(`
        CREATE TABLE IF NOT EXISTS afk (
          user_id TEXT PRIMARY KEY,
          guild_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);
      
      // Check if user is already AFK
      const existingAfk = await client.db.db.get(`
        SELECT * FROM afk
        WHERE user_id = ? AND guild_id = ?
      `, interaction.user.id, interaction.guild.id);
      
      if (existingAfk) {
        // User is already AFK, remove AFK status
        await client.db.db.run(`
          DELETE FROM afk
          WHERE user_id = ? AND guild_id = ?
        `, interaction.user.id, interaction.guild.id);
        
        // Try to remove AFK prefix from nickname if it exists
        try {
          if (interaction.member.displayName.startsWith('[AFK] ')) {
            // Vérifier si le bot a la permission de changer le pseudo
            const botMember = interaction.guild.members.cache.get(client.user.id);
            const canChangeName = interaction.member.manageable && 
                                 botMember.permissions.has('ManageNicknames');
            
            if (canChangeName) {
              await interaction.member.setNickname(
                interaction.member.displayName.replace('[AFK] ', '')
              );
            } else {
              // Si le bot n'a pas la permission, on ne fait rien mais on continue sans erreur
              console.log(`Cannot change nickname for ${interaction.user.tag} - insufficient permissions`);
            }
          }
        } catch (nickError) {
          // Erreur silencieuse, on continue sans le changement de pseudo
          console.warn('Could not update nickname:', nickError.message);
        }
        
        // Confirm AFK status removed
        const embed = EmbedCreator.success(
          '🔙 De retour',
          `Vous n'êtes plus marqué(e) comme absent(e).`
        );
        
        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      } else {
        // Set AFK status
        await client.db.db.run(`
          INSERT INTO afk (user_id, guild_id, reason, timestamp)
          VALUES (?, ?, ?, ?)
        `, interaction.user.id, interaction.guild.id, reason, Date.now());
        
        // Try to update nickname with AFK prefix
        try {
          if (!interaction.member.displayName.startsWith('[AFK] ')) {
            // Vérifier si le bot a la permission de changer le pseudo
            const botMember = interaction.guild.members.cache.get(client.user.id);
            const canChangeName = interaction.member.manageable && 
                                 botMember.permissions.has('ManageNicknames');
            
            if (canChangeName) {
              await interaction.member.setNickname(
                `[AFK] ${interaction.member.displayName.substring(0, 25)}`
              );
            } else {
              // Si le bot n'a pas la permission, on ne fait rien mais on continue sans erreur
              console.log(`Cannot change nickname for ${interaction.user.tag} - insufficient permissions`);
            }
          }
        } catch (nickError) {
          // Erreur silencieuse, on continue sans le changement de pseudo
          console.warn('Could not update nickname:', nickError.message);
        }
        
        // Confirm AFK status
        const embed = EmbedCreator.success(
          '👋 Marqué(e) comme absent(e)',
          `Vous êtes maintenant marqué(e) comme absent(e). Les membres qui vous mentionnent seront informés.`,
          {
            fields: [
              {
                name: '📝 Raison',
                value: reason,
                inline: true
              }
            ]
          }
        );
        
        await interaction.reply({
          embeds: [embed]
        });
      }
      
      // Initialize or update client.afkUsers for message event handling
      if (!client.afkUsers) {
        client.afkUsers = new Map();
      }
      
      // Remove user from afkUsers if they're no longer AFK, or add them if they are
      if (existingAfk) {
        client.afkUsers.delete(`${interaction.user.id}-${interaction.guild.id}`);
      } else {
        client.afkUsers.set(`${interaction.user.id}-${interaction.guild.id}`, {
          reason,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error('Error in afk command:', error);
      
      await interaction.reply({
        embeds: [
          EmbedCreator.error('Erreur', 'Une erreur est survenue lors du traitement de votre statut AFK.')
        ],
        ephemeral: true
      });
    }
  }
};