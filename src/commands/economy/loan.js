import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('loan')
    .setDescription('Emprunter, rembourser et gérer vos prêts')
    .addSubcommand(subcommand =>
      subcommand
        .setName('emprunter')
        .setDescription('Emprunter de l\'argent auprès de la banque')
        .addIntegerOption(option =>
          option.setName('montant')
            .setDescription('Montant à emprunter')
            .setRequired(true)
            .setMinValue(1000)
            .setMaxValue(50000)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('rembourser')
        .setDescription('Rembourser une partie ou la totalité de votre prêt')
        .addIntegerOption(option =>
          option.setName('montant')
            .setDescription('Montant à rembourser')
            .setRequired(true)
            .setMinValue(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Voir les informations sur vos prêts en cours')),

  cooldown: 10000, // 10 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Récupérer les données utilisateur
      const user = await client.db.getUser(userId);
      
      // Créer la table des prêts si elle n'existe pas
      await createLoanTable(client);
      
      // Récupérer les prêts actifs de l'utilisateur
      const activeLoans = await getActiveLoans(client, userId);
      
      // Calculer le niveau de crédit de l'utilisateur (0 à 100)
      const creditScore = await calculateCreditScore(client, userId);
      
      if (subcommand === 'emprunter') {
        const amount = interaction.options.getInteger('montant');
        
        // Vérifier si l'utilisateur a déjà un prêt actif
        if (activeLoans.length > 0) {
          const totalOwed = activeLoans.reduce((sum, loan) => sum + loan.remaining_amount, 0);
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Prêt existant', 
                `Vous avez déjà un prêt en cours avec ${totalOwed} PiloCoins restants à rembourser. Utilisez \`/loan rembourser\` pour le rembourser avant d'en contracter un nouveau.`
              )
            ]
          });
        }
        
        // Déterminer le taux d'intérêt en fonction du score de crédit
        const interestRate = calculateInterestRate(creditScore);
        
        // Calculer le montant à rembourser (principal + intérêts)
        const interestAmount = Math.round(amount * interestRate);
        const totalToRepay = amount + interestAmount;
        
        // Déterminer la durée du prêt (en jours)
        let loanDuration = 7; // 7 jours par défaut
        
        // Si le montant est important, augmenter la durée du prêt
        if (amount >= 30000) loanDuration = 14;
        else if (amount >= 10000) loanDuration = 10;
        
        // Calculer la date d'échéance
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + loanDuration);
        
        // Créer les boutons de confirmation
        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('loan_confirm')
              .setLabel('Confirmer l\'emprunt')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('loan_cancel')
              .setLabel('Annuler')
              .setStyle(ButtonStyle.Danger)
          );
        
        // Stocker les données pour le gestionnaire de boutons
        const loanData = {
          userId,
          amount,
          interestRate,
          interestAmount,
          totalToRepay,
          dueDate
        };
        
        // Attacher les données à la session utilisateur temporairement
        if (!client.pendingLoans) client.pendingLoans = new Map();
        client.pendingLoans.set(userId, loanData);
        
        // Créer l'embed de confirmation
        const embed = EmbedCreator.warning(
          '💰 Confirmation de prêt',
          'Veuillez confirmer les détails de votre demande de prêt:',
          {
            fields: [
              {
                name: '💵 Montant emprunté',
                value: `${amount} PiloCoins`,
                inline: true
              },
              {
                name: '📊 Taux d\'intérêt',
                value: `${(interestRate * 100).toFixed(1)}%`,
                inline: true
              },
              {
                name: '💸 Intérêts',
                value: `${interestAmount} PiloCoins`,
                inline: true
              },
              {
                name: '🔄 Montant total à rembourser',
                value: `${totalToRepay} PiloCoins`,
                inline: true
              },
              {
                name: '📅 Date d\'échéance',
                value: `${dueDate.toLocaleDateString('fr-FR')} (${loanDuration} jours)`,
                inline: true
              },
              {
                name: '⭐ Score de crédit',
                value: `${creditScore}/100`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({
          embeds: [embed],
          components: [confirmRow]
        });
      }
      
      else if (subcommand === 'rembourser') {
        const paymentAmount = interaction.options.getInteger('montant');
        
        // Vérifier si l'utilisateur a un prêt actif
        if (activeLoans.length === 0) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Aucun prêt', 
                'Vous n\'avez aucun prêt en cours à rembourser.'
              )
            ]
          });
        }
        
        // Récupérer le premier prêt actif (on ne gère qu'un prêt à la fois)
        const loan = activeLoans[0];
        
        // Vérifier si l'utilisateur a assez d'argent
        if (user.balance < paymentAmount) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Fonds insuffisants', 
                `Vous n'avez que ${user.balance} crédits, mais vous essayez d'en rembourser ${paymentAmount}.`
              )
            ]
          });
        }
        
        // Vérifier que le montant de remboursement n'est pas supérieur au solde restant
        if (paymentAmount > loan.remaining_amount) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.warning(
                'Montant excessif', 
                `Vous n'avez que ${loan.remaining_amount} crédits à rembourser. Le montant a été ajusté.`
              )
            ]
          });
        }
        
        // Effectuer le remboursement
        const newRemainingAmount = loan.remaining_amount - paymentAmount;
        const fullyRepaid = newRemainingAmount <= 0;
        
        await makeLoanPayment(client, loan.id, paymentAmount);
        
        // Déduire le montant du solde de l'utilisateur
        await client.db.updateUserBalance(userId, -paymentAmount);
        
        // Mettre à jour le score de crédit si le prêt est entièrement remboursé
        if (fullyRepaid) {
          await updateCreditScore(client, userId, 10); // +10 points pour un remboursement complet
        } else {
          await updateCreditScore(client, userId, 2); // +2 points pour un remboursement partiel
        }
        
        // Créer l'embed de confirmation
        const embed = EmbedCreator.success(
          '💰 Remboursement effectué',
          fullyRepaid
            ? `Félicitations ! Vous avez entièrement remboursé votre prêt de ${loan.loan_amount + loan.interest_amount} crédits.`
            : `Vous avez remboursé ${paymentAmount} crédits sur votre prêt. Il vous reste ${newRemainingAmount} crédits à payer.`,
          {
            fields: [
              {
                name: '💸 Montant remboursé',
                value: `${paymentAmount} crédits`,
                inline: true
              },
              {
                name: '💵 Solde actuel',
                value: `${user.balance - paymentAmount} crédits`,
                inline: true
              },
              {
                name: fullyRepaid ? '✅ Statut' : '⏳ Reste à payer',
                value: fullyRepaid ? 'Prêt entièrement remboursé' : `${newRemainingAmount} crédits`,
                inline: true
              },
              {
                name: '⭐ Score de crédit',
                value: `${fullyRepaid ? creditScore + 10 : creditScore + 2}/100`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      else if (subcommand === 'info') {
        // Si l'utilisateur n'a pas de prêts actifs
        if (activeLoans.length === 0) {
          // Récupérer l'historique des prêts
          const loanHistory = await getLoanHistory(client, userId);
          
          if (loanHistory.length === 0) {
            return interaction.editReply({
              embeds: [
                EmbedCreator.info(
                  '📊 Information de crédit',
                  'Vous n\'avez jamais contracté de prêt. Utilisez `/loan emprunter` pour faire votre première demande.',
                  {
                    fields: [
                      {
                        name: '⭐ Score de crédit',
                        value: `${creditScore}/100`,
                        inline: true
                      },
                      {
                        name: '💵 Taux d\'intérêt estimé',
                        value: `${(calculateInterestRate(creditScore) * 100).toFixed(1)}%`,
                        inline: true
                      },
                      {
                        name: '💰 Montant maximum empruntable',
                        value: `${getMaxLoanAmount(creditScore)} crédits`,
                        inline: true
                      }
                    ]
                  }
                )
              ]
            });
          }
          
          // Si l'utilisateur a un historique de prêts mais aucun actif
          const totalLoans = loanHistory.length;
          const totalRepaid = loanHistory.filter(loan => loan.status === 'repaid').length;
          const totalDefaulted = loanHistory.filter(loan => loan.status === 'defaulted').length;
          
          return interaction.editReply({
            embeds: [
              EmbedCreator.info(
                '📊 Historique de crédit',
                'Vous n\'avez aucun prêt actif actuellement, mais voici l\'historique de vos emprunts:',
                {
                  fields: [
                    {
                      name: '📈 Nombre total de prêts',
                      value: `${totalLoans}`,
                      inline: true
                    },
                    {
                      name: '✅ Prêts remboursés',
                      value: `${totalRepaid}`,
                      inline: true
                    },
                    {
                      name: '❌ Défauts de paiement',
                      value: `${totalDefaulted}`,
                      inline: true
                    },
                    {
                      name: '⭐ Score de crédit',
                      value: `${creditScore}/100`,
                      inline: true
                    },
                    {
                      name: '💵 Taux d\'intérêt estimé',
                      value: `${(calculateInterestRate(creditScore) * 100).toFixed(1)}%`,
                      inline: true
                    },
                    {
                      name: '💰 Montant maximum empruntable',
                      value: `${getMaxLoanAmount(creditScore)} crédits`,
                      inline: true
                    }
                  ]
                }
              )
            ]
          });
        }
        
        // Si l'utilisateur a des prêts actifs
        const loan = activeLoans[0]; // On ne gère qu'un prêt à la fois
        
        // Calculer le temps restant jusqu'à l'échéance
        const dueDate = new Date(loan.due_date);
        const now = new Date();
        const daysRemaining = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        // Créer l'embed avec les informations du prêt
        const embed = EmbedCreator.info(
          '📊 Information de prêt',
          'Voici les détails de votre prêt en cours:',
          {
            fields: [
              {
                name: '💵 Montant initial',
                value: `${loan.loan_amount} crédits`,
                inline: true
              },
              {
                name: '💸 Intérêts',
                value: `${loan.interest_amount} crédits (${((loan.interest_amount / loan.loan_amount) * 100).toFixed(1)}%)`,
                inline: true
              },
              {
                name: '🔄 Montant total',
                value: `${loan.loan_amount + loan.interest_amount} crédits`,
                inline: true
              },
              {
                name: '⏳ Reste à payer',
                value: `${loan.remaining_amount} crédits`,
                inline: true
              },
              {
                name: '📅 Échéance',
                value: `${dueDate.toLocaleDateString('fr-FR')} (${daysRemaining > 0 ? `${daysRemaining} jours restants` : 'Échéance dépassée!'})`,
                inline: true
              },
              {
                name: '⭐ Score de crédit',
                value: `${creditScore}/100`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Error in loan command:', error);
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

// Fonction pour créer la table des prêts
async function createLoanTable(client) {
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      loan_amount INTEGER NOT NULL,
      interest_amount INTEGER NOT NULL,
      remaining_amount INTEGER NOT NULL,
      loan_date TEXT NOT NULL DEFAULT (datetime('now')),
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
  
  // Créer la table de score de crédit si elle n'existe pas
  await client.db.db.exec(`
    CREATE TABLE IF NOT EXISTS credit_scores (
      user_id TEXT PRIMARY KEY,
      score INTEGER NOT NULL DEFAULT 50,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
}

// Fonction pour récupérer les prêts actifs d'un utilisateur
async function getActiveLoans(client, userId) {
  return await client.db.db.all(`
    SELECT * FROM loans
    WHERE user_id = ? AND status = 'active'
    ORDER BY loan_date DESC
  `, userId);
}

// Fonction pour récupérer l'historique des prêts d'un utilisateur
async function getLoanHistory(client, userId) {
  return await client.db.db.all(`
    SELECT * FROM loans
    WHERE user_id = ?
    ORDER BY loan_date DESC
  `, userId);
}

// Fonction pour calculer le score de crédit d'un utilisateur
async function calculateCreditScore(client, userId) {
  // Vérifier si l'utilisateur a déjà un score de crédit
  let creditScore = await client.db.db.get(`
    SELECT score FROM credit_scores
    WHERE user_id = ?
  `, userId);
  
  if (!creditScore) {
    // Créer un score de crédit pour l'utilisateur s'il n'en a pas
    await client.db.db.run(`
      INSERT INTO credit_scores (user_id, score)
      VALUES (?, 50)
    `, userId);
    
    return 50; // Score de crédit par défaut
  }
  
  return creditScore.score;
}

// Fonction pour mettre à jour le score de crédit d'un utilisateur
async function updateCreditScore(client, userId, change) {
  // Récupérer le score actuel
  const currentScore = await calculateCreditScore(client, userId);
  
  // Calculer le nouveau score (entre 0 et 100)
  const newScore = Math.max(0, Math.min(100, currentScore + change));
  
  // Mettre à jour le score
  await client.db.db.run(`
    UPDATE credit_scores
    SET score = ?, last_updated = datetime('now')
    WHERE user_id = ?
  `, newScore, userId);
  
  return newScore;
}

// Fonction pour calculer le taux d'intérêt en fonction du score de crédit
function calculateInterestRate(creditScore) {
  // Taux d'intérêt de base: 20%
  // Diminution jusqu'à 5% pour un excellent score
  return 0.20 - (creditScore / 100) * 0.15;
}

// Fonction pour déterminer le montant maximum empruntable
function getMaxLoanAmount(creditScore) {
  // De 5 000 à 50 000 selon le score de crédit
  const baseAmount = 5000;
  const maxBonus = 45000;
  
  return baseAmount + Math.floor((creditScore / 100) * maxBonus);
}

// Fonction pour créer un nouveau prêt
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

// Fonction pour effectuer un paiement sur un prêt
async function makeLoanPayment(client, loanId, amount) {
  // Récupérer le prêt
  const loan = await client.db.db.get(`
    SELECT * FROM loans WHERE id = ?
  `, loanId);
  
  if (!loan) return false;
  
  // Calculer le nouveau montant restant
  const newRemainingAmount = loan.remaining_amount - amount;
  
  // Mettre à jour le statut si entièrement remboursé
  const newStatus = newRemainingAmount <= 0 ? 'repaid' : 'active';
  
  // Mettre à jour le prêt
  await client.db.db.run(`
    UPDATE loans
    SET remaining_amount = ?,
        status = ?
    WHERE id = ?
  `, Math.max(0, newRemainingAmount), newStatus, loanId);
  
  return true;
}