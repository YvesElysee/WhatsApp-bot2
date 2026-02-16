# 🤖 WhatsApp Bot - Guide d'Installation

Ce bot WhatsApp inclut :
- 🧠 **IA** (Chat & Défis)
- 🎵 **Musique** (YouTube Play)
- 🎨 **Stickers** (Image en Sticker)
- 🎤 **Effets Vocaux** (Chipmunk)
- ⚙️ **Admin** (Gestion de groupe)
- 🌐 **Traduction**

## 🚀 Installation Locale

1. **Prérequis** : Node.js installé.
2. **Configuration** :
   - Modifiez `config.js` si nécessaire (numéro propriétaire).
   - Créez un fichier `.env` si vous voulez utiliser le Code de Connexion (Pairing Code) au lieu du QR Code.
     ```
     PAIRING_NUMBER=237699999999
     ```
3. **Lancer** :
   Ouvrez un terminal dans le dossier et lancez :
   ```bash
   npm start
   ```
   *Si ça ne marche pas, essayez `node index.js`.*

## ☁️ Déploiement sur Render

1. Créez un compte sur [Render](https://render.com).
2. Créez un **New Web Service**.
3. Connectez votre dépôt GitHub (contenant ce code).
4. Render détectera le `Dockerfile`.
5. Ajoutez les variables d'environnement (Environment Variables) dans Render :
   - `PAIRING_NUMBER` : Votre numéro (ex: 237xxxxxxxxx) si vous ne pouvez pas scanner le QR code.
6. Lancez le déploiement.
7. Consultez les "Logs" de Render pour voir le QR Code ou le Code de Connexion.

## 📝 Commandes Principales

- `.menu` : Affiche toutes les commandes.
- `.play [titre]` : Télécharge une musique.
- `.sticker` : Répondez à une image pour créer un sticker.
- `.ai [question]` : Posez une question à l'IA.
- `.truth` / `.dare` : Action ou Vérité.

## ⚠️ Note Importante
Pour que les stickers et l'audio fonctionnent, `ffmpeg` doit être installé.  
- Sur Render : C'est automatique grâce au Dockerfile.
- Sur Windows (Local) : Vous devez installer [ffmpeg](https://ffmpeg.org/download.html) et l'ajouter à votre PATH.
