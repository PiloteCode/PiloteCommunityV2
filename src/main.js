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
  
  // Event handler
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    console.log(`🎮 Commande reçue: ${interaction.commandName}`);
    
    const command = client.commands.get(interaction.commandName);
    console.log(`🔍 Commande trouvée:`, command);
  
    if (!command) {
      console.log(`❌ Commande non trouvée: ${interaction.commandName}`);
      return;
    }
  
    try {
      console.log(`⚡ Exécution de la commande ${interaction.commandName}`);
      await command.execute(interaction);
      console.log(`✅ Commande ${interaction.commandName} exécutée avec succès`);
    } catch (error) {
      console.error(`❌ Erreur lors de l'exécution de ${interaction.commandName}:`, error);
      
      const errorMessage = {
        content: 'Une erreur est survenue lors de l\'exécution de la commande.',
        ephemeral: true
      };
  
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } catch (replyError) {
        console.error('❌ Erreur lors de la réponse d\'erreur:', replyError);
      }
    }
  });
  
  client.once('ready', () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
    console.log('📊 Commandes chargées:', client.commands.size);
    console.log('🤖 Bot prêt!');
  });
  
  // Démarrage
  async function start() {
    try {
      console.log('🚀 Démarrage du bot...');
      await loadCommands();
      await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error('❌ Erreur fatale lors du démarrage:', error);
      process.exit(1);
    }
  }
  
  start();