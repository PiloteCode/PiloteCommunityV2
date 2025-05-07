import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default {
  // custom ID format: corp:action:businessId
  customId: 'corp',
  
  async execute(interaction, client) {
    try {
      // Parse the custom ID
      const [base, action, businessId] = interaction.customId.split(':');
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
      const member = await client.db.db.get(`
        SELECT * FROM business_members
        WHERE business_id = ? AND user_id = ?
      `, businessId, userId);
      
      if (!member) {
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
      
      // Traiter les différentes actions selon le premier segment du customId
      if (action === 'asset') {
        await handleAssetSelection(interaction, client, manager, business, userId);
      }
      else if (action === 'upgrade') {
        await handleAssetUpgrade(interaction, client, manager, business, userId);
      }
      else if (action === 'perm') {
        // Format: corp:perm:businessId:role:permName
        const parts = interaction.customId.split(':');
        if (parts.length < 5) return;
        
        const role = parts[3];
        const permName = parts[4];
        
        await handlePermissionToggle(interaction, client, manager, business, userId, role, permName);
      }
      else if (action === 'embaucher') {
        await handleHireModal(interaction, client, manager, business, userId);
      }
      else if (action === 'licencier') {
        await handleFireSelection(interaction, client, manager, business, userId);
      }
      else if (action === 'salaire') {
        await handleSalarySelection(interaction, client, manager, business, userId);
      }
      
    } catch (error) {
      console.error('Error in corporation select menu:', error);
      
      // Send error message
      try {
        await interaction.update({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Une erreur est survenue lors du traitement de votre sélection.'
            )
          ],
          components: []
        });
      } catch {
        await interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Une erreur est survenue lors du traitement de votre sélection.'
            )
          ],
          ephemeral: true
        });
      }
    }
  }
};

/**
 * Gère la sélection d'un actif à acheter
 */
async function handleAssetSelection(interaction, client, manager, business, userId) {
  await interaction.deferUpdate();
  
  try {
    // Récupérer l'actif sélectionné
    const assetType = interaction.values[0];
    const assetData = manager.assetTypes[assetType];
    
    if (!assetData) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Actif invalide',
            'L\'actif sélectionné n\'existe pas.'
          )
        ],
        components: []
      });
    }
    
    // Vérifier les permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_upgrade');
    
    if (!hasPermission) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission d\'acheter des actifs pour cette entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Vérifier que l'actif est disponible pour ce type d'entreprise
    const availableAssets = manager.types[business.type].available_assets;
    
    if (!availableAssets.includes(assetType)) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Actif non disponible',
            'Cet actif n\'est pas disponible pour votre type d\'entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Créer un input de quantité
    const quantityButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`asset:quantity:${business.id}:${assetType}:1`)
          .setLabel('1')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`asset:quantity:${business.id}:${assetType}:2`)
          .setLabel('2')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`asset:quantity:${business.id}:${assetType}:5`)
          .setLabel('5')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`asset:quantity:${business.id}:${assetType}:10`)
          .setLabel('10')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`asset:quantity:${business.id}:${assetType}:custom`)
          .setLabel('Personnalisé')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Créer l'embed d'information
    const embed = EmbedCreator.create({
      title: `🛒 Achat de ${assetData.name}`,
      description: `Vous allez acheter des **${assetData.name}** pour votre entreprise **${business.name}**.\n\n${assetData.description}`,
      color: 'PRIMARY',
      fields: [
        {
          name: '💰 Prix unitaire',
          value: `${assetData.base_cost} PiloCoins`,
          inline: true
        },
        {
          name: '📈 Production',
          value: `${assetData.base_production} PiloCoins/h`,
          inline: true
        },
        {
          name: '🔧 Coût de maintenance',
          value: `${assetData.maintenance_cost} PiloCoins/h`,
          inline: true
        },
        {
          name: '💼 Capital disponible',
          value: `${business.capital} PiloCoins`,
          inline: true
        },
        {
          name: '📊 Niveau max',
          value: `${assetData.max_level}`,
          inline: true
        }
      ]
    });
    
    await interaction.editReply({
      embeds: [embed],
      components: [quantityButtons]
    });
  } catch (error) {
    console.error('Error handling asset selection:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue : ${error.message}`
        )
      ],
      components: []
    });
  }
}

