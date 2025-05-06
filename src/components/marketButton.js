import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BusinessManager } from '../utils/businessManager.js';
import { EmbedCreator } from '../utils/embedCreator.js';

export const marketButtonHandler = async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
  
  const { client, user, guild } = interaction;
  const businessManager = new BusinessManager(client);
  const marketSystem = client.marketSystem;
  const customId = interaction.customId;
  
  // Extract action and parameters from customId
  const [component, action, ...params] = customId.split('_');
  
  if (component !== 'market') return;
  
  try {
    // Verify permissions based on action
    if (['buy', 'sell', 'cancel', 'agreement'].includes(action)) {
      const businessId = params[0];
      const hasPermission = await businessManager.checkBusinessPermission(user.id, businessId, 'MANAGE_TRADING');
      
      if (!businessId || !hasPermission) {
        return interaction.reply({ 
          content: "Vous n'avez pas la permission de gérer les transactions pour cette entreprise.", 
          ephemeral: true 
        });
      }
    }
    
    // Handle different actions
    switch (action) {
      case 'page':
        await handlePageNavigation(interaction, params, marketSystem);
        break;
      case 'filter':
        await handleFilterSelection(interaction, params, marketSystem);
        break;
      case 'buy':
        await handleBuyButton(interaction, params, marketSystem, businessManager);
        break;
      case 'buyConfirm':
        await handleBuyConfirmation(interaction, params, marketSystem, businessManager);
        break;
      case 'cancel':
        await handleCancelListing(interaction, params, marketSystem, businessManager);
        break;
      case 'createListing':
        await handleCreateListingModal(interaction, params, businessManager);
        break;
      case 'submitListing':
        await handleSubmitListing(interaction, params, marketSystem, businessManager);
        break;
      case 'agreementCreate':
        await handleCreateAgreementModal(interaction, params, businessManager);
        break;
      case 'agreementSubmit':
        await handleSubmitAgreement(interaction, params, marketSystem, businessManager);
        break;
      case 'agreementManage':
        await handleManageAgreement(interaction, params, marketSystem, businessManager);
        break;
      default:
        await interaction.reply({ 
          content: "Action non reconnue.", 
          ephemeral: true 
        });
    }
  } catch (error) {
    console.error(`Erreur dans marketButtonHandler: ${error}`);
    await interaction.reply({ 
      content: "Une erreur est survenue lors du traitement de cette action.", 
      ephemeral: true 
    });
  }
};

// Handle market listings page navigation
async function handlePageNavigation(interaction, params, marketSystem) {
  const page = parseInt(params[0] || 1);
  const filters = JSON.parse(params[1] || '{}');
  
  const { embed, components } = await marketSystem.generateMarketListingsEmbed(page, filters);
  
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components });
  } else {
    await interaction.update({ embeds: [embed], components });
  }
}

// Handle market filter selection
async function handleFilterSelection(interaction, params, marketSystem) {
  if (!interaction.isStringSelectMenu()) return;
  
  const filterType = params[0];
  const currentPage = parseInt(params[1] || 1);
  let currentFilters = {};
  
  try {
    currentFilters = params[2] ? JSON.parse(params[2]) : {};
  } catch (e) {
    currentFilters = {};
  }
  
  // Update filters based on selection
  if (filterType === 'category') {
    currentFilters.category = interaction.values[0] === 'all' ? null : interaction.values[0];
  } else if (filterType === 'sort') {
    currentFilters.sort = interaction.values[0];
  }
  
  const filtersString = JSON.stringify(currentFilters);
  
  const { embed, components } = await marketSystem.generateMarketListingsEmbed(
    currentPage, 
    currentFilters
  );
  
  await interaction.update({ embeds: [embed], components });
}

// Handle the buy button click
async function handleBuyButton(interaction, params, marketSystem, businessManager) {
  const listingId = params[1];
  const businessId = params[0];
  
  const listing = await marketSystem.getListingById(listingId);
  if (!listing) {
    return interaction.reply({
      content: "Cette annonce n'existe plus ou a été vendue.",
      ephemeral: true
    });
  }
  
  const business = await businessManager.getBusiness(businessId);
  if (!business) {
    return interaction.reply({
      content: "L'entreprise sélectionnée n'existe pas.",
      ephemeral: true
    });
  }
  
  // Check if business has enough funds
  if (business.balance < listing.price) {
    return interaction.reply({
      content: `Votre entreprise n'a pas assez de fonds. Prix: ${listing.price}€, Solde: ${business.balance}€`,
      ephemeral: true
    });
  }
  
  const embed = new EmbedBuilder()
    .setTitle("Confirmation d'achat")
    .setDescription(`Êtes-vous sûr de vouloir acheter ${listing.quantity} ${listing.productName} pour ${listing.price}€?`)
    .setColor('#FFA500')
    .addFields(
      { name: 'Vendeur', value: `${listing.sellerName}`, inline: true },
      { name: 'Prix unitaire', value: `${(listing.price / listing.quantity).toFixed(2)}€`, inline: true },
      { name: 'Quantité', value: `${listing.quantity}`, inline: true }
    );
  
  const confirmRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`market_buyConfirm_${businessId}_${listingId}`)
        .setLabel('Confirmer l\'achat')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`market_page_1_{}`)
        .setLabel('Annuler')
        .setStyle(ButtonStyle.Danger)
    );
  
  await interaction.reply({
    embeds: [embed],
    components: [confirmRow],
    ephemeral: true
  });
}

