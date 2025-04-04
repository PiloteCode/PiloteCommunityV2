// src/commands/monitoring/alert-create.js
import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import premiumManager from '../../utils/premiumManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('alert-create')
  .setDescription('Crée une alerte pour un monitor')
  .addStringOption(option =>
    option.setName('monitor_id')
      .setDescription('ID du monitor')
      .setRequired(true)
      .setAutocomplete(true))
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type d\'alerte')
      .setRequired(true)
      .addChoices(
        { name: 'Canal Discord', value: 'channel' },
        { name: 'Webhook (premium)', value: 'webhook' }
      ))
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Canal où envoyer les alertes')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
  .addRoleOption(option =>
    option.setName('role')
      .setDescription('Rôle à mentionner lors des alertes')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('webhook_url')
      .setDescription('URL du webhook (premium)')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('consecutive_failures')
      .setDescription('Nombre d\'échecs consécutifs avant alerte')
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('cooldown')
      .setDescription('Période de cooldown entre les alertes (secondes)')
      .setMinValue(60)
      .setMaxValue(86400)
      .setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const monitorId = interaction.options.getString('monitor_id');
    const alertType = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    const webhookUrl = interaction.options.getString('webhook_url');
    const consecutiveFailures = interaction.options.getInteger('consecutive_failures') || 1;
    const cooldown = interaction.options.getInteger('cooldown') || 300;
    
    // Récupérer le monitor
    const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
    
    if (!monitor) {
      return interaction.editReply({
        content: '❌ Monitor introuvable.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est le propriétaire du monitor
    if (monitor.user_id !== interaction.user.id) {
      return interaction.editReply({
        content: '❌ Vous n\'êtes pas le propriétaire de ce monitor.',
        ephemeral: true
      });
    }
    
    // Vérifier les paramètres selon le type d'alerte
    if (alertType === 'channel' && !channel) {
      return interaction.editReply({
        content: '❌ Vous devez spécifier un canal pour les alertes de type "Canal Discord".',
        ephemeral: true
      });
    }
    
    if (alertType === 'webhook') {
      // Vérifier si l'utilisateur a la fonctionnalité premium
      const hasPremium = await premiumManager.hasFeature(interaction.user.id, 'webhook_alerts');
      
      if (!hasPremium) {
        return interaction.editReply({
          content: '❌ Les alertes webhook sont une fonctionnalité premium. Utilisez `/premium-purchase webhook_alerts` pour l\'acheter.',
          ephemeral: true
        });
      }
      
      if (!webhookUrl) {
        return interaction.editReply({
          content: '❌ Vous devez spécifier une URL de webhook pour les alertes de type "Webhook".',
          ephemeral: true
        });
      }
      
      // Vérifier rapidement si l'URL est un format webhook valide
      if (!webhookUrl.match(/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/) &&
          !webhookUrl.match(/^https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\/api\/.*$/)) {
        return interaction.editReply({
          content: '❌ L\'URL du webhook semble invalide. Veuillez vérifier le format.',
          ephemeral: true
        });
      }
    }
    
    // Créer l'alerte
    const alertData = {
      monitor_id: monitorId,
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      alert_type: alertType,
      channel_id: channel ? channel.id : null,
      role_id: role ? role.id : null,
      webhook_url: webhookUrl,
      consecutive_failures: consecutiveFailures,
      cooldown: cooldown
    };
    
    const alert = await monitorManager.createAlert(alertData);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Alerte créée avec succès')
      .setDescription(`Une alerte a été configurée pour le monitor **${monitor.name}**.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .addFields(
        { name: 'Type', value: alertType === 'channel' ? 'Canal Discord' : 'Webhook', inline: true },
        { name: 'Échecs consécutifs', value: String(consecutiveFailures), inline: true },
        { name: 'Cooldown', value: `${cooldown}s`, inline: true }
      );
    
    if (alertType === 'channel') {
      embed.addFields(
        { name: 'Canal', value: channel ? `<#${channel.id}>` : 'Non spécifié', inline: true },
        { name: 'Rôle', value: role ? `<@&${role.id}>` : 'Aucun', inline: true }
      );
    } else if (alertType === 'webhook') {
      embed.addFields(
        { name: 'Webhook', value: webhookUrl ? `${webhookUrl.substring(0, 30)}...` : 'Non spécifié', inline: true }
      );
    }
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'alerte:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la création de l'alerte: ${error.message}`,
      ephemeral: true
    });
  }
}
