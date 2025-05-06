import { EmbedBuilder } from 'discord.js';

export const economicModalHandler = async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  const { client, customId } = interaction;
  
  // Vérifier si c'est un modal économique
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
    
    const economicSystem = client.economicEventSystem;
    
    switch (action) {
      case 'submitEvent':
        await handleSubmitEvent(interaction, client, economicSystem, params[0]);
        break;
      case 'submitCycle':
        await handleSubmitCycle(interaction, client, economicSystem, params[0]);
        break;
      default:
        await interaction.reply({
          content: "Action non reconnue.",
          ephemeral: true
        });
    }
  } catch (error) {
    console.error(`Erreur dans economicModalHandler: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors du traitement de cette action.",
      ephemeral: true
    });
  }
};

/**
 * Traite la soumission du formulaire d'événement
 */
async function handleSubmitEvent(interaction, client, economicSystem, eventId) {
  try {
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
    
    // Créer un embed pour la réponse
    const embed = new EmbedBuilder()
      .setTitle(`Événement forcé: ${selectedEvent.name}`)
      .setDescription(`L'événement a été ajouté avec succès.`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Intensité', value: intensity.toFixed(2), inline: true },
        { name: 'Durée', value: `${durationDays} jours`, inline: true },
        { name: 'Fin prévue', value: new Date(eventInstance.endTime).toLocaleString(), inline: true }
      );
    
    // Répondre à l'interaction
    return interaction.reply({
      embeds: [embed],
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
 * Traite la soumission du formulaire de cycle
 */
async function handleSubmitCycle(interaction, client, economicSystem, newCycle) {
  try {
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
    
    // Créer un embed pour la réponse
    const embed = new EmbedBuilder()
      .setTitle(`Cycle économique modifié`)
      .setDescription(`Le cycle économique a été changé avec succès.`)
      .setColor('#0099FF')
      .addFields(
        { name: 'Ancien cycle', value: oldCycle, inline: true },
        { name: 'Nouveau cycle', value: newCycle, inline: true },
        { name: 'Intensité', value: strength.toFixed(2), inline: true }
      );
    
    // Répondre à l'interaction
    return interaction.reply({
      embeds: [embed],
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