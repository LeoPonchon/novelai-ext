# NovelAI Chat + Image (React)

App web React (Create React App) avec :

- Onglet **Personnage** (fiche perso injectée en message système)
- Chat principal (centre)
- Image de scène (droite), régénérée automatiquement à chaque réponse IA

## Démarrer

Dans `novelai-ext/` :

```bash
npm start
```

Ça lance :

- le serveur React sur `http://localhost:3000`
- un proxy Node/Express sur `http://localhost:3001` (évite les soucis CORS)

## Configuration NovelAI

Dans l’onglet **Paramètres** :

- Colle ton **Persistent API Token** (NovelAI → Settings → Account → “Get Persistent API Token”)
- Par défaut l’app utilise :
  - Texte : `glm-4-6`
  - Image : `nai-diffusion-4-5-curated`

Remarque : par simplicité, le token est stocké en `localStorage` côté navigateur. Ne déploie pas ça tel quel en prod.

### Override serveur (optionnel)

Le proxy (`server/index.js`) accepte :

- `NOVELAI_TEXT_BASE_URL` (défaut: `https://text.novelai.net/oa/v1`)
- `NOVELAI_IMAGE_BASE_URL` (défaut: `https://image.novelai.net`)

## Scripts utiles

- `npm start` : serveur + client (dev)
- `npm run start:client` : React uniquement
- `npm run start:server` : proxy uniquement
- `npm test` : tests
