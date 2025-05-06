import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Lancez des dés et pariez sur le résultat')
    .addSubcommand(subcommand =>
      subcommand
        .setName('simple')
        .setDescription('Lancez un simple dé')
        .addIntegerOption(option =>
          option
            .setName('faces')
            .setDescription('Nombre de faces du dé (par défaut: 6)')
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('multiple')
        .setDescription('Lancez plusieurs dés')
        .addIntegerOption(option =>
          option
            .setName('nombre')
            .setDescription('Nombre de dés à lancer (par défaut: 2)')
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(10)
        )
        .addIntegerOption(option =>
          option
            .setName('faces')
            .setDescription('Nombre de faces des dés (par défaut: 6)')
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bet')
        .setDescription('Pariez sur le résultat d\'un lancer de dés')
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Montant à parier')
            .setRequired(true)
            .setMinValue(10)
        )
        .addIntegerOption(option =>
          option
            .setName('nombre')
            .setDescription('Nombre sur lequel vous pariez (2-12 pour 2d6)')
            .setRequired(true)
            .setMinValue(2)
            .setMaxValue(12)
        )
    ),
  
  // Cooldown of 10 seconds
  cooldown: 10000,
  
  async execute(interaction, client) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      // Simple dice roll
      if (subcommand === 'simple') {
        const faces = interaction.options.getInteger('faces') || 6;
        
        // Roll the die
        const result = Math.floor(Math.random() * faces) + 1;
        
        // Create the embed
        const embed = EmbedCreator.create({
          title: '🎲 Lancer de dé',
          description: `<@${interaction.user.id}> lance un dé à ${faces} faces...`,
          color: 'PRIMARY',
          fields: [
            {
              name: 'Résultat',
              value: `**${result}**`,
              inline: true
            }
          ],
          timestamp: true
        });
        
        await interaction.reply({ embeds: [embed] });
      }
      
      // Multiple dice roll
      else if (subcommand === 'multiple') {
        const count = interaction.options.getInteger('nombre') || 2;
        const faces = interaction.options.getInteger('faces') || 6;
        
        // Roll the dice
        const rolls = [];
        let total = 0;
        
        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * faces) + 1;
          rolls.push(roll);
          total += roll;
        }
        
        // Create the embed
        const embed = EmbedCreator.create({
          title: '🎲 Lancer de dés',
          description: `<@${interaction.user.id}> lance ${count} dés à ${faces} faces...`,
          color: 'PRIMARY',
          fields: [
            {
              name: 'Résultats',
              value: rolls.map((roll, index) => `Dé ${index + 1}: **${roll}**`).join('\n'),
              inline: true
            },
            {
              name: 'Total',
              value: `**${total}**`,
              inline: true
            }
          ],
          timestamp: true
        });
        
        await interaction.reply({ embeds: [embed] });
      }
      
      // Betting on dice roll
      else if (subcommand === 'bet') {
        const betAmount = interaction.options.getInteger('montant');
        const betNumber = interaction.options.getInteger('nombre');
        const userId = interaction.user.id;
        
        // Get user data
        const user = await client.db.getUser(userId);
        
        // Check if user has enough credits
        if (user.balance < betAmount) {
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
        
        // Create initial embed
        const initialEmbed = EmbedCreator.create({
          title: '🎲 Pari sur dés',
          description: `<@${userId}> parie **${betAmount}** crédits que deux dés donneront un total de **${betNumber}**.`,
          color: 'PRIMARY',
          fields: [
            {
              name: 'Chances de gagner',
              value: this.getOdds(betNumber),
              inline: true
            },
            {
              name: 'Gain potentiel',
              value: `**${this.calculateWinnings(betAmount, betNumber)}** crédits`,
              inline: true
            }
          ],
          timestamp: true
        });
        
        // Create roll button
        const rollButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`dice:roll:${userId}:${betAmount}:${betNumber}`)
              .setLabel('Lancer les dés')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎲')
          );
        
        await interaction.reply({
          embeds: [initialEmbed],
          components: [rollButton]
        });
      }
      
    } catch (error) {
      console.error('Error in dice command:', error);
      
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
  },
  
  // Helper method to calculate win odds
  getOdds(number) {
    // For two 6-sided dice, odds are:
    const odds = {
      2: '1/36 (2.78%)',
      3: '2/36 (5.56%)',
      4: '3/36 (8.33%)',
      5: '4/36 (11.11%)',
      6: '5/36 (13.89%)',
      7: '6/36 (16.67%)',
      8: '5/36 (13.89%)',
      9: '4/36 (11.11%)',
      10: '3/36 (8.33%)',
      11: '2/36 (5.56%)',
      12: '1/36 (2.78%)'
    };
    
    return odds[number] || 'Inconnues';
  },
  
  // Helper method to calculate winnings based on odds
  calculateWinnings(betAmount, number) {
    // Define multipliers based on probability
    const multipliers = {
      2: 15,  // ~36x payout with 1/36 odds, but we want to keep it reasonable
      3: 12,
      4: 10,
      5: 8,
      6: 6,
      7: 5,
      8: 6,
      9: 8,
      10: 10,
      11: 12,
      12: 15
    };
    
    return betAmount * (multipliers[number] || 5);
  }
};