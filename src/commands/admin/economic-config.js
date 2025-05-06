import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('economic-config')
    .setDescription('Configure le système économique du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-channel')
        .setDescription('Définir le canal pour les annonces économiques')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Le canal où seront publiées les annonces économiques')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Voir la configuration économique actuelle'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('force-cycle')
        .setDescription('Forcer un changement de cycle économique')
        .addStringOption(option =>
          option.setName('cycle')
            .setDescription('Le nouveau cycle économique')
            .setRequired(true)
            .addChoices(
              { name: 'Stable', value: 'stable' },
              { name: 'Boom', value: 'boom' },
              { name: 'Récession', value: 'recession' }
            ))
        .addNumberOption(option =>
          option.setName('strength')
            .setDescription('L\'intensité du cycle (0.5 à 1.5)')
            .setMinValue(0.5)
            .setMaxValue(1.5)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('force-event')
        .setDescription('Forcer un événement économique')
        .addStringOption(option =>
          option.setName('event')
            .setDescription('L\'événement à déclencher')
            .setRequired(true)
            .addChoices(
              { name: 'Révolution technologique', value: 'tech_boom' },
              { name: 'Effondrement des cryptomonnaies', value: 'crypto_crash' },
              { name: 'Récolte exceptionnelle', value: 'agricultural_boom' },
              { name: 'Sécheresse', value: 'drought' },
              { name: 'Boom touristique', value: 'tourism_boom' },
              { name: 'Crise sanitaire', value: 'global_pandemic' },
              { name: 'Innovation industrielle', value: 'industrial_innovation' },
              { name: 'Découverte minière', value: 'mining_discovery' },
              { name: 'Crise financière mondiale', value: 'global_recession' },
              { name: 'Boom du luxe', value: 'luxury_boom' }
            ))
        .addNumberOption(option =>
          option.setName('duration')
            .setDescription('Durée en jours')
            .setMinValue(1)
            .setMaxValue(14))
        .addNumberOption(option =>
          option.setName('intensity')
            .setDescription('Intensité (0.8 à 1.4)')
            .setMinValue(0.8)
            .setMaxValue(1.4))),

  async execute(interaction) {
    const { client } = interaction;
    
    // Vérifier si le système économique est initialisé
    if (!client.economicEventSystem) {
      try {
        // Import et initialisation dynamique du système économique
        const { EconomicEventSystem } = await import('../../utils/economicEvents.js');
        client.economicEventSystem = new EconomicEventSystem(client);
        await client.economicEventSystem.initialize();
      } catch (error) {
        console.error('Failed to initialize economic event system:', error);
        return interaction.reply({
          content: 'Erreur: Impossible d\'initialiser le système économique',
          ephemeral: true
        });
      }
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'set-channel':
        await handleSetChannel(interaction, client);
        break;
      case 'view':
        await handleViewConfig(interaction, client);
        break;
      case 'force-cycle':
        await handleForceCycle(interaction, client);
        break;
      case 'force-event':
        await handleForceEvent(interaction, client);
        break;
    }
  }
};

/**
 * Définit le canal pour les annonces économiques
 */
