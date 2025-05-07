import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  // custom ID format: research:action:businessId:researchId
  customId: 'research',
  
  async execute(interaction, client) {
    try {
      // Parse the custom ID
      const [base, action, businessId, researchId] = interaction.customId.split(':');
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
      
      // Récupérer l'entreprise
      const business = await manager.getBusinessById(businessId);
      if (!business) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Entreprise introuvable',
              'Cette entreprise n\'existe plus.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Vérifier que l'utilisateur est bien membre de l'entreprise
      const isMember = await client.db.db.get(`
        SELECT * FROM business_members
        WHERE business_id = ? AND user_id = ?
      `, businessId, userId);
      
      if (!isMember) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Accès refusé',
              'Vous n\'êtes pas membre de cette entreprise.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Traiter les différentes actions
      if (action === 'view') {
        await handleViewAction(interaction, client, business, userId);
      }
      else if (action === 'details') {
        await handleDetailsAction(interaction, client, business, userId, researchId);
      }
      else if (action === 'active') {
        await handleActiveAction(interaction, client, business, userId);
      }
      else if (action === 'boost') {
        await handleBoostAction(interaction, client, business, userId, researchId);
      }
      else if (action === 'start') {
        await handleStartAction(interaction, client, business, userId, researchId);
      }
      
    } catch (error) {
      console.error('Error in research button:', error);
      
      // Send error message
      try {
        await interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Une erreur est survenue lors du traitement de cette action.'
            )
          ],
          ephemeral: true
        });
      } catch {
        // If reply already sent, try to follow up
        await interaction.followUp({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Une erreur est survenue lors du traitement de cette action.'
            )
          ],
          ephemeral: true
        });
      }
    }
  }
};

/**
 * Gère l'action "view" pour afficher l'arbre de recherche
 */
async function handleViewAction(interaction, client, business, userId) {
  // Réutiliser le code de la commande /research view
  await interaction.deferUpdate();
  
  const { default: researchCommand } = await import('../commands/economy/research.js');
  const fakeInteraction = {
    options: {
      getSubcommand: () => 'view',
      getString: () => null,
      getInteger: () => null
    },
    deferReply: async () => {},
    editReply: async (options) => {
      return interaction.editReply(options);
    },
    user: { id: userId }
  };
  
  // Exécuter la fonction handleViewResearchTree
  await researchCommand.execute(fakeInteraction, client);
}

/**
 * Gère l'action "details" pour afficher les détails d'une recherche
 */
