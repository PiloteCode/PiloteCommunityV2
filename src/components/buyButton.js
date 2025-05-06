import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'buy',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, userId, itemId, quantity] = extraData;
      
      // Verify that the user who clicked is the one who initiated
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: 'Vous ne pouvez pas utiliser cette interaction.',
          ephemeral: true
        });
      }
      
      // Handle cancel action
      if (action === 'cancel') {
        await interaction.update({
          embeds: [
            EmbedCreator.warning(
              'Achat annulé',
              'Vous avez annulé votre achat.'
            )
          ],
          components: []
        });
        return;
      }
      
      // Handle confirm action
      if (action === 'confirm') {
        // Parse quantity
        const parsedQuantity = parseInt(quantity) || 1;
        
        // Get item details again to verify
        const item = await client.db.getShopItem(itemId);
        
        if (!item || !item.available) {
          return interaction.update({
            embeds: [
              EmbedCreator.error(
                'Objet indisponible',
                'Cet objet n\'est plus disponible à l\'achat.'
              )
            ],
            components: []
          });
        }
        
        // Calculate total cost
        const totalCost = item.price * parsedQuantity;
        
        // Get user data to verify funds
        const user = await client.db.getUser(userId);
        
        // Check if user still has enough credits
        if (user.balance < totalCost) {
          return interaction.update({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous n'avez pas assez de crédits pour cet achat.\nPrix: **${totalCost}** crédits | Votre solde: **${user.balance}** crédits`
              )
            ],
            components: []
          });
        }
        
        // Process the purchase
        await client.db.db.run('BEGIN TRANSACTION');
        
        try {
          // Deduct credits
          await client.db.updateUserBalance(userId, -totalCost);
          
          // Add item to inventory
          await client.db.addItemToInventory(userId, itemId, parsedQuantity);
          
          await client.db.db.run('COMMIT');
          
          // Send success message
          await interaction.update({
            embeds: [
              EmbedCreator.success(
                'Achat réussi',
                `Vous avez acheté ${parsedQuantity > 1 ? `**${parsedQuantity}x** ` : ''}**${item.name}** pour **${totalCost}** crédits.`,
                {
                  fields: [
                    {
                      name: 'Nouveau solde',
                      value: `**${user.balance - totalCost}** crédits`,
                      inline: true
                    },
                    {
                      name: 'Utilisation',
                      value: item.usable ? 'Utilisable avec `/use`' : 'Non utilisable',
                      inline: true
                    }
                  ]
                }
              )
            ],
            components: []
          });
        } catch (error) {
          await client.db.db.run('ROLLBACK');
          throw error;
        }
      }
    } catch (error) {
      console.error('Error handling buy button:', error);
      
      await interaction.update({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement de votre achat.'
          )
        ],
        components: []
      });
    }
  }
};