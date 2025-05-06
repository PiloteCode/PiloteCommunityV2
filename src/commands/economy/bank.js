import { SlashCommandBuilder } = require('discord.js');
import { EmbedCreator } = require('../../utils/embedCreator.js');

export default {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Gérez votre compte bancaire pour économiser et gagner des intérêts')
    .addSubcommand(subcommand =>
      subcommand
        .setName('deposit')
        .setDescription('Déposez des crédits sur votre compte bancaire')
        .addIntegerOption(option =>
          option.setName('montant')
            .setDescription('Montant à déposer')
            .setRequired(true)
            .setMinValue(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('withdraw')
        .setDescription('Retirez des crédits de votre compte bancaire')
        .addIntegerOption(option =>
          option.setName('montant')
            .setDescription('Montant à retirer')
            .setRequired(true)
            .setMinValue(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Consultez les informations de votre compte bancaire')),
  
  cooldown: 10,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      
      // Récupérer les données bancaires de l'utilisateur
      const user = await client.db.getUser(userId);
      const bankData = await getBankData(client, userId);
      
      // Si l'utilisateur n'a pas encore de compte bancaire, en créer un
      if (!bankData) {
        await createBankAccount(client, userId);
      }
      
      // Traiter les différentes sous-commandes
      if (subcommand === 'deposit') {
        const amount = interaction.options.getInteger('montant');
        
        // Vérifier si l'utilisateur a assez de crédits
        if (user.balance < amount) {
          const errorEmbed = EmbedCreator.error(
            'Fonds insuffisants',
            `Vous n'avez pas assez de crédits pour déposer ${amount} crédits. Solde actuel: ${user.balance} crédits.`
          );
          return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        // Effectuer le dépôt
        await depositToBank(client, userId, amount);
        
        // Mettre à jour le solde de l'utilisateur
        await client.db.updateUserBalance(userId, -amount);
        
        // Récupérer les nouvelles données
        const updatedBankData = await getBankData(client, userId);
        
        // Créer l'embed de confirmation
        const successEmbed = EmbedCreator.success(
          '🏦 Dépôt effectué avec succès!',
          `Vous avez déposé **${amount} crédits** sur votre compte bancaire.`,
          {
            fields: [
              {
                name: '💰 Solde bancaire',
                value: `${updatedBankData.balance} crédits`,
                inline: true
              },
              {
                name: '💵 Solde portefeuille',
                value: `${user.balance - amount} crédits`,
                inline: true
              },
              {
                name: '📈 Intérêts',
                value: `+${(updatedBankData.balance * 0.01).toFixed(0)} crédits par jour`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [successEmbed] });
      } else if (subcommand === 'withdraw') {
        const amount = interaction.options.getInteger('montant');
        
        // Vérifier si l'utilisateur a assez de crédits dans sa banque
        if (bankData.balance < amount) {
          const errorEmbed = EmbedCreator.error(
            'Fonds insuffisants',
            `Vous n'avez pas assez de crédits dans votre compte bancaire pour retirer ${amount} crédits. Solde bancaire: ${bankData.balance} crédits.`
          );
          return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        // Effectuer le retrait
        await withdrawFromBank(client, userId, amount);
        
        // Mettre à jour le solde de l'utilisateur
        await client.db.updateUserBalance(userId, amount);
        
        // Récupérer les nouvelles données
        const updatedBankData = await getBankData(client, userId);
        
        // Créer l'embed de confirmation
        const successEmbed = EmbedCreator.success(
          '🏦 Retrait effectué avec succès!',
          `Vous avez retiré **${amount} crédits** de votre compte bancaire.`,
          {
            fields: [
              {
                name: '💰 Solde bancaire',
                value: `${updatedBankData.balance} crédits`,
                inline: true
              },
              {
                name: '💵 Solde portefeuille',
                value: `${user.balance + amount} crédits`,
                inline: true
              },
              {
                name: '📈 Intérêts',
                value: `+${(updatedBankData.balance * 0.01).toFixed(0)} crédits par jour`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [successEmbed] });
      } else if (subcommand === 'info') {
        // Calculer les intérêts journaliers et la date du prochain versement
        const dailyInterest = Math.floor(bankData.balance * 0.01);
        const nextInterestDate = new Date(bankData.last_interest);
        nextInterestDate.setDate(nextInterestDate.getDate() + 1);
        
        // Formater la date
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const formattedDate = nextInterestDate.toLocaleDateString('fr-FR', dateOptions);
        
        // Calculer le temps restant
        const timeLeft = nextInterestDate - new Date();
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        // Créer l'embed d'informations
        const infoEmbed = EmbedCreator.info(
          '🏦 Informations bancaires',
          `Voici les informations sur votre compte bancaire. Les intérêts sont calculés quotidiennement à un taux de 1% de votre solde bancaire.`,
          {
            fields: [
              {
                name: '💰 Solde bancaire',
                value: `${bankData.balance} crédits`,
                inline: true
              },
              {
                name: '💵 Solde portefeuille',
                value: `${user.balance} crédits`,
                inline: true
              },
              {
                name: '📈 Taux d\'intérêt',
                value: `1% par jour`,
                inline: true
              },
              {
                name: '💸 Prochain versement',
                value: `${dailyInterest} crédits dans ${hoursLeft}h ${minutesLeft}m`,
                inline: false
              },
              {
                name: '📅 Date du versement',
                value: formattedDate,
                inline: false
              },
              {
                name: '📊 Total des intérêts perçus',
                value: `${bankData.total_interest} crédits`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [infoEmbed] });
      }
      
    } catch (error) {
      console.error('Error in bank command:', error);
      
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

// Fonction pour récupérer les données bancaires d'un utilisateur
async function getBankData(client, userId) {
  try {
    // Créer la table bank_accounts si elle n'existe pas
    await client.db.db.run(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        user_id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0,
        last_interest TEXT NOT NULL DEFAULT (datetime('now')),
        total_interest INTEGER NOT NULL DEFAULT 0
      )
    `);
    
    // Récupérer les données
    const bankData = await client.db.db.get(`
      SELECT * FROM bank_accounts WHERE user_id = ?
    `, userId);
    
    return bankData;
  } catch (error) {
    console.error('Error getting bank data:', error);
    throw error;
  }
}

// Fonction pour créer un compte bancaire
async function createBankAccount(client, userId) {
  try {
    await client.db.db.run(`
      INSERT INTO bank_accounts (user_id, balance, last_interest, total_interest)
      VALUES (?, 0, datetime('now'), 0)
    `, userId);
  } catch (error) {
    console.error('Error creating bank account:', error);
    throw error;
  }
}

// Fonction pour déposer de l'argent
async function depositToBank(client, userId, amount) {
  try {
    await client.db.db.run(`
      UPDATE bank_accounts
      SET balance = balance + ?
      WHERE user_id = ?
    `, [amount, userId]);
  } catch (error) {
    console.error('Error depositing to bank:', error);
    throw error;
  }
}

// Fonction pour retirer de l'argent
async function withdrawFromBank(client, userId, amount) {
  try {
    await client.db.db.run(`
      UPDATE bank_accounts
      SET balance = balance - ?
      WHERE user_id = ? AND balance >= ?
    `, [amount, userId, amount]);
  } catch (error) {
    console.error('Error withdrawing from bank:', error);
    throw error;
  }
}