import { REST, Routes } from 'discord.js';
import logger from './logs/logger.js';

/**
 * Synchronize command definitions with Discord API
 * @param {Object} client - Discord client
 * @param {Object|boolean} options - Options object or boolean for backward compatibility
 * @param {boolean} options.global - Whether to sync commands globally
 * @param {string} options.guildId - Guild ID to sync commands to (if not global)
 * @returns {Promise<void>}
 */
export async function syncCommands(client, options = { global: true, guildId: null }) {
  const commands = [];
  
  // Convert commands to API format
  for (const command of client.commands.values()) {
    commands.push(command.data.toJSON());
  }
  
  // Create REST instance
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);
    
    // Handle legacy boolean parameter (backward compatibility)
    let isGlobal = true;
    let guildId = process.env.GUILD_ID;
    
    if (typeof options === 'boolean') {
      // Old style: devMode boolean parameter
      isGlobal = !options;
    } else if (typeof options === 'object') {
      // New style: options object
      isGlobal = options.global !== false;
      guildId = options.guildId || process.env.GUILD_ID;
    }
    
    // Register commands
    let data;
    
    if (!isGlobal && guildId) {
      // Register commands to a specific guild (faster during development)
      logger.info(`Registering commands to guild ${guildId} (dev mode)`);
      
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
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