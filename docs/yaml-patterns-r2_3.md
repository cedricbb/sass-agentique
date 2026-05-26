# YAML Patterns — R2.3+

Ce document liste les **patterns standards** à inclure dans chaque YAML
produit pour les epics R2.3 et au-delà. Il est issu des leçons apprises
pendant R2.2 (notamment le bug "tests services invisibles en CI" et le
cycle QA "fonctions >30L" sur ST8).

Garder ce fichier dans le project Claude pour qu'il soit retrouvé via
`project_knowledge_search` à chaque nouveau YAML.

---

## Pattern 1 — Test runner explicite (à placer en haut de `phase_3_qa`)

```
⚠️ IMPORTANT — Test runner :
Le projet utilise vitest, PAS jest. Pour lancer les tests, utiliser :
  pnpm --filter <package> test
(qui résout vers `vitest run` via le script `test` du package.json).
NE JAMAIS lancer `npx jest` ou tout autre runner alternatif. Si la
commande pnpm retourne silencieusement (exit 0 sans output) → c'est
un signe de bug infra (script test manquant dans package.json) —
STOP et signaler au Manager.
```

**Contexte historique** : en R2.2 ST9, Orchid a tenté `npx jest` alors
que le projet est vitest-only. Résultat : faux "REJECTED" basé sur des
erreurs Babel/Jest sans rapport avec le code livré. Coût : 1 cycle QA
inutile + diagnostic infra.

---

## Pattern 2 — Vérification du compteur de tests (à placer dans `phase_3_qa`)

```
⚠️ IMPORTANT — Compteur de tests :
Après chaque modification, vérifier que le compteur de tests rapporté
correspond au nombre total attendu de suites du package. Ne pas se
fier à "exit 0" silencieux. Pattern de vérification :

  pnpm --filter <package> test 2>&1 | grep -E "Tests.*passed"

→ doit afficher une ligne du type "Tests  XX passed (XX)" avec
XX ≥ <compteur minimum attendu pour le package>.

Compteurs de référence post-R2.2 (à mettre à jour à chaque YAML majeur) :
  @saas/config       :  20 tests
  @saas/permissions  :  30 tests
  @saas/db           :  55 tests
  @saas/services     : 269 tests (après R2.2 ST9)

Si silence ou compteur inférieur à la référence → REJECTED.
```

**Contexte historique** : en R2.2 ST9, le QA d'Orchid a rapporté
"compteur impossible à mesurer" à cause du faux positif jest. La
référence chiffrée évite ce flou.

---

## Pattern 3 — Vérification de couverture CI réelle (à placer dans `done_definition`)

```
⚠️ IMPORTANT — Couverture CI :
Une CI verte n'implique pas que les tests qu'on croit testés sont
effectivement testés. Vérification systématique pour tout YAML qui
touche au code testable :

  1. Local : `pnpm test` (commande globale) doit lister explicitement
     le package modifié dans sa sortie turbo. Si le package est
     absent ou marqué "skipped" → bug infra.

  2. CI : après merge, vérifier les logs de la step Unit Tests pour
     confirmer la présence du package modifié dans le compteur
     cumulé. Compter le nombre total de tests rapportés et le
     comparer à la référence (Pattern 2).

  3. Si un package modifié n'apparaît PAS dans les logs CI → bug
     infra (script test manquant dans package.json ou step CI mal
     configurée) — escalader via YAML fix dédié, NE PAS continuer
     en assumant que c'est OK.
```

**Contexte historique** : en R2.2 ST1-8, la CI affichait "Unit Tests
(Vitest) ✓" mais ne couvrait QUE config + db (~75 tests). Les 269
tests de services n'étaient JAMAIS exécutés en CI. Bug masqué pendant
8 sous-tâches. Détecté et fixé en YAML 20260522.

---

## Pattern 4 — Fonctions publiques ≤30 lignes (à placer dans `acceptance_criteria`)

