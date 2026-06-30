# Handover — R10 Tier 2 (entreprise/contact) — COMPLET & STABILISÉ

**Statut** : clos, testé manuellement, stabilisé. CI verte (dernier run avec E2E Playwright). 1635 tests unitaires verts.
**Périmètre** : identité entreprise du client + CRUD contacts first-class + destinataire-contact de bout en bout (saisie → persistance → PDF), PDF entièrement localisé FR.

---

## 1. Résumé exécutif

Le Tier 2 ajoute la notion de **contact destinataire** et d'**identité d'entreprise** aux documents financiers : une facture/un devis est émis pour une entreprise (client), peut être adressé « à l'attention de » un contact, avec SIRET/TVA affichés sur le PDF. Contacts gérables en CRUD complet (ajout/édition/suppression/principal).

La feature a été livrée en **12 YAMLs** (phase sprint), puis un **test manuel** a révélé des frictions traitées en **4 YAMLs de stabilisation** + un correctif process (dette TS). Tout est désormais validé fonctionnellement et visuellement.

---

## 2. YAMLs livrés

### Phase sprint (Tier 2 — feature)

1. **feat-shared-postal-address** — `PostalAddress` canonique unique dans `@saas/db` ; les `*.shared` l'importent via `import type`. Type-level, pas de push.
2. **feat-client-company-identity** — `siret`/`tvaIntra`/`legalForm` (nullable) sur `clients` ; champs conditionnels au `type === "company"`. Push.
3. **feat-client-contact-mutations-backend** — `deleteClientContact`, `orderBy` déterministe, actions update/delete, `updateClientContactSchema`.
4. **feat-client-contact-edit-delete-ui** — `EditClientContactDialog` + `DeleteClientContactButton`.
5. **feat-set-primary-client-contact** — `setPrimaryContactById` (exclusivité transactionnelle) + bouton + badge « Principal ».
6. **feat-invoice-quote-contact-column** — `contactId` uuid nullable, FK `onDelete: "set null"` sur invoices ET quotes ; `createInvoiceFromQuote` copie le `contactId`. Push.
7. **feat-invoice-recipient-contact-ui** — Select destinataire dans `InvoiceForm` + `listClientContactsByOwner(ownerId)`.
8. **feat-quote-recipient-contact-ui** — miroir `QuoteForm`.
9. **feat-pdf-recipient-resolve** — `BillTo.attention` + `resolveBillingParty(client, contact?)` mappe siret/tvaIntra/attention.
10. **feat-pdf-recipient-render** — `InvoicePdf`/`QuotePdf` affichent « À l'attention de » + SIRET/TVA.
11. **fix-client-contacts-labels-wording** — relibellé « Accès portail » → « Contacts » + wording d'archivage.
12. **fix-delete-client-e2e-helper-testid** — data-testid stables sur `DeleteClientButton` + helper e2e ciblant les testid (débloque la CI e2e cassée par le #11).

### Phase stabilisation (post test manuel)

13. **fix-pdf-recipient-attention-contact-fetch** — BUG MAJEUR : « À l'attention de » jamais affiché. `getClientContactWithUser` faisait un `innerJoin(users)` → retournait `null` pour les contacts sans compte portail (la majorité). Remplacé par `getClientContactById` (select sans join) dans les generate-*-pdf. Test anti-récidive (contact `userId: null`).
14. **fix-client-identity-strip-null** — BUG A3 : passer un client en Particulier n'effaçait pas SIRET/TVA en DB. `onSubmit` envoyait `undefined` (omis) au lieu de `null` explicite → `.set({...patch})` n'écrasait pas. Corrigé + reset visuel au switch + zod nullable.
15. **feat-pdf-fr-localization** — PDF polish : montants `Intl fr-FR` (« 500,00 € »), dates `jj/mm/aaaa`, accents des mentions légales. Réutilise les utils `formatCurrency`/`formatDate` existants (suppression de 3 duplications).
16. **fix-archived-client-name-in-lists** — #9 : un client archivé affichait « — » sur ses factures/devis. Nouveau `getClientNamesByIds` (sans filtre `archivedAt`) ; les listes affichent « {nom} (archivé) ». `listClients` inchangé (Select création exclut toujours les archivés).

### Correctif process (hors pipeline)

- **Dette TS config réglée** — voir §3 (invariant « Vérification de types »). Mise à jour directe de `01-STRUCTURAL-INVARIANTS.md` + templates Orchid, pas de YAML.

---

## 3. Invariants verrouillés (à maintenir dans `docs/structural-invariants.md`)

**Données & domaine**
- `PostalAddress` canonique unique dans `@saas/db` ; les `*.shared` l'importent via `import type`.
- `siret`/`tvaIntra`/`legalForm` nommés identiquement sur `businessProfiles` ET `clients`.
- Suppression client = **archivage** (`archivedAt`), jamais hard delete (FK restrict des quotes/invoices).
- FK destinataire-contact sur documents financiers = `onDelete: "set null"` (préserve l'historique comptable).
- Au plus un `clientContact.isPrimary` par client (transaction applicative).

**Résolution & requêtes**
- `*.shared` **zero-runtime-DB** : `resolveBillingParty` pure, contact passé en param (jamais de fetch dedans).
- Pour résoudre un **contact destinataire** (sans besoin du compte portail) → `getClientContactById` (select par id). `getClientContactWithUser` (inner join users) est réservé aux flux portail et **exclut** les contacts sans compte.
- Les **listes de documents** (factures/devis) résolvent le nom client via `getClientNamesByIds` (sans filtre `archivedAt`, traçabilité). `listClients` (filtré `archivedAt`) est réservé aux **sélecteurs de création** et à la liste clients.
- `listClientContactsByOwner` scopé `ownerId` (anti-fuite multi-tenant).

**Form & persistance**
- Un champ conditionnel à **effacer en DB** doit être envoyé explicitement à `null` dans le payload update — l'omettre/`undefined` ne l'efface pas (le spread `.set()` ignore les clés absentes).
- Réutiliser les utils de formatage FR existants (`formatCurrency`/`formatDate` de `lib/format`), ne pas dupliquer.

**Tests & process**
- Tests PDF : assertions en **ASCII** (décodeur hex) — pas d'accents, pas de symbole `€`, pas d'espace insécable Intl.
- data-testid stables `{entity}-delete-trigger`/`-confirm`/`-cancel` ; les helpers e2e ciblent les testid, jamais le label texte.
- **[e2e-helper-blast-radius]** renommer un label interactif impose un grep des helpers e2e (pas seulement des assertions).
- **Vérification de types** : toujours `pnpm check-types` (= `turbo run check-types`, per-package avec le bon `tsconfig`) ou `pnpm --filter <pkg> check-types`. JAMAIS `tsc --noEmit` depuis la racine du monorepo (faux positifs systémiques `TS2307 @/...`, JSX flag, implicit-any qui n'existent pas sous Turbo). La CI fait foi. Critère QA = `exit 0` (plus de tolérance « erreurs pré-existantes »).

---

## 4. Apprentissages process & infra

- **Decoupling test/runtime (récurrent, le plus coûteux)** : un mock qui simule le « happy path » d'une fonction masque ses contraintes runtime. Le bug PDF #13 (inner join excluant `userId: null`) est passé vert en test car les mocks renvoyaient `{ contact }`. Leçon : pour toute fonction DB réutilisée, le test doit couvrir le **cas réel limite** (ici : contact sans compte portail), pas seulement le cas nominal.
- **Vérifier l'existant avant de spec** : le PDF « polish » du backlog était déjà implémenté à 90 % ; seuls 3 écarts de localisation FR restaient. Toujours regarder le code/les rendus avant de cadrer.
- **Renommer un label interactif** casse les helpers e2e qui cliquent par texte (incident #11→#12). Grep des helpers obligatoire.
- **Distinguer bug / malentendu de test** : sur 10 frictions du test manuel, seules 3 étaient de vrais bugs (PDF attention, A3, #9) ; 3 étaient des malentendus (comportements de création testés en édition), le reste env/UX. Trier avant de spec évite de corriger des non-bugs.
- **Infra Orchid — double daemon** : lancer une task via la TUI démarre un conteneur `compose run` éphémère portant **son propre daemon kernel**, qui entre en collision avec le `orchid-os-kernel` permanent (deux pilotes sur `pipeline_states_changed`/`orphan_chain_detected` → `respawn_skipped_lease_active` alors que `pipeline_leases` est vide). Symptôme : `tl_completed` en ~5 s, `$0.00`, pas de `rca.md`. Diagnostic rapide : `docker ps --filter ancestor=orchid-os/swarm-cli:latest` doit montrer **un seul** daemon en régime permanent ; deux = collision.

---

## 5. Dette & backlog (mis à jour)

| Item | Détail | Priorité |
|---|---|---|
| ~~Dette TS config~~ | ✅ RÉGLÉE — invariant « Vérification de types » + templates Orchid alignés sur `pnpm check-types`. | — |
| ~~R10 Tier 1 PDF polish~~ | ✅ FAIT — localisation FR complète (#15) ; table teintée / totaux encadrés / footer IBAN-BIC déjà présents. | — |
| **Scoping `ownerId` (multi-tenant)** | `listInvoices`/`listQuotes`/`getClientNamesByIds` ne filtrent pas par `ownerId`. **Pré-existant**, inoffensif en single-admin, mais **leak cross-tenant** dès le passage multi-tenant. Remonté par le security report du #16. | Haute (multi-tenant) |
| **Anonymisation RGPD client (ex-#10)** | Le hard delete d'un client est sans valeur (un client a quasi toujours des documents → FK restrict → archivage). Le vrai besoin multi-tenant = droit à l'effacement RGPD, à traiter par **anonymisation** (neutraliser nom/email/SIRET tout en conservant les pièces comptables), pas par `DELETE`. | À traiter au chantier multi-tenant |
| Garde serveur `contactId ↔ clientId` | Appartenance assurée par l'UI seulement. Durcir côté action si besoin. | Basse |
| Pré-sélection contact principal | Forms facture/devis à « Aucun » par défaut ; pré-sélectionner le contact principal du client serait plus pratique. | Basse |
| Validation SIRET/TVA | Champs souples (pas de regex). Durcir si exigence réglementaire. | Basse |
| MailHog (B9) | Env : aucun mail reçu (`10.100.2.9:1025`, réseau Docker `backend`). Bloque le test des invitations portail. Hors code. | Basse (env) |
| Nit review #16 | Un test de non-régression `listClients` placé dans le mauvais `describe`. Cosmétique. | Très basse |

---

## 6. État pour reprendre

- `main` verte, Tier 2 mergé et stabilisé. Aucun bug ouvert.
- Destinataire-contact complet de bout en bout : saisie (facture + devis) → persistance (`contactId` set-null) → résolution (`getClientContactById`) → PDF (« à l'attention de » + SIRET/TVA), entièrement localisé FR.
- **Pré-requis test PDF** : PDF immuable → émettre un **nouveau** document pour voir tout changement de rendu.
- **Pistes suivantes, par valeur** :
  1. **Chantier multi-tenant** — le plus structurant. Y rattacher le scoping `ownerId` (dette de sécurité) et l'anonymisation RGPD (ex-#10). C'est là que `listClientContactsByOwner` (déjà scopé) sert de repère.
  2. Confort : pré-sélection auto du contact principal dans les forms.
  3. Env : régler MailHog pour débloquer le test des invitations portail.
