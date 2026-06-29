# Handover — R10 Tier 2 (entreprise/contact) — COMPLET

**Statut** : clos. CI verte (run #347, E2E Playwright inclus). 1628 tests unitaires verts.
**Périmètre livré** : identité entreprise du client + CRUD contacts first-class + destinataire-contact de bout en bout (saisie → persistance → PDF).

---

## 1. Résumé exécutif

Le Tier 2 ajoute la notion de **contact destinataire** et d'**identité d'entreprise** aux documents financiers. Une facture/un devis est émis pour une entreprise (client) et peut désormais être adressé « à l'attention de » un contact, avec le SIRET/TVA de l'entreprise affichés sur le PDF. Les contacts sont gérables en CRUD complet (ajout/édition/suppression/contact principal) depuis la fiche entreprise.

12 YAMLs exécutés (10 feat + 2 fix correctifs), un par un, commit entre chaque, CI verte à chaque étape.

---

## 2. YAMLs livrés (ordre chronologique)

1. **feat-shared-postal-address** — Consolidation des 3 définitions du type adresse en un `PostalAddress` canonique unique dans `@saas/db` ; `billing-party.shared` l'importe via `import type` (zero-runtime-DB préservé). Aucun push (type-level).
2. **feat-client-company-identity** — `siret` / `tvaIntra` / `legalForm` (text nullable) sur `clients` ; champs de formulaire conditionnels au `type === "company"` (masqués/non persistés pour un particulier). Push requis.
3. **feat-client-contact-mutations-backend** — `deleteClientContact(contactId)` (purge FK transactionnelle des invitations en cascade DB), `orderBy` déterministe sur `listClientContacts`, actions `updateClientContactAction` + `deleteClientContactAction`, schéma `updateClientContactSchema`.
4. **feat-client-contact-edit-delete-ui** — `EditClientContactDialog` (name/email/role, sans `isPrimary`) + `DeleteClientContactButton`, câblés dans la fiche entreprise.
5. **feat-set-primary-client-contact** — `setPrimaryContactById(clientId, contactId)` avec exclusivité transactionnelle (un seul principal), action + `SetPrimaryContactButton` + badge « Principal ». (Refonte de l'ancien `setPrimaryContact(clientId, userId)` orphelin.)
6. **feat-invoice-quote-contact-column** — `contactId` (uuid nullable, FK `onDelete: "set null"`) sur invoices ET quotes ; `createInvoiceFromQuote` copie le `contactId` ; zod create/update enrichis. Push requis.
7. **feat-invoice-recipient-contact-ui** — Select « Destinataire (contact) » dans `InvoiceForm` (filtré par client, reset au changement, masqué en from-quote, pré-rempli en edit) + service `listClientContactsByOwner(ownerId)`.
8. **feat-quote-recipient-contact-ui** — Idem pour `QuoteForm` (miroir allégé, réutilise `listClientContactsByOwner`).
9. **feat-pdf-recipient-resolve** — `BillTo.attention` + `resolveBillingParty(client, contact?)` mappe `client.siret/tvaIntra` et `contact.name` ; `generate-invoice-pdf` / `generate-quote-pdf` fetchent le contact conditionnellement. `resolveBillingParty` reste pur (zero-runtime-DB).
10. **feat-pdf-recipient-render** — `InvoicePdf` / `QuotePdf` affichent « À l'attention de [contact] » + SIRET/TVA dans le bloc destinataire (conditionnels). PDF immuable : seules les nouvelles émissions sont impactées.
11. **fix-client-contacts-labels-wording** — Relibellé section « Accès portail » → « Contacts » + wording d'archivage honnête sur `DeleteClientButton`.
12. **fix-delete-client-e2e-helper-testid** — Correctif CI : `data-testid` stables sur `DeleteClientButton` + helper e2e `deleteClientByName` ciblant les testid (insensible au wording). Débloque le job E2E cassé par le YAML 11.

---

## 3. Invariants verrouillés ce sprint

À propager dans `docs/structural-invariants.md` (workspace-side).

- **PostalAddress canonique** : défini une seule fois dans `@saas/db` ; jamais redéfini ailleurs ; les `*.shared` l'importent via `import type`.
- **Identité de facturation** : `siret` / `tvaIntra` / `legalForm` nommés identiquement sur `businessProfiles` ET `clients` (cohérence cross-table, jamais `vatNumber`).
- **Suppression client = archivage** : `deleteClientAction` appelle `archiveClient` (soft delete via `archivedAt`) car les FK restrict de `quotes`/`invoices` interdisent le hard delete. `listClients`/`getClientsForUser` filtrent `isNull(archivedAt)`.
- **FK destinataire-contact = `onDelete: "set null"`** sur documents financiers (jamais cascade) : un contact hard-deleté laisse la facture/devis intacte, `contactId` → null (historique comptable préservé).
- **Exclusivité contact principal** : au plus un `clientContact.isPrimary = true` par client, garanti par transaction applicative (`setPrimaryContactById`).
- **`listClientContactsByOwner` scopé `ownerId`** (+ `archivedAt IS NULL`) : anti-fuite cross-owner (préparation multi-tenant).
- **`*.shared` zero-runtime-DB** : `resolveBillingParty` reste pure, le contact lui est passé en paramètre (jamais de fetch dans un `.shared`).
- **Tests PDF en ASCII** : l'extraction de texte du buffer (décodeur hex) ne garde que l'ASCII → assertions sur termes ASCII (nom, « SIRET », « TVA », valeurs), jamais sur la chaîne accentuée « À l'attention de ».
- **`data-testid` stables pour delete** : tout composant suppression/archivage avec `AlertDialog` expose `{entity}-delete-trigger` / `-confirm` / `-cancel` ; les helpers e2e ciblent les testid, jamais le label texte.
- **[e2e-helper-blast-radius]** : renommer un label interactif (bouton/trigger/titre de dialog) impose un grep des **helpers e2e** qui interagissent par texte (`grep -rn "<ancien>|<nouveau>" tests/e2e/`), pas seulement les assertions.

---

## 4. Apprentissages process (intégrés en cours de sprint)

- **Vérifier l'existant avant de spec** : le YAML 2 a révélé que l'écran contacts existait déjà (add/list/role/invite) → re-cadrage en « compléter le CRUD » (edit/delete) au lieu de « créer l'écran ». Vérification systématique du codebase avant génération depuis.
- **Factories `$inferSelect` exhaustives** : ajouter une colonne (même nullable) la rend requise dans `$inferSelect` → tout factory/fixture de test du type doit l'inclure (TS2719). À lister en collateral dès le design (raté au YAML 1 `ClientsTable.test.tsx`, anticipé ensuite).
- **Mock `@saas/services`** : ajouter un appel service dans une page casse le mock du test de cette page → compléter le mock (anticipé en collateral à partir du 3c).
- **Découpage par couche** pour les features cross-couche (data/UI ou résolution/rendu) — évite de toucher deux fois les mêmes fichiers.
- **Miss du sprint** : `fix-client-contacts-labels-wording` a cassé le job E2E car le helper partagé `deleteClientByName` interagissait par texte avec un label renommé, hors du grep de cadrage (centré sur les assertions). Corrigé par data-testid + invariant ci-dessus.

---

## 5. Dette & backlog reporté

| Item | Détail | Priorité |
|---|---|---|
| **Dette TS config** | Le check-types des agents devrait pointer `turbo check-types` per-package (résout les alias `@/`) plutôt que `tsc --noEmit` root (faux positifs `TS2307`/`TS17004` récurrents qui masquent les vraies régressions). Typer aussi le `deleteErr` implicit any de `generate-invoice-pdf`. | Moyenne |
| Garde serveur `contactId ↔ clientId` | Actuellement l'appartenance du contact au client est assurée par l'UI uniquement (l'UI ne propose que les bons contacts). Durcir côté action si besoin. | Basse |
| Pré-sélection contact principal | Les forms facture/devis ont NONE par défaut. Pré-sélectionner automatiquement le contact principal du client serait plus pratique. | Basse |
| Validation SIRET/TVA | Champs souples (pas de regex) côté clients. Durcir si exigence réglementaire. | Basse |
| **R10 Tier 1 — PDF polish** | Typographie/spacing, table teintée + totaux encadrés, footer émetteur (IBAN/BIC, null handling), mentions légales TVA, « CGV sur demande ». Toujours en attente. | À planifier |

---

## 6. État pour reprendre

- Branche `main` verte, sprint Tier 2 mergé.
- Le destinataire-contact est complet de bout en bout : saisie (facture + devis) → persistance (`contactId` set-null) → résolution → rendu PDF (« à l'attention de » + SIRET/TVA).
- **Pré-requis test manuel** : pour voir le destinataire sur un PDF, émettre un **nouveau** document (PDF immuable) avec un client `company` (SIRET/TVA renseignés) et un contact sélectionné.
- **Pistes suivantes** : R10 Tier 1 (PDF polish, backlog ci-dessus), ou Tier 3 si défini.
