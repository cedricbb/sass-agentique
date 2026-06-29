# Guide de test manuel — R10 Tier 2 (entreprise/contact)

## 0. Pré-requis

| Élément | Vérification |
|---|---|
| Schéma DB à jour | `pnpm --filter @saas/db push` exécuté sur l'hôte (colonnes `siret`/`tva_intra`/`legal_form` sur `clients`, `contact_id` sur `invoices` et `quotes`). |
| Seed | `pnpm --filter @saas/db seed` rejoué. |
| Environnement | web + Postgres + MailHog (`10.100.2.9:1025`) up. |
| Compte | connecté en **admin**. |
| ⚠️ PDF immuable | Un document déjà émis n'est **jamais** régénéré (`pdfKey` figé). Pour tester le rendu PDF du destinataire, **émettre de nouveaux** devis/factures. |

> Pour chaque test : cocher `[x]` si conforme, sinon consigner en **Section H — Frictions**.

---

## A. Identité d'entreprise du client

- [x] **A1 — Champs entreprise visibles** : Nouveau client, type = **Entreprise**. → Les champs **SIRET**, **TVA Intracommunautaire**, **Forme juridique** apparaissent (entre le Select Type et l'Email). Renseigner les trois, enregistrer, rouvrir la fiche → valeurs persistées.
- [x] **A2 — Champs masqués pour un Particulier** : Nouveau client, type = **Particulier**. → Les trois champs identité sont **absents** du formulaire.
- [ ] **A3 — Bascule company → individual** : Sur un client Entreprise avec SIRET rempli, passer le type à **Particulier**, enregistrer, rouvrir. → Les champs n'apparaissent plus et les valeurs ne sont **pas** conservées (SIRET/TVA/forme = vides/null).
- [x] **A4 — Validation souple** : Sur un client Entreprise, saisir un SIRET non conforme (ex. `ABC123`) ou le laisser vide. → Accepté (pas de blocage), enregistrement OK.

---

## B. CRUD contacts (fiche entreprise)

- [x] **B1 — Section « Contacts »** : Ouvrir une fiche client. → La section de gestion des contacts est intitulée **« Contacts »** (et non plus « Accès portail »).
- [x] **B2 — Ajout contact (rôle prédéfini)** : Ajouter un contact (nom, email, rôle = Décideur). → Apparaît dans la liste avec son rôle.
- [x] **B3 — Ajout contact (rôle « Autre »)** : Ajouter un contact, rôle = **Autre** + saisie libre. → Le rôle custom s'affiche dans la liste.
- [x] **B4 — Email dupliqué** : Ajouter un contact avec un email déjà présent sur ce client. → Toast d'erreur (email déjà existant), pas de création.
- [x] **B5 — Édition contact** : Éditer un contact (nom/email/rôle). → Modifications persistées. Pour un contact à rôle custom, vérifier que **« Autre » est pré-sélectionné** et le champ pré-rempli à l'ouverture.
- [x] **B6 — Contact principal (exclusivité)** : Avoir ≥ 2 contacts. Cliquer « Définir comme principal » (étoile) sur le contact B. → Le badge **« Principal »** se déplace sur B ; l'ancien principal A le perd. **Un seul** principal à la fois.
- [x] **B7 — Ordre de liste** : → Le contact principal apparaît **en tête**, puis tri alphabétique.
- [x] **B8 — Suppression contact** : Supprimer un contact → dialog de confirmation, puis disparaît de la liste.
- [ ] **B9 — Suppression contact avec accès portail** : Sur un contact ayant un compte/une invitation portail, lancer la suppression. → Le wording mentionne la **révocation de l'accès portail** ; après confirmation, le contact disparaît (et l'invitation en cours est purgée, pas d'erreur FK).

---

## C. Destinataire-contact — Facture

- [x] **C1 — Select destinataire apparaît** : Nouvelle facture, sélectionner un client. → Le Select **« Destinataire (contact) »** apparaît, listant les contacts de ce client + l'option **« Aucun (entreprise seule) »**.
- [ ] **C2 — Reset au changement de client** : Sélectionner un contact, puis changer de client. → Les options se recalculent (contacts du nouveau client) et la sélection **revient à « Aucun »**.
- [x] **C3 — Persistance** : Créer une facture avec un contact sélectionné. Rouvrir en édition. → Le contact est **pré-rempli**.
- [ ] **C4 — Facture depuis un devis** : Créer une facture **à partir d'un devis** (qui a un contact). → Le Select contact est **masqué** ; la facture hérite du contact du devis (vérifiable au rendu PDF, section E).
- [x] **C5 — Sans contact** : Créer une facture en laissant « Aucun ». → Pas de destinataire-contact (vérifiable en édition : « Aucun »).

---

## D. Destinataire-contact — Devis

- [x] **D1 — Select destinataire apparaît** : Nouveau devis, sélectionner un client. → Select « Destinataire (contact) » avec contacts + « Aucun ».
- [ ] **D2 — Reset au changement de client** : idem C2.
- [x] **D3 — Persistance** : Créer un devis avec contact, rouvrir en édition. → Contact pré-rempli.

---

## E. Rendu PDF du destinataire (nouvelles émissions)

> Rappel : émettre de **nouveaux** documents (PDF immuable).

- [x] **E1 — PDF facture enrichi** : Émettre une facture pour un client **Entreprise** (SIRET + TVA renseignés) **avec** un contact. Télécharger le PDF. → Le bloc destinataire affiche : nom de l'entreprise, **« À l'attention de [contact] »**, l'adresse, **« SIRET : … »**, **« TVA : … »**. *(fix-pdf-recipient-attention-contact-fetch : getClientContactById remplace getClientContactWithUser)*
- [x] **E2 — PDF devis enrichi** : idem E1 pour un devis. *(idem E1)*
- [x] **E3 — Héritage from-quote** : Émettre la facture créée en C4 (issue d'un devis). → Le destinataire-contact du devis apparaît bien sur le PDF de la facture.
- [x] **E4 — PDF minimal (pas de labels orphelins)** : Émettre une facture pour un **Particulier sans contact**. → Le bloc destinataire **ne contient ni** « À l'attention de », **ni** « SIRET : », **ni** « TVA : » (aucun libellé vide, aucun « undefined »/« null »).

---

## F. Intégrité & cas de bord

- [ ] **F1 — Suppression d'un contact référencé (onDelete set null)** : Créer une facture **et** un devis adressés à un contact. Supprimer ce contact. → La facture et le devis **subsistent** ; en édition leur destinataire est repassé à **« Aucun »** (aucune erreur, aucun document perdu).
- [x] **F2 — Archivage client (FK restrict)** : Sur un client ayant des devis/factures, lancer « Supprimer ». → Le client est **archivé** : il disparaît de la liste clients, mais ses devis/factures restent consultables. Aucune erreur 500.
- [x] **F3 — Wording d'archivage honnête** : Le dialog de suppression client **ne dit plus** « définitivement supprimés / irréversible » ; il reflète l'archivage et la conservation des documents.

---

## G. Régression rapide (non-Tier 2)

- [x] **G1 — Facture standard** : Créer/éditer/émettre une facture pour un Particulier sans contact → comportement inchangé vs avant le sprint.
- [x] **G2 — Devis standard** : idem pour un devis.
- [x] **G3 — Liste clients** : tri et recherche fonctionnent normalement ; les clients archivés (F2) n'apparaissent pas.

---

## H. Frictions consignées

> À remplir pendant l'exécution. Sévérité : bloquant / gênant / cosmétique.

| #  | Section | Étape | Sévérité | Description                                                                                                                                                                | Repro |
|----|--------|-----|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| 1  | A      | 3   | bloquant | passage client entreprise en indep, les champs ne sont plus la, mais si je remet en entreprise les champs SIRET et TVA ne sont pas vierge ils gardent la valeur précédente |  |
| 2  | B      | 9   | bloquant | pas pu tester je dois avoir un probleme avec mailhog car je ne reçcoit aucun message                                                                                       |  |
| 3  | C      | 2   | bloquant | je ne peux pas changer de client                                                                                                                                           |  |
| 4  | C      | 4   | bloquant | le select contact n'est pas masqué                                                                                                                                         |  |
| 5  | D      | 2   | bloquant | je ne peux pas changer de client                                                                                                                                           |  |
| 6  | E      | 1   | ~~bloquant~~ **✅ corrigé** | pas de champ À l'attention de [contact] — corrigé par fix-pdf-recipient-attention-contact-fetch                                                          |  |
| 7  | E      | 2   | ~~bloquant~~ **✅ corrigé** | pas de champ À l'attention de [contact] — corrigé par fix-pdf-recipient-attention-contact-fetch                                                          |  |
| 8  | E      | 3   | ~~bloquant~~ **✅ corrigé** | pas de champ À l'attention de [contact] — corrigé par fix-pdf-recipient-attention-contact-fetch                                                          |  |
| 9  | F      | 1   | bloquant | plus de client                                                                                                                                                             |  |
| 10 |        |     | bloquant | Impossible de supprimer un client, uniquement un contact (mélange client/contact)? uniquement archiver                                                                     |  |

---

## I. Synthèse d'exécution

| Métrique | Valeur |
|---|---|
| Tests OK |  / 24 |
| Frictions bloquantes |  |
| Frictions gênantes |  |
| Frictions cosmétiques |  |
| Date d'exécution |  |

> Ce guide couvre le périmètre du `handover-r10-tier2-complete.md`. Les frictions consignées en Section H alimenteront, si besoin, des YAMLs correctifs post-Tier 2.
