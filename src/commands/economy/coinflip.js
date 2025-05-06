import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Pariez sur le résultat d\'un lancer de pièce')
    .addIntegerOption(option =>
      option
        .setName('montant')
        .setDescription('Montant à parier')
        .setRequired(true)
        .setMinValue(10)
    ),
  
  // Cooldown of 30 seconds to prevent spam
  cooldown: 30000,
  
  async execute(interaction, client) {
    try {
      // Get parameters
      const amount = interaction.options.getInteger('montant');
      const userId = interaction.user.id;
      
      // Get user data
      const user = await client.db.getUser(userId);
      
      // Check if user has enough credits
      if (user.balance < amount) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants',
              `Vous n'avez pas assez de crédits pour ce pari.\nVotre solde: **${user.balance}** crédits`
            )
          ],
          ephemeral: true
        });
      }
      
      // Create betting message
      const betEmbed = EmbedCreator.economy(
        'Pile ou Face',
        `<@${userId}> parie **${amount}** crédits.\nChoisissez pile ou face:`,
        {
          thumbnail: 'https://i.imgur.com/mE5MLPJ.png', // Coin image
          fields: [
            {
              name: 'Récompense potentielle',
              value: `**${amount * 2}** crédits`,
              inline: true
            },
            {
              name: 'Votre solde',
              value: `**${user.balance}** crédits`,
              inline: true
            }
          ]
        }
      );
      
      // Create choice buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`coinflip:heads:${userId}:${amount}`)
            .setLabel('Pile')
            .setEmoji('🔴')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`coinflip:tails:${userId}:${amount}`)
            .setLabel('Face')
            .setEmoji('🔵')
            .setStyle(ButtonStyle.Primary)
        );
      
      // Send choice message
      await interaction.reply({
        embeds: [betEmbed],
        components: [buttons]
      });
      
    } catch (error) {
      console.error('Error in coinflip command:', error);
      
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