```
AC : "Toutes les fonctions publiques (export function / export async
function / méthodes de classe exportée) ont un corps ≤30 lignes (hors
signature, accolade ouvrante/fermante, JSDoc). Vérification :

  awk '/^export (async )?function/{name=$0; in_func=1; count=0; next}
       in_func && /^}/{if (count > 30) print FILENAME ' ' name ' ' count 'L'; in_func=0; next}
       in_func {count++}' \\
    packages/<scope>/src/*.ts

→ doit retourner 0 ligne (zéro fonction publique ne dépasse 30L)."

Si une fonction dépasse → extraire en helpers privés (non-exportés)
dans le même fichier. Les helpers privés N'ONT PAS la contrainte de
30L stricte mais doivent rester raisonnables (≤50L max).
```

**Contexte historique** : en R2.2 ST8 cycle 1, 5 fonctions du
maintenance-contract.service dépassaient 30L → REJECTED. Cycle 2
corrigé via extraction en helpers privés (findContractBySubscriptionId,
updatePeriodDates, reconcileStripeStatus, assertContractAcceptsSubscription).
Coût : 1 cycle QA. Désormais : AC standard rétroactif sur ST1-8 (ST9)
et préventif sur R2.3+.

---

## Pattern 5 — Lazy singleton pour clients externes (à inclure dans `context` quand pertinent)

```
⚠️ PATTERN OBLIGATOIRE — Clients externes (Stripe, Resend, Sentry, etc.) :
Tout client externe consommant une env var au constructor DOIT être
exposé via une factory lazy mémoïsée, JAMAIS via `export const X = new XService()`.

Pattern correct :
  let _xService: XService | null = null;
  export function getXService(): XService {
    if (_xService === null) _xService = new XService();
    return _xService;
  }
  export function __resetXServiceForTests(): void { _xService = null; }

Anti-pattern interdit :
  export const xService = new XService();  // ← eager, casse `next build` si env absent

Raison : `next build` charge tous les modules pour collecter les pages.
Une eager instantiation lit l'env var au module load, ce qui casse en
CI quand le secret n'est pas défini.
```

**Contexte historique** : en R2.2 ST7, stripe.service avait
`export const stripeService = new StripeService()` ligne 217.
Couplé au barrel `export * from "./stripe.service"`, toute route
admin déclenchait l'eager instantiation au build → CI rouge.
Fixé en YAML 20260519 par lazy singleton.

---

## Pattern 6 — Garde runtime pour champs immuables (à inclure dans `context` quand pertinent)

```
⚠️ PATTERN OBLIGATOIRE — Méthodes update avec champs immuables :
Quand un service expose une méthode updateXxx(id, patch) où certains
champs doivent rester immuables (ex: clientId, status, paidAt), il
faut DOUBLE protection :

1. Typage TS strict : Omit<Partial<NewXxx>, "immuable1" | "immuable2">
2. Garde runtime dans le corps :
     if ("immuable1" in patch) throw new Error("...");
     if ("immuable2" in patch) throw new Error("...");

Le typage seul ne suffit pas car un appelant JS pur ou un `as any`
le contourne. La garde runtime est la dernière ligne de défense.

Tests obligatoires : au moins 1 test par champ immuable, en utilisant
`as any` pour contourner le typage et vérifier que la garde runtime
lève bien une erreur.
```

**Contexte historique** : en R2.2 ST6, report.service.updateReport
nécessitait de protéger clientId ET issuedAt. Stratégie double :
typage Omit + garde runtime. Tests #10 et #11 valident avec `as any`.

---

## Pattern 7 — Idempotence des transitions (à inclure dans `context` quand pertinent)

```
⚠️ PATTERN OBLIGATOIRE — Méthodes transition / state-change :
Toute méthode qui modifie un state (cancel, markIssued, accept, etc.)
DOIT être idempotente quand l'état cible est déjà atteint :

  if (current.status === targetStatus) return current;  // pas d'erreur, pas d'UPDATE

Raison : protection contre :
- les double-clics côté UI
- les webhooks Stripe rejoués
- les retry de workers

Test obligatoire : "X est idempotent sur un Y déjà Z" — retourne
inchangé sans appel side-effect ni UPDATE.
```

