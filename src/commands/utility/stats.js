import { SlashCommandBuilder, version as discordJsVersion } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { memoryUsage, cpuUsage } from 'process';
import os from 'os';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche des statistiques sur le bot'),
  
  cooldown: 10000, // 10 seconds
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Calculate uptime
      const totalSeconds = Math.floor(client.uptime / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      const uptime = `${days}j ${hours}h ${minutes}m ${seconds}s`;
      
      // Get memory usage
      const memUsage = memoryUsage();
      const memoryUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
      const memoryTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
      
      // Get CPU info
      const cpuCount = os.cpus().length;
      const cpuModel = os.cpus()[0].model;
      const cpuLoad = (os.loadavg()[0] / cpuCount * 100).toFixed(2);
      
      // Get bot stats
      const guildCount = client.guilds.cache.size;
      const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      const channelCount = client.channels.cache.size;
      
      // Get command stats
      const commandCount = client.commands.size;
      
      // Calculate command categories
      const categories = new Map();
      client.commands.forEach(command => {
        const category = command.data.name.split('/').at(-2) || 'uncategorized';
        if (!categories.has(category)) {
          categories.set(category, 0);
        }
        categories.set(category, categories.get(category) + 1);
      });
      
      // Format categories
      const categoryText = Array.from(categories.entries())
        .map(([name, count]) => `**${name}:** ${count}`)
        .join('\n');
      
      // Get database stats if possible
      let dbStats = 'Non disponible';
      try {
        const userCount = await client.db.db.get('SELECT COUNT(*) as count FROM users');
        const transactionCount = await client.db.db.get('SELECT COUNT(*) as count FROM transactions');
        
        dbStats = [
          `**Utilisateurs:** ${userCount?.count || 0}`,
          `**Transactions:** ${transactionCount?.count || 0}`
        ].join('\n');
      } catch (err) {
        console.error('Error getting DB stats:', err);
      }
      
      // Create the embed
      const embed = EmbedCreator.create({
        title: '📊 Statistiques du bot',
        description: `Statistiques et informations système pour ${client.user.username}.`,
        color: 'PRIMARY',
        fields: [
          {
            name: '⏱️ Temps de fonctionnement',
            value: uptime,
            inline: true
          },
          {
            name: '🤖 Bot',
            value: [
              `**Version:** ${client.config.version}`,
              `**Discord.js:** v${discordJsVersion}`,
              `**Node.js:** ${process.version}`
            ].join('\n'),
            inline: true
          },
          {
            name: '🔧 Système',
            value: [
              `**Plateforme:** ${process.platform}`,
              `**Mémoire:** ${memoryUsed}MB / ${memoryTotal}MB`,
              `**CPU:** ${cpuLoad}% utilisé`
            ].join('\n'),
            inline: true
          },
          {
            name: '📈 Statistiques',
            value: [
              `**Serveurs:** ${guildCount}`,
              `**Utilisateurs:** ${userCount}`,
              `**Canaux:** ${channelCount}`
            ].join('\n'),
            inline: true
          },
          {
            name: '🛠️ Commandes',
            value: [
              `**Total:** ${commandCount}`,
              categoryText
            ].join('\n'),
            inline: true
          },
          {
            name: '💾 Base de données',
            value: dbStats,
            inline: true
          }
        ],
        footer: {
          text: `Demandé par ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: true
      });
      
      // Send the embed
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in stats command:', error);
      await interaction.editReply({
        embeds: [
          EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la récupération des statistiques.')
        ]
      });
    }
  }
};