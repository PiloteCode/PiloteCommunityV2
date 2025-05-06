import { REST, Routes } from 'discord.js';
import logger from './logs/logger.js';

/**
 * Synchronize command definitions with Discord API
 * @param {Object} client - Discord client
 * @param {boolean} devMode - Whether to sync commands to a specific guild only
 * @returns {Promise<void>}
 */
export async function syncCommands(client, devMode = false) {
  const commands = [];
  
  // Convert commands to API format
  for (const command of client.commands.values()) {
    commands.push(command.data.toJSON());
  }
  
  // Create REST instance
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);
    
    // Register commands
    let data;
    
    if (devMode && process.env.GUILD_ID) {
      // Register commands to a specific guild (faster during development)
      logger.info(`Registering commands to guild ${process.env.GUILD_ID} (dev mode)`);
      
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      
      logger.info(`Successfully registered ${data.length} guild commands.`);
    } else {
      // Register commands globally (can take up to an hour to propagate)
      logger.info('Registering commands globally');
      
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      
      logger.info(`Successfully registered ${data.length} global commands.`);
    }
    
    return data;
  } catch (error) {
    logger.error(`Error refreshing commands: ${error.message}`);
    throw error;
  }
}