**Contexte historique** : R2.2 ST5 (createPayment), ST6 (markReportIssued),
ST8 (cancelContract) — tous les services R2.2 avec transitions appliquent
ce pattern. ST8 a un test explicite "cancelContract sur déjà canceled
retourne inchangé sans appel Stripe ni UPDATE DB".

---

## Pattern 8 — DbOrTx pour helpers acceptant une transaction (à inclure dans `phase_2_developer`)

```
⚠️ PATTERN OBLIGATOIRE — Helpers acceptant une transaction optionnelle :
Pour typer le paramètre optionnel d'une tx Drizzle, UNIQUEMENT le pattern :

  type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  function helper(invoiceId: string, tx?: DbOrTx) {
    const exec: DbOrTx = (tx ?? db) as DbOrTx;
    // ... utilise exec ...
  }

INTERDIT :
- `tx: typeof db` → trop restrictif, refuse les vraies tx
- `tx: PostgresJsDatabase` → tighter coupling, casse au refactor Drizzle
- `tx: any` → loses safety
- `tx: unknown` → unusable

Le `(tx ?? db) as DbOrTx` est tolérable et documenté en commentaire 1-ligne.
```

**Contexte historique** : leçon ST3-fix (quote.service). Pattern adopté
sur tous les services R2.2 utilisant des transactions (ST4 invoice, ST5
payment, ST8 maintenance-contract).

---

## Pattern 9 — Pas de cycle d'import inter-services (à vérifier en `phase_3_qa`)

```
⚠️ VÉRIFICATION OBLIGATOIRE — Pas de cycle d'import :
Pour chaque service S qui importe un autre service T (couplage S → T),
vérifier que T n'importe pas S en retour :

  grep -c "import.*<S>" packages/services/src/<T>.service.ts → 0

Exemples de couplages valides post-R2.2 :
  quote.service → invoice.service (création auto à l'acceptance)
  payment.service → invoice.service (bascule paid)
  maintenance-contract.service → prestation.service + stripe.service
```

**Contexte historique** : AC standard dans R2.2 ST1-8. Aucun cycle
détecté à ce jour.

---

## Pattern 10 — Test pile de couverture cross-service via spy (à appliquer dans tests)

```
⚠️ PATTERN OBLIGATOIRE — Tests de side-effects cross-service :
Au lieu de faire de "vrais" tests d'intégration cross-service (qui
nécessitent une DB de test ou des mocks lourds), tester chaque
side-effect en isolé via spy :

  // service A appelle service B
  vi.mock("./b.service", () => ({
    methodOnB: vi.fn().mockResolvedValue({ ... }),
  }));

  it("A.action déclenche B.methodOnB avec les bons args", async () => {
    await serviceA.action(...);
    expect(methodOnB).toHaveBeenCalledWith(expectedArgs);
  });

Les vrais tests d'intégration cross-service sont reportés au niveau
des routes (R3) ou des handlers webhook (R5), où ils ont plus de sens
métier.
```

**Contexte historique** : Q2 (γ) de R2.2 ST9. Tests d'intégration
cross-service explicitement reportés à R3/R5. Au niveau service pur,
tous les side-effects sont déjà testés via spy.

### Pattern 11 — Server/Client split via `*.shared.ts` + subpath export (à inclure dans `phase_1_tech_lead`)

**Quand l'appliquer** : dès qu'une fonction pure (calcul, formatage,
validation) hébergée dans un `*.service.ts` (qui importe `@saas/db`) doit
être consommée par un Client Component (form, table, widget).

