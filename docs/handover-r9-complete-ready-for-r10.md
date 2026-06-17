# Handover Sprint R9 — complete, ready for R10

**Date :** juin 2026
**Sprint :** R9 (pause feature dev — UX/UI + observabilité humaine + refactor structurel léger)
**Statut :** TERMINÉ — 12 YAMLs ACCEPTED, 10/11 frictions bloquantes résolues
**Tests baseline en fin de sprint :** 1397 tests verts (vs 1332 baseline R8)
**Successeur :** R10 (polish UI Apex tokens + PDF generation + refactor entreprise/contact)

---

## 1. Récap exécutif

Sprint R9 a été ouvert comme **pause de feature development** pour traiter en profondeur l'expérience humaine du MVP : audit empirique, guide de test manuel exhaustif, et résolution d'une série de frictions identifiées au cours de l'exécution du guide par Cédric.

Le sprint s'est déroulé selon le schéma : exploration → exécution manuelle → résolution one-friction-at-a-time → checkpoint visuel après chaque YAML. Cette boucle serrée a permis de remonter des bugs runtime qui passaient sous le radar du TDD unitaire, notamment **deux bugs systémiques de niveau infra** (`toast` module sans `"use client"` directive et `useTransition` double-toast) qui affectaient rétroactivement tous les call sites de feedback UI depuis R4.

Le sprint a aussi montré l'efficacité de la séquence **un YAML → un commit → un checkpoint manuel** pour isoler les régressions et garder le diagnostic tractable. Aucun YAML n'a nécessité de REJECTED retour TL ; tous ont passé en ACCEPTED direct.

---

## 2. YAMLs livrés R9

| ID | Type | Titre court | Frictions résolues |
|---|---|---|---|
| R9-1 | feat | Audit empirique d'ouverture (5 questions) | — (debloque le reste) |
| R9-2 | feat | Guide de test manuel admin + customer | — (matériel de validation) |
| R9-3 | feat | notification.service cascade SMTP > Resend > console | #2, #5 (partielle) |
| R9-3b | fix | Zod refine NOTIFICATIONS_ENABLED accepte SMTP ou Resend | #2, #5 (complète) |
| R9-4 | feat | Fiche client : sections historique devis + factures | #4, #8 |
| R9-5 | fix | Prestation form ownerId + bouton archivage liste | #10, #11 |
| R9-6 | fix | UserActions AlertDialog confirm + toast feedback | #13 (mécanique) |
| R9-6b | fix | toast.ts directive "use client" (unification store Sonner) | #13 (visuel) + 28 call sites |
| R9-7 | feat | Customer accept/decline devis + RBAC strict | #17 |
| R9-8 | feat | Dashboard customer 3 cards stats numériques | #16 |
| R9-8b | fix | Redirect post-login customer → /account (3 actions) | redirect (nouvelle) |
| R9-8c | feat | Section Sécurité /profile + bannière 2FA persistante /account | #21 |

**Volume :** 12 YAMLs, dont 7 feat et 5 fix. Effort dominant S (effort moyen real ~ S+ étendu).

**Blast radius moyen :** ~3-5 fichiers par YAML, jamais > 10. Zero débordement non-déclaré sur les 12 YAMLs.

---

## 3. Frictions

### Résolues (10/11 bloquantes)

| # guide | Étape | Résolu par |
|---|---|---|
| #2 | A4 — email devis non envoyé | R9-3 + R9-3b |
| #4 | A9 — historique absent fiche client | R9-4 |
| #5 | A10 — mails MailHog absents | R9-3 + R9-3b |
| #8 | B2.3 — historique fiche client (doublon) | R9-4 |
| #10 | B3.2 — création prestation cassée (ownerId) | R9-5 |
| #11 | B3.4 — pas de bouton archivage prestation | R9-5 |
| #13 | B4.2 — ban/unban UX (modale + toast) | R9-6 + R9-6b |
| #16 | C3.1 — dashboard customer vide | R9-8 |
| #17 | C3.2 — customer accept/decline devis | R9-7 |
| #21 | C4.2 — security access customer (2FA + password) | R9-8c |

