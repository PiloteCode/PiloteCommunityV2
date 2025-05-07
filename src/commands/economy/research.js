import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('research')
    .setDescription('Système de recherche et développement pour votre entreprise')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Voir l\'arbre de recherche de votre entreprise')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('active')
        .setDescription('Voir vos recherches en cours')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('completed')
        .setDescription('Voir vos recherches terminées')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Démarrer une nouvelle recherche')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID de la recherche à démarrer')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(option =>
          option
            .setName('investment')
            .setDescription('Investissement supplémentaire pour accélérer la recherche (optionnel)')
            .setRequired(false)
            .setMinValue(0)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('boost')
        .setDescription('Accélérer une recherche en cours')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID de la recherche à accélérer')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Montant à investir pour accélérer la recherche')
            .setRequired(true)
            .setMinValue(100)
        )
    ),
  
  // Autocomplete handler for research IDs
  async autocomplete(interaction, client) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name !== 'id') return;
      
      const userId = interaction.user.id;
      const manager = client.businessManager;
      const researchSystem = client.researchSystem;
      
      // Get user's business
      const business = await manager.getUserBusiness(userId);
      if (!business) return interaction.respond([]);
      
      let researchChoices = [];
      
      if (interaction.options.getSubcommand() === 'start') {
        // Get research tree for available researches
        const researchTree = researchSystem.getResearchTree(business.id, business.type);
        if (!researchTree) return interaction.respond([]);
        
        // Filter available researches
        for (const [id, research] of Object.entries(researchTree)) {
          if (research.status === 'available') {
            researchChoices.push({
              name: `${research.icon} ${research.name}`,
              value: id
            });
          }
        }
      }
      else if (interaction.options.getSubcommand() === 'boost') {
        // Get active researches
        const activeResearches = researchSystem.getActiveResearches(business.id);
        
        for (const research of activeResearches) {
          researchChoices.push({
            name: `${research.icon} ${research.name} (Niveau ${research.next_level})`,
            value: research.id
          });
        }
      }
      
      // Filter based on input
      const filtered = researchChoices.filter(choice => 
        choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()));
      
      await interaction.respond(
        filtered.slice(0, 25) // Discord only allows max 25 choices
      );
    } catch (error) {
      console.error('Error in research autocomplete:', error);
      await interaction.respond([]);
    }
  },
  
  async execute(interaction, client) {
    try {
      // S'assurer que le système de recherche est initialisé
      if (!client.researchSystem) {
        const { ResearchSystem } = await import('../../utils/researchSystem.js');
        client.researchSystem = new ResearchSystem(client);
        await client.researchSystem.initialize();
      }
      
      const userId = interaction.user.id;
      const manager = client.businessManager;
      const researchSystem = client.researchSystem;
      
      // Récupérer l'entreprise de l'utilisateur
      const business = await manager.getUserBusiness(userId);
      if (!business) {
        return interaction.reply({
          embeds: [
            EmbedCreator.warning(
              'Aucune entreprise',
              'Vous ne possédez pas d\'entreprise. Utilisez `/corporation créer` pour en créer une.'
            )
          ],
          ephemeral: true
        });
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      // Traiter les différentes sous-commandes
      if (subcommand === 'view') {
        await handleViewResearchTree(interaction, client, business, userId);
      }
      else if (subcommand === 'active') {
        await handleViewActiveResearches(interaction, client, business, userId);
      }
      else if (subcommand === 'completed') {
        await handleViewCompletedResearches(interaction, client, business, userId);
      }
      else if (subcommand === 'start') {
        await handleStartResearch(interaction, client, business, userId);
      }
      else if (subcommand === 'boost') {
        await handleBoostResearch(interaction, client, business, userId);
      }
      
    } catch (error) {
      console.error('Error in research command:', error);
      
      await interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue lors de l'exécution de cette commande: ${error.message}`
          )
        ],
        ephemeral: true
      });
    }
  }
};

/**
 * Gère l'affichage de l'arbre de recherche
 */
