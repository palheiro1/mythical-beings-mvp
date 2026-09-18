# Inventário read-only do Supabase partilhado — 2026-08-28

## Limite e método da inspeção

O acesso administrativo ao projeto `mythical-beings-play-hub`
(`zbmkhvpokopvhnochcjr`, `eu-west-1`) ficou disponível no checkpoint C31. O projeto estava
`ACTIVE_HEALTHY`, em PostgreSQL 17.6, no momento da inspeção.

A inspeção permaneceu estritamente read-only:

- listagem de projeto, tabelas, migrações, extensões, branches, Edge Functions e advisors;
- `SELECT` apenas sobre catálogos PostgreSQL, policies, grants, assinaturas/definições de
  quatro RPCs relevantes e configuração agregada do jogo;
- contagens agregadas de estados competitivos e logs das últimas 24 horas;
- nenhuma leitura de emails, wallets, tokens, mãos, resultados ou registos individuais;
- nenhum DDL/DML, migração, secret, geração de chave, deploy, branch ou alteração no Hub/SDK.

O output administrativo não foi guardado porque inclui metadados operacionais. Este documento
regista apenas conclusões necessárias para a auditoria.

## Resultado executivo

| ID | Severidade | Achado remoto confirmado | Consequência |
|---|---|---|---|
| DB-01 | **P0** | `playhub_finish_session(uuid,jsonb)` aceita do host ranks/scores e converte-os diretamente em `session_results`, GEM, saldo, perfil e leaderboard | Um cliente/host controla o resultado económico; não existe prova autoritativa da partida |
| DB-02 | **P0** | `card_game_set_state(uuid,jsonb)` permite a qualquer participante substituir todo o estado, sem ação, versão/CAS ou validação das regras | Estado fabricável, race/lost update e resultado derivado de dados não confiáveis |
| DB-03 | **P0** | O `deal-cards` remoto v9 não contém o gate default-off presente no worktree; jogo, `casual`, `competitive_gem` e season casual continuam ativos | Esconder a UI não desativa a superfície server-side; há drift entre código local e produção |
| DB-04 | **P0** | `card_game_get_session_state` devolve `dealt_hands`, seleção e estado integrais a qualquer participante | Cada jogador pode obter informação privada do adversário |
| DB-05 | **P1** | `games`, `game_sessions`, `session_participants` e `session_results` têm grants completos para `anon`/`authenticated`; policies `SELECT ... USING (true)` tornam os registos publicamente legíveis | RLS está ligada, mas a policy deliberadamente ampla pode expor identificadores, sessões e resultados além da necessidade do jogo |
| DB-06 | **P1** | O `deal-cards` remoto embaralha com `sort(() => 0.5 - Math.random())` | RNG enviesado/não auditável e inadequado para competição com stake |
| DB-07 | **P1** | Não existe branch Supabase de desenvolvimento e não existe `wisdom_duel_private` | Não há ambiente remoto isolado para provar migração, RLS, rollback e concorrência |
| DB-08 | **P2** | Sete FKs relevantes não têm índice prefixo, incluindo três referências de resultado competitivo e FKs partilhadas de participantes/resultados | Risco de scans e locks mais longos à medida que o Hub cresce; qualquer correção partilhada exige medição e revisão |
| DB-09 | **P2** | RPCs `SECURITY DEFINER` relevantes usam `search_path=public[...]`, não `search_path=''` | Hardening incompleto; o schema `public` não concede `CREATE` aos clientes, o que reduz, mas não elimina, a dívida |

Os advisors Supabase devolveram **zero avisos de segurança e zero de desempenho**. Isso não
invalida os achados: advisors detetam padrões conhecidos, mas não sabem que o resultado/estado
do jogo deveria ser decidido pelo servidor nem que uma policy pública é demasiado ampla para o
produto.

## Estado remoto observado

### Catálogo e exposição operacional

