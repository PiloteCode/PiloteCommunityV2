import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import logger from '../../utils/logs/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('urban')
        .setDescription('Recherche une définition sur Urban Dictionary')
        .addStringOption(option => 
            option.setName('terme')
                .setDescription('Le terme à rechercher')
                .setRequired(true)),
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        try {
            const term = interaction.options.getString('terme');
            const response = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
            
            if (!response.data.list.length) {
                return interaction.editReply(`❌ Aucune définition trouvée pour "${term}".`);
            }
            
            const definition = response.data.list[0];
            
            // Limiter la longueur des textes pour éviter les erreurs de Discord
            const limitText = (text, maxLength = 1024) => {
                if (text.length <= maxLength) return text;
                return text.substring(0, maxLength - 3) + '...';
            };
            
            const cleanText = text => text.replace(/[\[\]]/g, '');
            
            const urbanEmbed = new EmbedBuilder()
                .setColor('#EFFF00')
                .setTitle(`📚 Définition de "${definition.word}"`)
                .setURL(definition.permalink)
                .addFields(
                    { name: 'Définition', value: limitText(cleanText(definition.definition)) },
                    { name: 'Exemple', value: limitText(cleanText(definition.example) || '*Aucun exemple fourni*') },
                    { name: '👍 Upvotes', value: definition.thumbs_up.toString(), inline: true },
                    { name: '👎 Downvotes', value: definition.thumbs_down.toString(), inline: true }
                )
                .setFooter({ text: `Auteur: ${definition.author} | Urban Dictionary` })
                .setTimestamp();
                
            await interaction.editReply({ embeds: [urbanEmbed] });
            logger.info(`Urban command used by ${interaction.user.tag} for term: ${term}`);
        } catch (error) {
            logger.error(`Urban command error: ${error.message}`);
            await interaction.editReply('❌ Une erreur est survenue lors de la recherche sur Urban Dictionary.');
        }
    },
};