async function handleViewResearchTree(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    const researchSystem = client.researchSystem;
    
    // Récupérer l'arbre de recherche
    const researchTree = researchSystem.getResearchTree(business.id, business.type);
    if (!researchTree) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.warning(
            'Arbre de recherche indisponible',
            'Aucun arbre de recherche n\'est disponible pour votre type d\'entreprise.'
          )
        ]
      });
    }
    
    // Organiser les recherches par niveau de prérequis
    const researchByLevel = organizeResearchByLevel(researchTree);
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`🧪 Arbre de recherche: ${business.name}`)
      .setDescription(`Voici l'arbre de recherche disponible pour votre entreprise de type ${business.type}.`)
      .setColor(0x00AAFF)
      .setFooter({ text: 'Utilisez /research start [id] pour démarrer une recherche' });
    
    // Ajouter les recherches à l'embed, organisées par niveau
    for (let level = 0; level < researchByLevel.length; level++) {
      const levelResearches = researchByLevel[level];
      if (levelResearches.length === 0) continue;
      
      let fieldText = '';
      for (const research of levelResearches) {
        // Déterminer l'emoji de statut
        let statusEmoji;
        switch (research.status) {
          case 'locked':
            statusEmoji = '🔒';
            break;
          case 'available':
            statusEmoji = '✅';
            break;
          case 'in_progress':
            statusEmoji = '⏳';
            break;
          case 'completed':
            statusEmoji = '✨';
            break;
          case 'maxed':
            statusEmoji = '🌟';
            break;
          default:
            statusEmoji = '❓';
        }
        
        // Formater le texte
        fieldText += `${statusEmoji} ${research.icon} **${research.name}** \`[${research.id}]\`\n`;
        
        // Ajouter le niveau actuel si applicable
        if (research.current_level > 0) {
          fieldText += `   Niveau: ${research.current_level}/${research.maxLevel}\n`;
        }
        
        // Ajouter le temps restant si en cours
        if (research.status === 'in_progress') {
          const remainingHours = Math.floor(research.remaining_time / (1000 * 60 * 60));
          const remainingMinutes = Math.floor((research.remaining_time % (1000 * 60 * 60)) / (1000 * 60));
          fieldText += `   Temps restant: ${remainingHours}h ${remainingMinutes}m\n`;
        }
        
        // Ajouter la description
        fieldText += `   *${research.description}*\n\n`;
      }
      
      embed.addFields({
        name: `Niveau ${level + 1}`,
        value: fieldText
      });
    }
    
    // Créer un menu pour afficher les détails d'une recherche spécifique
    const selectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`research:details:${business.id}`)
          .setPlaceholder('Voir les détails d\'une recherche...')
          .addOptions(Object.values(researchTree).map(research => ({
            label: research.name,
            value: research.id,
            description: `[${research.status}] ${research.description.substring(0, 50)}...`,
            emoji: research.icon
          })))
      );
    
    await interaction.editReply({
      embeds: [embed],
      components: [selectMenu]
    });
  } catch (error) {
    console.error('Error handling view research tree:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage de l'arbre de recherche: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'affichage des recherches en cours
 */
async function handleViewActiveResearches(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    const researchSystem = client.researchSystem;
    
    // Récupérer les recherches en cours
    const activeResearches = researchSystem.getActiveResearches(business.id);
    
    if (activeResearches.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '⏳ Recherches en cours',
            'Vous n\'avez aucune recherche en cours. Utilisez `/research start [id]` pour démarrer une recherche.'
          )
        ]
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`⏳ Recherches en cours: ${business.name}`)
      .setDescription(`Votre entreprise a ${activeResearches.length} recherche(s) en cours.`)
      .setColor(0xFFAA00)
      .setFooter({ text: 'Utilisez /research boost [id] [amount] pour accélérer une recherche' });
    
    // Ajouter les recherches à l'embed
    for (const research of activeResearches) {
      const remainingHours = Math.floor(research.remaining_time / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((research.remaining_time % (1000 * 60 * 60)) / (1000 * 60));
      
      const completionDate = new Date(research.completion_time);
      
      embed.addFields({
        name: `${research.icon} ${research.name} (Niveau ${research.next_level})`,
        value: `ID: \`${research.id}\`\n` +
               `Temps restant: **${remainingHours}h ${remainingMinutes}m**\n` +
               `Fin estimée: <t:${Math.floor(completionDate.getTime() / 1000)}:R>\n` +
               `Investissement: ${research.investment} PiloCoins`
      });
    }
    
    // Créer les boutons pour booster les recherches
    const buttons = new ActionRowBuilder();
    
    if (activeResearches.length > 0) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`research:boost:${business.id}:${activeResearches[0].id}`)
          .setLabel(`Booster: ${activeResearches[0].name}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🚀')
      );
    }
    
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`research:view:${business.id}`)
        .setLabel('Voir l\'arbre de recherche')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔍')
    );
    
    await interaction.editReply({
      embeds: [embed],
      components: activeResearches.length > 0 ? [buttons] : []
    });
  } catch (error) {
    console.error('Error handling view active researches:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage des recherches en cours: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'affichage des recherches terminées
 */
async function handleViewCompletedResearches(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    const researchSystem = client.researchSystem;
    
    // Récupérer les recherches terminées
    const completedResearches = researchSystem.getCompletedResearches(business.id);
    
    if (completedResearches.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.info(
            '✨ Recherches terminées',
            'Vous n\'avez aucune recherche terminée. Utilisez `/research start [id]` pour démarrer une recherche.'
          )
        ]
      });
    }
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`✨ Recherches terminées: ${business.name}`)
      .setDescription(`Votre entreprise a complété ${completedResearches.length} recherche(s).`)
      .setColor(0x00FF00)
      .setFooter({ text: 'Les recherches terminées donnent des bonus permanents à votre entreprise' });
    
    // Trier les recherches par date d'achèvement (plus récentes d'abord)
    completedResearches.sort((a, b) => b.completed_at - a.completed_at);
    
    // Ajouter les recherches à l'embed
    for (const research of completedResearches) {
      const completionDate = new Date(research.completed_at);
      
      embed.addFields({
        name: `${research.icon} ${research.name} (Niveau ${research.level}/${research.max_level})`,
        value: `ID: \`${research.id}\`\n` +
               `Complétée: <t:${Math.floor(completionDate.getTime() / 1000)}:R>\n` +
               `Effets: ${research.effect}`
      });
    }
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error handling view completed researches:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'affichage des recherches terminées: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère le démarrage d'une nouvelle recherche
 */
