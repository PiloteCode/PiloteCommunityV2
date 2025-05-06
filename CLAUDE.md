# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PiloteCommunity Bot is an open-source Discord bot for the Pilote Production community. The bot provides various features including:

- Economy system with virtual currency, inventory, and shop
- Monitoring system with alerts and dashboards
- Ticket management system

The bot is built with Node.js and Discord.js, using SQLite for data storage.

## Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Starts the bot in production mode |
| `npm run dev` | Starts the bot with nodemon for development |
| `npm run deploy` | Deploys slash commands to Discord for production |
| `npm run deploy:dev` | Deploys slash commands for development environment |
| `npm run lint` | Runs ESLint to check for code style issues |
| `npm run format` | Runs Prettier to automatically format code |
| `npm run backup-db` | Creates a backup of the SQLite database |
| `npm run test` | Runs Jest tests |

## Project Structure

The project follows a modular structure:

- `src/commands/` - Discord slash commands organized by category
- `src/events/` - Discord.js event handlers
- `src/utils/` - Utility functions and managers
- `src/database/` - Database schema and manager
- `src/components/` - UI components for Discord interactions

## Key Technologies

- Node.js (v18+)
- Discord.js v14
- SQLite for database
- Jest for testing
- ESLint and Prettier for code quality

## Environment Setup

The project uses a `.env` file for configuration. Make sure this file contains the necessary Discord bot token and other required environment variables.

## Data Policies

This bot collects and stores user data including Discord IDs, game statistics, and virtual economy information. All data is stored locally in a SQLite database. Refer to the `policy.markdown` and `terms-of-services.markdown` for complete data handling policies.