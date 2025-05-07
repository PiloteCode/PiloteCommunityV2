import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  // Modal patterns:
  // - quantity:{businessId}:{assetType} - Custom quantity for asset purchase
  // - hire:{businessId} - Hire a new employee
  // - fire:reason:{businessId}:{userId} - Reason for firing an employee
  // - salary:change:{businessId}:{userId} - Change employee salary
  async execute(interaction, client) {
    try {
      // Parse the custom ID
      const customId = interaction.customId;
      const userId = interaction.user.id;
      
      // Récupérer le gestionnaire d'entreprise
      const manager = client.businessManager;
      
      if (!manager) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur système',
              'Le gestionnaire d\'entreprise n\'est pas initialisé.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Handle different modal types
      if (customId.startsWith('quantity:')) {
        await handleQuantityModal(interaction, client, manager, userId);
      }
      else if (customId.startsWith('hire:')) {
        await handleHireModal(interaction, client, manager, userId);
      }
      else if (customId.startsWith('fire:reason:')) {
        await handleFireReasonModal(interaction, client, manager, userId);
      }
      else if (customId.startsWith('salary:change:')) {
        await handleSalaryChangeModal(interaction, client, manager, userId);
      }
      
    } catch (error) {
      console.error('Error handling corporation modal:', error);
      
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
 * Gère le modal de quantité personnalisée pour l'achat d'actif
 */
async function handleQuantityModal(interaction, client, manager, userId) {
  try {
    // Parse the custom ID to get business ID and asset type
    const [action, businessId, assetType] = interaction.customId.split(':');
    
    // Get the submitted quantity
    const quantity = parseInt(interaction.fields.getTextInputValue('quantity'));
    
    // Validate quantity
    if (isNaN(quantity) || quantity < 1 || quantity > 100) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Quantité invalide',
            'La quantité doit être un nombre entre 1 et 100.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Fetch the business
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
    
    // Verify permissions
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
    
    // Get asset data
    const assetData = manager.assetTypes[assetType];
    if (!assetData) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Actif invalide',
            'Cet actif n\'existe pas.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Calculate total cost
    const totalCost = assetData.base_cost * quantity;
    
    // Check if business has enough capital
    if (business.capital < totalCost) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Fonds insuffisants',
            `Votre entreprise n'a pas assez de capital pour cet achat. Il faut ${totalCost} PiloCoins (disponible: ${business.capital}).`
          )
        ],
        ephemeral: true
      });
    }
    
    // Purchase the asset
    await interaction.deferReply();
    const result = await manager.purchaseAsset(business.id, assetType, quantity, userId);
    
    // Create confirmation embed
    const embed = EmbedCreator.success(
      '🛒 Achat réussi',
      `Vous avez acheté ${quantity} ${assetData.name} pour votre entreprise **${business.name}** !`,
      {
        fields: [
          {
            name: '💰 Coût total',
            value: `${totalCost} PiloCoins`,
            inline: true
          },
          {
            name: '📈 Production additionnelle',
            value: `+${Math.round(assetData.base_production * quantity)} PiloCoins/h`,
            inline: true
          },
          {
            name: '🔧 Coût de maintenance',
            value: `${assetData.maintenance_cost * quantity} PiloCoins/h`,
            inline: true
          },
          {
            name: '💼 Capital restant',
            value: `${business.capital - totalCost} PiloCoins`,
            inline: true
          }
        ]
      }
    );
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error handling quantity modal:', error);
    
    return interaction.reply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue: ${error.message}`
        )
      ],
      ephemeral: true
    });
  }
}

/**
 * Gère le modal d'embauche d'un employé
 */
async function handleHireModal(interaction, client, manager, userId) {
  try {
    // Parse the custom ID to get business ID
    const [action, businessId] = interaction.customId.split(':');
    
    // Get the submitted values
    const targetUserId = interaction.fields.getTextInputValue('userId');
    const role = interaction.fields.getTextInputValue('role').toLowerCase();
    const salary = parseInt(interaction.fields.getTextInputValue('salary'));
    
    // Validate role
    if (role !== 'manager' && role !== 'employee') {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Rôle invalide',
            'Le rôle doit être "manager" ou "employee".'
          )
        ],
        ephemeral: true
      });
    }
    
    // Validate salary
    if (isNaN(salary) || salary < 10 || salary > 10000) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Salaire invalide',
            'Le salaire doit être un nombre entre 10 et 10000 PiloCoins.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Fetch the business
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
    
    // Verify permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_hire');
    if (!hasPermission) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission d\'embaucher des employés pour cette entreprise.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Check if target user exists
    const targetUser = await client.db.getUser(targetUserId);
    if (!targetUser) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Utilisateur introuvable',
            'Cet utilisateur n\'existe pas dans la base de données.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Hire the employee
    await interaction.deferReply();
    await manager.hireEmployee(business.id, targetUserId, role, salary, userId);
    
    // Create confirmation embed
    const embed = EmbedCreator.success(
      '👨‍💼 Employé embauché',
      `<@${targetUserId}> a été embauché comme ${role === 'manager' ? 'manager' : 'employé'} avec un salaire de ${salary} PiloCoins/jour.`,
      {
        fields: [
          {
            name: '💼 Entreprise',
            value: business.name,
            inline: true
          },
          {
            name: '👤 Rôle',
            value: role === 'manager' ? 'Manager' : 'Employé',
            inline: true
          },
          {
            name: '💰 Salaire',
            value: `${salary} PiloCoins/jour`,
            inline: true
          }
        ]
      }
    );
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error handling hire modal:', error);
    
    if (interaction.deferred) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue: ${error.message}`
          )
        ]
      });
    } else {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue: ${error.message}`
          )
        ],
        ephemeral: true
      });
    }
  }
}

/**
 * Gère le modal de raison de licenciement
 */
async function handleFireReasonModal(interaction, client, manager, userId) {
  try {
    // Parse the custom ID to get business ID and target user ID
    const [base, action, businessId, targetUserId] = interaction.customId.split(':');
    
    // Get the submitted reason
    const reason = interaction.fields.getTextInputValue('reason');
    
    // Fetch the business
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
    
    // Verify permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_fire');
    if (!hasPermission) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission de licencier des employés dans cette entreprise.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Fire the employee
    await interaction.deferReply();
    await manager.fireEmployee(business.id, targetUserId, userId, reason);
    
    // Create confirmation embed
    const embed = EmbedCreator.success(
      '🚫 Employé licencié',
      `<@${targetUserId}> a été licencié de l'entreprise **${business.name}**.`,
      {
        fields: [
          {
            name: '📝 Raison',
            value: reason,
            inline: false
          }
        ]
      }
    );
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error handling fire reason modal:', error);
    
    if (interaction.deferred) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue: ${error.message}`
          )
        ]
      });
    } else {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue: ${error.message}`
          )
        ],
        ephemeral: true
      });
    }
  }
}