### Reportée

| # guide | Étape | Raison |
|---|---|---|
| **#18** | **C3.3 — PDF facture/devis** | Effort réel M-L (génération PDF backend complète, pas un placeholder). Audit R9-1 avait confirmé : `InvoiceRow.pdfUrl` est un placeholder mort, aucun backend de génération PDF n'existe. Scope hors sprint R9 par décision Cédric. Carry-over R10. |

### Frictions découvertes en cours de sprint (toutes résolues sauf une)

| Source | Description | Résolu par |
|---|---|---|
| Validation R9-7 | Redirect post-login customer → `/profile` au lieu de `/account` | R9-8b |
| Validation R9-6 | Toasts invisibles malgré tests verts (store Sonner dédoublé) | R9-6b |
| Validation R9-6b | Double toast ban/unban après fix toast (useTransition + Sonner) | R9-6c **annulé** — bug fantôme disparu spontanément après cycle dev/restart |
| Validation R9-8c | Bannière 2FA reste affichée après activation jusqu'à logout/relogin | **non résolu** — finding R10 follow-up |

---

## 4. Findings techniques R9 (bugs systémiques découverts)

### Finding 1 — `apps/web/lib/toast.ts` sans `"use client"` (R9-6b)

**Symptôme :** Tous les appels à `toast.success(...)` / `toast.error(...)` via le helper `toastResult` étaient silencieux. Le `<Toaster />` était bien monté dans le layout admin (`section[aria-label="Notifications alt+T"]` présent dans le DOM), `toastResult` était bien appelé avec les bons arguments (vérifié par console.log), mais aucun élément `[data-sonner-toaster]` n'apparaissait dans le DOM.

**Cause racine :** `apps/web/lib/toast.ts` réexportait `toast` de `sonner` sans la directive `"use client"`. Le module était traité comme server-by-default par Next.js App Router. Sonner stocke ses toasts dans un singleton interne au module — deux résolutions du module (server bundle vs client bundle) = deux stores. Le helper écrivait dans le store server (jamais lu), le `<Toaster>` client lisait son propre store (jamais alimenté).

**Pourquoi non détecté plus tôt :** Les unit tests mockaient `toastResult` au niveau module (`vi.mock("@/lib/toast")`). Les tests vérifiaient `toHaveBeenCalledWith(...)` mais pas le rendu DOM réel. **28 call sites** dans le repo étaient silencieux depuis R4-R5.

**Fix :** Ajout `"use client";` ligne 1 de `apps/web/lib/toast.ts`. Résolution rétroactive de tous les call sites.

**Leçon de processus :** Pour tout YAML qui touche du feedback UI (toast, modal, navigation), le `done_definition` doit imposer un checkpoint manuel **avec vérification DOM directe** (`document.querySelector('[data-sonner-toast]')`) ou un test e2e Playwright qui assert le rendu DOM. Les unit tests qui stub le helper ne suffisent pas.

### Finding 2 — `useTransition` + `await Server Action` + `toast.success` cause double-toast (R9-6c)

**Symptôme :** Post fix R9-6b, deux toasts identiques apparaissaient sur chaque action ban/unban (et seulement ces actions). Persistait en build prod (donc pas React Strict Mode).

**Diagnostic :** Test discriminant — retirer `useTransition` du handler `UserActions.handleConfirm` et utiliser un handler async direct → 1 seul toast. Bug confirmé spécifique à `useTransition`.

**Cause racine probable (non investiguée en profondeur) :** Interaction React 19 + Server Action + Sonner singleton client. Hypothèse : `startTransition` replay ou double-flush du callback dans le store Sonner. Investigation hors scope MVP.

**Comportement bizarre :** Le bug a **disparu spontanément** le lendemain après cycle dev/restart, même en remettant le code original avec `useTransition`. Cause exacte indéterminée (cache HMR pollué, build cache, ou autre). Le YAML R9-6c qui aurait remplacé `useTransition` par `useState` a été **annulé** par Cédric après confirmation 5-10 cycles stable.

