
// src/commands/monitoring/monitor-update.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import premiumManager from '../../utils/premiumManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('monitor-update')
  .setDescription('Met à jour un monitor existant')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('ID du monitor à mettre à jour')
      .setRequired(true)
      .setAutocomplete(true))
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nouveau nom du monitor')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Nouvelle description du monitor')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('target')
      .setDescription('Nouvelle cible du monitor')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('interval')
      .setDescription('Nouvel intervalle de vérification (secondes)')
      .setMinValue(30)
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('timeout')
      .setDescription('Nouveau timeout (millisecondes)')
      .setMinValue(1000)
      .setMaxValue(30000)
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('active')
      .setDescription('Activer ou désactiver le monitor')
      .setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const monitorId = interaction.options.getString('id');
    
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
    
    // Récupérer les options
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const target = interaction.options.getString('target');
    const interval = interaction.options.getInteger('interval');
    const timeout = interaction.options.getInteger('timeout');
    const active = interaction.options.getBoolean('active');
    
    // Vérifier si au moins une option est fournie
    if (!name && !description && !target && interval === null && timeout === null && active === null) {
      return interaction.editReply({
        content: '❌ Veuillez spécifier au moins une valeur à mettre à jour.',
        ephemeral: true
      });
    }
    
    // Vérifier l'intervalle par rapport au statut premium
    if (interval !== null) {
      const isPremium = await premiumManager.hasFeature(interaction.user.id, 'increased_frequency');
      const minInterval = isPremium ? 30 : 300;
      
      if (interval < minInterval) {
        return interaction.editReply({
          content: `⚠️ L'intervalle minimum est de ${minInterval} secondes${isPremium ? '' : ' (30s avec premium)'}.`,
          ephemeral: true
        });
      }
    }
    
    // Préparer les données de mise à jour
    const updateData = {};
    
    if (name) updateData.name = name;
    if (description !== null) updateData.description = description;
    if (target) updateData.target = target;
    if (interval !== null) updateData.interval = interval;
    if (timeout !== null) updateData.timeout = timeout;
    if (active !== null) {
      updateData.is_active = active ? 1 : 0;
      
      // Démarrer ou arrêter le monitor
      if (active) {
        await monitorManager.startMonitor(monitorId);
      } else {
        await monitorManager.stopMonitor(monitorId);
      }
    }
    
    // Mettre à jour le monitor
    const updatedMonitor = await monitorManager.updateMonitor(monitorId, updateData);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Monitor mis à jour')
      .setDescription(`Le monitor **${updatedMonitor.name}** a été mis à jour avec succès.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .addFields(
        { name: 'Type', value: updatedMonitor.type, inline: true },
        { name: 'Cible', value: updatedMonitor.target, inline: true },
        { name: 'Intervalle', value: `${updatedMonitor.interval}s`, inline: true },
        { name: 'Statut', value: monitorManager.formatStatus(updatedMonitor.status), inline: true },
        { name: 'Actif', value: updatedMonitor.is_active ? '✅' : '❌', inline: true },
        { name: 'ID', value: `\`${updatedMonitor.monitor_id}\``, inline: false }
      )
      .setTimestamp();
    
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du monitor:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la mise à jour du monitor: ${error.message}`,
      ephemeral: true
    });
  }
}