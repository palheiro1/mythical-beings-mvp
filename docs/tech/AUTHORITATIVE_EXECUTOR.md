# Executor e porta de persistência autoritativos — Wisdom Duel

**Estado:** executor local e adapter transacional de referência implementados em memória;
não publicados e sem ligação à base partilhada.  
**Fronteira:** `src/game/authoritativeExecutor.ts` recebe a identidade já autenticada separadamente do envelope do cliente.

## Garantias implementadas

1. O executor está desligado por omissão e só abre com `enabled: true`.
2. A identidade do ator não existe no comando wire; é injetada pela futura camada JWT.
3. Só participantes podem executar ou obter uma projeção de jogador.
4. `expectedVersion` implementa compare-and-swap em memória: entre dois comandos na mesma versão, apenas o primeiro é aplicado.
5. `commandId` é idempotente: um retry idêntico devolve `duplicate`; reutilizá-lo com outro ator ou payload é recusado.
6. O estado é validado antes e depois do reducer. Uma falha pós-transição não altera versão, eventos ou snapshot.
7. As instâncias de cartas e escolhas são sempre resolvidas a partir do snapshot privado; IDs de cartas rivais não concedem posse.
8. A projeção de jogador contém a sua mão e apenas a contagem da mão rival. A seed e a ordem do deck são omitidas.
9. Escolhas sobre mão rival usam chaves opacas como `choice-1`; não expõem `instanceId`, nome ou imagem.
10. Projeções de espectador estão desligadas por omissão e nunca incluem mãos ou efeitos pendentes.

## Aleatoriedade e replay

- O motor usa `chacha20-v1`, com seed criptográfica de 256 bits por partida.
- O shuffle usa Fisher–Yates com rejection sampling, sem `Math.random()`.
- O cursor da stream faz parte apenas do snapshot privado, permitindo reproduzir efeitos e reshuffles posteriores.
- A seed recebe um commitment SHA-256 com domínio antes do jogo.
- `revealFinishedMatchSeed` recusa partidas ainda ativas e verifica o commitment guardado antes da revelação.
- O algoritmo é verificado contra o vetor zero-key do RFC 8439.
- `replayAuthoritativeEvents` volta a executar os comandos aceites e falha se sequência, versão, tipo ou ID tiverem sido adulterados.

## Fluxo interno

```text
release gate → identidade autenticada → validação wire → participante
→ idempotência → estado/deadline → CAS → regras → reducer
→ invariantes → commit de snapshot/evento/projeção
```

O executor original mantém um commit atómico dentro de uma instância JavaScript. O caminho
durável de referência separa agora cálculo e persistência:

```text
load snapshot/version → calcular sem lock → commit curto por match
                                      ├─ commandId existente: duplicate/collision
                                      ├─ versão mudou: conflict + projeção atual
                                      └─ versão igual: snapshot+evento+projeções atómicos
```

`DurableAuthoritativeCommandService` depende apenas de
`AuthoritativePersistencePort`. `TransactionalInMemoryAuthoritativeStore` implementa a
porta e pode ser partilhado por várias instâncias do serviço, modelando o lock/CAS que a
futura RPC Postgres terá de cumprir. Não é uma base de produção.

O fingerprint durável é SHA-256 sobre uma serialização canónica do envelope. Assim, ordem
de chaves JSON diferente não muda a identidade lógica, mas qualquer mudança no comando
produz colisão segura.

### Semântica sob falhas

- falha antes do commit: snapshot, versão, evento e comando permanecem intactos;
- falha depois do commit mas antes da resposta: o cliente pode ver erro/timeout, mas o
  retry com o mesmo `commandId` devolve `duplicate` e não repete o efeito;
- duas instâncias na mesma versão: uma comita e a outra recebe `version_conflict` com a
  projeção privada atual;
- duas instâncias com o mesmo comando: uma devolve `accepted`, outra `duplicate`, com um
  único evento persistido;
- reconexão lê a projeção materializada do jogador na versão atual, sem snapshot, seed ou
  mão rival.

## O que ainda não está autorizado

- Não existe endpoint HTTP/Edge que exponha este executor.
- Não existe persistência Postgres; o lock multi-instância é uma simulação determinística
  da porta e ainda precisa de conformance tests contra uma branch isolada.
- O deadline é recusado pelo relógio do servidor local, mas a adjudicação automática de timeout ainda não está implementada.
- A projeção de espectador não possui atraso nem política de autorização.
- A seed privada continua dentro do snapshot privado e nunca pode ser serializada por um handler público.
- As RPCs legadas e o SDK partilhado permanecem inalterados.

## Testes de aceitação atuais

Os testes em `tests/gameReducer/authoritativeExecutor.test.ts`,
`durableAuthoritativeService.test.ts`, `commandFingerprint.test.ts`, `projections.test.ts`,
`random.test.ts`, `protocol.test.ts` e `invariants.test.ts` cobrem:

- gate default-off e autenticação;
- identidade injetada e não controlável pelo cliente;
- participante, turno e posse;
- duplicação e colisão de `commandId`;
- conflito CAS;
- escolha oculta e não revelação de informação;
- deadline sem commit;
- espectador default-off;
- seed/commit/reveal;
- replay exato e deteção de adulteração;
- referências pendentes obsoletas e random state inválido.
- corrida entre duas instâncias, retry concorrente, colisão entre instâncias e projeção de
  reconexão;
- falha injetada antes/depois do commit sem escrita parcial ou aplicação duplicada.

Antes de qualquer transporte real, o executor deve ser movido para uma Edge Function isolada e o store substituído por uma única RPC transacional privada, depois de a migração e a matriz RLS serem revistas num ambiente separado.
