import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('Donnez des crédits à un autre utilisateur')
    .addUserOption(option =>
      option
        .setName('utilisateur')
        .setDescription('Utilisateur à qui donner des crédits')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('montant')
        .setDescription('Montant à donner')
        .setRequired(true)
        .setMinValue(1)
    ),
  
  // Cooldown of 30 seconds to prevent spam
  cooldown: 30000,
  
  async execute(interaction, client) {
    try {
      // Get parameters
      const recipient = interaction.options.getUser('utilisateur');
      const amount = interaction.options.getInteger('montant');
      const senderId = interaction.user.id;
      
      // Prevent giving to self
      if (recipient.id === senderId) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Transaction impossible',
              'Vous ne pouvez pas vous donner des crédits à vous-même.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Prevent giving to bots
      if (recipient.bot) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Transaction impossible',
              'Vous ne pouvez pas donner des crédits à un bot.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Get sender data
      const sender = await client.db.getUser(senderId);
      
      // Check if sender has enough credits
      if (sender.balance < amount) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants',
              `Vous n'avez pas assez de crédits pour cette transaction.\nVotre solde: **${sender.balance}** crédits`
            )
          ],
          ephemeral: true
        });
      }
      
      // Create confirmation message
      const confirmEmbed = EmbedCreator.warning(
        'Confirmation de transfert',
        `Êtes-vous sûr de vouloir donner **${amount}** crédits à <@${recipient.id}>?`,
        {
          fields: [
            {
              name: 'Votre solde actuel',
              value: `${sender.balance} crédits`,
              inline: true
            },
            {
              name: 'Solde après transfert',
              value: `${sender.balance - amount} crédits`,
              inline: true
            }
          ],
          footer: {
            text: 'Ce transfert est définitif et ne peut pas être annulé.',
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          }
        }
      );
      
      // Create confirmation buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`give:confirm:${senderId}:${recipient.id}:${amount}`)
            .setLabel('Confirmer')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`give:cancel:${senderId}`)
            .setLabel('Annuler')
            .setStyle(ButtonStyle.Danger)
        );
      
      // Send confirmation message
      await interaction.reply({
        embeds: [confirmEmbed],
        components: [buttons],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error in give command:', error);
      
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