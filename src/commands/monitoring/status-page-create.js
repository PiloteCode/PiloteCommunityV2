// src/commands/monitoring/status-page-create.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import statusPageManager from '../../utils/statusPageManager.js';
import monitorManager from '../../utils/monitorManager.js';
import premiumManager from '../../utils/premiumManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('status-page-create')
  .setDescription('Crée une page de statut publique pour vos monitors (fonctionnalité premium)')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('Titre de la page de statut')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('monitors')
      .setDescription('IDs des monitors séparés par des virgules')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Description de la page')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('logo_url')
      .setDescription('URL du logo (optionnel)')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('theme')
      .setDescription('Thème de la page')
      .setRequired(false)
      .addChoices(
        { name: 'Clair', value: 'light' },
        { name: 'Sombre', value: 'dark' },
        { name: 'Bleu', value: 'blue' },
        { name: 'Corporate', value: 'corporate' },
        { name: 'Minimal', value: 'minimal' }
      ))
  .addIntegerOption(option =>
    option.setName('update_interval')
      .setDescription('Intervalle de mise à jour en secondes (min: 300)')
      .setMinValue(300)
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('public')
      .setDescription('Rendre la page publique (visible sans authentification)')
      .setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const title = interaction.options.getString('title');
    const monitorIds = interaction.options.getString('monitors').split(',').map(id => id.trim());
    const description = interaction.options.getString('description');
    const logoUrl = interaction.options.getString('logo_url');
    const theme = interaction.options.getString('theme') || 'light';
    const updateInterval = interaction.options.getInteger('update_interval') || 300;
    const isPublic = interaction.options.getBoolean('public') ?? true;
    
    // Vérifier si l'utilisateur a la fonctionnalité premium
    const hasPremium = await premiumManager.hasFeature(interaction.user.id, 'status_page');
    
    if (!hasPremium) {
      return interaction.editReply({
        content: '❌ Les pages de statut sont une fonctionnalité premium. Utilisez `/premium-purchase status_page` pour l\'acheter.',
        ephemeral: true
      });
    }
    
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
    
    // Créer la page de statut
    const page = await statusPageManager.createStatusPage({
      title,
      monitors: monitorIds,
      description,
      logo_url: logoUrl,
      theme,
      update_interval: updateInterval,
      is_public: isPublic,
      guild_id: interaction.guildId,
      user_id: interaction.user.id
    });
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Page de statut créée avec succès')
      .setDescription(`La page **${title}** a été configurée.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .addFields(
        { name: 'Monitors', value: `${monitorIds.length} monitor(s)`, inline: true },
        { name: 'Thème', value: theme, inline: true },
        { name: 'Mise à jour', value: `Toutes les ${updateInterval} secondes`, inline: true },
        { name: 'Visibilité', value: isPublic ? 'Publique' : 'Privée', inline: true }
      );
    
    if (logoUrl) {
      embed.setThumbnail(logoUrl);
    }
    
    embed.addFields({
      name: 'URL publique',
      value: `\`${page.public_url}\``,
      inline: false
    });
    
    if (!isPublic) {
      embed.addFields({
        name: 'Token d\'accès',
        value: `\`${page.access_token}\``,
        inline: false
      });
      
      embed.setFooter({
        text: 'Conservez ce token en lieu sûr ! Il est nécessaire pour accéder à votre page privée.'
      });
    }
    
    embed.addFields({
      name: 'ID de la page',
      value: `\`${page.page_id}\``,
      inline: false
    });
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création de la page de statut:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue lors de la création de la page de statut: ${error.message}`,
      ephemeral: true
    });
  }
}
