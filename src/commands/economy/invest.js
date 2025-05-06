import { SlashCommandBuilder } = require('discord.js');
import { EmbedCreator } = require('../../utils/embedCreator.js');

export default {
  data: new SlashCommandBuilder()
    .setName('invest')
    .setDescription('Investissez vos crédits pour tenter de les multiplier')
    .addIntegerOption(option =>
      option.setName('montant')
        .setDescription('Montant à investir')
        .setRequired(true)
        .setMinValue(100))
    .addStringOption(option =>
      option.setName('risque')
        .setDescription('Niveau de risque de l\'investissement')
        .setRequired(true)
        .addChoices(
          { name: 'Faible (rendement 5-15%, chance 75%)', value: 'low' },
          { name: 'Moyen (rendement 20-50%, chance 50%)', value: 'medium' },
          { name: 'Élevé (rendement 60-120%, chance 30%)', value: 'high' },
          { name: 'Extrême (rendement 150-300%, chance 10%)', value: 'extreme' }
        )),
  
  cooldown: 1800, // 30 minutes
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const amount = interaction.options.getInteger('montant');
      const riskLevel = interaction.options.getString('risque');
      
      // Récupérer les données de l'utilisateur
      const user = await client.db.getUser(interaction.user.id);
      
      // Vérifier si l'utilisateur a assez de crédits
      if (user.balance < amount) {
        const errorEmbed = EmbedCreator.error(
          'Fonds insuffisants',
          `Vous n'avez pas assez de crédits pour investir ${amount}. Solde actuel: ${user.balance} crédits.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      
      // Définir les paramètres en fonction du niveau de risque
      const riskParams = {
        low: { minReturn: 5, maxReturn: 15, successRate: 75 },
        medium: { minReturn: 20, maxReturn: 50, successRate: 50 },
        high: { minReturn: 60, maxReturn: 120, successRate: 30 },
        extreme: { minReturn: 150, maxReturn: 300, successRate: 10 }
      };
      
      const params = riskParams[riskLevel];
      
      // Déterminer si l'investissement est réussi
      const isSuccessful = Math.random() * 100 < params.successRate;
      
      if (isSuccessful) {
        // Calculer le rendement
        const returnRate = (Math.random() * (params.maxReturn - params.minReturn)) + params.minReturn;
        const profit = Math.floor(amount * (returnRate / 100));
        const newBalance = user.balance + profit;
        
        // Mettre à jour le solde de l'utilisateur
        await client.db.updateUserBalance(interaction.user.id, profit);
        
        // Générer un message de réussite aléatoire
        const successMessages = [
          "Votre investissement a porté ses fruits!",
          "Le marché a évolué en votre faveur!",
          "Vos actions ont connu une hausse inattendue!",
          "Votre pari sur les marchés s'est avéré payant!",
          "Votre analyse économique était correcte!"
        ];
        
        const randomMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
        
        // Créer l'embed de réussite
        const successEmbed = EmbedCreator.success(
          '📈 Investissement réussi!',
          `${randomMessage} Vous avez gagné **${profit} crédits** (${returnRate.toFixed(1)}% de rendement).`,
          {
            fields: [
              {
                name: '💰 Investissement initial',
                value: `${amount} crédits`,
                inline: true
              },
              {
                name: '💵 Profit',
                value: `+${profit} crédits`,
                inline: true
              },
              {
                name: '🏦 Nouveau solde',
                value: `${newBalance} crédits`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [successEmbed] });
      } else {
        // L'investissement a échoué, l'utilisateur perd son argent
        await client.db.updateUserBalance(interaction.user.id, -amount);
        
        // Générer un message d'échec aléatoire
        const failMessages = [
          "Le marché s'est effondré juste après votre investissement!",
          "Une crise économique soudaine a dévalué vos actions!",
          "Votre entreprise a fait faillite suite à un scandale!",
          "Une nouvelle réglementation a impacté négativement votre investissement!",
          "Votre conseiller financier était un escroc!"
        ];
        
        const randomMessage = failMessages[Math.floor(Math.random() * failMessages.length)];
        
        // Créer l'embed d'échec
        const failEmbed = EmbedCreator.error(
          '📉 Investissement échoué!',
          `${randomMessage} Vous avez perdu votre investissement de **${amount} crédits**.`,
          {
            fields: [
              {
                name: '💸 Perte',
                value: `-${amount} crédits`,
                inline: true
              },
              {
                name: '🏦 Nouveau solde',
                value: `${user.balance - amount} crédits`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [failEmbed] });
      }
      
    } catch (error) {
      console.error('Error in invest command:', error);
      
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