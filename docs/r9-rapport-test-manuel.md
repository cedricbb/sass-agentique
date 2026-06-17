# Rapport d'exécution — Test manuel R9

## 1. En-tête

| Champ | Valeur |
|---|---|
| Sprint | R9 — pause feature dev (UX/UI + observabilité humaine + refactor structurel léger) |
| Date d'exécution | Juin 2026 |
| Exécutant | Cédric |
| Durée totale estimée | 2–3 h de test + N cycles de correction (12 YAMLs) |
| Guide source | `docs/guide-test-manuel-r9.md` |
| Handover sprint | `docs/handover-r9-complete-ready-for-r10.md` |

---

## 2. Synthèse exécutive

L'exécution du guide de test manuel R9-2 a révélé **21 frictions** consignées en Section D, dont **11 bloquantes**. Sur ces 11 bloquantes, **10 ont été résolues** dans le sprint (R9-3 à R9-8c), soit un ratio de **90,9 %**. La seule friction bloquante non résolue (#18 — génération PDF) a été reportée en R10 par décision explicite de Cédric (effort M-L, hors scope sprint). En cours de sprint, **4 frictions nouvelles** ont été découvertes lors des validations : 3 résolues immédiatement (redirect post-login, toast invisible, Zod refine), 1 carry-over R10 (bannière 2FA stale). Deux bugs systémiques majeurs (toast sans `"use client"` affectant 28 call sites depuis R4-R5, Zod refine multi-transport) ont été détectés et corrigés. Aucun YAML n'a nécessité de REJECTED retour TL.

---

## 3. Frictions bloquantes — Section D complète

> 21 frictions totales de la Section D du guide. Les frictions #16 dupliquées ont été distinguées en #16a (C2.3) et #16b (C3.1).

