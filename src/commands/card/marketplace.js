import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { MarketplaceManager } from '../../managers/marketplaceManager.js';
import { CardManager } from '../../managers/cardManager.js';
import { RARITIES } from '../../config/cardTypes.js';
import { getUser } from '../../database/manager.js';
import { createPaginationRow } from '../../utils/pagination.js';

export const data = new SlashCommandBuilder()
  .setName('marketplace')
  .setDescription('Accéder au marché des cartes')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Lister une carte à vendre')
      .addStringOption(option =>
        option.setName('card_id')
          .setDescription('ID de la carte à vendre')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('price')
          .setDescription('Prix de vente')
          .setRequired(true)
          .setMinValue(1))
      .addIntegerOption(option =>
        option.setName('quantity')
          .setDescription('Quantité à vendre')
          .setRequired(false)
          .setMinValue(1)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('buy')
      .setDescription('Acheter une carte du marché')
      .addStringOption(option =>
        option.setName('listing_id')
          .setDescription('ID de l\'annonce')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Rechercher des cartes sur le marché')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('Nom de la carte')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('rarity')
          .setDescription('Rareté de la carte')
          .setRequired(false)
          .addChoices(Object.entries(RARITIES).map(([key, value]) => ({
            name: value.name,
            value: key
          }))))
      .addIntegerOption(option =>
        option.setName('max_price')
          .setDescription('Prix maximum')
          .setRequired(false)
          .setMinValue(1)));
          

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
  
    if (subcommand === 'list') {
      const cardId = interaction.options.getString('card_id');
      const price = interaction.options.getInteger('price');
      const quantity = interaction.options.getInteger('quantity') || 1;
  
      try {
        const userCard = await CardManager.getUserCard(interaction.user.id, cardId);
        
        if (!userCard) {
          return interaction.reply({
            content: '❌ Vous ne possédez pas cette carte.',
            ephemeral: true
          });
        }
  
        if (userCard.quantity < quantity) {
          return interaction.reply({
            content: `❌ Vous n'avez que ${userCard.quantity} exemplaire(s) de cette carte.`,
            ephemeral: true
          });
        }
  
        const listing = await MarketplaceManager.createListing(
          interaction.user.id,
          cardId,
          price,
          quantity
        );
  
        const embed = new EmbedBuilder()
          .setTitle('📦 Nouvelle annonce créée')
          .setDescription(`Vous avez mis en vente ${quantity}x ${userCard.name}`)
          .addFields(
            { name: 'Prix unitaire', value: `${price}💵`, inline: true },
            { name: 'Total', value: `${price * quantity}💵`, inline: true },
            { name: 'ID de l\'annonce', value: listing.listing_id.toString() }
          )
          .setColor('#00ff00');
  
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la création de l\'annonce.',
          ephemeral: true
        });
      }
    }
  
    else if (subcommand === 'buy') {
      const listingId = interaction.options.getString('listing_id');
  
      try {
        const listing = await MarketplaceManager.getListing(listingId);
        
        if (!listing) {
          return interaction.reply({
            content: '❌ Cette annonce n\'existe pas.',
            ephemeral: true
          });
        }
  
        if (listing.seller_id === interaction.user.id) {
          return interaction.reply({
            content: '❌ Vous ne pouvez pas acheter votre propre annonce.',
            ephemeral: true
          });
        }
  
        const user = await getUser(interaction.user.id);
        const totalPrice = listing.price * listing.quantity;
  
        if (user.balance < totalPrice) {
          return interaction.reply({
            content: `❌ Vous n'avez pas assez d'argent. Prix total: ${totalPrice}💵`,
            ephemeral: true
          });
        }
  
        await MarketplaceManager.executePurchase(
          listing,
          interaction.user.id
        );
  
        const card = await CardManager.getCardInfo(listing.card_id);
        const embed = new EmbedBuilder()
          .setTitle('🛍️ Achat effectué')
          .setDescription(`Vous avez acheté ${listing.quantity}x ${card.name}`)
          .addFields(
            { name: 'Prix unitaire', value: `${listing.price}💵`, inline: true },
            { name: 'Total payé', value: `${totalPrice}💵`, inline: true }
          )
          .setColor('#00ff00');
  
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de l\'achat.',
          ephemeral: true
        });
      }
    }
  
    else if (subcommand === 'search') {
      const name = interaction.options.getString('name');
      const rarity = interaction.options.getString('rarity');
      const maxPrice = interaction.options.getInteger('max_price');
  
      try {
        const listings = await MarketplaceManager.searchListings(
          name,
          rarity,
          maxPrice
        );
  
        if (listings.length === 0) {
          return interaction.reply({
            content: '❌ Aucune annonce ne correspond à vos critères.',
            ephemeral: true
          });
        }
  
        const pages = [];
        const listingsPerPage = 5;
  
        for (let i = 0; i < listings.length; i += listingsPerPage) {
          const pageListings = listings.slice(i, i + listingsPerPage);
          
          const embed = new EmbedBuilder()
            .setTitle('🏪 Marché des cartes')
            .setColor('#00ff00');
  
          let description = '';
          for (const listing of pageListings) {
            const card = await CardManager.getCardInfo(listing.card_id);
            const rarity = RARITIES[card.rarity];
            
            description += `${rarity.emoji} **${card.name}**\n`;
            description += `┣ Quantité: ${listing.quantity}\n`;
            description += `┣ Prix: ${listing.price}💵/unité\n`;
            description += `┣ Vendeur: ${(await getUser(listing.seller_id)).username}\n`;
            description += `┗ ID: \`${listing.listing_id}\`\n\n`;
          }
  
          embed.setDescription(description);
          embed.setFooter({ 
            text: `Page ${pages.length + 1}/${Math.ceil(listings.length / listingsPerPage)}` 
          });
  
          pages.push(embed);
        }
  
        await interaction.reply({
          embeds: [pages[0]],
          components: pages.length > 1 ? [createPaginationRow()] : [],
          ephemeral: true
        });
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la recherche.',
          ephemeral: true
        });
      }
    }
  }
  
