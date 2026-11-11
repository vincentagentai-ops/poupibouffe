# Poupibouffe

Les 7 dîners de la semaine pour la maison : des menus de saison qu'on change d'un clic, la recette de chaque plat (imprimable) et la liste de courses de toute la semaine, triée par rayon.

Le menu, le nombre de couverts et les cases cochées de la liste de courses sont enregistrés sur le PC : tous les appareils de la maison voient la même semaine.

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

- `server.js` (Node, sans dépendance) sert le site construit dans `dist/` et l'API `/api/etat`, sur le port 8420 de toutes les interfaces.
- L'état partagé est dans `data/etat.json` (non versionné).
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
| `src/recettes.js` | Les 21 recettes (pour 4 personnes) et la semaine par défaut |
| `src/quantites.js` | Mise à l'échelle selon les couverts, unités et pluriels |
| `src/courses.js` | Liste de courses : additionne les ingrédients de la semaine par rayon |
| `src/main.js` | Interface, impression, synchronisation avec le serveur |
| `server.js` | Serveur maison et API `/api/etat` |
| `test/` | Tests `node --test` |

Pour ajouter une recette, l'écrire dans `src/recettes.js` (quantités pour 4, rayon parmi ceux de `RAYONS`), puis `npm test` et `npm run build`.
