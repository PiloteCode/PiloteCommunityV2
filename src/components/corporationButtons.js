import { EmbedCreator } from '../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default {
  // custom ID format: asset:action:businessId:assetId:actionArgs
  customId: 'asset',
  
  async execute(interaction, client) {
    try {
      // Parse the custom ID
      const parts = interaction.customId.split(':');
      if (parts.length < 3) return;
      
      const [base, action, businessId, arg1, arg2] = parts;
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
      
      // Traiter les différentes actions
      if (action === 'quantity') {
        // Format: asset:quantity:businessId:assetType:quantity
        const assetType = arg1;
        const quantity = arg2;
        
        if (quantity === 'custom') {
          // Ouvrir un modal pour saisir une quantité personnalisée
          const modal = new ModalBuilder()
            .setCustomId(`quantity:${businessId}:${assetType}`)
            .setTitle('Quantité personnalisée');
          
          const quantityInput = new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('Combien d\'unités souhaitez-vous acheter?')
            .setPlaceholder('Saisissez un nombre entre 1 et 100')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3)
            .setRequired(true);
          
          const firstActionRow = new ActionRowBuilder().addComponents(quantityInput);
          modal.addComponents(firstActionRow);
          
          await interaction.showModal(modal);
        } else {
          // Traiter l'achat directement avec la quantité spécifiée
          await handleAssetPurchase(interaction, client, manager, business, userId, assetType, parseInt(quantity));
        }
      }
      else if (action === 'upgrade') {
        // Format: asset:upgrade:businessId:assetId:confirm/cancel
        const assetId = arg1;
        const confirmAction = arg2;
        
        if (confirmAction === 'confirm') {
          await handleAssetUpgradeConfirm(interaction, client, manager, business, userId, assetId);
        } else {
          // Annuler l'amélioration
          await interaction.update({
            embeds: [
              EmbedCreator.info(
                '❌ Amélioration annulée',
                'L\'amélioration de l\'actif a été annulée.'
              )
            ],
            components: []
          });
        }
      }
      
    } catch (error) {
      console.error('Error in corporation buttons:', error);
      
      // Send error message
      try {
        await interaction.update({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Une erreur est survenue lors du traitement de votre action.'
            )
          ],
          components: []
        });
      } catch {
        await interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Une erreur est survenue lors du traitement de votre action.'
            )
          ],
          ephemeral: true
        });
      }
    }
  }
};

/**
 * Gère l'achat d'un actif
 */
async function handleAssetPurchase(interaction, client, manager, business, userId, assetType, quantity) {
  await interaction.deferUpdate();
  
  try {
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
    
    // Vérifier que la quantité est valide
    if (isNaN(quantity) || quantity < 1 || quantity > 100) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Quantité invalide',
            'La quantité doit être un nombre entre 1 et 100.'
          )
        ],
        components: []
      });
    }
    
    // Récupérer les infos de l'actif
    const assetData = manager.assetTypes[assetType];
    if (!assetData) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Actif invalide',
            'Cet actif n\'existe pas.'
          )
        ],
        components: []
      });
    }
    
    // Calculer le coût total
    const totalCost = assetData.base_cost * quantity;
    
    // Vérifier si l'entreprise a assez de capital
    if (business.capital < totalCost) {
      return interaction.editReply({
        embeds: [
          EmbedCreator.error(
            'Fonds insuffisants',
            `Votre entreprise n'a pas assez de capital pour cet achat. Il faut ${totalCost} PiloCoins (disponible: ${business.capital}).`
          )
        ],
        components: []
      });
    }
    
    // Effectuer l'achat
    const result = await manager.purchaseAsset(business.id, assetType, quantity, userId);
    
    // Créer l'embed de confirmation
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
      embeds: [embed],
      components: []
    });
  } catch (error) {
    console.error('Error purchasing asset:', error);
    
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
 * Gère la confirmation d'amélioration d'un actif
 */
async function handleAssetUpgradeConfirm(interaction, client, manager, business, userId, assetId) {
  await interaction.deferUpdate();
  
  try {
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
    
    // Effectuer l'amélioration
    const result = await manager.upgradeAsset(business.id, assetId, userId);
    
    // Créer l'embed de confirmation
    const embed = EmbedCreator.success(
      '⬆️ Amélioration réussie',
      `Vous avez amélioré ${result.assetName} au niveau ${result.newLevel} !`,
      {
        fields: [
          {
            name: '💰 Coût',
            value: `${result.upgradeCost} PiloCoins`,
            inline: true
          },
          {
            name: '💼 Capital restant',
            value: `${business.capital - result.upgradeCost} PiloCoins`,
            inline: true
          }
        ]
      }
    );
    
    await interaction.editReply({
      embeds: [embed],
      components: []
    });
  } catch (error) {
    console.error('Error upgrading asset:', error);
    
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

// Exportations supplémentaires pour d'autres boutons
export const fireButton = {
  // custom ID format: fire:select:businessId
  customId: 'fire:select',
  
  async execute(interaction, client) {
    try {
      // Parse the custom ID
      const [base, action, businessId] = interaction.customId.split(':');
      const userId = interaction.user.id;
      const targetUserId = interaction.values[0];
      
      await interaction.deferUpdate();
      
      // Récupérer le gestionnaire d'entreprise
      const manager = client.businessManager;
      
      // Récupérer l'entreprise
      const business = await manager.getBusinessById(businessId);
      
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
      
      // Créer un modal pour la raison du licenciement
      const modal = new ModalBuilder()
        .setCustomId(`fire:reason:${businessId}:${targetUserId}`)
        .setTitle('Raison du licenciement');
      
      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Raison du licenciement')
        .setPlaceholder('Veuillez indiquer la raison du licenciement...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
      
      const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(firstActionRow);
      
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error in fire button:', error);
      
      await interaction.update({
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
};

export const salaryButton = {
  // custom ID format: salary:select:businessId
  customId: 'salary:select',
  
  async execute(interaction, client) {
    try {
      // Parse the custom ID
      const [base, action, businessId] = interaction.customId.split(':');
      const userId = interaction.user.id;
      const targetUserId = interaction.values[0];
      
      await interaction.deferUpdate();
      
      // Récupérer le gestionnaire d'entreprise
      const manager = client.businessManager;
      
      // Récupérer l'entreprise
      const business = await manager.getBusinessById(businessId);
      
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
      
      // Récupérer l'employé
      const employee = await client.db.db.get(`
        SELECT * FROM business_members
        WHERE business_id = ? AND user_id = ?
      `, businessId, targetUserId);
      
      if (!employee) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Employé introuvable',
              'Cet employé n\'existe pas dans votre entreprise.'
            )
          ],
          components: []
        });
      }
      
      // Créer un modal pour le nouveau salaire
      const modal = new ModalBuilder()
        .setCustomId(`salary:change:${businessId}:${targetUserId}`)
        .setTitle('Modification de salaire');
      
      const salaryInput = new TextInputBuilder()
        .setCustomId('salary')
        .setLabel('Nouveau salaire journalier (en PiloCoins)')
        .setPlaceholder('Exemple: 100')
        .setStyle(TextInputStyle.Short)
        .setValue(`${employee.salary}`)
        .setRequired(true);
      
      const firstActionRow = new ActionRowBuilder().addComponents(salaryInput);
      modal.addComponents(firstActionRow);
      
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error in salary button:', error);
      
      await interaction.update({
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
};