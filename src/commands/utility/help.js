import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { Pagination } from '../../utils/pagination.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste des commandes disponibles')
    .addStringOption(option =>
      option
        .setName('commande')
        .setDescription('Affiche l\'aide pour une commande spécifique')
        .setRequired(false)
    ),
  
  // No cooldown for help command
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Check if a specific command was requested
      const commandName = interaction.options.getString('commande');
      
      if (commandName) {
        // Fetch the specific command
        const command = client.commands.get(commandName);
        
        if (!command) {
          return interaction.editReply({
            embeds: [
              EmbedCreator.error(
                'Commande introuvable',
                `La commande \`${commandName}\` n'existe pas.\nUtilisez \`/help\` sans paramètre pour voir la liste des commandes disponibles.`
              )
            ]
          });
        }
        
        // Create embed for specific command
        const embed = EmbedCreator.create({
          title: `Commande: /${command.data.name}`,
          description: command.data.description,
          color: 'INFO',
          fields: []
        });
        
        // Add options information if any
        if (command.data.options && command.data.options.length > 0) {
          const optionsInfo = command.data.options.map(option => {
            const required = option.required ? '(Requis)' : '(Optionnel)';
            return `\`${option.name}\`: ${option.description} ${required}`;
          }).join('\n');
          
          embed.addFields({
            name: 'Options',
            value: optionsInfo,
            inline: false
          });
        }
        
        // Add cooldown information if any
        if (command.cooldown) {
          const cooldownSeconds = command.cooldown / 1000;
          let cooldownText;
          
          if (cooldownSeconds < 60) {
            cooldownText = `${cooldownSeconds} secondes`;
          } else if (cooldownSeconds < 3600) {
            cooldownText = `${Math.floor(cooldownSeconds / 60)} minute(s)`;
          } else if (cooldownSeconds < 86400) {
            cooldownText = `${Math.floor(cooldownSeconds / 3600)} heure(s)`;
          } else {
            cooldownText = `${Math.floor(cooldownSeconds / 86400)} jour(s)`;
          }
          
          embed.addFields({
            name: 'Cooldown',
            value: cooldownText,
            inline: true
          });
        }
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      // No specific command requested, show all commands grouped by category
      const categories = new Map();
      
      // Group commands by their directory (category)
      client.commands.forEach(command => {
        // Extract category from command file path
        const category = command.data.name.split('/').at(-2) || 'uncategorized';
        
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        
        categories.get(category).push(command);
      });
      
      // Create embeds for each category
      const embeds = [];
      
      for (const [category, commands] of categories) {
        // Format category name
        let formattedCategory;
        let emoji;
        
        switch (category) {
          case 'economy':
            formattedCategory = 'Économie';
            emoji = '💰';
            break;
          case 'utility':
            formattedCategory = 'Utilités';
            emoji = '🔧';
            break;
          case 'fun':
            formattedCategory = 'Divertissement';
            emoji = '🎮';
            break;
          case 'admin':
            formattedCategory = 'Administration';
            emoji = '🛡️';
            break;
          default:
            formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
            emoji = '📝';
        }
        
        // Create fields for each command
        const fields = commands.map(command => ({
          name: `/${command.data.name}`,
          value: command.data.description,
          inline: false
        }));
        
        // Create embed for this category
        const embed = EmbedCreator.create({
          title: `${emoji} Commandes: ${formattedCategory}`,
          description: `Utilisez \`/help [commande]\` pour plus de détails sur une commande spécifique.`,
          color: 'INFO',
          fields,
          timestamp: false
        });
        
        embeds.push(embed);
      }
      
      // Create a main help embed
      const mainEmbed = EmbedCreator.create({
        title: '🤖 Aide du bot PiloteCommunity',
        description: 'Bienvenue dans l\'aide du bot PiloteCommunity!\n\nCe bot offre un système d\'économie virtuelle avec des commandes pour gagner et dépenser des crédits, ainsi que des événements aléatoires qui apparaissent dans le chat.\n\nNaviguez entre les catégories pour découvrir toutes les commandes disponibles.',
        color: 'PRIMARY',
        timestamp: false
      });
      
      // Add main embed at the beginning
      embeds.unshift(mainEmbed);
      
      // Send paginated embeds
      const pagination = new Pagination(embeds, {
        userId: interaction.user.id,
        time: 120000, // 2 minutes
        fastSkip: true
      });
      
      await pagination.send(interaction);
      
    } catch (error) {
      console.error('Error in help command:', error);
      
      // Send error message
      const errorEmbed = EmbedCreator.error(
        'Erreur',
        'Une erreur est survenue lors de l\'exécution de la commande d\'aide.'
      );
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
};