# Console locale Class Odyssey

Cette interface est un processus **séparé** du site public. Elle interroge le
backend en HTTPS avec une clé conservée par les deux serveurs : aucune clé ni
aucun mot de passe ne passe dans le navigateur. Le site public ne sert pas les
fichiers `admin-console/`.

## Installation

1. Générer une clé aléatoire : `openssl rand -hex 32`.
2. Sur le VPS, définir `ADMIN_CONSOLE_KEY` avec cette valeur dans
   `/srv/apps/classquest/.env` (ou dans l'environnement de `docker compose`),
   transférer les changements du dépôt (`server/`, `package*.json`, `Dockerfile`,
   `compose.yaml`), puis exécuter `docker compose up -d --build` dans
   `/srv/apps/classquest`. Cette opération nécessite votre accès SSH au VPS.
3. Sur votre ordinateur, copier `.env.console.example` en `.env.console` et
   renseigner la **même clé** dans `ADMIN_CONSOLE_KEY`. Ce fichier est ignoré par
   Git. `CONSOLE_API_URL` doit être l'URL actuelle de l'application :
   `https://www.thomaswunsche.com/classodyssey` tant que le domaine principal
   redirige, puis `https://classodyssey.com` lorsque le site y est servi.
4. Lancer `npm install` puis `npm run console`. Ouvrir
   **http://127.0.0.1:5191**. La console affiche une erreur explicite si le
   backend ou la clé ne sont pas encore déployés.

Pour ouvrir la console aux autres appareils du réseau local, définir
`CONSOLE_HOST=0.0.0.0`, puis ouvrir `http://<IP-LAN-DE-CET-ORDINATEUR>:5191`.
Définir `CONSOLE_ALLOWED_CIDR` pour restreindre les IP clientes au sous-réseau
local (par exemple `192.168.1.0/24`). `127.0.0.1:5191` reste accessible sur
le même ordinateur. Ne pas rediriger ce port depuis le routeur vers Internet.
**Toute personne pouvant ouvrir cette adresse depuis le LAN peut agir en
administrateur**, puisqu'aucun compte local n'est demandé. Par défaut le
serveur n'écoute que sur la boucle locale, et les requêtes de modification
venues d'une autre origine sont refusées.

## Données et limites

- Les comptes inscrits, dates, e-mails, nombres de classes et d'élèves, sessions,
  acceptation des conditions et cinq dernières IP (90 jours) sont issus du
  backend en ligne. Aucun mot de passe ni condensat n'est transmis à la console.
- Une base **GeoLite2 City** au format `.mmdb` peut être placée sur le VPS puis
  montée en lecture seule dans le conteneur (voir `compose.yaml`) avec
  `GEOIP_DB=/geoip/GeoLite2-City.mmdb`. Sans cette base, les IP restent visibles
  mais la localisation est indiquée comme indisponible. Une estimation GeoIP
  n'est pas une position exacte. Aucun appel à un service de géolocalisation
  tiers n'est effectué.
- Les comptes antérieurs à l'installation n'ont pas d'historique IP rétroactif.
  Seules les connexions ultérieures (mot de passe, inscription, Google) sont
  enregistrées. Les IP expirent de la vue après 90 jours.
- Il n'existe pour l'instant aucune donnée de paiement ou d'abonnement dans
  l'application. L'onglet Abonnements l'indique explicitement.
- L'onglet Messages lit `support-messages.json` lorsque « Demander de l’aide »
  est présent sur le site. Il affiche les demandes, leur état et les notes
  internes, ainsi qu'un compteur des messages à lire. En attendant le module
  `server/support.mjs` de la branche paramètres, un adaptateur compatible lit
  et met à jour le même fichier. Répondre ouvre la messagerie locale.
- « Écrire un e-mail » ouvre le logiciel de messagerie local ; la console ne
  prétend pas qu'un e-mail a été envoyé. Une suppression retire le compte, ses
  données de classe et ses sauvegardes applicatives sur le serveur actif ; les
  sauvegardes externes du VPS suivent leur propre politique de rétention.
- Les actions de modération sont conservées dans `data/admin-audit.jsonl`
  (au plus 500 lignes après rotation) avec date, type et identifiant de compte.
  Le compte fondateur ne peut ni être suspendu ni être supprimé par cette console.
