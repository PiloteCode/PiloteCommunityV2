import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Crée un sondage interactif')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('La question du sondage')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('option1')
        .setDescription('Première option')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('option2')
        .setDescription('Deuxième option')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('option3')
        .setDescription('Troisième option (optionnelle)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('option4')
        .setDescription('Quatrième option (optionnelle)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('option5')
        .setDescription('Cinquième option (optionnelle)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('option6')
        .setDescription('Sixième option (optionnelle)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('option7')
        .setDescription('Septième option (optionnelle)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('option8')
        .setDescription('Huitième option (optionnelle)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('option9')
        .setDescription('Neuvième option (optionnelle)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('option10')
        .setDescription('Dixième option (optionnelle)')
        .setRequired(false)
    ),
  
  cooldown: 30000, // 30 seconds
  
  async execute(interaction, client) {
    try {
      // Get the question
      const question = interaction.options.getString('question');
      
      // Get the options
      const options = [];
      for (let i = 1; i <= 10; i++) {
        const option = interaction.options.getString(`option${i}`);
        if (option) {
          options.push(option);
        }
      }
      
      // Define emojis for each option
      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      
      // Create the poll embed
      const embed = EmbedCreator.create({
        title: '📊 Sondage',
        description: `**${question}**\n\n${options.map((option, index) => `${emojis[index]} ${option}`).join('\n\n')}`,
        color: 'PRIMARY',
        footer: {
          text: `Sondage créé par ${interaction.user.tag} • Réagissez avec les émojis ci-dessous pour voter`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: true
      });
      
      // Send the poll
      const message = await interaction.reply({
        embeds: [embed],
        fetchReply: true
      });
      
      // Add reactions for each option
      for (let i = 0; i < options.length; i++) {
        await message.react(emojis[i]);
      }
      
    } catch (error) {
      console.error('Error in poll command:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          embeds: [
            EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la création du sondage.')
          ]
        });
      } else {
        await interaction.reply({
          embeds: [
            EmbedCreator.error('Erreur', 'Une erreur est survenue lors de la création du sondage.')
          ],
          ephemeral: true
        });
      }
    }
  }
};