import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// File path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../../../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
  DEBUG: { value: 1, color: 'blue', prefix: '[DEBUG]' },
  INFO: { value: 2, color: 'green', prefix: '[INFO]' },
  WARN: { value: 3, color: 'yellow', prefix: '[WARN]' },
  ERROR: { value: 4, color: 'red', prefix: '[ERROR]' },
  FATAL: { value: 5, color: 'magenta', prefix: '[FATAL]' }
};

// Current log level (can be changed at runtime)
let currentLogLevel = LOG_LEVELS.INFO.value;

/**
 * Write a message to the log file
 * @param {string} message - Message to log
 * @param {string} level - Log level
 */
function writeToFile(message, level) {
  const now = new Date();
  const dateStr = now.toISOString();
  const logFile = path.join(logsDir, `${now.toISOString().split('T')[0]}.log`);
  
  const logEntry = `${dateStr} ${level} ${message}\n`;
  
  fs.appendFileSync(logFile, logEntry);
}

/**
 * Format a message for console output
 * @param {string} message - Message to format
 * @param {Object} levelConfig - Log level configuration
 * @returns {string} Formatted message
 */
function formatConsoleMessage(message, levelConfig) {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  return `${chalk.grey(timeString)} ${chalk[levelConfig.color](levelConfig.prefix)} ${message}`;
}

/**
 * Log a message
 * @param {string} message - Message to log
 * @param {string} level - Log level
 */
function log(message, level = 'INFO') {
  const levelConfig = LOG_LEVELS[level];
  
  // Check if level should be logged
  if (levelConfig.value >= currentLogLevel) {
    // Log to console with colors
    console.log(formatConsoleMessage(message, levelConfig));
    
    // Write to file
    writeToFile(message, levelConfig.prefix);
  }
}

/**
 * Set the log level
 * @param {string} level - Log level
 */
function setLogLevel(level) {
  if (LOG_LEVELS[level]) {
    currentLogLevel = LOG_LEVELS[level].value;
    log(`Log level set to ${level}`, 'INFO');
  } else {
    log(`Invalid log level: ${level}`, 'WARN');
  }
}

// Create helper methods for each log level
const debug = message => log(message, 'DEBUG');
const info = message => log(message, 'INFO');
const warn = message => log(message, 'WARN');
const error = message => log(message, 'ERROR');
const fatal = message => log(message, 'FATAL');

// Export the logger
export default {
  log,
  debug,
  info,
  warn,
  error,
  fatal,
  setLogLevel
};