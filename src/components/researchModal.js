import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  // custom ID patterns:
  // - research-boost-modal:businessId:researchId
  // - research-start-modal:businessId:researchId
  customId: 'research-modal',
  
  async execute(interaction, client) {
    try {
      // Parse the custom ID
      const customId = interaction.customId;
      const userId = interaction.user.id;
      
      // Récupérer le gestionnaire d'entreprise et le système de recherche
      const manager = client.businessManager;
      const researchSystem = client.researchSystem;
      
      if (!manager || !researchSystem) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur système',
              'Les systèmes requis ne sont pas initialisés.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Traiter les différents modals
      if (customId.startsWith('research-boost-modal:')) {
        await handleResearchBoostModal(interaction, client, manager, researchSystem, userId);
      }
      else if (customId.startsWith('research-start-modal:')) {
        await handleResearchStartModal(interaction, client, manager, researchSystem, userId);
      }
      
    } catch (error) {
      console.error('Error in research modal:', error);
      
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors du traitement du formulaire.'
          )
        ],
        ephemeral: true
      });
    }
  }
};

/**
 * Gère le modal d'accélération de recherche
 */
async function handleResearchBoostModal(interaction, client, manager, researchSystem, userId) {
  await interaction.deferReply();
  
  try {
    // Extraire les informations du customId
    const parts = interaction.customId.split(':');
    const businessId = parts[1];
    const researchId = parts[2];
    
    // Extraire le montant du boost
    const boostAmount = parseInt(interaction.fields.getTextInputValue('boostAmount'));
    
    // Vérifier que le montant est valide
    if (isNaN(boostAmount) || boostAmount < 100) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Montant invalide',
            'Le montant du boost doit être d\'au moins 100 PiloCoins.'
          )
        ]
      });
    }
    
    // Récupérer l'entreprise
    const business = await manager.getBusinessById(businessId);
    if (!business) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Entreprise introuvable',
            'Cette entreprise n\'existe plus.'
          )
        ]
      });
    }
    
    // Vérifier que la recherche est en cours
    if (!researchSystem.isResearchInProgress(businessId, researchId)) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Recherche non active',
            'Cette recherche n\'est pas en cours actuellement.'
          )
        ]
      });
    }
    
    // Accélérer la recherche
    const result = await researchSystem.boostResearch(businessId, researchId, boostAmount, userId);
    
    // Créer l'embed de confirmation
    const newCompletionDate = new Date(result.new_completion_time);
    const embed = EmbedCreator.success(
      '🚀 Recherche accélérée!',
      `Vous avez accéléré la recherche **${result.name}** avec un investissement supplémentaire.`,
      {
        fields: [
          {
            name: '💰 Investissement',
            value: `${result.boost_amount} PiloCoins`,
            inline: true
          },
          {
            name: '⏱️ Réduction de temps',
            value: `${result.time_reduction} minutes`,
            inline: true
          },
          {
            name: '📅 Nouvelle fin estimée',
            value: `<t:${Math.floor(newCompletionDate.getTime() / 1000)}:R>`,
            inline: true
          }
        ]
      }
    );
    
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`research:active:${businessId}`)
          .setLabel('Voir recherches en cours')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏳')
      );
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling research boost modal:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère le modal de démarrage de recherche
 */
async function handleResearchStartModal(interaction, client, manager, researchSystem, userId) {
  await interaction.deferReply();
  
  try {
    // Extraire les informations du customId
    const parts = interaction.customId.split(':');
    const businessId = parts[1];
    const researchId = parts[2];
    
    // Extraire l'investissement supplémentaire (optionnel)
    let investmentAmount = 0;
    const investmentField = interaction.fields.getTextInputValue('investment');
    
    if (investmentField && investmentField.trim() !== '') {
      investmentAmount = parseInt(investmentField);
      
      // Vérifier que le montant est valide
      if (isNaN(investmentAmount) || investmentAmount < 0) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Montant invalide',
              'L\'investissement supplémentaire doit être un nombre positif.'
            )
          ]
        });
      }
    }
    
    // Récupérer l'entreprise
    const business = await manager.getBusinessById(businessId);
    if (!business) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Entreprise introuvable',
            'Cette entreprise n\'existe plus.'
          )
        ]
      });
    }
    
    // Vérifier que la recherche est disponible
    const researchTree = researchSystem.getResearchTree(business.id, business.type);
    if (!researchTree || !researchTree[researchId]) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Recherche invalide',
            'Cette recherche n\'existe pas ou n\'est pas disponible pour votre type d\'entreprise.'
          )
        ]
      });
    }
    
    const research = researchTree[researchId];
    if (research.status !== 'available') {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Recherche non disponible',
            'Cette recherche n\'est pas disponible actuellement.'
          )
        ]
      });
    }
    
    // Démarrer la recherche
    const result = await researchSystem.startResearch(businessId, researchId, investmentAmount, userId);
    
    // Créer l'embed de confirmation
    const completionDate = new Date(result.completionTime);
    const embed = EmbedCreator.success(
      '🧪 Recherche démarrée!',
      `Votre entreprise a démarré la recherche **${result.name}** (niveau ${result.level}).`,
      {
        fields: [
          {
            name: '💰 Coût',
            value: `${result.cost} PiloCoins`,
            inline: true
          },
          {
            name: '⏱️ Durée estimée',
            value: `${Math.round(result.durationHours)} heures`,
            inline: true
          },
          {
            name: '📅 Fin estimée',
            value: `<t:${Math.floor(completionDate.getTime() / 1000)}:R>`,
            inline: true
          }
        ]
      }
    );
    
    if (investmentAmount > 0) {
      embed.addFields({
        name: '💼 Investissement supplémentaire',
        value: `${investmentAmount} PiloCoins`,
        inline: true
      });
    }
    
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`research:active:${businessId}`)
          .setLabel('Voir recherches en cours')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏳')
      );
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling research start modal:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue: ${error.message}`
        )
      ]
    });
  }
}