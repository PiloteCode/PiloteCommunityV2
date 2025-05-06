import { SlashCommandBuilder } from 'discord.js';
import { EmbedCreator } from '../../utils/embedCreator.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Lancez un pari sur une question ou un événement')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('La question ou l\'événement sur lequel parier')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('duree')
        .setDescription('Durée du pari en minutes (1-60)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(60)
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
    ),
  
  // Cooldown of 5 minutes
  cooldown: 5 * 60 * 1000,
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const question = interaction.options.getString('question');
      const duration = interaction.options.getInteger('duree');
      
      // Get options
      const options = [];
      for (let i = 1; i <= 4; i++) {
        const option = interaction.options.getString(`option${i}`);
        if (option) {
          options.push(option);
        }
      }
      
      // Create bet in database
      const betId = await this.createBet(client, userId, question, options, duration);
      
      // Create embed
      const embed = EmbedCreator.create({
        title: '🎲 Nouveau Pari!',
        description: `**${question}**\n\nPlacez vos paris! Vous avez **${duration}** minute${duration > 1 ? 's' : ''} pour voter.`,
        color: '#9B59B6',
        fields: options.map((option, index) => ({
          name: `Option ${index + 1}`,
          value: option,
          inline: true
        })),
        footer: { text: `Lancé par ${interaction.user.username} • Se termine dans ${duration} minute${duration > 1 ? 's' : ''}` },
        timestamp: true
      });
      
      // Create voting buttons
      const buttons = new ActionRowBuilder();
      
      for (let i = 0; i < options.length; i++) {
        buttons.addComponents(
          new ButtonBuilder()
            .setCustomId(`bet:vote:${betId}:${i}`)
            .setLabel(`Option ${i + 1}`)
            .setStyle(ButtonStyle.Primary)
        );
      }
      
      // Add end bet button (only for the creator)
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`bet:end:${betId}:${userId}`)
          .setLabel('Terminer le pari')
          .setStyle(ButtonStyle.Danger)
      );
      
      // Send message
      const message = await interaction.editReply({
        embeds: [embed],
        components: [buttons],
        fetchReply: true
      });
      
      // Update bet with message ID
      await this.updateBetMessage(client, betId, message.id);
      
      // Set up timeout to end the bet
      setTimeout(async () => {
        try {
          // Check if bet is still active
          const bet = await this.getBet(client, betId);
          
          if (bet && !bet.ended) {
            // End the bet
            await this.endBet(client, betId, null, message);
          }
        } catch (error) {
          console.error('Error ending bet with timeout:', error);
        }
      }, duration * 60 * 1000);
      
    } catch (error) {
      console.error('Error in bet command:', error);
      
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
  },
  
  // Helper methods for bets
  async createBet(client, creatorId, question, options, duration) {
    // Create bets table if it doesn't exist
    await client.db.db.exec(`
      CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_id TEXT NOT NULL,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        votes TEXT NOT NULL DEFAULT '{}',
        message_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        ends_at TEXT NOT NULL,
        ended BOOLEAN NOT NULL DEFAULT 0,
        winner INTEGER
      )
    `);
    
    // Insert new bet
    const endsAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
    
    const result = await client.db.db.run(`
      INSERT INTO bets (creator_id, question, options, ends_at)
      VALUES (?, ?, ?, ?)
    `, creatorId, question, JSON.stringify(options), endsAt);
    
    return result.lastID;
  },
  
  async updateBetMessage(client, betId, messageId) {
    await client.db.db.run(`
      UPDATE bets
      SET message_id = ?
      WHERE id = ?
    `, messageId, betId);
  },
  
  async getBet(client, betId) {
    const bet = await client.db.db.get(`
      SELECT * FROM bets
      WHERE id = ?
    `, betId);
    
    if (bet) {
      // Parse JSON fields
      bet.options = JSON.parse(bet.options);
      bet.votes = JSON.parse(bet.votes);
    }
    
    return bet;
  },
  
  async addVote(client, betId, userId, optionIndex) {
    // Get current bet
    const bet = await this.getBet(client, betId);
    
    if (!bet || bet.ended) {
      return false;
    }
    
    // Update votes
    bet.votes[userId] = optionIndex;
    
    // Save back to database
    await client.db.db.run(`
      UPDATE bets
      SET votes = ?
      WHERE id = ?
    `, JSON.stringify(bet.votes), betId);
    
    return true;
  },
  
  async endBet(client, betId, winnerId, message) {
    // Get current bet
    const bet = await this.getBet(client, betId);
    
    if (!bet || bet.ended) {
      return false;
    }
    
    // Update as ended
    let winner = null;
    if (winnerId !== null) {
      // Creator selected a winner
      winner = parseInt(winnerId);
    } else {
      // Auto-select winner based on votes
      const voteCounts = Array(bet.options.length).fill(0);
      
      // Count votes for each option
      Object.values(bet.votes).forEach(optionIndex => {
        voteCounts[optionIndex]++;
      });
      
      // Find option with most votes
      let maxVotes = -1;
      let winningIndex = -1;
      
      voteCounts.forEach((count, index) => {
        if (count > maxVotes) {
          maxVotes = count;
          winningIndex = index;
        }
      });
      
      // Set winner (if there are votes)
      if (maxVotes > 0) {
        winner = winningIndex;
      }
    }
    
    // Save to database
    await client.db.db.run(`
      UPDATE bets
      SET ended = 1, winner = ?
      WHERE id = ?
    `, winner, betId);
    
    // Update message if provided
    if (message) {
      try {
        // Count votes for display
        const voteCounts = Array(bet.options.length).fill(0);
        let totalVotes = 0;
        
        Object.values(bet.votes).forEach(optionIndex => {
          voteCounts[optionIndex]++;
          totalVotes++;
        });
        
        // Create result fields
        const resultFields = bet.options.map((option, index) => {
          const votes = voteCounts[index];
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isWinner = index === winner;
          
          return {
            name: `Option ${index + 1}${isWinner ? ' 🏆' : ''}`,
            value: `${option}\n${votes} vote${votes !== 1 ? 's' : ''} (${percentage}%)`,
            inline: true
          };
        });
        
        // Create result embed
        const resultEmbed = EmbedCreator.create({
          title: '🎲 Pari Terminé!',
          description: `**${bet.question}**\n\n${winner !== null ? `L'option gagnante est: **${bet.options[winner]}**` : 'Aucun gagnant n\'a été déterminé.'}`,
          color: '#9B59B6',
          fields: resultFields,
          footer: { text: `Pari terminé • ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} au total` },
          timestamp: true
        });
        
        // Update message
        await message.edit({
          embeds: [resultEmbed],
          components: []
        });
      } catch (error) {
        console.error('Error updating bet message:', error);
      }
    }
    
    return true;
  }
};