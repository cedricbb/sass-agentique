# SaaS Agentique — Rules pour agents swarm

## Architecture — 3 couches strictes
- UI → Service → Persistence (jamais de cross-layer)
- Les composants React ne font JAMAIS d'appels Drizzle directs
- Les services ne font JAMAIS d'import React
- Les mutations passent par Server Actions ou API Routes dédiées
- Toujours inclure tenantId dans les queries DB

## Naming conventions
- Services : [domain].service.ts (ex: stripe.service.ts)
- Events Inngest : [domain].[action] (ex: user.created)
- Schema Drizzle : snake_case pour les colonnes
- Components : PascalCase, un composant par fichier
- Hooks : useXxx
- Agent tools : [verb]-[noun].tool.ts

## Agents
- Chaque agent étend BaseAgent
- Les tools sont injectés, pas importés directement
- Toujours logger le début et fin de chaque tool call
- Le contexte tenant EST OBLIGATOIRE dans chaque agent task
- Les résultats d'agents sont persistés en DB avant retour

## Tests
- Coverage 80%+ sur les services
- Chaque service a son fichier de test correspondant
- Tests Playwright pour les flows critiques (auth, billing, agents)

## Swarm workflow
- Chaque feature = un slug dans .swarm/features/<slug>/
- Toujours `swarm-log daily` en début de session
- Toujours `swarm-log feature <slug>` en début de feature
- Les blockers sont nommés explicitement dans le standup