import { Client, GatewayIntentBits, Partials, Collection, ActivityType } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { DatabaseManager } from './database/manager.js';
import logger from './utils/logs/logger.js';
import { 
  displayStartupBanner, 
  displayLoadingMessage, 
  displaySuccessMessage, 
  displayErrorMessage
} from './utils/startupScreen.js';

// Load environment variables
dotenv.config();

// Setup __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bot version information
const BOT_CONFIG = {
  version: '2.0.0',
  author: 'Pilote Production',
  website: 'https://piloteshopping.com'
};

// Display startup banner
displayStartupBanner(BOT_CONFIG);

// Create a new Discord client
displayLoadingMessage('Initializing Discord client');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
  allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
});

// Initialize collections for commands and cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();
client.buttons = new Collection();
client.selectMenus = new Collection();
client.contextMenus = new Collection();
client.modals = new Collection();
client.config = BOT_CONFIG;

// Initialize database
displayLoadingMessage('Connecting to database');
const dbManager = new DatabaseManager();
client.db = dbManager;

// Function to load events
async function loadEvents() {
  displayLoadingMessage('Loading event handlers');
  
  const eventFiles = readdirSync(join(__dirname, 'events'))
    .filter(file => file.endsWith('.js'));
  
  let loadedCount = 0;
  for (const file of eventFiles) {
    const eventPath = join(__dirname, 'events', file);
    try {
      const eventModule = await import(`file://${eventPath}`);
      const event = eventModule.default;
      
      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }
      
      loadedCount++;
      logger.debug(`Loaded event: ${event.name}`);
    } catch (error) {
      displayErrorMessage(`Failed to load event ${file}`, error);
    }
  }
  
  displaySuccessMessage(`Loaded ${loadedCount}/${eventFiles.length} event handlers`);
}

// Function to load commands
async function loadCommands() {
  displayLoadingMessage('Loading commands');
  
  const commandFolders = readdirSync(join(__dirname, 'commands'));
  
  let totalCommands = 0;
  let loadedCommands = 0;
  let commandsByCategory = {};
  
  for (const folder of commandFolders) {
    const commandFiles = readdirSync(join(__dirname, 'commands', folder))
      .filter(file => file.endsWith('.js'));
    
    totalCommands += commandFiles.length;
    commandsByCategory[folder] = 0;
    
    for (const file of commandFiles) {
      const commandPath = join(__dirname, 'commands', folder, file);
      try {
        const commandModule = await import(`file://${commandPath}`);
        const command = commandModule.default;
        
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          loadedCommands++;
          commandsByCategory[folder]++;
          logger.debug(`Loaded command: ${command.data.name} (${folder})`);
        } else {
          logger.warn(`Command in ${folder}/${file} is missing required properties.`);
        }
      } catch (error) {
        displayErrorMessage(`Failed to load command ${file}`, error);
      }
    }
  }
  
  // Log command summary by category
  for (const [category, count] of Object.entries(commandsByCategory)) {
    logger.info(`Category ${category}: ${count} commands loaded`);
  }
  
  displaySuccessMessage(`Loaded ${loadedCommands}/${totalCommands} commands`);
}

