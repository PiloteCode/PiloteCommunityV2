
// src/commands/monitoring/alert-update.js
import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('alert-update')
  .setDescription('Met à jour une alerte existante')
  .addStringOption(option =>
    option.setName('alert_id')
      .setDescription('ID de l\'alerte à mettre à jour')
      .setRequired(true)
      .setAutocomplete(true))
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Nouveau canal pour les alertes')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
  .addRoleOption(option =>
    option.setName('role')
      .setDescription('Nouveau rôle à mentionner')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('webhook_url')
      .setDescription('Nouvelle URL de webhook')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('consecutive_failures')
      .setDescription('Nouveau nombre d\'échecs consécutifs')
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('cooldown')
      .setDescription('Nouveau cooldown (secondes)')
      .setMinValue(60)
      .setMaxValue(86400)
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('active')
      .setDescription('Activer ou désactiver l\'alerte')
      .setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const alertId = interaction.options.getString('alert_id');
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    const webhookUrl = interaction.options.getString('webhook_url');
    const consecutiveFailures = interaction.options.getInteger('consecutive_failures');
    const cooldown = interaction.options.getInteger('cooldown');
    const isActive = interaction.options.getBoolean('active');
    
    // Récupérer l'alerte
    const alert = await monitorManager.getAlert(alertId).catch(() => null);
    
    if (!alert) {
      return interaction.editReply({
        content: '❌ Alerte introuvable.',
        ephemeral: true
      });
    }
    
    // Récupérer le monitor associé
    const monitor = await monitorManager.getMonitor(alert.monitor_id).catch(() => null);
    
    if (!monitor) {
      return interaction.editReply({
        content: '❌ Monitor associé introuvable.',
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
    
    // Vérifier le type d'alerte pour les paramètres
    if (webhookUrl && alert.alert_type !== 'webhook') {
      return interaction.editReply({
        content: '❌ Vous ne pouvez pas configurer un webhook pour une alerte de type canal.',
        ephemeral: true
      });
    }
    
    if ((channel || role) && alert.alert_type !== 'channel') {
      return interaction.editReply({
        content: '❌ Vous ne pouvez pas configurer un canal ou un rôle pour une alerte de type webhook.',
        ephemeral: true
      });
    }
    
    // Vérifier si au moins une option est fournie
    if (!channel && !role && !webhookUrl && consecutiveFailures === null && cooldown === null && isActive === null) {
      return interaction.editReply({
        content: '❌ Veuillez spécifier au moins une valeur à mettre à jour.',
        ephemeral: true
      });
    }
    
    // Préparer les données de mise à jour
    const updateData = {};
    
    if (channel) updateData.channel_id = channel.id;
    if (role) updateData.role_id = role.id;
    if (webhookUrl) updateData.webhook_url = webhookUrl;
    if (consecutiveFailures !== null) updateData.consecutive_failures = consecutiveFailures;
    if (cooldown !== null) updateData.cooldown = cooldown;
    if (isActive !== null) updateData.is_active = isActive ? 1 : 0;
    
    // Mettre à jour l'alerte
    const updatedAlert = await monitorManager.updateAlert(alertId, updateData);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Alerte mise à jour')
      .setDescription(`L'alerte pour le monitor **${monitor.name}** a été mise à jour avec succès.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .setTimestamp();
    
    // Ajouter les détails de l'alerte
    if (updatedAlert.alert_type === 'channel') {
      embed.addFields(
        { name: 'Type', value: 'Canal Discord', inline: true },
        { name: 'Canal', value: updatedAlert.channel_id ? `<#${updatedAlert.channel_id}>` : 'Non spécifié', inline: true },
        { name: 'Rôle', value: updatedAlert.role_id ? `<@&${updatedAlert.role_id}>` : 'Aucun', inline: true }
      );
    } else if (updatedAlert.alert_type === 'webhook') {
      embed.addFields(
        { name: 'Type', value: 'Webhook', inline: true },
        { name: 'Webhook', value: updatedAlert.webhook_url ? `${updatedAlert.webhook_url.substring(0, 30)}...` : 'Non spécifié', inline: true }
      );
    }
    
    embed.addFields(
      { name: 'Échecs consécutifs', value: String(updatedAlert.consecutive_failures), inline: true },
      { name: 'Cooldown', value: `${updatedAlert.cooldown}s`, inline: true },
      { name: 'Statut', value: updatedAlert.is_active ? '✅ Actif' : '❌ Inactif', inline: true }
    );
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de l\'alerte:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la mise à jour de l'alerte: ${error.message}`,
      ephemeral: true
    });
  }
}