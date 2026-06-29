# Structural Invariants — SaaS Agentique

Ce document liste les invariants structurels applicatifs du projet SaaS
Agentique. Il a la même autorité, dans le périmètre du projet, que les
invariants Strate 1 d'Orchid-OS — mais sa portée est limitée à ce repo.

**Articulation avec Orchid-OS** : Orchid-OS définit des invariants
project-agnostic (paths canoniques de task folder, format de task_id, output
filenames par task_type, lifecycle des chaînes, etc.) dans
`docs/system/01-STRUCTURAL-INVARIANTS.md` de son propre repo. Ces
invariants-là s'appliquent à TOUS les projets orchestrés par Orchid-OS et
ne sont pas à dupliquer ici. Le présent document complète, il ne remplace
pas.

**Propagation Strate 6 RAG** : les invariants ci-dessous doivent être cités
dans les sections `## Invariants pris en compte` des outputs TL (`design.md`,
`rca.md`, `analysis.md`) des tâches SaaS Agentique qui les touchent. Le
parser d'invariants Orchid-OS les extraira et les persistera dans la table
`architectural_invariants` (Strate 6), assurant leur injection automatique
dans les futurs prompts TL par similarité d'embedding.

**Origine** : les 5 invariants ci-dessous ont été validés empiriquement par
le sprint R7 (12 YAMLs livrés en juin 2026). Chacun a un ancrage PR/YAML
explicite.

---

## [env-vars-centralized-saas-config]

Toute env var applicative consommée par le code TypeScript doit passer par le
module `@saas/config` (validation Zod typée, défaut explicite si optionnel),
jamais `process.env.X` directement dans le code applicatif.

Exceptions tolérées : `apps/web/lib/env.ts` lui-même, et les fichiers de
bootstrap Next.js (`next.config.js`, `instrumentation.ts`) si techniquement
contraints.

