# Wisdom Duel containment C32 — execução isolada

**Data:** 2026-08-28

## Decisão de segurança

Produção, `wallet` e o worktree partilhado de `mythicalSDK` permanecem read-only para esta
tarefa. Bestiary Trails e Swarm Hunt usam a mesma base; além disso, a sessão de Swarm Hunt tem
alterações não commitadas em `wallet` e `mythicalSDK`. Nenhum desses ficheiros foi editado.

O trabalho C32 está dividido em duas unidades independentes:

1. patch local, não aplicado, que fecha as sete Edge Functions competitivas do SDK;
2. branch Supabase efémera para testar a base, sem merge nem dados de produção.

## Patch de contenção preparado

Artefacto: `docs/tech/patches/WISDOM_DUEL_CONTAINMENT_C32.patch`

Alvo verificado: `mythicalSDK` `main` em
`753bbf2ff9044e89b39e485b13913589e5fb049e`.

O patch contém 104 inserções e uma alteração de tipos em dez ficheiros:

- helper `wisdomDuelRelease.ts`, default-off por `WISDOM_DUEL_PVP_ENABLED`;
- 503 estável `wisdom_duel_disabled` antes de ler body, ambiente privilegiado ou criar clientes;
- gate nas sete funções `card-game-*` competitivas;
- dois testes Deno para valores permitidos/negados, envelope HTTP e CORS;
- normalização `Deno.env.get("POLYGON_RPC_URL") ?? null`, necessária para o `deno check` já
  exigido pelo tipo `CompetitionEnv`.

O `deal-cards` deste repositório já possui gate equivalente antes de
`SUPABASE_SERVICE_ROLE_KEY`. Assim, o change set combinado cobre as oito Edge Functions Wisdom
Duel identificadas no inventário C31.

Este patch:

- não toca migrações, tabelas, policies, grants, secrets ou catálogo;
- não contém caminhos de Bestiary Trails, Mythic Expedition ou Swarm Hunt;
- não foi aplicado ao SDK partilhado nem publicado numa Edge Function;
- não resolve por si só as RPCs `card_game_set_state`, `card_game_get_session_state` e
  `playhub_finish_session`.

Verificações realizadas numa cópia temporária limpa do SDK:

| Verificação | Resultado |
|---|---|
| `git apply --check --unidiff-zero` sobre o worktree atual do SDK | passou sem tocar no worktree |
| Teste Deno do gate | 2/2 passaram |
| `deno check` das sete funções | passou após a correção `undefined → null` |
| Whitespace do patch | sem findings |
| Worktree SDK original | manteve apenas as alterações preexistentes de Swarm Hunt |

Verificações no repositório Wisdom Duel:

| Verificação | Resultado |
|---|---|
| Testes focados de contenção/configuração | 3 ficheiros, 23 testes, todos passaram |
| Suite integral | 90 ficheiros, 430 testes, todos passaram |
| TypeScript | passou |
| ESLint | passou com zero erros |
| Alterações de schema | nenhuma; `supabase/migrations` não foi tocado |

## Tentativa de branch Supabase

O utilizador confirmou o custo de **US$ 0,01344 por hora**. Foi criada a branch efémera
`wisdom-duel-containment-c32`, ref `tldpemvkmczzkzzqgind`, sem dados de produção e sem merge.

A criação terminou em `MIGRATIONS_FAILED`:

- apenas 12 migrações ficaram registadas, até `20260310152000_training_mode`;
- o erro determinante foi `column "slug" of relation "games" does not exist`;
- `game_sessions`, `card_game_session_state` e objetos Mythic Expedition ainda não existiam;
- a branch parcialmente criada tinha 38 tabelas Dilema sem RLS, porque as migrações de hardening
  posteriores nunca chegaram a executar.

Essas 38 tabelas estavam vazias e existiram **apenas na branch falhada**. A branch foi eliminada
logo após guardar a causa, interrompendo o custo. Produção manteve RLS e não foi alterada.

O inventário final confirmou apenas a branch predefinida `main`, saudável, as mesmas 34 versões
de migração em produção e as mesmas versões das oito Edge Functions Wisdom Duel. Durante esta
janela houve atividade remota de Swarm Hunt por outra sessão; nenhuma alteração dessa sessão foi
incorporada, revertida ou sobrescrita.

## Causa de reprodutibilidade

O replay histórico não é autossuficiente. A migração
`20260518153000_unify_playhub_games.sql` insere/atualiza `games.slug`, mas o schema produzido
pelas migrações anteriores da branch ainda conserva a tabela `games` legada sem essa coluna.
Produção contém o estado intermédio necessário, mas esse estado não está reproduzido pela cadeia.

O problema não deve ser “corrigido” editando migrações já aplicadas ou adicionando um novo ficheiro
no fim: a branch falha antes de chegar a esse ficheiro. Além disso, os catorze primeiros ficheiros
do SDK são placeholders e não fornecem uma baseline completa para reconstrução independente.

## Próxima sequência segura

1. Responsáveis do Hub/SDK devem reconciliar uma baseline schema-only, checksums e histórico sem
   reescrever produção nem absorver alterações não commitadas de outras sessões.
2. Provar que uma branch nova chega às 34 migrações e termina `ACTIVE_HEALTHY`, com advisors/RLS
   equivalentes a produção.
3. Só então aplicar o patch C32 ao worktree canónico revisto e publicar as oito funções **na
   branch**, mantendo o secret ausente/false.
4. Invocar cada função na branch e provar 503 antes de auth, body, RPC, wallet ou `service_role`;
   provar também que `OPTIONS` continua funcional.
5. Criar numa migração separada, ainda na branch, a contenção das RPCs específica de
   `card_game`, sem revogar a RPC global aos restantes jogos.
6. Executar advisors, pgTAP, testes REST e matriz de consumidores. Não fazer merge para produção
   sem revisão conjunta e rollback operacional.

Referências oficiais: [branching](https://supabase.com/docs/guides/deployment/branching),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e
[autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth).
