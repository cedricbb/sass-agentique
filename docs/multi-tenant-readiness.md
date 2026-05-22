# Multi-Tenant Readiness — Préparer le terrain pendant R3+ pour une migration indolore post-MVP

> **Date** : 2026-05-21
> **Statut** : Stratégique — à appliquer **dès maintenant** pendant ST9 → ST11 et jusqu'à la sortie MVP, **sans** implémenter la séparation effective.
> **Origine** : décision produit du 21/05/2026 — MVP single-admin pour usage personnel (auto-entrepreneur Cédric), passage multi-tenant prévu après validation marché.
> **Cible** : un commit ultérieur (release R4 ou R5) ajoutera `organization_id` partout, RLS Postgres, gestion d'orgs/invitations, et billing multi-plan. Ce doc liste tout ce qu'il faut **éviter de faire de travers maintenant** pour que ce commit reste un refactor mécanique, pas une réécriture.

---

## 0. TL;DR — Les 5 règles d'or à respecter en R3+

| # | Règle | Coût maintenant | Coût si non respectée plus tard |
|---|---|---|---|
| 1 | Ajouter `owner_id` (FK `users.id`) sur **toutes** les tables métier dès maintenant, même avec une seule valeur | ~1 jour | 1-3 semaines de backfill + tests |
| 2 | Toutes les queries DB passent par `@saas/services` — **jamais** de `db.select()` dans une route, action ou composant | ~0 (déjà la convention) | Refactor de chaque call site DB |
| 3 | Numérotation des entités (`Q-YYYY-NNN`, `INV-YYYY-NNN`) **scopée à `owner_id`** dès maintenant | ~2h | Risque de collisions de numéros à la migration |
| 4 | Aucun hardcode `WHERE id = (SELECT id FROM users WHERE role='admin' LIMIT 1)` dans les services | ~0 | Bug runtime silencieux multi-tenant |
| 5 | Réserver les noms `organization_id`, `org_slug`, `tenants` dans le glossaire — ne **jamais** les utiliser pour un autre concept | ~0 | Conflit sémantique au refactor |

Tout le reste de ce document détaille pourquoi et comment.

---

## 1. Pourquoi maintenant (et pas après le MVP)

Trois raisons concrètes, par ordre de coût croissant :

**1.1 Backfill de données réelles.** Une fois en prod chez toi avec 6 mois de devis, factures, contrats de maintenance, paiements Stripe et rapports clients, ajouter une colonne `organization_id NOT NULL` sur `invoices` exige une migration en plusieurs étapes (add nullable → backfill → set not null → swap unique constraints sur les numéros INV-YYYY-NNN). Si tu as déjà des paiements Stripe rattachés à des invoices via `stripe_payment_intent_id`, le moindre échec de backfill = comptabilité cassée. **Aujourd'hui ta DB est vide hors seed.**

**1.2 Conventions de code figées par habitude.** Plus tu écris de YAMLs ST9 → ST11 sans penser au scoping, plus tes patterns "natifs" supposent l'admin global. Exemple : `listInvoices()` sans paramètre de scope est très différent de `listInvoices({ ownerId })` côté service — la 2e signature force la discipline.

**1.3 Tests E2E déjà nombreux.** Tu as 708 tests unit + 28 e2e. Chaque test qui assume "l'admin voit tout" est une dette à rembourser au moment du switch. Aujourd'hui c'est cohérent (single-admin), mais si on prépare la dichotomie owner / global dès maintenant, ces tests resteront verts au refactor.

---

## 2. La colonne `owner_id` — décision et implémentation

### 2.1 Pourquoi `owner_id` et pas `organization_id` tout de suite

`owner_id` (FK vers `users.id`) reste vrai dans **les deux modèles** :
- Mono-tenant single-admin : `owner_id` pointe vers le compte admin unique.
- Multi-tenant : `owner_id` reste utile pour tracer "qui a créé l'enregistrement" même au sein d'une organisation. La colonne *en plus* (`organization_id`) servira au scoping.

Renommer `owner_id` → `organization_id` plus tard est **trivial** (1 migration Drizzle + grep-replace). Ce qui est coûteux, c'est de l'ajouter sur 6 mois de données prod. Donc on l'ajoute maintenant avec la sémantique correcte.

### 2.2 Quelles tables sont concernées

Les tables métier R3, **toutes** :

