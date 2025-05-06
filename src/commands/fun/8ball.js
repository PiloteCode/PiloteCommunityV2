import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Posez une question à la boule magique')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('La question à poser')
        .setRequired(true)
    ),
  
  // Cooldown of 10 seconds
  cooldown: 10000,
  
  async execute(interaction, client) {
    try {
      // Get the question
      const question = interaction.options.getString('question');
      
      // Array of possible responses
      const responses = [
        // Positive responses
        "Certainement!",
        "Oui, absolument.",
        "Sans aucun doute.",
        "Oui, définitivement.",
        "Vous pouvez compter dessus.",
        "Très probablement.",
        "Les perspectives sont bonnes.",
        "Oui.",
        "Tous les signes indiquent que oui.",
        
        // Neutral responses
        "Réponse floue, essayez à nouveau.",
        "Demandez à nouveau plus tard.",
        "Il vaut mieux ne pas vous le dire maintenant.",
        "Impossible de prédire maintenant.",
        "Concentrez-vous et demandez à nouveau.",
        "N'y comptez pas trop.",
        
        // Negative responses
        "Ma réponse est non.",
        "Mes sources disent non.",
        "Les perspectives ne sont pas bonnes.",
        "Très douteux.",
        "Non.",
        "Les étoiles ne sont pas alignées pour ça.",
        "Ce n'est pas le moment.",
        "J'en doute fort."
      ];
      
      // Select a random response
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      // Determine color based on the type of response
      let color;
      if (responses.indexOf(response) < 9) {
        color = 'SUCCESS'; // Positive responses (green)
      } else if (responses.indexOf(response) < 15) {
        color = 'WARNING'; // Neutral responses (yellow)
      } else {
        color = 'ERROR'; // Negative responses (red)
      }
      
      // Create the 8ball embed
      const embed = EmbedCreator.create({
        title: '🎱 Boule Magique',
        description: `**Question:** ${question}\n\n**Réponse:** ${response}`,
        color,
        thumbnail: 'https://i.imgur.com/44uYp3L.png', // Magic 8-ball image
        timestamp: true
      });
      
      // Reply with the embed
      await interaction.reply({
        embeds: [embed]
      });
      
    } catch (error) {
      console.error('Error in 8ball command:', error);
      
      // Send error message
      await interaction.reply({
        embeds: [
          EmbedCreator.error(
            'Erreur',
            'Une erreur est survenue lors de l\'exécution de la commande.'
          )
        ],
        ephemeral: true
      });
    }
  }
};