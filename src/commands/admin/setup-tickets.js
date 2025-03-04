import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import ticketManager from '../../utils/ticketManager.js';

export const data = new SlashCommandBuilder()
  .setName('setup-tickets')
  .setDescription('Crée un panneau de tickets')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option => 
    option.setName('channel')
      .setDescription('Le salon où le panneau sera créé')
      .setRequired(true));

export async function execute(interaction) {
  try {
    const channel = interaction.options.getChannel('channel');
    
    // Vérifier que le salon est textuel
    if (channel.type !== 0) { // 0 = GUILD_TEXT
      return interaction.reply({
        content: '❌ Le salon doit être un salon textuel.',
        ephemeral: true
      });
    }
    
    // Générer le panneau de tickets
    const { embed, components } = await ticketManager.generateTicketPanel(interaction.guild.id);
    
    // Envoyer le panneau dans le salon
    await channel.send({
      embeds: [embed],
      components
    });
    
    return interaction.reply({
      content: `✅ Le panneau de tickets a été créé dans le salon ${channel}.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Erreur lors de la configuration des tickets:', error);
    return interaction.reply({
      content: '❌ Une erreur est survenue lors de la configuration des tickets.',
      ephemeral: true
    });
  }
}