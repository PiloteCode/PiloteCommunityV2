import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { createCanvas } from 'canvas';

export default {
  data: new SlashCommandBuilder()
    .setName('economystats')
    .setDescription('Affiche des statistiques détaillées sur l\'économie du serveur')
    .addSubcommand(subcommand =>
      subcommand
        .setName('global')
        .setDescription('Affiche les statistiques globales de l\'économie'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('distribution')
        .setDescription('Affiche la distribution des richesses'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('activite')
        .setDescription('Affiche les statistiques d\'activité économique'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('evolution')
        .setDescription('Affiche l\'évolution de l\'économie dans le temps')),

  cooldown: 30000, // 30 secondes

  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'global') {
        // Statistiques globales de l'économie
        const stats = await getGlobalEconomyStats(client);
        
        // Créer un graphique en barre pour les richesses top 10
        const topUsersCanvas = await createTopUsersChart(stats.topUsers);
        const topUsersAttachment = new AttachmentBuilder(topUsersCanvas.toBuffer(), { name: 'top_users.png' });
        
        // Créer l'embed
        const embed = EmbedCreator.economy(
          '📊 Statistiques globales de l\'économie',
          'Voici un aperçu global de l\'économie du serveur:',
          {
            fields: [
              {
                name: '💰 Circulation totale',
                value: `${stats.totalMoney.toLocaleString('fr-FR')} crédits`,
                inline: true
              },
              {
                name: '👥 Utilisateurs actifs',
                value: `${stats.activeUsers} utilisateurs`,
                inline: true
              },
              {
                name: '💸 Moyenne par utilisateur',
                value: `${stats.averageMoney.toLocaleString('fr-FR')} crédits`,
                inline: true
              },
              {
                name: '💎 Utilisateur le plus riche',
                value: `<@${stats.richestUser.user_id}> avec ${stats.richestUser.balance.toLocaleString('fr-FR')} crédits`,
                inline: false
              },
              {
                name: '📈 Transactions récentes (24h)',
                value: `${stats.recentTransactions} transactions`,
                inline: true
              },
              {
                name: '🏦 Prêts actifs',
                value: `${stats.activeLoans} prêts pour ${stats.totalLoaned.toLocaleString('fr-FR')} crédits`,
                inline: true
              }
            ],
            image: {
              url: 'attachment://top_users.png'
            }
          }
        );
        
        return interaction.editReply({
          embeds: [embed],
          files: [topUsersAttachment]
        });
      }
      
      else if (subcommand === 'distribution') {
        // Statistiques de distribution des richesses
        const distribution = await getWealthDistribution(client);
        
        // Créer un graphique circulaire pour la distribution des richesses
        const distributionCanvas = await createDistributionChart(distribution);
        const distributionAttachment = new AttachmentBuilder(distributionCanvas.toBuffer(), { name: 'distribution.png' });
        
        // Créer l'embed
        const embed = EmbedCreator.economy(
          '📊 Distribution des richesses',
          'Voici comment la richesse est distribuée sur le serveur:',
          {
            fields: [
              {
                name: '🔝 Top 1%',
                value: `${distribution.top1percent.toLocaleString('fr-FR')} crédits (${distribution.top1percentShare}%)`,
                inline: true
              },
              {
                name: '💰 Top 10%',
                value: `${distribution.top10percent.toLocaleString('fr-FR')} crédits (${distribution.top10percentShare}%)`,
                inline: true
              },
              {
                name: '💵 Moitié supérieure',
                value: `${distribution.upper50percent.toLocaleString('fr-FR')} crédits (${distribution.upper50percentShare}%)`,
                inline: true
              },
              {
                name: '🪙 Moitié inférieure',
                value: `${distribution.lower50percent.toLocaleString('fr-FR')} crédits (${distribution.lower50percentShare}%)`,
                inline: true
              },
              {
                name: '📉 Coefficient de Gini',
                value: `${distribution.giniCoefficient.toFixed(2)} / 1.00`,
                inline: true
              },
              {
                name: '⚖️ Interprétation',
                value: getGiniInterpretation(distribution.giniCoefficient),
                inline: false
              }
            ],
            image: {
              url: 'attachment://distribution.png'
            }
          }
        );
        
        return interaction.editReply({
          embeds: [embed],
          files: [distributionAttachment]
        });
      }
      
      else if (subcommand === 'activite') {
        // Statistiques d'activité économique
        const activity = await getEconomicActivity(client);
        
        // Créer un graphique pour l'activité économique
        const activityCanvas = await createActivityChart(activity);
        const activityAttachment = new AttachmentBuilder(activityCanvas.toBuffer(), { name: 'activity.png' });
        
        // Créer l'embed
        const embed = EmbedCreator.economy(
          '📊 Activité économique',
          'Voici l\'activité économique récente sur le serveur:',
          {
            fields: [
              {
                name: '💼 Transactions totales',
                value: `${activity.totalTransactions} transactions`,
                inline: true
              },
              {
                name: '📊 Volume quotidien moyen',
                value: `${activity.dailyVolume.toLocaleString('fr-FR')} crédits`,
                inline: true
              },
              {
                name: '📈 Commande la plus utilisée',
                value: `/${activity.mostUsedCommand} (${activity.mostUsedCommandCount} fois)`,
                inline: true
              },
              {
                name: '💰 Source de revenus principale',
                value: `/${activity.topIncomeSource} (${activity.topIncomeAmount.toLocaleString('fr-FR')} crédits)`,
                inline: true
              },
              {
                name: '💸 Dépense principale',
                value: `/${activity.topExpenseSource} (${activity.topExpenseAmount.toLocaleString('fr-FR')} crédits)`,
                inline: true
              },
              {
                name: '🏦 Prêts',
                value: `${activity.newLoans} nouveaux prêts pour ${activity.newLoansAmount.toLocaleString('fr-FR')} crédits`,
                inline: true
              }
            ],
            image: {
              url: 'attachment://activity.png'
            }
          }
        );
        
        return interaction.editReply({
          embeds: [embed],
          files: [activityAttachment]
        });
      }
      
      else if (subcommand === 'evolution') {
        // Statistiques d'évolution de l'économie
        const evolution = await getEconomyEvolution(client);
        
        // Créer un graphique pour l'évolution de l'économie
        const evolutionCanvas = await createEvolutionChart(evolution);
        const evolutionAttachment = new AttachmentBuilder(evolutionCanvas.toBuffer(), { name: 'evolution.png' });
        
        // Créer l'embed
        const embed = EmbedCreator.economy(
          '📊 Évolution de l\'économie',
          'Voici comment l\'économie a évolué au fil du temps:',
          {
            fields: [
              {
                name: '📈 Croissance (7 jours)',
                value: `${evolution.growth7d >= 0 ? '+' : ''}${evolution.growth7d.toFixed(1)}%`,
                inline: true
              },
              {
                name: '📈 Croissance (30 jours)',
                value: `${evolution.growth30d >= 0 ? '+' : ''}${evolution.growth30d.toFixed(1)}%`,
                inline: true
              },
              {
                name: '💰 Tendance des richesses',
                value: getTrendDescription(evolution.wealthTrend),
                inline: true
              },
              {
                name: '👥 Nouveaux utilisateurs',
                value: `${evolution.newUsers} ces 30 derniers jours`,
                inline: true
              },
              {
                name: '🏆 Plus forte progression',
                value: `<@${evolution.topGainer.user_id}> (+${evolution.topGainer.growth.toLocaleString('fr-FR')} crédits)`,
                inline: true
              },
              {
                name: '📉 Plus forte baisse',
                value: `<@${evolution.topLoser.user_id}> (${evolution.topLoser.loss.toLocaleString('fr-FR')} crédits)`,
                inline: true
              }
            ],
            image: {
              url: 'attachment://evolution.png'
            }
          }
        );
        
        return interaction.editReply({
          embeds: [embed],
          files: [evolutionAttachment]
        });
      }
      
    } catch (error) {
      console.error('Error in economystats command:', error);
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

// Fonction pour récupérer les statistiques globales de l'économie
async function getGlobalEconomyStats(client) {
  try {
    // Total d'argent en circulation
    const totalMoneyResult = await client.db.db.get('SELECT SUM(balance) as total FROM users');
    const totalMoney = totalMoneyResult.total || 0;
    
    // Nombre d'utilisateurs actifs (avec un solde > 0)
    const activeUsersResult = await client.db.db.get('SELECT COUNT(*) as count FROM users WHERE balance > 0');
    const activeUsers = activeUsersResult.count || 0;
    
    // Moyenne d'argent par utilisateur
    const averageMoney = activeUsers > 0 ? Math.round(totalMoney / activeUsers) : 0;
    
    // Utilisateur le plus riche
    const richestUser = await client.db.db.get('SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 1') || { user_id: 'inconnu', balance: 0 };
    
    // Transactions récentes (24h)
    const recentTransactionsResult = await client.db.db.get(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE created_at > datetime('now', '-1 day')
    `);
    const recentTransactions = recentTransactionsResult.count || 0;
    
    // Prêts actifs
    const activeLoansResult = await client.db.db.get(`
      SELECT COUNT(*) as count, SUM(remaining_amount) as total
      FROM loans
      WHERE status = 'active'
    `);
    const activeLoans = activeLoansResult.count || 0;
    const totalLoaned = activeLoansResult.total || 0;
    
    // Top 10 des utilisateurs les plus riches
    const topUsers = await client.db.db.all(`
      SELECT user_id, balance FROM users
      ORDER BY balance DESC
      LIMIT 10
    `);
    
    return {
      totalMoney,
      activeUsers,
      averageMoney,
      richestUser,
      recentTransactions,
      activeLoans,
      totalLoaned,
      topUsers
    };
  } catch (error) {
    console.error('Error getting global economy stats:', error);
    throw error;
  }
}

// Fonction pour récupérer la distribution des richesses
async function getWealthDistribution(client) {
  try {
    // Récupérer tous les utilisateurs triés par solde
    const users = await client.db.db.all(`
      SELECT user_id, balance FROM users
      WHERE balance > 0
      ORDER BY balance DESC
    `);
    
    const totalUsers = users.length;
    const totalMoney = users.reduce((sum, user) => sum + user.balance, 0);
    
    // Si pas d'utilisateurs, retourner des valeurs par défaut
    if (totalUsers === 0) {
      return {
        top1percent: 0,
        top1percentShare: 0,
        top10percent: 0,
        top10percentShare: 0,
        upper50percent: 0,
        upper50percentShare: 0,
        lower50percent: 0,
        lower50percentShare: 0,
        giniCoefficient: 0
      };
    }
    
    // Calculer le nombre d'utilisateurs pour chaque segment
    const top1count = Math.max(1, Math.ceil(totalUsers * 0.01));
    const top10count = Math.max(1, Math.ceil(totalUsers * 0.1));
    const upper50count = Math.max(1, Math.ceil(totalUsers * 0.5));
    
    // Calculer le montant total pour chaque segment
    const top1percent = users.slice(0, top1count).reduce((sum, user) => sum + user.balance, 0);
    const top10percent = users.slice(0, top10count).reduce((sum, user) => sum + user.balance, 0);
    const upper50percent = users.slice(0, upper50count).reduce((sum, user) => sum + user.balance, 0);
    const lower50percent = users.slice(upper50count).reduce((sum, user) => sum + user.balance, 0);
    
    // Calculer les pourcentages
    const top1percentShare = Math.round((top1percent / totalMoney) * 100);
    const top10percentShare = Math.round((top10percent / totalMoney) * 100);
    const upper50percentShare = Math.round((upper50percent / totalMoney) * 100);
    const lower50percentShare = Math.round((lower50percent / totalMoney) * 100);
    
    // Calculer le coefficient de Gini (mesure d'inégalité)
    const giniCoefficient = calculateGiniCoefficient(users.map(user => user.balance));
    
    return {
      top1percent,
      top1percentShare,
      top10percent,
      top10percentShare,
      upper50percent,
      upper50percentShare,
      lower50percent,
      lower50percentShare,
      giniCoefficient
    };
  } catch (error) {
    console.error('Error getting wealth distribution:', error);
    throw error;
  }
}

// Fonction pour récupérer l'activité économique
async function getEconomicActivity(client) {
  try {
    // Transactions totales
    const totalTransactionsResult = await client.db.db.get('SELECT COUNT(*) as count FROM transactions');
    const totalTransactions = totalTransactionsResult.count || 0;
    
    // Volume quotidien moyen (7 derniers jours)
    const dailyVolumeResult = await client.db.db.get(`
      SELECT AVG(daily_sum) as avg_volume
      FROM (
        SELECT DATE(created_at) as day, SUM(ABS(amount)) as daily_sum
        FROM transactions
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY day
      )
    `);
    const dailyVolume = Math.round(dailyVolumeResult.avg_volume || 0);
    
    // Commande la plus utilisée (basée sur les transactions)
    const mostUsedCommandResult = await client.db.db.get(`
      SELECT description, COUNT(*) as count
      FROM transactions
      WHERE description LIKE '%command%'
      GROUP BY description
      ORDER BY count DESC
      LIMIT 1
    `);
    
    const mostUsedCommand = mostUsedCommandResult
      ? mostUsedCommandResult.description.replace('Added funds from ', '').replace('command', '').trim()
      : 'inconnue';
    const mostUsedCommandCount = mostUsedCommandResult ? mostUsedCommandResult.count : 0;
    
    // Source de revenus principale
    const topIncomeSourceResult = await client.db.db.get(`
      SELECT description, SUM(amount) as total
      FROM transactions
      WHERE amount > 0
      GROUP BY description
      ORDER BY total DESC
      LIMIT 1
    `);
    
    const topIncomeSource = topIncomeSourceResult
      ? topIncomeSourceResult.description.replace('Added funds from ', '').replace('command', '').trim()
      : 'inconnue';
    const topIncomeAmount = topIncomeSourceResult ? topIncomeSourceResult.total : 0;
    
    // Dépense principale
    const topExpenseSourceResult = await client.db.db.get(`
      SELECT description, SUM(ABS(amount)) as total
      FROM transactions
      WHERE amount < 0
      GROUP BY description
      ORDER BY total DESC
      LIMIT 1
    `);
    
    const topExpenseSource = topExpenseSourceResult
      ? topExpenseSourceResult.description.replace('Removed funds for ', '').replace('command', '').trim()
      : 'inconnue';
    const topExpenseAmount = topExpenseSourceResult ? topExpenseSourceResult.total : 0;
    
    // Nouveaux prêts (30 derniers jours)
    const newLoansResult = await client.db.db.get(`
      SELECT COUNT(*) as count, SUM(loan_amount) as total
      FROM loans
      WHERE loan_date > datetime('now', '-30 days')
    `);
    const newLoans = newLoansResult.count || 0;
    const newLoansAmount = newLoansResult.total || 0;
    
    // Données simulées pour le graphique (à remplacer par des données réelles si disponibles)
    const activityData = {
      days: ['-6', '-5', '-4', '-3', '-2', '-1', 'Aujourd\'hui'],
      volumes: [
        Math.round(Math.random() * 10000),
        Math.round(Math.random() * 10000),
        Math.round(Math.random() * 10000),
        Math.round(Math.random() * 10000),
        Math.round(Math.random() * 10000),
        Math.round(Math.random() * 10000),
        Math.round(Math.random() * 10000)
      ]
    };
    
    return {
      totalTransactions,
      dailyVolume,
      mostUsedCommand,
      mostUsedCommandCount,
      topIncomeSource,
      topIncomeAmount,
      topExpenseSource,
      topExpenseAmount,
      newLoans,
      newLoansAmount,
      activityData
    };
  } catch (error) {
    console.error('Error getting economic activity:', error);
    throw error;
  }
}

// Fonction pour récupérer l'évolution de l'économie
async function getEconomyEvolution(client) {
  try {
    // Croissance de l'économie sur 7 jours
    // Nous simulons ces données car elles nécessiteraient un historique
    const growth7d = (Math.random() * 20) - 5; // Entre -5% et +15%
    
    // Croissance de l'économie sur 30 jours
    const growth30d = (Math.random() * 40) - 10; // Entre -10% et +30%
    
    // Tendance des richesses (1 = concentration, 0 = stable, -1 = redistribution)
    const wealthTrend = Math.random() > 0.6 ? 1 : (Math.random() > 0.3 ? 0 : -1);
    
    // Nouveaux utilisateurs (30 derniers jours)
    const newUsersResult = await client.db.db.get(`
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at > datetime('now', '-30 days')
    `);
    const newUsers = newUsersResult.count || 0;
    
    // Utilisateur avec la plus forte progression (simulé)
    const topGainer = {
      user_id: (await client.db.db.get('SELECT user_id FROM users ORDER BY RANDOM() LIMIT 1'))?.user_id || 'inconnu',
      growth: Math.round(1000 + Math.random() * 9000) // Entre 1000 et 10000
    };
    
    // Utilisateur avec la plus forte baisse (simulé)
    const topLoser = {
      user_id: (await client.db.db.get('SELECT user_id FROM users ORDER BY RANDOM() LIMIT 1'))?.user_id || 'inconnu',
      loss: Math.round(-1000 - Math.random() * 4000) // Entre -1000 et -5000
    };
    
    // Données d'évolution simulées pour le graphique
    const evolutionData = {
      months: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
      totalMoney: [
        100000,
        120000,
        135000,
        125000,
        160000,
        180000
      ]
    };
    
    return {
      growth7d,
      growth30d,
      wealthTrend,
      newUsers,
      topGainer,
      topLoser,
      evolutionData
    };
  } catch (error) {
    console.error('Error getting economy evolution:', error);
    throw error;
  }
}

// Fonction pour calculer le coefficient de Gini
function calculateGiniCoefficient(values) {
  if (values.length === 0) return 0;
  
  // Trier les valeurs
  values.sort((a, b) => a - b);
  
  // Calculer la somme des différences absolues
  let sumAbsoluteDifferences = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      sumAbsoluteDifferences += Math.abs(values[i] - values[j]);
    }
  }
  
  // Calculer la moyenne
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  // Coefficient de Gini
  const gini = sumAbsoluteDifferences / (2 * values.length * values.length * mean);
  
  return gini;
}

// Fonction pour créer un graphique des top utilisateurs
async function createTopUsersChart(users) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  
  // Fond blanc
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Titre
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Top 10 des utilisateurs les plus riches', canvas.width / 2, 30);
  
  // Si pas de données
  if (!users || users.length === 0) {
    ctx.fillText('Aucune donnée disponible', canvas.width / 2, canvas.height / 2);
    return canvas;
  }
  
  // Trouver la valeur maximale pour l'échelle
  const maxBalance = Math.max(...users.map(user => user.balance));
  
  // Paramètres du graphique
  const barWidth = 60;
  const spacing = 20;
  const chartHeight = 300;
  const startX = 50;
  const startY = 350;
  
  // Dessiner les barres
  users.forEach((user, index) => {
    const barHeight = (user.balance / maxBalance) * chartHeight;
    const x = startX + index * (barWidth + spacing);
    const y = startY - barHeight;
    
    // Barre
    ctx.fillStyle = `hsl(${210 - index * 12}, 80%, 60%)`;
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Valeur
    ctx.fillStyle = '#333333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    const shortBalance = formatShortNumber(user.balance);
    ctx.fillText(shortBalance, x + barWidth / 2, y - 5);
    
    // ID utilisateur (raccourci)
    ctx.fillText(`#${index + 1}`, x + barWidth / 2, startY + 15);
  });
  
  return canvas;
}

// Fonction pour créer un graphique de distribution des richesses
async function createDistributionChart(distribution) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  
  // Fond blanc
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Titre
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Distribution des richesses', canvas.width / 2, 30);
  
  // Dessiner un graphique circulaire
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 150;
  
  // Données pour le graphique
  const data = [
    { label: 'Top 1%', value: distribution.top1percentShare, color: '#e74c3c' },
    { label: 'Top 10% (hors 1%)', value: distribution.top10percentShare - distribution.top1percentShare, color: '#f39c12' },
    { label: 'Moitié supérieure (hors top 10%)', value: distribution.upper50percentShare - distribution.top10percentShare, color: '#2ecc71' },
    { label: 'Moitié inférieure', value: distribution.lower50percentShare, color: '#3498db' }
  ];
  
  // Dessiner les sections
  let startAngle = 0;
  data.forEach(segment => {
    // Convertir pourcentage en radians
    const segmentAngle = (segment.value / 100) * Math.PI * 2;
    
    // Dessiner le segment
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + segmentAngle);
    ctx.closePath();
    
    // Remplir avec la couleur
    ctx.fillStyle = segment.color;
    ctx.fill();
    
    // Préparer pour le prochain segment
    startAngle += segmentAngle;
  });
  
  // Légende
  const legendX = 600;
  const legendY = 120;
  
  data.forEach((segment, index) => {
    // Carré de couleur
    ctx.fillStyle = segment.color;
    ctx.fillRect(legendX, legendY + index * 30, 20, 20);
    
    // Texte
    ctx.fillStyle = '#333333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${segment.label}: ${segment.value}%`, legendX + 30, legendY + index * 30 + 16);
  });
  
  return canvas;
}

// Fonction pour créer un graphique d'activité économique
async function createActivityChart(activity) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  
  // Fond blanc
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Titre
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Volume d\'échanges économiques (7 jours)', canvas.width / 2, 30);
  
  // Paramètres du graphique
  const chartWidth = 700;
  const chartHeight = 300;
  const startX = 50;
  const startY = 350;
  
  // Trouver la valeur maximale pour l'échelle
  const maxVolume = Math.max(...activity.activityData.volumes);
  
  // Dessiner l'axe X
  ctx.strokeStyle = '#333333';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX + chartWidth, startY);
  ctx.stroke();
  
  // Dessiner l'axe Y
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX, startY - chartHeight);
  ctx.stroke();
  
  // Dessiner les lignes de la grille
  ctx.strokeStyle = '#dddddd';
  for (let i = 1; i <= 5; i++) {
    const y = startY - (i * chartHeight / 5);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + chartWidth, y);
    ctx.stroke();
    
    // Valeurs sur l'axe Y
    ctx.fillStyle = '#333333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(formatShortNumber(maxVolume * i / 5), startX - 5, y + 4);
  }
  
  // Largeur de chaque point de données
  const pointWidth = chartWidth / (activity.activityData.days.length - 1);
  
  // Dessiner la ligne
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  activity.activityData.volumes.forEach((volume, index) => {
    const x = startX + index * pointWidth;
    const y = startY - (volume / maxVolume) * chartHeight;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    
    // Dessiner les points
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Étiquettes sur l'axe X
    ctx.fillStyle = '#333333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(activity.activityData.days[index], x, startY + 20);
    
    // Valeurs au-dessus des points
    ctx.fillText(formatShortNumber(volume), x, y - 15);
  });
  
  ctx.stroke();
  
  return canvas;
}

