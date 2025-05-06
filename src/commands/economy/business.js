import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('business')
    .setDescription('Gérez votre entreprise et générez des revenus passifs')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Créez votre propre entreprise')
        .addStringOption(option =>
          option.setName('nom')
            .setDescription('Nom de votre entreprise')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type d\'entreprise')
            .setRequired(true)
            .addChoices(
              { name: 'Restaurant', value: 'restaurant' },
              { name: 'Magasin', value: 'shop' },
              { name: 'Technologie', value: 'tech' },
              { name: 'Divertissement', value: 'entertainment' },
              { name: 'Immobilier', value: 'real_estate' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Consultez les informations de votre entreprise'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('collect')
        .setDescription('Collectez les revenus de votre entreprise'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('upgrade')
        .setDescription('Améliorez votre entreprise')
        .addStringOption(option =>
          option.setName('aspect')
            .setDescription('Aspect à améliorer')
            .setRequired(true)
            .addChoices(
              { name: 'Productivité', value: 'productivity' },
              { name: 'Marketing', value: 'marketing' },
              { name: 'Personnel', value: 'staff' },
              { name: 'Équipement', value: 'equipment' }
            ))),

  cooldown: 5000, // 5 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Récupérer les données utilisateur et entreprise
      const user = await client.db.getUser(userId);
      
      // Créer la table des entreprises si elle n'existe pas
      await createBusinessTable(client);
      
      // Récupérer l'entreprise de l'utilisateur
      const business = await getUserBusiness(client, userId);
      
      if (subcommand === 'create') {
        // Vérifier si l'utilisateur a déjà une entreprise
        if (business) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Entreprise existante', 
                'Vous possédez déjà une entreprise. Utilisez `/business info` pour voir ses détails.'
              )
            ]
          });
        }
        
        const businessName = interaction.options.getString('nom');
        const businessType = interaction.options.getString('type');
        
        // Coût de création d'une entreprise
        const creationCost = 5000;
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < creationCost) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants', 
                `La création d'une entreprise coûte ${creationCost} crédits. Vous n'avez que ${user.balance} crédits.`
              )
            ]
          });
        }
        
        // Créer l'entreprise
        await createBusiness(client, userId, businessName, businessType);
        
        // Déduire le coût
        await client.db.updateUserBalance(userId, -creationCost);
        
        // Confirmer la création
        return interaction.editReply({
          embeds: [
            EmbedCreator.success(
              '🏢 Entreprise créée',
              `Félicitations ! Vous avez créé **${businessName}** pour ${creationCost} crédits. Utilisez \`/business collect\` pour collecter vos revenus régulièrement.`,
              {
                fields: [
                  {
                    name: '📊 Type',
                    value: getBusinessTypeName(businessType),
                    inline: true
                  },
                  {
                    name: '💸 Revenus initiaux',
                    value: '50 crédits / heure',
                    inline: true
                  },
                  {
                    name: '💰 Solde restant',
                    value: `${user.balance - creationCost} crédits`,
                    inline: true
                  }
                ]
              }
            )
          ]
        });
      }
      
      else if (subcommand === 'info') {
        // Vérifier si l'utilisateur a une entreprise
        if (!business) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Aucune entreprise', 
                'Vous ne possédez pas encore d\'entreprise. Utilisez `/business create` pour en créer une.'
              )
            ]
          });
        }
        
        // Calculer le temps écoulé depuis la dernière collecte
        const lastCollect = new Date(business.last_collect);
        const now = new Date();
        const hoursSinceCollect = Math.floor((now - lastCollect) / (1000 * 60 * 60));
        
        // Calculer les revenus en attente
        const pendingIncome = calculatePendingIncome(business, hoursSinceCollect);
        
        // Créer l'embed
        const embed = EmbedCreator.economy(
          `🏢 ${business.name}`,
          `Voici les informations de votre entreprise de type **${getBusinessTypeName(business.type)}**.`,
          {
            fields: [
              {
                name: '📈 Niveau',
                value: `${business.level}`,
                inline: true
              },
              {
                name: '💰 Revenus horaires',
                value: `${business.hourly_income} crédits`,
                inline: true
              },
              {
                name: '⏱️ En attente',
                value: `${pendingIncome} crédits (${hoursSinceCollect}h)`,
                inline: true
              },
              {
                name: '👥 Personnel',
                value: `Niveau ${business.staff_level}`,
                inline: true
              },
              {
                name: '📣 Marketing',
                value: `Niveau ${business.marketing_level}`,
                inline: true
              },
              {
                name: '🔧 Équipement',
                value: `Niveau ${business.equipment_level}`,
                inline: true
              },
              {
                name: '💎 Total collecté',
                value: `${business.total_collected} crédits`,
                inline: false
              }
            ],
            footer: {
              text: `Créée le ${new Date(business.created_at).toLocaleDateString('fr-FR')}`,
              iconURL: interaction.user.avatarURL()
            }
          }
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      else if (subcommand === 'collect') {
        // Vérifier si l'utilisateur a une entreprise
        if (!business) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Aucune entreprise', 
                'Vous ne possédez pas encore d\'entreprise. Utilisez `/business create` pour en créer une.'
              )
            ]
          });
        }
        
        // Calculer le temps écoulé depuis la dernière collecte
        const lastCollect = new Date(business.last_collect);
        const now = new Date();
        const hoursSinceCollect = Math.floor((now - lastCollect) / (1000 * 60 * 60));
        
        // Si moins d'une heure s'est écoulée
        if (hoursSinceCollect < 1) {
          const minutesSinceCollect = Math.floor((now - lastCollect) / (1000 * 60));
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                'Collecte trop tôt', 
                `Vous devez attendre au moins 1 heure entre les collectes. Dernier collecte il y a ${minutesSinceCollect} minutes.`
              )
            ]
          });
        }
        
        // Calculer les revenus
        const income = calculatePendingIncome(business, hoursSinceCollect);
        
        // Mettre à jour la dernière collecte et le total collecté
        await updateBusinessCollection(client, business.id, income);
        
        // Ajouter les revenus au solde de l'utilisateur
        await client.db.updateUserBalance(userId, income);
        
        // Confirmer la collecte
        return interaction.editReply({
          embeds: [
            EmbedCreator.success(
              '💰 Revenus collectés',
              `Vous avez collecté **${income} crédits** de votre entreprise **${business.name}**.`,
              {
                fields: [
                  {
                    name: '⏱️ Période',
                    value: `${hoursSinceCollect} heures`,
                    inline: true
                  },
                  {
                    name: '📊 Revenus horaires',
                    value: `${business.hourly_income} crédits`,
                    inline: true
                  },
                  {
                    name: '💵 Nouveau solde',
                    value: `${user.balance + income} crédits`,
                    inline: true
                  }
                ]
              }
            )
          ]
        });
      }
      
      else if (subcommand === 'upgrade') {
        // Vérifier si l'utilisateur a une entreprise
        if (!business) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Aucune entreprise', 
                'Vous ne possédez pas encore d\'entreprise. Utilisez `/business create` pour en créer une.'
              )
            ]
          });
        }
        
        const aspect = interaction.options.getString('aspect');
        
        // Obtenir le niveau actuel de l'aspect
        let currentLevel;
        switch (aspect) {
          case 'productivity':
            currentLevel = business.level;
            break;
          case 'marketing':
            currentLevel = business.marketing_level;
            break;
          case 'staff':
            currentLevel = business.staff_level;
            break;
          case 'equipment':
            currentLevel = business.equipment_level;
            break;
        }
        
        // Calculer le coût de l'amélioration
        const upgradeCost = calculateUpgradeCost(aspect, currentLevel);
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < upgradeCost) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants', 
                `L'amélioration coûte ${upgradeCost} crédits. Vous n'avez que ${user.balance} crédits.`
              )
            ]
          });
        }
        
        // Créer les boutons de confirmation
        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('business_confirm_upgrade')
              .setLabel('Confirmer')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('business_cancel_upgrade')
              .setLabel('Annuler')
              .setStyle(ButtonStyle.Danger)
          );
        
        // Stocker les données pour le gestionnaire de boutons
        const upgradeData = {
          userId,
          businessId: business.id,
          aspect,
          currentLevel,
          upgradeCost,
          newIncome: calculateNewIncome(business, aspect, currentLevel + 1)
        };
        
        // Attacher les données à la session utilisateur temporairement
        if (!client.businessUpgrades) client.businessUpgrades = new Map();
        client.businessUpgrades.set(userId, upgradeData);
        
        // Demander confirmation
        return interaction.editReply({
          embeds: [
            EmbedCreator.warning(
              '⚠️ Confirmation d\'amélioration',
              `Voulez-vous vraiment améliorer l'aspect **${getAspectName(aspect)}** de votre entreprise du niveau ${currentLevel} au niveau ${currentLevel + 1} ?`,
              {
                fields: [
                  {
                    name: '💰 Coût',
                    value: `${upgradeCost} crédits`,
                    inline: true
                  },
                  {
                    name: '📈 Nouveau revenu horaire',
                    value: `${upgradeData.newIncome} crédits`,
                    inline: true
                  },
                  {
                    name: '💵 Solde après amélioration',
                    value: `${user.balance - upgradeCost} crédits`,
                    inline: true
                  }
                ]
              }
            )
          ],
          components: [confirmRow]
        });
      }
      
    } catch (error) {
      console.error('Error in business command:', error);
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Erreur', 
            'Une erreur est survenue lors de l\'exécution de la commande.'
          )
        ]
      });
    }
  }
};

