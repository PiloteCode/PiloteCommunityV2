import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { PACK_TYPES, RARITIES } from '../../config/cardTypes.js';
import { EMBED_COLORS, LIMITS } from '../../config/constants.js';
import { CardManager } from '../../managers/cardManager.js';
import { getUser, updateUser } from '../../database/manager.js';


export const data = new SlashCommandBuilder()
  .setName('packs')
  .setDescription('Gérer vos packs de cartes')
  .addSubcommand(subcommand =>
    subcommand
      .setName('buy')
      .setDescription('Acheter des packs de cartes')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Type de pack à acheter')
          .setRequired(true)
          .addChoices(...Object.entries(PACK_TYPES).map(([key, pack]) => ({
            name: pack.name,
            value: key
          }))))
      .addIntegerOption(option =>
        option
          .setName('quantity')
          .setDescription('Nombre de packs à acheter')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(LIMITS.MAX_PACKS_PURCHASE)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('open')
      .setDescription('Ouvrir un pack')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Type de pack à ouvrir')
          .setRequired(true)
          .addChoices(...Object.entries(PACK_TYPES).map(([key, pack]) => ({
            name: pack.name,
            value: key
          })))))
  .addSubcommand(subcommand =>
    subcommand
      .setName('inventory')
      .setDescription('Voir vos packs non ouverts'));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'buy') {
    const packType = interaction.options.getString('type');
    const quantity = interaction.options.getInteger('quantity') || 1;
    const pack = PACK_TYPES[packType];
    const totalPrice = pack.price * quantity;

    try {
      const user = await getUser(interaction.user.id);

      if (user.balance < totalPrice) {
        return interaction.reply({
          content: `❌ Vous n'avez pas assez de pièces. Prix total: ${totalPrice}💵`,
          ephemeral: true
        });
      }

      await updateUser(user.user_id, {
        balance: user.balance - totalPrice
      });

      await CardManager.addPacksToUser(user.user_id, packType, quantity);

      const embed = new EmbedBuilder()
        .setTitle('🎁 Achat de packs')
        .setDescription(`Vous avez acheté ${quantity}x ${pack.name}`)
        .addFields(
          { name: 'Prix unitaire', value: `${pack.price}💵`, inline: true },
          { name: 'Total payé', value: `${totalPrice}💵`, inline: true },
          { name: 'Utilisation', value: 'Utilisez `/packs open` pour ouvrir vos packs!' }
        )
        .setColor(EMBED_COLORS.SUCCESS);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        ephemeral: true
      });
    }
  }

  else if (subcommand === 'open') {
    const packType = interaction.options.getString('type');
    const pack = PACK_TYPES[packType];

    try {
      await interaction.deferReply();

      const userPacks = await CardManager.getUserPacks(interaction.user.id);
      const packInfo = userPacks.find(p => p.pack_type === packType);

      if (!packInfo || packInfo.quantity < 1) {
        return interaction.editReply({
          content: `❌ Vous n'avez pas de ${pack.name} à ouvrir!`,
          ephemeral: true
        });
      }

      // Animation d'ouverture
      const openingEmbed = new EmbedBuilder()
        .setTitle('📦 Ouverture de pack')
        .setDescription('*Le pack s\'ouvre...*')
        .setColor(EMBED_COLORS.DEFAULT);

      await interaction.editReply({ 
        embeds: [openingEmbed]
      });

      // Obtention des cartes
      const cards = await CardManager.openPack(interaction.user.id, packType);

      // Création des embeds pour chaque carte (effet dramatique)
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const rarity = RARITIES[card.rarity];
        
        const cardEmbed = new EmbedBuilder()
          .setTitle(`${rarity.emoji} ${card.name}`)
          .setDescription(card.description)
          .setColor(rarity.color)
          .addFields(
            { name: 'Rareté', value: rarity.name, inline: true },
            { name: 'Puissance', value: card.power_level.toString(), inline: true }
          );

        if (card.is_animated) {
          cardEmbed.setTitle(`✨ ${rarity.emoji} ${card.name} (Animée)`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        await interaction.editReply({ embeds: [cardEmbed] });
      }

      // Résumé final
      const summaryEmbed = new EmbedBuilder()
        .setTitle('🎉 Pack ouvert!')
        .setDescription('Voici un résumé de vos nouvelles cartes:')
        .setColor(EMBED_COLORS.SUCCESS);

      const cardsGrouped = cards.reduce((acc, card) => {
        const rarity = RARITIES[card.rarity];
        if (!acc[card.rarity]) acc[card.rarity] = [];
        acc[card.rarity].push(`${rarity.emoji} ${card.name}`);
        return acc;
      }, {});

      Object.entries(cardsGrouped).forEach(([rarity, cardNames]) => {
        summaryEmbed.addFields({
          name: RARITIES[rarity].name,
          value: cardNames.join('\n'),
          inline: false
        });
      });

      // Vérifier les cartes spéciales
      const specialCards = cards.filter(card => 
        card.is_animated || ['DIVINE', 'MYTHIC', 'LEGENDARY'].includes(card.rarity)
      );

      if (specialCards.length > 0) {
        summaryEmbed.addFields({
          name: '✨ Cartes spéciales obtenues!',
          value: specialCards.map(card => 
            `${RARITIES[card.rarity].emoji} ${card.name}${card.is_animated ? ' (Animée)' : ''}`
          ).join('\n'),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [summaryEmbed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Erreur: ${error.message}`,
        ephemeral: true
      });
    }
  }

  else if (subcommand === 'inventory') {
    try {
      const userPacks = await CardManager.getUserPacks(interaction.user.id);
      
      if (userPacks.length === 0) {
        return interaction.reply({
          content: 'Vous n\'avez aucun pack non ouvert',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎒 Vos packs')
        .setDescription('Voici vos packs non ouverts:')
        .setColor(EMBED_COLORS.INFO);

      userPacks.forEach(userPack => {
        const pack = PACK_TYPES[userPack.pack_type];
        embed.addFields({
          name: pack.name,
          value: `Quantité: ${userPack.quantity}\n` +
                 `Cartes par pack: ${pack.cards}\n` +
                 `Prix: ${pack.price}💵`,
          inline: true
        });
      });

      // Ajouter des stats
      const totalPacks = userPacks.reduce((sum, p) => sum + p.quantity, 0);
      const totalValue = userPacks.reduce((sum, p) => 
        sum + (PACK_TYPES[p.pack_type].price * p.quantity), 0
      );

      embed.addFields(
        { name: 'Total des packs', value: totalPacks.toString(), inline: true },
        { name: 'Valeur totale', value: `${totalValue}💵`, inline: true }
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        ephemeral: true
      });
    }
  }
}