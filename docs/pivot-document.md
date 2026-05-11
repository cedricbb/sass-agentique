# Document de pivot — sass-agentique → atelier freelance

**Date** : 2026-05-12  
**Contexte** : Pivot d'un SaaS B2B multi-tenant vers un outil interne single-admin pour gérer une activité de freelance dev (clients, devis, factures, maintenance, rapports, CRM, mails pro).

---

## 1. Diagnostic — ce qui est dans le code aujourd'hui

### 1.1 Schéma DB actuel (packages/db/src/schema.ts)

| Table | État | Utilisable tel quel ? | Devient quoi dans la cible |
|---|---|---|---|
| `users` | Bien faite, complète (auth, TOTP, profil, ban) | ✅ OUI | Devient la table unique — toi (`role: admin`) + tes clients (`role: client`) |
| `sessions` | Standard NextAuth | ✅ OUI | Inchangée |
| `emailVerifications` | OK | ✅ OUI | Inchangée |
| `passwordResets` | OK | ✅ OUI | Inchangée |
| `totpChallenges` | OK | ✅ OUI | Inchangée (tu gardes ta 2FA admin) |
| `tenants` | Multi-tenant central | ❌ NON | **À supprimer** |
| `memberships` | Lien user × tenant × role | ❌ NON | **À supprimer** — le rôle est directement sur `users.role` |
| `invitations` | Inviter à rejoindre un tenant | ❌ NON | **À transformer** en "créer un compte client" (toi → client, pas un user → un autre user dans le même tenant) |
| `agentTasks` | Toujours scoped par `tenantId` | ⚠️ À adapter | **À refactor** : retirer `tenantId`, optionnellement ajouter `clientId` si certaines tâches concernent un client |
| `agentLogs` | OK (lié à agentTasks) | ✅ OUI | Inchangée |
| `plans` | Plans SaaS B2B (Free/Pro/Business) avec features quotas | ❌ NON | **À transformer** en `prestations` (catalogue de tes offres : site vitrine, e-commerce, maintenance, etc.) |
| `subscriptions` | Subscription Stripe d'un tenant | ⚠️ À renommer | **À transformer** en `maintenance_contracts` (uniquement pour les contrats récurrents de maintenance) |

**Tables manquantes à créer** pour la cible :

