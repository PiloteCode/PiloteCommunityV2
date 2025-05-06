import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];
const commandFolders = readdirSync(join(__dirname, 'commands'));

// Check if we're deploying in dev mode
const isDev = process.argv.includes('--dev');
console.log(`Deploying commands in ${isDev ? 'development' : 'production'} mode`);

// Load all commands from command folders
for (const folder of commandFolders) {
  const commandFiles = readdirSync(join(__dirname, 'commands', folder))
    .filter(file => file.endsWith('.js'));
    
  for (const file of commandFiles) {
    const commandPath = join(__dirname, 'commands', folder, file);
    const commandModule = await import(`file://${commandPath}`);
    const command = commandModule.default;
    
    if (command.data) {
      commands.push(command.data.toJSON());
      console.log(`Added command: ${command.data.name}`);
    } else {
      console.warn(`Command in ${folder}/${file} is missing required properties.`);
    }
  }
}

// Prepare REST API client
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

try {
  console.log(`Started refreshing ${commands.length} application (/) commands.`);
  
  let data;
  
  if (isDev && process.env.GUILD_ID) {
    // Deploy commands to a specific guild (faster for development)
    data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );
    console.log(`Successfully reloaded ${data.length} guild commands for guild ${process.env.GUILD_ID}.`);
  } else {
    // Deploy commands globally (takes up to an hour to propagate)
    data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log(`Successfully reloaded ${data.length} global commands.`);
  }
} catch (error) {
  console.error('Error deploying commands:', error);
}