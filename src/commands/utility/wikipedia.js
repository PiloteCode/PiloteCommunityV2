const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const logger = require('../../utils/logs/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wikipedia')
        .setDescription('Recherche un article sur Wikipédia')
        .addStringOption(option => 
            option.setName('recherche')
                .setDescription('Terme à rechercher sur Wikipédia')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('langue')
                .setDescription('Langue de l\'article (fr, en, es, etc.)')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const query = interaction.options.getString('recherche');
            const lang = interaction.options.getString('langue') || 'fr';
            
            // Premier appel pour chercher les pages correspondantes
            const searchResponse = await axios.get(
                `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1`
            );
            
            if (!searchResponse.data.query.search.length) {
                return interaction.editReply(`❌ Aucun résultat trouvé pour "${query}" sur Wikipédia.`);
            }
            
            const firstResult = searchResponse.data.query.search[0];
            const pageId = firstResult.pageid;
            
            // Deuxième appel pour récupérer les détails de la page
            const pageResponse = await axios.get(
                `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&pageids=${pageId}&format=json&utf8=1`
            );
            
            const page = pageResponse.data.query.pages[pageId];
            
            // Limiter l'extrait à 1000 caractères pour l'affichage
            let extract = page.extract;
            if (extract.length > 1000) {
                extract = extract.substring(0, 997) + '...';
            }
            
            const wikipediaEmbed = new EmbedBuilder()
                .setColor('#FFFFFF')
                .setTitle(page.title)
                .setURL(page.fullurl)
                .setDescription(extract)
                .setFooter({ text: `Wikipedia • ${lang.toUpperCase()}` })
                .setTimestamp();
                
            // Ajouter l'image de la page si disponible
            const imageResponse = await axios.get(
                `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&pithumbsize=512&pageids=${pageId}&format=json&utf8=1`
            );
            
            if (imageResponse.data.query.pages[pageId].thumbnail) {
                wikipediaEmbed.setThumbnail(imageResponse.data.query.pages[pageId].thumbnail.source);
            }
            
            await interaction.editReply({ embeds: [wikipediaEmbed] });
            logger.info(`Wikipedia command used by ${interaction.user.tag} for query: ${query} (lang: ${lang})`);
        } catch (error) {
            logger.error(`Wikipedia command error: ${error.message}`);
            await interaction.editReply('❌ Une erreur est survenue lors de la recherche sur Wikipédia.');
        }
    },
};