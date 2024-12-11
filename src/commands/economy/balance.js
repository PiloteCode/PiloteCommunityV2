import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../../database/manager.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Affiche votre solde ou celui d\'un autre utilisateur')
  .addUserOption(option => 
    option.setName('utilisateur')
      .setDescription('Utilisateur dont vous voulez voir le solde')
      .setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
  const userData = await getUser(targetUser.id);

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`💰 Solde de ${targetUser.username}`)
    .addFields(
      { name: 'Portefeuille', value: `${userData.balance}💵`, inline: true },
      { name: 'Banque', value: `${userData.bank}💵`, inline: true },
      { name: 'Total', value: `${userData.balance + userData.bank}💵`, inline: true }
    )
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ 
    embeds: [embed],
    ephemeral: targetUser.id !== interaction.user.id 
  });
}