async function handleStartResearch(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    const researchSystem = client.researchSystem;
    const researchId = interaction.options.getString('id');
    const investmentAmount = interaction.options.getInteger('investment') || 0;
    
    // Vérifier que la recherche existe
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
    
    // Vérifier que la recherche est disponible
    const research = researchTree[researchId];
    if (research.status !== 'available') {
      let errorMessage = '';
      
      switch (research.status) {
        case 'locked':
          errorMessage = 'Cette recherche est verrouillée. Vous devez d\'abord compléter ses prérequis.';
          break;
        case 'in_progress':
          errorMessage = 'Cette recherche est déjà en cours.';
          break;
        case 'completed':
          errorMessage = 'Cette recherche est déjà terminée. Vous pouvez passer au niveau suivant.';
          break;
        case 'maxed':
          errorMessage = 'Cette recherche a déjà atteint son niveau maximum.';
          break;
        default:
          errorMessage = 'Cette recherche n\'est pas disponible actuellement.';
      }
      
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Recherche non disponible',
            errorMessage
          )
        ]
      });
    }
    
    // Démarrer la recherche
    const result = await researchSystem.startResearch(business.id, researchId, investmentAmount, userId);
    
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
    
    // Ajouter des informations sur les prérequis
    const researchData = researchTree[researchId];
    if (researchData.requirements.length > 0) {
      const prereqs = researchData.requirements.map(req => {
        const prereqData = researchTree[req];
        return `${prereqData.icon} ${prereqData.name}`;
      }).join('\n');
      
      embed.addFields({
        name: '📋 Prérequis',
        value: prereqs,
        inline: false
      });
    }
    
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`research:active:${business.id}`)
          .setLabel('Voir recherches en cours')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏳')
      );
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling start research:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors du démarrage de la recherche: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Gère l'accélération d'une recherche
 */
async function handleBoostResearch(interaction, client, business, userId) {
  await interaction.deferReply();
  
  try {
    const researchSystem = client.researchSystem;
    const researchId = interaction.options.getString('id');
    const boostAmount = interaction.options.getInteger('amount');
    
    // Vérifier que la recherche est en cours
    if (!researchSystem.isResearchInProgress(business.id, researchId)) {
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
    const result = await researchSystem.boostResearch(business.id, researchId, boostAmount, userId);
    
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
          .setCustomId(`research:active:${business.id}`)
          .setLabel('Voir recherches en cours')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏳')
      );
    
    await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    console.error('Error handling boost research:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue lors de l'accélération de la recherche: ${error.message}`
        )
      ]
    });
  }
}

/**
 * Organise les recherches par niveau de prérequis
 */
function organizeResearchByLevel(researchTree) {
  const researchByLevel = [];
  const processed = new Set();
  
  // Fonction récursive pour déterminer le niveau d'une recherche
  function getResearchLevel(researchId) {
    // Si déjà traité, retourner le niveau
    if (processed.has(researchId)) {
      for (let level = 0; level < researchByLevel.length; level++) {
        if (researchByLevel[level].some(r => r.id === researchId)) {
          return level;
        }
      }
      return 0;
    }
    
    const research = researchTree[researchId];
    
    // Si pas de prérequis, c'est niveau 0
    if (!research.requirements || research.requirements.length === 0) {
      processed.add(researchId);
      return 0;
    }
    
    // Sinon, c'est 1 + le niveau max des prérequis
    let maxPrereqLevel = -1;
    
    for (const prereqId of research.requirements) {
      const prereqLevel = getResearchLevel(prereqId);
      maxPrereqLevel = Math.max(maxPrereqLevel, prereqLevel);
    }
    
    processed.add(researchId);
    return maxPrereqLevel + 1;
  }
  
  // Déterminer le niveau de chaque recherche
  for (const researchId in researchTree) {
    const level = getResearchLevel(researchId);
    
    // S'assurer que le tableau a assez de niveaux
    while (researchByLevel.length <= level) {
      researchByLevel.push([]);
    }
    
    // Ajouter la recherche à son niveau
    researchByLevel[level].push({
      ...researchTree[researchId],
      id: researchId
    });
  }
  
  return researchByLevel;
}