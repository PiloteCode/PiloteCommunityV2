import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import logger from './logs/logger.js';

/**
 * Display a stylish startup banner
 * @param {Object} config - Configuration object
 * @param {string} config.version - Bot version
 * @param {string} config.author - Bot author
 * @param {string} config.website - Website URL
 */
export function displayStartupBanner(config) {
  console.clear();
  
  // Create figlet text
  const bannerText = figlet.textSync('PiloteCommunity', {
    font: 'Big',
    horizontalLayout: 'fitted',
    verticalLayout: 'default',
    width: 100,
    whitespaceBreak: true
  });
  
  // Create info text
  const infoText = [
    `${chalk.bold('Version:')} ${chalk.green(config.version)}`,
    `${chalk.bold('Author:')} ${chalk.yellow(config.author)}`,
    `${chalk.bold('Discord:')} ${chalk.cyan('discord.gg/PILOTE')}`,
    `${chalk.bold('Website:')} ${chalk.cyan(config.website)}`,
    '',
    `${chalk.bold.green('Bot is starting up...')}`
  ].join('\n');
  
  // Create the boxed banner
  const boxedBanner = boxen(
    `${chalk.cyan(bannerText)}\n\n${infoText}`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  );
  
  // Print the banner
  console.log(boxedBanner);
  
  // Log startup
  logger.info('Bot startup initiated');
}

/**
 * Display a loading message
 * @param {string} message - Message to display
 */
export function displayLoadingMessage(message) {
  console.log(chalk.yellow(`⏳ ${message}...`));
  logger.debug(message);
}

/**
 * Display a success message
 * @param {string} message - Message to display
 */
export function displaySuccessMessage(message) {
  console.log(chalk.green(`✅ ${message}`));
  logger.info(message);
}

/**
 * Display an error message
 * @param {string} message - Message to display
 * @param {Error} error - Error object
 */
export function displayErrorMessage(message, error) {
  console.log(chalk.red(`❌ ${message}`));
  if (error) {
    console.log(chalk.red(error.stack || error.message));
    logger.error(`${message}: ${error.message}`);
  } else {
    logger.error(message);
  }
}

/**
 * Display ready message
 * @param {Object} client - Discord client
 */
export function displayReadyMessage(client) {
  // Create stats text
  const statsText = [
    `${chalk.bold('Bot User:')} ${chalk.green(client.user.tag)}`,
    `${chalk.bold('Servers:')} ${chalk.yellow(client.guilds.cache.size)}`,
    `${chalk.bold('Commands:')} ${chalk.yellow(client.commands.size)}`,
    `${chalk.bold('Events:')} ${chalk.yellow(client.eventNames().length)}`,
    '',
    `${chalk.bold.green('Bot is now online and ready!')}`
  ].join('\n');
  
  // Create the boxed stats
  const boxedStats = boxen(
    statsText,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green'
    }
  );
  
  // Print the stats
  console.log(boxedStats);
  
  // Log ready
  logger.info('Bot is now online and ready!');
}