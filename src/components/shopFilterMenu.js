import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'shop',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, userId] = extraData;
      
      // Verify that the user who clicked is the one who initiated
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: 'Vous ne pouvez pas utiliser ce menu.',
          ephemeral: true
        });
      }
      
      await interaction.deferUpdate();
      
      // Handle filter action
      if (action === 'filter') {
        // Get the selected filter
        const selectedCategory = interaction.values[0];
        
        // Get user data
        const user = await client.db.getUser(userId);
        
        // Get shop items with filter
        const items = await client.db.getShopItems(selectedCategory === 'all' ? null : selectedCategory);
        
        if (items.length === 0) {
          const embed = EmbedCreator.warning(
            'Catégorie vide',
            `Aucun objet n'est disponible dans cette catégorie.`
          );
          
          return interaction.editReply({ 
            embeds: [embed],
            components: [interaction.message.components[0]]  // Keep the menu
          });
        }
        
        // Create the filtered shop embed
        const embed = EmbedCreator.shop(items);
        
        // Add user's balance for reference
        embed.setFooter({ 
          text: `Votre solde: ${user.balance} crédits | Utilisez /buy [id] pour acheter un objet`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        });
        
        // Update message with new embed but keep the same menu
        await interaction.editReply({ 
          embeds: [embed],
          components: [interaction.message.components[0]]
        });
      }
    } catch (error) {
      console.error('Error handling shop filter menu:', error);
      
      await interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du filtrage de la boutique.'
          )
        ]
      }).catch(console.error);
    }
  }
};