
// src/commands/monitoring/monitor-list.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('monitor-list')
  .setDescription('Affiche la liste de vos monitors')
  .addStringOption(option =>
    option.setName('filter')
      .setDescription('Filtrer par type ou statut')
      .setRequired(false)
      .addChoices(
        { name: 'En ligne', value: 'up' },
        { name: 'Hors ligne', value: 'down' },
        { name: 'HTTP/HTTPS', value: 'http' },
        { name: 'PING', value: 'ping' },
        { name: 'TCP', value: 'tcp' },
        { name: 'DNS', value: 'dns' },
        { name: 'SSL', value: 'ssl' },
        { name: 'Mot-clé', value: 'keyword' },
        { name: 'Performance', value: 'performance' }
      ));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const filter = interaction.options.getString('filter');
    
    // Récupérer les monitors de l'utilisateur
    const monitors = await monitorManager.getUserMonitors(interaction.user.id);
    
    if (monitors.length === 0) {
      return interaction.editReply({
        content: '❌ Vous n\'avez aucun monitor configuré. Utilisez `/monitor-create` pour en créer un.',
        ephemeral: true
      });
    }
    
    // Filtrer les monitors si nécessaire
    let filteredMonitors = monitors;
    if (filter) {
      if (['up', 'down'].includes(filter)) {
        filteredMonitors = monitors.filter(m => m.status === filter);
      } else {
        filteredMonitors = monitors.filter(m => m.type === filter);
      }
    }
    
    if (filteredMonitors.length === 0) {
      return interaction.editReply({
        content: `❌ Aucun monitor ne correspond au filtre "${filter}".`,
        ephemeral: true
      });
    }
    
    // Trier les monitors par statut puis par nom
    filteredMonitors.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'down' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle('📊 Liste de vos monitors')
      .setColor(EMBED_COLORS.INFO)
      .setDescription(`Vous avez ${filteredMonitors.length} monitor${filteredMonitors.length > 1 ? 's' : ''}${filter ? ` (filtre: ${filter})` : ''}.`)
      .setTimestamp();
    
    // Ajouter les monitors à l'embed
    for (const monitor of filteredMonitors) {
      const statusEmoji = monitor.status === 'up' ? '🟢' : monitor.status === 'down' ? '🔴' : '⚪';
      const activeEmoji = monitor.is_active ? '✅' : '❌';
      
      embed.addFields({
        name: `${statusEmoji} ${monitor.name}`,
        value: `**Type:** ${monitor.type}\n**Cible:** ${monitor.target}\n**Statut:** ${monitorManager.formatStatus(monitor.status)}\n**Actif:** ${activeEmoji}\n**ID:** \`${monitor.monitor_id}\``,
        inline: true
      });
    }
    
    // Créer les boutons pour les actions courantes
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_monitors')
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
    console.error('❌ Erreur lors de la récupération des monitors:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la récupération des monitors: ${error.message}`,
      ephemeral: true
    });
  }
}