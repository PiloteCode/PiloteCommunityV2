import { EmbedBuilder } from 'discord.js';

export function createProfileEmbed(user, userData, inventory) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`Profil de ${user.username}`)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: '💰 Portefeuille', value: `${userData.balance}💵`, inline: true },
      { name: '🏦 Banque', value: `${userData.bank}💵`, inline: true },
      { name: '📊 Niveau', value: `${userData.level} (${userData.experience} XP)`, inline: true }
    );

  if (inventory.length > 0) {
    const itemsList = inventory
      .map(item => `${item.name} x${item.quantity}`)
      .join('\n');
    embed.addFields({ name: '🎒 Inventaire', value: itemsList });
  }

  return embed;
}

export function createTransactionEmbed(transaction, users) {
  return new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('💸 Transaction effectuée')
    .addFields(
      { name: 'De', value: users.from.username, inline: true },
      { name: 'À', value: users.to.username, inline: true },
      { name: 'Montant', value: `${transaction.amount}💵`, inline: true },
      { name: 'Type', value: transaction.type },
      { name: 'Date', value: new Date(transaction.timestamp).toLocaleString() }
    );
}