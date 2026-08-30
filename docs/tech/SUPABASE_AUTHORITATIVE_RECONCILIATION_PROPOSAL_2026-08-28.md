# Proposta de reconciliação Supabase autoritativa — 2026-08-28

**Classificação:** desenho para revisão; não é migração executável.  
**Aplicação:** proibida no projeto partilhado sem branch isolada, dump, preflight aprovado,
revisão humana e janela de rollback.  
**Fonte canónica provisória:** `mythicalSDK/supabase/migrations`, não as migrações
duplicadas desta aplicação.

## Decisão arquitetural

O estado de Wisdom Duel deve ter duas fronteiras de dados:

```text
Browser/JWT
   │ comando sem identidade/estado
   ▼
Edge Function default-off ── executor TypeScript ── commit interno atómico
                                                   │
                   ┌───────────────────────────────┴────────────────────────┐
                   ▼                                                        ▼
       wisdom_duel_private.*                                public.wisdom_duel_*_projections
       snapshot, comandos, eventos                          JSON mínimo por jogador
       sem grants cliente                                   SELECT + RLS; sem escrita cliente
```

O reducer corre antes da transação e sem locks. A operação de commit abre uma transação
curta, bloqueia uma única partida, repete as verificações de sessão/ator/versão e comita
snapshot, comando, evento e projeções juntos. Se outra jogada tiver avançado a versão, o
CAS falha e o resultado calculado fora da transação é descartado.

## Objetos propostos

Os nomes finais só devem entrar numa migração nova criada pelo CLI dentro da branch.

### Schema privado

`wisdom_duel_private` não é exposto pela Data API e não recebe `USAGE` para `anon` ou
`authenticated`.

| Objeto | Chave | Conteúdo/garantias |
|---|---|---|
| `matches` | `session_id uuid` PK/FK | `state_version bigint`, `event_sequence bigint`, estado/fase/deadline, snapshot e random privados, timestamps |
| `commands` | `(session_id, command_id)` PK | ator, fingerprint SHA-256, versão esperada/aceite, comando e resposta privadas; colisões de ID são recusadas |
| `events` | `(session_id, sequence)` PK | versão, comando, ator e evento append-only para replay/auditoria |

Regras mínimas:

- FK `session_id → public.game_sessions(id) ON DELETE CASCADE` e índice de toda FK que não
  seja já prefixo da PK.
- `state_version`, `event_sequence` e versões de comando são `bigint` não negativos.
- `timestamptz` em todos os relógios e deadline.
- checks de tipo JSON (`jsonb_typeof(...) = 'object'`) para snapshot/comando/evento.
- estado de partida limitado por check (`active`, `finished`, `cancelled`, `quarantined`).
- seed/random apenas no snapshot privado; commitment público, reveal apenas após fim.
- RLS ativado e forçado como defesa adicional, mas a barreira primária são schema/grants.
- nenhum objeto privado entra em `supabase_realtime`.

### Projeções expostas

| Objeto | Chave | Permissão |
|---|---|---|
| `public.wisdom_duel_player_projections` | `(session_id, player_id)` | `SELECT` apenas a `authenticated`; RLS `player_id = (select auth.uid())` |
| `public.wisdom_duel_spectator_projections` | `session_id` | sem grants/policy na primeira migração; ativação posterior e separada |

A projeção de jogador inclui `state_version`, `event_sequence`, `projection jsonb` e
`updated_at`. Não inclui seed, ordem futura, mão rival, opções privadas rivais ou snapshot.
O `player_id` usado pela policy tem índice dedicado; `session_id` é FK e prefixo da PK.
Não existem policies INSERT/UPDATE/DELETE nem grants de escrita para clientes.

Com as alterações graduais da Data API anunciadas em 2026, a migração tem de fazer
`GRANT SELECT` explicitamente; não pode depender de grants automáticos. A RLS continua
obrigatória mesmo com o grant mínimo.

### Função interna de commit

Função proposta: `wisdom_duel_private.commit_command(...)`, `SECURITY DEFINER`,
`SET search_path = ''`, referências totalmente qualificadas e `EXECUTE` apenas para
`service_role`. Revogar explicitamente `PUBLIC`, `anon` e `authenticated`.

Parâmetros lógicos:

- sessão, ator revalidado, `command_id`, fingerprint e `expected_version`;
- comando/evento/resultados já validados pelo executor;
- novo snapshot privado e exatamente duas projeções de jogador;
- nova fase/deadline e versão/sequence esperadas.

Algoritmo transacional:

1. Fixar `statement_timeout` e `lock_timeout` locais curtos.
2. Bloquear a linha de `matches` com `SELECT ... FOR UPDATE`.
3. Confirmar em `game_sessions` que `game_id='card_game'`, sessão jogável e partida ligada.
4. Confirmar em `session_participants` que o ator pertence à sessão e que existem
   exatamente dois participantes distintos.
5. Procurar `(session_id, command_id)`:
   - mesmo ator + fingerprint: devolver a resposta persistida como `duplicate`;
   - fingerprint/ator diferente: rejeitar colisão, sem mutação.
6. Comparar `expected_version` com `matches.state_version`; em diferença, devolver conflito
   e a projeção atual do ator, sem aceitar o resultado pré-calculado.
7. Verificar que nova versão/sequence são exatamente atuais + 1 e que as duas projeções
   têm a mesma versão.
8. Inserir comando/evento, atualizar snapshot e fazer upsert das duas projeções na mesma
   função. A ordem de locks é sempre sessão → comando → projeções ordenadas por player_id.
9. Devolver apenas a resposta/projeção do ator.

