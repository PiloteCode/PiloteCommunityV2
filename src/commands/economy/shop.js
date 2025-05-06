import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Consultez la boutique pour acheter des objets')
    .addStringOption(option =>
      option
        .setName('categorie')
        .setDescription('Filtrer par catégorie')
        .setRequired(false)
        .addChoices(
          { name: 'Outils', value: 'tools' },
          { name: 'Consommables', value: 'consumable' },
          { name: 'Spéciaux', value: 'special' },
          { name: 'Cosmétiques', value: 'cosmetic' },
          { name: 'Améliorations', value: 'upgrade' }
        )
    ),
  
  // No cooldown for this command
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Get category filter if provided
      const category = interaction.options.getString('categorie');
      
      // Get user data
      const user = await client.db.getUser(interaction.user.id);
      
      // Get shop items
      const items = await client.db.getShopItems(category);
      
      if (items.length === 0) {
        const embed = EmbedCreator.warning(
          'Boutique vide',
          category 
            ? `Aucun objet n'est disponible dans la catégorie ${category}.`
            : 'La boutique ne contient aucun objet pour le moment.'
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      // Create the shop embed
      const embed = EmbedCreator.shop(items);
      
      // Add user's balance for reference
      embed.setFooter({ 
        text: `Votre solde: ${user.balance} crédits | Utilisez /buy [id] pour acheter un objet`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      });
      
      // Create category filter menu
      const menu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`shop:filter:${interaction.user.id}`)
            .setPlaceholder('Filtrer par catégorie...')
            .addOptions([
              {
                label: 'Tous les objets',
                description: 'Afficher tous les objets disponibles',
                value: 'all',
                default: !category
              },
              {
                label: 'Outils',
                description: 'Objets qui améliorent vos performances',
                value: 'tools',
                emoji: '🔧',
                default: category === 'tools'
              },
              {
                label: 'Consommables',
                description: 'Objets à usage unique',
                value: 'consumable',
                emoji: '🧪',
                default: category === 'consumable'
              },
              {
                label: 'Spéciaux',
                description: 'Objets rares et uniques',
                value: 'special',
                emoji: '✨',
                default: category === 'special'
              },
              {
                label: 'Cosmétiques',
                description: 'Objets décoratifs',
                value: 'cosmetic',
                emoji: '🎭',
                default: category === 'cosmetic'
              },
              {
                label: 'Améliorations',
                description: 'Améliorations permanentes',
                value: 'upgrade',
                emoji: '⬆️',
                default: category === 'upgrade'
              }
            ])
        );
      
      await interaction.editReply({ 
        embeds: [embed],
        components: [menu]
      });
      
    } catch (error) {
      console.error('Error in shop command:', error);
      
      // Send error message
      const errorEmbed = EmbedCreator.error(
        'Erreur',
        'Une erreur est survenue lors de l\'exécution de la commande.'
      );
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
};