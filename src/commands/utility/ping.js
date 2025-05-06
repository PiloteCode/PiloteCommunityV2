import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Affiche la latence du bot et de l\'API Discord'),
  
  cooldown: 5000, // 5 seconds
  
  async execute(interaction, client) {
    try {
      // Send initial message
      const sent = await interaction.reply({
        embeds: [
          EmbedCreator.create({
            title: '🏓 Ping...',
            description: 'Mesure de la latence en cours...',
            color: 'PRIMARY'
          })
        ],
        fetchReply: true
      });
      
      // Calculate latencies
      const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);
      
      // Determine status indicators
      let botStatus, apiStatus;
      
      // Bot latency status
      if (botLatency < 100) {
        botStatus = '🟢 Excellent';
      } else if (botLatency < 200) {
        botStatus = '🟢 Bon';
      } else if (botLatency < 400) {
        botStatus = '🟡 Correct';
      } else if (botLatency < 700) {
        botStatus = '🟠 Lent';
      } else {
        botStatus = '🔴 Très lent';
      }
      
      // API latency status
      if (apiLatency < 100) {
        apiStatus = '🟢 Excellent';
      } else if (apiLatency < 200) {
        apiStatus = '🟢 Bon';
      } else if (apiLatency < 400) {
        apiStatus = '🟡 Correct';
      } else if (apiLatency < 700) {
        apiStatus = '🟠 Lent';
      } else {
        apiStatus = '🔴 Très lent';
      }
      
      // Update the message with the results
      await interaction.editReply({
        embeds: [
          EmbedCreator.create({
            title: '🏓 Pong!',
            description: 'Voici les informations de latence:',
            color: 'PRIMARY',
            fields: [
              {
                name: '⏱️ Latence du bot',
                value: `${botLatency}ms (${botStatus})`,
                inline: true
              },
              {
                name: '⚡ Latence de l\'API',
                value: `${apiLatency}ms (${apiStatus})`,
                inline: true
              }
            ],
            footer: {
              text: `Demandé par ${interaction.user.tag}`,
              iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            },
            timestamp: true
          })
        ]
      });
      
    } catch (error) {
      console.error('Error in ping command:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          embeds: [
            EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la mesure de la latence.')
          ]
        });
      } else {
        await interaction.reply({
          embeds: [
            EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la mesure de la latence.')
          ],
          ephemeral: true
        });
      }
    }
  }
};