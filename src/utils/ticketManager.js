// src/utils/ticketManager.js
import { 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    Collection
  } from 'discord.js';
  import dbManager from '../database/manager.js';
  import { EMBED_COLORS } from '../config/constants.js';
  import fs from 'fs';
  import path from 'path';
  
  class TicketManager {
    constructor() {
      this.activeTickets = new Collection();
    }
  
    /**
     * Récupère ou crée la configuration des tickets pour un serveur
     * @param {string} guildId - ID du serveur
     * @returns {Promise<Object>} Configuration des tickets
     */
    async getTicketSettings(guildId) {
      try {
        const settings = await dbManager.executeQuery(
          'SELECT * FROM ticket_settings WHERE guild_id = ?', 
          [guildId]
        );
  
        if (settings.length === 0) {
          // Créer une configuration par défaut
          await dbManager.executeRun(
            'INSERT INTO ticket_settings (guild_id, welcome_message) VALUES (?, ?)',
            [guildId, "Merci d'avoir créé un ticket. Un membre de l'équipe vous répondra dès que possible."]
          );
          return this.getTicketSettings(guildId);
        }
  
        return settings[0];
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des paramètres du ticket:', error);
        throw error;
      }
    }
  
    /**
     * Récupère les catégories de tickets pour un serveur
     * @param {string} guildId - ID du serveur
     * @returns {Promise<Array>} Liste des catégories
     */
    async getTicketCategories(guildId) {
      try {
        const categories = await dbManager.executeQuery(
          'SELECT * FROM ticket_categories WHERE guild_id = ?',
          [guildId]
        );
        return categories;
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des catégories de ticket:', error);
        return [];
      }
    }
  
    /**
     * Crée une nouvelle catégorie de ticket
     * @param {string} guildId - ID du serveur
     * @param {Object} categoryData - Données de la catégorie
     * @returns {Promise<Object>} La catégorie créée
     */
    async createTicketCategory(guildId, categoryData) {
      try {
        const categoryId = `${guildId}-${Date.now()}`;
        await dbManager.executeRun(
          `INSERT INTO ticket_categories 
          (category_id, guild_id, name, description, emoji, button_label, button_style) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            categoryId,
            guildId,
            categoryData.name,
            categoryData.description || "",
            categoryData.emoji || "🎫",
            categoryData.buttonLabel || categoryData.name,
            categoryData.buttonStyle || "PRIMARY"
          ]
        );
  
        return { category_id: categoryId, ...categoryData };
      } catch (error) {
        console.error('❌ Erreur lors de la création de la catégorie de ticket:', error);
        throw error;
      }
    }
  
    /**
     * Met à jour la configuration des tickets
     * @param {string} guildId - ID du serveur
     * @param {Object} settings - Nouveaux paramètres
     * @returns {Promise<Object>} Configuration mise à jour
     */
    async updateTicketSettings(guildId, settings) {
      try {
        const entries = Object.entries(settings);
        if (entries.length === 0) return this.getTicketSettings(guildId);
  
        const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
        const values = entries.map(([_, value]) => value);
  
        await dbManager.executeRun(
          `UPDATE ticket_settings SET ${setClause} WHERE guild_id = ?`,
          [...values, guildId]
        );
  
        return this.getTicketSettings(guildId);
      } catch (error) {
        console.error('❌ Erreur lors de la mise à jour des paramètres de ticket:', error);
        throw error;
      }
    }
  
    /**
     * Génère le panel de création de tickets
     * @param {string} guildId - ID du serveur
     * @returns {Promise<Object>} Embed et composants pour le panel
     */
    async generateTicketPanel(guildId) {
      const settings = await this.getTicketSettings(guildId);
      const categories = await this.getTicketCategories(guildId);
  
      const embed = new EmbedBuilder()
        .setTitle('🎫 Système de tickets')
        .setDescription('Cliquez sur un bouton ci-dessous pour créer un ticket.')
        .setColor(EMBED_COLORS.DEFAULT)
        .setTimestamp();
  
      const rows = [];
      let currentRow = new ActionRowBuilder();
      let buttonCount = 0;
  
      // Si aucune catégorie, créer un bouton par défaut
      if (categories.length === 0) {
        currentRow.addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_create_default')
            .setLabel('Créer un ticket')
            .setStyle(ButtonStyle.PRIMARY)
            .setEmoji('🎫')
        );
        rows.push(currentRow);
      } else {
        // Sinon, créer un bouton par catégorie
        for (const category of categories) {
          if (buttonCount === 5) { // Max 5 boutons par ligne
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
          }
  
          const buttonStyle = this._getButtonStyle(category.button_style);
          
          currentRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_create_${category.category_id}`)
              .setLabel(category.button_label || category.name)
              .setStyle(buttonStyle)
              .setEmoji(category.emoji || '🎫')
          );
          
          buttonCount++;
        }
        
        if (buttonCount > 0) {
          rows.push(currentRow);
        }
      }
  
      return { embed, components: rows };
    }
  
    /**
     * Crée un nouveau ticket
     * @param {Object} interaction - Interaction Discord
     * @param {string} categoryId - ID de la catégorie (optional)
     * @returns {Promise<Object>} Données du ticket créé
     */
    async createTicket(interaction, categoryId = null) {
      try {
        const { guild, user } = interaction;
        const guildId = guild.id;
        const userId = user.id;
  
        // Vérifier si l'utilisateur a déjà des tickets ouverts
        const userTickets = await dbManager.executeQuery(
          'SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = "open"',
          [guildId, userId]
        );
  
        // Obtenir les paramètres du ticket
        const settings = await this.getTicketSettings(guildId);
  
        if (userTickets.length >= settings.max_tickets) {
          throw new Error(`Vous avez déjà atteint la limite maximale de ${settings.max_tickets} tickets ouverts.`);
        }
  
        // Obtenir la catégorie si spécifiée
        let category = null;
        if (categoryId && categoryId !== 'default') {
          const categories = await dbManager.executeQuery(
            'SELECT * FROM ticket_categories WHERE category_id = ?',
            [categoryId]
          );
          if (categories.length > 0) {
            category = categories[0];
          }
        }
  
        // Créer la chaîne pour le ticket
        const ticketNumber = await this._getNextTicketNumber(guildId);
        const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketNumber}`;
        
        // Trouver la catégorie Discord pour les tickets
        let discordCategory;
        if (settings.ticket_category) {
          discordCategory = guild.channels.cache.get(settings.ticket_category);
        }
  
        // Déterminer les permissions du canal
        const channelPermissions = [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: userId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ];
  
        // Ajouter les permissions pour l'équipe de support si configurée
        if (settings.support_team_role) {
          channelPermissions.push({
            id: settings.support_team_role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
        }
  
        // Créer le canal du ticket
        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: discordCategory || null,
          permissionOverwrites: channelPermissions,
          topic: `Ticket de ${user.tag} | Catégorie: ${category ? category.name : 'Support'}`
        });
  
        // Créer le ticket dans la base de données
        const ticketId = `${guildId}-${ticketChannel.id}`;
        await dbManager.executeRun(
          `INSERT INTO tickets 
          (ticket_id, guild_id, channel_id, user_id, category_id, status) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            ticketId,
            guildId,
            ticketChannel.id,
            userId,
            category ? category.category_id : null,
            'open'
          ]
        );
  
        // Créer le message de bienvenue
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`Ticket #${ticketNumber}`)
          .setDescription(settings.welcome_message || "Merci d'avoir créé un ticket. Un membre de l'équipe vous répondra dès que possible.")
          .setColor(EMBED_COLORS.DEFAULT)
          .addFields(
            { name: 'Créé par', value: `<@${userId}>`, inline: true },
            { name: 'Catégorie', value: category ? category.name : 'Support', inline: true },
            { name: 'Date de création', value: new Date().toLocaleString(), inline: true }
          )
          .setFooter({ text: `ID: ${ticketId}` });
  
        // Créer les boutons de gestion du ticket
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_close_${ticketId}`)
            .setLabel('Fermer le ticket')
            .setStyle(ButtonStyle.DANGER)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId(`ticket_claim_${ticketId}`)
            .setLabel('Prendre en charge')
            .setStyle(ButtonStyle.SUCCESS)
            .setEmoji('✋')
        );
  
        // Envoyer le message de bienvenue
        await ticketChannel.send({
          content: `<@${userId}> | ${settings.support_team_role ? `<@&${settings.support_team_role}>` : ''}`,
          embeds: [welcomeEmbed],
          components: [row]
        });
  
        return {
          ticketId,
          channelId: ticketChannel.id,
          ticketNumber
        };
      } catch (error) {
        console.error('❌ Erreur lors de la création du ticket:', error);
        throw error;
      }
    }
  
    /**
     * Ferme un ticket
     * @param {Object} interaction - Interaction Discord
     * @param {string} ticketId - ID du ticket
     * @returns {Promise<boolean>} Succès de la fermeture
     */
    async closeTicket(interaction, ticketId) {
      try {
        const { guild, user } = interaction;
        
        // Récupérer les informations du ticket
        const ticketData = await dbManager.executeQuery(
          'SELECT * FROM tickets WHERE ticket_id = ?',
          [ticketId]
        );
  
        if (ticketData.length === 0) {
          throw new Error('Ticket introuvable.');
        }
  
        const ticket = ticketData[0];
        if (ticket.status === 'closed') {
          throw new Error('Ce ticket est déjà fermé.');
        }
  
        // Récupérer les paramètres du ticket
        const settings = await this.getTicketSettings(guild.id);
  
        // Marquer le ticket comme fermé dans la base de données
        await dbManager.executeRun(
          'UPDATE tickets SET status = ?, closed_at = ?, closed_by = ? WHERE ticket_id = ?',
          ['closed', new Date().toISOString(), user.id, ticketId]
        );
  
        // Créer un transcript du ticket si le canal existe encore
        const channel = guild.channels.cache.get(ticket.channel_id);
        let transcript = null;
        
        if (channel) {
          transcript = await this._createTranscript(channel, ticket);
          
          // Envoyer le transcript dans le canal de logs si configuré
          if (settings.logs_channel) {
            const logsChannel = guild.channels.cache.get(settings.logs_channel);
            if (logsChannel) {
              const createdBy = await guild.members.fetch(ticket.user_id).catch(() => null);
              const closedBy = await guild.members.fetch(user.id).catch(() => null);
              
              const logEmbed = new EmbedBuilder()
                .setTitle(`Ticket #${ticket.ticket_id.split('-')[2]} fermé`)
                .setColor(EMBED_COLORS.ERROR)
                .addFields(
                  { name: 'Ticket', value: `#${channel.name}`, inline: true },
                  { name: 'Créé par', value: createdBy ? createdBy.toString() : ticket.user_id, inline: true },
                  { name: 'Fermé par', value: closedBy ? closedBy.toString() : user.id, inline: true },
                  { name: 'Créé le', value: new Date(ticket.created_at).toLocaleString(), inline: true },
                  { name: 'Fermé le', value: new Date().toLocaleString(), inline: true }
                );
              
              if (transcript) {
                await logsChannel.send({
                  embeds: [logEmbed],
                  files: [transcript]
                });
              } else {
                await logsChannel.send({ embeds: [logEmbed] });
              }
            }
          }
          
          // Informer l'utilisateur que le ticket sera supprimé
          const closeEmbed = new EmbedBuilder()
            .setTitle('Ticket Fermé')
            .setDescription('Ce ticket a été fermé et sera supprimé dans 10 secondes.')
            .setColor(EMBED_COLORS.ERROR)
            .setTimestamp();
          
          await channel.send({ embeds: [closeEmbed] });
          
          // Supprimer le canal après un délai
          setTimeout(async () => {
            try {
              await channel.delete();
            } catch (error) {
              console.error('Erreur lors de la suppression du canal de ticket:', error);
            }
          }, 10000);
        }
  
        return true;
      } catch (error) {
        console.error('❌ Erreur lors de la fermeture du ticket:', error);
        throw error;
      }
    }
  
    /**
     * Ajoute un utilisateur à un ticket
     * @param {Object} interaction - Interaction Discord
     * @param {string} ticketId - ID du ticket
     * @param {string} userId - ID de l'utilisateur à ajouter
     * @returns {Promise<boolean>} Succès de l'opération
     */
    async addUserToTicket(interaction, ticketId, userId) {
      try {
        const { guild } = interaction;
        
        // Récupérer les informations du ticket
        const ticketData = await dbManager.executeQuery(
          'SELECT * FROM tickets WHERE ticket_id = ?',
          [ticketId]
        );
  
        if (ticketData.length === 0) {
          throw new Error('Ticket introuvable.');
        }
  
        const ticket = ticketData[0];
        if (ticket.status === 'closed') {
          throw new Error('Ce ticket est fermé.');
        }
  
        // Vérifier si le canal existe toujours
        const channel = guild.channels.cache.get(ticket.channel_id);
        if (!channel) {
          throw new Error('Le canal de ce ticket n\'existe plus.');
        }
  
        // Ajouter l'utilisateur au canal
        const user = await guild.members.fetch(userId).catch(() => null);
        if (!user) {
          throw new Error('Utilisateur introuvable.');
        }
  
        await channel.permissionOverwrites.create(user, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
  
        return true;
      } catch (error) {
        console.error('❌ Erreur lors de l\'ajout de l\'utilisateur au ticket:', error);
        throw error;
      }
    }
  
    /**
     * Retire un utilisateur d'un ticket
     * @param {Object} interaction - Interaction Discord
     * @param {string} ticketId - ID du ticket
     * @param {string} userId - ID de l'utilisateur à retirer
     * @returns {Promise<boolean>} Succès de l'opération
     */
    async removeUserFromTicket(interaction, ticketId, userId) {
      try {
        const { guild } = interaction;
        
        // Récupérer les informations du ticket
        const ticketData = await dbManager.executeQuery(
          'SELECT * FROM tickets WHERE ticket_id = ?',
          [ticketId]
        );
  
        if (ticketData.length === 0) {
          throw new Error('Ticket introuvable.');
        }
  
        const ticket = ticketData[0];
        
        // Ne pas permettre de retirer le créateur du ticket
        if (ticket.user_id === userId) {
          throw new Error('Vous ne pouvez pas retirer le créateur du ticket.');
        }
  
        if (ticket.status === 'closed') {
          throw new Error('Ce ticket est fermé.');
        }
  
        // Vérifier si le canal existe toujours
        const channel = guild.channels.cache.get(ticket.channel_id);
        if (!channel) {
          throw new Error('Le canal de ce ticket n\'existe plus.');
        }
  
        // Retirer l'utilisateur du canal
        const user = await guild.members.fetch(userId).catch(() => null);
        if (!user) {
          throw new Error('Utilisateur introuvable.');
        }
  
        await channel.permissionOverwrites.delete(userId);
  
        return true;
      } catch (error) {
        console.error('❌ Erreur lors du retrait de l\'utilisateur du ticket:', error);
        throw error;
      }
    }
  
    /**
     * Prend en charge un ticket
     * @param {Object} interaction - Interaction Discord
     * @param {string} ticketId - ID du ticket
     * @returns {Promise<boolean>} Succès de l'opération
     */
    async claimTicket(interaction, ticketId) {
      try {
        const { guild, user } = interaction;
        
        // Récupérer les informations du ticket
        const ticketData = await dbManager.executeQuery(
          'SELECT * FROM tickets WHERE ticket_id = ?',
          [ticketId]
        );
  
        if (ticketData.length === 0) {
          throw new Error('Ticket introuvable.');
        }
  
        const ticket = ticketData[0];
        if (ticket.status === 'closed') {
          throw new Error('Ce ticket est fermé.');
        }
  
        // Vérifier si le canal existe toujours
        const channel = guild.channels.cache.get(ticket.channel_id);
        if (!channel) {
          throw new Error('Le canal de ce ticket n\'existe plus.');
        }
  
        // Modifier le sujet du canal
        await channel.setTopic(`Ticket de <@${ticket.user_id}> | Pris en charge par <@${user.id}>`);
  
        // Créer un embed pour informer
        const claimEmbed = new EmbedBuilder()
          .setTitle('Ticket pris en charge')
          .setDescription(`Ce ticket a été pris en charge par <@${user.id}>`)
          .setColor(EMBED_COLORS.SUCCESS)
          .setTimestamp();
  
        await channel.send({ embeds: [claimEmbed] });
  
        return true;
      } catch (error) {
        console.error('❌ Erreur lors de la prise en charge du ticket:', error);
        throw error;
      }
    }
  
    /**
     * Crée un transcript du ticket
     * @param {Object} channel - Canal Discord
     * @param {Object} ticket - Données du ticket
     * @returns {Promise<string>} Chemin du fichier de transcript
     */
    async _createTranscript(channel, ticket) {
      try {
        // Récupérer tous les messages du canal
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).reverse();
        
        let transcriptContent = `# Transcript du ticket ${channel.name}\n\n`;
        transcriptContent += `**Créé par:** <@${ticket.user_id}>\n`;
        transcriptContent += `**Créé le:** ${new Date(ticket.created_at).toLocaleString()}\n`;
        transcriptContent += `**Fermé le:** ${new Date().toLocaleString()}\n\n`;
        transcriptContent += `## Messages\n\n`;
        
        for (const message of sortedMessages) {
          const author = message.author;
          const timestamp = new Date(message.createdTimestamp).toLocaleString();
          const content = message.content || "*Aucun contenu textuel*";
          
          transcriptContent += `### ${author.tag} (${timestamp})\n`;
          transcriptContent += `${content}\n\n`;
          
          if (message.attachments.size > 0) {
            transcriptContent += "**Pièces jointes:**\n";
            message.attachments.forEach(attachment => {
              transcriptContent += `- [${attachment.name}](${attachment.url})\n`;
            });
            transcriptContent += "\n";
          }
          
          if (message.embeds.length > 0) {
            transcriptContent += "**Embeds:** *Les embeds ne peuvent pas être affichés dans le transcript*\n\n";
          }
        }
        
        // Créer le dossier de transcripts s'il n'existe pas
        const dir = './transcripts';
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Créer le fichier de transcript
        const fileName = `transcript-${channel.name}-${Date.now()}.md`;
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, transcriptContent);
        
        return filePath;
      } catch (error) {
        console.error('❌ Erreur lors de la création du transcript:', error);
        return null;
      }
    }
  
    /**
     * Récupère le prochain numéro de ticket
     * @param {string} guildId - ID du serveur
     * @returns {Promise<number>} Numéro du prochain ticket
     */
    async _getNextTicketNumber(guildId) {
      try {
        const result = await dbManager.executeQuery(
          'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?',
          [guildId]
        );
        return result[0].count + 1;
      } catch (error) {
        console.error('❌ Erreur lors de la récupération du numéro de ticket:', error);
        return 1;
      }
    }
  
    /**
     * Convertit une chaîne de style en ButtonStyle
     * @param {string} style - Style en chaîne
     * @returns {ButtonStyle} Style de bouton
     */
    _getButtonStyle(style) {
      switch (style.toUpperCase()) {
        case 'PRIMARY': return ButtonStyle.Primary;
        case 'SECONDARY': return ButtonStyle.Secondary;
        case 'SUCCESS': return ButtonStyle.Success;
        case 'DANGER': return ButtonStyle.Danger;
        default: return ButtonStyle.Primary;
      }
    }
  
    /**
     * Obtient les réponses automatiques pour un serveur
     * @param {string} guildId - ID du serveur
     * @returns {Promise<Array>} Liste des réponses automatiques
     */
    async getAutoResponses(guildId) {
      try {
        const responses = await dbManager.executeQuery(
          'SELECT * FROM ticket_responses WHERE guild_id = ? AND enabled = 1',
          [guildId]
        );
        return responses;
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des réponses automatiques:', error);
        return [];
      }
    }
  
    /**
     * Ajoute une réponse automatique
     * @param {string} guildId - ID du serveur
     * @param {string} keyword - Mot-clé déclencheur
     * @param {string} response - Réponse à envoyer
     * @returns {Promise<Object>} Réponse automatique créée
     */
    async addAutoResponse(guildId, keyword, response) {
      try {
        const result = await dbManager.executeRun(
          'INSERT INTO ticket_responses (guild_id, keyword, response) VALUES (?, ?, ?)',
          [guildId, keyword, response]
        );
        
        return {
          response_id: result.lastID,
          guild_id: guildId,
          keyword,
          response,
          enabled: 1
        };
      } catch (error) {
        console.error('❌ Erreur lors de l\'ajout de la réponse automatique:', error);
        throw error;
      }
    }
  
    /**
     * Supprime une réponse automatique
     * @param {string} responseId - ID de la réponse
     * @returns {Promise<boolean>} Succès de la suppression
     */
    async removeAutoResponse(responseId) {
      try {
        await dbManager.executeRun(
          'DELETE FROM ticket_responses WHERE response_id = ?',
          [responseId]
        );
        return true;
      } catch (error) {
        console.error('❌ Erreur lors de la suppression de la réponse automatique:', error);
        throw error;
      }
    }
  }
  
  // Créer une instance unique
  const ticketManager = new TicketManager();
  
  export default ticketManager;