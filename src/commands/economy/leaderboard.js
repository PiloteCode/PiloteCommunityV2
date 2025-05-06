import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Affiche le classement des membres')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type de classement à afficher')
        .setRequired(false)
        .addChoices(
          { name: 'Richesse', value: 'wealth' },
          { name: 'Niveau', value: 'level' }
        )
    ),
  
  // No cooldown for this command
  cooldown: 0,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      // Get leaderboard type
      const type = interaction.options.getString('type') || 'wealth';
      
      // Fetch leaderboard data
      let users;
      
      if (type === 'wealth') {
        users = await client.db.getRichestUsers(10);
      } else {
        users = await client.db.getHighestLevelUsers(10);
      }
      
      if (users.length === 0) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.warning(
              'Classement vide',
              'Aucun utilisateur n\'a encore participé à l\'économie.'
            )
          ]
        });
      }
      
      // Format the leaderboard
      let description = '';
      
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        // Try to fetch user details from Discord
        let username;
        try {
          const discordUser = await client.users.fetch(user.user_id);
          username = discordUser.username;
        } catch (error) {
          username = 'Utilisateur inconnu';
        }
        
        // Add medal emoji for top 3
        let position;
        switch(i) {
          case 0:
            position = '🥇';
            break;
          case 1:
            position = '🥈';
            break;
          case 2:
            position = '🥉';
            break;
          default:
            position = `${i + 1}.`;
        }
        
        // Format entry based on leaderboard type
        if (type === 'wealth') {
          description += `${position} **${username}** - ${user.balance} PiloCoins\n`;
        } else {
          description += `${position} **${username}** - Niveau ${user.level} (${user.experience} XP)\n`;
        }
      }
      
      // Create the leaderboard embed
      const embed = EmbedCreator.create({
        title: type === 'wealth' ? '💰 Classement par richesse' : '📊 Classement par niveau',
        description,
        color: type === 'wealth' ? 'ECONOMY' : 'PROFILE',
        timestamp: true
      });
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      
      // Send error message
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