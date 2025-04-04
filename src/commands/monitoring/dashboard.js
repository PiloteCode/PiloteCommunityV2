

// src/commands/monitoring/dashboard.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('dashboard')
  .setDescription('Affiche un tableau de bord avec l\'état de tous vos monitors');

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    // Récupérer tous les monitors de l'utilisateur
    const monitors = await monitorManager.getUserMonitors(interaction.user.id);
    
    if (monitors.length === 0) {
      return interaction.editReply({
        content: '❌ Vous n\'avez aucun monitor configuré. Utilisez `/monitor-create` pour en créer un.',
        ephemeral: true
      });
    }
    
    // Trier les monitors par statut (down en premier, puis up, puis les autres)
    monitors.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'down') return -1;
        if (b.status === 'down') return 1;
        if (a.status === 'up') return -1;
        if (b.status === 'up') return 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    // Compter les monitors par statut
    const downCount = monitors.filter(m => m.status === 'down').length;
    const upCount = monitors.filter(m => m.status === 'up').length;
    const otherCount = monitors.length - downCount - upCount;
    
    // Déterminer la couleur du dashboard
    let dashboardColor = EMBED_COLORS.SUCCESS;
    if (downCount > 0) {
      dashboardColor = EMBED_COLORS.ERROR;
    } else if (otherCount > 0) {
      dashboardColor = EMBED_COLORS.WARNING;
    }
    
    // Créer l'embed du dashboard
    const embed = new EmbedBuilder()
      .setTitle('📊 Tableau de bord de monitoring')
      .setDescription(`Vue d'ensemble de vos ${monitors.length} monitors.`)
      .setColor(dashboardColor)
      .addFields(
        { name: '🟢 En ligne', value: String(upCount), inline: true },
        { name: '🔴 Hors ligne', value: String(downCount), inline: true },
        { name: '⚠️ Autres', value: String(otherCount), inline: true }
      )
      .setTimestamp();
    
    // Ajouter les monitors en état critique (down) en premier
    if (downCount > 0) {
      const downMonitors = monitors.filter(m => m.status === 'down');
      let downList = '';
      
      for (const monitor of downMonitors) {
        downList += `🔴 **${monitor.name}** (${monitor.type}): ${monitor.target}\n`;
      }
      
      embed.addFields({
        name: '🔴 Services hors ligne',
        value: downList
      });
    }
    
    // Ajouter les monitors en ligne
    if (upCount > 0) {
      const upMonitors = monitors.filter(m => m.status === 'up');
      let upList = '';
      
      for (const monitor of upMonitors) {
        upList += `🟢 **${monitor.name}** (${monitor.type}): ${monitor.target}\n`;
      }
      
      embed.addFields({
        name: '🟢 Services en ligne',
        value: upList
      });
    }
    
    // Ajouter les autres monitors
    if (otherCount > 0) {
      const otherMonitors = monitors.filter(m => m.status !== 'up' && m.status !== 'down');
      let otherList = '';
      
      for (const monitor of otherMonitors) {
        otherList += `⚠️ **${monitor.name}** (${monitor.type}): ${monitor.target} - ${monitorManager.formatStatus(monitor.status)}\n`;
      }
      
      embed.addFields({
        name: '⚠️ Autres services',
        value: otherList
      });
    }
    
    // Ajouter des boutons d'action
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_dashboard')
        .setLabel('Rafraîchir')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('check_all_monitors')
        .setLabel('Vérifier tout')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔍')
    );
    
    return interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'affichage du dashboard:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}