/**
 * Gère le modal de changement de salaire
 */
async function handleSalaryChangeModal(interaction, client, manager, userId) {
  try {
    // Parse the custom ID to get business ID and target user ID
    const [base, action, businessId, targetUserId] = interaction.customId.split(':');
    
    // Get the submitted salary
    const newSalary = parseInt(interaction.fields.getTextInputValue('salary'));
    
    // Validate salary
    if (isNaN(newSalary) || newSalary < 10 || newSalary > 10000) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Salaire invalide',
            'Le salaire doit être un nombre entre 10 et 10000 PiloCoins.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Fetch the business
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
    
    // Verify permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_change_salary');
    if (!hasPermission) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission de modifier les salaires dans cette entreprise.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Get current employee data
    const employee = await client.db.db.get(`
      SELECT * FROM business_members
      WHERE business_id = ? AND user_id = ?
    `, businessId, targetUserId);
    
    if (!employee) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Employé introuvable',
            'Cet employé ne travaille pas dans cette entreprise.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Change the salary
    await interaction.deferReply();
    await manager.changeSalary(business.id, targetUserId, newSalary, userId);
    
    // Create confirmation embed
    const embed = EmbedCreator.success(
      '💰 Salaire modifié',
      `Le salaire de <@${targetUserId}> a été modifié dans l'entreprise **${business.name}**.`,
      {
        fields: [
          {
            name: '💰 Ancien salaire',
            value: `${employee.salary} PiloCoins/jour`,
            inline: true
          },
          {
            name: '💰 Nouveau salaire',
            value: `${newSalary} PiloCoins/jour`,
            inline: true
          },
          {
            name: '📊 Différence',
            value: `${newSalary > employee.salary ? '+' : ''}${newSalary - employee.salary} PiloCoins/jour`,
            inline: true
          }
        ]
      }
    );
    
    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error handling salary change modal:', error);
    
    if (interaction.deferred) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue: ${error.message}`
          )
        ]
      });
    } else {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            `Une erreur est survenue: ${error.message}`
          )
        ],
        ephemeral: true
      });
    }
  }
}