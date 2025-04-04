// src/commands/monitoring/premium-list.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import premiumManager from '../../utils/premiumManager.js';
import { getUser } from '../../database/manager.js';
import { EMBED_COLORS } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('premium-list')
  .setDescription('Affiche les fonctionnalités premium disponibles et votre statut');

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Récupérer toutes les fonctionnalités premium
    const features = await premiumManager.getAllFeatures();
    
    if (features.length === 0) {
      return interaction.editReply({
        content: '❌ Aucune fonctionnalité premium n\'est disponible actuellement.',
        ephemeral: true
      });
    }
    
    // Récupérer les fonctionnalités de l'utilisateur
    const userFeatures = await premiumManager.getUserFeatures(interaction.user.id);
    const user = await getUser(interaction.user.id);
    
    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle('💎 Fonctionnalités Premium')
      .setDescription('Améliorez votre expérience de monitoring avec ces fonctionnalités premium.')
      .setColor(EMBED_COLORS.INFO)
      .setTimestamp();
    
    // Ajouter le statut premium global
    const isPremium = user.is_premium === 1;
    const premiumExpiry = user.premium_expiry ? new Date(user.premium_expiry) : null;
    const now = new Date();
    
    embed.addFields({
      name: '🔰 Votre statut premium',
      value: isPremium && premiumExpiry && premiumExpiry > now
        ? `✅ Actif jusqu'au ${premiumExpiry.toLocaleDateString()}`
        : '❌ Inactif',
      inline: false
    });
    
    // Ajouter les fonctionnalités disponibles
    for (const feature of features) {
      // Vérifier si l'utilisateur a cette fonctionnalité
      const userFeature = userFeatures.find(f => f.feature_id === feature.feature_id);
      const hasFeature = !!userFeature;
      const featureExpiry = userFeature?.expires_at ? new Date(userFeature.expires_at) : null;
      
      let status = '❌ Non activé';
      if (hasFeature && featureExpiry && featureExpiry > now) {
        status = `✅ Actif jusqu'au ${featureExpiry.toLocaleDateString()}`;
      } else if (isPremium && premiumExpiry && premiumExpiry > now) {
        status = `✅ Inclus dans votre abonnement premium`;
      }
      
      embed.addFields({
        name: `${feature.name} - ${feature.price}💵`,
        value: `${feature.description}\n**Statut:** ${status}\n**ID:** \`${feature.feature_id}\``,
        inline: true
      });
    }
    
    embed.setFooter({
      text: 'Utilisez /premium-purchase pour acheter des fonctionnalités premium'
    });
    
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'affichage des fonctionnalités premium:', error);
    return interaction.editReply({
      content: `❌ Une erreur est survenue: ${error.message}`,
      ephemeral: true
    });
  }
}