**Statut :** **Bug fantôme**, non résolu de manière déterministe mais non reproductible. À surveiller en récidive. YAML R9-6c reste en réserve dans le backlog mental.

**Leçon de processus :** Documenter les bugs fantômes plutôt que les ignorer. Si récidive en R10+, R9-6c est prêt à être généré rapidement.

### Finding 3 — Zod refine obsolète post-évolution multi-transport (R9-3b)

**Symptôme :** Après R9-3 (ajout cascade SMTP au notification.service), le boot échouait avec `NOTIFICATIONS_ENABLED=true` + `SMTP_HOST` set + pas de `RESEND_API_KEY`. Le refine Zod exigeait `RESEND_API_KEY` comme seul transport valide.

**Cause racine :** Refine écrit en R5 quand notification.service utilisait Resend uniquement. R9-3 a étendu le transport mais le refine config n'a pas été adapté en même temps (oubli scope).

**Fix :** Refine élargi pour accepter `SMTP_HOST` OU `RESEND_API_KEY` quand `NOTIFICATIONS_ENABLED=true`. Message d'erreur Zod adapté.

**Leçon de processus :** Tout YAML qui ajoute un mode/transport/option à un service doit auditer les `refine` / `zod` du package config pour cohérence. À graver en pattern check pré-YAML.

### Finding 4 — Decoupling tests stubs / runtime behavior (R9-5)

**Observation transverse :** Plusieurs YAMLs ont eu des tests qui passaient verts mais des bugs runtime résiduels (toast, double-toast, bannière 2FA stale). Le pattern récurrent : les unit tests mockent les couches voisines (toast, server actions, etc.) et perdent la fidélité runtime.

**Pattern à graver :** Pour les YAMLs UX-visibles, le `done_definition` doit lister explicitement des **assertions DOM** ou des **e2e checkpoints** en plus des unit tests. La validation manuelle Cédric ne doit jamais être le seul filet.

---

## 5. Invariants à graver workspace-side

Propositions concrètes à ajouter dans `docs/structural-invariants.md` (repo SaaS, **pas** Orchid-OS `docs/system/`) :

### `[ui-toast-helper-use-client]`
> Tout module dans `apps/web/lib/` qui réexporte ou wrappe un singleton client de bibliothèque tierce (Sonner, autres stores avec subscription) DOIT avoir la directive `"use client"` en ligne 1 du fichier. Sans cette directive, Next.js App Router peut résoudre deux instances du singleton entre boundaries server/client. Découvert R9-6b.

### `[ui-no-useTransition-with-toast-in-callback]` (tentative)
> Dans un composant client, éviter le pattern `startTransition(async () => { await ServerAction; toast.success(...) })` car peut causer une double-émission du toast dans certaines conditions React 19 + Sonner non encore identifiées précisément. Préférer `useState<boolean>` pour `isPending` avec try/finally. Calque référence : `ArchivePrestationButton.tsx`. Découvert R9-6 / R9-6c.

> **Note** : invariant proposé avec réserve. Le bug fantôme R9-6c rend le diagnostic incertain. À confirmer ou retirer après observation R10.

### `[customer-scope-via-requireCustomer]`
> Tout accès à une donnée customer-side (page Server Component, server action) DOIT dériver le `clientId` exclusivement de la session via `requireCustomer()` (ou helper équivalent). Le `clientId` ne doit JAMAIS être pris d'un paramètre URL, body, ou prop client. Le RBAC service-side doit vérifier la relation user→client_contacts→client→ressource avant toute mutation. Pattern de référence : R9-7 `acceptCustomerQuoteAction`.

### `[zod-refine-multi-transport-audit]`
> Tout YAML qui ajoute, modifie ou étend un transport (SMTP, Resend, autre) ou un mode (sync/async, providers multiples) DOIT auditer les `refine` du schéma `@saas/config` pour vérifier que le contrat config reflète toujours la réalité du runtime. Pattern non-audit risque : booting impossible alors que le runtime supporterait le mode. Découvert R9-3 / R9-3b.

