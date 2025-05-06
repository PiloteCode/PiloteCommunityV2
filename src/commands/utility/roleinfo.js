const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logs/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Affiche les informations sur un rôle')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('Le rôle dont vous souhaitez voir les informations')
                .setRequired(true)),
    
    async execute(interaction) {
        const role = interaction.options.getRole('role');
        
        try {
            // Formater la date de création
            const createdAt = role.createdAt;
            const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const formattedDate = createdAt.toLocaleDateString('fr-FR', dateOptions);
            
            // Convertir les permissions en format lisible
            const permissionsArray = role.permissions.toArray();
            let permissionsText = '';
            
            if (permissionsArray.length > 0) {
                permissionsText = permissionsArray
                    .map(perm => `\`${perm.replace(/_/g, ' ').toLowerCase()}\``)
                    .join(', ');
            } else {
                permissionsText = '*Aucune permission*';
            }
            
            // Obtenir le nombre de membres avec ce rôle (nécessite GUILD_MEMBERS intent)
            const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id)).size;
            
            // Créer l'embed
            const roleEmbed = new EmbedBuilder()
                .setColor(role.color || '#000000')
                .setTitle(`Informations sur le rôle: ${role.name}`)
                .addFields(
                    { name: 'ID', value: role.id, inline: true },
                    { name: 'Couleur', value: role.hexColor, inline: true },
                    { name: 'Position', value: `${role.position}`, inline: true },
                    { name: 'Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
                    { name: 'Affiché séparément', value: role.hoist ? 'Oui' : 'Non', inline: true },
                    { name: 'Géré par une intégration', value: role.managed ? 'Oui' : 'Non', inline: true },
                    { name: 'Créé le', value: formattedDate, inline: false },
                    { name: `Membres (${membersWithRole})`, value: membersWithRole > 0 ? `${membersWithRole} membre(s) possède(nt) ce rôle` : '*Personne n\'a ce rôle*', inline: false },
                    { name: 'Permissions', value: permissionsText.length > 1024 ? `${permissionsText.substring(0, 1021)}...` : permissionsText, inline: false }
                )
                .setFooter({ text: 'PILOTE Community' })
                .setTimestamp();
                
            await interaction.reply({ embeds: [roleEmbed] });
            logger.info(`Roleinfo command used by ${interaction.user.tag} for role: ${role.name}`);
        } catch (error) {
            logger.error(`Roleinfo command error: ${error.message}`);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de la récupération des informations sur ce rôle.',
                ephemeral: true
            });
        }
    },
};