// Fonction pour créer la table des entreprises
async function createBusinessTable(client) {
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      hourly_income INTEGER NOT NULL DEFAULT 50,
      staff_level INTEGER NOT NULL DEFAULT 1,
      marketing_level INTEGER NOT NULL DEFAULT 1,
      equipment_level INTEGER NOT NULL DEFAULT 1,
      last_collect TEXT NOT NULL DEFAULT (datetime('now')),
      total_collected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
}

// Fonction pour récupérer l'entreprise d'un utilisateur
async function getUserBusiness(client, userId) {
  return await client.db.db.get(`
    SELECT * FROM businesses WHERE user_id = ?
  `, userId);
}

// Fonction pour créer une entreprise
async function createBusiness(client, userId, name, type) {
  // Déterminer le revenu initial en fonction du type
  let hourlyIncome = 50;
  switch (type) {
    case 'restaurant':
      hourlyIncome = 60;
      break;
    case 'shop':
      hourlyIncome = 55;
      break;
    case 'tech':
      hourlyIncome = 70;
      break;
    case 'entertainment':
      hourlyIncome = 65;
      break;
    case 'real_estate':
      hourlyIncome = 75;
      break;
  }

  // Insérer l'entreprise dans la base de données
  await client.db.db.run(`
    INSERT INTO businesses (
      user_id, name, type, hourly_income, last_collect
    ) VALUES (?, ?, ?, ?, datetime('now'))
  `, userId, name, type, hourlyIncome);
}

