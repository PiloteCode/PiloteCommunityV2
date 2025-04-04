// src/commands/monitoring/report-create.js
import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import reportManager from '../../utils/reportManager.js';
import monitorManager from '../../utils/monitorManager.js';
import premiumManager from '../../utils/premiumManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('report-create')
  .setDescription('Crée un rapport périodique pour les monitors')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nom du rapport')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('monitors')
      .setDescription('IDs des monitors séparés par des virgules')
      .setRequired(true))
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Canal où envoyer le rapport')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
  .addStringOption(option =>
    option.setName('schedule')
      .setDescription('Planification du rapport')
      .setRequired(false)
      .addChoices(
        { name: 'Quotidien', value: 'daily' },
        { name: 'Hebdomadaire (Lundi)', value: 'weekly-1' },
        { name: 'Hebdomadaire (Mercredi)', value: 'weekly-3' },
        { name: 'Hebdomadaire (Vendredi)', value: 'weekly-5' },
        { name: 'Mensuel (1er jour)', value: 'monthly-1' },
        { name: 'Mensuel (15e jour)', value: 'monthly-15' }
      ))
  .addBooleanOption(option =>
    option.setName('premium')
      .setDescription('Créer un rapport détaillé (fonctionnalité premium)')
      .setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const name = interaction.options.getString('name');
    const monitorIds = interaction.options.getString('monitors').split(',').map(id => id.trim());
    const channel = interaction.options.getChannel('channel');
    const schedule = interaction.options.getString('schedule');
    const isPremium = interaction.options.getBoolean('premium') ?? false;
    
    // Vérifier que les monitors existent et appartiennent à l'utilisateur
    for (const monitorId of monitorIds) {
      try {
        const monitor = await monitorManager.getMonitor(monitorId);
        
        if (monitor.user_id !== interaction.user.id) {
          return interaction.editReply({
            content: `❌ Vous n'êtes pas le propriétaire du monitor avec l'ID \`${monitorId}\`.`,
            ephemeral: true
          });
        }
      } catch (error) {
        return interaction.editReply({
          content: `❌ Monitor introuvable pour l'ID \`${monitorId}\`.`,
          ephemeral: true
        });
      }
    }
    
    // Vérifier les permissions sur le canal
    if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks', 'AttachFiles'])) {
      return interaction.editReply({
        content: `❌ Je n'ai pas les permissions nécessaires dans le canal ${channel}.`,
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur a la fonctionnalité premium pour les rapports détaillés
    if (isPremium) {
      const hasPremium = await premiumManager.hasFeature(interaction.user.id, 'advanced_stats');
      
      if (!hasPremium) {
        return interaction.editReply({
          content: '❌ Les rapports détaillés sont une fonctionnalité premium. Utilisez `/premium-purchase advanced_stats` pour l\'acheter.',
          ephemeral: true
        });
      }
    }
    
    // Créer le rapport
    const report = await reportManager.createReport({
      name,
      monitors: monitorIds,
      channel_id: channel.id,
      schedule,
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      is_active: true,
      is_premium: isPremium
    });
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Rapport créé avec succès')
      .setDescription(`Le rapport **${name}** a été configuré.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .addFields(
        { name: 'Monitors', value: `${monitorIds.length} monitor(s)`, inline: true },
        { name: 'Canal', value: `<#${channel.id}>`, inline: true },
        { name: 'Type', value: isPremium ? 'Détaillé (Premium)' : 'Standard', inline: true }
      );
    
    if (schedule) {
      embed.addFields({
        name: 'Planification',
        value: this.formatSchedule(schedule),
        inline: true
      });
    } else {
      embed.addFields({
        name: 'Planification',
        value: 'Manuel (non planifié)',
        inline: true
      });
    }
    
    embed.addFields({
      name: 'ID du rapport',
      value: `\`${report.report_id}\``,
      inline: false
    });
    
    // Générer un premier rapport immédiatement
    await reportManager.generateReport(report.report_id);
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création du rapport:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la création du rapport: ${error.message}`,
      ephemeral: true
    });
  }
}

// Formater la planification pour l'affichage
export function formatSchedule(schedule) {
  const [frequency, day] = schedule.split('-');
  
  switch (frequency) {
    case 'daily':
      return 'Tous les jours';
    case 'weekly':
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      return `Toutes les semaines (${days[day]})`;
    case 'monthly':
      return `Tous les mois (${day}e jour)`;
    default:
      return schedule;
  }
}

