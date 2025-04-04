

// src/commands/monitoring/monitor-delete.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('monitor-delete')
  .setDescription('Supprime un monitor')
  .addStringOption(option =>
    option.setName('id')
      .setDescription('ID du monitor à supprimer')
      .setRequired(true)
      .setAutocomplete(true));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
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
    
    // Supprimer le monitor
    await monitorManager.deleteMonitor(monitorId);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Monitor supprimé')
      .setDescription(`Le monitor **${monitor.name}** a été supprimé avec succès.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .setTimestamp();
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du monitor:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la suppression du monitor: ${error.message}`,
      ephemeral: true
    });
  }
}