**Pourquoi** : le bundler client-side tire toute la chaîne d'imports.
Importer `computeXxxTtc` depuis `@saas/services` dans un Client Component
embarque `drizzle-orm` + `postgres` + le schéma DB → erreur de build
`Module not found: postgres` (ou équivalent).

**Mécanique** :

1. **Extraire** la fonction pure et son type dans un nouveau fichier
   `packages/services/src/<entity>.shared.ts` — ZERO `import`, ZERO
   référence à `@saas/db`.
2. **Re-export** depuis `<entity>.service.ts` pour rétro-compat :
   ```ts
   export { computeXxxTtc, type XxxAmounts } from "./<entity>.shared";
   ```
3. **Exposer le subpath** dans `packages/services/package.json` :
   ```json
   "exports": {
     ".": "./src/index.ts",
     "./<entity>.shared": "./src/<entity>.shared.ts",
     ...
   }
   ```
4. **Côté Client Component**, importer UNIQUEMENT depuis le subpath :
   ```ts
   import { computeXxxTtc } from "@saas/services/<entity>.shared";
   // JAMAIS : import { computeXxxTtc } from "@saas/services";
   ```

**Garde-fou QA** : `phase_3_qa` inclut un grep négatif :
```bash
grep -E 'computeXxxTtc.*from "@saas/services"' <component>.tsx
# Doit retourner 0 occurrence
```

**Cas où NE PAS appliquer** : fonctions qui font des queries DB
(`computeInvoiceBalance`, `listXxx`, etc.). Elles RESTENT dans le
`*.service.ts` et ne doivent JAMAIS être déplacées dans le `*.shared.ts`.

**Précédents** : `quote.shared.ts` (ST6 post-fix), `invoice.shared.ts`
(ST7.1).
 
---

### Pattern 12 — Renforcement QA : grep ciblé + evidence runtime (à appliquer dans `phase_3_qa` + `acceptance_criteria`)

**Quand l'appliquer** : sur tout AC qui asserte un comportement observable
côté code (présence d'un label, d'un testid, d'un mapping, d'un import,
d'un appel `revalidatePath`, etc.) OU côté runtime (tests qui passent,
seed appliqué, e2e qui passe).

**Pourquoi** : éviter le trou QA où un YAML est ACCEPTED sur la base d'une
analyse statique (lecture du code, "ça a l'air bon") plutôt que d'une
vérification grep réelle ou d'une evidence d'exécution.

**Mécanique côté grep statique** :

- Chaque AC critique doit s'exprimer comme une commande grep avec un
  compte attendu précis :
  ```bash
  grep -c "return withAdmin(async" actions/invoices.ts
  # → 6
  ```
- Préférer les valeurs littérales (label FR exact, testid exact, chemin
  exact) plutôt que des regex spéculatives.
  **Mécanique côté evidence runtime** :

Si un AC dépend d'un comportement runtime (e2e, tests vitest, seed
appliqué, build artifact) → **le log brut copié-collé est OBLIGATOIRE**
dans le rapport QA. Au minimum les lignes de résumé (compteurs,
pass/fail).

**Si le container QA agent ne peut pas exécuter le runtime concerné**
(ex. Playwright absent du container — situation rencontrée fin ST7.5
avec `libglib-2.0.so.0` manquant), le QA agent EST AUTORISÉ à récupérer
l'evidence depuis les logs CI de la branche, à condition de :
- Citer explicitement l'URL/numéro de run CI dans le rapport QA
- Coller le bloc de log pertinent (ex. step "E2E Tests (Playwright)")
- Mentionner explicitement : *"Evidence runtime extraite des logs CI
  (container QA bloqué : <raison>)."*
  Sans evidence runtime (ni locale ni CI) sur un AC qui en exige une →
  **REJECTED**.

**Mécanique côté evidence TYPE-CHECK (raffinement ST10.1)** :

