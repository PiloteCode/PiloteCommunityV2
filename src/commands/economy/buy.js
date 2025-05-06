import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Achetez un objet du magasin')
    .addStringOption(option =>
      option
        .setName('item_id')
        .setDescription('ID de l\'objet à acheter')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('quantite')
        .setDescription('Quantité à acheter (défaut: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),
  
  // Small cooldown to prevent spam (5 seconds)
  cooldown: 5000,
  
  async execute(interaction, client) {
    try {
      // Get purchase details
      const itemId = interaction.options.getString('item_id');
      const quantity = interaction.options.getInteger('quantite') || 1;
      const userId = interaction.user.id;
      
      // Get item details
      const item = await client.db.getShopItem(itemId);
      
      // Check if item exists
      if (!item) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Objet introuvable',
              `L'objet avec l'ID \`${itemId}\` n'existe pas dans la boutique.\nUtilisez \`/shop\` pour voir les objets disponibles.`
            )
          ],
          ephemeral: true
        });
      }
      
      // Check if item is available
      if (!item.available) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Objet indisponible',
              `L'objet "${item.name}" n'est pas disponible à l'achat actuellement.`
            )
          ],
          ephemeral: true
        });
      }
      
      // Get user data
      const user = await client.db.getUser(userId);
      
      // Calculate total cost
      const totalCost = item.price * quantity;
      
      // Check if user has enough credits
      if (user.balance < totalCost) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants',
              `Vous n'avez pas assez de PiloCoins pour acheter ${quantity > 1 ? `${quantity}x ` : ''}${item.name}.\n` +
              `Prix: **${totalCost}** PiloCoins | Votre solde: **${user.balance}** PiloCoins`
            )
          ],
          ephemeral: true
        });
      }
      
      // Create confirmation embed
      const confirmEmbed = EmbedCreator.warning(
        'Confirmation d\'achat',
        `Voulez-vous vraiment acheter ${quantity > 1 ? `**${quantity}x** ` : ''}**${item.name}** pour **${totalCost}** PiloCoins?`,
        {
          fields: [
            {
              name: 'Description',
              value: item.description,
              inline: false
            },
            {
              name: 'Prix unitaire',
              value: `${item.price} PiloCoins`,
              inline: true
            },
            {
              name: 'Quantité',
              value: `${quantity}`,
              inline: true
            },
            {
              name: 'Coût total',
              value: `${totalCost} PiloCoins`,
              inline: true
            },
            {
              name: 'Solde actuel',
              value: `${user.balance} PiloCoins`,
              inline: true
            },
            {
              name: 'Solde après achat',
              value: `${user.balance - totalCost} PiloCoins`,
              inline: true
            }
          ]
        }
      );
      
      // Create confirmation buttons
      const confirmButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`buy:confirm:${userId}:${itemId}:${quantity}`)
            .setLabel('Confirmer')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`buy:cancel:${userId}`)
            .setLabel('Annuler')
            .setStyle(ButtonStyle.Danger)
        );
      
      // Send confirmation message
      await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmButtons],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error in buy command:', error);
      
      // Send error message
      await interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors de l\'exécution de la commande.'
          )
        ],
        ephemeral: true
      });
    }
  }
};