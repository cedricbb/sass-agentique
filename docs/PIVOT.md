# Pivot sass-agentique — résumé exécutif

> Mai 2026 — Analyse complète : [docs/pivot-document.md](pivot-document.md)

## TL;DR

Pivot de SaaS B2B multi-tenant vers atelier freelance single-admin.
Refactor en place du monorepo existant : suppression du modèle tenants/memberships/invitations,
introduction de clients/projects/quotes/invoices/reports.
Infra conservée : Auth, Sessions, TOTP, Stripe wrapper, Inngest, Orchid pipeline.
Perte sèche estimée à 1.5 phase (multi-tenant + YAMLs Stripe pricing/portal).
YAMLs Stripe billing 5.5-5.12 parqués dans `backlog/parked/`.
Tag `pre-pivot-v1` posé comme filet de sécurité avant toute modification.

## Avant / Après

| Dimension | Avant (SaaS B2B) | Après (freelance) |
|---|---|---|
| Cible utilisateur | Entreprises SaaS multi-tenant | Freelance dev solo (Cédric) + ses clients |
| Modèle de données | tenants/memberships/invitations | clients/projects/quotes/invoices/reports |
| Rôles | OWNER/ADMIN/MEMBER/VIEWER multi-tenant | `admin` / `client` strict |
| Catalogue | Plans Free/Pro/Business (souscription) | Prestations (catalogue de devis vendus) |
| Stripe | Subscription SaaS récurrent | Facture one-time + subscription maintenance |
| Page d'accueil `/` | Pricing public SaaS | Portfolio (site perso intégré) |
| Backlog | Features Stripe billing 5.5-5.12 actives | Parquées dans `backlog/parked/` |

## Décisions clés

| Décision | Choix | Implication |
|---|---|---|
| D1 Maintenance | Stripe Subscription (a) + facturation manuelle (b) en fallback | `maintenance_contracts.billing_mode: enum("stripe_auto", "manual_invoice")` |
| D2 Site perso | Monorepo, route group `(marketing)` | Pas de séparation de déploiement |
| D3 Enum role | `users.role` strict `enum("admin", "client")` | Migration Drizzle USING + nouveau compte admin email pro |
| D4 agentTasks | Pure global, retire `tenantId`, pas de `clientId` | Réouverture future si besoin (connecteurs IA mails/calendrier) |
| D5 Inngest | Conservé | Workflows async réutilisables pour mails/PDF/webhooks |
| Portfolio | Option A — portfolio dominant | `/` portfolio, `/login` entrée client, `/account/*` dashboard client, `/admin/*` admin. Reskin couleurs SaaS sur le portfolio |

## Roadmap R1-R7

| Phase | Livrable | Effort |
|---|---|---|
| R1 Parking + setup pivot | YAMLs Stripe 5.5-5.12 parqués, `docs/PIVOT.md` créé, `pivot-document.md` déplacé sous `docs/` | 1-2 jours |
| R2 Schema DB + services + CASL | Migration Drizzle (suppression tenants, création clients/quotes/invoices/etc.) + services métier + refactor CASL `admin`/`client` × 6 entités | 2 semaines |
| R3 Frontend admin | Pages clients, projects, quotes, invoices, reports, prestations | 1 semaine |
| R4 Frontend client | `/account/quotes`, `/account/invoices`, `/account/reports` refactor | 3-5 jours |
| R5 Stripe + webhooks adaptés | Routes API checkout/portal/webhook réécrites pour invoices one-time + maintenance | 3-5 jours |
| R6 Intégration portfolio | Migration des 5 pages du portfolio dans `(marketing)` avec reskin couleurs SaaS (deps : countup.js, react-type-animation, swiper, react-icons) | 2-3 jours |
| R7 Quick wins productivité | PDF devis/factures, acceptation en ligne, mails auto | 3-5 jours |

Total : 3-4 semaines focus, ou 8-10 semaines en temps libre.

## Pointeurs

- Analyse complète : `docs/pivot-document.md`
- Tag git de sécurité : `pre-pivot-v1`
- Backlog parqué : `projects/sass-agentique/backlog/parked/`
- Brief de reprise : tenu hors repo (collé en début de chat pour reprise)