L'evidence d'un AC `check-types` DOIT provenir du **job CI nommé qui fait
le vrai type-check** (sur ce repo : le job CI **« Lint · Typecheck · DB
Check »**), OU d'une commande workspace explicite avec le bon tsconfig
projet (ex. `pnpm --filter <package> check-types`). Elle NE DOIT JAMAIS
provenir d'un `npx tsc --noEmit` lancé à la racine du workspace.

**Pourquoi** : un `tsc` racine sans le tsconfig projet produit un bruit
systémique massif (sur ST10.1 : ~2915 erreurs TS17004 `--jsx` non défini
+ TS2307 alias `@/...` non résolus) qui n'a rien à voir avec le code livré.
Le QA agent est alors forcé d'« interpréter » ce bruit (« pattern
pré-existant, non introduit par ce YAML ») au lieu de lire un verdict
binaire. C'est exactement le trou par lequel une VRAIE régression de type
peut se noyer — notamment le type d'incident multi-tenant déjà rencontré
(ajout d'une colonne `NOT NULL` rendant un champ requis dans tous les
inputs create : 913 tests verts en vitest mais CI rouge sur tsc, car
vitest transpile sans type-check).

**Règle** :
- Si `pnpm` est absent du container QA agent → l'evidence check-types
  s'extrait du **job CI « Lint · Typecheck · DB Check »** (Pattern 12
  extraction CI : citer le run, coller le bloc de log, mentionner
  « container QA bloqué »). C'est le filet réel, pas le tsc racine.
- Un AC check-types NE DOIT JAMAIS être rédigé comme « npx tsc --noEmit
  racine ». Le rédiger comme : *« job CI Typecheck vert »* ou *« pnpm
  --filter <package> check-types vert (log) »*.
- Un rapport QA qui valide check-types sur un tsc racine produisant des
  milliers d'erreurs « interprétées comme pré-existantes » = evidence
  NON RECEVABLE pour cet AC (le job CI vert reste, lui, recevable).

**Précédents fixés** :
- ST6.5 trou QA : 2 tests timeoutaient × 3 retries, le QA s'était fié à
  un grep sur la structure du code et avait marqué ACCEPTED. Désormais :
  log brut Playwright OBLIGATOIRE pour les YAMLs e2e.
- ST7.5 réserve AC20 : container QA sans Playwright. Pattern 12 étendu
  pour autoriser l'extraction depuis logs CI.
- ST10.1 raffinement check-types : QA a validé check-types sur un
  `npx tsc --noEmit` racine produisant 2915 erreurs systémiques
  « interprétées comme pré-existantes ». Le vrai filet était le job CI
  « Lint · Typecheck · DB Check » vert. Désormais : evidence check-types
  = job CI nommé ou `pnpm --filter check-types`, jamais tsc racine.
---

### Pattern 13 — Séparation stricte des rôles tech_lead / developer (à inclure dans CHAQUE YAML, bloc `role_separation`)

**Quand l'appliquer** : sur TOUS les YAMLs Orchid, sans exception.

**Pourquoi** : observation post-ST7.2 — quand `phase_1_tech_lead` contient
des designs ultra-détaillés (code complet collable), Orchid attribue le
commit au rôle tech_lead car c'est lui qui a produit le contenu. Phase_2
(developer) se transforme en simple coller-vérifier, et la traçabilité
des rôles devient biaisée. Sans cette séparation, on perd aussi la
seconde passe de réflexion que devrait apporter phase_2.

**Mécanique** :

Ajouter en tout début de chaque YAML, AVANT `context:` :