| Objeto | Estado | Nota |
|---|---|---|
| `games.card_game` | `is_enabled=true` | O backend continua a anunciar o jogo como ativo |
| `game_modes.(card_game, casual)` | `is_enabled=true` | Criação de sessões casuais permanece permitida |
| `game_modes.(card_game, competitive_gem)` | `is_enabled=true` | O modo com stake não está desligado no catálogo |
| `leaderboard_seasons.card_game_casual_season_1` | `is_active=true` | `playhub_finish_session` encontra uma season e pode atribuir GEM |
| Competições | 4 em `waiting_deposits` | Contagem agregada; não foi inspecionado qualquer participante |
| Depósitos | 4 em `pending` | Não prova transferência concluída; não foram lidos valores/wallets |
| Card locks | 0 | Sem locks persistidos no momento da leitura |

Não apareceu tráfego das funções Wisdom Duel nos logs administrativos das últimas 24 horas.
Esse intervalo curto não prova ausência histórica nem torna seguro reativar o caminho.

### Tabelas, RLS e Realtime

As quatro tabelas específicas atuais — `card_game_session_state`,
`card_game_competitions`, `card_game_competition_deposits` e
`card_game_competition_card_locks` — têm RLS ativa. As três tabelas competitivas concedem
apenas `SELECT` a `authenticated`, filtrado por participação. `card_game_session_state` também
é lida apenas quando o helper confirma participação.

As tabelas nucleares partilhadas também têm RLS, mas os grants base são amplos e as seguintes
policies são públicas:

- catálogo `game_modes`: leitura total;
- `game_sessions`, `session_participants` e `session_results`: leitura total;
- `games`: leitura total, além de policies de insert/update dependentes de `auth.uid()`.

Não existem relações `wisdom_duel_*`, schema `wisdom_duel_private` nem tabelas Wisdom Duel na
publicação Realtime. A configuração `pgrst.db_schemas` não ficou visível na sessão administrativa;
portanto, a lista efetiva de schemas expostos pela Data API continua por confirmar no Dashboard.

### RPCs e autoridade

| RPC | Executor cliente | Autoridade observada |
|---|---|---|
| `card_game_set_state` | `authenticated` | Participante fornece e substitui `p_state` integral |
| `card_game_get_session_state` | `authenticated` | Participante recebe `dealt_hands` e snapshot integral |
| `card_game_get_public_session_state` | `authenticated` | Remove mãos, aplica redator e só aceita sessão `playing`; `anon` não executa |
| `playhub_finish_session` | `authenticated` | Host fornece todos os players/ranks/scores; valida forma/participação, mas não a verdade do jogo |

`playhub_finish_session` serializa por sessão e impede resultados duplicados, mas depois usa o
payload do host para atribuir pontos, GEM, saldo e leaderboard. A idempotência não resolve a falta
de autoridade: apenas garante que o resultado fabricável é aplicado uma vez.

### Edge Functions

Existem oito funções relacionadas com Wisdom Duel ativas: `deal-cards` e sete funções
competitivas. As sete competitivas têm `verify_jwt=true`. `deal-cards` tem
`verify_jwt=false`, mas faz validação manual do bearer token com `auth.getUser`, confirma host,
modo e participantes antes de usar `service_role`.

Ainda assim, o bundle remoto de `deal-cards` v9:

- não importa nem verifica `MULTIPLAYER_RELEASE_FLAG`;
- aceita `casual` e `competitive_gem`;
- usa `Math.random()` para ambas as variantes do deal;
- permite CORS `*` e não contém rate limit próprio.

O worktree local adiciona um gate default-off antes de ler a credencial privilegiada, mas essa
versão **não está publicada**. Nenhuma das sete funções competitivas remotas contém um gate de
release Wisdom Duel equivalente.

## Migrações e drift entre fontes

| Fonte | Estado | Conclusão |
|---|---|---|
| Produção Supabase | 34 versões, até `20260806123500_fix_swarm_hunt_service_key_compat` | Histórico completo do Hub atual |
| `mythicalSDK/supabase/migrations` | 34 versões | Os números de versão alinham 34/34 com produção; continua a fonte canónica provisória |
| `mythical-beings-mvp/supabase/migrations` | 10 ficheiros, até `20260430090300` | Não reproduz produção nem contém competições, locks ou projeção de espectador |
| Tipos locais do jogo | Contrato parcial | Não descrevem todos os objetos remotos que o runtime utiliza |

A equivalência de versões/nomes não substitui checksums dos statements remotos. Os catorze primeiros
ficheiros do SDK são placeholders de histórico e não permitem reconstruir essas versões iniciais
sem uma baseline/dump controlada.

