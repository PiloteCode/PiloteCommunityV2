import logger from '../utils/logs/logger.js';
import { businessButtonHandler } from '../components/businessButton.js';
import { businessModalHandler } from '../components/businessModal.js';
import { marketButtonHandler } from '../components/marketButton.js';
import { marketModalHandler } from '../components/marketModal.js';
import { researchButtonHandler } from '../components/researchButton.js';
import { researchModalHandler } from '../components/researchModal.js';
import { economicButtonHandler } from '../components/economicButton.js';
import { economicModalHandler } from '../components/economicModal.js';

export default {
  name: 'interactionCreate',
  once: false,
  execute: async (client, interaction) => {
    try {
      // Handle commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
          return interaction.reply({
            content: `Commande \`${interaction.commandName}\` introuvable.`,
            ephemeral: true
          });
        }
        
        // Check for cooldowns
        const { cooldowns } = client;
        
        if (!cooldowns.has(command.data.name)) {
          cooldowns.set(command.data.name, new Map());
        }
        
        const now = Date.now();
        const timestamps = cooldowns.get(command.data.name);
        const cooldownAmount = (command.cooldown || 3) * 1000;
        
        if (timestamps.has(interaction.user.id)) {
          const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
          
          if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({
              content: `Veuillez attendre ${timeLeft.toFixed(1)} secondes avant de réutiliser la commande \`${command.data.name}\`.`,
              ephemeral: true
            });
          }
        }
        
        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
        
        // Execute command
        try {
          logger.info(`${interaction.user.tag} (${interaction.user.id}) used command ${interaction.commandName}`);
          await command.execute(interaction);
        } catch (error) {
          logger.error(`Error executing command ${interaction.commandName}: ${error}`);
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
              ephemeral: true
            });
          }
        }
      }
      
      // Handle component interactions - Buttons, Select Menus, Modals
      else if (interaction.isButton() || 
               interaction.isStringSelectMenu() || 
               interaction.isModalSubmit()) {
        
        // Check if it's a business interaction
        if (interaction.customId.startsWith('business_')) {
          if (interaction.isModalSubmit()) {
            await businessModalHandler(interaction);
          } else {
            await businessButtonHandler(interaction);
          }
        }
        
        // Check if it's a market interaction
        else if (interaction.customId.startsWith('market_')) {
          if (interaction.isModalSubmit()) {
            await marketModalHandler(interaction);
          } else {
            await marketButtonHandler(interaction);
          }
        }
        
        // Check if it's a research interaction
        else if (interaction.customId.startsWith('research_')) {
          if (interaction.isModalSubmit()) {
            await researchModalHandler(interaction);
          } else {
            await researchButtonHandler(interaction);
          }
        }
        
        // Check if it's an economic system interaction
        else if (interaction.customId.startsWith('economic_')) {
          if (interaction.isModalSubmit()) {
            await economicModalHandler(interaction);
          } else {
            await economicButtonHandler(interaction);
          }
        }
        
        // Send to the component handler if it's registered
        else {
          let component;
          
          if (interaction.isButton()) {
            component = client.buttons.get(interaction.customId);
          } else if (interaction.isStringSelectMenu()) {
            component = client.selectMenus.get(interaction.customId);
          } else if (interaction.isModalSubmit()) {
            component = client.modals.get(interaction.customId);
          }
          
          if (!component) return;
          
          try {
            await component.execute(interaction);
          } catch (error) {
            logger.error(`Error handling component interaction: ${error}`);
            
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({
                content: 'Une erreur est survenue lors du traitement de cette interaction.',
                ephemeral: true
              });
            } else {
              await interaction.reply({
                content: 'Une erreur est survenue lors du traitement de cette interaction.',
                ephemeral: true
              });
            }
          }
        }
      }
      
    } catch (error) {
      logger.error(`Error handling interaction: ${error}`);
    }
  }
};