// Function to load components
async function loadComponents() {
  displayLoadingMessage('Loading interactive components');
  
  // Load component handlers (buttons, select menus, modals)
  const componentFiles = readdirSync(join(__dirname, 'components'))
    .filter(file => file.endsWith('.js'));
  
  let loadedCount = 0;
  let buttonCount = 0;
  let selectMenuCount = 0;
  let modalCount = 0;
  
  for (const file of componentFiles) {
    const componentPath = join(__dirname, 'components', file);
    try {
      const componentModule = await import(`file://${componentPath}`);
      const component = componentModule.default;
      
      if (component?.customId && component?.execute) {
        // Determine component type based on filename or patterns
        if (file.includes('Button') || file.includes('button')) {
          client.buttons.set(component.customId, component);
          buttonCount++;
          logger.debug(`Loaded button: ${component.customId}`);
        }
        else if (file.includes('SelectMenu') || file.includes('selectMenu') || file.includes('select')) {
          client.selectMenus.set(component.customId, component);
          selectMenuCount++;
          logger.debug(`Loaded select menu: ${component.customId}`);
        }
        else if (file.includes('Modal') || file.includes('modal')) {
          client.modals.set(component.customId, component);
          modalCount++;
          logger.debug(`Loaded modal: ${component.customId}`);
        }
        // Default to button if type can't be determined
        else {
          client.buttons.set(component.customId, component);
          buttonCount++;
          logger.debug(`Loaded default component: ${component.customId}`);
        }
        
        loadedCount++;
      }
      
      // Load also any custom component handlers
      if (componentModule.businessButtonHandler) {
        logger.debug('Loaded businessButtonHandler');
      }
      
      if (componentModule.businessModalHandler) {
        logger.debug('Loaded businessModalHandler');
      }
      
      if (componentModule.marketButtonHandler) {
        logger.debug('Loaded marketButtonHandler');
      }
      
      if (componentModule.marketModalHandler) {
        logger.debug('Loaded marketModalHandler');
      }
      
      if (componentModule.researchButtonHandler) {
        logger.debug('Loaded researchButtonHandler');
      }
      
      if (componentModule.researchModalHandler) {
        logger.debug('Loaded researchModalHandler');
      }
      
      if (componentModule.economicButtonHandler) {
        logger.debug('Loaded economicButtonHandler');
      }
      
      if (componentModule.economicModalHandler) {
        logger.debug('Loaded economicModalHandler');
      }
      
      // Also load any additional exported components
      if (componentModule.fireButton && componentModule.fireButton.customId && componentModule.fireButton.execute) {
        client.buttons.set(componentModule.fireButton.customId, componentModule.fireButton);
        buttonCount++;
        loadedCount++;
        logger.debug(`Loaded additional button: ${componentModule.fireButton.customId}`);
      }
      
      if (componentModule.salaryButton && componentModule.salaryButton.customId && componentModule.salaryButton.execute) {
        client.buttons.set(componentModule.salaryButton.customId, componentModule.salaryButton);
        buttonCount++;
        loadedCount++;
        logger.debug(`Loaded additional button: ${componentModule.salaryButton.customId}`);
      }
    } catch (error) {
      displayErrorMessage(`Failed to load component ${file}`, error);
    }
  }
  
  displaySuccessMessage(`Loaded ${loadedCount} components (${buttonCount} buttons, ${selectMenuCount} select menus, ${modalCount} modals)`);
}

// Enhanced status rotation with priority on discord.gg/PILOTE
function setupEnhancedStatusRotation() {
  const primaryStatus = { text: 'discord.gg/PILOTE', type: ActivityType.Watching };
  
  const secondaryStatuses = [
    { text: 'avec l\'économie', type: ActivityType.Playing },
    { text: 'vos commandes', type: ActivityType.Listening },
    { text: '/help pour de l\'aide', type: ActivityType.Playing },
    { text: 'la communauté grandir', type: ActivityType.Watching },
    { text: 'piloteshopping.com', type: ActivityType.Watching },
  ];
  
  let index = 0;
  
  // Update status every 2 minutes
  setInterval(() => {
    // Alternance entre le statut principal et les statuts secondaires
    if (index % 2 === 0) {
      // Statut principal (discord.gg/PILOTE) affiché 50% du temps
      client.user.setActivity(primaryStatus.text, { type: primaryStatus.type });
    } else {
      // Statuts secondaires
      const secondaryIndex = Math.floor(index / 2) % secondaryStatuses.length;
      const status = secondaryStatuses[secondaryIndex];
      client.user.setActivity(status.text, { type: status.type });
    }
    
    index = (index + 1) % (secondaryStatuses.length * 2);
  }, 2 * 60 * 1000); // Change every 2 minutes
  
  // Set initial status to discord.gg/PILOTE
  client.user.setActivity(primaryStatus.text, { type: primaryStatus.type });
  logger.info(`Status rotation activated with primary status: ${primaryStatus.text}`);
}

