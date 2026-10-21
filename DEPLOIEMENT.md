# Déploiement — Le Manoir des Ombres

Architecture : **jeu statique sur GitHub Pages** (déployé à chaque push sur `main`)
et **backend Supabase gratuit** (base Postgres + Edge Functions). Rien ne tourne sur
votre PC pendant le concours.

```
Navigateur ──► GitHub Pages (index.html, admin.html, js/…)
     │
     └──► https://<ref>.supabase.co/functions/v1/game/…   (public)
          https://<ref>.supabase.co/functions/v1/admin/…  (mot de passe)
                    │  clé service_role (uniquement ici)
                    ▼
               Postgres (RLS activée, aucune policy : le client n'écrit jamais un score)
```

## 1. Créer le projet Supabase (une seule fois)

1. Créez un compte gratuit : <https://supabase.com/dashboard/sign-up> (connexion avec GitHub possible).
2. **New project** → organisation personnelle, plan **Free**.
   - Nom : `manoir-des-ombres`
   - Mot de passe de la base : générez-en un fort et **conservez-le** (gestionnaire de mots de passe).
   - Région : **West EU (Paris)** (la plus proche du Bénin).
3. Notez l'identifiant du projet : *Project Settings → General → Reference ID* (ex. `abcdefghijklmnop`).

## 2. Mettre en ligne la base et les fonctions

Depuis le dossier du projet :

```bash
npm install                                   # installe la CLI Supabase (gratuite)
npx supabase login                            # ouvre le navigateur pour autoriser la CLI
npx supabase link --project-ref <REF>         # demande le mot de passe de la base
npx supabase db push                          # crée les tables, la RLS et les fonctions SQL

# Secrets (jamais dans le code ni dans le front) :
npx supabase secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  ADMIN_PASSWORD='choisissez-un-mot-de-passe-long' \
  ALLOWED_ORIGINS='https://mensahbryan9-source.github.io'

npx supabase functions deploy game --no-verify-jwt
npx supabase functions deploy admin --no-verify-jwt
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions
par Supabase : n'ajoutez **jamais** la clé `service_role` au front.

Vérification :

```bash
curl https://<REF>.supabase.co/functions/v1/game/health
# {"ok":true,"open":true,"end":"2026-10-24T22:59:59.000Z"}
```

## 3. Brancher le jeu sur l'API et publier le front

Dans `js/config.js`, renseignez l'URL des fonctions :

```js
api: { url: 'https://<REF>.supabase.co/functions/v1', forceRemote: false },
```

puis :

```bash
node tools/sync-shared.mjs        # recopie config/barème/niveaux pour les fonctions
npx supabase functions deploy game --no-verify-jwt
npx supabase functions deploy admin --no-verify-jwt
git commit -am "Configurer l'API du concours" && git push
```

Le workflow *Déploiement GitHub Pages* teste le barème, valide les cartes puis publie
le site (≈ 1 min) : <https://mensahbryan9-source.github.io/station-kryos/>.
Page admin : <https://mensahbryan9-source.github.io/station-kryos/admin.html>.

## Modifier les règles

Tout le barème est dans **`js/config.js`** (date de fin, coefficients de difficulté,
points, temps de référence, seuils anti-triche, limites de requêtes). Après une
modification : `node tools/sync-shared.mjs`, redéployer les deux fonctions, puis `git push`.
⚠️ Ne changez pas le barème une fois le concours ouvert : les scores déjà
enregistrés ne seraient plus comparables.

## Après le concours

1. Le classement est figé automatiquement à la date de fin (24/10/2026 23:59, heure de Cotonou).
   Un résultat joué hors ligne est encore accepté pendant 15 minutes s'il a commencé avant.
2. Page admin → vérifiez la partie gagnante (bouton *Détail* : temps réel mesuré par le serveur,
   signalements). Exportez le CSV si besoin.
3. Remettez le lot, puis **Supprimer toutes les données…** (engagement pris dans le formulaire).

## Développement local

```bash
npx supabase start -x studio,realtime,storage-api,imgproxy,mailpit,logflare,vector,supavisor,postgres-meta
printf 'SESSION_SECRET=%s\nADMIN_PASSWORD=test-admin-local-123\n' "$(openssl rand -hex 32)" > supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env
python3 -m http.server 8765        # le jeu utilise automatiquement l'API locale sur localhost
npm test && npm run test:api       # tests du barème puis de l'API
```

## Option : auto-hébergement du front

`docker compose up -d` sert le jeu sur <http://localhost:8080> (le backend reste Supabase).