O commit não recebe vencedor/settlement como autoridade do cliente. A finalização Play
Hub será uma operação interna separada, idempotente, derivada do snapshot terminado e
revista também para stake GEM.

### Função interna de inicialização

Uma segunda função privada, também apenas para `service_role`, deve fazer
`create-if-absent` por `session_id`. Antes do INSERT, bloqueia/revalida
`game_sessions` + `session_participants`, confirma `card_game/casual/playing`, slots 1/2 e
a revisão das seleções. O primeiro worker persiste snapshot inicial, commitment, deadline
e duas projeções; concorrentes devolvem o registo já criado. A seed nunca é parâmetro de
uma RPC exposta ao cliente nem aparece no retorno público.

## Pré-condições duras

1. Criar branch Supabase isolada a partir da produção e snapshot/dump recuperável.
2. Executar `supabase_authoritative_preflight.readonly.sql`; guardar output fora do repo.
3. Comparar checksums/histórico remoto com as migrações canónicas do SDK.
4. Resolver migrações duplicadas/vazia apenas por migração forward-only canónica; não
   reescrever histórico já aplicado.
5. Confirmar colunas/constraints reais de `game_sessions` e `session_participants`.
6. Confirmar que `card_game_set_state` e `playhub_finish_session` continuam atrás dos
   gates enquanto o novo caminho está em sombra.
7. Gerar a migração com `supabase migration new`, testar reset da branch e produzir diff.
8. Passar `db lint`, advisors, pgTAP, testes de concorrência e backup/restore ensaiado.
9. Rever a migração no repositório canónico do Hub; este repo não deve ser a fonte de
   verdade do schema partilhado.

## Matriz RLS/RPC obrigatória

| Ator | Projeção própria | Projeção rival | Snapshot/comandos/eventos | Commit interno | Legado `set_state` |
|---|---:|---:|---:|---:|---:|
| `anon` | negar | negar | negar | negar | negar |
| autenticado fora da sessão | negar | negar | negar | negar | negar |
| jogador A | permitir A | negar B | negar | negar | negar após migração de tráfego |
| jogador B | permitir B | negar A | negar | negar | negar após migração de tráfego |
| espectador autenticado | negar | negar | negar | negar | negar |
| `service_role` da Edge | permitir operacional | permitir operacional | permitir operacional | permitir | apenas durante transição controlada |

Os testes pgTAP têm de cobrir também:

- acesso por REST e Realtime, não só SQL direto;
- UPDATE impossível mesmo quando SELECT é permitido;
- JWT sem `sub`, expirado, de outro projeto e utilizador removido;
- dois comandos concorrentes para a mesma versão;
- retry igual, colisão do mesmo ID e crash entre cada passo lógico;
- nenhuma seed/mão rival em resposta, log, evento público ou broadcast;
- `SECURITY DEFINER` sem search path mutável e sem EXECUTE acidental por `PUBLIC`.

## Realtime

Não alterar o schema `realtime`. Só depois da matriz RLS aprovada se pode adicionar
`public.wisdom_duel_player_projections` à publicação `supabase_realtime`. O cliente deve
continuar a refazer `SELECT` autenticado após um aviso de mudança; o payload de broadcast
não substitui a policy. A projeção de espectador permanece fora da publicação até decisão
específica de privacidade/latência.

## Migração do caminho legado

1. Criar novos objetos sem alterar consumidores existentes; gates fechados.
2. Backfill apenas de sessões de teste controladas, nunca de partidas ativas/stakes.
3. Publicar Edge Function com gate fechado e executar testes sintéticos service-to-service.
4. Abrir canário sem GEM para contas internas; dual-read comparativo, sem dual-write de
   autoridade.
5. Migrar clientes para projeções e comandos; observar conflitos/latência/erros.
6. Fechar criação de novas partidas pelo caminho legado.
7. Revogar EXECUTE cliente em `card_game_set_state` e impedir finish controlado pelo
   browser numa migração própria, depois de confirmar zero tráfego.
8. Reter tabelas legadas em modo read-only durante a janela de rollback; arquivar mais
   tarde, nunca apagar no mesmo lançamento.

## Rollback forward-only

O primeiro rollback é operacional: fechar `WISDOM_DUEL_PVP_ENABLED`, os modos do catálogo
e qualquer depósito GEM. Depois:

1. retirar a nova projeção da publicação Realtime;
2. revogar EXECUTE da função interna ao papel runtime específico/service role usada;
3. manter dados novos congelados para auditoria e exportar snapshot;
4. restaurar o frontend Training Preview;
5. só reabrir legado se a revisão confirmar que não reintroduz manipulação de estado ou
   stakes; caso contrário, PvP permanece indisponível;
6. corrigir por nova migração. Não fazer `DROP`, editar migração aplicada ou rollback
   destrutivo na base partilhada durante incidente.

## Critérios de aceitação

- Branch reproduzível do zero e diff limitado ao namespace Wisdom Duel.
- Zero grants inesperados e zero advisors de segurança de severidade alta.
- Matriz pgTAP completa; concorrência demonstra exatamente um aceite por versão.
- P95 do commit dentro do orçamento acordado e sem locks longos/deadlocks.
- Replay reconstitui o snapshot persistido e commitment/reveal são verificáveis.
- Runbook de backup/restore e rollback ensaiado.
- Aprovação conjunta dos responsáveis pelo Hub/SDK e Wisdom Duel.

Referências oficiais: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[testes de base com pgTAP](https://supabase.com/docs/guides/database/testing),
[migrações](https://supabase.com/docs/guides/deployment/database-migrations),
[branching](https://supabase.com/docs/guides/deployment/branching) e
[Realtime/Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).