```yaml
role_separation: |
  ⚠️ CONVENTION TRANSVERSE (Pattern 13)
  
  Cette spec respecte la séparation stricte des rôles Orchid :
  
  - phase_1_tech_lead PRODUIT UNIQUEMENT :
    * Le DIAGNOSTIC préalable (greps de vérification, lecture de fichiers
      existants, confirmation des contrats DB/services).
    * Le DESIGN sous forme de SPÉCIFICATION (signatures de fonctions,
      contrats d'interface, listes de fichiers à créer/modifier, structure
      de tests à écrire).
    * Les INTERDICTIONS strictes (TDD ORDER : ce qui ne doit PAS être
      touché dans ce YAML).
    * Les snippets de code dans phase_1 sont des EXEMPLES ILLUSTRATIFS
      à valeur de référence, pas du code prêt à coller.
  
  - phase_1_tech_lead NE DOIT PAS :
    * Créer de fichiers dans /apps ou /packages.
    * Produire de code prêt à coller verbatim.
    * Modifier des fichiers existants du repo.
  
  - phase_2_developer RE-ÉCRIT le code en suivant la spec phase_1 :
    * Ré-implémente chaque fichier listé, en s'inspirant des snippets
      phase_1 mais sans copier-coller mécaniquement.
    * Cette ré-écriture est l'occasion d'une SECONDE PASSE de réflexion :
      typos, edge cases, idiomes locaux non prévus par la spec, etc.
    * Si phase_2 détecte une incohérence ou un manque dans la spec
      phase_1, il alerte plutôt que de combler en silence.
  
  - phase_3_qa VÉRIFIE indépendamment via greps et logs d'exécution
    (Pattern 12). Le QA ne valide JAMAIS uniquement sur lecture statique
    du code produit.
  
  La traçabilité Orchid doit refléter cette séparation : commits
  d'implémentation = author developer, pas tech_lead.
```

**Effet attendu** :
- Vélocité préservée (la spec phase_1 reste précise, donc phase_2 sait
  exactement quoi écrire).
- Drift implémentation détecté par phase_2 plutôt qu'en QA.
- Comptabilité de rôles propre dans les logs Orchid.
  **Précédent** : ST7.2 — phase_1 a produit du code collable pour
  InvoicesTable.tsx (~50 lignes), seed extension (~70 lignes), résultat :
  commit attribué tech_lead. Convention introduite à partir de ST7.3 et
  appliquée avec succès sur ST7.3, ST7.4, ST7.5.

---

### Pattern 14 — Validation visuelle humaine séparée des AC (à inclure dans le YAML quand un AC nécessite un navigateur)