// Fonction pour calculer les revenus en attente
function calculatePendingIncome(business, hours) {
  // Limiter à 24 heures maximum pour éviter l'accumulation excessive
  const cappedHours = Math.min(hours, 24);
  return business.hourly_income * cappedHours;
}

// Fonction pour mettre à jour la dernière collecte
async function updateBusinessCollection(client, businessId, amount) {
  await client.db.db.run(`
    UPDATE businesses 
    SET last_collect = datetime('now'),
        total_collected = total_collected + ?,
        updated_at = datetime('now')
    WHERE id = ?
  `, amount, businessId);
}

// Fonction pour calculer le coût d'amélioration
function calculateUpgradeCost(aspect, currentLevel) {
  const baseMultiplier = 1000;
  let aspectMultiplier;
  
  switch (aspect) {
    case 'productivity':
      aspectMultiplier = 2.5;
      break;
    case 'marketing':
      aspectMultiplier = 2.0;
      break;
    case 'staff':
      aspectMultiplier = 1.8;
      break;
    case 'equipment':
      aspectMultiplier = 2.2;
      break;
    default:
      aspectMultiplier = 2.0;
  }
  
  return Math.floor(baseMultiplier * aspectMultiplier * Math.pow(1.5, currentLevel));
}

// Fonction pour calculer les nouveaux revenus après amélioration
function calculateNewIncome(business, aspect, newLevel) {
  let incomeMultiplier = 1.0;
  
  switch (aspect) {
    case 'productivity':
      incomeMultiplier = 1.25; // +25% par niveau
      break;
    case 'marketing':
      incomeMultiplier = 1.15; // +15% par niveau
      break;
    case 'staff':
      incomeMultiplier = 1.10; // +10% par niveau
      break;
    case 'equipment':
      incomeMultiplier = 1.20; // +20% par niveau
      break;
  }
  
  const levelDifference = newLevel - (aspect === 'productivity' ? business.level : 1);
  const baseIncome = business.hourly_income;
  
  return Math.floor(baseIncome * Math.pow(incomeMultiplier, levelDifference));
}

// Fonction pour obtenir le nom d'un type d'entreprise
function getBusinessTypeName(type) {
  switch (type) {
    case 'restaurant':
      return 'Restaurant';
    case 'shop':
      return 'Magasin';
    case 'tech':
      return 'Technologie';
    case 'entertainment':
      return 'Divertissement';
    case 'real_estate':
      return 'Immobilier';
    default:
      return 'Entreprise';
  }
}

// Fonction pour obtenir le nom d'un aspect
function getAspectName(aspect) {
  switch (aspect) {
    case 'productivity':
      return 'Productivité';
    case 'marketing':
      return 'Marketing';
    case 'staff':
      return 'Personnel';
    case 'equipment':
      return 'Équipement';
    default:
      return 'Inconnu';
  }
}