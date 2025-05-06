import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import logger from '../../utils/logs/logger.js';
import config from '../../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Affiche la bannière d\'un utilisateur ou du serveur')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Affiche la bannière d\'un utilisateur')
                .addUserOption(option => 
                    option.setName('utilisateur')
                        .setDescription('L\'utilisateur dont vous souhaitez voir la bannière')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('server')
                .setDescription('Affiche la bannière du serveur')),
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        try {
            const subcommand = interaction.options.getSubcommand();
            
            if (subcommand === 'user') {
                const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
                
                // Récupérer les données complètes de l'utilisateur via l'API Discord
                const token = config.botToken || process.env.DISCORD_TOKEN;
                if (!token) {
                    return interaction.editReply('❌ Token du bot non configuré. Veuillez contacter un administrateur.');
                }
                
                const response = await axios.get(`https://discord.com/api/v10/users/${targetUser.id}`, {
                    headers: { Authorization: `Bot ${token}` }
                });
                
                // Vérifier si l'utilisateur a une bannière
                const bannerHash = response.data.banner;
                if (!bannerHash) {
                    return interaction.editReply(`❌ ${targetUser.username} n'a pas de bannière de profil.`);
                }
                
                // Construire l'URL de la bannière
                const extension = bannerHash.startsWith('a_') ? 'gif' : 'png';
                const bannerUrl = `https://cdn.discordapp.com/banners/${targetUser.id}/${bannerHash}.${extension}?size=1024`;
                
                const bannerEmbed = new EmbedBuilder()
                    .setColor('#2F3136')
                    .setTitle(`Bannière de ${targetUser.username}`)
                    .setImage(bannerUrl)
                    .setFooter({ text: 'PILOTE Community' })
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [bannerEmbed] });
                logger.info(`Banner command (user) used by ${interaction.user.tag} for user: ${targetUser.tag}`);
            } else if (subcommand === 'server') {
                const guild = interaction.guild;
                
                // Vérifier si le serveur a une bannière
                if (!guild.banner) {
                    return interaction.editReply('❌ Ce serveur n\'a pas de bannière.');
                }
                
                const bannerUrl = guild.bannerURL({ size: 1024 });
                
                const bannerEmbed = new EmbedBuilder()
                    .setColor('#2F3136')
                    .setTitle(`Bannière du serveur ${guild.name}`)
                    .setImage(bannerUrl)
                    .setFooter({ text: 'PILOTE Community' })
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [bannerEmbed] });
                logger.info(`Banner command (server) used by ${interaction.user.tag}`);
            }
        } catch (error) {
            logger.error(`Banner command error: ${error.message}`);
            await interaction.editReply('❌ Une erreur est survenue lors de la récupération de la bannière.');
        }
    },
};