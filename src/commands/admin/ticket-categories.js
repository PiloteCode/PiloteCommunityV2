import { SlashCommandBuilder, PermissionFlagsBits, ButtonStyle, EmbedBuilder } from 'discord.js';
import ticketManager from '../../utils/ticketManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('ticket-categories')
  .setDescription('Gérer les catégories de tickets')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Créer une nouvelle catégorie de tickets')
      .addStringOption(option =>
        option.setName('nom')
          .setDescription('Nom de la catégorie')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Description de la catégorie')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('emoji')
          .setDescription('Emoji pour la catégorie')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('button_label')
          .setDescription('Texte du bouton')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('button_style')
          .setDescription('Style du bouton')
          .setRequired(false)
          .addChoices(
            { name: 'Bleu', value: 'PRIMARY' },
            { name: 'Gris', value: 'SECONDARY' },
            { name: 'Vert', value: 'SUCCESS' },
            { name: 'Rouge', value: 'DANGER' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Afficher les catégories de tickets existantes'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Supprimer une catégorie de tickets')
      .addStringOption(option =>
        option.setName('id')
          .setDescription('ID de la catégorie')
          .setRequired(true)
          .setAutocomplete(true)));

export async function execute(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'create': {
        const name = interaction.options.getString('nom');
        const description = interaction.options.getString('description');
        const emoji = interaction.options.getString('emoji') || '🎫';
        const buttonLabel = interaction.options.getString('button_label') || name;
        const buttonStyle = interaction.options.getString('button_style') || 'PRIMARY';
        
        const categoryData = {
          name,
          description,
          emoji,
          buttonLabel,
          buttonStyle
        };
        
        const category = await ticketManager.createTicketCategory(interaction.guild.id, categoryData);
        
        return interaction.reply({
          content: `✅ Catégorie de tickets "${name}" créée avec succès.`,
          ephemeral: true
        });
      }
      
      case 'list': {
        const categories = await ticketManager.getTicketCategories(interaction.guild.id);
        
        if (categories.length === 0) {
          return interaction.reply({
            content: '❌ Aucune catégorie de tickets n\'a été créée.',
            ephemeral: true
          });
        }
        
        const embed = new EmbedBuilder()
          .setTitle('Catégories de tickets')
          .setColor(EMBED_COLORS.INFO)
          .setDescription('Voici les catégories de tickets configurées sur ce serveur:')
          .addFields(
            categories.map(category => ({
              name: `${category.emoji} ${category.name}`,
              value: `${category.description}\nID: \`${category.category_id}\`\nBouton: ${category.button_label} (${category.button_style})`,
              inline: false
            }))
          );
        
        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }
      
      case 'delete': {
        const categoryId = interaction.options.getString('id');
        
        // Vérifier si la catégorie existe
        const categories = await ticketManager.getTicketCategories(interaction.guild.id);
        const category = categories.find(c => c.category_id === categoryId);
        
        if (!category) {
          return interaction.reply({
            content: '❌ Catégorie introuvable.',
            ephemeral: true
          });
        }
        
        // Supprimer la catégorie
        await ticketManager.deleteTicketCategory(categoryId);
        
        return interaction.reply({
          content: `✅ Catégorie "${category.name}" supprimée avec succès.`,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la gestion des catégories de tickets:', error);
    return interaction.reply({
      content: '❌ Une erreur est survenue lors de la gestion des catégories de tickets.',
      ephemeral: true
    });
  }
}