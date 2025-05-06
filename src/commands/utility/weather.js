import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import config from '../../config/config.js';
import logger from '../../utils/logs/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Affiche les informations météorologiques pour une ville')
        .addStringOption(option => 
            option.setName('ville')
                .setDescription('Nom de la ville')
                .setRequired(true)),
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        try {
            const city = interaction.options.getString('ville');
            const apiKey = config.apiKeys?.openWeather || process.env.WEATHER_API_KEY;
            
            if (!apiKey) {
                return interaction.editReply('❌ La clé API pour la météo n\'est pas configurée. Veuillez contacter un administrateur.');
            }
            
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`);
            const weatherData = response.data;
            
            const weatherEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Météo à ${weatherData.name}, ${weatherData.sys.country}`)
                .setDescription(`**${weatherData.weather[0].description.charAt(0).toUpperCase() + weatherData.weather[0].description.slice(1)}**`)
                .setThumbnail(`https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`)
                .addFields(
                    { name: 'Température', value: `${Math.round(weatherData.main.temp)}°C`, inline: true },
                    { name: 'Ressenti', value: `${Math.round(weatherData.main.feels_like)}°C`, inline: true },
                    { name: 'Min/Max', value: `${Math.round(weatherData.main.temp_min)}°C / ${Math.round(weatherData.main.temp_max)}°C`, inline: true },
                    { name: 'Humidité', value: `${weatherData.main.humidity}%`, inline: true },
                    { name: 'Vent', value: `${Math.round(weatherData.wind.speed * 3.6)} km/h`, inline: true },
                    { name: 'Pression', value: `${weatherData.main.pressure} hPa`, inline: true }
                )
                .setFooter({ text: 'Données fournies par OpenWeatherMap' })
                .setTimestamp();
                
            await interaction.editReply({ embeds: [weatherEmbed] });
            logger.info(`Weather command used by ${interaction.user.tag} for city: ${city}`);
        } catch (error) {
            logger.error(`Weather command error: ${error.message}`);
            
            if (error.response?.status === 404) {
                return interaction.editReply('❌ Ville non trouvée. Veuillez vérifier l\'orthographe et réessayer.');
            }
            
            interaction.editReply('❌ Une erreur est survenue lors de la récupération des données météorologiques.');
        }
    },
};