| Table | Ajout `owner_id` | Justification |
|---|---|---|
| `clients` | ✅ | Un client appartient à un freelance (toi pour le MVP, l'org du freelance plus tard). |
| `projects` | ✅ | Hérité via `clientId` mais redondance acceptable pour les queries directes (`WHERE owner_id = ?`). |
| `quotes` | ✅ | Idem + scope numérotation Q-YYYY-NNN. |
| `quote_items` | ❌ | Hérité via `quoteId`. Pas de scoping direct nécessaire. |
| `invoices` | ✅ | Idem + scope numérotation INV-YYYY-NNN. |
| `invoice_items` | ❌ | Hérité via `invoiceId`. |
| `payments` | ✅ | Idem + scoping crucial pour la résolution des webhooks Stripe. |
| `reports` | ✅ | Scoping + isolation stockage R2 (cf. section 5). |
| `prestations` | ✅ | Le catalogue de prestations est privé à chaque freelance en multi-tenant. |
| `maintenance_contracts` | ✅ | Idem + scoping Stripe subscriptions. |
| `client_contacts` | ❌ | Hérité via `clientId`. |

Tables hors scope : `users`, `sessions`, `agent_tasks`, `agent_logs`. Ce sont des tables infra, pas du métier scopable.

### 2.3 Migration concrète à appliquer

Une seule migration Drizzle, à shipper dans un YAML dédié (ex : `20260601-feat-multi-tenant-owner-id.yml`) **avant** ST9 idéalement, ou en parallèle si ST9 est déjà engagé.

```sql
-- packages/db/src/schema.ts — ajout sur chaque table concernée
owner_id uuid NOT NULL REFERENCES users(id)
-- backfill avec l'admin unique au moment de la migration
DEFAULT (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
-- index composite pour les queries scopées
CREATE INDEX clients_owner_id_idx ON clients (owner_id);
CREATE INDEX invoices_owner_id_idx ON invoices (owner_id);
-- etc.
```

**Côté Drizzle**, ça donne :

```ts
// Exemple sur clients
export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  // ... reste inchangé
}, (t) => ({
  ownerIdIdx: index("clients_owner_id_idx").on(t.ownerId),
}));
```

**Le `DEFAULT` est temporaire** : il sert juste à backfiller la migration sans bloquer. Une fois passé, retirer le default dans une migration ultérieure (ou simplement ne plus s'en servir côté code).

### 2.4 Impact sur les contraintes d'unicité (CRITIQUE)

Aujourd'hui, deux contraintes d'unicité métier sont **globales** :

| Table | Contrainte actuelle | Contrainte multi-tenant cible |
|---|---|---|
| `quotes` | `UNIQUE (number)` global | `UNIQUE (owner_id, number)` |
| `invoices` | `UNIQUE (number)` global | `UNIQUE (owner_id, number)` |
| `clients` | `UNIQUE (slug)` global | `UNIQUE (owner_id, slug)` (si slug est gardé) |
| `prestations` | `UNIQUE (slug)` global | `UNIQUE (owner_id, slug)` |

**Décision à prendre maintenant** : passer dès la migration `owner_id` aux contraintes composites `(owner_id, number)`. Ça ne change **rien** au comportement actuel (un seul `owner_id`), mais ça garantit qu'aucun bug ne sera introduit le jour du switch multi-tenant.

Vérifier ensuite que `getNextQuoteNumber(ownerId)` et `getNextInvoiceNumber(ownerId)` (dans les services Quote/Invoice) prennent bien `ownerId` en paramètre et l'utilisent dans le `WHERE` du SELECT MAX.

---

## 3. Conventions de code — ce qu'il faut faire dès ST9

### 3.1 Signature des services — `ownerId` en paramètre

Toutes les fonctions de lecture/écriture dans `@saas/services` doivent accepter un `ownerId: string` même si pour le MVP il est toujours résolu côté action via `requireAdmin()`.

**Avant (à éviter dès ST9) :**
```ts
export async function listInvoices(filters: InvoiceFilters): Promise<Invoice[]>
```

**Après (convention obligatoire R3+) :**
```ts
export async function listInvoices(
  ownerId: string,
  filters: InvoiceFilters,
): Promise<Invoice[]>
```

Côté action :
```ts
"use server";
export async function listInvoicesAction(filters: InvoiceFilters) {
  const session = await requireAdmin();
  return listInvoices(session.userId, filters);
}
```

Pour le MVP, `session.userId` est toujours l'unique admin. Pour le multi-tenant, ce sera `session.organizationId` (avec un alias temporaire). **L'important : le service ne sait pas, ne suppose rien, et ne hardcode jamais.**

### 3.2 Pattern services partagés (`*.shared.ts`) — déjà appliqué

Tu as déjà documenté ce pattern dans tes memories (`computeQuoteTtc` extrait dans `quote.shared.ts`). Continuer pareil pour toute fonction pure consommée côté client. **Aucune fonction `*.shared.ts` ne doit jamais référencer `ownerId`** — ce sont des calculs purs sans état.

### 3.3 Tests — préparer le changement de signature

Pour chaque nouveau test unit ou e2e écrit en ST9-ST11, prévoir une fixture `adminOwnerId` (constante) à passer aux services. Aujourd'hui ce sera toujours la même valeur (l'admin seedé) ; demain elle sera dynamique par test.

```ts
// tests/helpers/data.ts (ajout)
export const SEED_ADMIN_OWNER_ID = "<uuid stable du seed>";

// dans les tests
const invoices = await listInvoices(SEED_ADMIN_OWNER_ID, { status: "draft" });
```

---

## 4. Glossaire réservé — mots à ne pas utiliser pour autre chose

Pour éviter les collisions sémantiques au moment du refactor, **réserver dès maintenant** ces termes dans tout le codebase (schémas, types, variables, routes, traductions UI) :

| Terme | Usage futur | À ne pas utiliser pour |
|---|---|---|
| `organization` / `Organization` | Entité multi-tenant racine | Le mot existe déjà côté `clients.type = "company"` — éviter de renommer "client" en "organization" même partiellement |
| `organization_id` / `organizationId` | FK de scoping multi-tenant | Tout autre concept |
| `org_slug` | Slug d'organisation pour URL multi-tenant | Slug de client (utiliser `client_slug` ou laisser `slug`) |
| `member` / `Member` | User appartenant à une organisation | Aujourd'hui pas utilisé, ne pas l'introduire pour décrire un contact client par exemple |
| `tenant` / `tenantId` | (legacy) déjà purgé en R1 — **ne pas réintroduire** | Tout |
| `workspace` | (réservé alternative) | Tout |
| `subdomain` / `slug` racine | Routing multi-tenant | Ne pas créer de route `/[slug]/...` qui aurait une autre sémantique |

---

## 5. Storage R2 et fichiers — préparer l'isolation

Tu viens de livrer le helper R2 en ST9.0 (uploadPdfToR2, clés `reports/YYYY/MM/<uuid>.pdf`).

**Action recommandée immédiate** : changer la convention de clé pour intégrer dès maintenant un préfixe scopable, en gardant la rétrocompatibilité.

**Avant (actuel ST9.0) :**
```
reports/2026/05/<uuid>.pdf
```

**Après (convention R3+ recommandée) :**
```
owners/<owner_uuid>/reports/2026/05/<uuid>.pdf
```

Côté `buildReportKey(ownerId, ...)`, le changement est mineur. Côté multi-tenant futur, `<owner_uuid>` deviendra `<organization_uuid>` (ou `orgs/<org_uuid>/reports/...`) et on aura une vraie isolation des dossiers R2 sans aucune migration de fichiers.

**Bénéfice secondaire** : tu peux dès aujourd'hui supprimer **tous** les fichiers d'un client supprimé (ou de toi-même si tu testes) avec un simple `aws s3 rm --recursive owners/<uuid>/`.

À appliquer dans un sous-ticket ST9.5 ou un YAML cleanup en fin de R3.

---

## 6. Stripe — préparer la séparation des customers

Aujourd'hui ton wrapper Stripe gère :
- Customers Stripe (1 par client humain de Cédric — déjà bon)
- Payment Intents (rattachés à une invoice via `stripe_payment_intent_id`)
- Subscriptions (sur `maintenance_contracts`)
- Webhooks Stripe

**Le point d'attention multi-tenant** : aujourd'hui un seul compte Stripe Connect (le tien) reçoit tous les paiements. En multi-tenant, chaque freelance doit avoir son propre Stripe Connect account ou être facturé via un compte plateforme. Décision **architecturale** à reporter, mais en attendant :

### 6.1 À faire maintenant
- Stocker `stripe_account_id` (TEXT, nullable) sur la table `users` pour anticiper le Connect futur. Aujourd'hui c'est NULL ou une valeur unique pour toi.
- Dans le webhook handler Stripe, résoudre `ownerId` à partir des metadata du Payment Intent (à ajouter dans la création) plutôt que de supposer "l'unique admin".

```ts
// Création PI — ajouter dès ST8 ou ST10
await stripe.paymentIntents.create({
  amount,
  currency: "eur",
  metadata: {
    invoice_id: invoiceId,
    owner_id: ownerId,  // ← AJOUT
  },
});

// Webhook handler — lire owner_id depuis metadata
const ownerId = event.data.object.metadata?.owner_id;
if (!ownerId) throw new InvalidWebhookError("missing owner_id metadata");
```

### 6.2 À reporter (hors scope MVP)
- Stripe Connect onboarding flow
- Application fees plateforme
- Migration des customers Stripe existants vers les sous-comptes Connect

---

## 7. Auth — préparer la session multi-org

Aujourd'hui la session contient `userId` et `role`. En multi-tenant, elle contiendra aussi `organizationId` (l'org active) et probablement `memberships` (les orgs auxquelles l'user appartient).

### 7.1 À faire maintenant
- Dans `validateSession()`, retourner un objet structuré dont la forme peut évoluer **additivement** sans casser les call sites :

```ts
// Aujourd'hui
type Session = {
  userId: string;
  email: string;
  role: "admin" | "client";
};

// Garder cette forme. Plus tard, ajouter (sans rien retirer) :
type Session = {
  userId: string;
  email: string;
  role: "admin" | "client";
  organizationId?: string;          // ← futur
  organizationRole?: "owner" | "admin" | "member";  // ← futur
  memberships?: Array<{ orgId: string; role: string }>;  // ← futur
};
```

- Dans tous les `requireAdmin()` et helpers d'autorisation, **ne jamais lire `session.userId` directement pour faire un scoping métier**. Toujours passer par une variable nommée `ownerId` :

```ts
// ✅ Bien
const ownerId = session.userId;
const invoices = await listInvoices(ownerId, filters);

// ❌ À éviter — couplage implicite session ↔ ownership
const invoices = await listInvoices(session.userId, filters);
```

C'est cosmétique mais ça documente l'intention et facilite le refactor (`ownerId = session.organizationId` au switch).

---

## 8. CASL / Permissions — préparer la dimension organisation

Tu as un CASL simplifié `admin`/`client`. En multi-tenant, il devra gérer :
- L'appartenance à une organisation (`canAccessOrg(orgId)`)
- Le rôle dans l'organisation (owner / admin / member)
- Les permissions cross-org (un super-admin Anthropic-style, hors MVP)

### 8.1 À faire maintenant
- Garder les abilities CASL **agnostiques du scope** (elles définissent ce qu'un rôle peut faire, pas sur quelles ressources). Le scoping reste fait dans les services via `ownerId`.
- Ne **pas** introduire de logique du type `can('manage', 'Invoice', { ownerId: session.userId })` côté CASL — c'est redondant avec le scoping service et ça doublera le coût du refactor.

---

## 9. UI / UX — anticiper le selector d'organisation

L'interface admin actuelle suppose un seul contexte. Dans le futur :
- Header avec un selector d'organisation (à la Linear, Vercel, etc.)
- Routes potentiellement préfixées par `/[orgSlug]/admin/...`

### 9.1 À faire maintenant
- Réserver l'emplacement du selector dans le header admin, même vide. Un placeholder commenté `{/* OrgSelector — multi-tenant R4 */}` suffit.
- Ne **pas** créer de route préfixée par un segment dynamique qui collisionnerait avec un futur `/[orgSlug]/`. Tes routes actuelles sont sous `/admin/...` et `/account/...`, c'est OK.
- Dans les libellés UI, éviter "votre entreprise" / "votre compte" au profit de formulations neutres ("vos clients", "vos devis"). Plus facile à internationaliser ET à pluraliser en multi-tenant.

---

## 10. Checklist de validation avant chaque YAML R3+

Avant de merger un YAML ST9, ST10, ST11 (ou tout YAML futur jusqu'au MVP), vérifier :

- [ ] Toute nouvelle table métier a `owner_id NOT NULL REFERENCES users(id)`
- [ ] Toute nouvelle contrainte d'unicité métier est composite avec `owner_id`
- [ ] Toute nouvelle fonction service accepte `ownerId` en premier paramètre obligatoire
- [ ] Aucun hardcode `WHERE role = 'admin'` ou équivalent dans un service
- [ ] Aucun terme du glossaire réservé (section 4) n'est utilisé pour un autre concept
- [ ] Les nouvelles clés R2/storage incluent un préfixe `owners/<uuid>/`
- [ ] Les nouvelles metadata Stripe incluent `owner_id`
- [ ] La signature de `Session` n'est pas restreinte (rester compatible avec l'extension)
- [ ] Les tests utilisent une constante `SEED_ADMIN_OWNER_ID` (jamais un UUID en dur)

À ajouter dans `human_validation_checklist` de chaque YAML R3+ (Pattern 14).

---

## 11. Ce qu'on NE fait PAS maintenant (hors scope)

Pour éviter le scope creep, voici ce qui reste **explicitement reporté** :

- ❌ Table `organizations` — créée au moment du switch effectif
- ❌ Table `memberships` (relation user ↔ organization avec rôle) — idem
- ❌ Flow d'invitation utilisateur — idem
- ❌ Routes `/[orgSlug]/...` — idem
- ❌ Row-Level Security Postgres — idem (mais lis dès maintenant la doc RLS Postgres si curieux)
- ❌ Onboarding Stripe Connect — idem
- ❌ Billing multi-plan SaaS (Free/Pro/Business) — idem
- ❌ Quotas / rate limits par organisation — idem
- ❌ Custom domains par organisation — bien plus tard

**Tout ce qui est `❌` ci-dessus deviendra le scope de R4 ("Multi-tenant readiness") après MVP validé en utilisation perso.**

---

## 12. Estimation du switch effectif (post-MVP)

Avec ce doc respecté pendant R3+, l'effort de bascule multi-tenant devrait tenir en **5-7 sous-tickets** sur ~3-4 semaines :

| Ticket | Effort | Contenu |
|---|---|---|
| R4-ST1 | M | Table `organizations` + `memberships` + migration de `users.role` |
| R4-ST2 | M | Renommage `owner_id` → `organization_id` partout (mécanique) |
| R4-ST3 | L | Flow signup / création d'org / invitations |
| R4-ST4 | M | Org selector UI + routes `/[orgSlug]/admin/...` |
| R4-ST5 | M | RLS Postgres + tests sécurité cross-org |
| R4-ST6 | L | Stripe Connect onboarding + migration customers existants |
| R4-ST7 | M | Billing multi-plan SaaS (Free/Pro/Business sur ton offre) |

**Sans ce doc**, multiplier par 2 à 3. Avec, c'est essentiellement un refactor mécanique + 1 vraie feature (Connect).

---

## 13. Décisions ouvertes (à trancher avant R4)

À noter dès maintenant pour ne pas oublier :

1. **Stratégie de routing multi-tenant** : subdomain (`acme.app.tld`), path (`app.tld/acme/...`), ou header explicite ? Le path est le plus simple pour démarrer.
2. **Granularité du rôle dans l'org** : juste `owner` (= toi côté freelance) et `member` (employés qui aident à la facturation) ? Ou plus fin ?
3. **Stripe Connect type** : Standard (le freelance gère son dashboard Stripe), Express, ou Custom ? Express est le compromis classique pour ce genre de SaaS B2B.
4. **Soft delete vs hard delete des organisations** : conservation des données comptables (obligation légale 10 ans en France) → soft delete obligatoire.
5. **Migration des données existantes** : tes propres données (les clients de Cédric) vont dans une "organisation Cédric" automatiquement créée au switch. À scripter dans R4-ST2.

---

## 14. Référence rapide — pattern de migration `owner_id` reproductible

Pour le YAML de migration initiale (avant ST9 idéalement), template SQL réutilisable :

```sql
-- Step 1 — Ajouter la colonne nullable avec default temporaire
ALTER TABLE <table>
  ADD COLUMN owner_id uuid REFERENCES users(id);

-- Step 2 — Backfill avec l'admin unique
UPDATE <table>
  SET owner_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
  WHERE owner_id IS NULL;

-- Step 3 — Rendre NOT NULL
ALTER TABLE <table>
  ALTER COLUMN owner_id SET NOT NULL;

-- Step 4 — Index
CREATE INDEX <table>_owner_id_idx ON <table> (owner_id);

-- Step 5 — Si contrainte d'unicité métier existante, la rendre composite
ALTER TABLE <table> DROP CONSTRAINT <table>_number_unique;
ALTER TABLE <table>
  ADD CONSTRAINT <table>_owner_number_unique UNIQUE (owner_id, number);
```

À appliquer table par table : `clients`, `projects`, `quotes`, `invoices`, `payments`, `reports`, `prestations`, `maintenance_contracts`.

---

**Fin du document.** Ce doc est vivant : tout pattern multi-tenant découvert pendant ST9-ST11 doit être ajouté ici plutôt que dispersé dans des memories.