## Índices de FKs a rever

O preflight encontrou FKs sem índice prefixo em:

- `card_game_competitions`: `winner_profile_id`, `lost_card_owner_profile_id` e
  `lost_card_recipient_profile_id`;
- `games.current_turn_player_id`;
- `session_participants.player_id`;
- `session_results.player_id` e `session_results.reward_currency_id`.

As FKs centrais por `session_id` e todas as FKs das tabelas de depósitos/locks têm cobertura.
Não se recomenda criar os sete índices às cegas: primeiro é preciso observar queries/planos e
separar os três objetos do jogo das quatro tabelas partilhadas.

## Regras de segurança imediatas

1. Tratar PvP/GEM como **NO-GO** mesmo que o frontend esconda os botões.
2. Não publicar o worktree diretamente: o gate existe apenas em `deal-cards`, enquanto as outras
   funções competitivas e as RPCs perigosas permanecem acessíveis.
3. Não alterar/revogar `playhub_finish_session` global sem mapa de consumidores: é uma RPC
   partilhada por outros jogos.
4. Não executar as migrações deste jogo contra produção.
5. Não alterar `realtime`, catálogo, policies, grants ou índices no projeto partilhado durante a
   auditoria.
6. Preservar `mythicalSDK/supabase/migrations` como fonte canónica provisória; qualquer correção
   será forward-only e revista no repositório do Hub/SDK.

## Plano pendente, por ordem

### P0 — contenção revista antes de qualquer release

1. Produzir um change set mínimo, ainda não aplicado, que bloqueie **todas** as oito Edge Functions
   Wisdom Duel por uma flag server-side default-off antes de criar clientes privilegiados.
2. Definir, com os responsáveis do Hub, a contenção do catálogo (`card_game`, `casual`,
   `competitive_gem`) e o rollback exato; a alteração é pequena mas partilhada e não será assumida.
3. Impedir que `card_game` use `playhub_finish_session` para rewards e impedir novos estados via
   `card_game_set_state`; manter compatibilidade dos outros jogos.
4. Tratar os quatro depósitos pendentes apenas após revisão operacional; esta auditoria não os
   cancela nem interpreta como fundos confirmados.

### P0/P1 — branch autoritativa isolada

1. Obter aprovação de custo e criar uma branch Supabase temporária; produção não tem branches.
2. Gerar baseline/dump recuperável e hashes das definições relevantes.
3. Aplicar numa migração nova o schema privado, comandos/versionamento, eventos e projeções por
   jogador descritos na proposta autoritativa.
4. Substituir estado integral por comandos, CAS e idempotência; RNG criptográfico/auditável.
5. Criar settlement específico do jogo, derivado do snapshot final e executável apenas pelo
   runtime server-side.
6. Testar a matriz pgTAP como `anon`, não participante, A, B, espectador e serviço, incluindo
   REST/Realtime e concorrência.

### P1/P2 — hardening e reconciliação

1. Reduzir grants das tabelas nucleares só depois de mapear consumidores de todos os jogos.
2. Substituir leitura pública irrestrita por projeções deliberadas e classificação de dados.
3. Mover helpers privilegiados para schema não exposto, usar `search_path=''`, nomes totalmente
   qualificados e EXECUTE mínimo.
4. Medir os sete índices candidatos com planos e estatísticas; migrar apenas os comprovados.
5. Integrar `db reset`, `db lint`, advisors e pgTAP na CI do repositório canónico.
6. Fazer canário sem GEM, dual-read e rollback ensaiado antes de retirar o legado.

## Evidência ainda necessária

- lista de schemas expostos efetivamente pela Data/GraphQL API;
- checksums/baseline das 34 migrações e ensaio de restauração;
- configuração de backups/PITR e janela de rollback;
- matriz pgTAP/RPC/REST/Realtime numa branch isolada;
- análise de consumidores das RPCs/tabelas partilhadas;
- histórico operacional superior a 24 horas e classificação dos depósitos pendentes;
- revisão externa antes de qualquer stake real.

Referências oficiais: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth),
[branching](https://supabase.com/docs/guides/deployment/branching),
[mudança de exposição da Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
e [lockdown do schema Realtime](https://supabase.com/changelog/realtime-schema-locked-down-against-modification).
