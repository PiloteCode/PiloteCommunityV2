import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import logger from '../../utils/logs/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('channelinfo')
        .setDescription('Affiche les informations sur un salon')
        .addChannelOption(option => 
            option.setName('salon')
                .setDescription('Le salon dont vous souhaitez voir les informations')
                .setRequired(false)),
    
    async execute(interaction, client) {
        const channel = interaction.options.getChannel('salon') || interaction.channel;
        
        try {
            // Formater la date de création
            const createdAt = channel.createdAt;
            const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const formattedDate = createdAt.toLocaleDateString('fr-FR', dateOptions);
            
            // Déterminer le type de salon en français
            let channelType = 'Inconnu';
            let additionalInfo = [];
            
            switch (channel.type) {
                case ChannelType.GuildText:
                    channelType = 'Salon textuel';
                    additionalInfo.push(`Slowmode: ${channel.rateLimitPerUser ? `${channel.rateLimitPerUser} secondes` : 'Désactivé'}`);
                    additionalInfo.push(`NSFW: ${channel.nsfw ? 'Oui' : 'Non'}`);
                    if (channel.topic) additionalInfo.push(`Sujet: ${channel.topic}`);
                    break;
                case ChannelType.GuildVoice:
                    channelType = 'Salon vocal';
                    additionalInfo.push(`Bitrate: ${channel.bitrate / 1000} kbps`);
                    additionalInfo.push(`Limite d'utilisateurs: ${channel.userLimit || 'Illimité'}`);
                    break;
                case ChannelType.GuildCategory:
                    channelType = 'Catégorie';
                    const childChannels = interaction.guild.channels.cache.filter(ch => ch.parentId === channel.id);
                    additionalInfo.push(`Salons: ${childChannels.size}`);
                    break;
                case ChannelType.GuildAnnouncement:
                    channelType = 'Salon d\'annonces';
                    if (channel.topic) additionalInfo.push(`Sujet: ${channel.topic}`);
                    break;
                case ChannelType.GuildStageVoice:
                    channelType = 'Salon de conférence';
                    additionalInfo.push(`Bitrate: ${channel.bitrate / 1000} kbps`);
                    break;
                case ChannelType.GuildForum:
                    channelType = 'Forum';
                    break;
                case ChannelType.PublicThread:
                    channelType = 'Fil de discussion public';
                    additionalInfo.push(`Salon parent: <#${channel.parentId}>`);
                    break;
                case ChannelType.PrivateThread:
                    channelType = 'Fil de discussion privé';
                    additionalInfo.push(`Salon parent: <#${channel.parentId}>`);
                    break;
                case ChannelType.GuildDirectory:
                    channelType = 'Annuaire';
                    break;
                default:
                    channelType = `Type inconnu (${channel.type})`;
            }
            
            // Créer l'embed
            const channelEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`Informations sur le salon: ${channel.name}`)
                .addFields(
                    { name: 'ID', value: channel.id, inline: true },
                    { name: 'Type', value: channelType, inline: true },
                    { name: 'Catégorie', value: channel.parent ? channel.parent.name : 'Aucune', inline: true },
                    { name: 'Position', value: `${channel.position}`, inline: true },
                    { name: 'Créé le', value: formattedDate, inline: true }
                )
                .setFooter({ text: 'PILOTE Community' })
                .setTimestamp();
                
            // Ajouter les informations supplémentaires spécifiques au type de salon
            if (additionalInfo.length > 0) {
                channelEmbed.addFields({ name: 'Informations supplémentaires', value: additionalInfo.join('\n') });
            }
            
            // Permissions (limité aux plus importantes pour éviter de surcharger l'embed)
            if (channel.permissionOverwrites && channel.permissionOverwrites.cache.size > 0) {
                let permissionsText = '';
                const maxEntries = 5;
                let count = 0;
                
                for (const [id, overwrite] of channel.permissionOverwrites.cache.entries()) {
                    if (count >= maxEntries) {
                        permissionsText += `... et ${channel.permissionOverwrites.cache.size - maxEntries} autres modifications`;
                        break;
                    }
                    
                    const isRole = interaction.guild.roles.cache.has(id);
                    const target = isRole
                        ? `@${interaction.guild.roles.cache.get(id).name}`
                        : interaction.guild.members.cache.get(id)?.user.username || 'Utilisateur inconnu';
                    
                    permissionsText += `${isRole ? 'Rôle' : 'Membre'}: ${target}\n`;
                    count++;
                }
                
                if (permissionsText) {
                    channelEmbed.addFields({ name: `Permissions modifiées (${channel.permissionOverwrites.cache.size})`, value: permissionsText });
                }
            }
            
            await interaction.reply({ embeds: [channelEmbed] });
            logger.info(`Channelinfo command used by ${interaction.user.tag} for channel: ${channel.name}`);
        } catch (error) {
            logger.error(`Channelinfo command error: ${error.message}`);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de la récupération des informations sur ce salon.',
                ephemeral: true
            });
        }
    },
};