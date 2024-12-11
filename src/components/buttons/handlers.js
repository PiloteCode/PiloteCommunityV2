import { getUser, updateUser, addToInventory, removeFromInventory } from '../../database/manager.js';

export async function handleShopBuy(interaction, itemId) {
  const userData = await getUser(interaction.user.id);
  const shopItem = await getShopItem(itemId);

  if (!shopItem) {
    return interaction.reply({
      content: '❌ Cet item n\'existe pas.',
      ephemeral: true
    });
  }

  if (userData.balance < shopItem.price) {
    return interaction.reply({
      content: '❌ Vous n\'avez pas assez d\'argent pour acheter cet item.',
      ephemeral: true
    });
  }


  await updateUser(userData.user_id, {
    balance: userData.balance - shopItem.price
  });
  await addToInventory(userData.user_id, itemId);


  if (shopItem.type === 'role' && shopItem.role_id) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    await member.roles.add(shopItem.role_id);
  }

  return interaction.reply({
    content: `✅ Vous avez acheté ${shopItem.name} pour ${shopItem.price}💵!`,
    ephemeral: true
  });
}


import { Events } from 'discord.js';
import { handleShopBuy } from '../components/buttons/handlers.js';

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
      }
      else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'shop_buy') {
          await handleShopBuy(interaction, interaction.values[0]);
        }
      }
    } catch (error) {
      console.error(error);
      const reply = {
        content: 'Une erreur est survenue lors de l\'exécution de cette action.',
        ephemeral: true
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }
};
