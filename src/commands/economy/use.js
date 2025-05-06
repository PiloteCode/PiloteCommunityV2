import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Utilisez un objet de votre inventaire')
    .addStringOption(option =>
      option
        .setName('item_id')
        .setDescription('ID de l\'objet à utiliser')
        .setRequired(true)
    ),
  
  // Small cooldown to prevent spam (5 seconds)
  cooldown: 5000,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const itemId = interaction.options.getString('item_id');
      
      // Get user inventory
      const inventory = await client.db.getInventory(userId);
      
      // Find the item in inventory
      const item = inventory.find(item => item.item_id === itemId);
      
      // Check if item exists in inventory
      if (!item) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Objet introuvable',
              `Vous ne possédez pas l'objet avec l'ID \`${itemId}\`.\nUtilisez \`/inventory\` pour voir vos objets.`
            )
          ]
        });
      }
      
      // Check if item is usable
      if (!item.usable) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Objet non utilisable',
              `L'objet "${item.name}" n'est pas utilisable.`
            )
          ]
        });
      }
      
      // Process item use based on its ID
      let result;
      
      switch (itemId) {
        case 'luck_potion':
          // Luck potion: add 30-minute buff that increases earnings
          // This would typically be implemented with a buffs system
          // For now, we'll just simulate the effect with a success message
          result = {
            success: true,
            message: 'Vous avez bu la potion de chance! Vos gains sont augmentés de 25% pendant 30 minutes.',
            consumeItem: true
          };
          break;
          
        case 'mystery_box':
          // Mystery box: random reward (credits, XP, or a random item)
          const randomType = Math.random();
          
          if (randomType < 0.6) {
            // 60% chance: credits (100-500)
            const credits = Math.floor(Math.random() * 401) + 100;
            await client.db.updateUserBalance(userId, credits);
            
            result = {
              success: true,
              message: `Vous avez ouvert la boîte mystère et trouvé **${credits}** crédits!`,
              consumeItem: true
            };
          } else if (randomType < 0.9) {
            // 30% chance: XP (50-100)
            const xp = Math.floor(Math.random() * 51) + 50;
            const xpResult = await client.db.addExperience(userId, xp);
            
            let message = `Vous avez ouvert la boîte mystère et gagné **${xp}** points d'expérience!`;
            
            if (xpResult.leveledUp) {
              message += `\nFélicitations! Vous êtes passé au niveau **${xpResult.newLevel}**!`;
            }
            
            result = {
              success: true,
              message,
              consumeItem: true
            };
          } else {
            // 10% chance: random item
            // For simplicity, we'll give a luck potion
            await client.db.addItemToInventory(userId, 'luck_potion');
            
            result = {
              success: true,
              message: 'Vous avez ouvert la boîte mystère et trouvé une **Potion de chance**!',
              consumeItem: true
            };
          }
          break;
          
        default:
          // Unknown item ID
          result = {
            success: false,
            message: `L'utilisation de l'objet "${item.name}" n'est pas encore implémentée.`
          };
      }
      
      // Consume the item if needed
      if (result.success && result.consumeItem) {
        // Remove 1 from quantity
        if (item.quantity > 1) {
          // Update quantity
          await client.db.db.run(`
            UPDATE inventory
            SET quantity = quantity - 1
            WHERE user_id = ? AND item_id = ?
          `, userId, itemId);
        } else {
          // Remove item completely
          await client.db.db.run(`
            DELETE FROM inventory
            WHERE user_id = ? AND item_id = ?
          `, userId, itemId);
        }
      }
      
      // Send result message
      const embed = result.success
        ? EmbedCreator.success(`Utilisation de ${item.name}`, result.message)
        : EmbedCreator.error(`Échec d'utilisation`, result.message);
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in use command:', error);
      
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