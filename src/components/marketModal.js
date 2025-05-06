import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BusinessManager } from '../utils/businessManager.js';

export const marketModalHandler = async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  const { client, customId } = interaction;
  const [component, action, ...params] = customId.split('_');
  
  if (component !== 'market') return;
  
  const businessManager = new BusinessManager(client);
  const marketSystem = client.marketSystem;
  
  try {
    switch (action) {
      case 'submitListing':
        await handleListingSubmission(interaction, params, marketSystem, businessManager);
        break;
      case 'agreementSubmit':
        await handleAgreementSubmission(interaction, params, marketSystem, businessManager);
        break;
      case 'offerSubmit':
        await handleOfferSubmission(interaction, params, marketSystem, businessManager);
        break;
      default:
        await interaction.reply({
          content: "Action non reconnue.",
          ephemeral: true
        });
    }
  } catch (error) {
    console.error(`Erreur dans marketModalHandler: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors du traitement de ce formulaire.",
      ephemeral: true
    });
  }
};

// Handle listing submission from modal
async function handleListingSubmission(interaction, params, marketSystem, businessManager) {
  const businessId = params[0];
  
  // Extract values from modal
  const productName = interaction.fields.getTextInputValue('productName');
  const description = interaction.fields.getTextInputValue('description') || '';
  const quantityStr = interaction.fields.getTextInputValue('quantity');
  const priceStr = interaction.fields.getTextInputValue('price');
  const category = interaction.fields.getTextInputValue('category').toLowerCase();
  
  // Validate inputs
  const quantity = parseInt(quantityStr);
  const price = parseFloat(priceStr);
  
  if (isNaN(quantity) || quantity <= 0) {
    return interaction.reply({
      content: 'La quantité doit être un nombre entier positif.',
      ephemeral: true
    });
  }
  
  if (isNaN(price) || price <= 0) {
    return interaction.reply({
      content: 'Le prix doit être un nombre positif.',
      ephemeral: true
    });
  }
  
  const validCategories = ['matières premières', 'composants', 'produits finis', 'services'];
  if (!validCategories.includes(category) && !validCategories.some(c => category.includes(c))) {
    return interaction.reply({
      content: `Catégorie invalide. Choisissez parmi: ${validCategories.join(', ')}`,
      ephemeral: true
    });
  }
  
  try {
    const business = await businessManager.getBusiness(businessId);
    const result = await marketSystem.createListing({
      sellerId: businessId,
      sellerName: business.name,
      productName,
      description,
      quantity,
      price,
      category: validCategories.find(c => category.includes(c)) || 'autres'
    });
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setTitle("Annonce créée")
        .setDescription(`Votre annonce pour ${quantity} ${productName} a été publiée avec succès.`)
        .setColor('#00FF00')
        .addFields(
          { name: 'Prix', value: `${price}€`, inline: true },
          { name: 'Prix unitaire', value: `${(price / quantity).toFixed(2)}€`, inline: true },
          { name: 'Catégorie', value: category, inline: true },
          { name: 'ID d\'annonce', value: result.listingId, inline: true }
        );
      
      if (description) {
        embed.addFields({ name: 'Description', value: description });
      }
      
      const viewListingsButton = new ButtonBuilder()
        .setCustomId(`market_page_1_{}`)
        .setLabel('Voir toutes les annonces')
        .setStyle(ButtonStyle.Primary);
      
      const actionRow = new ActionRowBuilder().addComponents(viewListingsButton);
      
      await interaction.reply({
        embeds: [embed],
        components: [actionRow],
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: result.message || "Échec de la création de l'annonce.",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(`Erreur lors de la création de l'annonce: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors de la création de l'annonce.",
      ephemeral: true
    });
  }
}