### `[done-definition-dom-checkpoint-for-feedback-ui]`
> Tout YAML qui touche du feedback UI visible (toast, modal, banner, navigation, redirect) DOIT inclure dans son `done_definition` un checkpoint manuel **avec assertion DOM directe** OU un test e2e Playwright qui assert le rendu DOM. Les unit tests qui mockent le helper de feedback ne suffisent pas. Découvert R9-6b.

### `[orchid-os-docs-system-strictly-read-only]`
> Aucun YAML projet (SaaS Agentique, future Ludo-Mind, etc.) ne doit modifier les fichiers sous `docs/system/` (Orchid-OS shared docs). Tous les docs projet vivent workspace-side dans `docs/` ou `docs/<sous-dossier>/`. Memory invariant existant, à confirmer dans le doc workspace-side pour visibilité immédiate phase_1 lors des audits.

---

## 6. Backlog R10 priorisé

### Tier 1 — Bloquants techniques ou UX visibles

**R10-1 — PDF generation (devis + factures)**
- Friction #18 du guide R9-2 (`InvoiceRow.pdfUrl` placeholder mort)
- Effort M-L
- Décisions à trancher :
  - Stack rendu : `@react-pdf/renderer` (React SSR, plus simple) vs Puppeteer (browserful, plus de fidélité visuelle)
  - Stockage : R2 (calque pattern reports R4) ou streaming inline
  - Template visuel : matcher les tokens Apex post-polish ou template basique en attendant
- Préreqs : décider stack avant scope précis

