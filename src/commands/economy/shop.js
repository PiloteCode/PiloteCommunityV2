import { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    EmbedBuilder 
  } from 'discord.js';
  import { getShopItems, getUser } from '../../database/manager.js';
  
  export const data = new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Accéder à la boutique du serveur');
  
  export async function execute(interaction) {
    const shopItems = await getShopItems();
    const userData = await getUser(interaction.user.id);
  
    const shopEmbed = new EmbedBuilder()
      .setTitle('🛍️ Boutique du serveur')
      .setDescription(`Votre solde: ${userData.balance}💵`)
      .setColor('#00ff00');
  
    // Grouper les items par type
    const itemsByType = shopItems.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {});
  
    Object.entries(itemsByType).forEach(([type, items]) => {
      const itemsList = items.map(item => 
        `${item.name} - ${item.price}💵\n*${item.description}*`
      ).join('\n\n');
      
      shopEmbed.addFields({ 
        name: type.charAt(0).toUpperCase() + type.slice(1), 
        value: itemsList 
      });
    });
  
    // Créer le menu de sélection
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_buy')
      .setPlaceholder('Sélectionner un item à acheter')
      .addOptions(
        shopItems.map(item => ({
          label: item.name,
          description: `${item.price}💵`,
          value: item.item_id
        }))
      );
  
    const row = new ActionRowBuilder().addComponents(selectMenu);
  
    await interaction.reply({
      embeds: [shopEmbed],
      components: [row],
      ephemeral: true
    });
  }