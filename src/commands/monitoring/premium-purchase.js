
// src/commands/monitoring/premium-purchase.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import premiumManager from '../../utils/premiumManager.js';
import { getUser } from '../../database/manager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('premium-purchase')
  .setDescription('Achète une fonctionnalité premium avec ta monnaie virtuelle')
  .addStringOption(option =>
    option.setName('feature_id')
      .setDescription('ID de la fonctionnalité à acheter')
      .setRequired(true)
      .addChoices(
        { name: 'Monitors supplémentaires', value: 'more_monitors' },
        { name: 'Fréquence accrue', value: 'increased_frequency' },
        { name: 'Statistiques avancées', value: 'advanced_stats' },
        { name: 'Alertes Webhook', value: 'webhook_alerts' },
        { name: 'Page de statut', value: 'status_page' }
      ));

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const featureId = interaction.options.getString('feature_id');
    
    // Récupérer les informations sur la fonctionnalité
    const feature = await premiumManager.getFeature(featureId).catch(() => null);
    
    if (!feature) {
      return interaction.editReply({
        content: '❌ Fonctionnalité introuvable.',
        ephemeral: true
      });
    }
    
    // Récupérer les informations sur l'utilisateur
    const user = await getUser(interaction.user.id);
    
    // Vérifier si l'utilisateur a déjà cette fonctionnalité
    const hasFeature = await premiumManager.hasFeature(interaction.user.id, featureId);
    
    if (hasFeature) {
      const userFeatures = await premiumManager.getUserFeatures(interaction.user.id);
      const userFeature = userFeatures.find(f => f.feature_id === featureId);
      
      if (userFeature && userFeature.expires_at) {
        const expiryDate = new Date(userFeature.expires_at);
        return interaction.editReply({
          content: `⚠️ Vous avez déjà la fonctionnalité "${feature.name}" active jusqu'au ${expiryDate.toLocaleDateString()}. Vous pouvez l'étendre en l'achetant à nouveau.`,
          ephemeral: true
        });
      }
      
      if (user.is_premium === 1 && user.premium_expiry) {
        const expiryDate = new Date(user.premium_expiry);
        return interaction.editReply({
          content: `⚠️ Cette fonctionnalité est déjà incluse dans votre abonnement premium qui expire le ${expiryDate.toLocaleDateString()}.`,
          ephemeral: true
        });
      }
    }
    
    // Vérifier si l'utilisateur a assez d'argent
    if (user.balance < feature.price) {
      return interaction.editReply({
        content: `❌ Vous n'avez pas assez d'argent. Prix: ${feature.price}💵, Votre solde: ${user.balance}💵, Il manque: ${feature.price - user.balance}💵.`,
        ephemeral: true
      });
    }
    
    // Acheter la fonctionnalité
    const result = await premiumManager.purchaseFeature(interaction.user.id, featureId);
    
    // Créer l'embed de confirmation
    const embed = new EmbedBuilder()
      .setTitle('✅ Achat effectué avec succès')
      .setDescription(`Vous avez acheté la fonctionnalité **${feature.name}** pour ${feature.price}💵.`)
      .setColor(EMBED_COLORS.SUCCESS)
      .addFields(
        { name: 'Description', value: feature.description, inline: false },
        { name: 'Durée', value: `${feature.duration} jours`, inline: true },
        { name: 'Expire le', value: new Date(result.expiresAt).toLocaleDateString(), inline: true },
        { name: 'Solde restant', value: `${result.remainingBalance}💵`, inline: true }
      )
      .setTimestamp();
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'achat de la fonctionnalité premium:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}