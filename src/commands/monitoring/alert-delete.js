
// src/commands/monitoring/alert-delete.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('alert-delete')
  .setDescription('Supprime une alerte')
  .addStringOption(option =>
    option.setName('alert_id')
      .setDescription('ID de l\'alerte à supprimer')
      .setRequired(true)
      .setAutocomplete(true));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const alertId = interaction.options.getString('alert_id');
    
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
    if (monitor.user_id !== interaction.user.id && !interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        content: '❌ Vous n\'avez pas l\'autorisation de supprimer cette alerte.',
        ephemeral: true
      });
    }
    
    // Supprimer l'alerte
    await monitorManager.deleteAlert(alertId);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Alerte supprimée')
      .setDescription(`L'alerte a été supprimée avec succès du monitor **${monitor.name}**.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .setTimestamp();
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de l\'alerte:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la suppression de l'alerte: ${error.message}`,
      ephemeral: true
    });
  }
}