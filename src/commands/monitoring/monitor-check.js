
// src/commands/monitoring/monitor-check.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('monitor-check')
  .setDescription('Vérifie immédiatement un ou tous les monitors')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('ID du monitor à vérifier (laissez vide pour tous)')
      .setRequired(false)
      .setAutocomplete(true));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const monitorId = interaction.options.getString('id');
    
    if (monitorId) {
      // Vérifier un monitor spécifique
      const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
      
      if (!monitor) {
        return interaction.editReply({
          content: '❌ Monitor introuvable.',
          ephemeral: true
        });
      }
      
      // Vérifier si l'utilisateur est le propriétaire du monitor ou un admin
      if (monitor.user_id !== interaction.user.id && !interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.editReply({
          content: '❌ Vous n\'avez pas l\'autorisation de vérifier ce monitor.',
          ephemeral: true
        });
      }
      
      // Effectuer la vérification
      const result = await monitorManager.checkMonitor(monitorId);
      
      // Créer l'embed de résultat
      const statusEmoji = result.status === 'up' ? '🟢' : '🔴';
      const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} Résultat de la vérification`)
        .setDescription(`Monitor: **${monitor.name}**`)
        .setColor(result.status === 'up' ? EMBED_COLORS.SUCCESS : EMBED_COLORS.ERROR)
        .addFields(
          { name: 'Statut', value: monitorManager.formatStatus(result.status), inline: true },
          { name: 'Temps de réponse', value: `${result.responseTime}ms`, inline: true },
          { name: 'Message', value: result.message || 'Aucun message', inline: false }
        )
        .setTimestamp();
      
      // Ajouter des détails supplémentaires si disponibles
      if (result.details) {
        for (const [key, value] of Object.entries(result.details)) {
          if (key === 'error' || key === 'stack') continue;
          
          if (typeof value === 'object') {
            embed.addFields({
              name: key,
              value: '```json\n' + JSON.stringify(value, null, 2).substring(0, 1000) + '\n```',
              inline: false
            });
          } else {
            embed.addFields({
              name: key,
              value: String(value).substring(0, 1000),
              inline: true
            });
          }
        }
      }
      
      return interaction.editReply({ embeds: [embed] });
    } else {
      // Vérifier tous les monitors de l'utilisateur
      const monitors = await monitorManager.getUserMonitors(interaction.user.id);
      
      if (monitors.length === 0) {
        return interaction.editReply({
          content: '❌ Vous n\'avez aucun monitor configuré.',
          ephemeral: true
        });
      }
      
      await interaction.editReply({
        content: `🔍 Vérification de ${monitors.length} monitors en cours...`,
      });
      
      // Vérifier tous les monitors
      const results = [];
      
      for (const monitor of monitors) {
        if (!monitor.is_active) continue;
        
        const result = await monitorManager.checkMonitor(monitor.monitor_id);
        results.push({
          monitor,
          result
        });
      }
      
      // Compter les résultats
      const upCount = results.filter(r => r.result.status === 'up').length;
      const downCount = results.filter(r => r.result.status === 'down').length;
      const errorCount = results.filter(r => r.result.status === 'error').length;
      
      // Créer l'embed de résultat
      const embed = new EmbedBuilder()
        .setTitle('📊 Résultats des vérifications')
        .setDescription(`${results.length} monitors vérifiés`)
        .setColor(downCount > 0 ? EMBED_COLORS.ERROR : EMBED_COLORS.SUCCESS)
        .addFields(
          { name: '🟢 En ligne', value: String(upCount), inline: true },
          { name: '🔴 Hors ligne', value: String(downCount), inline: true },
          { name: '⚠️ Erreurs', value: String(errorCount), inline: true }
        )
        .setTimestamp();
      
      // Ajouter les monitors hors ligne
      if (downCount > 0) {
        const downMonitors = results
          .filter(r => r.result.status === 'down')
          .map(r => `**${r.monitor.name}**: ${r.result.message || 'Aucun message'}`)
          .join('\n');
        
        embed.addFields({
          name: '🔴 Monitors hors ligne',
          value: downMonitors
        });
      }
      
      return interaction.editReply({
        content: null,
        embeds: [embed]
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du monitor:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la vérification: ${error.message}`,
      ephemeral: true
    });
  }
}