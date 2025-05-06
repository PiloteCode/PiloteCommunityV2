import { EmbedCreator } from '../utils/embedCreator.js';

export default {
  customId: 'coinflip',
  
  async execute(interaction, client, extraData) {
    try {
      const [choice, userId, amount] = extraData;
      
      // Verify that the user who clicked is the one who initiated
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: 'Vous ne pouvez pas participer au pile ou face de quelqu\'un d\'autre.',
          ephemeral: true
        });
      }
      
      await interaction.deferUpdate();
      
      // Parse amount
      const parsedAmount = parseInt(amount);
      
      // Get user data to verify funds
      const user = await client.db.getUser(userId);
      
      // Check if user still has enough credits
      if (user.balance < parsedAmount) {
        return interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Fonds insuffisants',
              `Vous n'avez pas assez de crédits pour ce pari.\nVotre solde: **${user.balance}** crédits`
            )
          ],
          components: []
        });
      }
      
      // Determine the result
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const isWin = choice === result;
      
      // Prepare result embed info
      let title, description, color, thumbnail;
      
      if (isWin) {
        title = '💰 Vous avez gagné!';
        description = `La pièce tombe sur ${result === 'heads' ? '**Pile**' : '**Face**'}!\nVous avez gagné **${parsedAmount}** crédits!`;
        color = 'SUCCESS';
        thumbnail = 'https://i.imgur.com/W2KGl0P.png'; // Win coin image
      } else {
        title = '💸 Vous avez perdu!';
        description = `La pièce tombe sur ${result === 'heads' ? '**Pile**' : '**Face**'}!\nVous avez perdu **${parsedAmount}** crédits.`;
        color = 'ERROR';
        thumbnail = 'https://i.imgur.com/vz37cjM.png'; // Lose coin image
      }
      
      // Process the bet result
      await client.db.db.run('BEGIN TRANSACTION');
      
      try {
        // Update user balance
        const balanceChange = isWin ? parsedAmount : -parsedAmount;
        await client.db.updateUserBalance(userId, balanceChange);
        
        // Add small XP regardless of win/loss
        const xpGained = Math.floor(Math.random() * 3) + 1;
        const xpResult = await client.db.addExperience(userId, xpGained);
        
        await client.db.db.run('COMMIT');
        
        // Create result embed
        const embed = EmbedCreator.create({
          title,
          description,
          color,
          thumbnail,
          fields: [
            {
              name: 'Votre choix',
              value: choice === 'heads' ? 'Pile' : 'Face',
              inline: true
            },
            {
              name: 'Résultat',
              value: result === 'heads' ? 'Pile' : 'Face',
              inline: true
            },
            {
              name: 'Nouveau solde',
              value: `**${user.balance + balanceChange}** crédits`,
              inline: true
            }
          ]
        });
        
        // Add level up notification if user leveled up
        if (xpResult.leveledUp) {
          embed.addFields({
            name: '🎉 Niveau supérieur!',
            value: `Vous êtes passé au niveau **${xpResult.newLevel}**!`,
            inline: false
          });
        }
        
        await interaction.editReply({
          embeds: [embed],
          components: []
        });
      } catch (error) {
        await client.db.db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error handling coinflip button:', error);
      
      try {
        await interaction.editReply({
          embeds: [
            EmbedCreator.error(
              'Erreur',
              'Une erreur est survenue lors du traitement de votre pari.'
            )
          ],
          components: []
        });
      } catch (followUpError) {
        console.error('Error sending error message:', followUpError);
      }
    }
  }
};