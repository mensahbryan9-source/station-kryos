# STATION KRYOS

FPS rétro en **raycasting**, dans l'esprit des pionniers du genre, avec un univers et des visuels 100 % originaux.
Tout (textures, sprites, armes, sons, musique, icônes) est **généré par le code** : aucune ressource externe.

▶ **Jouer en ligne : https://mensahbryan9-source.github.io/station-kryos/**

## L'histoire

La station minière KRYOS, en orbite d'une lune de glace, ne répond plus. Ses automates ont été réécrits par
une intelligence hostile : **l'Archonte**. Traversez trois secteurs — le quai d'amarrage, les laboratoires
cryogéniques et le cœur du réacteur — pour la détruire.

## Fonctionnalités

- Moteur raycasting logiciel : murs, sol et plafond texturés, brouillard, pixels émissifs, éclair des tirs
- Portes coulissantes (dont portes verrouillées par cartes bleue/rouge), murs secrets à pousser
- 4 types d'ennemis avec IA (vision, ouïe, poursuite par champ de distances, ouverture des portes) + boss qui invoque des renforts
- 5 armes (lame, pistolet, fusil plasma, fusil à dispersion, canon à arc perforant), barils explosifs en chaîne
- 3 niveaux, objets (soins, armure, munitions, cartes, cristaux), statistiques de fin de niveau
- HUD avec moniteur cardiaque, mini-carte et carte complète, indicateur de direction des dégâts
- Sons et musique générative synthétisés avec Web Audio (spatialisation stéréo)
- Menus, difficulté, options, pause, écran de victoire, sauvegarde de la progression
- Clavier/souris (AZERTY et QWERTY), tactile (joystick + visée au glisser), manette
- PWA installable, fonctionne hors connexion

## Lancer en local

```bash
# avec Docker (image publiée automatiquement)
docker run -d --name kryos -p 8080:80 --restart unless-stopped ghcr.io/mensahbryan9-source/station-kryos:latest

# ou en construisant l'image
docker build -t station-kryos . && docker run -d -p 8080:80 station-kryos

# ou sans Docker
python3 -m http.server 8080
```

Puis ouvrir http://localhost:8080.

## Développement

- `node tools/validate-levels.mjs` — vérifie les cartes (bordures, portes, accès aux clés et à la sortie)
- `node tools/make-icons.mjs` — régénère les icônes
- Les niveaux sont des cartes ASCII dans `js/levels.js` (légende en tête de fichier)

## Licence

MIT