/**
 * Gère l'amélioration d'un actif
 */
async function handleAssetUpgrade(interaction, client, manager, business, userId) {
  await interaction.deferUpdate();
  
  try {
    // Récupérer l'actif sélectionné
    const assetId = interaction.values[0];
    
    // Vérifier les permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_upgrade');
    
    if (!hasPermission) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission d\'améliorer des actifs pour cette entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Récupérer l'actif
    const asset = await client.db.db.get(`
      SELECT * FROM business_assets
      WHERE id = ? AND business_id = ?
    `, assetId, business.id);
    
    if (!asset) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Actif introuvable',
            'Cet actif n\'existe pas dans votre entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Vérifier si l'actif est déjà au niveau maximum
    const assetData = manager.assetTypes[asset.asset_type];
    
    if (asset.level >= assetData.max_level) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.warning(
            'Niveau maximum',
            `Cet actif est déjà au niveau maximum (${assetData.max_level}).`
          )
        ],
        components: []
      });
    }
    
    // Calculer le coût d'amélioration et les bénéfices
    const upgradeCost = assetData.base_cost * Math.pow(2, asset.level) * asset.quantity;
    const currentProduction = asset.base_production * (asset.efficiency / 100) * asset.quantity * Math.pow(assetData.upgrade_multiplier, asset.level - 1);
    const newProduction = asset.base_production * (asset.efficiency / 100) * asset.quantity * Math.pow(assetData.upgrade_multiplier, asset.level);
    
    // Vérifier si l'entreprise a assez de capital
    if (business.capital < upgradeCost) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Fonds insuffisants',
            `Votre entreprise n'a pas assez de capital pour cette amélioration. Il faut ${upgradeCost} PiloCoins (disponible: ${business.capital}).`
          )
        ],
        components: []
      });
    }
    
    // Créer les boutons de confirmation
    const confirmButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`asset:upgrade:${business.id}:${assetId}:confirm`)
          .setLabel('Confirmer')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`asset:upgrade:${business.id}:${assetId}:cancel`)
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
    
    // Créer l'embed de confirmation
    const embed = EmbedCreator.create({
      title: `⬆️ Amélioration de ${asset.name}`,
      description: `Voulez-vous améliorer **${asset.name}** du niveau ${asset.level} au niveau ${asset.level + 1} pour ${upgradeCost} PiloCoins ?`,
      color: 'PRIMARY',
      fields: [
        {
          name: '💰 Coût d\'amélioration',
          value: `${upgradeCost} PiloCoins`,
          inline: true
        },
        {
          name: '📈 Production actuelle',
          value: `${Math.round(currentProduction)} PiloCoins/h`,
          inline: true
        },
        {
          name: '📈 Nouvelle production',
          value: `${Math.round(newProduction)} PiloCoins/h`,
          inline: true
        },
        {
          name: '💹 Gain de production',
          value: `+${Math.round(newProduction - currentProduction)} PiloCoins/h (+${Math.round((newProduction / currentProduction - 1) * 100)}%)`,
          inline: true
        },
        {
          name: '💼 Capital après amélioration',
          value: `${business.capital - upgradeCost} PiloCoins`,
          inline: true
        }
      ]
    });
    
    await interaction.editReply({
      embeds: [embed],
      components: [confirmButtons]
    });
  } catch (error) {
    console.error('Error handling asset upgrade:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue : ${error.message}`
        )
      ],
      components: []
    });
  }
}

/**
 * Gère le basculement d'une permission pour un rôle
 */
