import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'give',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, senderId, recipientId, amount] = extraData;
      
      // Verify that the user who clicked is the one who initiated
      if (interaction.user.id !== senderId) {
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
              'Transfert annulé',
              'Vous avez annulé le transfert de crédits.'
            )
          ],
          components: []
        });
        return;
      }
      
      // Handle confirm action
      if (action === 'confirm') {
        // Parse amount
        const parsedAmount = parseInt(amount);
        
        // Get sender data to verify funds
        const sender = await client.db.getUser(senderId);
        
        // Check if sender still has enough credits
        if (sender.balance < parsedAmount) {
          return interaction.update({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous n'avez pas assez de crédits pour ce transfert.\nVotre solde: **${sender.balance}** crédits`
              )
            ],
            components: []
          });
        }
        
        // Process the transfer
        await client.db.db.run('BEGIN TRANSACTION');
        
        try {
          // Deduct credits from sender
          await client.db.updateUserBalance(senderId, -parsedAmount);
          
          // Add credits to recipient
          await client.db.updateUserBalance(recipientId, parsedAmount);
          
          await client.db.db.run('COMMIT');
          
          // Try to fetch username
          let recipientName;
          try {
            const recipientUser = await client.users.fetch(recipientId);
            recipientName = recipientUser.username;
          } catch (error) {
            recipientName = recipientId;
          }
          
          // Send success message
          await interaction.update({
            embeds: [
              EmbedCreator.success(
                'Transfert réussi',
                `Vous avez donné **${parsedAmount}** crédits à <@${recipientId}>.`,
                {
                  fields: [
                    {
                      name: 'Votre nouveau solde',
                      value: `**${sender.balance - parsedAmount}** crédits`,
                      inline: true
                    }
                  ]
                }
              )
            ],
            components: []
          });
          
          // Try to notify recipient
          try {
            const recipientUser = await client.users.fetch(recipientId);
            
            await recipientUser.send({
              embeds: [
                EmbedCreator.success(
                  '💰 Crédits reçus',
                  `<@${senderId}> vous a donné **${parsedAmount}** crédits!`
                )
              ]
            }).catch(() => {
              // Ignore if DMs are closed
            });
          } catch (error) {
            // Ignore error if user can't be messaged
            console.warn(`Could not notify user ${recipientId} about credit transfer:`, error);
          }
        } catch (error) {
          await client.db.db.run('ROLLBACK');
          throw error;
        }
      }
    } catch (error) {
      console.error('Error handling give button:', error);
      
      await interaction.update({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement de votre transfert.'
          )
        ],
        components: []
      });
    }
  }
};