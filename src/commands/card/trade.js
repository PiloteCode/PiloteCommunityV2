import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { TradeManager } from '../../managers/tradeManager.js';
import { CardManager } from '../../managers/cardManager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Système d\'échange de cartes')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Créer un nouvel échange')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('Utilisateur avec qui échanger')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('cards')
          .setDescription('IDs des cartes à échanger (séparés par des virgules)')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('coins')
          .setDescription('Montant de pièces à offrir')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('accept')
      .setDescription('Accepter un échange')
      .addStringOption(option =>
        option.setName('trade_id')
          .setDescription('ID de l\'échange')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('cancel')
      .setDescription('Annuler un échange')
      .addStringOption(option =>
        option.setName('trade_id')
          .setDescription('ID de l\'échange')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Voir vos échanges en cours'));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'create') {
    const targetUser = interaction.options.getUser('user');
    const cardsInput = interaction.options.getString('cards');
    const coinsOffered = interaction.options.getInteger('coins') || 0;

    try {
      const cardsList = cardsInput.split(',').map(card => ({
        card_id: card.trim(),
        quantity: 1
      }));

      const trade = await TradeManager.createTrade(
        interaction.user.id,
        targetUser.id,
        cardsList,
        [],
        coinsOffered
      );

      const embed = new EmbedBuilder()
        .setTitle('🤝 Nouvel échange proposé')
        .setDescription(`Échange créé avec ${targetUser.username}`)
        .addFields(
          { name: 'ID de l\'échange', value: trade.trade_id.toString() },
          { name: 'Cartes offertes', value: cardsInput },
          { name: 'Pièces offertes', value: `${coinsOffered}💵` }
        )
        .setColor(EMBED_COLORS.INFO);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        ephemeral: true
      });
    }
  }

  else if (subcommand === 'accept') {
    const tradeId = interaction.options.getString('trade_id');

    try {
      const trade = await TradeManager.getTrade(tradeId);
      
      if (!trade) {
        return interaction.reply({
          content: '❌ Échange introuvable',
          ephemeral: true
        });
      }

      if (trade.receiver_id !== interaction.user.id) {
        return interaction.reply({
          content: '❌ Cet échange ne vous est pas destiné',
          ephemeral: true
        });
      }

      await TradeManager.acceptTrade(tradeId, interaction.user.id);

      const sender = await interaction.client.users.fetch(trade.sender_id);
      const embed = new EmbedBuilder()
        .setTitle('✅ Échange accepté')
        .setDescription(`Échange complété avec ${sender.username}`)
        .setColor(EMBED_COLORS.SUCCESS);

      await interaction.reply({ embeds: [embed] });
      
      // Notifier l'autre utilisateur
      try {
        await sender.send(`🤝 ${interaction.user.username} a accepté votre échange (ID: ${tradeId})`);
      } catch (error) {
        console.warn('Impossible d\'envoyer un DM à l\'utilisateur:', error);
      }
    } catch (error) {
      await interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        ephemeral: true
      });
    }
  }

  else if (subcommand === 'cancel') {
    const tradeId = interaction.options.getString('trade_id');

    try {
      await TradeManager.cancelTrade(tradeId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle('🚫 Échange annulé')
        .setDescription(`L'échange ${tradeId} a été annulé`)
        .setColor(EMBED_COLORS.ERROR);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        ephemeral: true
      });
    }
  }

  else if (subcommand === 'list') {
    try {
      const trades = await TradeManager.getUserTrades(interaction.user.id);
      
      if (trades.length === 0) {
        return interaction.reply({
          content: 'Vous n\'avez aucun échange en cours',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Vos échanges en cours')
        .setColor(EMBED_COLORS.INFO);

      for (const trade of trades) {
        const otherUser = await interaction.client.users.fetch(
          trade.sender_id === interaction.user.id ? trade.receiver_id : trade.sender_id
        );

        const senderCards = JSON.parse(trade.sender_cards);
        const receiverCards = JSON.parse(trade.receiver_cards);

        embed.addFields({
          name: `ID: ${trade.trade_id}`,
          value: `Avec: ${otherUser.username}\n` +
                 `Cartes offertes: ${senderCards.map(c => c.card_id).join(', ')}\n` +
                 `Cartes demandées: ${receiverCards.map(c => c.card_id).join(', ')}\n` +
                 `Pièces offertes: ${trade.coins_offered}💵\n` +
                 `Expire: <t:${Math.floor(new Date(trade.expires_at).getTime() / 1000)}:R>`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: `❌ Erreur: ${error.message}`,
        ephemeral: true
      });
    }
  }
}