async function handleDetailsAction(interaction, client, business, userId) {
  await interaction.deferUpdate();
  
  try {
    const researchSystem = client.researchSystem;
    const researchId = interaction.values[0]; // ID de recherche sélectionné
    
    // Récupérer l'arbre de recherche
    const researchTree = researchSystem.getResearchTree(business.id, business.type);
    if (!researchTree || !researchTree[researchId]) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Recherche introuvable',
            'Cette recherche n\'existe pas ou n\'est pas disponible pour votre type d\'entreprise.'
          )
        ],
        components: []
      });
    }
    
    const research = researchTree[researchId];
    
    // Déterminer l'emoji de statut
    let statusEmoji, statusText;
    switch (research.status) {
      case 'locked':
        statusEmoji = '🔒';
        statusText = 'Verrouillée';
        break;
      case 'available':
        statusEmoji = '✅';
        statusText = 'Disponible';
        break;
      case 'in_progress':
        statusEmoji = '⏳';
        statusText = 'En cours';
        break;
      case 'completed':
        statusEmoji = '✨';
        statusText = 'Terminée';
        break;
      case 'maxed':
        statusEmoji = '🌟';
        statusText = 'Niveau max';
        break;
      default:
        statusEmoji = '❓';
        statusText = 'Inconnu';
    }
    
    // Créer l'embed
    const embed = EmbedCreator.create({
      title: `${research.icon} ${research.name}`,
      description: research.description,
      color: research.status === 'available' ? 'GREEN' : 
             research.status === 'in_progress' ? 'ORANGE' :
             research.status === 'completed' || research.status === 'maxed' ? 'BLUE' : 'GREY',
      fields: [
        {
          name: 'ID',
          value: researchId,
          inline: true
        },
        {
          name: 'Statut',
          value: `${statusEmoji} ${statusText}`,
          inline: true
        },
        {
          name: 'Niveau',
          value: `${research.current_level}/${research.maxLevel}`,
          inline: true
        }
      ]
    });
    
    // Ajouter le temps restant si en cours
    if (research.status === 'in_progress') {
      const remainingHours = Math.floor(research.remaining_time / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((research.remaining_time % (1000 * 60 * 60)) / (1000 * 60));
      
      embed.addFields({
        name: '⏱️ Temps restant',
        value: `${remainingHours}h ${remainingMinutes}m`,
        inline: true
      });
      
      const completionTime = Date.now() + research.remaining_time;
      
      embed.addFields({
        name: '📅 Fin estimée',
        value: `<t:${Math.floor(completionTime / 1000)}:R>`,
        inline: true
      });
    }
    
    // Ajouter l'effet de la recherche
    embed.addFields({
      name: '✨ Effet',
      value: researchSystem.getEffectDescription(research, research.current_level > 0 ? research.current_level : 1),
      inline: false
    });
    
    // Ajouter le coût et la durée si disponible
    if (research.status === 'available') {
      // Calculer le coût et la durée pour le prochain niveau
      const nextLevel = research.current_level + 1;
      const cost = Math.round(research.baseCost * Math.pow(research.levelScaling.cost, nextLevel - 1));
      const duration = Math.round(research.baseDuration * Math.pow(research.levelScaling.duration, nextLevel - 1));
      
      embed.addFields(
        {
          name: '💰 Coût',
          value: `${cost} PiloCoins`,
          inline: true
        },
        {
          name: '⏱️ Durée estimée',
          value: `${duration} heures`,
          inline: true
        }
      );
    }
    
    // Ajouter les prérequis
    if (research.requirements && research.requirements.length > 0) {
      const prereqs = research.requirements.map(reqId => {
        const req = researchTree[reqId];
        const completed = req.status === 'completed' || req.status === 'maxed';
        return `${completed ? '✅' : '❌'} ${req.icon} ${req.name}`;
      }).join('\n');
      
      embed.addFields({
        name: '📋 Prérequis',
        value: prereqs,
        inline: false
      });
    }
    
    // Créer les boutons selon le statut
    const buttons = new ActionRowBuilder();
    
    if (research.status === 'available') {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`research:start:${business.id}:${researchId}`)
          .setLabel('Démarrer la recherche')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🧪')
      );
    } else if (research.status === 'in_progress') {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`research:boost:${business.id}:${researchId}`)
          .setLabel('Accélérer la recherche')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🚀')
      );
    }
    
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`research:view:${business.id}`)
        .setLabel('Retour à l\'arbre de recherche')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔙')
    );
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling research details:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage des détails de la recherche: ${error.message}`
        )
      ],
      components: []
    });
  }
}

/**
 * Gère l'action "active" pour afficher les recherches en cours
 */
async function handleActiveAction(interaction, client, business, userId) {
  // Réutiliser le code de la commande /research active
  await interaction.deferUpdate();
  
  const { default: researchCommand } = await import('../commands/economy/research.js');
  const fakeInteraction = {
    options: {
      getSubcommand: () => 'active',
      getString: () => null,
      getInteger: () => null
    },
    deferReply: async () => {},
    editReply: async (options) => {
      return interaction.editReply(options);
    },
    user: { id: userId }
  };
  
  // Exécuter la commande
  await researchCommand.execute(fakeInteraction, client);
}

/**
 * Gère l'action "boost" pour accélérer une recherche
 */
async function handleBoostAction(interaction, client, business, userId, researchId) {
  try {
    // Ouvrir un modal pour saisir le montant du boost
    const modal = new ModalBuilder()
      .setCustomId(`research-boost-modal:${business.id}:${researchId}`)
      .setTitle('Accélérer la recherche');
    
    // Ajouter les champs du modal
    const amountInput = new TextInputBuilder()
      .setCustomId('boostAmount')
      .setLabel('Montant à investir (PiloCoins)')
      .setPlaceholder('Entrez un montant (minimum: 100)')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(10)
      .setRequired(true);
    
    // Ajouter les composants au modal
    const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(firstActionRow);
    
    // Afficher le modal
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error showing boost modal:', error);
    
    await interaction.reply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'ouverture du formulaire d'accélération: ${error.message}`
        )
      ],
      ephemeral: true
    });
  }
}

/**
 * Gère l'action "start" pour démarrer une recherche
 */
async function handleStartAction(interaction, client, business, userId, researchId) {
  try {
    // Ouvrir un modal pour saisir les détails du démarrage
    const modal = new ModalBuilder()
      .setCustomId(`research-start-modal:${business.id}:${researchId}`)
      .setTitle('Démarrer une recherche');
    
    // Ajouter les champs du modal
    const investmentInput = new TextInputBuilder()
      .setCustomId('investment')
      .setLabel('Investissement supplémentaire (optionnel)')
      .setPlaceholder('Laissez vide ou entrez un montant pour accélérer')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    
    // Ajouter les composants au modal
    const firstActionRow = new ActionRowBuilder().addComponents(investmentInput);
    modal.addComponents(firstActionRow);
    
    // Afficher le modal
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error showing start modal:', error);
    
    await interaction.reply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'ouverture du formulaire de démarrage: ${error.message}`
        )
      ],
      ephemeral: true
    });
  }
}