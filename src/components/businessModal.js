import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';

export const businessModalHandler = async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  const { client, customId } = interaction;
  
  // Vérifier si c'est un modal business
  if (!customId.startsWith('business_')) return;
  
  const [prefix, action, ...params] = customId.split('_');
  
  try {
    // Traiter les différents types de modaux
    switch (action) {
      case 'create':
        await handleBusinessCreation(interaction, client);
        break;
      case 'rename':
        await handleBusinessRename(interaction, client, params[0]);
        break;
      case 'description':
        await handleBusinessDescription(interaction, client, params[0]);
        break;
      case 'hire':
        await handleEmployeeHire(interaction, client, params[0]);
        break;
      case 'upgrade':
        await handleAssetUpgrade(interaction, client, params[0], params[1]);
        break;
      default:
        await interaction.reply({
          content: "Type de modal non reconnu.",
          ephemeral: true
        });
    }
  } catch (error) {
    console.error(`Erreur dans businessModalHandler: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors du traitement de ce formulaire.",
      ephemeral: true
    });
  }
};

/**
 * Gère la création d'une nouvelle entreprise
 */
async function handleBusinessCreation(interaction, client) {
  try {
    const { BusinessManager } = await import('../utils/businessManager.js');
    const businessManager = new BusinessManager(client);
    
    // Récupérer les valeurs du formulaire
    const name = interaction.fields.getTextInputValue('name');
    const type = interaction.fields.getTextInputValue('type');
    const description = interaction.fields.getTextInputValue('description') || '';
    
    // Valider les entrées
    if (name.length < 3 || name.length > 50) {
      return interaction.reply({
        content: 'Le nom de l\'entreprise doit faire entre 3 et 50 caractères.',
        ephemeral: true
      });
    }
    
    const validTypes = ['tech_company', 'restaurant', 'factory', 'farm', 'mining_company', 'hotel'];
    if (!validTypes.includes(type.toLowerCase()) && !validTypes.some(t => type.toLowerCase().includes(t))) {
      return interaction.reply({
        content: `Type d'entreprise non valide. Choisissez parmi: ${validTypes.join(', ')}`,
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur possède déjà une entreprise
    const userId = interaction.user.id;
    const userBusinesses = await client.db.db.all(`
      SELECT * FROM businesses WHERE owner_id = ?
    `, userId);
    
    if (userBusinesses.length >= 3) {
      return interaction.reply({
        content: 'Vous possédez déjà le maximum d\'entreprises autorisé (3).',
        ephemeral: true
      });
    }
    
    // Créer l'entreprise
    const businessId = uuidv4();
    const businessType = validTypes.find(t => type.toLowerCase().includes(t)) || 'tech_company';
    
    await client.db.db.run(`
      INSERT INTO businesses (id, name, owner_id, type, description)
      VALUES (?, ?, ?, ?, ?)
    `, businessId, name, userId, businessType, description);
    
    // Ajouter le propriétaire comme membre avec le rôle OWNER
    await client.db.db.run(`
      INSERT INTO business_members (business_id, user_id, role)
      VALUES (?, ?, 'OWNER')
    `, businessId, userId);
    
    // Ajouter les actifs de base selon le type d'entreprise
    const startingAssets = getStartingAssets(businessType, businessId);
    for (const asset of startingAssets) {
      await client.db.db.run(`
        INSERT INTO business_assets (id, business_id, type, name, production_rate, maintenance_cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `, uuidv4(), businessId, asset.type, asset.name, asset.production_rate, asset.maintenance_cost);
    }
    
    // Créer une réponse avec embed
    const embed = new EmbedBuilder()
      .setTitle('🏢 Entreprise créée avec succès!')
      .setDescription(`Votre entreprise **${name}** a été créée!`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Type', value: getBusinessTypeName(businessType), inline: true },
        { name: 'ID', value: businessId, inline: true }
      );
    
    if (description) {
      embed.addFields({ name: 'Description', value: description });
    }
    
    // Ajouter un bouton pour gérer l'entreprise
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`business_manage_${businessId}`)
          .setLabel('Gérer votre entreprise')
          .setStyle(ButtonStyle.Primary)
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error creating business:', error);
    await interaction.reply({
      content: `Une erreur est survenue lors de la création de l'entreprise: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Gère le changement de nom d'une entreprise
 */
async function handleBusinessRename(interaction, client, businessId) {
  try {
    const { BusinessManager } = await import('../utils/businessManager.js');
    const businessManager = new BusinessManager(client);
    
    // Vérifier les permissions
    const hasPermission = await businessManager.checkBusinessPermission(
      interaction.user.id, 
      businessId, 
      'MANAGE_BUSINESS'
    );
    
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de renommer cette entreprise.",
        ephemeral: true
      });
    }
    
    // Récupérer le nouveau nom
    const newName = interaction.fields.getTextInputValue('name');
    
    // Valider le nom
    if (newName.length < 3 || newName.length > 50) {
      return interaction.reply({
        content: 'Le nom de l\'entreprise doit faire entre 3 et 50 caractères.',
        ephemeral: true
      });
    }
    
    // Mettre à jour le nom
    await client.db.db.run(`
      UPDATE businesses
      SET name = ?
      WHERE id = ?
    `, newName, businessId);
    
    // Récupérer les infos mises à jour
    const business = await businessManager.getBusiness(businessId);
    
    // Créer une réponse avec embed
    const embed = new EmbedBuilder()
      .setTitle('✅ Nom modifié')
      .setDescription(`Le nom de l'entreprise a été changé pour **${newName}**.`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Type', value: getBusinessTypeName(business.type), inline: true },
        { name: 'ID', value: businessId, inline: true }
      );
    
    // Ajouter un bouton pour gérer l'entreprise
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`business_manage_${businessId}`)
          .setLabel('Retour à la gestion')
          .setStyle(ButtonStyle.Secondary)
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error renaming business:', error);
    await interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Gère la modification de la description d'une entreprise
 */
