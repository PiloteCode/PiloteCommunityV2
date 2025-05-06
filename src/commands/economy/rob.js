import { SlashCommandBuilder } = require('discord.js');
import { EmbedCreator } = require('../../utils/embedCreator.js');

export default {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Tentez de voler des crédits à un autre utilisateur')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription('L\'utilisateur que vous souhaitez voler')
        .setRequired(true)),
  
  cooldown: 3600, // 1 heure
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply();
      
      const targetUser = interaction.options.getUser('utilisateur');
      
      // Vérifie si l'utilisateur essaie de se voler lui-même
      if (targetUser.id === interaction.user.id) {
        const errorEmbed = EmbedCreator.error(
          'Erreur',
          'Vous ne pouvez pas vous voler vous-même!'
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      
      // Vérifie si la cible est un bot
      if (targetUser.bot) {
        const errorEmbed = EmbedCreator.error(
          'Erreur',
          'Vous ne pouvez pas voler un bot!'
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      
      // Récupère les données des deux utilisateurs
      const thief = await client.db.getUser(interaction.user.id);
      const victim = await client.db.getUser(targetUser.id);
      
      // Vérifie si la victime a assez d'argent pour être volée
      const minimumAmount = 100;
      
      if (victim.balance < minimumAmount) {
        const errorEmbed = EmbedCreator.warning(
          'Vol impossible',
          `${targetUser.username} n'a pas assez de crédits pour être volé(e)! (minimum: ${minimumAmount} crédits)`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      
      // Vérifie si le voleur a assez d'argent pour tenter le vol (pénalité en cas d'échec)
      const penaltyAmount = 150;
      
      if (thief.balance < penaltyAmount) {
        const errorEmbed = EmbedCreator.warning(
          'Vol impossible',
          `Vous avez besoin d'au moins ${penaltyAmount} crédits pour tenter un vol (en cas d'échec, vous perdrez cette somme).`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      
      // Calcul de la probabilité de réussite (entre 30% et 50%)
      const successRate = 40; // 40% de chance de réussir
      const isSuccessful = Math.random() * 100 < successRate;
      
      if (isSuccessful) {
        // Calcul du montant volé (entre 10% et 30% du solde de la victime)
        const stolenPercentage = Math.random() * 20 + 10; // 10% à 30%
        const stolenAmount = Math.floor(victim.balance * (stolenPercentage / 100));
        
        // Mise à jour des balances
        await client.db.updateUserBalance(interaction.user.id, stolenAmount);
        await client.db.updateUserBalance(targetUser.id, -stolenAmount);
        
        // Notification du vol réussi
        const successEmbed = EmbedCreator.success(
          '🔫 Vol réussi!',
          `Vous avez volé **${stolenAmount} crédits** à ${targetUser.username}!`,
          {
            fields: [
              {
                name: '💰 Votre nouveau solde',
                value: `${thief.balance + stolenAmount} crédits`,
                inline: true
              },
              {
                name: '💸 Pourcentage volé',
                value: `${stolenPercentage.toFixed(1)}%`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [successEmbed] });
      } else {
        // Vol échoué, le voleur perd de l'argent
        await client.db.updateUserBalance(interaction.user.id, -penaltyAmount);
        
        // Génération d'un message d'échec aléatoire
        const failMessages = [
          "Vous avez trébuché pendant votre fuite!",
          "Votre victime vous a vu et a appelé la police!",
          "Quelqu'un vous a filmé pendant le vol!",
          "Une caméra de surveillance vous a repéré!",
          "Vous avez fait trop de bruit et tout le monde vous a remarqué!"
        ];
        
        const randomMessage = failMessages[Math.floor(Math.random() * failMessages.length)];
        
        const failEmbed = EmbedCreator.error(
          '👮 Vol échoué!',
          `${randomMessage} Vous avez été pris et avez dû payer une amende de **${penaltyAmount} crédits**.`,
          {
            fields: [
              {
                name: '💰 Votre nouveau solde',
                value: `${thief.balance - penaltyAmount} crédits`,
                inline: true
              }
            ]
          }
        );
        
        return interaction.editReply({ embeds: [failEmbed] });
      }
      
    } catch (error) {
      console.error('Error in rob command:', error);
      
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