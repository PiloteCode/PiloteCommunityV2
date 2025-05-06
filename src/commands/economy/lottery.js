import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lottery')
    .setDescription('Commandes liées à la loterie du serveur')
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('Acheter un ou plusieurs tickets de loterie')
        .addIntegerOption(option =>
          option.setName('tickets')
            .setDescription('Nombre de tickets à acheter')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Afficher les informations sur la loterie en cours')),
  
  cooldown: 10,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      const ticketPrice = 50; // Prix d'un ticket de loterie
      
      // Récupérer les informations de la loterie
      const lotteryInfo = await getLotteryInfo(client);
      
      if (subcommand === 'buy') {
        const ticketCount = interaction.options.getInteger('tickets');
        const totalCost = ticketCount * ticketPrice;
        
        // Récupérer les données de l'utilisateur
        const user = await client.db.getUser(userId);
        
        // Vérifier si l'utilisateur a assez de crédits
        if (user.balance < totalCost) {
          const errorEmbed = EmbedCreator.error(
            'Fonds insuffisants',
            `Vous n'avez pas assez de crédits pour acheter ${ticketCount} ticket(s). Coût total: ${totalCost} crédits, votre solde: ${user.balance} crédits.`
          );
          return interaction.editReply({ embeds: [errorEmbed] });
        }
        
        // Acheter les tickets
        await buyLotteryTickets(client, userId, ticketCount, totalCost);
        
        // Mettre à jour le solde de l'utilisateur
        await client.db.updateUserBalance(userId, -totalCost);
        
        // Créer l'embed de confirmation
        const successEmbed = EmbedCreator.success(
          '🎟️ Tickets achetés avec succès!',
          `Vous avez acheté **${ticketCount} ticket(s)** de loterie pour **${totalCost} crédits**.`,
          {
            fields: [
              {
                name: '🏆 Cagnotte actuelle',
                value: `${lotteryInfo.jackpot + Math.floor(totalCost * 0.8)} crédits`,
                inline: true
              },
              {
                name: '⏱️ Tirage',
                value: getNextDrawTimeString(lotteryInfo.nextDraw),
                inline: true
              },
              {
                name: '🎫 Vos tickets',
                value: `${(lotteryInfo.userTickets || 0) + ticketCount} ticket(s)`,
                inline: true
              },
              {
                name: '💰 Nouveau solde',
                value: `${user.balance - totalCost} crédits`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [successEmbed] });
      } else if (subcommand === 'info') {
        // Récupérer le nombre de tickets de l'utilisateur
        const userTickets = await getUserTickets(client, userId);
        
        // Créer l'embed d'informations
        const infoEmbed = EmbedCreator.info(
          '🎰 Informations sur la loterie',
          `La loterie est un tirage au sort qui a lieu toutes les 24 heures. Chaque ticket acheté vous donne une chance de remporter la cagnotte!`,
          {
            fields: [
              {
                name: '🏆 Cagnotte actuelle',
                value: `${lotteryInfo.jackpot} crédits`,
                inline: true
              },
              {
                name: '⏱️ Prochain tirage',
                value: getNextDrawTimeString(lotteryInfo.nextDraw),
                inline: true
              },
              {
                name: '🎫 Prix du ticket',
                value: `${ticketPrice} crédits`,
                inline: true
              },
              {
                name: '🎟️ Vos tickets',
                value: `${userTickets} ticket(s)`,
                inline: true
              },
              {
                name: '👥 Participants',
                value: `${lotteryInfo.participants} participant(s)`,
                inline: true
              },
              {
                name: '🎯 Tickets totaux',
                value: `${lotteryInfo.totalTickets} ticket(s)`,
                inline: true
              },
              {
                name: '⚙️ Fonctionnement',
                value: `80% des achats de tickets vont dans la cagnotte.\nLe gagnant remporte l'intégralité de la cagnotte.\nVos chances de gain dépendent du nombre de tickets que vous possédez par rapport au total.`,
                inline: false
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [infoEmbed] });
      }
      
    } catch (error) {
      console.error('Error in lottery command:', error);
      
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

// Fonction pour récupérer les informations de la loterie
async function getLotteryInfo(client) {
  try {
    // Récupérer les informations de base de la loterie
    const lotteryData = await client.db.db.get(`
      SELECT * FROM lottery WHERE id = 1
    `);
    
    if (!lotteryData) {
      // Initialiser la loterie si elle n'existe pas
      await initializeLottery(client);
      return {
        jackpot: 1000, // Cagnotte de départ
        nextDraw: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tirage dans 24h
        participants: 0,
        totalTickets: 0,
        userTickets: 0
      };
    }
    
    // Récupérer le nombre total de participants et de tickets
    const ticketStats = await client.db.db.get(`
      SELECT COUNT(DISTINCT user_id) as participants, SUM(tickets) as totalTickets
      FROM lottery_tickets
    `);
    
    return {
      jackpot: lotteryData.jackpot,
      nextDraw: new Date(lotteryData.next_draw),
      participants: ticketStats?.participants || 0,
      totalTickets: ticketStats?.totalTickets || 0
    };
  } catch (error) {
    console.error('Error getting lottery info:', error);
    throw error;
  }
}

// Fonction pour initialiser la loterie
async function initializeLottery(client) {
  try {
    // Créer la table lottery si elle n'existe pas
    await client.db.db.run(`
      CREATE TABLE IF NOT EXISTS lottery (
        id INTEGER PRIMARY KEY,
        jackpot INTEGER NOT NULL DEFAULT 1000,
        next_draw TEXT NOT NULL,
        last_winner TEXT,
        last_prize INTEGER
      )
    `);
    
    // Créer la table lottery_tickets si elle n'existe pas
    await client.db.db.run(`
      CREATE TABLE IF NOT EXISTS lottery_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        tickets INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id)
      )
    `);
    
    // Insérer les données initiales
    await client.db.db.run(`
      INSERT OR IGNORE INTO lottery (id, jackpot, next_draw)
      VALUES (1, 1000, datetime('now', '+1 day'))
    `);
  } catch (error) {
    console.error('Error initializing lottery:', error);
    throw error;
  }
}

// Fonction pour acheter des tickets de loterie
async function buyLotteryTickets(client, userId, ticketCount, totalCost) {
  try {
    // Ajouter les tickets à l'utilisateur
    await client.db.db.run(`
      INSERT INTO lottery_tickets (user_id, tickets)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
      tickets = tickets + ?
    `, [userId, ticketCount, ticketCount]);
    
    // Ajouter 80% du coût à la cagnotte
    await client.db.db.run(`
      UPDATE lottery
      SET jackpot = jackpot + ?
      WHERE id = 1
    `, [Math.floor(totalCost * 0.8)]);
  } catch (error) {
    console.error('Error buying lottery tickets:', error);
    throw error;
  }
}

// Fonction pour récupérer le nombre de tickets d'un utilisateur
async function getUserTickets(client, userId) {
  try {
    const userData = await client.db.db.get(`
      SELECT tickets FROM lottery_tickets WHERE user_id = ?
    `, userId);
    
    return userData?.tickets || 0;
  } catch (error) {
    console.error('Error getting user tickets:', error);
    throw error;
  }
}

// Fonction pour formater le temps jusqu'au prochain tirage
function getNextDrawTimeString(nextDraw) {
  const now = new Date();
  const timeLeft = nextDraw - now;
  
  if (timeLeft <= 0) {
    return "Bientôt...";
  }
  
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}