| # | Section | Étape | Sévérité initiale | Status | Résolu par |
|---|---|---|---|---|---|
| 1 | A | A2 — création client | gênant | NON TRAITÉ (hors scope) | — |
| 2 | A | A4 — email devis non envoyé | bloquant | FIXÉ | R9-3 + R9-3b |
| 3 | A | A6 — pas de lien facture depuis devis | gênant | NON TRAITÉ (hors scope) | — |
| 4 | A | A9 — historique absent fiche client | bloquant | FIXÉ | R9-4 |
| 5 | A | A10 — mails MailHog absents | bloquant | FIXÉ | R9-3 + R9-3b |
| 6 | B | B2.1 — pas de colonne type clients | gênant | NON TRAITÉ (hors scope) | — |
| 7 | B | B2.2 — pas de slug automatique | gênant | NON TRAITÉ (hors scope) | — |
| 8 | B | B2.3 — historique fiche client (doublon #4) | bloquant | FIXÉ | R9-4 |
| 9 | B | B3.1 — colonnes prestations incomplètes | gênant | NON TRAITÉ (hors scope) | — |
| 10 | B | B3.2 — création prestation cassée (ownerId) | bloquant | FIXÉ | R9-5 |
| 11 | B | B3.4 — pas de bouton archivage prestation | bloquant | FIXÉ | R9-5 |
| 12 | B | B4.1 — clients créés en R9 absents de /users | gênant | NON TRAITÉ (hors scope) | — |
| 13 | B | B4.2 — ban/unban sans feedback (modale + toast) | bloquant | FIXÉ | R9-6 + R9-6b |
| 14 | C | C1.2 — libellé email invitation (nom app) | cosmétique | NON TRAITÉ (hors scope) | — |
| 15 | C | C2.2 — message "mots de passe non correspondants" absent | gênant | NON TRAITÉ (hors scope) | — |
| 16a | C | C2.3 — liaison compte existant non testable | gênant | NON TRAITÉ (hors scope) | — |
| 16b | C | C3.1 — dashboard customer vide (0 devis) | bloquant | FIXÉ | R9-8 |
| 17 | C | C3.2 — customer ne peut pas accepter/décliner devis | bloquant | FIXÉ | R9-7 |
| 18 | C | C3.3 — pas de PDF téléchargeable | bloquant | REPORTÉE R10 | — |
| 19 | C | C3.4 — colonne status absente /account/payments | gênant | NON TRAITÉ (hors scope) | — |
| 20 | C | C4.1 — profil : seul le nom est modifiable | gênant | NON TRAITÉ (hors scope) | — |
| 21 | C | C4.2 — /account/security non accessible depuis profil | bloquant | FIXÉ | R9-8c |

**Récapitulatif :**
- Frictions bloquantes : 11 → 10 résolues, 1 reportée R10 (#18)
- Frictions gênantes : 9 → toutes non traitées (hors scope sprint R9)
- Frictions cosmétiques : 1 → non traitée (hors scope)
- Numérotation dupliquée (#16) : distinguée #16a (C2.3) / #16b (C3.1) dans ce rapport

---

## 4. Frictions découvertes en cours de sprint

> Frictions identifiées lors des validations post-implémentation, hors guide initial.

| Source | Description | Status | Résolu par |
|---|---|---|---|
| Validation R9-7 | Redirect post-login customer → `/profile` au lieu de `/account` (3 occurrences dans registerAction, loginAction, totpVerifyAction) | Résolu | R9-8b |
| Validation R9-6 | Toasts invisibles malgré tests verts (store Sonner dédoublé server/client) | Résolu | R9-6b |
| Validation R9-6b | Double toast ban/unban après fix toast (useTransition + Sonner) | Bug fantôme — disparu spontanément, en surveillance | R9-6c annulé |
| Validation R9-8c | Bannière 2FA reste affichée après activation jusqu'au logout/relogin | Carry-over R10 | R10-F1 |

---

## 5. Findings systémiques

### Finding 1 — `apps/web/lib/toast.ts` sans `"use client"` (R9-6b)

`toast.ts` réexportait `toast` de Sonner sans la directive `"use client"`. Next.js App Router résolvait deux instances du singleton : le helper écrivait dans le store server (jamais lu), le `<Toaster>` client lisait son propre store (jamais alimenté). **28 call sites** étaient silencieux depuis R4-R5. Fix : ajout `"use client";` ligne 1. Résolution rétroactive de tous les call sites. Invariant gravé : `[ui-toast-helper-use-client]`.

### Finding 2 — `useTransition` + `await Server Action` + `toast.success` cause double-toast (R9-6c)

Post fix R9-6b, deux toasts identiques apparaissaient sur chaque action ban/unban. Cause probable : interaction React 19 + Server Action + Sonner singleton dans `startTransition` replay. Le bug a **disparu spontanément** après cycle dev/restart — cause exacte indéterminée (cache HMR pollué, build cache). YAML R9-6c annulé après confirmation 5-10 cycles stable. Statut : **bug fantôme**, en surveillance R10. Invariant proposé avec réserve : `[ui-no-useTransition-with-toast-in-callback]`.

### Finding 3 — Zod refine obsolète post-évolution multi-transport (R9-3b)

Refine Zod écrit en R5 pour Resend uniquement. R9-3 (ajout cascade SMTP) a étendu le transport sans adapter le refine → boot impossible avec `NOTIFICATIONS_ENABLED=true` + `SMTP_HOST` + sans `RESEND_API_KEY`. Fix : refine élargi pour accepter `SMTP_HOST` OU `RESEND_API_KEY`. Invariant gravé : `[zod-refine-multi-transport-audit]`.

### Finding 4 — Decoupling tests stubs / runtime behavior (R9-5, transverse)

Pattern récurrent sur plusieurs YAMLs : unit tests mockent les couches voisines (toast, server actions) et perdent la fidélité runtime. Toast, double-toast, bannière 2FA stale — tous passaient verts en tests mais avaient un comportement runtime incorrect. Invariant gravé : `[done-definition-dom-checkpoint-for-feedback-ui]`.

---

## 6. Métriques sprint

| Métrique | Valeur |
|---|---|
| YAMLs livrés | 12 (7 feat + 5 fix) |
| YAMLs REJECTED | 0 |
| Frictions bloquantes résolues | 10/11 (90,9 %) |
| Tests baseline (avant → après sprint) | 1332 → 1397 (+65) |
| Blast radius moyen par YAML | ~3-5 fichiers |
| Violations blast radius | 0 |
| Violations `docs/system/` | 0 |
| Findings systémiques | 4 (2 résolus dans le sprint, 1 bug fantôme, 1 pattern transverse) |
| Invariants proposés workspace-side | 6 (`[ui-toast-helper-use-client]`, `[ui-no-useTransition-with-toast-in-callback]`, `[customer-scope-via-requireCustomer]`, `[zod-refine-multi-transport-audit]`, `[done-definition-dom-checkpoint-for-feedback-ui]`, `[orchid-os-docs-system-strictly-read-only]`) |

---

## 7. Carry-overs vers R10

| ID | Description | Priorité | Effort estimé |
|---|---|---|---|
| #18 PDF | Friction C3.3 : `InvoiceRow.pdfUrl` est un placeholder mort, aucun backend de génération PDF n'existe. Decision stack à trancher (`@react-pdf/renderer` vs Puppeteer vs service externe). | Tier 1 bloquant UX customer | M-L |
| Bannière 2FA refresh | Bannière `TwoFactorBanner` reste affichée après activation 2FA jusqu'au logout/relogin. Fix probable : `router.refresh()` après activation réussie dans `/account/security/setup`. | Tier 2 follow-up | S trivial (~1 fichier) |
| Bug fantôme R9-6c | Double-toast `useTransition` + Sonner sous React 19. Non reproductible après cycle dev/restart. En surveillance ; YAML R9-6c en réserve si récidive. | Surveillance | S si récidive |

> Voir `docs/handover-r9-complete-ready-for-r10.md` section 6 (backlog R10 complet) et section 7 (dette technique connue) pour le détail des carry-overs non liés au test manuel.

---

## 8. Recommandations méthodologiques

### R1 — Ajouter un checkpoint DOM explicite pour tout YAML touchant le feedback UI

Les tests unitaires qui stubent `toastResult` ne détectent pas les bugs de store dédoublé (Finding 1 et 2). Pour chaque YAML UI-visible (toast, modal, banner, redirect), le `done_definition` doit inclure une assertion DOM directe ou un test e2e Playwright qui assertent le rendu réel. Voir invariant `[done-definition-dom-checkpoint-for-feedback-ui]`.

### R2 — Auditer les refines Zod à chaque YAML qui étend un transport ou mode

Tout YAML ajoutant un transport (SMTP, Resend, autre) ou un mode doit systématiquement auditer le schéma `@saas/config` pour éviter le drift (Finding 3). Graver dans le template pré-YAML TL comme critère systématique.

### R3 — Distinguer les frictions "gênant" et les prioriser explicitement en début de sprint

Sur les 9 frictions gênantes de la Section D, aucune n'a été adressée en R9. Certaines (#1 slug automatique, #7, #19 colonne status payments) auraient un impact UX tangible pour un effort S. Recommandation : début de chaque sprint suivant, relire les frictions gênantes et décider explicitement si ≥1 entre dans le scope sprint.

### R4 — Prénuméroter les entrées Section D de façon unique dans le guide

La Section D avait deux entrées #16 (C2.3 et C3.1), causant une ambiguïté dans le référencement YAML. Utiliser une numérotation séquentielle globale (1 à N) ou ajouter un suffixe de section dès la saisie.

### R5 — Tester `linkExistingAccountAction` en environnement contrôlé (friction #16a)

La friction C2.3 (liaison compte existant) n'a pas pu être testée faute de setup reproduisant la condition "email déjà invité + compte existant". Préparer un fixture dédié (seed utilisateur avec compte existant + token d'invitation généré programmatiquement) pour rendre ce cas testable lors du prochain cycle de test manuel.

### R6 — Graver les invariants R9 avant tout YAML R10

Les 6 invariants documentés dans `docs/handover-r9-complete-ready-for-r10.md` section 5 doivent être gravés dans `docs/structural-invariants.md` workspace-side **avant** de lancer les YAMLs R10 (en particulier avant R10-1 PDF et R10-2 polish UI). YAML R10-H3 à exécuter en premier.

---

*Ce rapport est l'artefact de clôture qualité du sprint R9. Il se réfère au handover technique `docs/handover-r9-complete-ready-for-r10.md` pour les décisions architecturales et la passation inter-sprint. Les deux documents coexistent et se complètent sans duplication.*
