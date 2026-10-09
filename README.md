# Séjour — Gestion de locations saisonnières

Une première application web en français pour un gestionnaire de locations saisonnières. Interface adaptée aux ordinateurs et aux téléphones.

## Ce que vous pouvez faire

- **Logements** : ajouter, modifier et supprimer une adresse, sa capacité, son tarif par nuit et ses notes.
- **Voyageurs** : conserver les coordonnées, les notes et retrouver les réservations d’un voyageur.
- **Réservations** : choisir un logement et un voyageur, saisir les dates et le montant total, suivre le statut. Les réservations confirmées et à confirmer bloquent les dates. Un départ et une arrivée le même jour sont autorisés.
- **Ménages** : chaque réservation non annulée crée une intervention au départ. Attribuer un responsable, modifier la date et suivre le statut. Des interventions ponctuelles sont également possibles.
- **Revenus** : enregistrer les paiements reçus et consulter le montant réservé, les encaissements et les soldes. Filtrer par mois ; les réservations sont rattachées au mois d’arrivée, les encaissements au mois du paiement.
- **Vue d’ensemble** : consulter les séjours à venir, les séjours en cours, les logements occupés, les ménages et les encaissements.

## Démonstration avec des exemples

La démonstration comporte trois logements, six voyageurs, six séjours (passé, en cours, à venir, à confirmer et annulé), les ménages associés et trois paiements. Tout est fictif et signalé dans l’interface.

La commande `npm run demo` prépare puis démarre cette version. Elle utilise une base séparée (`data/demo.sqlite`) et conserve les modifications lors des redémarrages. Elle ne modifie pas la base normale `data/rentals.sqlite`. Un aperçu interactif dans un navigateur extérieur exige toujours un accès au serveur : ce dépôt ne fournit pas de lien hébergé.

## Votre premier parcours

1. Cliquez sur **Ajouter mon premier logement** et remplissez sa fiche.
2. Ouvrez **Voyageurs** et ajoutez les coordonnées d’un voyageur.
3. Ouvrez **Réservations** et créez son séjour. Saisissez le montant total, frais inclus : le tarif du logement sert de référence, aucun calcul automatique du prix n’est appliqué.
4. Dans **Ménages**, retrouvez l’intervention créée au départ et attribuez-la à une personne.
5. Dans **Revenus**, enregistrez un paiement déjà reçu. L’application ne prélève pas le voyageur.

Les données sont sauvegardées automatiquement. Les suppressions demandent confirmation. Un logement ou un voyageur utilisé ne peut pas être supprimé. Avant d’annuler une réservation payée, remboursez le voyageur hors de l’application puis supprimez les paiements concernés. Cette version ne gère pas de registre distinct des remboursements.

## Choix techniques

- **Next.js, React et TypeScript** : l’interface et le serveur dans un même projet.
- **SQLite**, intégré à **Node.js 24** : une base locale persistante sans service supplémentaire à installer. Les montants sont enregistrés en centimes pour éviter les erreurs d’arrondi.
- **PostgreSQL et Prisma** pourront être introduits pour une version hébergée avec plusieurs utilisateurs. Cette première version utilise directement SQLite pour simplifier son installation ; elle ne nécessite pas Prisma.

Les données sont dans `data/rentals.sqlite`, exclu de Git. Le chemin peut être changé avec `RENTAL_DB_PATH`. Aucun compte externe, aucune clé API et aucune synchronisation Airbnb/Booking ne sont nécessaires.

## Voir l’application sur votre Mac, sans hébergement

1. Installez **Node.js 24 LTS** depuis https://nodejs.org/en/download en choisissant l’installateur macOS (`.pkg`).
2. Sur GitHub, sélectionnez la branche `sejour-premiere-version`, puis **Code → Download ZIP**. Décompressez le fichier téléchargé.
3. Ouvrez **Terminal** (Applications → Utilitaires) et saisissez les commandes suivantes si le dossier est dans Téléchargements :

```sh
cd ~/Downloads/1-Projet-sejour-premiere-version
npm ci
npm run dev -- --hostname 127.0.0.1
```

4. Attendez le message « Ready », puis saisissez `http://localhost:3000` dans Safari ou Chrome sur votre Mac. Le serveur tourne sur votre ordinateur ; le site n’est pas hébergé sur Internet.
5. Gardez Terminal ouvert pendant l’utilisation. Pour arrêter l’application, appuyez sur Ctrl+C. Pour la rouvrir, retournez dans le dossier et exécutez à nouveau la dernière commande.

Cette installation part avec une base vide. Commencez par **Ajouter mon premier logement**. Vos données sont sauvegardées dans le dossier `data/` de votre copie locale.

## Démarrer pour développer

Prérequis : Node.js 24 et npm.

```sh
cd /workspace/1-Projet
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev
```

Le serveur utilise le port 3000. Pour arrêter le serveur lancé dans votre terminal, utilisez Ctrl+C. Chaque tâche cloud possède déjà son environnement isolé : utilisez ce dépôt existant, sans créer de worktree.

## Vérifier et lancer la version compilée

```sh
npm run test
npm run build
npm run start
```

La commande `npm run typecheck` vérifie les types sans recompiler l’application.

### Tests avec un navigateur

Après `npm run build` :

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Si Chromium n’est pas installé à cet emplacement, installez celui de Playwright avec `npx playwright install chromium`, puis exécutez `npm run test:e2e` sans `CHROMIUM_PATH`.

Les tests démarrent leur propre serveur sur le port 3100 et utilisent une base temporaire, distincte des données de l’application. Ils vérifient le parcours complet, le refus des doubles réservations, l’affichage mobile, la persistance après rechargement et la protection des mutations contre une autre origine. Des captures d’écran sont générées dans `test-results/`.

## Organisation

```text
src/app/                 Page principale, styles et API
src/components/          Interface des cinq espaces et tableau de bord
src/lib/store.ts         Base SQLite, validation et règles de gestion
tests/store.test.ts     Tests des réservations, paiements et persistance
tests/e2e/              Parcours utilisateur dans Chromium
```

## Données et mise en ligne

Cette version est prévue pour un environnement de développement privé et un seul gestionnaire. Elle n’a pas encore de connexion utilisateur. N’exposez pas le service publiquement avec des coordonnées réelles de voyageurs : la prochaine étape de mise en ligne doit ajouter l’authentification, les droits d’accès, l’hébergement durable et les sauvegardes.

Pour sauvegarder manuellement cette version locale, arrêtez le serveur et copiez l’intégralité du dossier `data/` dans un emplacement privé. Pour restaurer, arrêtez le serveur, préservez le dossier actuel et remettez la sauvegarde dans `data/` avant de redémarrer. Le dossier de données ne doit jamais être ajouté à Git.