Ancrage R7 : `fix-r7-d3-notifications-enabled-config` (PR #249) — migration
`NOTIFICATIONS_ENABLED` de `process.env` direct vers `@saas/config` Zod
`z.enum(["true","false"]).transform(...).default("false")`.

Ancrage R8 : `fix-r8-d3b-stripe-webhooks-enabled-config` — migration
`STRIPE_WEBHOOKS_ENABLED` selon le même pattern. Défaut `"false"` (strict
opt-in, cohérent avec le comportement historique `!== "true"` + absent →
disabled).

Justification : empêche les bugs silencieux (env var manquante = comportement
imprévisible), centralise la validation et la documentation, autorise les
défauts explicites.

Test grep-based recommandé : `no_process_env_direct` — grep `process.env\.`
hors des fichiers exemptés, fail si match > 0.

## [sdk-secret-lazy-singleton]

Tout SDK externe initialisé avec un secret (clé API, token long-lived) doit
vivre dans un module lazy singleton centralisé du package `@saas/services` :

- Pattern d'accès `getXxxClient()` qui instancie au premier appel.
- Hash SHA-256 hex de la clé stocké en heap pour diagnostic, jamais la clé
  brute.
- Helper `__resetXxxClientForTests()` pour isolation tests.
- Accessor test-only `__getXxxClientKeyHashForTests()` non re-exporté via
  `index.ts` du package (consommable seulement par chemin profond depuis
  tests internes).

Aucune instanciation inline (`new Stripe()`, `new Resend()`) tolérée hors du
module singleton dédié.

Ancrage R7 : `fix-r7-a3-stripe-client-key-hash` (PR #242),
`fix-r7-d1-resend-client-consolidation` (PR #252). Le second a découvert que
`email.service` instanciait `new Resend()` à chaque envoi — exemple direct
du risque que l'invariant prévient.

Justification : (1) clé brute en heap module-level expose à un memory dump,
(2) instanciations multiples = surcharge réseau et difficulté à mocker en
test, (3) hash SHA-256 reste utile pour les logs de diagnostic sans exposer
la valeur.

Test grep-based recommandé : `no_inline_new_<sdk>` — fail si `new Stripe(`
ou `new Resend(` apparaît hors du module client dédié.

## [ui-constants-shared-subpath]

Toute constante ou pure fonction destinée à un affichage Client Component
(label i18n, status mapping, icon mapping, formatter pur) doit vivre dans
un module `<domain>.shared.ts` :

- Zéro import depuis le package `@saas/db` ou `@saas/services` core (pure
  fonctions / constantes uniquement).
- Exposée via un subpath dans `package.json` du package porteur
  (ex: `@saas/services/report.shared`).
- Re-exportée depuis le module principal pour rétro-compat backend si
  nécessaire.

Les Client Components doivent importer exclusivement le subpath `.shared`,
jamais le barrel principal du package (qui tire les dépendances serveur).

Ancrage R7 : `feat-r7-d2-report-kind-labels-shared` (PR #251) — éliminé 5
duplicatas de labels `reportKindLabels` dans `apps/web` au profit du subpath.

Justification : (1) sans cette discipline, les Client Components dupliquent
les constantes pour éviter de tirer `@saas/services` dans le bundle client,
(2) la duplication mène à la divergence, (3) le subpath donne source unique
+ bundle client léger.

Test grep-based recommandé : `no_direct_service_imports` côté composants
Client.

## [amount-cents-ht-ttc-jsdoc]

Tout champ DB ou propriété TypeScript stockant un montant en cents doit
documenter explicitement sa sémantique HT ou TTC dans la JSDoc adjacente,
quel que soit le nom de la propriété. Le nom de la propriété doit rester
neutre (`amountCents`, `totalCents`) ; la sémantique vit dans la JSDoc, pas
dans le nom. Toute fonction qui retourne un montant cents doit également
documenter sa sémantique HT/TTC dans la JSDoc.

Ancrage R7 : `feat-r7-e1a-payment-amount-cents-rename-schema` (PR #254) —
rename `amountEurCents` → `amountCents` + ajout JSDoc TTC explicite. Le nom
`amountEurCents` suggérait HT à plusieurs lecteurs alors que la sémantique
effective était TTC — ambiguïté révélée par une série de bugs en R5/R6.

Justification : les noms évoluent (devise, granularité), la sémantique HT/TTC
est une donnée business qui ne doit pas dépendre d'un nom. La JSDoc est lue
par les IDE en hover et par les agents Orchid pendant phase_1, c'est
l'endroit canonique.

Note : `computeInvoiceBalance` retourne HT (rétro-compat R5 webhook) — cette
exception est documentée en JSDoc in situ.

## [recompute-derived-state-idempotent]

Tout recompute d'état financier dérivé (e.g. `paidAt` d'une facture, totaux
d'une commande, solde courant d'un compte) doit être encapsulé dans une
fonction pure nommée et idempotente :

- Pas de logique inline dans un créateur d'entité (handler, route, action).
- Signature explicite avec input/output typés.
- Idempotente : `recompute(recompute(x)) === recompute(x)`.
- Testée unitairement avec au moins un cas idempotence.

La fonction doit être appelée depuis tous les call-sites qui modifient
l'état financier source, jamais re-dupliquée inline.

Ancrage R7 : `feat-r7-f1-recompute-paidat-extraction` (PR #245) — découverte
d'une duplication latente où `recomputePaidAt` existait déjà mais un
call-site la dupliquait inline ; l'extraction a également révélé un bug
guard manquant dans `canTransitionInvoice`. Calque dans
`feat-r7-f2-payment-intent-pure-fn` (PR #247).

Justification : (1) duplication inline = divergence garantie à terme,
(2) idempotence permet de re-jouer un poll fallback sans corrompre l'état,
(3) une fonction nommée est testable unitairement isolément du flux Inngest
qui l'appelle.

---

## Invariants R9

Les 5 invariants ci-dessous ont été validés empiriquement par le sprint R9.
Chacun a un ancrage YAML/PR explicite. Ils s'appliquent dès R10-1.

## [ui-toast-helper-use-client]

Tout module dans `apps/web/lib/` qui réexporte ou wrappe un singleton client
de bibliothèque tierce (Sonner, autres stores à subscription) DOIT porter la
directive `"use client"` en ligne 1. Sans elle, Next.js App Router peut
résoudre deux instances du singleton entre boundaries server/client : le
helper écrit dans un store jamais lu côté client, rendant le feedback UI
silencieux malgré un appel réussi.

Ancrage R9-6b : `fix-r9-6b-toast-use-client` — découverte que l'absence de
`"use client"` dans le helper toast affectait 28 call sites simultanément.

Justification : Next.js App Router instancie les modules server et client
séparément ; un singleton tel que Sonner `toast` est un state client-only.
Le marquer `"use client"` force Next.js à résoudre une seule instance dans
le boundary correct.

## [customer-scope-via-requireCustomer]

Tout accès à une donnée customer-side (Server Component, server action) DOIT
dériver le `clientId` exclusivement de la session via `requireCustomer()` (ou
équivalent strict). Jamais d'un paramètre URL, body, ou prop client. Le RBAC
service-side vérifie la relation `user → client_contacts → client → ressource`
avant toute mutation.

Ancrage R9-7 : `fix-r9-7-accept-customer-quote-action` — `acceptCustomerQuoteAction`
dérivait le `clientId` d'un paramètre action au lieu de la session, ouvrant
une élévation de privilège inter-client.

Justification : tout paramètre client-side est forgeable. La session est
l'unique source d'identité vérifiée côté serveur.

## [zod-refine-multi-transport-audit]

Tout YAML qui ajoute, modifie, ou étend un transport (SMTP, Resend, autre)
ou un mode (sync/async, providers multiples) DOIT auditer les `refine` du
schéma `@saas/config` pour vérifier que le contrat config reflète toujours
la réalité runtime. Un `refine` obsolète peut bloquer le boot alors que le
runtime supporterait le mode demandé.

Ancrage R9-3 : `fix-r9-3-zod-refine-multi-transport` et `fix-r9-3b-*` —
un `refine` qui interdisait la combinaison `SMTP + Resend` a causé un boot
impossible après activation d'un second transport, pourtant supporté.

Justification : les `refine` Zod sont des garde-fous qui deviennent des
obstacles si le modèle mental de la config diverge de l'implémentation réelle.
Chaque extension de transport doit resynchroniser les deux.

## [done-definition-dom-checkpoint-for-feedback-ui]

Tout YAML touchant du feedback UI visible (toast, modal, banner, navigation,
redirect) DOIT inclure dans son `done_definition` un checkpoint manuel avec
assertion DOM directe OU un test e2e Playwright qui asserte le rendu DOM.
Les unit tests qui mockent le helper de feedback ne suffisent pas : ils
valident que le helper est appelé, pas que l'utilisateur voit quelque chose.

Ancrage R9-6b : `fix-r9-6b-toast-use-client` — les tests unitaires passaient
au vert (mock du helper) alors que le toast n'apparaissait jamais en runtime
à cause du double-singleton.

Justification : le feedback UI implique une chaîne de rendu (helper → store →
composant React → DOM) que seule une assertion DOM ou e2e valide de bout en
bout.

## [orchid-os-docs-system-strictly-read-only]

Aucun YAML projet (SaaS Agentique, futures apps) ne doit modifier les
fichiers sous `docs/system/` (documentation Orchid-OS partagée). Tous les
invariants et docs propres à un projet vivent workspace-side dans `docs/`
ou `docs/<sous-dossier>/` du repo projet.

Ancrage R9-meta : `feat-grave-invariants-r9` — ce YAML lui-même applique
l'invariant en écrivant dans `docs/structural-invariants.md` (workspace SaaS)
et non dans `docs/system/`.

Justification : `docs/system/` est géré par Orchid-OS. Une modification
projet-side crée un drift non tracé entre le repo Orchid-OS et les workspaces
qui le consomment.

---

## Invariants R10

## [orchid-container-cannot-verify-db-push]

Le container orchid-os ne peut pas joindre la DB SaaS live ; son `drizzle-kit push`
/introspection peut même produire de faux ZodError. Tout YAML modifiant
`schema.ts` se vérifie donc en DEUX TEMPS :

- **EN CONTAINER** (auditable par Orchid) : édition `schema.ts` + `pnpm --filter
  check-types` + `pnpm --filter @saas/db check` (cohérence schema sans DB live).
- **CÔTÉ HÔTE** (`human_validation`, Pattern 14) : `pnpm --filter @saas/db push`
  réel + assertions DB (colonne/table présente).

Une phase_2/QA NE DOIT JAMAIS exiger un `push` ou un `psql` réussi depuis le
container, ni fabriquer une preuve DB côté container. Un "ACCEPTED AVEC RÉSERVES"
pour cause d'impossibilité de push container est ATTENDU et non bloquant : la
confirmation push se fait côté hôte. drizzle reste push-only (jamais migrate).

Ancrage R10-1b : `feat-grave-invariant-db-push` — découvert post-mortem R10-1b ;
confirmé empiriquement depuis l'hôte (`pnpm --filter @saas/db push` → `Changes
applied`, pdf_key appliqué), pendant que l'introspection container retournait un
faux ZodError.

Justification : l'isolation réseau du container orchid-os est structurelle et
intentionnelle. La vérification schema en deux temps est le seul workflow correct
pour tout YAML touchant `schema.ts` dans un projet SaaS avec DB live.

---

## Observations à confirmer

Les entrées ci-dessous sont des hypothèses diagnostiques remontées lors du
sprint R9 mais **non confirmées de façon déterministe**. Elles NE SONT PAS
des invariants durs. Elles ne doivent pas être citées dans les sections
`## Invariants pris en compte` des outputs TL sans mention explicite de leur
statut TENTATIVE. Chaque entrée indique sa condition de promotion ou de retrait.

## [ui-no-useTransition-with-toast-in-callback]

**TENTATIVE — à confirmer ou retirer après observation R10.**

Dans un composant client, le pattern
`startTransition(async () => { await ServerAction; toast.success(...) })`
a causé une double-émission de toast sur les actions ban/unban en R9,
persistant en build prod. Le bug a disparu spontanément après cycle
dev/restart (bug fantôme R9-6c, cause React 19 + Sonner non identifiée).

Référence alternative connue fonctionnelle : `ArchivePrestationButton.tsx`
(pattern `useState` + `try/finally` sans `startTransition`).

Condition de promotion en invariant dur : reproduction déterministe en
environnement isolé (test e2e ou unit React 19 + Sonner) permettant
d'identifier la cause exacte (scheduling React 19, Sonner store, ou
interaction des deux).

Condition de retrait : absence de nouvelle occurrence en R10 + confirmation
que le fix `"use client"` ([ui-toast-helper-use-client]) était la cause
réelle et que ce pattern n'a pas de comportement pathologique intrinsèque.

## Vérification de types (type-check)

La vérification de types se fait TOUJOURS via :
- `pnpm check-types` (racine) — délègue à `turbo run check-types`, qui exécute
  `tsc --noEmit` DANS chaque package avec SON propre `tsconfig.json`.
- ou `pnpm --filter @saas/<pkg> check-types` pour cibler un package.

JAMAIS `tsc --noEmit` / `npx tsc --noEmit` / `pnpm exec tsc` depuis la racine du
monorepo. Le tsc-racine ignore les `tsconfig.json` par-package (notamment
`paths: { "@/*": ["./*"] }` de `apps/web`, le flag `jsx`, les `types`), ce qui
produit des FAUX POSITIFS systémiques — `TS2307 Cannot find module '@/...'`,
JSX flag manquant, implicit-any (ex. `deleteErr`) — qui n'existent pas sous
Turborepo et ne reflètent aucune erreur réelle.

La CI (`lint-typecheck` → `pnpm check-types`) fait foi. Une preuve de type-check
dans un evidence QA n'est valide que si elle provient de `pnpm check-types`
(ou `pnpm --filter <pkg> check-types`), jamais d'un tsc-racine.

Tous les packages (`agents`, `config`, `db`, `permissions`, `services`, `ui`,
`workflows`) et `apps/web` exposent un script `check-types` → la couverture
`turbo run check-types` est exhaustive.