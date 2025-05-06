import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { Pagination } from '../../utils/pagination.js';

export default {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Consultez votre inventaire ou celui d\'un autre utilisateur')
    .addUserOption(option => 
      option
        .setName('utilisateur')
        .setDescription('Utilisateur dont vous voulez voir l\'inventaire')
        .setRequired(false)
    ),
  
  // No cooldown for this command
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Get target user (mentioned user or self)
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      const targetUserId = targetUser.id;
      
      // Get user inventory
      const inventory = await client.db.getInventory(targetUserId);
      
      if (inventory.length === 0) {
        // Empty inventory
        const embed = EmbedCreator.warning(
          'Inventaire vide',
          targetUser.id === interaction.user.id 
            ? 'Votre inventaire est vide. Achetez des objets avec la commande `/shop`.'
            : `L'inventaire de <@${targetUserId}> est vide.`
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      // Group items by category to create separate pages
      const categories = {};
      
      inventory.forEach(item => {
        if (!categories[item.category]) {
          categories[item.category] = [];
        }
        
        categories[item.category].push(item);
      });
      
      // Create an embed for each category
      const embeds = [];
      
      for (const [category, items] of Object.entries(categories)) {
        // Get emoji for category
        let emoji;
        switch (category.toLowerCase()) {
          case 'tools':
            emoji = '🔧';
            break;
          case 'consumable':
            emoji = '🧪';
            break;
          case 'special':
            emoji = '✨';
            break;
          case 'cosmetic':
            emoji = '🎭';
            break;
          case 'upgrade':
            emoji = '⬆️';
            break;
          default:
            emoji = '📦';
        }
        
        // Format category name
        const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
        
        // Create fields for each item
        const fields = items.map(item => ({
          name: `${item.name} ${item.quantity > 1 ? `(x${item.quantity})` : ''}`,
          value: `${item.description}\n${item.usable ? '✅ Utilisable avec `/use`' : '❌ Non utilisable'}`,
          inline: true
        }));
        
        // Add empty field if odd number of items for better layout
        if (fields.length % 2 !== 0) {
          fields.push({
            name: '\u200B',
            value: '\u200B',
            inline: true
          });
        }
        
        // Create embed for this category
        const embed = EmbedCreator.create({
          title: `🎒 Inventaire${targetUser.id !== interaction.user.id ? ` de ${targetUser.username}` : ''}`,
          description: `${emoji} **${formattedCategory}**`,
          color: 'PROFILE',
          fields,
          thumbnail: targetUser.displayAvatarURL({ dynamic: true })
        });
        
        embeds.push(embed);
      }
      
      // If there's only one category, just send a single embed
      if (embeds.length === 1) {
        return interaction.editReply({ embeds: [embeds[0]] });
      }
      
      // Otherwise, create a paginated embed
      const pagination = new Pagination(embeds, { 
        userId: interaction.user.id,
        time: 120000, // 2 minutes
        fastSkip: true
      });
      
      await pagination.send(interaction);
      
    } catch (error) {
      console.error('Error in inventory command:', error);
      
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