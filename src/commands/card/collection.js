import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CardManager } from '../../managers/cardManager.js';
import { RARITIES } from '../../config/cardTypes.js';
import { createPaginationRow } from '../../utils/pagination.js';

export const data = new SlashCommandBuilder()
  .setName('collection')
  .setDescription('Gérer votre collection de cartes')
  .addSubcommand(subcommand =>
    subcommand
      .setName('voir')
      .setDescription('Voir votre collection ou celle d\'un autre joueur')
      .addUserOption(option =>
        option
          .setName('utilisateur')
          .setDescription('Utilisateur dont vous voulez voir la collection')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('rarity')
          .setDescription('Filtrer par rareté')
          .setRequired(false)
          .addChoices(Object.entries(RARITIES).map(([key, value]) => ({
            name: value.name,
            value: key
          }))))
      .addStringOption(option =>
        option
          .setName('theme')
          .setDescription('Filtrer par thème')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('favorite')
      .setDescription('Marquer une carte comme favorite')
      .addStringOption(option =>
        option
          .setName('card_id')
          .setDescription('ID de la carte')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('Voir les détails d\'une carte')
      .addStringOption(option =>
        option
          .setName('card_id')
          .setDescription('ID de la carte')
          .setRequired(true)));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'voir') {
    const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
    const rarityFilter = interaction.options.getString('rarity');
    const themeFilter = interaction.options.getString('theme');

    const cards = await CardManager.getUserCards(targetUser.id, rarityFilter, themeFilter);
    
    // Création des pages pour la pagination
    const cardsPerPage = 10;
    const pages = [];
    
    for (let i = 0; i < cards.length; i += cardsPerPage) {
      const pageCards = cards.slice(i, i + cardsPerPage);
      
      const embed = new EmbedBuilder()
        .setTitle(`📚 Collection de ${targetUser.username}`)
        .setColor('#0099ff')
        .setThumbnail(targetUser.displayAvatarURL());

      let description = '';
      pageCards.forEach(card => {
        const rarity = RARITIES[card.rarity];
        description += `${rarity.emoji} **${card.name}** (x${card.quantity})\n`;
        description += `┗ ID: \`${card.card_id}\` • Puissance: ${card.power_level}\n`;
      });

      embed.setDescription(description);
      embed.setFooter({ text: `Page ${pages.length + 1}/${Math.ceil(cards.length / cardsPerPage)}` });
      
      pages.push(embed);
    }

    // Envoi du message avec pagination
    await interaction.reply({
      embeds: [pages[0]],
      components: pages.length > 1 ? [createPaginationRow()] : [],
      ephemeral: true
    });
  }
  if (subcommand === 'favorite') {
    const cardId = interaction.options.getString('card_id');
    
    try {
      const card = await CardManager.getUserCard(interaction.user.id, cardId);
      
      if (!card) {
        return interaction.reply({
          content: '❌ Vous ne possédez pas cette carte.',
          ephemeral: true
        });
      }

      await CardManager.toggleFavorite(interaction.user.id, cardId);
      const isFavorite = !card.is_favorite;

      const embed = new EmbedBuilder()
        .setTitle(`${isFavorite ? '⭐' : '❌'} Favori mis à jour`)
        .setDescription(`La carte ${card.name} a été ${isFavorite ? 'ajoutée aux' : 'retirée des'} favoris.`)
        .setColor(isFavorite ? '#f1c40f' : '#e74c3c');

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        ephemeral: true
      });
    }
  }

  else if (subcommand === 'info') {
    const cardId = interaction.options.getString('card_id');
    
    try {
      const card = await CardManager.getCardInfo(cardId);
      
      if (!card) {
        return interaction.reply({
          content: '❌ Cette carte n\'existe pas.',
          ephemeral: true
        });
      }

      const rarity = RARITIES[card.rarity];
      const embed = new EmbedBuilder()
        .setTitle(`${rarity.emoji} ${card.name}`)
        .setDescription(card.description)
        .setColor(rarity.color)
        .addFields(
          { name: 'Rareté', value: rarity.name, inline: true },
          { name: 'Puissance', value: card.power_level.toString(), inline: true },
          { name: 'Collection', value: card.collection, inline: true },
          { name: 'Thème', value: card.theme, inline: true },
          { name: 'Prix de base', value: `${card.base_price}💵`, inline: true }
        );

      if (card.special_effect) {
        embed.addFields({ 
          name: '✨ Effet spécial', 
          value: card.special_effect 
        });
      }

      // Statistiques du marché
      const marketStats = await CardManager.getMarketStats(cardId);
      if (marketStats) {
        embed.addFields({
          name: '📊 Statistiques du marché',
          value: `Prix moyen: ${marketStats.avgPrice}💵\nDernière vente: ${marketStats.lastSold}💵\nEn vente: ${marketStats.listings}`
        });
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        ephemeral: true
      });
    }
  }
}