**Quand l'appliquer** : dès qu'un YAML contient un AC qui ne peut être
vérifié que via un navigateur (rendu UI, navigation, vérification visuelle
post-seed). Cela couvre principalement les YAMLs qui :
- Étendent le seed avec de nouvelles entités à observer dans l'UI
- Créent ou modifient des routes/pages admin
- Modifient un composant dont le comportement runtime est observable
  uniquement à l'écran
  **Pourquoi** : le QA agent Orchid n'a pas de navigateur. Quand un AC
  "visuel" est listé dans `acceptance_criteria` ordinaires, le QA agent
  est forcé soit de le marquer N/A (trou de validation), soit de l'ignorer
  (comme observé en ST7.4 : AC23 marqué N/A avec justification "pas de
  navigateur — logique vérifiée par tests"). Aucune des deux options n'est
  satisfaisante.

**Mécanique** :

Les AC visuels sont **extraits** de `acceptance_criteria` et placés dans
une section dédiée `human_validation_checklist:` (au même niveau YAML
que `acceptance_criteria` et `done_definition`).

```yaml
acceptance_criteria:
  - "AC1 — ... (grep ou test vérifiable par QA agent)"
  - "AC2 — ..."
  # ... AC standards
 
human_validation_checklist: |
  ⚠️ Cette section est exécutée par Cédric (humain) APRÈS que le QA agent
  ait marqué les AC ci-dessus en ACCEPTED, et AVANT le marquage DONE final.
  
  Le QA agent NE PEUT PAS valider ces points (pas de navigateur). Si Cédric
  détecte un défaut visuel → REJECT et follow-up YAML (pas modification
  rétroactive).
  
  ### Pré-requis local
  - [ ] `pnpm --filter @saas/db migrate:reset && pnpm --filter @saas/db seed`
        → Logs ✅ attendus : ...
  - [ ] `pnpm dev` démarre sans erreur
  
  ### Vérifications visuelles
  - [ ] Route X rend Y
  - [ ] Click Z déclenche W
  - ...
  
  ### Validation finale
  - [ ] Tous les points OK → marquer DONE
  - [ ] Si défaut → follow-up YAML
```

**Workflow conséquent** :

1. `phase_3_qa` valide les `acceptance_criteria` standards (greps + tests + logs).
2. QA agent marque ACCEPTED si tout passe.
3. Cédric humain exécute la `human_validation_checklist`.
4. Si OK → DONE. Si défaut → REJECT + follow-up YAML.
   **Avantage** : pas d'AC N/A par défaut. Le QA agent ne ment plus sur des
   choses qu'il ne peut pas vérifier. Cédric a une checklist actionnable
   claire au lieu d'un AC dilué dans la liste.

**Précédent** : introduit en ST7.5. ST7.4 avait tenté l'AC23 visuel dans
les AC normaux → marqué N/A par QA (trou). ST7.5 a séparé proprement.

---

## Checklist de pré-validation YAML (avant d'écrire le YAML)

Avant de produire un YAML, vérifier que les patterns suivants sont
intégrés au bon endroit :

- [ ] **Pattern 1** (test runner) en haut de `phase_3_qa`
- [ ] **Pattern 2** (compteur tests) dans `phase_3_qa`
- [ ] **Pattern 3** (couverture CI) dans `done_definition`
- [ ] **Pattern 4** (fonctions ≤30L) dans `acceptance_criteria` si le YAML touche au code
- [ ] **Pattern 5** (lazy singleton) dans `context` si le YAML touche aux clients externes
- [ ] **Pattern 6** (garde runtime) dans `context` si le YAML expose un updateXxx avec champs immuables
- [ ] **Pattern 7** (idempotence) dans `context` si le YAML expose une transition de state
- [ ] **Pattern 8** (DbOrTx) dans `phase_2_developer` si le YAML touche aux transactions
- [ ] **Pattern 9** (pas de cycle import) dans `phase_3_qa` si le YAML touche aux services
- [ ] **Pattern 10** (test cross-service via spy) dans `phase_1_tech_lead` si le YAML
  crée un service qui consomme un autre service
- [ ] **Pattern 11** (server/client split) dans `phase_1_tech_lead` si le YAML
  crée ou consomme une fonction pure depuis un Client Component, avec
  grep négatif dans `phase_3_qa`
- [ ] **Pattern 12** (grep ciblé + evidence runtime) sur tous les AC critiques.
  Pour les YAMLs e2e ou seed → exigence supplémentaire de log brut /
  evidence d'exécution en `done_definition` ou dans le rapport QA.
  Si container QA bloqué → autorisation d'extraire depuis logs CI.
  Pour un AC `check-types` → evidence = job CI « Lint · Typecheck · DB
  Check » vert OU `pnpm --filter <package> check-types` vert. JAMAIS un
  `npx tsc --noEmit` racine (produit du bruit systémique masquant les
  vraies régressions de type). Rédiger l'AC en conséquence.
- [ ] **Pattern 13** (role separation) → bloc `role_separation:` présent en
  tête du YAML, AVANT `context:`. NON-NÉGOCIABLE depuis ST7.3.
- [ ] **Pattern 14** (validation visuelle humaine) → si le YAML contient des
  AC nécessitant un navigateur, les extraire dans une section
  `human_validation_checklist:` séparée. NON-NÉGOCIABLE depuis ST7.5.

---

## Historique des décisions structurantes (R2.2 + R3)

| Décision | YAML | Justification |
|---|---|---|
| Pas de tests d'intégration cross-service au niveau service | ST9 Q2 (γ) | Reportés à R3 (routes) / R5 (webhooks) — au niveau service, spies suffisent |
| Pas de refactor du barrel index.ts | ST9 Q1 (c) | Wildcard pour R1+services anciens, namespace pour 3 derniers. Refactor casserait apps/web pour gain nul |
| Lazy singleton stripeService | Fix 20260519 | Eager instantiation cassait `next build` en CI quand STRIPE_SECRET_KEY absent |
| Suppression definitive `export const stripeService` | Fix 20260519 | Garde anti-régression : impossible de réintroduire l'eager |
| Dummy STRIPE_SECRET_KEY=sk_test_dummy_for_ci_only en CI | Fix 20260519 | Filet de sécurité pour le cas où un autre eager apparaît un jour |
| `pnpm test` global plutôt que --filter explicite | Fix 20260522 | Scalable : nouveau package avec tests auto-inclus en CI |
| AC standard "fonctions ≤30L" | ST9 Q5 (p) | Évite cycles QA REJECTED redondants |
| Pattern 11 (server/client split) | ST6 post-fix + ST7.1 | computeXxxTtc dans Client Component tire la chaîne db → erreurs Module not found. Subpath `./xxx.shared` + zero dep DB obligatoire |
| Pattern 12 (evidence runtime + extraction CI) | ST6.5 + ST7.5 | Évite trou QA "ACCEPTED sur analyse statique". Log brut obligatoire. Container QA bloqué → autorisation logs CI |
| Pattern 13 (role_separation) | ST7.2 → ST7.3 | phase_1 ultra-détaillée → commits attribués tech_lead. Spec sans code collable + ré-écriture phase_2 → traçabilité propre |
| Pattern 14 (human_validation_checklist) | ST7.4 (N/A) → ST7.5 (intro) | AC visuels marqués N/A par QA. Extraction en section dédiée exécutée par Cédric après QA agent |
| Subtilité TTC vs HT dans computeXxxBalance | ST7.5 | computeInvoiceBalance retourne balanceCents en HT. La card "Reste dû" UI raisonne en TTC. Ne JAMAIS afficher balance.balanceCents directement |
| invoice_items sans prestationId | ST7.4 | Décision produit assumée : invoice item = snapshot comptable. Le sélecteur Prestation côté UI est un pur raccourci de pré-remplissage, prestationId N'EST PAS persisté |

---
## Erreurs métier exposées par les services R2.2 (référence rapide)

| Service | Classe d'erreur |
|---|---|
| quote | QuoteCannotBeAcceptedError |
| quote | QuoteAlreadyHasInvoiceError |
| invoice | InvalidInvoiceTransitionError |
| payment | PaymentDeletionOnPaidInvoiceError |
| report | InvalidFilePathError |
| maintenance-contract | ClientAlreadyHasActiveContractError |
| maintenance-contract | InvalidContractTransitionError |
| maintenance-contract | ContractNotInStripeAutoModeError |
| stripe | StripeServiceError |

---

## Hooks webhook exposés (référence pour R5)

| Hook | Service | Usage prévu |
|---|---|---|
| syncFromStripeSubscription | maintenance-contract | customer.subscription.updated / invoice.paid / invoice.payment_failed |
| attachStripeSubscriptionToContract | maintenance-contract | checkout.session.completed (mode subscription) |
| recomputePaidAtForInvoice | payment | checkout.session.completed (mode payment) ou job resync |

---

## Dette technique acceptée (à traiter post-R3 si pertinent)

| Item | Statut | Justification du report |
|---|---|---|
| Barrel index.ts incohérent (wildcard vs namespace) | Accepté | Migration risquée pour apps/web, gain nul |
| Tests d'intégration cross-service absents au niveau service | Accepté | Couverts par R3 (routes) et R5 (webhooks) |
| apps/web/(admin) et (customer) contiennent du legacy multi-tenant non purgé | Accepté | next build passe ; check-types apps/web rouge ; refactor en R3 |
| TODOs/console.log éventuels dans services R1 (auth, email, totp, admin, profile) | Accepté | Hors scope R2.2, à traiter au cas par cas |
