# Wisdom Duel — protocolo autoritativo v1

**Estado:** protocolo, executor local e fronteira HTTP neutra implementados; PvP continua desligado.  
**Versão wire:** `wisdom-duel-command-v1`  
**Regras:** `rulebook-v1`

## 1. Objetivo e fronteira de confiança

O navegador envia apenas uma intenção de jogada. Nunca envia nem decide:

- identidade do jogador;
- estado completo, mãos, deck ou ordem futura das cartas;
- jogador atual, turno, versão ou deadline efetivos;
- aleatoriedade, resultado, vencedor, score ou settlement;
- escolhas que não existam no `pendingEffect` autoritativo.

A identidade vem do JWT validado pelo servidor. O servidor carrega o snapshot privado,
verifica versão/invariantes/regras, executa uma única transição e persiste comando, evento,
snapshot e projeções numa transação atómica.

## 2. Gates obrigatórios

| Gate | Estado necessário para abrir PvP |
|---|---|
| UI | `VITE_ENABLE_PVP=true` apenas no build intencional |
| Edge Function | `WISDOM_DUEL_PVP_ENABLED=true`; ausência significa `false` |
| Catálogo Play Hub | jogo/modo ativos apenas na janela de lançamento |
| SDK partilhado | criação, depósito, lock e settlement verificam o mesmo release gate |
| Persistência | RPCs legadas que aceitam estado/resultado do cliente deixam de ser executáveis |
| Segurança | testes RLS/projeções, concorrência e reconexão aprovados numa branch isolada |

O gate da Edge Function é verificado antes de ler `SUPABASE_SERVICE_ROLE_KEY`. Um frontend
ativado por engano não pode ultrapassar o gate do servidor.

## 3. Envelope de comando

Definido em `src/game/protocol.ts`:

```json
{
  "protocolVersion": "wisdom-duel-command-v1",
  "matchId": "uuid",
  "commandId": "uuid único por tentativa lógica",
  "expectedVersion": 7,
  "command": {
    "type": "rotate_creature",
    "creatureId": "lafaic"
  }
}
```

`commandId` é a chave de idempotência. Um retry conserva o mesmo id. O servidor devolve o
resultado já persistido para duplicados e nunca aplica a transição duas vezes.

### Comandos permitidos

| Comando wire | Campos controláveis | Dados derivados pelo servidor |
|---|---|---|
| `rotate_creature` | `creatureId` | jogador, turno, rotação atual |
| `draw_knowledge` | `marketInstanceId` | carta/id, deck seguinte, limite de mão |
| `summon_knowledge` | `handInstanceId`, `creatureId` | carta/id, custo, sabedoria, efeitos |
| `rotate_knowledge` | `fieldInstanceId`, `creatureId` | proprietário, rotação, efeitos |
| `resolve_pending_effect` | `effectId` e `choiceKey`, ou `skip=true` | escolha completa a partir do snapshot |
| `end_turn` | nenhum | próximo jogador, fase, deadline |

`INITIALIZE_GAME`, `SET_GAME_STATE`, `playerId`, `winner`, `state`, `knowledgeId` redundante
e payloads com campos desconhecidos são rejeitados.

## 4. Respostas e códigos

- `accepted`: comando aplicado, com `stateVersion`, `eventSequence` e projeção nova.
- `duplicate`: mesma resposta lógica de um `commandId` já aceite.
- `rejected`: código estável e mensagem segura.

Códigos v1: `multiplayer_disabled`, `unauthorized`, `not_participant`,
`invalid_command`, `version_conflict`, `rule_violation`, `match_not_playable`,
`deadline_expired`, `internal_error`.

Um conflito devolve HTTP 409, versão atual e projeção atualizada. O cliente não reaplica a
jogada automaticamente sem decisão explícita do utilizador.

O mapeamento HTTP, autenticação, CORS, limite de corpo e rate limit estão definidos em
`AUTHORITATIVE_HTTP_BOUNDARY.md`. A implementação continua sem endpoint ou persistência.

## 5. Persistência e atomicidade

O protótipo em `src/game/authoritativeExecutor.ts` já executa CAS, idempotência, evento e
snapshot de forma atómica dentro de uma instância JavaScript. Serve para provar o contrato
e os casos adversariais; não é persistência distribuída e ainda não é um endpoint.

Objetos-alvo, todos com namespace `wisdom_duel_` para não colidir com outros jogos:

- `wisdom_duel_matches`: versão, fase, deadline e snapshot privado;
- `wisdom_duel_commands`: `(session_id, command_id)` único, ator e resultado;
- `wisdom_duel_events`: `(session_id, sequence)` único, evento append-only;
- `wisdom_duel_player_projections`: projeção A/B por versão;
- `wisdom_duel_spectator_projections`: projeção pública atrasada/opcional.

As tabelas privadas ficam sem grants para `anon`/`authenticated`; apenas uma RPC interna
de commit, executável pelo `service_role`, pode fazer CAS e append. O commit recebe
`expectedVersion`, rejeita se a versão mudou e grava numa única transação:

