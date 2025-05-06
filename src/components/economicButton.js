import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export const economicButtonHandler = async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  
  const { client, user, guild } = interaction;
  const customId = interaction.customId;
  
  // Vérifier si c'est un bouton de gestion économique
  if (!customId.startsWith('economic_')) return;
  
  // Vérifier les permissions d'administrateur
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({
      content: "Vous devez être administrateur pour effectuer cette action.",
      ephemeral: true
    });
  }
  
  const [prefix, action, ...params] = customId.split('_');
  
  try {
    // S'assurer que le système économique est initialisé
    if (!client.economicEventSystem) {
      const { EconomicEventSystem } = await import('../utils/economicEvents.js');
      client.economicEventSystem = new EconomicEventSystem(client);
      await client.economicEventSystem.initialize();
    }
    
    switch (action) {
      case 'forceEvent':
        await handleForceEventSelect(interaction, client);
        break;
      case 'eventSelected':
        await handleEventSelected(interaction, client, params[0]);
        break;
      case 'submitEvent':
        await handleSubmitEvent(interaction, client);
        break;
      case 'forceCycle':
        await handleForceCycleSelect(interaction, client);
        break;
      case 'cycleSelected':
        await handleCycleSelected(interaction, client, params[0]);
        break;
      case 'submitCycle':
        await handleSubmitCycle(interaction, client);
        break;
      default:
        await interaction.reply({
          content: "Action non reconnue.",
          ephemeral: true
        });
    }
  } catch (error) {
    console.error(`Erreur dans economicButtonHandler: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors du traitement de cette action.",
      ephemeral: true
    });
  }
};

/**
 * Affiche le sélecteur d'événement économique
 */
async function handleForceEventSelect(interaction, client) {
  try {
    const economicSystem = client.economicEventSystem;
    const possibleEvents = economicSystem.getPossibleEvents();
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('economic_eventSelected')
      .setPlaceholder('Choisissez un événement économique')
      .addOptions(possibleEvents.map(event => ({
        label: event.name,
        description: event.description.substring(0, 100),
        value: event.id
      })));
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({
      content: 'Sélectionnez l\'événement économique à forcer:',
      components: [row],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error selecting economic event:', error);
    await interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Traite la sélection d'un événement et affiche le formulaire
 */
async function handleEventSelected(interaction, client, eventId) {
  try {
    const economicSystem = client.economicEventSystem;
    const possibleEvents = economicSystem.getPossibleEvents();
    const selectedEvent = possibleEvents.find(e => e.id === eventId);
    
    if (!selectedEvent) {
      return interaction.update({
        content: 'Événement non trouvé.',
        components: [],
        ephemeral: true
      });
    }
    
    // Créer le modal pour les paramètres de l'événement
    const modal = new ModalBuilder()
      .setCustomId(`economic_submitEvent_${eventId}`)
      .setTitle(`Forcer: ${selectedEvent.name}`);
    
    // Ajouter l'input pour l'intensité
    const intensityInput = new TextInputBuilder()
      .setCustomId('intensity')
      .setLabel('Intensité (0.8 à 1.4)')
      .setPlaceholder('1.0')
      .setStyle(TextInputStyle.Short)
      .setValue('1.0')
      .setRequired(true);
    
    // Ajouter l'input pour la durée
    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Durée en jours (1 à 14)')
      .setPlaceholder('5')
      .setStyle(TextInputStyle.Short)
      .setValue('5')
      .setRequired(true);
    
    const row1 = new ActionRowBuilder().addComponents(intensityInput);
    const row2 = new ActionRowBuilder().addComponents(durationInput);
    
    modal.addComponents(row1, row2);
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error handling event selection:', error);
    await interaction.update({
      content: `Une erreur est survenue: ${error.message}`,
      components: [],
      ephemeral: true
    });
  }
}

/**
 * Traite la soumission du formulaire d'événement
 */
async function handleSubmitEvent(interaction, client) {
  try {
    const eventId = interaction.customId.split('_')[2];
    const economicSystem = client.economicEventSystem;
    const possibleEvents = economicSystem.getPossibleEvents();
    const selectedEvent = possibleEvents.find(e => e.id === eventId);
    
    if (!selectedEvent) {
      return interaction.reply({
        content: 'Événement non trouvé.',
        ephemeral: true
      });
    }
    
    // Récupérer les valeurs du formulaire
    const intensityStr = interaction.fields.getTextInputValue('intensity');
    const durationStr = interaction.fields.getTextInputValue('duration');
    
    // Valider et convertir les entrées
    const intensity = parseFloat(intensityStr);
    const durationDays = parseInt(durationStr);
    
    if (isNaN(intensity) || intensity < 0.8 || intensity > 1.4) {
      return interaction.reply({
        content: 'L\'intensité doit être un nombre entre 0.8 et 1.4.',
        ephemeral: true
      });
    }
    
    if (isNaN(durationDays) || durationDays < 1 || durationDays > 14) {
      return interaction.reply({
        content: 'La durée doit être un nombre entier entre 1 et 14.',
        ephemeral: true
      });
    }
    
    // Créer l'instance de l'événement
    const eventInstance = {
      id: selectedEvent.id,
      name: selectedEvent.name,
      description: selectedEvent.description,
      affectedIndustries: selectedEvent.affectedIndustries,
      effects: selectedEvent.getEffects(intensity),
      startTime: Date.now(),
      endTime: Date.now() + (durationDays * 24 * 60 * 60 * 1000),
      intensity: intensity
    };
    
    // Supprimer l'événement s'il existe déjà
    economicSystem.activeEvents = economicSystem.activeEvents.filter(e => e.id !== eventId);
    
    // Ajouter l'événement aux événements actifs
    economicSystem.activeEvents.push(eventInstance);
    
    // Créer une annonce pour l'événement
    const newsItem = {
      type: 'event',
      title: `🌐 [ADMIN] ${selectedEvent.name}`,
      content: `[ÉVÉNEMENT FORCÉ PAR ADMIN]\n${selectedEvent.description}\n\n${economicSystem.formatEventEffects(eventInstance.effects)}`,
      timestamp: Date.now(),
      eventId: selectedEvent.id,
      effects: eventInstance.effects
    };
    
    economicSystem.newsHistory.unshift(newsItem);
    if (economicSystem.newsHistory.length > 20) economicSystem.newsHistory.pop();
    
    // Sauvegarder les changements
    await economicSystem.saveEconomicState();
    
    // Annoncer l'événement
    economicSystem.announceEconomicNews(newsItem);
    
    // Répondre à l'interaction
    return interaction.reply({
      content: `L'événement "${selectedEvent.name}" a été forcé avec une intensité de ${intensity.toFixed(2)} pour une durée de ${durationDays} jours.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error submitting event:', error);
    return interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Affiche le sélecteur de cycle économique
 */
async function handleForceCycleSelect(interaction, client) {
  try {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('economic_cycleSelected')
      .setPlaceholder('Choisissez un cycle économique')
      .addOptions([
        {
          label: 'Stable',
          description: 'Conditions économiques normales et équilibrées',
          value: 'stable'
        },
        {
          label: 'Boom',
          description: 'Croissance économique et opportunités accrues',
          value: 'boom'
        },
        {
          label: 'Récession',
          description: 'Ralentissement économique et conditions difficiles',
          value: 'recession'
        }
      ]);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({
      content: 'Sélectionnez le nouveau cycle économique:',
      components: [row],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error selecting economic cycle:', error);
    await interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Traite la sélection d'un cycle et affiche le formulaire
 */
async function handleCycleSelected(interaction, client, cycle) {
  try {
    // Créer le modal pour les paramètres du cycle
    const modal = new ModalBuilder()
      .setCustomId(`economic_submitCycle_${cycle}`)
      .setTitle(`Forcer le cycle: ${cycle}`);
    
    // Ajouter l'input pour l'intensité
    const strengthInput = new TextInputBuilder()
      .setCustomId('strength')
      .setLabel('Intensité (0.5 à 1.5)')
      .setPlaceholder('1.0')
      .setStyle(TextInputStyle.Short)
      .setValue('1.0')
      .setRequired(true);
    
    const row = new ActionRowBuilder().addComponents(strengthInput);
    
    modal.addComponents(row);
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error handling cycle selection:', error);
    await interaction.update({
      content: `Une erreur est survenue: ${error.message}`,
      components: [],
      ephemeral: true
    });
  }
}

/**
 * Traite la soumission du formulaire de cycle
 */
async function handleSubmitCycle(interaction, client) {
  try {
    const newCycle = interaction.customId.split('_')[2];
    const economicSystem = client.economicEventSystem;
    
    // Récupérer les valeurs du formulaire
    const strengthStr = interaction.fields.getTextInputValue('strength');
    
    // Valider et convertir les entrées
    const strength = parseFloat(strengthStr);
    
    if (isNaN(strength) || strength < 0.5 || strength > 1.5) {
      return interaction.reply({
        content: 'L\'intensité doit être un nombre entre 0.5 et 1.5.',
        ephemeral: true
      });
    }
    
    // Sauvegarder l'ancien cycle pour l'annonce
    const oldCycle = economicSystem.currentEconomicCycle;
    
    // Mettre à jour le cycle économique
    economicSystem.currentEconomicCycle = newCycle;
    economicSystem.cycleStrength = strength;
    economicSystem.lastCycleChange = Date.now();
    
    // Mettre à jour les modificateurs d'industrie
    economicSystem.updateIndustryModifiers();
    
    // Créer une annonce pour le changement
    const newsItem = {
      type: 'cycle_change',
      title: economicSystem.getCycleChangeTitle(oldCycle, newCycle),
      content: `[CHANGEMENT FORCÉ PAR ADMIN]\n` + 
               economicSystem.getCycleChangeDescription(oldCycle, newCycle, strength),
      timestamp: Date.now(),
      effects: economicSystem.getCycleEffects(newCycle, strength)
    };
    
    economicSystem.newsHistory.unshift(newsItem);
    if (economicSystem.newsHistory.length > 20) economicSystem.newsHistory.pop();
    
    // Sauvegarder les changements
    await economicSystem.saveEconomicState();
    
    // Annoncer le changement
    economicSystem.announceEconomicNews(newsItem);
    
    // Répondre à l'interaction
    return interaction.reply({
      content: `Le cycle économique a été changé de ${oldCycle} à ${newCycle} avec une intensité de ${strength.toFixed(2)}.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error submitting cycle:', error);
    return interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}