async function handleSetChannel(interaction, client) {
  const channel = interaction.options.getChannel('channel');
  
  try {
    // Vérifier si le bot a les permissions d'envoyer des messages dans ce canal
    const permissions = channel.permissionsFor(client.user);
    if (!permissions.has('SendMessages') || !permissions.has('EmbedLinks')) {
      return interaction.reply({
        content: `Je n'ai pas les permissions nécessaires pour envoyer des messages et des embeds dans ${channel}.`,
        ephemeral: true
      });
    }
    
    // Enregistrer l'ID du canal dans la base de données
    await client.db.db.run(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    
    await client.db.db.run(`
      INSERT OR REPLACE INTO bot_settings (key, value)
      VALUES ('ECONOMIC_NEWS_CHANNEL', ?)
    `, channel.id);
    
    // Mettre à jour la variable d'environnement
    process.env.ECONOMIC_NEWS_CHANNEL = channel.id;
    
    // Envoyer un message de test
    const testEmbed = new EmbedBuilder()
      .setTitle('📊 Configuration du système économique')
      .setDescription(`Ce canal sera désormais utilisé pour les annonces économiques.`)
      .setColor('#0099ff')
      .addFields(
        { name: 'Cycle actuel', value: client.economicEventSystem.currentEconomicCycle },
        { name: 'Intensité', value: client.economicEventSystem.cycleStrength.toString() }
      )
      .setFooter({ text: 'Système économique de PiloteCommunity' });
    
    await channel.send({ embeds: [testEmbed] });
    
    return interaction.reply({
      content: `Le canal ${channel} a été configuré avec succès pour les annonces économiques.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error setting economic news channel:', error);
    return interaction.reply({
      content: `Une erreur est survenue lors de la configuration du canal: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Affiche la configuration économique actuelle
 */
async function handleViewConfig(interaction, client) {
  try {
    const economicSystem = client.economicEventSystem;
    
    // Récupérer le canal configuré
    let channelId = process.env.ECONOMIC_NEWS_CHANNEL;
    if (!channelId) {
      const setting = await client.db.db.get(`
        SELECT value FROM bot_settings WHERE key = 'ECONOMIC_NEWS_CHANNEL'
      `).catch(() => null);
      
      channelId = setting ? setting.value : 'Non configuré';
    }
    
    const channelMention = channelId !== 'Non configuré' 
      ? `<#${channelId}>` 
      : 'Non configuré';
    
    // Créer l'embed avec les informations
    const configEmbed = new EmbedBuilder()
      .setTitle('📊 Configuration économique')
      .setColor('#0099ff')
      .addFields(
        { name: 'Canal d\'annonces', value: channelMention, inline: true },
        { name: 'Cycle économique', value: economicSystem.currentEconomicCycle, inline: true },
        { name: 'Intensité du cycle', value: economicSystem.cycleStrength.toFixed(2), inline: true },
        { name: 'Dernier changement', value: new Date(economicSystem.lastCycleChange).toLocaleString(), inline: true },
        { name: 'Événements actifs', value: economicSystem.activeEvents.length > 0 
          ? economicSystem.activeEvents.map(e => e.name).join('\n') 
          : 'Aucun événement actif', inline: false }
      );
    
    // Ajouter les modificateurs par industrie
    const industryModifiersField = {
      name: 'Modificateurs par industrie',
      value: Object.entries(economicSystem.industryModifiers)
        .map(([industry, value]) => `${economicSystem.getIndustryName(industry)}: ${(value * 100).toFixed(0)}%`)
        .join('\n'),
      inline: false
    };
    
    configEmbed.addFields(industryModifiersField);
    
    // Ajouter les boutons pour forcer un événement ou un cycle
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('economic_forceEvent')
          .setLabel('Forcer un événement')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('economic_forceCycle')
          .setLabel('Changer le cycle')
          .setStyle(ButtonStyle.Secondary)
      );
    
    return interaction.reply({
      embeds: [configEmbed],
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error displaying economic configuration:', error);
    return interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Force un changement de cycle économique
 */
async function handleForceCycle(interaction, client) {
  const economicSystem = client.economicEventSystem;
  const newCycle = interaction.options.getString('cycle');
  const strength = interaction.options.getNumber('strength') || 1.0;
  
  try {
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
    
    return interaction.reply({
      content: `Le cycle économique a été changé de ${oldCycle} à ${newCycle} avec une intensité de ${strength.toFixed(2)}.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error forcing economic cycle:', error);
    return interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Force un événement économique
 */
async function handleForceEvent(interaction, client) {
  const economicSystem = client.economicEventSystem;
  const eventId = interaction.options.getString('event');
  const durationDays = interaction.options.getNumber('duration') || 5;
  const intensity = interaction.options.getNumber('intensity') || 1.0;
  
  try {
    // Trouver l'événement correspondant
    const possibleEvents = economicSystem.getPossibleEvents();
    const selectedEvent = possibleEvents.find(e => e.id === eventId);
    
    if (!selectedEvent) {
      return interaction.reply({
        content: `Événement non trouvé: ${eventId}`,
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
    
    return interaction.reply({
      content: `L'événement "${selectedEvent.name}" a été forcé avec une intensité de ${intensity.toFixed(2)} pour une durée de ${durationDays} jours.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error forcing economic event:', error);
    return interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}