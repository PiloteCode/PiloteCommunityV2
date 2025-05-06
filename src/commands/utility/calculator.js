const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logs/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calculator')
        .setDescription('Effectue un calcul mathématique')
        .addStringOption(option => 
            option.setName('expression')
                .setDescription('L\'expression mathématique à calculer')
                .setRequired(true)),
    
    async execute(interaction) {
        const expression = interaction.options.getString('expression');
        
        try {
            // Sécuriser l'expression avant évaluation
            if (!/^[0-9+\-*/().%\s]*$/.test(expression)) {
                return interaction.reply({
                    content: '❌ Expression invalide! Seuls les nombres et opérateurs +, -, *, /, %, (, ) sont autorisés.',
                    ephemeral: true
                });
            }
            
            // Remplacer le % par * 0.01 pour calculer les pourcentages
            const sanitizedExpression = expression.replace(/%/g, '*0.01');
            
            // Évaluer l'expression de manière sécurisée avec Function
            // eslint-disable-next-line no-new-func
            const result = Function('"use strict"; return (' + sanitizedExpression + ')')();
            
            if (isNaN(result) || !isFinite(result)) {
                return interaction.reply({
                    content: '❌ Le résultat n\'est pas un nombre valide.',
                    ephemeral: true
                });
            }
            
            const calculatorEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Calculatrice')
                .addFields(
                    { name: 'Expression', value: `\`${expression}\`` },
                    { name: 'Résultat', value: `\`${result}\`` }
                )
                .setFooter({ text: 'Calculatrice PILOTE' })
                .setTimestamp();
                
            await interaction.reply({ embeds: [calculatorEmbed] });
            logger.info(`Calculator command used by ${interaction.user.tag}: ${expression} = ${result}`);
        } catch (error) {
            logger.error(`Calculator command error: ${error.message}`);
            await interaction.reply({
                content: '❌ Impossible de calculer cette expression. Veuillez vérifier la syntaxe.',
                ephemeral: true
            });
        }
    },
};