// Handle trade agreement submission from modal
async function handleAgreementSubmission(interaction, params, marketSystem, businessManager) {
  const businessId = params[0];
  const partnerId = params[1];
  
  // Extract values from modal
  const productName = interaction.fields.getTextInputValue('productName');
  const quantityStr = interaction.fields.getTextInputValue('quantity');
  const priceStr = interaction.fields.getTextInputValue('price');
  const frequencyStr = interaction.fields.getTextInputValue('frequency');
  const durationStr = interaction.fields.getTextInputValue('duration');
  
  // Validate inputs
  const quantity = parseInt(quantityStr);
  const price = parseFloat(priceStr);
  const frequency = parseInt(frequencyStr);
  const duration = parseInt(durationStr);
  
  if (isNaN(quantity) || quantity <= 0) {
    return interaction.reply({
      content: 'La quantité doit être un nombre entier positif.',
      ephemeral: true
    });
  }
  
  if (isNaN(price) || price <= 0) {
    return interaction.reply({
      content: 'Le prix doit être un nombre positif.',
      ephemeral: true
    });
  }
  
  if (isNaN(frequency) || frequency < 24) {
    return interaction.reply({
      content: 'La fréquence doit être d\'au moins 24 heures.',
      ephemeral: true
    });
  }
  
  if (isNaN(duration) || duration <= 0 || duration > 30) {
    return interaction.reply({
      content: 'La durée doit être entre 1 et 30 jours.',
      ephemeral: true
    });
  }
  
  try {
    const business = await businessManager.getBusiness(businessId);
    const partner = await businessManager.getBusiness(partnerId);
    
    const result = await marketSystem.createTradeAgreement({
      sellerId: businessId,
      buyerId: partnerId,
      sellerName: business.name,
      buyerName: partner.name,
      productName,
      quantity,
      price,
      frequency: frequency * 60 * 60 * 1000, // Convert hours to milliseconds
      duration: duration * 24 * 60 * 60 * 1000, // Convert days to milliseconds
      status: 'pending' // Needs buyer approval
    });
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setTitle("Proposition d'accord commercial envoyée")
        .setDescription(`Vous avez proposé un accord commercial à ${partner.name}.`)
        .setColor('#0099ff')
        .addFields(
          { name: 'Produit', value: productName, inline: true },
          { name: 'Quantité par livraison', value: quantity.toString(), inline: true },
          { name: 'Prix par livraison', value: `${price}€`, inline: true },
          { name: 'Fréquence', value: `${frequency} heures`, inline: true },
          { name: 'Durée', value: `${duration} jours`, inline: true },
          { name: 'Statut', value: 'En attente d\'approbation', inline: true }
        );
      
      // Send notification to partner business owners
      const ownerIds = await businessManager.getBusinessOwners(partnerId);
      let notifiedCount = 0;
      
      for (const ownerId of ownerIds) {
        try {
          const owner = await interaction.client.users.fetch(ownerId);
          const notificationEmbed = new EmbedBuilder()
            .setTitle("Nouvelle proposition d'accord commercial")
            .setDescription(`${business.name} vous propose un accord commercial.`)
            .setColor('#0099ff')
            .addFields(
              { name: 'Produit', value: productName, inline: true },
              { name: 'Quantité par livraison', value: quantity.toString(), inline: true },
              { name: 'Prix par livraison', value: `${price}€`, inline: true },
              { name: 'Fréquence', value: `${frequency} heures`, inline: true },
              { name: 'Durée', value: `${duration} jours`, inline: true }
            );
          
          const actionRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`market_agreementManage_${partnerId}_${result.agreementId}_accept`)
                .setLabel('Accepter')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`market_agreementManage_${partnerId}_${result.agreementId}_reject`)
                .setLabel('Refuser')
                .setStyle(ButtonStyle.Danger)
            );
          
          await owner.send({ 
            embeds: [notificationEmbed],
            components: [actionRow]
          }).then(() => {
            notifiedCount++;
          }).catch(() => {
            // User might have DMs disabled, we'll skip them
          });
        } catch (error) {
          console.error(`Impossible d'envoyer la notification à ${ownerId}: ${error}`);
        }
      }
      
      if (notifiedCount > 0) {
        embed.addFields({ 
          name: 'Notification', 
          value: `${notifiedCount} propriétaire(s) de ${partner.name} ont été notifiés.` 
        });
      } else {
        embed.addFields({ 
          name: 'Notification', 
          value: 'Aucun propriétaire n\'a pu être notifié. Ils devront vérifier leurs accords en attente manuellement.' 
        });
      }
      
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: result.message || "Échec de la création de l'accord commercial.",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(`Erreur lors de la création de l'accord commercial: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors de la création de l'accord commercial.",
      ephemeral: true
    });
  }
}

// Handle counter-offer submission from modal
async function handleOfferSubmission(interaction, params, marketSystem, businessManager) {
  const businessId = params[0];
  const agreementId = params[1];
  
  // Extract values from modal
  const priceStr = interaction.fields.getTextInputValue('price');
  const quantityStr = interaction.fields.getTextInputValue('quantity');
  const messageText = interaction.fields.getTextInputValue('message') || '';
  
  // Validate inputs
  const price = parseFloat(priceStr);
  const quantity = parseInt(quantityStr);
  
  if (isNaN(price) || price < 0) {
    return interaction.reply({
      content: 'Le prix doit être un nombre positif.',
      ephemeral: true
    });
  }
  
  if (isNaN(quantity) || quantity <= 0) {
    return interaction.reply({
      content: 'La quantité doit être un nombre entier positif.',
      ephemeral: true
    });
  }
  
  try {
    const result = await marketSystem.counterOfferTradeAgreement(
      agreementId,
      businessId,
      price,
      quantity,
      messageText
    );
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setTitle("Contre-offre envoyée")
        .setDescription(`Vous avez proposé une contre-offre pour l'accord commercial.`)
        .setColor('#0099ff')
        .addFields(
          { name: 'Nouveau prix', value: `${price}€`, inline: true },
          { name: 'Nouvelle quantité', value: quantity.toString(), inline: true }
        );
      
      if (messageText) {
        embed.addFields({ name: 'Message', value: messageText });
      }
      
      // Notify the other party
      const otherBusinessId = result.sellerId === businessId ? result.buyerId : result.sellerId;
      const otherBusinessName = result.sellerId === businessId ? result.buyerName : result.sellerName;
      const ownerIds = await businessManager.getBusinessOwners(otherBusinessId);
      let notifiedCount = 0;
      
      for (const ownerId of ownerIds) {
        try {
          const owner = await interaction.client.users.fetch(ownerId);
          const business = await businessManager.getBusiness(businessId);
          
          const notificationEmbed = new EmbedBuilder()
            .setTitle("Nouvelle contre-offre pour un accord commercial")
            .setDescription(`${business.name} a fait une contre-offre pour l'accord commercial concernant ${result.productName}.`)
            .setColor('#FFA500')
            .addFields(
              { name: 'Produit', value: result.productName, inline: true },
              { name: 'Nouveau prix', value: `${price}€`, inline: true },
              { name: 'Nouvelle quantité', value: quantity.toString(), inline: true }
            );
          
          if (messageText) {
            notificationEmbed.addFields({ name: 'Message', value: messageText });
          }
          
          const actionRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`market_agreementManage_${otherBusinessId}_${agreementId}_accept`)
                .setLabel('Accepter')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`market_agreementManage_${otherBusinessId}_${agreementId}_reject`)
                .setLabel('Refuser')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`market_agreementOfferModal_${otherBusinessId}_${agreementId}`)
                .setLabel('Faire une contre-offre')
                .setStyle(ButtonStyle.Primary)
            );
          
          await owner.send({ 
            embeds: [notificationEmbed],
            components: [actionRow]
          }).then(() => {
            notifiedCount++;
          }).catch(() => {
            // User might have DMs disabled, we'll skip them
          });
        } catch (error) {
          console.error(`Impossible d'envoyer la notification à ${ownerId}: ${error}`);
        }
      }
      
      if (notifiedCount > 0) {
        embed.addFields({ 
          name: 'Notification', 
          value: `${notifiedCount} propriétaire(s) de ${otherBusinessName} ont été notifiés.` 
        });
      } else {
        embed.addFields({ 
          name: 'Notification', 
          value: 'Aucun propriétaire n\'a pu être notifié. Ils devront vérifier leurs accords en attente manuellement.' 
        });
      }
      
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: result.message || "Échec de l'envoi de la contre-offre.",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(`Erreur lors de l'envoi de la contre-offre: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors de l'envoi de la contre-offre.",
      ephemeral: true
    });
  }
}