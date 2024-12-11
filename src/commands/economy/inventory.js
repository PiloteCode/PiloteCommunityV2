import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getInventory } from '../../database/manager.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Affiche votre inventaire')
  .addUserOption(option => 
    option.setName('utilisateur')
      .setDescription('Utilisateur dont vous voulez voir l\'inventaire')
      .setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
  const inventory = await getInventory(targetUser.id);

  const embed = new EmbedBuilder()
    .setTitle(`🎒 Inventaire de ${targetUser.username}`)
    .setColor('#ffa500')
    .setThumbnail(targetUser.displayAvatarURL());

  if (inventory.length === 0) {
    embed.setDescription('L\'inventaire est vide');
  } else {
    // Grouper par type d'item
    const itemsByType = inventory.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {});

    Object.entries(itemsByType).forEach(([type, items]) => {
      const itemsList = items.map(item => 
        `${item.name} x${item.quantity}\n*${item.description}*`
      ).join('\n\n');
      
      embed.addFields({ 
        name: type.charAt(0).toUpperCase() + type.slice(1), 
        value: itemsList 
      });
    });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: targetUser.id !== interaction.user.id
  });
}