import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import ticketManager from '../../utils/ticketManager.js';

export const data = new SlashCommandBuilder()
  .setName('ticket-config')
  .setDescription('Configure le système de tickets')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('welcome')
      .setDescription('Définir le message de bienvenue des tickets')
      .addStringOption(option =>
        option.setName('message')
          .setDescription('Le message de bienvenue')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('support-role')
      .setDescription('Définir le rôle de l\'équipe de support')
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Le rôle de l\'équipe de support')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('logs-channel')
      .setDescription('Définir le salon des logs de tickets')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Le salon des logs')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('category')
      .setDescription('Définir la catégorie pour les tickets')
      .addChannelOption(option =>
        option.setName('category')
          .setDescription('La catégorie Discord pour les tickets')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('max-tickets')
      .setDescription('Définir le nombre maximum de tickets par utilisateur')
      .addIntegerOption(option =>
        option.setName('nombre')
          .setDescription('Le nombre maximum de tickets')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Activer ou désactiver le système de tickets')
      .addBooleanOption(option =>
        option.setName('actif')
          .setDescription('État du système de tickets')
          .setRequired(true)));

export async function execute(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand();
    const settings = {};
    
    switch (subcommand) {
      case 'welcome':
        settings.welcome_message = interaction.options.getString('message');
        break;
        
      case 'support-role':
        const role = interaction.options.getRole('role');
        settings.support_team_role = role.id;
        break;
        
      case 'logs-channel':
        const logsChannel = interaction.options.getChannel('channel');
        if (logsChannel.type !== ChannelType.GuildText) {
          return interaction.reply({
            content: '❌ Le salon des logs doit être un salon textuel.',
            ephemeral: true
          });
        }
        settings.logs_channel = logsChannel.id;
        break;
        
      case 'category':
        const category = interaction.options.getChannel('category');
        if (category.type !== ChannelType.GuildCategory) {
          return interaction.reply({
            content: '❌ Vous devez sélectionner une catégorie Discord.',
            ephemeral: true
          });
        }
        settings.ticket_category = category.id;
        break;
        
      case 'max-tickets':
        settings.max_tickets = interaction.options.getInteger('nombre');
        break;
        
      case 'status':
        settings.enabled = interaction.options.getBoolean('actif') ? 1 : 0;
        break;
    }
    
    // Mettre à jour les paramètres
    await ticketManager.updateTicketSettings(interaction.guild.id, settings);
    
    return interaction.reply({
      content: `✅ Configuration du système de tickets mise à jour avec succès.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Erreur lors de la configuration des tickets:', error);
    return interaction.reply({
      content: '❌ Une erreur est survenue lors de la configuration des tickets.',
      ephemeral: true
    });
  }
}