**R10-2 — Polish UI Apex dashboard tokens**
- Backlog initial sprint R9 décalé (priorité frictions)
- Couvre :
  - Extraction tokens `tailwind.config.ts` depuis screenshots Apex-shadcn (emerald glow, near-black oklch, amber/red/blue/violet status palette)
  - Refresh pages admin (dashboard, listes, fiches détail)
  - Refresh `/account/page.tsx` (les 3 cards stats minimalistes actuelles méritent un polish, Cédric l'a noté)
- Effort M sur 4-5 YAMLs (extraction → dashboard → listes → fiches → forms)
- Invariant `[ui-design-tokens-via-tailwind-config]` à graver en parallèle

**R10-3 — Refactor entreprise/contact (`clients` table)**
- Décrit dans le handover R8 initial sprint R9, repoussé car frictions bloquantes prioritaires
- Insight R9-1 audit Q2 : modèle déjà partiellement en place
  - `clients.type` ∈ `company | individual` (discrimination présente)
  - Table `client_contacts` existante avec `isPrimary` modélisé
- Refactor cible :
  - Rename sémantique `clients` → `companies` (à arbitrer)
  - Extraction `name/email/phone` actuellement sur `clients` vers `client_contacts.isPrimary=true`
- Q2 handover R8 : `is_primary` confirmé Cédric R9. Procéder sur cette base.
- Effort réel probablement plus léger que 8 YAMLs initialement estimés (memory)

### Tier 2 — Follow-ups R9

**R10-F1 — Bannière 2FA refresh post-activation**
- Friction observée fin R9-8c : la bannière `TwoFactorBanner` reste affichée après activation 2FA jusqu'au logout/login
- Cause : `totpEnabled` lu une fois au mount du layout, pas rafraîchi automatiquement
- Fix probable : `router.refresh()` après activation 2FA réussie côté `/account/security/setup`
- Effort S trivial, blast radius ~1 fichier prod
- Carry-over depuis R9-8c done definition

**R10-F2 — E2E coverage gap admin**
- Audit R9-1 Q5 a flaggé routes admin non couvertes : `/admin`, `/admin/clients` (list), `/admin/clients/new`, `/admin/prestations`, `/admin/users`, `/admin/agent-tasks`
- Plusieurs de ces routes ont été enrichies en R9 (clients en R9-4, prestations en R9-5, users en R9-6) sans ajout e2e
- Effort M sur 2-3 YAMLs (un par zone fonctionnelle)
- Bénéfice anti-régression important pour le polish UI R10

**R10-F3 — E2E coverage gap customer**
- Routes non couvertes : `/account` dashboard, `/account/quotes/[id]` détail
- R9-7 a posé tests unit composant mais pas de e2e
- Effort S sur 1-2 YAMLs

**R10-F4 — Dette technique audit transport (cohérence R9-3)**
- Mémoire R5 : "2 clients Resend coexistent" → R7-d1 a consolidé le client Resend en lazy singleton
- R9-3 a dupliqué la cascade `createSmtpTransport` dans `notification.service.ts` (calque `email.service.ts`) plutôt qu'extraire un helper partagé (décision blast radius minimal documentée)
- Si Cédric veut consolider DRY : extraire `packages/services/src/email-transport.ts` shared
- Effort S, sans urgence
- À évaluer R10 ou laisser tomber si pas de bénéfice tangible

### Tier 3 — Hygiène et observabilité

**R10-H1 — Logger structuré stripe.service** (carry-over R8)
- `stripe.service.ts` utilise encore `console.*` au lieu du logger structuré R8
- Calque R8 log4 sur les autres services
- Effort S

**R10-H2 — TS dette pré-existante (`tsc --noEmit` racine)**
- Plusieurs YAMLs R9 ont noté des erreurs TS pré-existantes (JSX flag, module resolution `@/...`) que `tsc --noEmit` à la racine remonte mais qui sont en réalité des fausses positives liées au tsconfig racine non configuré pour Next.js
- Memory invariant : "`check-types` evidence = `pnpm --filter check-types` ou CI job, JAMAIS `npx tsc --noEmit` racine"
- Possibilité : créer une config TS racine qui ne tente pas de typer les workspaces individuellement
- Effort S, sans urgence

**R10-H3 — Graver invariants R9 dans `docs/structural-invariants.md`**
- Les 6 invariants proposés en section 5 ci-dessus
- Effort S, 1 YAML hygiène
- À faire **avant** R10-1 PDF generation pour bénéficier des invariants pendant l'audit phase_1

---

## 7. Carry-overs et dette technique

### Carry-over guide test manuel
- Mettre à jour `docs/r9-rapport-test-manuel.md` (à produire via YAML R9-final, voir suivant)
- Section D du guide R9-2 : cocher toutes les frictions résolues avec note "résolu par R9-X"
- Ajouter section E mention du bug fantôme R9-6c

### Dette technique connue
- `a1#2` batch DELETE avec LIMIT clause : encore reporté post multi-tenant (R8 memory)
- Invariant `[saas-app-invariants-workspace-side]` : devrait être documenté workspace-side pour visibilité immédiate phase_1 (currently inferred from R8 incident memory)
- `payment.amountEurCents` naming inconsistency : rename debt connue

### Multi-tenant migration (post-MVP, R14+ probable)
- `owner_id` columns sur 8 business tables
- Composite unique constraints
- R2 storage key prefixing
- Stripe metadata conventions déjà documentées dans `multi-tenant-readiness.md`
- Inchangé par R9

---

## 8. Process learnings sprint R9

### Ce qui a bien marché

**Un YAML → un commit → un checkpoint manuel.** Cette boucle serrée a permis de catch les bugs runtime (toast, double-toast, bannière stale) immédiatement, avant accumulation. Sans le test manuel exhaustif R9-2, les findings R9-6b et R9-6c seraient restés cachés jusqu'à un client externe.

**Phase_1 audit empirique systématique.** Plusieurs YAMLs ont bénéficié du diagnostic phase_1 pour ajuster le scope :
- R9-4 : 3 cas A/B/C selon existence fns service `listQuotesForClient`
- R9-5 : 4 cas α/β/γ/δ pour bug ownerId
- R9-8b : 3 occurrences `/profile` au lieu d'1 (registerAction + loginAction + totpVerifyAction)
- R9-8c : décision CAS A (flows existants) vs B (placeholders) selon découverte route `/account/security/setup` existante

L'audit phase_1 a évité plusieurs faux scope qui auraient conduit à des YAMLs sous-spécifiés.

**Hard-readonly enforced sur fichiers stabilisés.** À partir de R9-6, les YAMLs suivants ont systématiquement listé `actions/admin.ts`, `lib/toast.ts`, et `schema.ts` comme hard-readonly via AC strict (`git diff --name-only` doit être vide dessus). Zéro régression post-stabilisation.

### Ce qui mérite de la discipline en R10

**TDD réel vs "tests écrits après impl".** Plusieurs impl.md R9 ont noté "tests passent direct au premier run, green first" en avouant que le code était écrit avant. Pas un bug (les tests existent et couvrent) mais perd la valeur de TDD comme outil d'exploration. À surveiller : si récurrent en R10, redresser via instruction phase_2 plus stricte.

**Checkpoints manuels obligatoires pour feedback UI.** Cf finding 4. À graver en invariant `[done-definition-dom-checkpoint-for-feedback-ui]`.

**Investigation profonde vs accepter le bug fantôme.** R9-6c a été annulé sans investigation profonde de la cause React 19 + Sonner. C'est pragmatique mais laisse une dette de connaissance. À reprendre si récidive.

### Métriques sprint R9

- **12 YAMLs ACCEPTED** sans REJECTED retour TL
- **0 régression sur la suite test** introduite (+65 tests entre baseline R8 1332 et fin R9 1397)
- **0 violation blast radius** sur les 12 YAMLs
- **0 incident docs/system/** (invariant R8 préservé)
- **10/11 frictions bloquantes résolues** (90.9%)
- **2 frictions découvertes en cours**, dont 1 résolue immédiatement (#redirect post-login → R9-8b) et 1 carry-over R10 (bannière 2FA stale)
- **2 findings systémiques** (toast use client + Zod refine multi-transport) résolus dans le sprint
- **1 bug fantôme** non résolu mais non reproductible (useTransition double-toast)

---

## 9. État de préparation R10

### Prérequis avant lancement R10
- [ ] Commit final R9 avec section D guide R9-2 entièrement cochée
- [ ] Rapport `docs/r9-rapport-test-manuel.md` produit (YAML R9-final, voir suivant)
- [ ] Invariants R9 (section 5) gravés dans `docs/structural-invariants.md` workspace-side (YAML hygiène R10-H3)
- [ ] Decision stack PDF generation R10-1 (`@react-pdf/renderer` vs Puppeteer) à arbitrer Cédric
- [ ] Décision priorisation Tier 1 : PDF vs polish UI vs refactor entreprise/contact

### Arbitrages ouverts pour R10

**Q1 — Stack PDF generation R10-1 :**
- (a) `@react-pdf/renderer` — pur React, plus simple à intégrer, contrôle layout précis
- (b) Puppeteer — fidélité visuelle parfaite, HTML/CSS standard, mais browserful en runtime
- (c) HTML-to-PDF via service externe (DocRaptor, PDFCrowd, etc.) — externalise le problème mais coût + dépendance réseau

**Q2 — Ordre Tier 1 :**
- (a) PDF d'abord (débloque #18, gros gain UX customer)
- (b) Polish UI d'abord (les PDFs auront la bonne identité visuelle dès le départ)
- (c) Refactor entreprise/contact d'abord (sécurise le modèle avant tout polish)

**Q3 — Refactor entreprise/contact : rename `clients` → `companies` :**
- (a) Faire le rename complet (cohérence sémantique parfaite mais blast radius énorme)
- (b) Garder `clients` table, juste extraire les contacts (rename mental sans rename code, blast radius S-M)
- Recommandation handover R8 → R9 : (b), à reconfirmer début R10

---

**Sprint R9 boucle. Anthropic instance suivante : reprend ici. Cédric : prochain step recommandé = lancer YAML R9-final (rapport test manuel) puis commit final guide R9-2, puis décision arbitrages R10.**

— Fin handover R9