| Nouvelle table | Rôle |
|---|---|
| `clients` | Une ligne par client (entreprise ou indépendant). PAS la même chose que `users` — un client peut avoir plusieurs interlocuteurs avec compte (`users`) — ou aucun. |
| `client_contacts` | Liens N-N entre `clients` et `users` quand un client a un compte utilisateur sur la plateforme (et éventuellement plusieurs contacts au sein du même client) |
| `projects` | Un projet livrable pour un client (site web, app mobile, etc.) |
| `quotes` (devis) | Devis émis pour un client, lié optionnellement à un projet |
| `quote_items` | Lignes de détail du devis (prestation, quantité, prix unitaire) |
| `invoices` (factures) | Facture émise (peut découler d'un devis accepté) |
| `invoice_items` | Lignes de la facture |
| `payments` | Paiements reçus (carte Stripe, virement, autre) liés à une facture |
| `reports` | Rapports livrés au client (PDF, doc, etc.) |
| `prestations` | Catalogue de tes prestations standards (avec prix de référence pour devis rapide) |

Tables **encore plus tard** quand tu attaqueras le CRM complet :

| Table | Quand |
|---|---|
| `contacts` (CRM, distincts de client_contacts) | Phase CRM |
| `interactions` (calls, meetings, mails) | Phase CRM |
| `mail_threads` | Phase mails pro |
| `mail_accounts` (configuration IMAP/SMTP) | Phase mails pro |

### 1.2 Code applicatif actuel

| Surface | État | Décision pivot |
|---|---|---|
| **Auth login/register/2FA** | ✅ Fonctionne, tu l'as testée | **Garder** — c'est la base de tout |
| **`tenant.service.ts`** | Gère les tenants | **Supprimer** |
| **`membership.service.ts`** | Gère les memberships | **Supprimer** |
| **`invitation.service.ts`** | Invite à un tenant | **Refactor** en "create_client_account" (toi crées un compte pour ton client) |
| **`subscription.service.ts`** | Gère les subscriptions multi-tenant | **Refactor lourd** : devient `maintenance_contract.service.ts` ou suppression complète si tu factures la maintenance en récurrent classique (Stripe subscription par client, sans la notion de plan SaaS) |
| **`stripe.service.ts`** | Stripe wrapper (Customer, Checkout, Portal, Cancel) | **Garder largement** mais simplifier : `createCustomer` reste utile, `createCheckoutSession` à adapter (mode `payment` pour factures one-time, mode `subscription` pour maintenance) |
| **CASL `ability.ts`** | Matrice 4 rôles × 8 entités | **Refactor** : matrice 2 rôles (`admin` / `client`) × 5-6 entités (Quote, Invoice, Report, Project, Client). 30 tests à refaire. |
| **Page `/(admin)/admin/tenants`** | Liste les tenants | **Supprimer** la page, remplacer par `/(admin)/admin/clients` |
| **Page `/(admin)/admin/users`** | Liste tous les users | **Garder** — tu géreras tes comptes clients via cette page |
| **Page `/(admin)/admin/agent-tasks`** | Liste tes tâches agents | **Garder** — c'est pour toi |
| **Page `/(customer)/account/orders`** | Page "Mes commandes" vide pour user connecté | **Renommer + remplir** en `/account/quotes`, `/account/invoices`, `/account/reports` |
| **Page `/(customer)/account/profile`** | Profil utilisateur | **Garder** (le client peut éditer son profil) |
| **Page `/(customer)/account/security`** | 2FA pour user | **Garder** (mais facultatif côté client — à toi de voir si tu imposes 2FA aux clients) |
| **Page `/(marketing)/page.tsx`** | Landing "SaaS Agentique 500 équipes" | **Refactor complet** : devient ton site perso (à terme — c'est plus loin que la phase actuelle) |
| **Route `/api/billing/checkout`** | Crée un checkout pour subscription plan SaaS | **Refactor** : crée un checkout pour facture one-time OU pour subscription maintenance |
| **Route `/api/webhooks/stripe`** | Sync subscriptions avec table `subscriptions` | **Refactor** : sync les invoices + (si maintenance récurrente) sync maintenance_contracts |

### 1.3 Bonne nouvelle au milieu du chantier

| Asset | Pourquoi c'est précieux |
|---|---|
| Pipeline Orchid fonctionnel + standups + reports historisés | **Premier levier productivité** — tu peux ré-utiliser exactement le même workflow pour le pivot |
| Schéma DB Drizzle bien organisé + migrations propres | Refactor DB clean, pas de bricolage |
| Layout `(admin)` vs `(customer)` déjà séparé en route groups | **Match parfait** avec ton modèle admin/client final |
| `validateSession` partout via Server Components | Pattern propre, à garder |
| `email.service.ts` + Inngest | Réutilisables pour envoyer devis/factures par mail |
| Tests existants (53+ avant 5.4/5.5) | Filet de sécurité — il faudra les refactor mais le harnais existe |

---

## 2. Vision cible — modèle de domaine et architecture

### 2.1 Architecture single-tenant simplifiée

```
Une seule instance, un seul "espace de travail" = toi.
Pas de notion de tenant, pas de RLS multi-tenant.

users (rôle : "admin" OU "client")
  └─ toi (1 ligne avec role=admin)
  └─ tes clients (N lignes avec role=client, optionnellement)

clients (entité métier "société/personne avec qui tu bosses")
  └─ peut avoir 0, 1 ou N comptes user liés via client_contacts
  └─ peut avoir 0 ou N projets
  └─ peut avoir 0 ou N devis
  └─ peut avoir 0 ou N factures
  └─ peut avoir 0 ou N rapports
  └─ peut avoir 0 ou 1 contrat maintenance actif

projects (livrables à terme — sites web, apps, etc.)
  └─ lié à 1 client
  └─ peut générer N devis, N factures, N rapports

quotes (devis)
  └─ lié à 1 client, optionnellement 1 project
  └─ status : draft → sent → accepted → declined → expired
  └─ accepté en ligne → génère une invoice

invoices (factures)
  └─ lié à 1 client, optionnellement 1 quote, 1 project
  └─ génère un lien de paiement Stripe (mode payment)
  └─ status : draft → sent → paid → overdue → cancelled

maintenance_contracts (optionnel)
  └─ lié à 1 client, 1 prestation type "maintenance"
  └─ Stripe subscription (récurrent)
  └─ status : active → past_due → canceled

reports (rapports livrés)
  └─ lié à 1 client, optionnellement 1 project
  └─ fichier PDF/markdown stocké

prestations (catalogue tes offres)
  └─ ex: "Site vitrine 1-5 pages", "E-commerce", "Maintenance mensuelle"
  └─ basePrice + description + (optionnellement stripeProductId si récurrent)
  └─ utilisé pour créer des devis rapidement
```

### 2.2 Rôles applicatifs

| Rôle | Capacités |
|---|---|
| `admin` (toi) | Tout — créer/lire/modifier/supprimer toutes entités, voir tous les rapports, accéder aux agents IA, gérer ton CRM, tes mails pro |
| `client` | Lecture seule de SES propres entités : ses devis (avec action accepter/refuser), ses factures (avec action payer), ses rapports (lecture/download), son profil |

Pas de OWNER/MEMBER/VIEWER. Juste **admin** et **client**.

### 2.3 Quelle place pour Stripe ?

D'après tes réponses :
- Factures = paiement carte via Stripe (mode `payment`, lien de paiement envoyé par mail)
- Maintenance = subscription récurrente Stripe (mode `subscription`, le client autorise un prélèvement)
- PAS de Stripe Checkout pour des "plans SaaS" — la page Pricing publique disparaît du périmètre actuel

Donc Stripe sert pour :
1. **Customer** : 1 Stripe Customer par client (créé quand tu crées le client en DB)
2. **PaymentIntent / Invoice** : 1 par facture émise (lien de paiement envoyé au client par mail)
3. **Subscription** : 1 par contrat de maintenance actif

La table `plans` actuelle est conceptuellement la mauvaise abstraction. Mais elle pourrait servir de base pour `prestations` après refactor (l'idée d'un catalogue avec prix de référence et features est utile pour un catalogue de prestations).

---

## 3. Stratégie de pivot — refactor / garder / supprimer

### 3.1 Trois options stratégiques

| Stratégie | Description | Coût | Risque dette |
|---|---|---|---|
| **A — Bulldozer** | Tout reprendre depuis zéro avec un nouveau repo, single-tenant nativement | Très élevé (2-3 mois minimum) | Faible |
| **B — Refactor en place propre** | Garder l'infra (auth, sessions, agent tasks, Stripe wrapper, Orchid), supprimer/refactor les couches multi-tenant, ajouter les nouvelles entités client/quote/invoice/etc. | Moyen-élevé (3-4 semaines focus) | Moyen — code transitionnel à nettoyer rigoureusement |
| **C — Compromis kludge** | Garder `tenants` comme une table à 1 ligne (toi), créer les clients comme une autre entité dans CE tenant. Code reste sémantiquement bizarre mais bouge vite. | Faible (1 semaine) | **Élevé** — tu vas porter la dette pendant des mois |

**Ma recommandation : Stratégie B (refactor en place propre)**.

Pourquoi pas A : ton code Auth + Sessions + TOTP + Orchid pipeline + Stripe wrapper est solide. Repartir de zéro c'est gâcher 2 mois de travail propre.

Pourquoi pas C : tu vas accumuler de la confusion sémantique partout. Les agents IA d'Orchid vont produire du code aligné sur le mauvais modèle. Chaque feat aval va hériter de la dette. Tu vas y revenir dans 3 mois en haïssant l'idée.

### 3.2 Phasage du refactor (stratégie B)

**Phase R1 — Préparation et filet de sécurité** *(1-2 jours)*
- Snapshot complet du code (tag git `pre-pivot-v1`)
- Documentation des AC fonctionnels actuels qui marchent (tu te logues, tu vois ton admin panel, tes agent tasks) — pour comparer après refactor
- Désactivation temporaire des features 5.x non encore livrées dans Orchid (déposer dans `backlog/parked/` au lieu de `todo/`)

**Phase R2 — Refactor schema DB et services bas niveau** *(1 semaine)*
- Migration Drizzle : suppression `tenants`, `memberships`, `invitations`. Adaptation `agentTasks` (retirer `tenantId`). Renommage `plans` → `prestations` ET allègement des champs (les features quotas SaaS disparaissent). Renommage `subscriptions` → `maintenance_contracts` OU suppression complète si tu préfères recommencer cette table proprement.
- Création des nouvelles tables : `clients`, `client_contacts`, `projects`, `quotes`, `quote_items`, `invoices`, `invoice_items`, `payments`, `reports`, `prestations`
- Refactor services : supprime `tenant.service.ts` et `membership.service.ts`. Crée `client.service.ts`, `quote.service.ts`, `invoice.service.ts`, `report.service.ts`. Adapte `stripe.service.ts` pour les 3 usages (Customer, Invoice/PaymentIntent, Subscription maintenance).
- Refactor CASL : matrice `admin` / `client` × 6 entités. Refais les 30 tests permissions.
- Mise à jour du seed : 1 admin (toi), 2-3 clients de démo, 1-2 devis, 1 facture, 1 rapport.

**Phase R3 — Refactor frontend admin** *(1 semaine)*
- Suppression `/(admin)/admin/tenants`
- Création `/(admin)/admin/clients` (liste, création, édition d'un client)
- Création `/(admin)/admin/clients/[id]` (vue détail d'un client avec ses projets/devis/factures/rapports)
- Création `/(admin)/admin/quotes` (liste + création + édition)
- Création `/(admin)/admin/invoices` (liste + création + paiement Stripe)
- Création `/(admin)/admin/reports` (liste + upload/génération + envoi)
- Création `/(admin)/admin/prestations` (catalogue éditable)
- Adaptation `/(admin)/admin/users` pour distinguer "admin" et "client" dans la vue

**Phase R4 — Refactor frontend client** *(3-5 jours)*
- Renommage `/(customer)/account/orders` → `/account/quotes` (le client voit ses devis avec actions accepter/refuser)
- Création `/account/invoices` (factures + lien paiement Stripe)
- Création `/account/reports` (lecture/download)
- Conservation `/account/profile` et `/account/security`
- Refactor `CustomerShell` pour la nouvelle navigation

**Phase R5 — Stripe & webhooks adaptés** *(3-5 jours)*
- Route `/api/billing/checkout` adaptée : `mode: 'payment'` pour facture one-time, `mode: 'subscription'` pour maintenance, ou les deux
- Webhook `/api/webhooks/stripe` adapté : écoute les events `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*` pour maintenance
- Lien de paiement par mail : email.service.ts envoie un lien de checkout au client après émission de facture

**Phase R6 — Landing page perso** *(1-2 jours, optionnel à différer)*
- Refactor `/(marketing)/page.tsx` en s'inspirant de ton site actuel
- Listing des prestations (lecture de la table `prestations`)
- Formulaire de contact qui crée une opportunité

**Phase R7 — Quick wins productivité** *(à boucler à la fin)*
- Génération PDF des devis et factures
- Acceptation en ligne du devis (page publique avec token signé, pas besoin de compte)
- Envoi mail automatique : devis prêt → mail au client avec lien d'acceptation, devis accepté → mail à toi
- Génération de la facture à partir d'un devis accepté en 1 clic

**Estimation totale** : **3-4 semaines** de travail focus si Orchid tourne bien (vu les vitesses observées sur 5.4 et les fixes). Ce qui fait facilement **8-10 semaines** en passant sur ton temps libre.

### 3.3 Quoi faire des phases 5.x non livrées ?

Voici l'état honnête des YAMLs Stripe que tu m'avais envoyés :

| YAML | Décision pivot |
|---|---|
| `stripe-billing-spec` | Périmé — refait dans Phase R2 |
| `stripe-billing-schema` | Périmé — refait dans Phase R2 |
| `stripe-billing-plans-sync` | Périmé — refait dans Phase R2 (devient prestations sync) |
| `stripe-billing-services` (5.4) ✅ déjà livré | **Garde le code**, sera adapté en R2/R5 (`stripe.service` reste utile, `subscription.service` est refactoré) |
| `stripe-billing-webhooks` (5.5) | YAMLs S0-S3 que je viens de te livrer → **À PARKER** pour l'instant, les webhooks seront refait en R5 contre le nouveau modèle |
| `stripe-billing-checkout` (5.6) | **À PARKER** — refait en R5 contre le nouveau modèle |
| `stripe-billing-portal` (5.7) ✅ déjà livré | **À supprimer** — pas pertinent pour ton modèle (le Customer Portal Stripe permet à un user de gérer son abonnement SaaS — ici tes clients ne gèrent pas leurs abonnements, c'est toi qui les pilotes) |
| `stripe-billing-mockups` (5.8) ✅ déjà livré | **Périmé** — les maquettes étaient pour une page Pricing publique SaaS qui disparaît |
| `stripe-billing-pricing-page` (5.9) | **À supprimer** — pas de page Pricing publique |
| `stripe-billing-settings-page` (5.10) | **À transformer** : ce n'est plus une page de gestion d'abonnement, c'est un dashboard client qui affiche devis/factures/rapports — refait en R4 |
| `stripe-billing-feature-flags` (5.11) | **À supprimer** — pas de feature flags par plan, le système admin/client suffit |
| `stripe-billing-tests` (5.12) | **À retravailler** — les tests cibleront les nouveaux services R2 |

**Action immédiate sur Orchid** : avant de continuer, vide `backlog/todo/` et `backlog/qa/` de tout YAML lié à Stripe billing actuel.

---

## 4. Roadmap recommandée — ordre d'attaque

### Semaine 1 — Fondations refactor

| Jour | Action | Livrable |
|---|---|---|
| J1 | Tag git `pre-pivot-v1`, doc AC actuels qui marchent, parking des YAMLs périmés | Repo dans un état figé connu |
| J2-3 | Génération template manager.md pour la phase R2 — décomposition en sous-tâches S | YAMLs prêts à entrer dans Orchid |
| J4-5 | Phase R2 partie 1 : nouveau schema DB + migrations Drizzle (suppression tables multi-tenant, création des nouvelles) | DB migrée, seed adapté |

### Semaine 2 — Couche services + permissions

| Jour | Action | Livrable |
|---|---|---|
| J6-8 | Phase R2 partie 2 : services métier (`client.service`, `quote.service`, `invoice.service`, `report.service`) | Services testés unitairement |
| J9-10 | Refactor CASL en `admin`/`client`, refais les 30 tests permissions | Matrice permissions verte |

### Semaine 3 — Frontend admin

| Jour | Action | Livrable |
|---|---|---|
| J11-13 | Pages admin clients, projets, devis, factures, rapports, prestations | UI admin fonctionnelle |
| J14-15 | Stripe wrapper R5 : adaptation pour invoices + subscriptions maintenance | Lien de paiement Stripe testé en mode test |

### Semaine 4 — Frontend client + intégrations

| Jour | Action | Livrable |
|---|---|---|
| J16-17 | Pages client (dashboard, devis acceptables, factures payables, rapports) | UI client fonctionnelle |
| J18-19 | Webhooks Stripe + email.service envoi devis/facture au client | Boucle complète : devis → mail → acceptation → facture → paiement |
| J20 | Test end-to-end manuel : tu crées un client de test, lui crées un devis, l'acceptes côté client, génères la facture, la paies avec une carte de test Stripe | Workflow complet validé |

### Semaines 5+ — Extension du périmètre

Une fois les fondations solides :
- Génération PDF des devis et factures
- CRM (contacts, interactions, mails pro)
- Site perso public (landing)
- Tableau de bord business (revenus, factures impayées, devis en attente)

---

## 5. Quick wins court terme — avant d'attaquer R1

Pendant que tu réfléchis au timing du pivot, tu peux ces 3 actions sans risque immédiates :

### 5.1 Geler le backlog actuel

```bash
mkdir -p projects/sass-agentique/backlog/parked
git mv projects/sass-agentique/backlog/todo/20260305-feat-stripe-billing-* \
       projects/sass-agentique/backlog/parked/
git commit -m "park: stripe billing features avant pivot single-tenant"
```

Tu gardes la trace de l'analyse passée sans risquer qu'Orchid relance ces tâches.

### 5.2 Tagger l'état actuel

```bash
git tag pre-pivot-v1
git push --tags
```

Filet de sécurité — tu peux revenir à cet état si tu te plantes pendant le refactor.

### 5.3 Documenter ton AC fonctionnel minimal qui marche

Crée un fichier `docs/manual-acceptance-pre-pivot.md` qui dit :

```
État qui fonctionne au 2026-05-12 :
- [x] pnpm dev démarre sans erreur sur localhost:3001
- [x] Login admin@saas.dev / admin1234 OK
- [x] Dashboard /admin charge et affiche le panel admin
- [x] Page /admin/agent-tasks accessible
- [x] Page /admin/users liste les 5 users de démo + admin
- [x] Page /admin/tenants liste les 4 tenants de démo
- [x] /account/profile chargeable après login
- [x] /account/security affiche le statut 2FA
- [x] pnpm test : 53+ tests verts
```

Pendant le refactor, à chaque grosse étape, tu repasses cette checklist (avec les ajustements de noms post-refactor) pour t'assurer que rien n'est cassé silencieusement.

---

## 6. Décisions à valider avec moi avant que je décompose la Phase R2

Pour préparer les YAMLs Orchid de la phase R2, j'ai besoin de quelques décisions courtes :

### D1 — La maintenance, c'est Stripe Subscription ou pas ?

Tu m'as dit "contrat de maintenance récurrent" (Q2 ligne maintenance). Deux options :
- **(a)** Subscription Stripe classique (carte du client prélevée chaque mois automatiquement, à ton compte Stripe). Plus simple à automatiser mais le client doit autoriser le prélèvement.
- **(b)** Facturation manuelle mensuelle (tu génères une facture chaque mois, le client paie par lien). Plus de friction mais plus flexible.

Mon avis : **(a)** pour la plupart des clients, avec **(b)** comme fallback pour ceux qui refusent la subscription.

### D2 — Le "site perso" (landing public) : tu veux le faire dans CE repo ou un autre ?

Ton site actuel `cedricbillard-dev.fr` est probablement déployé séparément. Deux options :
- **(a)** Mettre le site perso dans `apps/web/(marketing)/` (route group déjà séparé) — un seul déploiement, une seule DB, le site lit `prestations` directement
- **(b)** Garder ton site perso séparé, et l'outil de gestion sur un sous-domaine (`app.cedricbillard-dev.fr` ou `admin.cedricbillard-dev.fr`)

Mon avis : **(a)** pour profiter de tout ton stack — tu écris ta phase landing dans le même monorepo, tu changes `cedricbillard-dev.fr` quand tu es prêt à basculer.

### D3 — Le `users` actuel a `role: text` avec valeur "user" ou "admin". Tu acceptes que je le restreigne à un enum `"admin" | "client"` strict ?

Migration Drizzle :
```sql
ALTER TABLE users
  ALTER COLUMN role TYPE user_role
    USING (CASE role WHEN 'admin' THEN 'admin'::user_role ELSE 'client'::user_role END);
```

Tes 5 users de démo (`alice@acme.dev`, etc.) deviennent `role=client`, le seul `role=admin` reste `admin@saas.dev` (toi).

### D4 — Les agents IA, ils restent attachés à toi seul ?

Actuellement `agentTasks` a un `tenantId`. Dans le nouveau modèle :
- **(a)** Pure global : tu retires `tenantId` tout court, les agents tasks sont uniquement à toi
- **(b)** Attaché à un client optionnellement : tu retires `tenantId` mais tu ajoutes `clientId nullable` pour des tâches genre "scanner les mails du client X"

Mon avis : **(a)** pour démarrer (plus simple), **(b)** plus tard si tu en as vraiment besoin.

### D5 — Garde-tu Inngest pour l'instant ?

Inngest sert pour les workflows asynchrones (mails, génération PDF, sync Stripe). Tu l'as installé en phase 5.5 mais avec uniquement les 2 handlers stubs. Pour la phase R5 il faut décider :
- **(a)** Garder Inngest — c'est la bonne solution pour scaler les workflows async (mails à envoyer, PDFs à générer, retries Stripe webhook)
- **(b)** Retirer Inngest pour l'instant et faire les workflows en synchrone dans les routes API — moins propre mais simple

Mon avis : **(a)** garder. C'est un coût d'installation déjà payé.

---

## 7. Conclusion

Tu pivotes d'un SaaS B2B générique vers un atelier freelance single-admin. C'est un pivot conceptuel important mais **techniquement gérable** parce que :

1. **L'infra Auth/Sessions/TOTP/Stripe wrapper/Orchid pipeline est solide** — tu la gardes
2. **Le schéma DB est bien organisé** — la migration vers le nouveau modèle est mécanique
3. **L'architecture (admin) vs (customer) en route groups t'aide déjà** — tu réutilises la séparation
4. **Orchid te donne un levier de productivité massif** pour refaire les services et UI en 3-4 semaines de focus

La perte sèche c'est environ 1.5 phase de travail (le multi-tenant + les YAMLs Stripe pricing/portal). C'est désagréable mais pas catastrophique — beaucoup mieux que de continuer pendant 3 mois sur le mauvais produit.

**Réponds aux D1-D5** quand tu as un moment et je te livre les YAMLs de **Phase R1 (parking + setup) + Phase R2 partie 1 (schema DB pivot)** comme premier batch concret à exécuter via Orchid.

---

## Annexe — Réponse rapide aux questions sous-jacentes

### "Est-ce que je dois jeter le code des phases 5.4 webhooks stripe que tu m'as livrés ?"

**Non.** Les YAMLs S0-S3 webhooks que je viens de te livrer sont à PARKER (déplacer dans `backlog/parked/`). Quand on attaquera la Phase R5, beaucoup du contenu de S2/S3 (mocks Stripe, tests signature) sera réutilisable presque tel quel — on changera juste les events ciblés (`invoice.paid` au lieu de `customer.subscription.created`).

### "Est-ce que je perds tout mon travail Phase 5 services-1 et services-2 ?"

**Non.** Le `stripe.service.ts` que tu as testé en 5.4 reste utile à 80%. La méthode `createCustomer` est exactement ce dont tu as besoin. `createCheckoutSession` est utilisable avec `mode: 'payment'` pour les factures one-time. Le wrap d'erreur reste pertinent. Seul `cancelSubscription` perd son sens dans le nouveau modèle (sauf pour maintenance).

`subscription.service.ts` par contre est largement à refaire — sa logique `canUpgrade`/`canDowngrade` n'a pas de sens hors d'un modèle de plans tarifaires. Les méthodes `getByTenantId` / `getActivePlan` / `isFeatureEnabled` disparaissent.

### "Et mon dashboard /admin avec ses 5 sections, je le perds ?"

**Non.** Tu remplaces juste 1 section (tenants) par une nouvelle (clients), tu en ajoutes 3-4 (quotes, invoices, reports, prestations), tu gardes les autres telles quelles (users, agent-tasks, profile, sécurité).

### "C'est trop tard pour faire le pivot maintenant ?"

**Non, c'est exactement le bon moment.** Tu as remarqué la dissonance avant que le code n'aille trop loin sur le mauvais modèle. Si tu attendais 2 mois de plus à coder des features billing/feature-flags/pricing-page sur le mauvais modèle, là tu serais dans la merde. À ce stade, tu as essentiellement 4 phases déjà livrées (auth, multi-tenant que tu vas supprimer, RBAC à refactor, billing partiel à refactor). Le coût du pivot est gérable.