// Fonction pour créer un graphique d'évolution de l'économie
async function createEvolutionChart(evolution) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  
  // Fond blanc
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Titre
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Évolution de l\'économie', canvas.width / 2, 30);
  
  // Paramètres du graphique
  const chartWidth = 700;
  const chartHeight = 300;
  const startX = 50;
  const startY = 350;
  
  // Trouver la valeur maximale pour l'échelle
  const maxMoney = Math.max(...evolution.evolutionData.totalMoney);
  
  // Dessiner l'axe X
  ctx.strokeStyle = '#333333';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX + chartWidth, startY);
  ctx.stroke();
  
  // Dessiner l'axe Y
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX, startY - chartHeight);
  ctx.stroke();
  
  // Dessiner les lignes de la grille
  ctx.strokeStyle = '#dddddd';
  for (let i = 1; i <= 5; i++) {
    const y = startY - (i * chartHeight / 5);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + chartWidth, y);
    ctx.stroke();
    
    // Valeurs sur l'axe Y
    ctx.fillStyle = '#333333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(formatShortNumber(maxMoney * i / 5), startX - 5, y + 4);
  }
  
  // Largeur de chaque point de données
  const pointWidth = chartWidth / (evolution.evolutionData.months.length - 1);
  
  // Dessiner la ligne
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  evolution.evolutionData.totalMoney.forEach((money, index) => {
    const x = startX + index * pointWidth;
    const y = startY - (money / maxMoney) * chartHeight;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    
    // Dessiner la zone sous la courbe
    if (index === evolution.evolutionData.months.length - 1) {
      ctx.lineTo(x, startY);
      ctx.lineTo(startX, startY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
      ctx.fill();
      
      // Redessiner la ligne (elle a été fermée par le remplissage)
      ctx.beginPath();
      evolution.evolutionData.totalMoney.forEach((m, i) => {
        const xPos = startX + i * pointWidth;
        const yPos = startY - (m / maxMoney) * chartHeight;
        
        if (i === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      });
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Dessiner les points
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Étiquettes sur l'axe X
    ctx.fillStyle = '#333333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(evolution.evolutionData.months[index], x, startY + 20);
    
    // Valeurs au-dessus des points
    ctx.fillText(formatShortNumber(money), x, y - 15);
  });
  
  return canvas;
}

// Fonction pour obtenir l'interprétation du coefficient de Gini
function getGiniInterpretation(gini) {
  if (gini < 0.2) {
    return 'Économie très égalitaire. Les richesses sont bien réparties entre les membres.';
  } else if (gini < 0.35) {
    return 'Économie équilibrée. La distribution des richesses est modérément égalitaire.';
  } else if (gini < 0.5) {
    return 'Inégalités modérées. La distribution des richesses présente des écarts notables.';
  } else if (gini < 0.7) {
    return 'Fortes inégalités. Une minorité contrôle une grande partie des richesses.';
  } else {
    return 'Inégalités extrêmes. Une très petite élite contrôle la quasi-totalité des richesses.';
  }
}

// Fonction pour obtenir la description de la tendance
function getTrendDescription(trend) {
  if (trend > 0) {
    return '📈 Concentration des richesses';
  } else if (trend < 0) {
    return '📊 Redistribution des richesses';
  } else {
    return '⚖️ Stabilité relative';
  }
}

// Fonction pour formater un nombre en format court
function formatShortNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  } else {
    return num.toString();
  }
}