async function handleBusinessDescription(interaction, client, businessId) {
  try {
    const { BusinessManager } = await import('../utils/businessManager.js');
    const businessManager = new BusinessManager(client);
    
    // Vérifier les permissions
    const hasPermission = await businessManager.checkBusinessPermission(
      interaction.user.id, 
      businessId, 
      'MANAGE_BUSINESS'
    );
    
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de modifier cette entreprise.",
        ephemeral: true
      });
    }
    
    // Récupérer la nouvelle description
    const newDescription = interaction.fields.getTextInputValue('description');
    
    // Mettre à jour la description
    await client.db.db.run(`
      UPDATE businesses
      SET description = ?
      WHERE id = ?
    `, newDescription, businessId);
    
    // Récupérer les infos mises à jour
    const business = await businessManager.getBusiness(businessId);
    
    // Créer une réponse avec embed
    const embed = new EmbedBuilder()
      .setTitle('✅ Description modifiée')
      .setDescription(`La description de **${business.name}** a été mise à jour.`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Nouvelle description', value: newDescription || '*Aucune description*' }
      );
    
    // Ajouter un bouton pour gérer l'entreprise
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`business_manage_${businessId}`)
          .setLabel('Retour à la gestion')
          .setStyle(ButtonStyle.Secondary)
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error updating business description:', error);
    await interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Gère l'embauche d'un nouvel employé
 */