async function handlePermissionToggle(interaction, client, manager, business, userId, role, permName) {
  await interaction.deferUpdate();
  
  try {
    // Vérifier si l'utilisateur est le propriétaire
    const isOwner = await client.db.db.get(`
      SELECT * FROM business_members
      WHERE business_id = ? AND user_id = ? AND role = 'owner'
    `, business.id, userId);
    
    if (!isOwner) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Seul le propriétaire peut modifier les permissions des rôles.'
          )
        ],
        components: []
      });
    }
    
    // Récupérer la valeur actuelle de la permission
    const permission = await client.db.db.get(`
      SELECT ${permName} FROM business_permissions
      WHERE business_id = ? AND role = ?
    `, business.id, role);
    
    if (!permission) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Permission introuvable',
            'Impossible de récupérer cette permission.'
          )
        ],
        components: []
      });
    }
    
    // Inverser la valeur de la permission
    const newValue = permission[permName] === 1 ? 0 : 1;
    
    // Mettre à jour la permission
    await client.db.db.run(`
      UPDATE business_permissions
      SET ${permName} = ?
      WHERE business_id = ? AND role = ?
    `, newValue, business.id, role);
    
    // Récupérer toutes les permissions mises à jour
    const updatedPermissions = await client.db.db.get(`
      SELECT * FROM business_permissions
      WHERE business_id = ? AND role = ?
    `, business.id, role);
    
    // Recréer les boutons avec les nouvelles valeurs
    const createPermissionButton = (pName, pValue, emoji, label) => {
      return new ButtonBuilder()
        .setCustomId(`corp:perm:${business.id}:${role}:${pName}`)
        .setLabel(label)
        .setStyle(pValue ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji(emoji);
    };
    
    // Première rangée de boutons
    const row1 = new ActionRowBuilder()
      .addComponents(
        createPermissionButton('can_hire', updatedPermissions.can_hire, '👨‍💼', 'Embaucher'),
        createPermissionButton('can_fire', updatedPermissions.can_fire, '🚫', 'Licencier'),
        createPermissionButton('can_collect', updatedPermissions.can_collect, '💰', 'Collecter')
      );
    
    // Deuxième rangée de boutons
    const row2 = new ActionRowBuilder()
      .addComponents(
        createPermissionButton('can_upgrade', updatedPermissions.can_upgrade, '⬆️', 'Améliorer'),
        createPermissionButton('can_withdraw', updatedPermissions.can_withdraw, '💸', 'Retirer'),
        createPermissionButton('can_deposit', updatedPermissions.can_deposit, '💵', 'Déposer')
      );
    
    // Troisième rangée de boutons
    const row3 = new ActionRowBuilder()
      .addComponents(
        createPermissionButton('can_change_salary', updatedPermissions.can_change_salary, '💲', 'Modifier salaires'),
        createPermissionButton('can_change_settings', updatedPermissions.can_change_settings, '⚙️', 'Paramètres'),
        createPermissionButton('can_view_finances', updatedPermissions.can_view_finances, '📊', 'Voir finances')
      );
    
    // Créer l'embed mis à jour
    const embed = EmbedCreator.create({
      title: `⚙️ Permissions : ${role}`,
      description: `Permission **${getPermissionName(permName)}** ${newValue ? 'activée' : 'désactivée'} pour le rôle **${role}**.`,
      color: 'PRIMARY',
      fields: [
        {
          name: '👨‍💼 Embaucher',
          value: updatedPermissions.can_hire ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '🚫 Licencier',
          value: updatedPermissions.can_fire ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '💰 Collecter',
          value: updatedPermissions.can_collect ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '⬆️ Améliorer',
          value: updatedPermissions.can_upgrade ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '💸 Retirer',
          value: updatedPermissions.can_withdraw ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '💵 Déposer',
          value: updatedPermissions.can_deposit ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '💲 Modifier salaires',
          value: updatedPermissions.can_change_salary ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '⚙️ Paramètres',
          value: updatedPermissions.can_change_settings ? '✅ Activé' : '❌ Désactivé',
          inline: true
        },
        {
          name: '📊 Voir finances',
          value: updatedPermissions.can_view_finances ? '✅ Activé' : '❌ Désactivé',
          inline: true
        }
      ]
    });
    
    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2, row3]
    });
    
    // Enregistrer la transaction
    await manager.logTransaction(
      business.id,
      0,
      'permission_update',
      `Modification de la permission ${getPermissionName(permName)} pour le rôle ${role} : ${newValue ? 'Activée' : 'Désactivée'}`,
      userId
    );
  } catch (error) {
    console.error('Error handling permission toggle:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue : ${error.message}`
        )
      ],
      components: []
    });
  }
}

