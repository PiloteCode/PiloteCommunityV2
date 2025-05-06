export default {
  name: 'interactionCreate',
  once: false,
  async execute(client, interaction) {
    // Handle command interactions
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        // Check for cooldowns
        if (command.cooldown) {
          const userId = interaction.user.id;
          const cooldownKey = `${interaction.commandName}-${userId}`;
          
          // Get cooldown from database
          const cooldownExpires = await client.db.getCooldown(userId, interaction.commandName);
          
          if (cooldownExpires) {
            const expireDate = new Date(cooldownExpires);
            const timeLeft = expireDate - Date.now();
            
            if (timeLeft > 0) {
              // Format the time left nicely
              const seconds = Math.ceil(timeLeft / 1000);
              const minutes = Math.floor(seconds / 60);
              const hours = Math.floor(minutes / 60);
              
              let timeString;
              if (hours > 0) {
                timeString = `${hours}h ${minutes % 60}m`;
              } else if (minutes > 0) {
                timeString = `${minutes}m ${seconds % 60}s`;
              } else {
                timeString = `${seconds}s`;
              }
              
              return interaction.reply({
                content: `⏱️ Cette commande est en cooldown. Réessayez dans ${timeString}.`,
                ephemeral: true
              });
            }
          }
          
          // Set cooldown for this command
          if (command.cooldown > 0) {
            await client.db.setCooldown(userId, interaction.commandName, command.cooldown);
          }
        }
        
        // Execute the command
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        
        // Reply with error message
        const errorMessage = {
          content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.',
          ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
    
    // Handle button interactions
    else if (interaction.isButton()) {
      // Extract base button ID (format: "buttonId:userId:data")
      const [baseId, userId, ...extraData] = interaction.customId.split(':');
      
      // Check if user is allowed to use this button
      if (userId && userId !== interaction.user.id) {
        return interaction.reply({
          content: '❌ Ce bouton ne vous est pas destiné.',
          ephemeral: true
        });
      }
      
      // Handle button using the button handler
      const button = client.buttons.get(baseId);
      
      if (!button) {
        console.warn(`No button handler found for ${baseId}`);
        return;
      }
      
      try {
        // Execute the button handler
        await button.execute(interaction, client, extraData);
      } catch (error) {
        console.error(`Error executing button ${baseId}:`, error);
        
        const errorMessage = {
          content: '❌ Une erreur est survenue lors de l\'interaction avec ce bouton.',
          ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
    
    // Handle select menu interactions
    else if (interaction.isStringSelectMenu()) {
      // Extract base select menu ID
      const [baseId, userId, ...extraData] = interaction.customId.split(':');
      
      // Check if user is allowed to use this select menu
      if (userId && userId !== interaction.user.id) {
        return interaction.reply({
          content: '❌ Ce menu ne vous est pas destiné.',
          ephemeral: true
        });
      }
      
      // Handle select menu
      const selectMenu = client.selectMenus?.get(baseId);
      
      if (!selectMenu) {
        console.warn(`No select menu handler found for ${baseId}`);
        return;
      }
      
      try {
        // Execute the select menu handler
        await selectMenu.execute(interaction, client, extraData);
      } catch (error) {
        console.error(`Error executing select menu ${baseId}:`, error);
        
        const errorMessage = {
          content: '❌ Une erreur est survenue lors de l\'interaction avec ce menu.',
          ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
  }
};