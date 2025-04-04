// src/commands/monitoring/monitor-create.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import monitorManager from '../../utils/monitorManager.js';
import premiumManager from '../../utils/premiumManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('monitor-create')
  .setDescription('Crée un nouveau monitor pour surveiller un service')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Nom du monitor')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type de monitor')
      .setRequired(true)
      .addChoices(
        { name: 'HTTP/HTTPS', value: 'http' },
        { name: 'PING', value: 'ping' },
        { name: 'TCP', value: 'tcp' },
        { name: 'DNS', value: 'dns' },
        { name: 'SSL', value: 'ssl' },
        { name: 'Mot-clé', value: 'keyword' },
        { name: 'Performance', value: 'performance' }
      ))
  .addStringOption(option =>
    option.setName('target')
      .setDescription('Cible du monitor (URL, IP, hostname...)')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Description du monitor')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('interval')
      .setDescription('Intervalle de vérification en secondes (min: 300s, 30s pour premium)')
      .setMinValue(30)
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('timeout')
      .setDescription('Timeout en millisecondes')
      .setMinValue(1000)
      .setMaxValue(30000)
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('start')
      .setDescription('Démarrer le monitor immédiatement')
      .setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const name = interaction.options.getString('name');
    const type = interaction.options.getString('type');
    const target = interaction.options.getString('target');
    const description = interaction.options.getString('description');
    const interval = interaction.options.getInteger('interval');
    const timeout = interaction.options.getInteger('timeout');
    const startNow = interaction.options.getBoolean('start') ?? true;
    
    // Vérifier si l'utilisateur a le statut premium pour les intervalles courts
    const isPremium = await premiumManager.hasFeature(interaction.user.id, 'increased_frequency');
    const minInterval = isPremium ? 30 : 300;
    
    if (interval && interval < minInterval) {
      return interaction.editReply({
        content: `⚠️ L'intervalle minimum est de ${minInterval} secondes${isPremium ? '' : ' (30s avec premium)'}.`,
        ephemeral: true
      });
    }
    
    // Préparation des options spécifiques au type de monitor
    let options = {};
    
    if (type === 'keyword' && !target.includes('://')) {
      return interaction.editReply({
        content: `⚠️ Pour un monitor de type Mot-clé, la cible doit être une URL complète (avec http:// ou https://).`,
        ephemeral: true
      });
    }
    
    // Création du monitor
    const monitor = await monitorManager.createMonitor({
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      name,
      type,
      target,
      description: description || '',
      interval: interval || minInterval,
      timeout: timeout || 10000,
      options,
      start_now: startNow
    });
    
    // Création de l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Monitor créé avec succès')
      .setDescription(`Le monitor **${name}** a été créé et ${startNow ? 'démarré' : 'est prêt à être démarré'}.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .addFields(
        { name: 'Type', value: type, inline: true },
        { name: 'Cible', value: target, inline: true },
        { name: 'Intervalle', value: `${monitor.interval}s`, inline: true },
        { name: 'ID', value: `\`${monitor.monitor_id}\``, inline: false }
      )
      .setTimestamp();
    
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Erreur lors de la création du monitor:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la création du monitor: ${error.message}`,
      ephemeral: true
    });
  }
}