/**
 * Affiche un modal pour embaucher un employé
 */
async function handleHireModal(interaction, client, manager, business, userId) {
  try {
    // Vérifier les permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_hire');
    
    if (!hasPermission) {
      return interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission d\'embaucher des employés dans cette entreprise.'
          )
        ],
        ephemeral: true
      });
    }
    
    // Créer le modal
    const modal = new ModalBuilder()
      .setCustomId(`hire:${business.id}`)
      .setTitle('Embaucher un employé');
    
    // Créer les composants du modal
    const userIdInput = new TextInputBuilder()
      .setCustomId('userId')
      .setLabel('ID de l\'utilisateur à embaucher')
      .setPlaceholder('Exemple: 123456789012345678')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const roleSelect = new TextInputBuilder()
      .setCustomId('role')
      .setLabel('Rôle (manager/employee)')
      .setPlaceholder('manager ou employee')
      .setStyle(TextInputStyle.Short)
      .setValue('employee')
      .setRequired(true);
    
    const salaryInput = new TextInputBuilder()
      .setCustomId('salary')
      .setLabel('Salaire journalier (en PiloCoins)')
      .setPlaceholder('Exemple: 100')
      .setStyle(TextInputStyle.Short)
      .setValue('100')
      .setRequired(true);
    
    // Ajouter les composants au modal
    const userIdRow = new ActionRowBuilder().addComponents(userIdInput);
    const roleRow = new ActionRowBuilder().addComponents(roleSelect);
    const salaryRow = new ActionRowBuilder().addComponents(salaryInput);
    
    modal.addComponents(userIdRow, roleRow, salaryRow);
    
    // Afficher le modal
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error showing hire modal:', error);
    
    await interaction.reply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue : ${error.message}`
        )
      ],
      ephemeral: true
    });
  }
}

/**
 * Affiche une sélection pour licencier un employé
 */
async function handleFireSelection(interaction, client, manager, business, userId) {
  await interaction.deferUpdate();
  
  try {
    // Vérifier les permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_fire');
    
    if (!hasPermission) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission de licencier des employés dans cette entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Récupérer les membres licenciables
    const members = await client.db.db.all(`
      SELECT * FROM business_members
      WHERE business_id = ? AND role != 'owner' AND user_id != ?
    `, business.id, userId);
    
    if (members.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.warning(
            'Aucun employé',
            'Il n\'y a aucun employé à licencier dans cette entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Créer le menu de sélection
    const options = members.map(member => {
      let roleLabel;
      let roleEmoji;
      
      if (member.role === 'manager') {
        roleLabel = 'Manager';
        roleEmoji = '🔱';
      } else {
        roleLabel = 'Employé';
        roleEmoji = '👤';
      }
      
      return {
        label: `${roleLabel} - ID: ${member.user_id}`,
        value: member.user_id,
        description: `Salaire: ${member.salary} PiloCoins/jour`,
        emoji: roleEmoji
      };
    });
    
    const selectMenu = new ActionRowBuilder()
      .addComponents({
        type: 3, // TYPE_STRING_SELECT
        custom_id: `fire:select:${business.id}`,
        placeholder: 'Sélectionnez un employé à licencier',
        options
      });
    
    // Créer l'embed
    const embed = EmbedCreator.create({
      title: '🚫 Licenciement',
      description: `Sélectionnez un employé à licencier de **${business.name}**.`,
      color: 'DANGER',
      fields: [
        {
          name: '⚠️ Attention',
          value: 'Cette action est irréversible.',
          inline: false
        }
      ]
    });
    
    await interaction.editReply({
      embeds: [embed],
      components: [selectMenu]
    });
  } catch (error) {
    console.error('Error handling fire selection:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue : ${error.message}`
        )
      ],
      components: []
    });
  }
}

