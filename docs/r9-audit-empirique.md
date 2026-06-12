# Audit empirique R9-1 — Photographie factuelle du système

Date : 2026-06-11. Audit en lecture seule. Zéro modification prod.

---

## Q1 — Génération PDF : devis et factures

### Conclusion

**Aucune génération PDF côté serveur** pour devis ni factures. Aucune librairie de génération PDF n'est installée dans le monorepo (`pdfkit`, `jspdf`, `puppeteer`, `react-pdf`, `pdf-lib`, `pdfmake` absents de tous les `package.json`).

### Ce qui existe : upload + serve de PDF pour Reports uniquement

Le système de **Reports** (rapports d'intervention) supporte l'upload de fichiers PDF vers Cloudflare R2. La route de création `ReportForm.tsx` inclut un champ `file_path` (upload PDF).

La fonction `streamPdfFromR2` dans `apps/web/lib/storage/r2.ts` lit et sert un PDF stocké. Elle est consommée par deux routes API :

| Route | Contexte |
|---|---|
| `apps/web/app/api/reports/[id]/file/route.ts` | Téléchargement admin |
| `apps/web/app/api/account/reports/[id]/file/route.ts` | Téléchargement espace client |

### Ce qui est préparatoire : InvoiceRow.tsx

Le composant `apps/web/components/billing/InvoiceRow.tsx` expose une prop `pdfUrl` qui affiche un lien "PDF" si la valeur est fournie. **Aucun endpoint de génération PDF ne l'alimente** : ce composant est préparatoire ou placeholder. Aucun TODO explicite dans le code ne le signale.

### Résumé Q1

| Entité | Génération PDF | Stockage/Serve | TODO identifié |
|---|---|---|---|
| Reports | ❌ (upload manuel) | ✅ `streamPdfFromR2` | Non |
| Quotes | ❌ | ❌ | Non (prop `pdfUrl` silencieuse) |
| Invoices | ❌ | ❌ | Non (prop `pdfUrl` silencieuse) |

---

## Q2 — Champs exacts des forms : clients, devis, factures

### Clients

**DB** — table `clients` (`packages/db/src/schema.ts`, schéma drizzle) :

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `ownerId` | uuid FK → users | tenant owner |
| `name` | text | |
| `slug` | text | unique |
| `type` | enum | `company` \| `individual` |
| `email` | text | |
| `phone` | text nullable | |
| `billingAddress` | jsonb nullable | adresse structurée |
| `notes` | text nullable | |
| `archivedAt` | timestamp nullable | soft delete |
| `createdAt` / `updatedAt` | timestamp | |

Table liée `client_contacts` : `id`, `clientId`, `userId` (FK → users), `isPrimary`, `role`, `name`, `email`.

**UI** — `apps/web/app/(admin)/admin/clients/_components/ClientForm.tsx` :

| Champ UI | Champ DB | Type input |
|---|---|---|
| name | `name` | text |
| slug | `slug` | text |
| type | `type` | select (company / individual) |
| email | `email` | email |
| phone | `phone` | tel |
| address | `billingAddress` | textarea (free text) |
| notes | `notes` | textarea |

### Devis (Quotes)

**DB** — table `quotes` (schéma drizzle) :

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `ownerId` | uuid FK → users | |
| `clientId` | uuid FK → clients | |
| `projectId` | uuid FK → projects nullable | |
| `number` | text | numéro auto |
| `status` | enum | `draft` \| `sent` \| `accepted` \| `declined` \| `expired` |
| `issuedAt` | timestamp nullable | |
| `expiresAt` | timestamp nullable | |
| `acceptedAt` | timestamp nullable | |
| `totalEurCents` | integer | calculé |
| `vatRateBps` | integer | TVA en bps |
| `notes` | text nullable | |
| `createdAt` / `updatedAt` | timestamp | |

Table liée `quote_items` : `id`, `quoteId`, `prestationId`, `description`, `quantity`, `unitPriceEurCents`, `sortOrder`.

**UI** — `apps/web/app/(admin)/admin/quotes/_components/QuoteForm.tsx` :

| Champ UI | Champ DB | Type input | Restriction |
|---|---|---|---|
| clientId | `clientId` | select + search | création seult |
| projectId | `projectId` | select | |
| expiresAt | `expiresAt` | date picker | |
| vatRatePercent | `vatRateBps` | number (%) | converti en bps |
| notes | `notes` | textarea | |

Items via `QuoteItemsEditor.tsx` + `EditQuoteItemDialog.tsx` : `description`, `quantity`, `unitPriceEurCents`, `prestationId` (optionnel, pré-remplit description/prix).

### Factures (Invoices)

**DB** — table `invoices` (schéma drizzle) :

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `ownerId` | uuid FK → users | |
| `clientId` | uuid FK → clients | |
| `quoteId` | uuid FK → quotes nullable | devis source |
| `projectId` | uuid FK → projects nullable | |
| `number` | text | numéro auto |
| `status` | enum | `draft` \| `sent` \| `paid` \| `overdue` \| `cancelled` |
| `issuedAt` | timestamp nullable | |
| `dueAt` | timestamp nullable | échéance |
| `paidAt` | timestamp nullable | |
| `totalEurCents` | integer | calculé |
| `vatRateBps` | integer | TVA en bps |
| `stripePaymentIntentId` | text nullable | |
| `stripeCheckoutSessionId` | text nullable | |
| `notes` | text nullable | |
| `createdAt` / `updatedAt` | timestamp | |

Table liée `invoice_items` : `id`, `invoiceId`, `description`, `quantity`, `unitPriceEurCents`, `sortOrder`.

**UI** — `apps/web/app/(admin)/admin/invoices/_components/InvoiceForm.tsx` :

| Champ UI | Champ DB | Type input | Restriction |
|---|---|---|---|
| clientId | `clientId` | select + search | création seult |
| quoteId | `quoteId` | select devis source | création seult |
| projectId | `projectId` | select | |
| dueAt | `dueAt` | date picker | |
| vatRatePercent | `vatRateBps` | number (%) | converti en bps |
| notes | `notes` | textarea | |

Items via `InvoiceItemsEditor.tsx` + `EditInvoiceItemDialog.tsx` : `description`, `quantity`, `unitPriceEurCents`.

---

## Q3 — Système de tâches métier

### Conclusion

**Aucune entité "tâche métier"** (todo, action item, task client) n'existe dans le système. Voici ce qui existe et pourquoi ce n'est pas équivalent.

### Ce qui existe : agent_tasks (technique)

La table `agent_tasks` (`packages/db/src/schema.ts`, lignes 81-89) stocke des tâches d'**orchestration d'agents LLM** :

| Colonne | Contenu |
|---|---|
| `id` | uuid PK |
| `agentType` | type d'agent (technique) |
| `status` | `pending` \| `running` \| `done` \| `failed` |
| `payload` | jsonb — input agent |
| `result` | jsonb — output agent |

La route `apps/web/app/(admin)/admin/agent-tasks/page.tsx` affiche ces tâches à des fins de monitoring technique.

**Ce n'est pas** une entité métier : elle ne porte pas de client, pas d'échéance, pas d'assignataire humain.

### L'entité la plus proche : prestations

`prestations` (types `one_shot` | `recurring`) modélise des **services facturables**. C'est un catalogue de services, pas un tracker de tâches opérationnelles. Pas d'état d'avancement, pas d'assignataire, pas de date d'échéance sur la prestation elle-même.

### Résumé Q3

| Entité | Rôle | Tâche métier ? |
|---|---|---|
| `agent_tasks` | Orchestration agents LLM | ❌ technique uniquement |
| `prestations` | Catalogue services facturables | ❌ pas opérationnel |
| `maintenance_contracts` | Contrats récurrents | ❌ contractuel uniquement |

**Gap identifié** : pas de système de tâches métier (suivi d'interventions, actions client, to-do opérationnel).

---

## Q4 — Inventaire exhaustif des envois d'emails

Le système envoie **8 emails distincts**, répartis sur deux services.

### email.service.ts (`packages/services/src/email.service.ts`)

Transport configurable : SMTP, Resend, ou console (selon `EMAIL_PROVIDER`). Templates inline HTML.

| # | Fonction | Destinataire | Déclencheur |
|---|---|---|---|
| 1 | `sendVerificationEmail(email, token)` | Utilisateur | Inscription — vérification email |
| 2 | `sendPasswordResetEmail(email, token)` | Utilisateur | Demande reset mot de passe |
| 3 | `sendCustomerInvitationEmail(email, token, clientName, inviterName?)` | Contact client | Invitation espace client |
| 4 | `sendInvitationEmail(email, token, tenantName, inviterName?)` | Futur collaborateur | Invitation tenant/équipe |

Ces 4 emails sont **hors paiement Stripe** — auth et onboarding.

### notification.service.ts (`packages/services/src/notification.service.ts`)

Transport Resend uniquement (`getResendClient`). Templates React dans `packages/services/src/emails/`.

| # | Event | Handler | Template | Destinataire |
|---|---|---|---|---|
| 5 | `quote.sent` | `handleQuoteSentNotification` | `QuoteSentEmail.tsx` | Contacts du client |
| 6 | `invoice.sent` | `handleInvoiceSentNotification` | `InvoiceSentEmail.tsx` | Contacts du client |
| 7 | `report.issued` | `handleReportIssuedNotification` | `ReportIssuedEmail.tsx` | Contacts du client |
| 8 | `payment.failed` | `handlePaymentFailedNotification` | HTML inline | Admin (pas le client) |

L'email #8 est le **seul email lié au paiement Stripe**. Il notifie l'admin, pas le client.

### Résumé Q4

| Catégorie | Nb | Transport | Liés Stripe |
|---|---|---|---|
| Auth / invitation | 4 | SMTP ou Resend | 0 |
| Notifications métier | 3 | Resend | 0 |
| Paiement Stripe | 1 | Resend | 1 (payment.failed) |
| **Total** | **8** | | |

---

## Q5 — Couverture e2e des routes admin

### Arborescences de tests e2e

Deux répertoires contiennent des specs Playwright :
- `tests/e2e/` (racine du monorepo) — specs admin
- `apps/web/tests/e2e/` — specs admin + customer portal

### Routes admin existantes (27 pages)

Extraites de `apps/web/app/(admin)/admin/**/page.tsx`.

#### Routes couvertes par e2e (18/27)

| Route | Spec(s) | Localisation |
|---|---|---|
| `/admin/contracts` | `contracts.spec.ts` | `tests/e2e/` |
| `/admin/contracts/[id]` | `contracts.spec.ts` | `tests/e2e/` |
| `/admin/contracts/new` | `contracts.spec.ts` | `tests/e2e/` |
| `/admin/quotes` | `quotes.spec.ts` | `tests/e2e/` |
| `/admin/quotes/[id]` | `quotes.spec.ts` | `tests/e2e/` |
| `/admin/quotes/new` | `quotes.spec.ts` | `tests/e2e/` |
| `/admin/invoices` | `invoices.spec.ts` | `tests/e2e/` |
| `/admin/invoices/[id]` | `invoices.spec.ts` | `tests/e2e/` |
| `/admin/invoices/new` | `invoices.spec.ts` | `tests/e2e/` |
| `/admin/payments` | `payments.spec.ts` | `tests/e2e/` |
| `/admin/projects` | `projects.spec.ts` | `tests/e2e/` |
| `/admin/projects/[id]` | `projects.spec.ts` | `tests/e2e/` |
| `/admin/projects/new` | `projects.spec.ts` | `tests/e2e/` |
| `/admin/reports` | `reports.spec.ts` | `tests/e2e/` |
| `/admin/reports/[id]` | `reports.spec.ts` | `tests/e2e/` |
| `/admin/reports/new` | `reports.spec.ts` | `tests/e2e/` |
| `/admin/profile` | `admin-profile-password.spec.ts` | `apps/web/tests/e2e/` |
| `/admin/clients/[id]` | `customer-invitation-e2e.spec.ts` (navigation indirecte) | `apps/web/tests/e2e/` |

#### Routes admin NON couvertes par e2e (9/27)

| Route | Raison probable |
|---|---|
| `/admin` | Dashboard principal — pas de spec dédiée |
| `/admin/clients` | Liste clients — zéro spec |
| `/admin/clients/new` | Création client — naviguée en helper mais non testée directement |
| `/admin/prestations` | Liste prestations — zéro spec |
| `/admin/prestations/[id]` | Détail prestation — zéro spec |
| `/admin/prestations/new` | Création prestation — zéro spec |
| `/admin/users` | Gestion utilisateurs — zéro spec |
| `/admin/agent-tasks` | Monitoring agents — zéro spec |
| `/admin/spike-upload` | Spike upload — zéro spec |

### Résumé Q5

| Statut | Nb routes | % |
|---|---|---|
| Couvertes e2e | 18 | 67 % |
| Non couvertes | 9 | 33 % |
| **Total** | **27** | |

Zones à couvrir en priorité pour R9 : `/admin/clients` (list + new), `/admin/prestations` (CRUD), `/admin/users`.
