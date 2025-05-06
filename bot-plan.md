# Plan du Bot PiloteCommunity

## Fonctionnalités d'économie

### Monnaie et Gains
- `/work` - Travailler pour gagner des crédits (cooldown: 1h)
- `/daily` - Récompense quotidienne (cooldown: 24h)
- `/weekly` - Récompense hebdomadaire (cooldown: 7j)
- `/balance` - Vérifier son solde de crédits

### Système de niveau
- XP gagné avec commandes `/work` et interactions
- Niveaux débloquant de nouvelles fonctionnalités
- `/profile` - Affiche niveau, XP, statistiques et badges

### Magasin et items
- `/shop` - Afficher les objets disponibles à l'achat
- `/buy` - Acheter un objet
- `/use` - Utiliser un objet de l'inventaire
- `/inventory` - Consulter son inventaire

### Mini-jeux avec paris
- `/blackjack` - Jouer au blackjack contre le bot
- `/dice` - Lancer des dés avec des paris
- `/coinflip` - Pile ou face avec paris
- `/slots` - Machine à sous avec différents symboles et multiplicateurs

### Système social
- `/give` - Donner des crédits à un autre membre
- `/leaderboard` - Classement des membres par fortune/niveau
- `/rob` - Tenter de voler un membre (avec risque d'échec et amende)

## Événements aléatoires dans le chat

### Types d'événements
- **Météorite** - Un message apparaît, premier à cliquer gagne des crédits
- **Duel** - Deux membres aléatoires sont sélectionnés pour un duel (click battle)
- **Quiz** - Question à choix multiple avec récompense
- **Chasseur de prime** - Mission pour gagner un bonus
- **Loterie surprise** - Participer avec un montant fixe pour gagner le jackpot

### Temporalité
- Événements déclenchés après un certain nombre de messages
- Probabilité d'événement configurable
- Horaires de forte activité avec plus d'événements

## Sécurité et prévention d'exploits

### Anti-duplication
- Suivi des états dans la base de données
- Vérification des timestamps pour les commandes
- Limitation de rate pour les commandes d'économie
- Débouncing des boutons d'interaction

### Transactions
- Journalisation de toutes les transactions (gains, pertes, transferts)
- Système de rollback en cas d'erreur
- Alertes sur transactions suspicieuses (gains trop rapides)

### Protection base de données
- Transactions SQL pour assurer l'intégrité des données
- Sauvegardes automatiques
- Système de migration pour mises à jour

## Structure technique

### Base de données
- Tables pour: users, inventory, shop_items, transactions, events, cooldowns
- Indexes pour optimiser les requêtes fréquentes

### Architecture modularisée
- Handlers séparés pour commandes, événements et interactions
- Managers distincts pour économie, événements et cooldowns
- Utils pour fonctions réutilisables et constantes

### Interface utilisateur
- Embeds Discord stylisés et cohérents
- Composants interactifs (boutons, sélecteurs)
- Pagination pour les longues listes
- Avatars et images dynamiques