# 🤖 Ely Bot

Bienvenue sur **Ely Bot**, un bot WhatsApp puissant et polyvalent conçu pour offrir une expérience interactive complète.

---

## 👤 Auteur
Ce bot a été créé et est maintenu par **Elysée**.

---

## ✨ Fonctionnalités Principales

### 🧠 Intelligence Artificielle (Multi-IA)
- **Rotation automatique** : OpenRouter, Google Gemini (4 clés), WisdomGate — basculement automatique en cas de limite atteinte.
- **Commandes** : `.ai`, `.ely`, `.meta` pour discuter avec l'IA.
- **Chatbot** : le bot répond quand on le mentionne (`.chatbot on/off`).
- **Réglage d'accès** : `.aionly on/off` (propriétaire) — restreint l'IA au propriétaire, sinon elle est publique.
- **Synthèse Vocale (STT)** : `.stt` — transcription audio en texte.
- **Traduction** : `.translate` multi-langues.

### 📸 Outils & Utilitaires
- **.capture** : capture d'écran d'un site web.
- **.info** : recherche Google en temps réel.
- **.maps** : recherche de lieu.
- **.tts** : texte vers voix.
- **.session** : exporte la session en Base64 (`SESSION_DATA`) pour Render/Vercel (propriétaire uniquement).

### 💻 Développeurs & Code
- **.compile** : exécute du code (C, Python, Java, JavaScript, C++) via l'API Piston.

### 🎮 Divertissement & Jeux
- **.morpion** / **.puissance4** : jeux classiques (avec adversaire IA possible).
- **.pendu** / **.quiz** / **.devine** / **.guess** : jeux interactifs basés sur l'IA.
- **.motgame** : remettez le mot mélangé dans le bon ordre.
- **.pileface** : lance la pièce.
- **.stopgame** : arrête la partie en cours. `.game` : liste des jeux.

### 🎞 Médias & Téléchargement
- **.play** : musique depuis YouTube (avec métadonnées), via yt-dlp.
- **.vlt** : vidéo depuis YouTube.
- **.sticker** / **.toimg** : créer un sticker / le convertir en image.
- **.extract** : récupère tout média cité (dont messages à vue unique).
- **.statusdown** : télécharge le statut auquel vous répondez.

### 👑 Administration
- **Gestion de Groupe** : `.kick`, `.promote`, `.demote`, `.tagall`, `.hidetag`, `.mute`, `.unmute`, `.delete`, `.delgrp`.
- **Protection** : anti-liens (`.antilink`), anti-suppression (`.antidelete`), avertissements (`.warn`).
- **Détection admin fiable** : le bot sait exactement s'il est admin (comparaison par numéro, support des JID `@lid`, métadonnées mises en cache 60 s → réponses rapides).

---

## 🚀 Installation & Déploiement

1. **Cloner le repository** :
   ```bash
   git clone <votre-repo>
   ```
2. **Installer les dépendances** (Node.js 24.x requis) :
   ```bash
   npm install
   ```
3. **Configurer les variables d'environnement** (`.env`) :
   ```bash
   cp .env.example .env
   ```
   - Minimum : une clé IA (`OPENROUTER_KEY` ou `GEMINI_KEY_1`).
   - Hébergement éphémère : ajoutez `SESSION_DATA` (générée avec `.session`).
4. **Lancer le bot** :
   ```bash
   npm start
   ```
5. **Scanner le QR code** (ou utiliser `PAIRING_NUMBER` pour un code de jumelage).

> 💡 `ffmpeg` et `yt-dlp` sont requis pour les stickers et le téléchargement média (installés automatiquement dans le Dockerfile).

---

## 🛠 Support
Pour toute question ou suggestion, contactez l'auteur **Elysée** directement via le bot avec la commande `.menu`.

_Propulsé par Elysée._
