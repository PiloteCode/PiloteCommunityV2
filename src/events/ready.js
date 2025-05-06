import { ActivityType } from 'discord.js';
import logger from '../utils/logs/logger.js';
import { displayReadyMessage } from '../utils/startupScreen.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Bot connected as ${client.user.tag}`);
    
    // Display ready message with stats
    displayReadyMessage(client);
    
    // Clear expired cooldowns
    try {
      await client.db.clearExpiredCooldowns();
      logger.info('Cleared expired cooldowns');
      
      // Set up interval to clear cooldowns regularly
      setInterval(async () => {
        await client.db.clearExpiredCooldowns();
        logger.debug('Cleared expired cooldowns (scheduled task)');
      }, 1000 * 60 * 15); // Every 15 minutes
    } catch (error) {
      logger.error(`Failed to clear cooldowns: ${error.message}`);
    }
    
    // Check for active events that need to be resumed after restart
    try {
      const activeEvents = await client.db.getActiveEvents();
      logger.info(`Found ${activeEvents.length} active events to resume`);
      
      // We could resume events here if needed
      // For now, we'll just acknowledge them in the log
      if (activeEvents.length > 0) {
        activeEvents.forEach(event => {
          logger.debug(`Active event: ${event.id} (${event.event_type}) in channel ${event.channel_id}`);
        });
      }
    } catch (error) {
      logger.error(`Failed to load active events: ${error.message}`);
    }
  }
};