1. reserva/verifica `commandId`;
2. confirma versão e deadline;
3. persiste snapshot com `version + 1`;
4. insere evento com a mesma sequência;
5. grava projeções A/B/espectador;
6. guarda a resposta idempotente.

Não se implementa esta mudança diretamente na base partilhada até existir branch, dump e
matriz RLS aprovados.

## 6. Estado privado e projeções

`src/game/projections.ts` implementa as projeções locais. O jogador vê a própria mão, a
contagem rival e chaves opacas para escolhas escondidas. A projeção de espectador fica
desligada por omissão e nunca recebe `pendingEffect`.

| Campo | Servidor | Jogador A | Jogador B | Espectador |
|---|---:|---:|---:|---:|
| Mão A | cartas | cartas | quantidade/versos | quantidade/versos |
| Mão B | cartas | quantidade/versos | cartas | quantidade/versos |
| Ordem do deck | completa | apenas quantidade | apenas quantidade | apenas quantidade |
| Mercado/campo/descarte | completo | público | público | público |
| Seleção antes de ambos confirmarem | completa | própria | própria | oculta |
| Seleção após reveal atómico | completa | pública | pública | pública |
| `pendingEffect` privado | completo | só se dirigido a A | só se dirigido a B | omitido |
| Logs | técnico + jogo | eventos públicos | eventos públicos | eventos públicos atrasados |

Realtime publica apenas a alteração da projeção. Nenhuma subscrição aponta para o snapshot
privado ou para `dealt_hands` globais.

## 7. Invariantes obrigatórias

`src/game/invariants.ts` implementa a primeira versão verificável. Antes e depois de cada
transição o servidor rejeita atomicamente estados que violem, entre outras:

- exatamente dois jogadores com identidades únicas;
- exatamente três criaturas/slots únicos por jogador;
- identidade das instâncias de Knowledge única em todas as zonas;
- turno, fase e contador de ações válidos;
- vencedor nulo ou pertencente à partida e apenas em `gameOver`;
- mão acima de cinco apenas durante descarte obrigatório;
- rotações em `0/90/180/270`;
- efeitos pendentes associados a atores e escolhas válidas;
- slots bloqueados únicos entre 0 e 2;
- `rulesVersion=rulebook-v1`.

O servidor valida também regras de domínio por comando: ator atual, custo, posse da carta,
alvo, efeito pendente, estado da sessão, seleção/lock e deadline.

## 8. RNG, deal e deadlines

- Proibido `Math.random()` em PvP/GEM. O inicializador e os reshuffles do motor usam agora
  a stream privada `chacha20-v1`.
- Seeds usam `crypto.getRandomValues`; o shuffle Fisher–Yates é determinístico a partir da
  seed e do algoritmo versionado. O vetor RFC 8439 está coberto por teste.
- Para auditabilidade, guardar `seedCommit` antes do deal e revelar `seed` após a partida,
  sem expor a ordem do deck durante o jogo.
- Deal e reveal das seleções são operações únicas e idempotentes.
- Deadlines são timestamps do servidor. Suspender, atrasar ou alterar o relógio do browser
  não prolonga o turno.
- Qualquer comando após deadline primeiro adjudica timeout/abandono e só depois responde.

## 9. Resultado e settlement

Somente o evento autoritativo `game_finished` gera resultado. O servidor escreve
`session_results` e solicita settlement. O cliente não chama `playhub_finish_session` com
um vencedor construído localmente e nunca recebe assinatura de settlement antes de:

1. estado `gameOver` válido;
2. evento final persistido;
3. locks/deposits confirmados;
4. idempotência do settlement garantida.

## 10. Matriz mínima de aceitação

| Caso | Resultado obrigatório |
|---|---|
| Mesmo comando duas vezes | uma transição, segunda resposta `duplicate` |
| Dois comandos na mesma versão | um aceite, um `version_conflict` |
| Jogador B no turno de A | `rule_violation` sem escrita |
| Payload com `playerId/state/winner` | `invalid_command` |
| Jogador tenta usar carta da mão rival | `rule_violation` sem revelar a carta |
| Espectador lê snapshot privado | negado por grants/RLS |
| A lê projeção B | negado; recebe apenas a sua projeção |
| Cliente suspenso até ao deadline | timeout decidido pelo servidor |
| Retry após falha de rede no commit | resposta idempotente |
| Reconexão com versão antiga | snapshot/projeção atual + sequência de eventos |
| Gate ausente/false | `multiplayer_disabled` antes de credenciais/dados |
| Estado pós-reducer viola invariantes | transação abortada e alerta operacional |

## 11. Ordem de implementação

1. ~~Congelar fixtures douradas do reducer e aumentar testes de propriedades/invariantes.~~
2. ~~Criar executor local `wisdom-duel-command` com store em memória para validar contrato.~~
3. Preparar branch Supabase e migrações canónicas sem tocar em produção.
4. Implementar commit CAS/idempotente e projeções.
5. Migrar clientes para comandos; manter leitura legada apenas durante transição.
6. Revogar `card_game_set_state` e o finish controlado pelo cliente.
7. Executar matriz RLS, concorrência, reconexão, carga e falha.
8. Só então avaliar os gates de lançamento PvP/GEM.
