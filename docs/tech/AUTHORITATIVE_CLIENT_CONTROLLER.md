# Wisdom Duel — controlador do cliente autoritativo

**Estado:** máquina de estados e testes locais concluídos; não ligada a React, HTTP real,
Supabase ou ao `GameScreen`.  
**Implementação:** `src/game/authoritativeClient.ts`

## Responsabilidade

O controlador é a futura fronteira entre a UI e os endpoints autoritativos. Recebe um
transporte e um gerador de UUIDs por injeção; não conhece tokens, URLs, Supabase, React ou
storage. A UI observa apenas uma projeção autenticada e metadados seguros do pedido.

```text
reconnect → ready → sending → ready
                    ├─ timeout/rede/500/429 → retryable → retry (mesmo commandId)
                    ├─ 409 version_conflict → conflict (nova decisão humana)
                    └─ rejeição definitiva → rejected/unavailable
```

## Invariantes

1. Não há comando antes de uma reconexão bem-sucedida.
2. `expectedVersion` vem exclusivamente da última projeção autenticada.
3. A projeção não muda enquanto o comando está `sending`; não existe update otimista.
4. Um resultado desconhecido conserva envelope/`commandId`; `retry()` não gera outro ID.
5. Só existe um comando lógico pendente. Outra intenção é recusada até o resolver.
6. `version_conflict` adota a projeção do servidor, elimina o pending e nunca auto-replay.
7. Projeções de outra partida, versões inválidas e respostas inconsistentes falham fechadas.
8. Respostas de reconexão antigas não fazem rollback da versão/sequência observadas.
9. Estado devolvido a subscribers/callers é clonado; mutação ou exceção externa é isolada.

O pending público contém apenas `commandId`, tipo, versão esperada e número de tentativas.
O payload continua interno ao controlador e o snapshot privado nunca existe no cliente.

## Integração futura

O adapter HTTP deverá obter o JWT da sessão atual no momento de cada chamada, mapear POST
e GET para os tipos do transporte e nunca persistir o token. Uma hook React pode usar
`subscribe/getState`, abortar pedidos no unmount e renderizar `ready`, `sending`,
`retryable`, `conflict`, `disconnected` e `unavailable` explicitamente.

Não ligar este controlador ao `GameScreen` legado enquanto este ainda inicializar snapshots,
executar timers ou settlement no browser. A troca deve ser por rota/gate e acompanhada de
testes Strict Mode, reconexão, 429/504, mudança de sessão e unmount.

## Hook React opt-in

`useAuthoritativeGameClient` recebe um controller já construído e é disabled quando
`enabled` não é exatamente `true`. A hook não conhece URL, JWT, Supabase nem singleton.
Quando ativada, subscreve primeiro, inicia reconnect com AbortSignal e no cleanup aborta e
remove a subscrição. Troca de controller oculta imediatamente o snapshot anterior; ações
`reconnect/send/retry` são callbacks estáveis e recusam chamadas enquanto disabled.

A hook continua sem consumidores na aplicação. O teste cobre enable tardio, Strict Mode,
unmount, troca de controller e retry duplicate antes de qualquer futura ligação à rota PvP.
