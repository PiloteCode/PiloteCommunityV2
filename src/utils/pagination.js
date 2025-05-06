import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType
} from 'discord.js';

export class Pagination {
  /**
   * Create a pagination handler for embeds
   * @param {Array} embeds - Array of embeds to paginate
   * @param {Object} options - Pagination options
   * @param {number} options.time - Time in milliseconds for the collector (default: 120000ms)
   * @param {boolean} options.disableButtons - Whether to disable buttons after timeout (default: true)
   * @param {boolean} options.fastSkip - Whether to add fast skip buttons (first/last page)
   * @param {string} options.userId - User ID who can interact with buttons (optional)
   */
  constructor(embeds, options = {}) {
    this.embeds = embeds;
    this.current = 0;
    this.time = options.time || 120000; // 2 minutes by default
    this.disableButtons = options.disableButtons !== false;
    this.fastSkip = options.fastSkip || false;
    this.userId = options.userId || null;
    
    // Make sure we have valid embeds
    if (!Array.isArray(this.embeds) || this.embeds.length === 0) {
      throw new Error('Embeds must be a non-empty array');
    }
  }
  
  /**
   * Get the current page embed
   * @returns {EmbedBuilder} The current embed
   */
  getCurrentEmbed() {
    return this.embeds[this.current];
  }
  
  /**
   * Get pagination buttons
   * @returns {ActionRowBuilder} Action row with pagination buttons
   */
  getButtons() {
    const row = new ActionRowBuilder();
    
    // First page button (if fastSkip is enabled)
    if (this.fastSkip) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('pagination:first')
          .setLabel('⏪')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(this.current === 0)
      );
    }
    
    // Previous page button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('pagination:prev')
        .setLabel('◀️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(this.current === 0)
    );
    
    // Page indicator button (not functional, just shows current page)
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('pagination:page')
        .setLabel(`${this.current + 1}/${this.embeds.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    // Next page button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('pagination:next')
        .setLabel('▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(this.current === this.embeds.length - 1)
    );
    
    // Last page button (if fastSkip is enabled)
    if (this.fastSkip) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('pagination:last')
          .setLabel('⏩')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(this.current === this.embeds.length - 1)
      );
    }
    
    return row;
  }
  
  /**
   * Send paginated embeds to a channel
   * @param {Interaction} interaction - Discord interaction to reply to
   * @param {boolean} ephemeral - Whether the reply should be ephemeral
   * @returns {Promise<Message>} The sent message
   */
  async send(interaction, ephemeral = false) {
    // Send initial message
    const message = await interaction.reply({
      embeds: [this.getCurrentEmbed()],
      components: this.embeds.length > 1 ? [this.getButtons()] : [],
      ephemeral,
      fetchReply: true
    });
    
    // If only one page, no need for pagination
    if (this.embeds.length <= 1) {
      return message;
    }
    
    // Create a collector for button interactions
    const collector = message.createMessageComponentCollector({ 
      componentType: ComponentType.Button,
      time: this.time
    });
    
    // Handle button interactions
    collector.on('collect', async (i) => {
      // Check if a specific user is set and validate
      if (this.userId && i.user.id !== this.userId) {
        await i.reply({
          content: '❌ Vous ne pouvez pas utiliser ces boutons.',
          ephemeral: true
        });
        return;
      }
      
      // Handle pagination actions
      switch (i.customId) {
        case 'pagination:first':
          this.current = 0;
          break;
        case 'pagination:prev':
          this.current = Math.max(0, this.current - 1);
          break;
        case 'pagination:next':
          this.current = Math.min(this.embeds.length - 1, this.current + 1);
          break;
        case 'pagination:last':
          this.current = this.embeds.length - 1;
          break;
      }
      
      // Update the message
      await i.update({
        embeds: [this.getCurrentEmbed()],
        components: [this.getButtons()]
      });
    });
    
    // When collector expires, disable buttons if option is enabled
    collector.on('end', async () => {
      if (this.disableButtons) {
        try {
          // Try to fetch the message to ensure it still exists
          const fetchedMessage = await interaction.fetchReply();
          
          // Create disabled buttons
          const disabledRow = new ActionRowBuilder();
          
          if (this.fastSkip) {
            disabledRow.addComponents(
              new ButtonBuilder()
                .setCustomId('pagination:first')
                .setLabel('⏪')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
            );
          }
          
          disabledRow.addComponents(
            new ButtonBuilder()
              .setCustomId('pagination:prev')
              .setLabel('◀️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          );
          
          disabledRow.addComponents(
            new ButtonBuilder()
              .setCustomId('pagination:page')
              .setLabel(`${this.current + 1}/${this.embeds.length}`)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );
          
          disabledRow.addComponents(
            new ButtonBuilder()
              .setCustomId('pagination:next')
              .setLabel('▶️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          );
          
          if (this.fastSkip) {
            disabledRow.addComponents(
              new ButtonBuilder()
                .setCustomId('pagination:last')
                .setLabel('⏩')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
            );
          }
          
          // Update the message with disabled buttons
          await fetchedMessage.edit({
            embeds: [this.getCurrentEmbed()],
            components: [disabledRow]
          });
        } catch (error) {
          // Message may have been deleted, just ignore
          console.warn('Failed to disable pagination buttons:', error);
        }
      }
    });
    
    return message;
  }
  
  /**
   * Create a paginated embed from an array of items
   * @param {Array} items - Array of items to paginate
   * @param {Function} createEmbed - Function to create embed for each page
   * @param {number} itemsPerPage - Number of items per page
   * @param {Object} options - Pagination options
   * @returns {Pagination} Pagination instance
   */
  static fromArray(items, createEmbed, itemsPerPage = 10, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items must be a non-empty array');
    }
    
    if (typeof createEmbed !== 'function') {
      throw new Error('createEmbed must be a function');
    }
    
    // Calculate number of pages
    const pageCount = Math.ceil(items.length / itemsPerPage);
    const embeds = [];
    
    // Create an embed for each page
    for (let i = 0; i < pageCount; i++) {
      const pageItems = items.slice(i * itemsPerPage, (i + 1) * itemsPerPage);
      const embed = createEmbed(pageItems, i, pageCount);
      embeds.push(embed);
    }
    
    return new Pagination(embeds, options);
  }
}