// Handle the buy confirmation
async function handleBuyConfirmation(interaction, params, marketSystem, businessManager) {
  const businessId = params[0];
  const listingId = params[1];
  
  try {
    const result = await marketSystem.purchaseListing(listingId, businessId);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setTitle("Achat réussi")
        .setDescription(`Vous avez acheté ${result.quantity} ${result.productName} pour ${result.price}€`)
        .setColor('#00FF00')
        .addFields(
          { name: 'Vendeur', value: result.sellerName, inline: true },
          { name: 'Transaction ID', value: result.transactionId, inline: true }
        );
      
      await interaction.update({
        embeds: [embed],
        components: [],
        ephemeral: true
      });
    } else {
      await interaction.update({
        content: result.message || "L'achat a échoué. L'annonce peut avoir été vendue ou retirée.",
        embeds: [],
        components: [],
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(`Erreur lors de l'achat: ${error}`);
    await interaction.update({
      content: "Une erreur est survenue lors de l'achat.",
      embeds: [],
      components: [],
      ephemeral: true
    });
  }
}

// Handle cancelling a listing
async function handleCancelListing(interaction, params, marketSystem, businessManager) {
  const businessId = params[0];
  const listingId = params[1];
  
  try {
    const result = await marketSystem.cancelListing(listingId, businessId);
    
    if (result.success) {
      await interaction.reply({
        content: `L'annonce pour ${result.productName} a été annulée avec succès.`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: result.message || "Impossible d'annuler cette annonce.",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(`Erreur lors de l'annulation: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors de l'annulation de l'annonce.",
      ephemeral: true
    });
  }
}

// Handle creating a new listing modal
async function handleCreateListingModal(interaction, params, businessManager) {
  const businessId = params[0];
  
  // Get business info for product inventory
  const business = await businessManager.getBusiness(businessId);
  if (!business) {
    return interaction.reply({
      content: "L'entreprise sélectionnée n'existe pas.",
      ephemeral: true
    });
  }
  
  // Create the modal
  const modal = new ModalBuilder()
    .setCustomId(`market_submitListing_${businessId}`)
    .setTitle('Créer une annonce');
  
  // Add product name input
  const productNameInput = new TextInputBuilder()
    .setCustomId('productName')
    .setLabel('Nom du produit')
    .setPlaceholder('Entrez le nom du produit que vous vendez')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add product description
  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setPlaceholder('Décrivez votre produit (optionnel)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);
  
  // Add quantity input
  const quantityInput = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel('Quantité')
    .setPlaceholder('Combien d\'unités souhaitez-vous vendre?')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add price input
  const priceInput = new TextInputBuilder()
    .setCustomId('price')
    .setLabel('Prix (total)')
    .setPlaceholder('Prix total de l\'annonce en euros')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add category input
  const categoryInput = new TextInputBuilder()
    .setCustomId('category')
    .setLabel('Catégorie')
    .setPlaceholder('matières premières, composants, produits finis, services')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  const row1 = new ActionRowBuilder().addComponents(productNameInput);
  const row2 = new ActionRowBuilder().addComponents(descriptionInput);
  const row3 = new ActionRowBuilder().addComponents(quantityInput);
  const row4 = new ActionRowBuilder().addComponents(priceInput);
  const row5 = new ActionRowBuilder().addComponents(categoryInput);
  
  modal.addComponents(row1, row2, row3, row4, row5);
  
  await interaction.showModal(modal);
}

// Handle listing submission
async function handleSubmitListing(interaction, params, marketSystem, businessManager) {
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
    const result = await marketSystem.createListing({
      sellerId: businessId,
      sellerName: (await businessManager.getBusiness(businessId)).name,
      productName,
      description,
      quantity,
      price,
      category: validCategories.find(c => category.includes(c)) || 'autres'
    });
    
    if (result.success) {
      await interaction.reply({
        content: `Annonce créée avec succès! ID: ${result.listingId}`,
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

// Handle creating a trade agreement modal
async function handleCreateAgreementModal(interaction, params, businessManager) {
  const businessId = params[0];
  const partnerId = params[1];
  
  // Validate both businesses
  const business = await businessManager.getBusiness(businessId);
  if (!business) {
    return interaction.reply({
      content: "Votre entreprise n'existe pas.",
      ephemeral: true
    });
  }
  
  const partner = await businessManager.getBusiness(partnerId);
  if (!partner) {
    return interaction.reply({
      content: "L'entreprise partenaire n'existe pas.",
      ephemeral: true
    });
  }
  
  // Create the modal
  const modal = new ModalBuilder()
    .setCustomId(`market_agreementSubmit_${businessId}_${partnerId}`)
    .setTitle('Créer un accord commercial');
  
  // Add product name input
  const productNameInput = new TextInputBuilder()
    .setCustomId('productName')
    .setLabel('Produit')
    .setPlaceholder('Nom du produit à échanger régulièrement')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add quantity input
  const quantityInput = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel('Quantité par livraison')
    .setPlaceholder('Quantité à livrer à chaque cycle')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add price input
  const priceInput = new TextInputBuilder()
    .setCustomId('price')
    .setLabel('Prix par livraison')
    .setPlaceholder('Prix pour chaque livraison en euros')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add frequency input
  const frequencyInput = new TextInputBuilder()
    .setCustomId('frequency')
    .setLabel('Fréquence (en heures)')
    .setPlaceholder('Intervalle entre les livraisons (min: 24h)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  // Add duration input
  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Durée (en jours)')
    .setPlaceholder('Durée totale du contrat (max: 30 jours)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  
  const row1 = new ActionRowBuilder().addComponents(productNameInput);
  const row2 = new ActionRowBuilder().addComponents(quantityInput);
  const row3 = new ActionRowBuilder().addComponents(priceInput);
  const row4 = new ActionRowBuilder().addComponents(frequencyInput);
  const row5 = new ActionRowBuilder().addComponents(durationInput);
  
  modal.addComponents(row1, row2, row3, row4, row5);
  
  await interaction.showModal(modal);
}

// Handle trade agreement submission
async function handleSubmitAgreement(interaction, params, marketSystem, businessManager) {
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
    const result = await marketSystem.createTradeAgreement({
      sellerId: businessId,
      buyerId: partnerId,
      sellerName: (await businessManager.getBusiness(businessId)).name,
      buyerName: (await businessManager.getBusiness(partnerId)).name,
      productName,
      quantity,
      price,
      frequency: frequency * 60 * 60 * 1000, // Convert hours to milliseconds
      duration: duration * 24 * 60 * 60 * 1000, // Convert days to milliseconds
      status: 'pending' // Needs buyer approval
    });
    
    if (result.success) {
      // Send notification to partner business owners
      const partnerBusiness = await businessManager.getBusiness(partnerId);
      const ownerIds = await businessManager.getBusinessOwners(partnerId);
      
      for (const ownerId of ownerIds) {
        try {
          const owner = await client.users.fetch(ownerId);
          const notificationEmbed = new EmbedBuilder()
            .setTitle("Nouvelle proposition d'accord commercial")
            .setDescription(`${business.name} vous propose un accord commercial`)
            .setColor('#0099ff')
            .addFields(
              { name: 'Produit', value: productName, inline: true },
              { name: 'Quantité', value: quantity.toString(), inline: true },
              { name: 'Prix par livraison', value: `${price}€`, inline: true },
              { name: 'Fréquence', value: `${frequency} heures`, inline: true },
              { name: 'Durée', value: `${duration} jours`, inline: true }
            );
          
          await owner.send({ embeds: [notificationEmbed] }).catch(() => {
            // User might have DMs disabled, we'll skip them
          });
        } catch (error) {
          console.error(`Impossible d'envoyer la notification à ${ownerId}: ${error}`);
        }
      }
      
      await interaction.reply({
        content: `Proposition d'accord commercial envoyée à ${partnerBusiness.name}!`,
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

// Handle trade agreement management
async function handleManageAgreement(interaction, params, marketSystem, businessManager) {
  const businessId = params[0];
  const agreementId = params[1];
  const action = params[2]; // 'accept', 'reject', 'cancel'
  
  try {
    let result;
    
    switch (action) {
      case 'accept':
        result = await marketSystem.acceptTradeAgreement(agreementId, businessId);
        break;
      case 'reject':
        result = await marketSystem.rejectTradeAgreement(agreementId, businessId);
        break;
      case 'cancel':
        result = await marketSystem.cancelTradeAgreement(agreementId, businessId);
        break;
      default:
        return interaction.reply({
          content: "Action non reconnue.",
          ephemeral: true
        });
    }
    
    if (result.success) {
      await interaction.reply({
        content: result.message || `L'accord commercial a été ${action === 'accept' ? 'accepté' : action === 'reject' ? 'rejeté' : 'annulé'} avec succès.`,
        ephemeral: true
      });
      
      // Notify the other party
      if (action !== 'cancel') {
        const notifyId = action === 'accept' || action === 'reject' ? result.sellerId : result.buyerId;
        const ownerIds = await businessManager.getBusinessOwners(notifyId);
        
        for (const ownerId of ownerIds) {
          try {
            const owner = await client.users.fetch(ownerId);
            await owner.send({
              content: `Un accord commercial pour "${result.productName}" a été ${action === 'accept' ? 'accepté' : 'rejeté'} par ${result.buyerName}.`
            }).catch(() => {
              // User might have DMs disabled, we'll skip them
            });
          } catch (error) {
            console.error(`Impossible d'envoyer la notification à ${ownerId}: ${error}`);
          }
        }
      }
    } else {
      await interaction.reply({
        content: result.message || "Une erreur est survenue.",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(`Erreur lors de la gestion de l'accord commercial: ${error}`);
    await interaction.reply({
      content: "Une erreur est survenue lors de la gestion de l'accord commercial.",
      ephemeral: true
    });
  }
}