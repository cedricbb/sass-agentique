# Guide de test manuel R9 — Admin + Customer

## Préambule

**Objectif** : valider bout-en-bout les parcours admin et customer du MVP avant le refactor R10 (entreprise/contact) et le refresh UI R9-3 à R9-7. Identifier les frictions concrètes et les bugs bloquants.

**Périmètre** : interface web uniquement (pas d'API directe). Couvre les zones sans couverture e2e Playwright identifiées lors de l'audit R9-1.

**Durée estimée** : 2–3 heures (Section A ~45 min, Section B ~45 min, Section C ~45 min, consolidation ~15 min).

**Mode d'emploi** :
- `☐` = non testé
- `☑` = OK (remplacer `☐` par `☑`)
- `✗` = KO (remplacer `☐` par `✗`, noter dans Section D et/ou E)
- Remplir le champ **Frictions** librement : latence perçue, libellés confus, manques UX, comportements inattendus.
- En cas de bug bloquant (impossibilité de continuer le parcours), reporter immédiatement en Section E et passer à l'étape suivante si possible.

**Prérequis avant de commencer** :
- Application lancée en local (`pnpm dev`) ou en staging.
- Compte admin disponible (email + mot de passe).
- Client de messagerie accessible ou logs console visibles pour récupérer les emails (si `EMAIL_PROVIDER=console`).
- Navigateur en mode incognito disponible pour simuler le parcours customer (séparation de session).

**Données de test suggérées** :
- Nom client : `Client Test R9`
- Email client : une adresse email accessible ou boîte jetable
- Montant devis : 3 items × 100 € HT

---

## Section A — Parcours admin nominal

> Parcours séquentiel obligatoire. Chaque étape dépend de la précédente. Ne pas sauter d'étape.

### A1 — Connexion admin

- **Action** : naviguer vers `/`, cliquer sur "Se connecter", saisir les identifiants admin, soumettre.
- **URL** : `/admin` après redirection
- **Résultat attendu** : redirection vers le dashboard admin, header avec nom de l'admin visible, aucune erreur 401/403.
- ☑ OK
- **Frictions** : N/A

### A2 — Création client

- **Action** : naviguer vers `/admin/clients`, cliquer "Nouveau client", remplir le formulaire (name: `Client Test R9`, type: `company`, email, phone, address, notes), soumettre.
- **URL** : `/admin/clients/new`
- **Résultat attendu** : redirection vers la fiche client créée (`/admin/clients/[id]`), toutes les infos saisies affichées correctement, slug auto-généré visible.
- ✗ OK
- **Frictions** : Redirection vers /admin/clients au lieu de /admin/client/[id], a la creation slug obligatoire non auto genéré, blocage création si pas renseigné

### A3 — Création devis avec items

- **Action** : depuis la fiche client, naviguer vers la création d'un devis (ou `/admin/quotes/new?clientId=...`), ajouter 3 lignes de prestation (quantité, prix unitaire, description), saisir une date d'expiration, enregistrer en brouillon.
- **URL** : formulaire de création devis
- **Résultat attendu** : devis créé en statut `draft`, total HT et TTC calculés correctement, devis visible dans la liste des devis du client.
- ☑ OK
- **Frictions** : N/A

### A4 — Envoi devis (draft → sent)

- **Action** : depuis la fiche du devis en statut `draft`, déclencher l'action "Envoyer le devis" (`transitionQuoteStatusAction` vers `sent`).
- **URL** : `/admin/quotes/[id]`
- **Résultat attendu** : statut passe à `sent`, badge mis à jour, email `quote.sent` envoyé (vérifier console ou boîte mail), bouton "Envoyer" désactivé ou remplacé.
- ☑ OK
- **Frictions** : N/A

### A5 — Acceptation devis (sent → accepted)

- **Action** : depuis la fiche du devis en statut `sent`, déclencher l'action "Marquer comme accepté" (`transitionQuoteStatusAction` vers `accepted`). Si l'action n'est pas accessible côté admin, simuler côté customer (Section C) puis revenir ici.
- **URL** : `/admin/quotes/[id]`
- **Résultat attendu** : statut passe à `accepted`, badge mis à jour, bouton "Convertir en facture" devient disponible.
- ☑ OK
- **Frictions** : N/A

### A6 — Conversion devis → facture

- **Action** : depuis la fiche du devis en statut `accepted`, cliquer "Convertir en facture" (`createInvoiceFromQuoteAction`).
- **Prérequis** : le devis doit être en statut `accepted` (étape A5 validée).
- **URL** : `/admin/quotes/[id]`
- **Résultat attendu** : facture créée en statut `draft` avec les mêmes items que le devis, redirection vers la fiche facture ou notification de succès, lien vers la facture visible depuis le devis.
- ✗ OK
- **Frictions** : Pas de lien vers la facture depuis la page du devis

### A7 — Envoi facture (draft → sent)

- **Action** : depuis la fiche de la facture en statut `draft`, déclencher "Envoyer la facture" (`transitionInvoiceStatusAction` vers `sent`).
- **URL** : `/admin/invoices/[id]`
- **Résultat attendu** : statut passe à `sent`, email `invoice.sent` envoyé (vérifier console ou boîte mail), date d'échéance visible.
- ✗ OK
- **Frictions** : Pas d'email envoyé, pas d'email reçu sur mailhog, pas de message en console

### A8 — Enregistrement paiement

- **Action** : depuis la fiche de la facture en statut `sent`, enregistrer un paiement (montant total, date, méthode de paiement), confirmer.
- **URL** : `/admin/invoices/[id]`
- **Résultat attendu** : statut de la facture passe à `paid`, montant encaissé mis à jour, paiement visible dans l'historique de la facture et dans les métriques dashboard.
- ☑ OK
- **Frictions** : N/A

### A9 — Vérification état global client

- **Action** : naviguer vers la fiche client (`/admin/clients/[id]`), consulter l'historique devis/factures/paiements rattachés.
- **URL** : `/admin/clients/[id]`
- **Résultat attendu** : devis `accepted`, facture `paid`, paiement enregistré visibles dans la fiche. Montants cohérents.
- ☑ OK
- **Frictions** : N/A

### A10 — Vérification emails envoyés

- **Action** : consulter la boîte mail de test (ou logs console si `EMAIL_PROVIDER=console`), vérifier la présence des 2 emails métier : `quote.sent` et `invoice.sent`.
- **URL** : boîte mail externe ou terminal
- **Résultat attendu** : 2 emails reçus, contenu lisible (nom client, montant, lien vers le portail customer), mise en forme correcte.
- ☑ OK
- **Frictions** : N/A

---

## Section B — Parcours admin spécifiques (zones sans e2e)

> Ces zones n'ont aucune couverture Playwright. Tester chaque action individuellement.

---

**B1 — Dashboard `/admin`**

### B1.1 — StatCards : vérification des métriques

- **Action** : naviguer vers `/admin`, observer les 6 StatCards (Clients, Projets actifs, CA facturé TTC, CA encaissé, Devis en attente, Factures impayées). Après le parcours nominal (Section A validée), vérifier que CA encaissé reflète le paiement enregistré.
- **URL** : `/admin`
- **Résultat attendu** : les 6 cartes s'affichent sans erreur, les valeurs numériques sont cohérentes avec les données créées en Section A (≥1 client, ≥1 facture payée, CA encaissé > 0).
- ☑ OK
- **Frictions** : N/A

### B1.2 — Graphiques : MonthlyRevenueChart et InvoiceStatusBreakdownChart

- **Action** : depuis `/admin`, faire défiler jusqu'aux graphiques, vérifier l'affichage des deux charts (revenu mensuel + répartition statuts factures). Survoler les données pour tester les tooltips.
- **URL** : `/admin`
- **Résultat attendu** : les deux graphiques s'affichent (pas de zone vide ou erreur de rendu), les tooltips répondent au survol, les données correspondent à la période courante.
- ☑ OK
- **Frictions** : N/A

---

**B2 — Clients `/admin/clients`**

### B2.1 — Liste clients : navigation et tri

- **Action** : naviguer vers `/admin/clients`, observer la liste (PrestationsTable). Vérifier la pagination si >10 clients. Chercher `Client Test R9` via le champ de recherche s'il existe.
- **URL** : `/admin/clients`
- **Résultat attendu** : liste des clients affichée, `Client Test R9` visible, pagination fonctionnelle si applicable, colonnes lisibles (nom, type, email, date création).
- ✗ OK
- **Frictions** : Pas de colonne type, colonnes présentes nom/email/téléphone/crée le

### B2.2 — Création nouveau client (ClientForm complet)

- **Action** : cliquer "Nouveau client", remplir TOUS les champs du ClientForm (name, slug, type `individual`, email, phone, address, notes), soumettre. Tester ensuite la validation : soumettre avec le champ `name` vide.
- **URL** : `/admin/clients/new`
- **Résultat attendu** : (1) client créé, redirection vers fiche, tous les champs affichés. (2) soumission vide : message de validation affiché sur le champ `name`, pas de soumission.
- ✗ OK
- **Frictions** : Pas de slug automatique, pas de nom pas de soumission, ajout d'un contact au client(entreprise) ne reprend pas le select de tous les clients, peutêtre après refactor en entreprise/client

### B2.3 — Détail client : fiche complète

- **Action** : naviguer vers la fiche d'un client existant (`/admin/clients/[id]`). Vérifier toutes les sections : infos générales, liste devis, liste factures, liste paiements.
- **URL** : `/admin/clients/[id]`
- **Résultat attendu** : toutes les sections s'affichent, les données rattachées au client (devis, factures) sont visibles et cohérentes, liens internes fonctionnels.
- ☑ OK
- **Frictions** : N/A

### B2.4 — Invitation customer depuis fiche client

- **Action** : depuis `/admin/clients/[id]`, cliquer "Inviter" ou ouvrir `InviteCustomerDialog`. Saisir l'email du contact, confirmer l'envoi.
- **URL** : `/admin/clients/[id]` (dialog)
- **Résultat attendu** : confirmation d'envoi affichée (toast ou message), email d'invitation envoyé (vérifier console ou boîte mail). Si le contact a déjà un compte, le système doit l'indiquer.
- ☑ OK
- **Frictions** : N/A

---

**B3 — Prestations `/admin/prestations`**

### B3.1 — Liste prestations : navigation

- **Action** : naviguer vers `/admin/prestations`, observer la PrestationsTable. Vérifier le nombre de prestations listées, les colonnes affichées (nom, prix, statut, date), la pagination si applicable.
- **URL** : `/admin/prestations`
- **Résultat attendu** : liste affichée sans erreur, colonnes lisibles, bouton "Nouvelle prestation" visible et cliquable.
- ✗ OK
- **Frictions** : colonnes disponibles Nom/Prix/Type/Crée le

### B3.2 — Création nouvelle prestation

- **Action** : cliquer "Nouvelle prestation", remplir le PrestationForm (nom, description, prix unitaire, unité, TVA), soumettre. Tester aussi la validation : soumettre avec prix négatif ou vide.
- **URL** : `/admin/prestations/new`
- **Résultat attendu** : (1) prestation créée, redirection ou message de succès, prestation visible dans la liste. (2) validation : message d'erreur sur le champ prix invalide.
- ☐ OK
- **Frictions** : ~~Impossible de créer une préstation erreur a la soumission du formulaire meme rempli correctement, pas autant de champ que décrit, d'ou l'erreur je pense, champs dispo dans le formulaire Nom/Slug/Description/Type/Prix de base~~ **FIXÉ (fix-r9-prestation-form-fields-and-archive-action)** : `createPrestationAction` ne passait pas `ownerId` au service → contrainte NOT NULL en DB. Corrigé.

### B3.3 — Édition prestation existante

- **Action** : depuis la liste, cliquer sur une prestation existante pour l'éditer. Modifier le nom et le prix. Sauvegarder.
- **URL** : `/admin/prestations/[id]`
- **Résultat attendu** : formulaire pré-rempli avec les valeurs actuelles, modifications sauvegardées, liste mise à jour après retour.
- ☑ OK
- **Frictions** : N/A

### B3.4 — Archivage prestation

- **Action** : depuis la fiche ou la liste, déclencher l'archivage d'une prestation (bouton "Archiver" ou action contextuelle). Confirmer si une modale de confirmation apparaît.
- **URL** : `/admin/prestations/[id]` ou `/admin/prestations`
- **Résultat attendu** : prestation archivée (statut changé), disparaît de la liste active ou marquée comme archivée selon l'implémentation. Action réversible ou non ? Observer.
- ☐ OK
- **Frictions** : ~~Pas de bouton d'action autre que modifier, pas de bouton archivage~~ **FIXÉ (fix-r9-prestation-form-fields-and-archive-action)** : bouton "Archiver" ajouté par ligne dans `PrestationsTable`.

---

**B4 — Users `/admin/users`**

### B4.1 — Liste users : pagination et recherche

- **Action** : naviguer vers `/admin/users`. Observer la liste paginée des utilisateurs. Tester la recherche par nom ou email si disponible.
- **URL** : `/admin/users`
- **Résultat attendu** : liste affichée, colonnes lisibles (email, rôle, statut, date création), pagination fonctionnelle, recherche filtre les résultats.
- ✗ OK
- **Frictions** : Pas de nouveau client affiché hors ceux du seed, les clients crée en R9 n'apparaissent pas dans la liste, dashboard 5 clients, menu users 9 clients (clients invités au portail mais pas encore connecté?)

### B4.2 — Ban / unban user

- **Action** : sélectionner un user de test (pas l'admin courant), déclencher l'action "Bannir". Observer l'effet. Puis déclencher "Débannir".
- **URL** : `/admin/users` ou `/admin/users/[id]`
- **Résultat attendu** : statut du user passe à `banned`, badge visible dans la liste. Après débannissement, statut revient à actif. Action confirmée par toast ou feedback visuel.
- ✗ OK
- **Frictions** : Pas de feedback visuel, pas de taost ni rien, uniquement le badge qui change de couleur, modale de confirmation avant de bannir/debannir

### B4.3 — Reset TOTP user

- **Action** : pour un user avec TOTP activé (ou simuler), déclencher "Réinitialiser le TOTP". Confirmer l'action.
- **URL** : `/admin/users` ou `/admin/users/[id]`
- **Résultat attendu** : confirmation de la réinitialisation, le user devra reconfigurer son TOTP à la prochaine connexion. Toast ou message de confirmation affiché.
- ☑ OK
- **Frictions** : Pas d'utilisateurs avec TOPT actif, après avoir mis un 2FA sur bob, action de rest 2FA depuis l'admin, 2FA bien desactivé sur bob, il doit le reconfigurer

---

**B5 — Agent Tasks `/admin/agent-tasks`**

### B5.1 — Accès monitoring agent tasks

- **Action** : naviguer vers `/admin/agent-tasks`. Observer la liste des tâches agents affichée.
- **URL** : `/admin/agent-tasks`
- **Résultat attendu** : page chargée sans erreur, liste des tâches visible avec colonnes (id, type, statut, date), même si la liste est vide.
- ☑ OK
- **Frictions** : N/A

### B5.2 — Lecture des statuts et logs de tâche

- **Action** : cliquer sur une tâche agent (si disponible) pour consulter son détail ou ses logs. Sinon, observer l'état vide de la liste et la cohérence du message "Aucune tâche" ou équivalent.
- **URL** : `/admin/agent-tasks` ou `/admin/agent-tasks/[id]`
- **Résultat attendu** : détail de la tâche lisible (statut, logs, timestamps), ou état vide géré proprement (pas de crash, message explicite).
- ☑ OK
- **Frictions** : N/A

---

## Section C — Parcours customer

> Utiliser un navigateur en mode incognito pour isoler la session customer de la session admin.

---

**C1 — Invitation contact depuis admin**

### C1.1 — Déclenchement invitation depuis fiche client

- **Action** : (session admin) naviguer vers `/admin/clients/[id]`, ouvrir `InviteCustomerDialog`, saisir l'email du contact customer à inviter, confirmer.
- **URL** : `/admin/clients/[id]`
- **Résultat attendu** : toast de confirmation "Invitation envoyée", email `customer.invitation` envoyé vers l'adresse saisie. Si `EMAIL_PROVIDER=console` : token visible dans les logs serveur.
- ☑ OK
- **Frictions** : N/A

### C1.2 — Réception email d'invitation + extraction du lien

- **Action** : ouvrir la boîte mail du contact invité (ou consulter les logs console), localiser l'email d'invitation, copier le lien `/set-password?token=...`.
- **URL** : boîte mail externe ou terminal
- **Résultat attendu** : email présent, sujet et contenu lisibles (nom de l'app, instruction claire, lien bien formé), lien cliquable ou copiable.
- ✗ OK
- **Frictions** : Nom de l'app Bienvenue dans l'espace client de Client Test R9, bouton pour pouvoir créer son compte avec le bon lien d'invitation

---

**C2 — Flow `/set-password`**

### C2.1 — Nouveau compte : définir mot de passe

- **Action** : (navigateur incognito) coller le lien `/set-password?token=...`, observer la page. Saisir un mot de passe valide (≥8 car., 1 maj., 1 chiffre), confirmer, soumettre via `setInitialPasswordAction`.
- **URL** : `/set-password?token=...`
- **Résultat attendu** : page affiche le nom du contact et l'email pré-rempli (non modifiable), formulaire de définition du mot de passe, soumission déclenche la création du compte et redirige vers `/account/`.
- ☑ OK
- **Frictions** : N/A

### C2.2 — Validation du formulaire set-password

- **Action** : tester les cas limites du formulaire : mot de passe trop court, confirmation non correspondante, token expiré (si possible en réutilisant un ancien lien).
- **URL** : `/set-password?token=...`
- **Résultat attendu** : messages de validation affichés sur les champs concernés, token invalide/expiré → message d'erreur explicite (pas de page blanche ou 500).
- ✗ OK
- **Frictions** : lien expiré non testable au moment de ce test, mot de passe trop court OK, mot de passe non correspondant, même message que mot de passe trop court, pas de message les mots de passes ne correspondent pas

### C2.3 — Liaison compte existant (`linkExistingAccountAction`)

- **Action** : si l'email invité correspond à un compte existant, observer si la page propose l'option "Lier un compte existant". Saisir le mot de passe du compte existant pour lier.
- **URL** : `/set-password?token=...`
- **Résultat attendu** : option de liaison proposée automatiquement (pas besoin de créer un nouveau mot de passe), après liaison redirection vers `/account/` avec accès aux données du client.
- ☐ OK
- **Frictions** : Comment le tester? je ne peux pas inviter un utilisateur pour lequel j'ai deja envoyé l'invitation ?

---

**C3 — Espace client : navigation des sections**

### C3.1 — Dashboard `/account` — état "Bientôt disponible"

- **Action** : naviguer vers `/account` après connexion customer. Observer les cards affichées.
- **URL** : `/account`
- **Résultat attendu** : page s'affiche (pas d'erreur 403/500), cards "Devis", "Factures", "Rapports" visibles avec mention "Bientôt disponible". Navigation latérale ou top-bar accessible.
- ✗ OK
- **Frictions** : 2 devis sur client-bob@saas.dev aucun devis afficher sur le dashboard

### C3.2 — Devis `/account/quotes`

- **Action** : naviguer vers `/account/quotes`. Observer la liste des devis rattachés au client invité.
- **URL** : `/account/quotes`
- **Résultat attendu** : page chargée, liste des devis visible (statuts : `sent`, `accepted`, `declined`, `expired`), détail d'un devis accessible. Actions customer disponibles (accepter/refuser si applicable).
- ✗ OK
- **Frictions** : devis status envoyé, pas d'action pour accepter/cecliner le devis

### C3.3 — Factures `/account/invoices`

- **Action** : naviguer vers `/account/invoices`. Observer la liste des factures.
- **URL** : `/account/invoices`
- **Résultat attendu** : liste des factures affichée, statuts visibles (`sent`, `paid`, `overdue`), PDF de facture téléchargeable si implémenté, montants corrects.
- ✗ OK
- **Frictions** : Pas de PDF téléchargeable

### C3.4 — Paiements `/account/payments`

- **Action** : naviguer vers `/account/payments`. Observer l'historique des paiements.
- **URL** : `/account/payments`
- **Résultat attendu** : historique des paiements affiché (date, montant, méthode, statut), cohérent avec les paiements enregistrés en Section A.
- ✗ OK
- **Frictions** : Pas de colonne status, colonne avec la facture associé cliquable

### C3.5 — Contrats `/account/contracts`

- **Action** : naviguer vers `/account/contracts`.
- **URL** : `/account/contracts`
- **Résultat attendu** : page chargée sans erreur, liste des contrats ou message "Aucun contrat" si vide, pas de page blanche ou 500.
- ☑ OK
- **Frictions** : N/A

### C3.6 — Rapports `/account/reports`

- **Action** : naviguer vers `/account/reports`.
- **URL** : `/account/reports`
- **Résultat attendu** : page chargée sans erreur, liste des rapports ou message "Aucun rapport" si vide, pas de crash.
- ☑ OK
- **Frictions** : N/A

---

**C4 — Sécurité customer**

### C4.1 — Profil `/account/profile`

- **Action** : naviguer vers `/account/profile`. Observer les informations affichées (email, nom). Tester la modification d'un champ (prénom ou nom) et sauvegarder.
- **URL** : `/account/profile`
- **Résultat attendu** : profil affiché avec les informations du compte, modification sauvegardée avec feedback (toast), email non modifiable ou modification nécessite confirmation.
- ✗ OK
- **Frictions** : Uniquement le nnom est modifiable, il y a 2 boutons modifier mais ils ne permettent que de modifier le nom

### C4.2 — Changement mot de passe `/account/security`

- **Action** : naviguer vers `/account/security`, remplir le formulaire de changement de mot de passe (ancien MDP, nouveau MDP, confirmation), soumettre.
- **URL** : `/account/security`
- **Résultat attendu** : mot de passe changé avec succès (toast de confirmation), connexion avec l'ancien mot de passe refusée après la modification.
- ✗ OK
- **Frictions** : url non accessible depuis le panneau profil ou sidebar, uniquement activation 2FA

### C4.3 — Setup TOTP `/account/security/setup`

- **Action** : naviguer vers `/account/security/setup`, scanner le QR code avec une app TOTP (Authy, Google Authenticator), saisir le code à 6 chiffres, valider.
- **URL** : `/account/security/setup`
- **Résultat attendu** : QR code affiché correctement, codes de secours générés et affichés après validation, TOTP actif pour le compte, prochaine connexion demande le code TOTP.
- ☑ OK
- **Frictions** : N/A

---

## Section D — Friction log

> Remplir au fil de l'exécution. Une ligne par friction observée.

| #  | Section | Étape | Friction observée                                                                                                                                                                                                                                                  | Sévérité (bloquant / gênant / cosmétique) | Screenshot? |
|----|---------|-------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------|-------------|
| 1  | A       | 2     | Redirection vers /admin/clients au lieu de /admin/client/[id], a la creation slug obligatoire non auto genéré, blocage création si pas renseigné                                                                                                                   | gênant                                    |             |
| 2  | A       | 4     | email non envoyé, pas de mail reçu                                                                                                                                                                                                                                 | bloquant                                  |             |
| 3  | A       | 6     | Pas de lien vers la facture depuis la page du devis                                                                                                                                                                                                                | gênant                                    | ![img.png](img.png)      |
| 4  | A       | 9     | Pas d'historique visible sur la fiche du client                                                                                                                                                                                                                    | bloquant                                  | ![img_1.png](img_1.png)            |
| 5  | A       | 10    | Aucun mails reçu sur Mailhog                                                                                                                                                                                                                                       | bloquant                                  |             |
| 6  | B       | 2.1   | Pas de colonne type, colonnes présentes nom/email/téléphone/crée le                                                                                                                                                                                                | gênant                                    |             |
| 7  | B       | 2.2   | Pas de slug automatique, pas de nom pas de soumission, ajout d'un contact au client(entreprise) ne reprend pas le select de tous les clients, peut-être après refactor en entreprise/client ?                                                                      | gênant                                    |             |
| 8  | B       | 2.3   | Aucun historique de facture ni devis sur la fiche du client                                                                                                                                                                                                        | bloquant                                  |             |
| 9  | B       | 3.1   | colonnes disponibles Nom/Prix/Type/Crée le                                                                                                                                                                                                                         | gênant                                    |             |
| 10 | B       | 3.2   | Impossible de créer une préstation erreur a la soumission du formulaire meme rempli correctement, pas autant de champ que décrit, d'ou l'erreur je pense, champs dispo dans le formulaire Nom/Slug/Description/Type/Prix de base                                   | ~~bloquant~~ **FIXÉ**                     | fix-r9-prestation-form-fields-and-archive-action |
| 11 | B       | 3.4   | Pas de bouton d'action autre que modifier, pas de bouton archivage                                                                                                                                                                                                 | ~~bloquant~~ **FIXÉ**                     | fix-r9-prestation-form-fields-and-archive-action |
| 12 | B       | 4.1   | Pas de nouveau client affiché hors ceux du seed, les clients crée en R9 n'apparaissent pas dans la liste, dashboard 5 clients, menu users 9 clients (clients invités au portail mais pas encore connecté?) client visibles après acceptation invitation au portail | gênant                                    |             |
| 13 | B       | 4.2   | Pas de feedback visuel, pas de taost ni rien, uniquement le badge qui change de couleur, modale de confirmation avant de bannir/debannir                                                                                                                           | bloquant                                  |             |
| 14 | C       | 1.2   | Nom de l'app Bienvenue dans l'espace client de Client Test R9, bouton pour pouvoir créer son compte avec le bon lien d'invitation                                                                                                                                  | cosmétique                                |             |
| 15 | C       | 2.2   | lien expiré non testable au moment de ce test, mot de passe trop court OK, mot de passe non correspondant, même message que mot de passe trop court, pas de message les mots de passes ne correspondent pas                                                        | gênant                                    |             |
| 16 | C       | 2.3   | non testable Comment le tester? je ne peux pas inviter un utilisateur pour lequel j'ai deja envoyé l'invitation                                                                                                                                                    | gênant                                    |             |
| 16 | C       | 3.1   | 2 devis sur client-bob@saas.dev aucun devis afficher sur le dashboard                                                                                                                                                                                              | bloquant                                  |             |
| 17 | C       | 3.2   | devis status envoyé, pas d'action pour accepter/cecliner le devis                                                                                                                                                                                                  | bloquant                                  |             |
| 18 | C       | 3.3   | Pas de PDF téléchargeable (non implémenté il me semble ?)                                                                                                                                                                                                          | bloquant                                  |             |
| 19 | C       | 3.4   | Pas de colonne status, colonne avec la facture associé cliquable                                                                                                                                                                                                   | gênant                                    |             |
| 20 | C       | 4.1   | Uniquement le nom est modifiable, il y a 2 boutons modifier mais ils ne permettent que de modifier le nom, utilité du 2e bouton?                                                                                                                                   | gênant                                    |             |
| 21 | C       | 4.2   | url non accessible depuis le panneau profil ou sidebar, uniquement activation 2FA, uniquement disponible sur formulaire de connexion                                                                                                                               | bloquant                                  |             |

---

## Section E — Bugs bloquants
Prendre dans l'ordre les points bloquants remontés en section D et les traités 1 par 1
> Reporter ici uniquement les bugs qui empêchent de terminer une étape. Chaque ligne sera convertie en YAML hotfix R9.

| # | Section | Description | Steps to reproduce | Priorité hotfix (P0 / P1 / P2) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
