import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'credits_rain',
  
  async execute(interaction, client, extraData) {
    try {
      const [action, amount] = extraData;
      
      // Handle collect credits action
      if (action === 'collect') {
        const userId = interaction.user.id;
        const credits = parseInt(amount);
        
        // Store collected buttons to prevent double-collection
        if (!client.collectedButtons) {
          client.collectedButtons = new Map();
        }
        
        // Create a unique key for this button in this message
        const buttonKey = `${interaction.message.id}:${interaction.customId}`;
        
        // Check if the user already collected this button
        if (client.collectedButtons.has(buttonKey)) {
          const collectors = client.collectedButtons.get(buttonKey);
          if (collectors.includes(userId)) {
            return interaction.reply({
              content: 'Vous avez déjà récupéré ces crédits!',
              ephemeral: true
            });
          }
          
          // Add this user to the collectors
          collectors.push(userId);
        } else {
          // First collector for this button
          client.collectedButtons.set(buttonKey, [userId]);
        }
        
        // Award credits to the user
        await client.db.updateUserBalance(userId, credits);
        
        // Add a small amount of XP
        const xpAmount = Math.floor(Math.random() * 3) + 1; // 1-3 XP
        await client.db.addExperience(userId, xpAmount);
        
        // Acknowledge collection
        await interaction.reply({
          content: `Vous avez récupéré **${credits}** crédits!`,
          ephemeral: true
        });
        
        // Get list of collectors for this button
        const collectors = client.collectedButtons.get(buttonKey) || [];
        
        // If many people have already collected this button, disable it
        if (collectors.length >= 5) {
          try {
            // Try to update the message to disable this specific button
            const message = interaction.message;
            const components = message.components;
            
            // Find and disable the specific button
            for (const row of components) {
              for (const component of row.components) {
                if (component.customId === interaction.customId) {
                  component.disabled = true;
                  component.label = 'Épuisé!';
                }
              }
            }
            
            // Update the message
            await message.edit({
              components: components
            });
          } catch (editError) {
            console.error('Error disabling collected button:', editError);
          }
        }
      }
    } catch (error) {
      console.error('Error handling credits rain button:', error);
      
      await interaction.reply({
        content: 'Une erreur est survenue lors de la récupération des crédits.',
        ephemeral: true
      }).catch(console.error);
    }
  }
};