async function handleEmployeeHire(interaction, client, businessId) {
  try {
    const { BusinessManager } = await import('../utils/businessManager.js');
    const businessManager = new BusinessManager(client);
    
    // Vérifier les permissions
    const hasPermission = await businessManager.checkBusinessPermission(
      interaction.user.id, 
      businessId, 
      'MANAGE_EMPLOYEES'
    );
    
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de gérer les employés de cette entreprise.",
        ephemeral: true
      });
    }
    
    // Récupérer les infos de l'employé
    const name = interaction.fields.getTextInputValue('name');
    const role = interaction.fields.getTextInputValue('role');
    const salaryStr = interaction.fields.getTextInputValue('salary');
    
    // Valider les entrées
    if (name.length < 2 || name.length > 30) {
      return interaction.reply({
        content: 'Le nom de l\'employé doit faire entre 2 et 30 caractères.',
        ephemeral: true
      });
    }
    
    const salary = parseInt(salaryStr);
    if (isNaN(salary) || salary < 0) {
      return interaction.reply({
        content: 'Le salaire doit être un nombre positif.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'entreprise a assez de fonds
    const business = await businessManager.getBusiness(businessId);
    if (business.balance < salary * 2) {
      return interaction.reply({
        content: `Fonds insuffisants. Vous avez besoin d'au moins ${salary * 2}€ pour embaucher cet employé (2x le salaire).`,
        ephemeral: true
      });
    }
    
    // Créer l'employé
    const employeeId = uuidv4();
    await client.db.db.run(`
      INSERT INTO business_employees (id, business_id, name, role, salary)
      VALUES (?, ?, ?, ?, ?)
    `, employeeId, businessId, name, role, salary);
    
    // Créer une réponse avec embed
    const embed = new EmbedBuilder()
      .setTitle('👨‍💼 Nouvel employé embauché')
      .setDescription(`**${name}** a été embauché dans votre entreprise.`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Poste', value: role, inline: true },
        { name: 'Salaire', value: `${salary}€`, inline: true },
        { name: 'Productivité', value: '100%', inline: true }
      );
    
    // Ajouter un bouton pour gérer les employés
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`business_employees_${businessId}`)
          .setLabel('Gérer les employés')
          .setStyle(ButtonStyle.Primary)
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error hiring employee:', error);
    await interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Gère l'amélioration d'un actif
 */
async function handleAssetUpgrade(interaction, client, businessId, assetId) {
  try {
    const { BusinessManager } = await import('../utils/businessManager.js');
    const businessManager = new BusinessManager(client);
    
    // Vérifier les permissions
    const hasPermission = await businessManager.checkBusinessPermission(
      interaction.user.id, 
      businessId, 
      'MANAGE_ASSETS'
    );
    
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de gérer les actifs de cette entreprise.",
        ephemeral: true
      });
    }
    
    // Récupérer les informations sur l'actif
    const asset = await client.db.db.get(`
      SELECT * FROM business_assets
      WHERE id = ? AND business_id = ?
    `, assetId, businessId);
    
    if (!asset) {
      return interaction.reply({
        content: "Cet actif n'existe pas ou n'appartient pas à cette entreprise.",
        ephemeral: true
      });
    }
    
    // Récupérer les informations sur l'entreprise
    const business = await businessManager.getBusiness(businessId);
    
    // Calculer le coût de l'amélioration
    const currentLevel = asset.level;
    const upgradeCost = Math.floor(1000 * Math.pow(1.5, currentLevel));
    
    // Vérifier si l'entreprise a assez de fonds
    if (business.balance < upgradeCost) {
      return interaction.reply({
        content: `Fonds insuffisants. L'amélioration coûte ${upgradeCost}€, mais vous n'avez que ${business.balance}€.`,
        ephemeral: true
      });
    }
    
    // Mettre à jour le niveau
    await client.db.db.run(`
      UPDATE business_assets
      SET level = level + 1,
          production_rate = CASE 
            WHEN production_rate > 0 THEN production_rate * 1.2 
            ELSE production_rate 
          END,
          maintenance_cost = maintenance_cost * 1.1
      WHERE id = ?
    `, assetId);
    
    // Déduire le coût
    await client.db.db.run(`
      UPDATE businesses
      SET balance = balance - ?
      WHERE id = ?
    `, upgradeCost, businessId);
    
    // Récupérer les informations mises à jour
    const updatedAsset = await client.db.db.get(`
      SELECT * FROM business_assets
      WHERE id = ?
    `, assetId);
    
    // Créer une réponse avec embed
    const embed = new EmbedBuilder()
      .setTitle('⬆️ Amélioration réussie')
      .setDescription(`**${asset.name}** a été amélioré au niveau ${updatedAsset.level}.`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Coût', value: `${upgradeCost}€`, inline: true },
        { name: 'Production', value: `${Math.floor(updatedAsset.production_rate)}`, inline: true },
        { name: 'Maintenance', value: `${Math.floor(updatedAsset.maintenance_cost)}€`, inline: true }
      );
    
    // Ajouter un bouton pour gérer les actifs
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`business_assets_${businessId}`)
          .setLabel('Gérer les actifs')
          .setStyle(ButtonStyle.Primary)
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error upgrading asset:', error);
    await interaction.reply({
      content: `Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

/**
 * Retourne les actifs de départ en fonction du type d'entreprise
 */
function getStartingAssets(businessType, businessId) {
  switch (businessType) {
    case 'tech_company':
      return [
        { type: 'building', name: 'Bureau', production_rate: 50, maintenance_cost: 100 },
        { type: 'equipment', name: 'Ordinateurs', production_rate: 100, maintenance_cost: 50 }
      ];
    case 'restaurant':
      return [
        { type: 'building', name: 'Local', production_rate: 75, maintenance_cost: 120 },
        { type: 'equipment', name: 'Cuisine', production_rate: 150, maintenance_cost: 80 }
      ];
    case 'factory':
      return [
        { type: 'building', name: 'Hangar industriel', production_rate: 200, maintenance_cost: 300 },
        { type: 'equipment', name: 'Machines', production_rate: 300, maintenance_cost: 150 }
      ];
    case 'farm':
      return [
        { type: 'land', name: 'Terrain agricole', production_rate: 150, maintenance_cost: 50 },
        { type: 'equipment', name: 'Matériel agricole', production_rate: 100, maintenance_cost: 100 }
      ];
    case 'mining_company':
      return [
        { type: 'land', name: 'Site d\'extraction', production_rate: 250, maintenance_cost: 300 },
        { type: 'equipment', name: 'Équipement minier', production_rate: 200, maintenance_cost: 250 }
      ];
    case 'hotel':
      return [
        { type: 'building', name: 'Bâtiment hôtelier', production_rate: 300, maintenance_cost: 400 },
        { type: 'furniture', name: 'Ameublement', production_rate: 150, maintenance_cost: 100 }
      ];
    default:
      return [
        { type: 'building', name: 'Local commercial', production_rate: 100, maintenance_cost: 100 },
        { type: 'equipment', name: 'Équipement standard', production_rate: 100, maintenance_cost: 50 }
      ];
  }
}

/**
 * Retourne le nom formaté du type d'entreprise
 */
function getBusinessTypeName(type) {
  const types = {
    'tech_company': '💻 Entreprise technologique',
    'restaurant': '🍽️ Restaurant',
    'factory': '🏭 Usine',
    'farm': '🚜 Ferme',
    'mining_company': '⛏️ Entreprise minière',
    'hotel': '🏨 Hôtel'
  };
  
  return types[type] || '🏢 Entreprise';
}