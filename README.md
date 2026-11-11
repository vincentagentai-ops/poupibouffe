# Poupibouffe

Les 7 dîners de la semaine pour la maison : des menus de saison qu'on change d'un clic, la recette de chaque plat (imprimable) et la liste de courses de toute la semaine, triée par rayon.

La page **Recettes** (`#recettes`) permet de chercher dans tout le catalogue (par nom, ingrédient ou étiquette), de modifier une recette, d'en ajouter une avec sa photo, d'en supprimer, et de revenir à l'original.

Le menu, le nombre de couverts, les cases cochées de la liste de courses et les recettes modifiées sont enregistrés sur le PC : tous les appareils de la maison voient la même chose.

## Ouvrir le site

Depuis n'importe quel appareil connecté au Wi-Fi de la maison :

- http://192.168.68.107:8420 : marche partout, à ajouter à l'écran d'accueil des téléphones
- ou http://probook.local:8420 sur les ordinateurs (Android 12 et d'autres ne comprennent pas les noms en `.local`)

Si l'adresse IP du PC change (box redémarrée), la retrouver avec `hostname -I`. Pour qu'elle ne change plus, la réserver au PC dans les réglages DHCP du routeur.

Le pare-feu du PC (ufw) doit laisser entrer le port 8420 depuis le réseau de la maison, sinon les appareils en Wi-Fi n'ont pas de réponse (ceux qui passent par Tailscale, eux, passent) :

```bash
sudo ufw allow from 192.168.68.0/22 to any port 8420 proto tcp comment 'Poupibouffe'
```

## Comment ça tourne

- `server.js` (Node, sans dépendance) sert le site construit dans `dist/` et l'API (`/api/etat`, `/api/recettes`, `/api/photos`), sur le port 8420 de toutes les interfaces.
- Les données partagées sont dans `data/` (non versionné) : `etat.json` pour le menu, `recettes.json` pour les recettes modifiées, ajoutées ou supprimées depuis le site, `photos/` pour leurs photos. Pour tout remettre à zéro, arrêter le service et supprimer `data/recettes.json`.
- Un service systemd utilisateur le lance au démarrage du PC, même sans session ouverte :
  `~/.config/systemd/user/poupibouffe.service`.

```bash
systemctl --user status poupibouffe      # état
systemctl --user restart poupibouffe     # après une mise à jour
journalctl --user -u poupibouffe -n 50   # journaux
```

## Mettre à jour le site

```bash
npm test
npm run build
systemctl --user restart poupibouffe
```

## Développer

```bash
npm install
npm start      # serveur maison (API) sur le port 8420
npm run dev    # Vite avec rechargement à chaud ; /api est relayé vers le port 8420
```

## Organisation

| Fichier | Rôle |
| --- | --- |
| `src/recettes.js` | Les 146 recettes de base (pour 4 personnes) et la semaine par défaut |
| `src/catalogue.js` | Catalogue modifiable : fusion avec les modifications, validation d'une recette |
| `src/editeur.js` | Page Recettes : recherche, édition, ajout, suppression |
| `src/quantites.js` | Mise à l'échelle selon les couverts, unités et pluriels |
| `src/courses.js` | Liste de courses : additionne les ingrédients de la semaine par rayon |
| `src/main.js` | Interface, impression, synchronisation avec le serveur |
| `public/plats/` | Une photo par plat (`<id>.jpg`, 800×600) et leurs crédits (`CREDITS.md`) |
| `server.js` | Serveur maison et API |
| `test/` | Tests `node --test` |

Le plus simple pour ajouter une recette est la page Recettes du site. Pour l'ajouter au catalogue de base, l'écrire dans `src/recettes.js` (quantités pour 4, rayon parmi ceux de `RAYONS`), ajouter sa photo `public/plats/<id>.jpg` (et son crédit), puis `npm test` et `npm run build`.

## Sources

- 59 recettes sont traduites et adaptées des recettes de [TheMealDB](https://www.themealdb.com/), et regroupées à la fin de `src/recettes.js`.
- 46 recettes sont adaptées (pour 4 personnes, en cuisine de maison) des [Recettes de chefs pour professionnels](https://www.data.gouv.fr/datasets/recettes-de-chefs-pour-professionnels/) de METRO France, publiées sous Licence Ouverte 2.0. Elles sont regroupées dans `src/recettes.js`.
- Les photos viennent de Wikimedia Commons ; auteurs et licences dans `public/plats/CREDITS.md`.
