import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'loan_confirm',
  
  async execute(interaction, client) {
    try {
      // Récupérer les données stockées
      if (!client.pendingLoans || !client.pendingLoans.has(interaction.user.id)) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Session expirée', 
              'Votre demande de prêt a expiré. Veuillez réessayer avec `/loan emprunter`.'
            )
          ],
          components: []
        });
      }
      
      const loanData = client.pendingLoans.get(interaction.user.id);
      
      // Vérifier que c'est bien le bon utilisateur
      if (interaction.user.id !== loanData.userId) {
        return interaction.reply({
          embeds: [
            EmbedCreator.error(
              'Non autorisé', 
              'Vous ne pouvez pas confirmer ce prêt.'
            )
          ],
          ephemeral: true
        });
      }
      
      // Récupérer les données utilisateur
      const user = await client.db.getUser(loanData.userId);
      
      // Vérifier si l'utilisateur a déjà un prêt actif (double vérification)
      const activeLoans = await client.db.db.all(`
        SELECT * FROM loans
        WHERE user_id = ? AND status = 'active'
      `, loanData.userId);
      
      if (activeLoans.length > 0) {
        return interaction.update({
          embeds: [
            EmbedCreator.error(
              'Prêt existant', 
              'Vous avez déjà un prêt en cours. Remboursez-le avant d\'en contracter un nouveau.'
            )
          ],
          components: []
        });
      }
      
      // Créer la fonction pour créer un prêt si elle n'existe pas déjà
      async function createLoan(client, userId, amount, interestAmount, dueDate) {
        const totalAmount = amount + interestAmount;
        const dueDateIso = dueDate.toISOString();
        
        await client.db.db.run(`
          INSERT INTO loans (
            user_id, loan_amount, interest_amount, remaining_amount, due_date
          ) VALUES (?, ?, ?, ?, ?)
        `, userId, amount, interestAmount, totalAmount, dueDateIso);
        
        // Récupérer l'ID du prêt créé
        const loan = await client.db.db.get(`
          SELECT id FROM loans
          WHERE user_id = ?
          ORDER BY loan_date DESC
          LIMIT 1
        `, userId);
        
        return loan.id;
      }
      
      // Créer le prêt
      await createLoan(
        client,
        loanData.userId,
        loanData.amount,
        loanData.interestAmount,
        loanData.dueDate
      );
      
      // Ajouter l'argent au solde de l'utilisateur
      await client.db.updateUserBalance(loanData.userId, loanData.amount);
      
      // Nettoyer les données temporaires
      client.pendingLoans.delete(interaction.user.id);
      
      // Confirmer le prêt
      return interaction.update({
        embeds: [
          EmbedCreator.success(
            '💰 Prêt accordé',
            `Votre demande de prêt a été acceptée ! ${loanData.amount} crédits ont été ajoutés à votre compte.`,
            {
              fields: [
                {
                  name: '💵 Montant emprunté',
                  value: `${loanData.amount} crédits`,
                  inline: true
                },
                {
                  name: '💸 Intérêts',
                  value: `${loanData.interestAmount} crédits`,
                  inline: true
                },
                {
                  name: '🔄 Montant à rembourser',
                  value: `${loanData.totalToRepay} crédits`,
                  inline: true
                },
                {
                  name: '📅 Date d\'échéance',
                  value: `${loanData.dueDate.toLocaleDateString('fr-FR')}`,
                  inline: true
                },
                {
                  name: '💰 Nouveau solde',
                  value: `${user.balance + loanData.amount} crédits`,
                  inline: true
                }
              ]
            }
          )
        ],
        components: []
      });
      
    } catch (error) {
      console.error('Error in loan confirm button:', error);
      
      return interaction.update({
        embeds: [
          EmbedCreator.error(
            'Erreur', 
            'Une erreur est survenue lors du traitement de votre demande de prêt.'
          )
        ],
        components: []
      });
    }
  }
};

// Gestionnaire du bouton d'annulation
export const cancelButton = {
  customId: 'loan_cancel',
  
  async execute(interaction, client) {
    // Nettoyer les données temporaires
    if (client.pendingLoans) {
      client.pendingLoans.delete(interaction.user.id);
    }
    
    return interaction.update({
      embeds: [
        EmbedCreator.info(
          '❌ Prêt annulé',
          'Vous avez annulé votre demande de prêt.'
        )
      ],
      components: []
    });
  }
};