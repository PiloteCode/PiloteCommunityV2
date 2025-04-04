// src/events/monitoringButtons.js
import { Events } from 'discord.js';
import monitorManager from '../utils/monitorManager.js';
import premiumManager from '../utils/premiumManager.js';
import { executeQuery } from '../database/manager.js';

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // Gérer les boutons de monitoring
      if (interaction.isButton()) {
        const customId = interaction.customId;
        
        // Rafraîchir le dashboard
        if (customId === 'refresh_dashboard') {
          // Trouver la commande de dashboard
          const dashboardCommand = interaction.client.commands.get('dashboard');
          if (dashboardCommand) {
            await interaction.deferUpdate();
            await dashboardCommand.execute(interaction);
          }
        }
        
        // Rafraîchir la liste des monitors
        else if (customId === 'refresh_monitors') {
          // Trouver la commande de liste des monitors
          const monitorListCommand = interaction.client.commands.get('monitor-list');
          if (monitorListCommand) {
            await interaction.deferUpdate();
            await monitorListCommand.execute(interaction);
          }
        }
        
        // Vérifier tous les monitors
        else if (customId === 'check_all_monitors') {
          // Trouver la commande de vérification des monitors
          const monitorCheckCommand = interaction.client.commands.get('monitor-check');
          if (monitorCheckCommand) {
            await interaction.deferUpdate();
            await monitorCheckCommand.execute(interaction);
          }
        }
        
        // Démarrer un monitor
        else if (customId.startsWith('start_monitor_')) {
          await interaction.deferUpdate();
          
          const monitorId = customId.replace('start_monitor_', '');
          const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
          
          if (!monitor) {
            return interaction.followUp({
              content: '❌ Monitor introuvable.',
              ephemeral: true
            });
          }
          
          // Vérifier si l'utilisateur est le propriétaire du monitor
          if (monitor.user_id !== interaction.user.id) {
            return interaction.followUp({
              content: '❌ Vous n\'êtes pas le propriétaire de ce monitor.',
              ephemeral: true
            });
          }
          
          // Démarrer le monitor
          await monitorManager.startMonitor(monitorId);
          
          return interaction.followUp({
            content: `✅ Le monitor "${monitor.name}" a été démarré avec succès.`,
            ephemeral: true
          });
        }
        
        // Arrêter un monitor
        else if (customId.startsWith('stop_monitor_')) {
          await interaction.deferUpdate();
          
          const monitorId = customId.replace('stop_monitor_', '');
          const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
          
          if (!monitor) {
            return interaction.followUp({
              content: '❌ Monitor introuvable.',
              ephemeral: true
            });
          }
          
          // Vérifier si l'utilisateur est le propriétaire du monitor
          if (monitor.user_id !== interaction.user.id) {
            return interaction.followUp({
              content: '❌ Vous n\'êtes pas le propriétaire de ce monitor.',
              ephemeral: true
            });
          }
          
          // Arrêter le monitor
          await monitorManager.stopMonitor(monitorId);
          
          return interaction.followUp({
            content: `✅ Le monitor "${monitor.name}" a été arrêté avec succès.`,
            ephemeral: true
          });
        }
        
        // Vérifier un monitor spécifique
        else if (customId.startsWith('check_monitor_')) {
          await interaction.deferUpdate();
          
          const monitorId = customId.replace('check_monitor_', '');
          const monitor = await monitorManager.getMonitor(monitorId).catch(() => null);
          
          if (!monitor) {
            return interaction.followUp({
              content: '❌ Monitor introuvable.',
              ephemeral: true
            });
          }
          
          // Vérifier si l'utilisateur est le propriétaire du monitor ou un admin
          if (monitor.user_id !== interaction.user.id && !interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.followUp({
              content: '❌ Vous n\'avez pas l\'autorisation de vérifier ce monitor.',
              ephemeral: true
            });
          }
          
          // Effectuer la vérification
          const result = await monitorManager.checkMonitor(monitorId);
          
          return interaction.followUp({
            content: `✅ Vérification de "${monitor.name}" effectuée: ${result.status === 'up' ? '🟢 En ligne' : '🔴 Hors ligne'} - ${result.message || 'Aucun message'}`,
            ephemeral: true
          });
        }
      }
      
      // Gérer l'autocomplétion pour les commandes de monitoring
      else if (interaction.isAutocomplete()) {
        const commandName = interaction.commandName;
        const focusedOption = interaction.options.getFocused(true);
        const focusedValue = focusedOption.value.toLowerCase();
        
        // Autocomplétion pour les IDs de monitors
        if (commandName.startsWith('monitor-') || commandName === 'stats' || commandName === 'alert-create') {
          if (focusedOption.name === 'id' || focusedOption.name === 'monitor_id') {
            // Récupérer les monitors de l'utilisateur
            const monitors = await monitorManager.getUserMonitors(interaction.user.id);
            
            // Filtrer les monitors selon la valeur saisie
            const filtered = monitors
              .filter(monitor => 
                monitor.name.toLowerCase().includes(focusedValue) || 
                monitor.monitor_id.includes(focusedValue)
              )
              .map(monitor => ({
                name: `${monitor.name} (${monitor.type}) - ${monitorManager.formatStatus(monitor.status)}`,
                value: monitor.monitor_id
              }));
            
            await interaction.respond(filtered.slice(0, 25));
          }
        }
        
        // Autocomplétion pour les IDs d'alertes
        else if (commandName === 'alert-delete' || commandName === 'alert-update') {
          if (focusedOption.name === 'alert_id') {
            // Récupérer tous les monitors de l'utilisateur
            const monitors = await monitorManager.getUserMonitors(interaction.user.id);
            
            if (monitors.length === 0) {
              await interaction.respond([]);
              return;
            }
            
            // Récupérer toutes les alertes pour ces monitors
            let allAlerts = [];
            
            for (const monitor of monitors) {
              const alerts = await monitorManager.getMonitorAlerts(monitor.monitor_id);
              allAlerts = allAlerts.concat(alerts.map(alert => ({
                ...alert,
                monitorName: monitor.name
              })));
            }
            
            // Filtrer les alertes selon la valeur saisie
            const filtered = allAlerts
              .filter(alert => 
                alert.alert_id.includes(focusedValue) || 
                alert.alert_type.toLowerCase().includes(focusedValue) ||
                alert.monitorName.toLowerCase().includes(focusedValue)
              )
              .map(alert => ({
                name: `${alert.alert_type === 'channel' ? 'Canal' : 'Webhook'} pour ${alert.monitorName}`,
                value: alert.alert_id
              }));
            
            await interaction.respond(filtered.slice(0, 25));
          }
        }
        
        // Autocomplétion pour les IDs de fonctionnalités premium
        else if (commandName === 'premium-purchase') {
          if (focusedOption.name === 'feature_id') {
            // Récupérer toutes les fonctionnalités premium
            const features = await premiumManager.getAllFeatures();
            
            // Filtrer les fonctionnalités selon la valeur saisie
            const filtered = features
              .filter(feature => 
                feature.name.toLowerCase().includes(focusedValue) || 
                feature.feature_id.includes(focusedValue) ||
                feature.description.toLowerCase().includes(focusedValue)
              )
              .map(feature => ({
                name: `${feature.name} (${feature.price}💵)`,
                value: feature.feature_id
              }));
            
            await interaction.respond(filtered.slice(0, 25));
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du traitement de l\'interaction de monitoring:', error);
      
      // Répondre à l'utilisateur en cas d'erreur
      try {
        const errorMessage = {
          content: `❌ Une erreur est survenue: ${error.message}`,
          ephemeral: true
        };
        
        if (interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } catch (replyError) {
        console.error('❌ Erreur lors de la réponse d\'erreur:', replyError);
      }
    }
  }
};
