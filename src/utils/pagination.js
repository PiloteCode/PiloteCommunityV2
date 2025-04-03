import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PAGINATION, EMBED_COLORS } from '../config/constants.js';

export class PaginationManager {
  static createPaginationRow(currentPage, totalPages, isFirstPage = false, isLastPage = false) {
    const row = new ActionRowBuilder();
    
    // Bouton première page
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('first_page')
        .setLabel('⏮️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isFirstPage)
    );

    // Bouton page précédente
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('previous_page')
        .setLabel('◀️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isFirstPage)
    );

    // Indicateur de page actuelle
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('page_indicator')
        .setLabel(`${currentPage}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Bouton page suivante
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isLastPage)
    );

    // Bouton dernière page
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('last_page')
        .setLabel('⏭️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isLastPage)
    );

    return row;
  }

  static async handlePagination(interaction, pages, timeout = PAGINATION.TIMEOUT) {
    if (pages.length === 0) return;
    
    let currentPage = 0;
    const totalPages = pages.length;

    // Créer le message initial
    const message = await interaction.reply({
      embeds: [pages[currentPage]],
      components: totalPages > 1 ? [this.createPaginationRow(1, totalPages, true, false)] : [],
      ephemeral: true,
      fetchReply: true
    });

    if (totalPages === 1) return;

    // Créer le collecteur de boutons
    const collector = message.createMessageComponentCollector({
      time: timeout
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ 
          content: '❌ Ces boutons ne sont pas pour vous!', 
          ephemeral: true 
        });
        return;
      }

      await i.deferUpdate();

      switch (i.customId) {
        case 'first_page':
          currentPage = 0;
          break;
        case 'previous_page':
          currentPage = Math.max(0, currentPage - 1);
          break;
        case 'next_page':
          currentPage = Math.min(totalPages - 1, currentPage + 1);
          break;
        case 'last_page':
          currentPage = totalPages - 1;
          break;
      }

      const isFirstPage = currentPage === 0;
      const isLastPage = currentPage === totalPages - 1;

      await i.editReply({
        embeds: [pages[currentPage]],
        components: [this.createPaginationRow(currentPage + 1, totalPages, isFirstPage, isLastPage)]
      });
    });

    collector.on('end', async () => {
      try {
        await message.edit({ components: [] });
      } catch (error) {
        console.error('Erreur lors de la suppression des boutons:', error);
      }
    });
  }
}

export function createPaginationRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('previous_page')
        .setLabel('◀️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('▶️')
        .setStyle(ButtonStyle.Primary)
    );
}