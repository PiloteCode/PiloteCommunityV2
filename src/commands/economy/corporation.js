import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { createBusinessTables } from '../../db/business-schema.js';

export default {
  data: new SlashCommandBuilder()
    .setName('corporation')
    .setDescription('Système avancé de gestion d\'entreprise')
    .addSubcommand(subcommand =>
      subcommand
        .setName('créer')
        .setDescription('Créer une nouvelle entreprise')
        .addStringOption(option =>
          option
            .setName('nom')
            .setDescription('Nom de votre entreprise')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type d\'entreprise')
            .setRequired(true)
            .addChoices(
              { name: '💻 Entreprise Tech', value: 'tech_company' },
              { name: '⛏️ Exploitation Minière Crypto', value: 'crypto_mining' },
              { name: '🚜 Ferme', value: 'farm' },
              { name: '🍎 Verger', value: 'orchard' },
              { name: '🌸 Fleuriste', value: 'flower_shop' },
              { name: '🏭 Usine', value: 'factory' },
              { name: '⚒️ Société Minière', value: 'mining_company' },
              { name: '🍔 Restaurant', value: 'restaurant' },
              { name: '🏨 Hôtel', value: 'hotel' }
            )
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description de votre entreprise')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Afficher les informations de votre entreprise')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('collecter')
        .setDescription('Collecter les revenus de votre entreprise')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('acheter')
        .setDescription('Acheter un actif pour votre entreprise')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('upgrade')
        .setDescription('Améliorer un actif de votre entreprise')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('membres')
        .setDescription('Gérer les membres de votre entreprise')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à gérer (optionnel)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embaucher')
        .setDescription('Embaucher un nouvel employé')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à embaucher')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('rôle')
            .setDescription('Rôle dans l\'entreprise')
            .setRequired(true)
            .addChoices(
              { name: '👨‍💼 Manager', value: 'manager' },
              { name: '👤 Employé', value: 'employee' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('salaire')
            .setDescription('Salaire journalier en PiloCoins')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(10000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('licencier')
        .setDescription('Licencier un employé')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à licencier')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison du licenciement')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transactions')
        .setDescription('Voir l\'historique des transactions de votre entreprise')
        .addIntegerOption(option =>
          option
            .setName('limite')
            .setDescription('Nombre de transactions à afficher')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('permissions')
        .setDescription('Gérer les permissions des rôles dans votre entreprise')
        .addStringOption(option =>
          option
            .setName('rôle')
            .setDescription('Rôle à modifier')
            .setRequired(true)
            .addChoices(
              { name: '👨‍💼 Manager', value: 'manager' },
              { name: '👤 Employé', value: 'employee' }
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('liste')
        .setDescription('Lister différentes informations')
        .addSubcommand(subcommand =>
          subcommand
            .setName('entreprises')
            .setDescription('Liste des entreprises publiques')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('actifs')
            .setDescription('Liste des actifs disponibles pour votre entreprise')
        )
    ),
  
  // No cooldown for most operations
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      // S'assurer que les tables d'entreprise existent
      if (!client.businessInitialized) {
        await createBusinessTables(client.db.db);
        
        // Initialiser le gestionnaire d'entreprise s'il n'existe pas déjà
        if (!client.businessManager) {
          const { BusinessManager } = await import('../../utils/businessManager.js');
          client.businessManager = new BusinessManager(client);
          await client.businessManager.initialize();
        }
        
        client.businessInitialized = true;
      }
      
      const manager = client.businessManager;
      const subcommand = interaction.options.getSubcommand();
      const group = interaction.options.getSubcommandGroup(false);
      const userId = interaction.user.id;
      
      // Liste des commandes qui peuvent être utilisées sans avoir une entreprise
      const publicCommands = ['créer', 'entreprises'];
      
      // Récupérer l'entreprise de l'utilisateur pour les commandes non-publiques
      let business = null;
      
      if (!publicCommands.includes(subcommand)) {
        business = await manager.getUserBusiness(userId);
        
        if (!business && group !== 'liste') {
          return interaction.reply({
            embeds: [
              EmbedCreator.warning(
                'Pas d\'entreprise',
                'Vous ne possédez pas d\'entreprise. Utilisez `/corporation créer` pour en créer une.'
              )
            ],
            ephemeral: true
          });
        }
      }
      
      // Traiter les différentes sous-commandes
      if (subcommand === 'créer') {
        await interaction.deferReply();
        
        const name = interaction.options.getString('nom');
        const type = interaction.options.getString('type');
        const description = interaction.options.getString('description');
        
        // Vérifier si l'utilisateur a déjà une entreprise
        const existingBusiness = await manager.getUserBusiness(userId);
        
        if (existingBusiness) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                'Entreprise existante',
                `Vous possédez déjà une entreprise : ${existingBusiness.name}. Vous devez d'abord la dissoudre avec \`/corporation dissoudre\` avant d'en créer une nouvelle.`
              )
            ]
          });
        }
        
        // Vérifier le niveau de l'utilisateur
        const user = await client.db.getUser(userId);
        const requiredLevel = manager.types[type].creation_level;
        
        if (user.level < requiredLevel) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Niveau requis',
                `Vous devez être niveau ${requiredLevel} pour créer une entreprise de type ${manager.types[type].name}. Vous êtes actuellement niveau ${user.level}.`
              )
            ]
          });
        }
        
        // Vérifier si l'utilisateur a assez de PiloCoins
        const creationCost = manager.types[type].base_capital;
        
        if (user.balance < creationCost) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants',
                `Vous avez besoin de ${creationCost} PiloCoins pour créer cette entreprise (vous avez ${user.balance} PiloCoins).`
              )
            ]
          });
        }
        
        // Créer l'entreprise
        try {
          const newBusiness = await manager.createBusiness(userId, name, type, 0);
          
          // Mettre à jour la description si fournie
          if (description) {
            await client.db.db.run(`
              UPDATE businesses 
              SET description = ? 
              WHERE id = ?
            `, description, newBusiness.id);
            
            newBusiness.description = description;
          }
          
          // Générer l'embed d'information
          const embed = await manager.createBusinessEmbed(newBusiness, true, false, false);
          
          // Ajouter des informations supplémentaires
          embed.addFields({
            name: '🚀 Démarrage',
            value: 'Utilisez `/corporation acheter` pour acquérir vos premiers actifs et commencer à générer des revenus!',
            inline: false
          });
          
          await interaction.editReply({
            embeds: [embed]
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Erreur de création',
                `Une erreur est survenue lors de la création de l'entreprise : ${error.message}`
              )
            ]
          });
        }
      }
      
      else if (subcommand === 'info') {
        await interaction.deferReply();
        
        try {
          // Générer l'embed d'information complet
          const embed = await manager.createBusinessEmbed(business, true, true, true);
          
          await interaction.editReply({
            embeds: [embed]
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Erreur',
                `Une erreur est survenue : ${error.message}`
              )
            ]
          });
        }
      }
      
      else if (subcommand === 'collecter') {
        await interaction.deferReply();
        
        try {
          // Vérifier les permissions
          const hasPermission = await manager.checkPermission(business.id, userId, 'can_collect');
          
          if (!hasPermission) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.error(
                  'Permission refusée',
                  'Vous n\'avez pas la permission de collecter les revenus de cette entreprise.'
                )
              ]
            });
          }
          
          // Collecter les revenus
          const result = await manager.collectRevenue(business.id, userId);
          
          // Créer l'embed de résultat
          const embed = EmbedCreator.success(
            '💰 Revenus collectés',
            `Vous avez collecté **${Math.floor(result.netRevenue)}** PiloCoins de revenus générés par votre entreprise sur ${result.hoursSinceCollection.toFixed(1)} heures.`,
            {
              fields: [
                {
                  name: '📈 Revenus bruts',
                  value: `${Math.floor(result.revenue)} PiloCoins`,
                  inline: true
                },
                {
                  name: '🔧 Coûts de maintenance',
                  value: `${Math.floor(result.maintenanceCosts)} PiloCoins`,
                  inline: true
                },
                {
                  name: '👨‍💼 Salaires',
                  value: `${Math.floor(result.salaryCosts)} PiloCoins`,
                  inline: true
                },
                {
                  name: '💰 Revenus nets',
                  value: `${Math.floor(result.netRevenue)} PiloCoins`,
                  inline: true
                }
              ]
            }
          );
          
          await interaction.editReply({
            embeds: [embed]
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Erreur',
                `Une erreur est survenue : ${error.message}`
              )
            ]
          });
        }
      }
      
      else if (subcommand === 'acheter') {
        // Vérifier les permissions
        const hasPermission = await manager.checkPermission(business.id, userId, 'can_upgrade');
        
        if (!hasPermission) {
          return interaction.reply({
            embeds: [
              EmbedCreator.error(
                'Permission refusée',
                'Vous n\'avez pas la permission d\'acheter des actifs pour cette entreprise.'
              )
            ],
            ephemeral: true
          });
        }
        
        // Récupérer les actifs disponibles pour ce type d'entreprise
        const availableAssets = manager.types[business.type].available_assets;
        const assetOptions = availableAssets.map(assetType => {
          const asset = manager.assetTypes[assetType];
          return {
            label: asset.name,
            value: assetType,
            description: `${asset.base_cost} PiloCoins - ${asset.base_production} prod/h`,
            emoji: asset.emoji
          };
        });
        
        // Créer le menu de sélection
        const selectMenu = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`corp:asset:${business.id}`)
              .setPlaceholder('Sélectionnez un actif à acheter')
              .addOptions(assetOptions)
          );
        
        // Créer l'embed explicatif
        const embed = EmbedCreator.create({
          title: '🛒 Achat d\'actifs',
          description: `Sélectionnez un actif à acheter pour votre entreprise **${business.name}**.\n\nVous disposez de **${business.capital}** PiloCoins de capital d'entreprise.`,
          color: 'PRIMARY',
          fields: [
            {
              name: '💼 Capital disponible',
              value: `${business.capital} PiloCoins`,
              inline: true
            },
            {
              name: '📊 Niveau d\'entreprise',
              value: `${business.level}/5`,
              inline: true
            }
          ]
        });
        
        await interaction.reply({
          embeds: [embed],
          components: [selectMenu]
        });
      }
      
      else if (subcommand === 'upgrade') {
        // Vérifier les permissions
        const hasPermission = await manager.checkPermission(business.id, userId, 'can_upgrade');
        
        if (!hasPermission) {
          return interaction.reply({
            embeds: [
              EmbedCreator.error(
                'Permission refusée',
                'Vous n\'avez pas la permission d\'améliorer des actifs pour cette entreprise.'
              )
            ],
            ephemeral: true
          });
        }
        
        // Récupérer les actifs de l'entreprise
        const assets = await manager.getBusinessAssets(business.id);
        
        if (assets.length === 0) {
          return interaction.reply({
            embeds: [
              EmbedCreator.warning(
                'Aucun actif',
                'Votre entreprise ne possède aucun actif à améliorer. Utilisez `/corporation acheter` pour acquérir des actifs.'
              )
            ],
            ephemeral: true
          });
        }
        
        // Filtrer les actifs qui ne sont pas au niveau maximum
        const upgradableAssets = assets.filter(asset => {
          const assetType = manager.assetTypes[asset.asset_type];
          return asset.level < assetType.max_level;
        });
        
        if (upgradableAssets.length === 0) {
          return interaction.reply({
            embeds: [
              EmbedCreator.warning(
                'Niveau maximum',
                'Tous vos actifs sont déjà au niveau maximum.'
              )
            ],
            ephemeral: true
          });
        }
        
        // Créer les options pour le menu
        const assetOptions = upgradableAssets.map(asset => {
          const assetType = manager.assetTypes[asset.asset_type];
          const upgradeCost = assetType.base_cost * Math.pow(2, asset.level) * asset.quantity;
          
          return {
            label: `${asset.name} (Niv. ${asset.level}/${assetType.max_level})`,
            value: `${asset.id}`,
            description: `Coût: ${upgradeCost} PiloCoins`,
            emoji: assetType.emoji
          };
        });
        
        // Créer le menu de sélection
        const selectMenu = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`corp:upgrade:${business.id}`)
              .setPlaceholder('Sélectionnez un actif à améliorer')
              .addOptions(assetOptions)
          );
        
        // Créer l'embed explicatif
        const embed = EmbedCreator.create({
          title: '⬆️ Amélioration d\'actifs',
          description: `Sélectionnez un actif à améliorer pour votre entreprise **${business.name}**.\n\nVous disposez de **${business.capital}** PiloCoins de capital d'entreprise.`,
          color: 'PRIMARY',
          fields: [
            {
              name: '💼 Capital disponible',
              value: `${business.capital} PiloCoins`,
              inline: true
            },
            {
              name: '📊 Niveau d\'entreprise',
              value: `${business.level}/5`,
              inline: true
            }
          ]
        });
        
        await interaction.reply({
          embeds: [embed],
          components: [selectMenu]
        });
      }
      
      else if (subcommand === 'membres') {
        await interaction.deferReply();
        
        try {
          // Récupérer les membres de l'entreprise
          const members = await manager.getBusinessMembers(business.id);
          
          // Générer l'embed
          const embed = EmbedCreator.create({
            title: `👥 Membres de ${business.name}`,
            description: `Votre entreprise compte **${members.length}** membres sur un maximum de **${manager.types[business.type].max_employees}**.`,
            color: 'PRIMARY',
            fields: []
          });
          
          // Regrouper les membres par rôle
          const ownerMembers = members.filter(m => m.role === 'owner');
          const managerMembers = members.filter(m => m.role === 'manager');
          const employeeMembers = members.filter(m => m.role === 'employee');
          
          if (ownerMembers.length > 0) {
            const ownersText = ownerMembers.map(m => `👑 <@${m.user_id}> - ${m.salary} PiloCoins/jour`).join('\n');
            
            embed.addFields({
              name: '👑 Propriétaire',
              value: ownersText,
              inline: false
            });
          }
          
          if (managerMembers.length > 0) {
            const managersText = managerMembers.map(m => `🔱 <@${m.user_id}> - ${m.salary} PiloCoins/jour`).join('\n');
            
            embed.addFields({
              name: '🔱 Managers',
              value: managersText,
              inline: false
            });
          }
          
          if (employeeMembers.length > 0) {
            const employeesText = employeeMembers.map(m => `👤 <@${m.user_id}> - ${m.salary} PiloCoins/jour`).join('\n');
            
            embed.addFields({
              name: '👤 Employés',
              value: employeesText,
              inline: false
            });
          }
          
          // Ajouter des boutons de gestion si l'utilisateur est propriétaire
          const isOwner = ownerMembers.some(m => m.user_id === userId);
          let components = [];
          
          if (isOwner) {
            const buttons = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(`corp:embaucher:${business.id}`)
                  .setLabel('Embaucher')
                  .setStyle(ButtonStyle.Success)
                  .setEmoji('👨‍💼'),
                new ButtonBuilder()
                  .setCustomId(`corp:licencier:${business.id}`)
                  .setLabel('Licencier')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('🚫'),
                new ButtonBuilder()
                  .setCustomId(`corp:salaire:${business.id}`)
                  .setLabel('Changer salaire')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('💰')
              );
            
            components = [buttons];
          }
          
          await interaction.editReply({
            embeds: [embed],
            components: components
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Erreur',
                `Une erreur est survenue : ${error.message}`
              )
            ]
          });
        }
      }
      
      else if (subcommand === 'embaucher') {
        await interaction.deferReply();
        
        try {
          const targetUser = interaction.options.getUser('utilisateur');
          const role = interaction.options.getString('rôle');
          const salary = interaction.options.getInteger('salaire');
          
          // Vérifier les permissions
          const hasPermission = await manager.checkPermission(business.id, userId, 'can_hire');
          
          if (!hasPermission) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.error(
                  'Permission refusée',
                  'Vous n\'avez pas la permission d\'embaucher des employés dans cette entreprise.'
                )
              ]
            });
          }
          
          // Embaucher l'employé
          await manager.hireEmployee(business.id, targetUser.id, role, salary, userId);
          
          await interaction.editReply({
            embeds: [
              EmbedCreator.success(
                '👨‍💼 Employé embauché',
                `<@${targetUser.id}> a été embauché comme ${role === 'manager' ? 'manager' : 'employé'} avec un salaire de ${salary} PiloCoins/jour.`
              )
            ]
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Erreur',
                `Une erreur est survenue : ${error.message}`
              )
            ]
          });
        }
      }
      
      else if (subcommand === 'licencier') {
        await interaction.deferReply();
        
        try {
          const targetUser = interaction.options.getUser('utilisateur');
          const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
          
          // Vérifier les permissions
          const hasPermission = await manager.checkPermission(business.id, userId, 'can_fire');
          
          if (!hasPermission) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.error(
                  'Permission refusée',
                  'Vous n\'avez pas la permission de licencier des employés dans cette entreprise.'
                )
              ]
            });
          }
          
          // Licencier l'employé
          await manager.fireEmployee(business.id, targetUser.id, userId, reason);
          
          await interaction.editReply({
            embeds: [
              EmbedCreator.success(
                '🚫 Employé licencié',
                `<@${targetUser.id}> a été licencié de l'entreprise.\nRaison : ${reason}`
              )
            ]
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Erreur',
                `Une erreur est survenue : ${error.message}`
              )
            ]
          });
        }
      }
      
      else if (subcommand === 'transactions') {
        await interaction.deferReply();
        
        try {
          const limit = interaction.options.getInteger('limite') || 10;
          
          // Vérifier les permissions
          const hasPermission = await manager.checkPermission(business.id, userId, 'can_view_finances');
          
          if (!hasPermission) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.error(
                  'Permission refusée',
                  'Vous n\'avez pas la permission de consulter les finances de cette entreprise.'
                )
              ]
            });
          }
          
          // Récupérer les transactions
          const transactions = await manager.getBusinessTransactions(business.id, limit);
          
          // Créer l'embed
          const embed = EmbedCreator.create({
            title: `📒 Transactions de ${business.name}`,
            description: `Les ${limit} dernières transactions de votre entreprise.`,
            color: 'PRIMARY',
            fields: []
          });
          
          if (transactions.length === 0) {
            embed.setDescription('Aucune transaction enregistrée pour cette entreprise.');
          } else {
            let transactionsText = '';
            
            for (const tx of transactions) {
              const amountText = tx.amount >= 0 ? `+${tx.amount}` : `${tx.amount}`;
              const date = new Date(tx.created_at).toLocaleDateString();
              const time = new Date(tx.created_at).toLocaleTimeString();
              transactionsText += `${date} ${time}: **${amountText}** PiloCoins - ${tx.description}\n`;
            }
            
            embed.addFields({
              name: '📝 Historique',
              value: transactionsText,
              inline: false
            });
          }
          
          await interaction.editReply({
            embeds: [embed]
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Erreur',
                `Une erreur est survenue : ${error.message}`
              )
            ]
          });
        }
      }
      
      else if (subcommand === 'permissions') {
        // Cette sous-commande gère les permissions des rôles
        const role = interaction.options.getString('rôle');
        
        // Vérifier si l'utilisateur est le propriétaire
        const members = await manager.getBusinessMembers(business.id);
        const isOwner = members.some(m => m.user_id === userId && m.role === 'owner');
        
        if (!isOwner) {
          return interaction.reply({
            embeds: [
              EmbedCreator.error(
                'Permission refusée',
                'Seul le propriétaire peut modifier les permissions des rôles.'
              )
            ],
            ephemeral: true
          });
        }
        
        // Récupérer les permissions actuelles
        const permissions = await client.db.db.get(`
          SELECT * FROM business_permissions
          WHERE business_id = ? AND role = ?
        `, business.id, role);
        
        if (!permissions) {
          return interaction.reply({
            embeds: [
              EmbedCreator.error(
                'Erreur',
                'Impossible de récupérer les permissions pour ce rôle.'
              )
            ],
            ephemeral: true
          });
        }
        
        // Créer les boutons pour chaque permission
        const createPermissionButton = (permName, permValue, emoji, label) => {
          return new ButtonBuilder()
            .setCustomId(`corp:perm:${business.id}:${role}:${permName}`)
            .setLabel(label)
            .setStyle(permValue ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(emoji);
        };
        
        // Première rangée de boutons
        const row1 = new ActionRowBuilder()
          .addComponents(
            createPermissionButton('can_hire', permissions.can_hire, '👨‍💼', 'Embaucher'),
            createPermissionButton('can_fire', permissions.can_fire, '🚫', 'Licencier'),
            createPermissionButton('can_collect', permissions.can_collect, '💰', 'Collecter')
          );
        
        // Deuxième rangée de boutons
        const row2 = new ActionRowBuilder()
          .addComponents(
            createPermissionButton('can_upgrade', permissions.can_upgrade, '⬆️', 'Améliorer'),
            createPermissionButton('can_withdraw', permissions.can_withdraw, '💸', 'Retirer'),
            createPermissionButton('can_deposit', permissions.can_deposit, '💵', 'Déposer')
          );
        
        // Troisième rangée de boutons
        const row3 = new ActionRowBuilder()
          .addComponents(
            createPermissionButton('can_change_salary', permissions.can_change_salary, '💲', 'Modifier salaires'),
            createPermissionButton('can_change_settings', permissions.can_change_settings, '⚙️', 'Paramètres'),
            createPermissionButton('can_view_finances', permissions.can_view_finances, '📊', 'Voir finances')
          );
        
        // Créer l'embed
        const embed = EmbedCreator.create({
          title: `⚙️ Permissions : ${role}`,
          description: `Gérez les permissions pour le rôle **${role}** dans votre entreprise. Cliquez sur un bouton pour activer/désactiver une permission.`,
          color: 'PRIMARY',
          fields: [
            {
              name: '👨‍💼 Embaucher',
              value: permissions.can_hire ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '🚫 Licencier',
              value: permissions.can_fire ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '💰 Collecter',
              value: permissions.can_collect ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '⬆️ Améliorer',
              value: permissions.can_upgrade ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '💸 Retirer',
              value: permissions.can_withdraw ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '💵 Déposer',
              value: permissions.can_deposit ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '💲 Modifier salaires',
              value: permissions.can_change_salary ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '⚙️ Paramètres',
              value: permissions.can_change_settings ? '✅ Activé' : '❌ Désactivé',
              inline: true
            },
            {
              name: '📊 Voir finances',
              value: permissions.can_view_finances ? '✅ Activé' : '❌ Désactivé',
              inline: true
            }
          ]
        });
        
        await interaction.reply({
          embeds: [embed],
          components: [row1, row2, row3]
        });
      }
      
      // --- Sous-commandes du groupe "liste" ---
      else if (group === 'liste') {
        if (subcommand === 'entreprises') {
          await interaction.deferReply();
          
          // Récupérer les entreprises publiques
          const businesses = await client.db.db.all(`
            SELECT * FROM businesses
            WHERE public = 1
            ORDER BY level DESC, capital DESC
            LIMIT 10
          `);
          
          if (businesses.length === 0) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.info(
                  '🏢 Entreprises',
                  'Aucune entreprise publique n\'a été trouvée.'
                )
              ]
            });
          }
          
          // Créer l'embed
          const embed = EmbedCreator.create({
            title: '🏢 Entreprises publiques',
            description: 'Liste des 10 entreprises les plus importantes.',
            color: 'PRIMARY',
            fields: []
          });
          
          // Ajouter chaque entreprise
          for (const business of businesses) {
            const businessType = manager.types[business.type];
            const emoji = businessType ? businessType.emoji : '🏢';
            
            embed.addFields({
              name: `${emoji} ${business.name} (Niv. ${business.level})`,
              value: `Type: ${businessType ? businessType.name : business.type}\nCapital: ${business.capital} PiloCoins\nPropriétaire: <@${business.owner_id}>`,
              inline: true
            });
          }
          
          await interaction.editReply({
            embeds: [embed]
          });
        }
        
        else if (subcommand === 'actifs') {
          await interaction.deferReply();
          
          // Récupérer les actifs de l'entreprise
          const assets = await manager.getBusinessAssets(business.id);
          
          // Récupérer les actifs disponibles pour ce type d'entreprise
          const availableAssetTypes = manager.types[business.type].available_assets;
          
          if (assets.length === 0) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.info(
                  '🏭 Actifs',
                  `Votre entreprise ne possède aucun actif. Utilisez \`/corporation acheter\` pour acquérir des actifs.`
                )
              ]
            });
          }
          
          // Créer l'embed
          const embed = EmbedCreator.create({
            title: `🏭 Actifs de ${business.name}`,
            description: `Liste des actifs de votre entreprise et des actifs disponibles à l'achat.`,
            color: 'PRIMARY',
            fields: []
          });
          
          // Afficher les actifs possédés
          let ownedAssetsText = '';
          
          for (const asset of assets) {
            const assetType = manager.assetTypes[asset.asset_type];
            const emoji = assetType ? assetType.emoji : '🔧';
            const production = Math.round(asset.base_production * (asset.efficiency / 100) * asset.quantity * Math.pow(assetType.upgrade_multiplier, asset.level - 1));
            
            ownedAssetsText += `${emoji} **${asset.name}** (Niv. ${asset.level}/${assetType.max_level}) x${asset.quantity}\n`;
            ownedAssetsText += `   Production: ${production} PiloCoins/h\n`;
            ownedAssetsText += `   Entretien: ${asset.maintenance_cost} PiloCoins/h\n\n`;
          }
          
          embed.addFields({
            name: '🔧 Actifs possédés',
            value: ownedAssetsText || 'Aucun actif',
            inline: false
          });
          
          // Afficher les actifs disponibles à l'achat
          let availableAssetsText = '';
          
          for (const assetType of availableAssetTypes) {
            const asset = manager.assetTypes[assetType];
            if (!asset) continue;
            
            const alreadyOwned = assets.some(a => a.asset_type === assetType);
            const emoji = asset.emoji;
            
            availableAssetsText += `${emoji} **${asset.name}**${alreadyOwned ? ' (Possédé)' : ''}\n`;
            availableAssetsText += `   Prix: ${asset.base_cost} PiloCoins\n`;
            availableAssetsText += `   Production: ${asset.base_production} PiloCoins/h\n`;
            availableAssetsText += `   Entretien: ${asset.maintenance_cost} PiloCoins/h\n\n`;
          }
          
          embed.addFields({
            name: '🛒 Actifs disponibles',
            value: availableAssetsText || 'Aucun actif disponible',
            inline: false
          });
          
          await interaction.editReply({
            embeds: [embed]
          });
        }
      }
      
    } catch (error) {
      console.error('Error in corporation command:', error);
      
      // Send error message
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