// Initialiser les systèmes spéciaux
async function initSystems() {
  displayLoadingMessage('Initializing specialized systems');
  
  try {
    // Initialiser le système économique
    const { EconomicEventSystem } = await import('./utils/economicEvents.js');
    client.economicEventSystem = new EconomicEventSystem(client);
    await client.economicEventSystem.initialize();
    logger.info('Economic Event System initialized');
    
    // Initialiser le système de recherche
    const { ResearchSystem } = await import('./utils/researchSystem.js');
    client.researchSystem = new ResearchSystem(client);
    await client.researchSystem.initialize();
    logger.info('Research System initialized');
    
    // Initialiser le système de marché
    const { MarketSystem } = await import('./utils/marketSystem.js');
    client.marketSystem = new MarketSystem(client);
    await client.marketSystem.initialize();
    logger.info('Market System initialized');
    
    // Charger les paramètres globaux depuis la base de données
    const botSettings = await client.db.db.all('SELECT * FROM bot_settings').catch(() => []);
    if (botSettings && botSettings.length > 0) {
      for (const setting of botSettings) {
        process.env[setting.key] = setting.value;
        logger.debug(`Loaded setting: ${setting.key}`);
      }
    }
    
    displaySuccessMessage('Specialized systems initialized');
    return true;
  } catch (error) {
    displayErrorMessage('Failed to initialize specialized systems', error);
    return false;
  }
}

// Initialize the bot with improved structured flow
async function init() {
  try {
    // Load all modules
    await loadEvents();
    await loadCommands();
    await loadComponents();
    
    // Initialize the database
    displayLoadingMessage('Initializing database');
    await dbManager.initialize();
    displaySuccessMessage('Database initialized successfully');
    
    // Initialize specialized systems
    await initSystems();
    
    // Login with the bot token
    displayLoadingMessage('Logging in to Discord');
    await client.login(process.env.BOT_TOKEN);
    
    // Synchroniser toujours les commandes automatiquement
    const syncMode = process.env.SYNC_GLOBAL === 'true' ? 'global' : 'guild';
    displayLoadingMessage(`Syncing commands to Discord API (${syncMode} mode)`);
    const { syncCommands } = await import('./utils/syncCommands.js');
    
    const options = {
      global: syncMode === 'global',
      guildId: process.env.GUILD_ID || process.env.DEV_GUILD_ID
    };
    
    await syncCommands(client, options);
    displaySuccessMessage(`Commands synced successfully in ${syncMode} mode`);
    
  } catch (error) {
    displayErrorMessage('Initialization failed', error);
    process.exit(1);
  }
}

// Client ready event handler with enhanced startup information
client.once('ready', () => {
  // Set up the enhanced status rotation
  setupEnhancedStatusRotation();
  
  // Log detailed bot statistics
  const guildCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  const channelCount = client.channels.cache.size;
  
  logger.info(`Bot is ready! Serving ${guildCount} servers, ${userCount} users, and ${channelCount} channels.`);
  logger.info(`Command count: ${client.commands.size}`);
  logger.info(`Event handlers: ${client.eventNames().length}`);
  
  // Start scheduled tasks
  startScheduledTasks();
});

// Function to start scheduled tasks
function startScheduledTasks() {
  // Mettre à jour le système économique toutes les 24 heures
  setInterval(async () => {
    logger.debug('Running scheduled task: checking economic cycle');
    if (client.economicEventSystem) {
      await client.economicEventSystem.updateEconomicCycle();
    }
  }, 24 * 60 * 60 * 1000);
  
  // Générer des événements économiques aléatoires toutes les 12 heures
  setInterval(async () => {
    logger.debug('Running scheduled task: generating random economic event');
    if (client.economicEventSystem) {
      await client.economicEventSystem.generateRandomEvent();
    }
  }, 12 * 60 * 60 * 1000);
  
  // Mettre à jour les événements actifs toutes les 6 heures
  setInterval(async () => {
    logger.debug('Running scheduled task: updating active economic events');
    if (client.economicEventSystem) {
      await client.economicEventSystem.updateActiveEvents();
    }
  }, 6 * 60 * 60 * 1000);
  
  // Vérifier les accords commerciaux toutes les heures
  setInterval(async () => {
    logger.debug('Running scheduled task: processing trade agreements');
    if (client.marketSystem) {
      await client.marketSystem.processTradeAgreements();
    }
  }, 60 * 60 * 1000);
  
  logger.info('Scheduled tasks started');
}

// Handle process events with improved error logging
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled promise rejection at: ${promise}\nReason: ${reason}`);
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', error => {
  logger.fatal(`Uncaught exception: ${error.message}\n${error.stack}`);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Bot shutting down gracefully...');
  console.log('\nBot shutting down gracefully...');
  
  // Perform cleanup
  await dbManager.close();
  client.destroy();
  
  logger.info('Cleanup complete, exiting process.');
  process.exit(0);
});

// Start the bot
init();