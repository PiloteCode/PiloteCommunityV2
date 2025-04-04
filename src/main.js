// src/main.js
import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection 
} from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import monitorManager from './utils/monitorManager.js';
import premiumManager from './utils/premiumManager.js';
import reportManager from './utils/reportManager.js';
import statusPageManager from './utils/statusPageManager.js';
import { createCanvas } from 'canvas';

// Configuration
config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Client configuration
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message
  ]
});

// Collections
client.commands = new Collection();
client.events = new Collection();

// Exposer le client globalement pour les gestionnaires
global.client = client;

// Fonction de chargement des commandes
async function loadCommands() {
  const commands = [];
  const foldersPath = join(__dirname, 'commands');

  try {
    console.log('📂 Dossier des commandes:', foldersPath);
    const commandFolders = readdirSync(foldersPath);

    for (const folder of commandFolders) {
      const commandsPath = join(foldersPath, folder);
      console.log(`📁 Chargement du dossier: ${folder}`);
      
      const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

      for (const file of commandFiles) {
        try {
          const filePath = `file://${join(commandsPath, file).replace(/\\/g, '/')}`;
          console.log(`📄 Chargement du fichier: ${file}`);
          
          const command = await import(filePath);
          console.log(`⚙️ Commande importée:`, command);

          if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
            console.log(`✅ Commande chargée avec succès: ${command.data.name}`);
          } else {
            console.log(`❌ Commande invalide dans ${file}: data ou execute manquant`);
          }
        } catch (error) {
          console.error(`❌ Erreur lors du chargement de ${file}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des commandes:', error);
  }

  return commands;
}

// Fonction de chargement des événements
async function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  
  try {
    console.log('📂 Dossier des événements:', eventsPath);
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
      try {
        const filePath = `file://${join(eventsPath, file).replace(/\\/g, '/')}`;
        console.log(`📄 Chargement de l'événement: ${file}`);
        
        const event = await import(filePath);
        
        if ('event' in event) {
          if (event.event.once) {
            client.once(event.event.name, (...args) => event.event.execute(...args));
          } else {
            client.on(event.event.name, (...args) => event.event.execute(...args));
          }
          
          client.events.set(event.event.name, event.event);
          console.log(`✅ Événement chargé avec succès: ${event.event.name}`);
        } else {
          console.log(`❌ Événement invalide dans ${file}: propriété 'event' manquante`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors du chargement de l'événement ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des événements:', error);
  }
}

// Fonction d'initialisation des gestionnaires
async function initializeManagers() {
  try {
    console.log('🔄 Initialisation des gestionnaires...');
    
    // Initialiser les gestionnaires dans le bon ordre
    await premiumManager.initialize();
    await monitorManager.initialize();
    await reportManager.initialize();
    await statusPageManager.initialize();
    
    console.log('✅ Tous les gestionnaires ont été initialisés avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des gestionnaires:', error);
  }
}

// Event handler
client.once('ready', async () => {
  try {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
    console.log('📊 Commandes chargées:', client.commands.size);
    console.log('📊 Événements chargés:', client.events.size);
    
    // Initialiser les gestionnaires après le chargement
    await initializeManagers();
    
    console.log('🤖 Bot prêt!');
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du bot:', error);
  }
});

// Démarrage
async function start() {
  try {
    console.log('🚀 Démarrage du bot...');
    
    // Charger les commandes et les événements
    await loadCommands();
    await loadEvents();
    
    // Se connecter à Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Erreur fatale lors du démarrage:', error);
    process.exit(1);
  }
}

start();