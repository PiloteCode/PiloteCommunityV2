# PiloteCommunity Bot

Un bot Discord communautaire pour Pilote Production avec un système d'économie virtuelle et des événements aléatoires.

## Fonctionnalités

- **Système d'économie** : Gagnez et dépensez des crédits virtuels
- **Boutique** : Achetez des objets avec vos crédits
- **Inventaire** : Gérez et utilisez vos objets
- **Système de niveau** : Gagnez de l'XP et montez en niveau
- **Événements aléatoires** : Des événements surprises apparaissent dans le chat
- **Mini-jeux** : Participez à des jeux comme le pile ou face

## Installation

### Prérequis

- Node.js v18 ou supérieur
- npm
- Un bot Discord avec un token

### Configuration

1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/PiloteProduction/PiloteCommunityV2.git
   cd PiloteCommunityV2
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Copiez le fichier `.env.example` vers `.env` et remplissez-le avec vos informations :
   ```bash
   cp .env.example .env
   ```

4. Remplissez le fichier `.env` avec :
   - `BOT_TOKEN` : Le token de votre bot Discord
   - `CLIENT_ID` : L'ID client de votre application Discord
   - `GUILD_ID` : L'ID de votre serveur Discord (pour le développement)

### Démarrage

1. Démarrez le bot :
   ```bash
   npm start
   ```

   Pour le développement avec rechargement automatique :
   ```bash
   npm run dev
   ```

   Note: Les commandes slash sont automatiquement synchronisées au démarrage du bot. Vous pouvez configurer si elles sont déployées globalement ou seulement sur un serveur spécifique en modifiant la variable `SYNC_GLOBAL` dans le fichier `.env`.

## Structure du projet

- `src/` - Code source du bot
  - `commands/` - Commandes slash (organisées par catégorie)
  - `events/` - Gestionnaires d'événements Discord
  - `components/` - Gestionnaires de composants (boutons, menus, etc.)
  - `utils/` - Utilitaires et fonctions helpers
  - `database/` - Gestion de la base de données SQLite

## Commandes disponibles

### Économie
- `/work` - Travailler pour gagner des crédits
- `/daily` - Réclamer votre récompense quotidienne
- `/weekly` - Réclamer votre récompense hebdomadaire
- `/balance` - Vérifier son solde
- `/shop` - Afficher la boutique
- `/buy` - Acheter un objet
- `/inventory` - Afficher son inventaire
- `/use` - Utiliser un objet
- `/give` - Donner des crédits à un autre membre
- `/coinflip` - Jouer à pile ou face

### Utilitaires
- `/profile` - Afficher son profil
- `/leaderboard` - Afficher le classement
- `/help` - Afficher l'aide

## Événements aléatoires

Le bot génère aléatoirement des événements dans le chat, comme :
- **Météorite** - Soyez le premier à la récupérer
- **Quiz** - Répondez correctement à une question
- **Duel** - Affrontez un autre membre

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.