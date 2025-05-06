import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'business_confirm_upgrade',
  
  async execute(interaction, client) {
    try {
      // Récupérer les données stockées
      if (!client.businessUpgrades || !client.businessUpgrades.has(interaction.user.id)) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Session expirée', 
              'Votre session d\'amélioration a expiré. Veuillez réessayer la commande `/business upgrade`.'
            )
          ],
          components: []
        });
      }
      
      const upgradeData = client.businessUpgrades.get(interaction.user.id);
      
      // Vérifier que c'est bien le bon utilisateur
      if (interaction.user.id !== upgradeData.userId) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Non autorisé', 
              'Vous ne pouvez pas interagir avec cette amélioration.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Récupérer les données utilisateur et entreprise
      const user = await client.db.getUser(upgradeData.userId);
      
      // Vérifier que l'utilisateur a toujours assez d'argent
      if (user.balance < upgradeData.upgradeCost) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants', 
              `L'amélioration coûte ${upgradeData.upgradeCost} crédits. Vous n'avez que ${user.balance} crédits.`
            )
          ],
          components: []
        });
      }
      
      // Effectuer l'amélioration
      await performUpgrade(
        client, 
        upgradeData.businessId, 
        upgradeData.aspect, 
        upgradeData.newIncome
      );
      
      // Déduire le coût
      await client.db.updateUserBalance(upgradeData.userId, -upgradeData.upgradeCost);
      
      // Nettoyer les données temporaires
      client.businessUpgrades.delete(interaction.user.id);
      
      // Confirmer l'amélioration
      return interaction.update({
        embeds: [
          EmbedCreator.success(
            '🚀 Amélioration réussie',
            `Vous avez amélioré l'aspect **${getAspectName(upgradeData.aspect)}** de votre entreprise au niveau ${upgradeData.currentLevel + 1} !`,
            {
              fields: [
                {
                  name: '📈 Nouveau revenu horaire',
                  value: `${upgradeData.newIncome} crédits`,
                  inline: true
                },
                {
                  name: '💵 Solde actuel',
                  value: `${user.balance - upgradeData.upgradeCost} crédits`,
                  inline: true
                }
              ]
            }
          )
        ],
        components: []
      });
      
    } catch (error) {
      console.error('Error in business button:', error);
      
      return interaction.update({
        embeds: [
          EmbedCreator.error(
            'Erreur', 
            'Une erreur est survenue lors de l\'amélioration de votre entreprise.'
          )
        ],
        components: []
      });
    }
  }
};

// Gestionnaire du bouton d'annulation
export const cancelButton = {
  customId: 'business_cancel_upgrade',
  
  async execute(interaction, client) {
    // Nettoyer les données temporaires
    if (client.businessUpgrades) {
      client.businessUpgrades.delete(interaction.user.id);
    }
    
    return interaction.update({
      embeds: [
        EmbedCreator.info(
          '❌ Amélioration annulée',
          'Vous avez annulé l\'amélioration de votre entreprise. Aucuns frais n\'ont été prélevés.'
        )
      ],
      components: []
    });
  }
};

// Fonction pour effectuer l'amélioration
async function performUpgrade(client, businessId, aspect, newIncome) {
  switch (aspect) {
    case 'productivity':
      await client.db.db.run(`
        UPDATE businesses 
        SET level = level + 1,
            hourly_income = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, newIncome, businessId);
      break;
      
    case 'marketing':
      await client.db.db.run(`
        UPDATE businesses 
        SET marketing_level = marketing_level + 1,
            hourly_income = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, newIncome, businessId);
      break;
      
    case 'staff':
      await client.db.db.run(`
        UPDATE businesses 
        SET staff_level = staff_level + 1,
            hourly_income = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, newIncome, businessId);
      break;
      
    case 'equipment':
      await client.db.db.run(`
        UPDATE businesses 
        SET equipment_level = equipment_level + 1,
            hourly_income = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, newIncome, businessId);
      break;
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