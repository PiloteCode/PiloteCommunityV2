import { Events } from 'discord.js';
import { SYSTEM_MESSAGES, COOLDOWNS } from '../config/constants.js';

const cooldowns = new Map();

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // Gestion des commandes slash
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        // Vérification du cooldown
        if (!cooldowns.has(command.data.name)) {
          cooldowns.set(command.data.name, new Map());
        }

        const timestamps = cooldowns.get(command.data.name);
        const cooldownAmount = command.cooldown ?? COOLDOWNS.DEFAULT_COMMAND;
        const now = Date.now();

        if (timestamps.has(interaction.user.id)) {
          const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

          if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({
              content: `⏰ Attendez ${timeLeft.toFixed(1)} secondes avant de réutiliser \`${command.data.name}\``,
              ephemeral: true
            });
          }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        // Exécution de la commande
        await command.execute(interaction);
      }
      // Gestion des boutons
      else if (interaction.isButton()) {
        // Gestion des boutons de pagination
        if (['first_page', 'previous_page', 'next_page', 'last_page'].includes(interaction.customId)) {
          // La pagination est gérée par PaginationManager
          return;
        }

        // Autres boutons
        const [action, ...args] = interaction.customId.split('_');
        
        switch (action) {
          case 'buy':
            await handleBuyButton(interaction, args);
            break;
          case 'confirm':
            await handleConfirmButton(interaction, args);
            break;
          case 'cancel':
            await handleCancelButton(interaction, args);
            break;
          default:
            console.warn(`Button non géré: ${interaction.customId}`);
        }
      }
      // Gestion des menus de sélection
      else if (interaction.isStringSelectMenu()) {
        const [action, ...args] = interaction.customId.split('_');
        
        switch (action) {
          case 'filter':
            await handleFilterSelection(interaction, args);
            break;
          default:
            console.warn(`Menu non géré: ${interaction.customId}`);
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement de l\'interaction:', error);
      
      const errorResponse = {
        content: SYSTEM_MESSAGES.ERRORS.GENERIC,
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    }
  }
};