import { Events } from 'discord.js';
import { randomEvents } from '../utils/randomEvents.js';

// Keep track of messages per channel
const messageCounters = new Map();

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(client, message) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Ignore DM messages
    if (!message.guild) return;
    
    // Increment message counter for this channel
    const channelId = message.channelId;
    if (!messageCounters.has(channelId)) {
      messageCounters.set(channelId, 0);
    }
    
    const currentCount = messageCounters.get(channelId) + 1;
    messageCounters.set(channelId, currentCount);
    
    // Get min messages between events
    const minMessagesBetweenEvents = parseInt(process.env.MIN_MESSAGES_BETWEEN_EVENTS) || 20;
    
    // Only trigger events if we have enough messages
    if (currentCount >= minMessagesBetweenEvents) {
      // Calculate probability of event
      const eventProbability = parseFloat(process.env.EVENT_PROBABILITY) || 0.05; // 5% by default
      const roll = Math.random();
      
      if (roll <= eventProbability) {
        // Reset counter
        messageCounters.set(channelId, 0);
        
        // Trigger random event
        const possibleEvents = Object.values(randomEvents);
        const randomEvent = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
        
        try {
          await randomEvent.trigger(client, message.channel);
        } catch (error) {
          console.error('Error triggering random event:', error);
        }
      }
    }
    
    // Award XP for chatting
    try {
      // Add a small amount of XP per message (between 1-3)
      const xpAmount = Math.floor(Math.random() * 3) + 1;
      
      // Add experience to user
      const result = await client.db.addExperience(message.author.id, xpAmount);
      
      // If user leveled up, send a congratulatory message
      if (result.leveledUp) {
        await message.channel.send(
          `🎉 Félicitations <@${message.author.id}> ! Vous avez atteint le niveau **${result.newLevel}** !`
        );
      }
    } catch (error) {
      console.error('Error awarding XP for message:', error);
    }
  }
};