/**
 * Affiche une sélection pour modifier le salaire d'un employé
 */
async function handleSalarySelection(interaction, client, manager, business, userId) {
  await interaction.deferUpdate();
  
  try {
    // Vérifier les permissions
    const hasPermission = await manager.checkPermission(business.id, userId, 'can_change_salary');
    
    if (!hasPermission) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Permission refusée',
            'Vous n\'avez pas la permission de modifier les salaires dans cette entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Récupérer les membres dont on peut modifier le salaire
    const members = await client.db.db.all(`
      SELECT * FROM business_members
      WHERE business_id = ? AND (role != 'owner' OR user_id = ?)
    `, business.id, userId);
    
    if (members.length === 0) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.warning(
            'Aucun employé',
            'Il n\'y a aucun employé dont vous pouvez modifier le salaire dans cette entreprise.'
          )
        ],
        components: []
      });
    }
    
    // Créer le menu de sélection
    const options = members.map(member => {
      let roleLabel;
      let roleEmoji;
      
      if (member.role === 'owner') {
        roleLabel = 'Propriétaire';
        roleEmoji = '👑';
      } else if (member.role === 'manager') {
        roleLabel = 'Manager';
        roleEmoji = '🔱';
      } else {
        roleLabel = 'Employé';
        roleEmoji = '👤';
      }
      
      return {
        label: `${roleLabel} - ID: ${member.user_id}`,
        value: member.user_id,
        description: `Salaire actuel: ${member.salary} PiloCoins/jour`,
        emoji: roleEmoji
      };
    });
    
    const selectMenu = new ActionRowBuilder()
      .addComponents({
        type: 3, // TYPE_STRING_SELECT
        custom_id: `salary:select:${business.id}`,
        placeholder: 'Sélectionnez un employé pour modifier son salaire',
        options
      });
    
    // Créer l'embed
    const embed = EmbedCreator.create({
      title: '💰 Modification de salaire',
      description: `Sélectionnez un employé de **${business.name}** pour modifier son salaire.`,
      color: 'PRIMARY',
      fields: [
        {
          name: '💼 Masse salariale actuelle',
          value: `${members.reduce((total, member) => total + member.salary, 0)} PiloCoins/jour`,
          inline: true
        },
        {
          name: '👥 Nombre d\'employés',
          value: `${members.length}`,
          inline: true
        }
      ]
    });
    
    await interaction.editReply({
      embeds: [embed],
      components: [selectMenu]
    });
  } catch (error) {
    console.error('Error handling salary selection:', error);
    
    await interaction.editReply({
      embeds: [
        EmbedCreator.error(
          'Erreur',
          `Une erreur est survenue : ${error.message}`
        )
      ],
      components: []
    });
  }
}

/**
 * Retourne le nom descriptif d'une permission
 */
function getPermissionName(permName) {
  const permNames = {
    'can_hire': 'Embaucher',
    'can_fire': 'Licencier',
    'can_collect': 'Collecter les revenus',
    'can_upgrade': 'Améliorer les actifs',
    'can_withdraw': 'Retirer des fonds',
    'can_deposit': 'Déposer des fonds',
    'can_change_salary': 'Modifier les salaires',
    'can_change_settings': 'Modifier les paramètres',
    'can_view_finances': 'Voir les finances'
  };
  
  return permNames[permName] || permName;
}