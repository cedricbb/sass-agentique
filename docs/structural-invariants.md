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
