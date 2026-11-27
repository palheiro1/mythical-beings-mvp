# Auditoria de hooks React — 2026-08-28

## Âmbito

Revisão dos avisos `react-hooks/exhaustive-deps` após C8. O Training Preview usa
`BotGame`; `GameScreen` e os hooks Supabase pertencem ao PvP legado, que continua
default-off e será substituído pelo protocolo autoritativo.

## Correções seguras aplicadas

| Ficheiro | Risco | Correção |
|---|---|---|
| `GameStateDebug.tsx` | callback de refresh mudava em cada render | `useCallback([gameId])` e effect dependente do callback |
| `useGameActions.ts` | draw podia procurar a carta num mercado antigo | `currentGameState` incluído na callback de draw |
| `BotGame.tsx` pending effect | timeout capturava dependências incompletas | efeito depende do objeto `pendingEffect` e de `handleAction` |
| `BotGame.tsx` AI | loop capturava uma versão antiga de `handleAction` | callback incluída na dependência; `botThinking` impede loop paralelo |
| `GameScreen.tsx` floater | `Math.random()` durante render mudava a identidade em qualquer render | contador local avança só quando nasce um evento; callback de conclusão é estável |
| `GameScreen.tsx` turno | `isMyTurn` podia ficar um render atrasado por ser state atualizado em effect | seletores puros derivam viewer/turno diretamente do snapshot atual |
| `GameScreen.tsx` power | effect capturava game/log/registry com deps parciais e expressões complexas | delta/defesa são puros; effect recebe powers, IDs, log e registry completos e simples |
| `GameScreen.tsx` descarte | comparava fields inteiros com game/registry fora das deps | snapshot/detector puros, reset por game ID e deps explícitas preservam ordem/imagem |
| `GameScreen.tsx` novo log | effect duplicava floater e capturava state/registry fora das deps | parser/attack source puros; log move só a carta e power delta é única fonte do floater |
| `GameScreen.tsx` perfis | state/effect podia duplicar fetch ou aplicar resposta de outro par | hook com key estável, cache, in-flight dedupe e cleanup lógico por par |

Estas alterações foram validadas por lint focado, typecheck e testes de seleção/tutorial/
inicialização. Não alteram Supabase nem o fluxo autoritativo futuro.

## Estado dos avisos em `GameScreen`

Zero avisos `react-hooks/exhaustive-deps`. Nenhum foi silenciado ou resolvido adicionando
objetos inteiros mecanicamente: cada responsabilidade foi derivada, extraída ou protegida
por cache/reset e testes próprios. Isto melhora o legado, mas não o torna uma autoridade
PvP segura.

## Riscos ocultos pelo caminho legado

1. `useGameInitialization` desativa manualmente `exhaustive-deps` apesar de capturar
   `state/loading`; mistura fetch, retry, subscrição, polling e inicialização cliente.
2. `assignInstanceIds` cria UUIDs no cliente quando faltam IDs, podendo divergir entre
   participantes.
3. O Player 1 ainda pode inicializar/persistir snapshot completo e o browser termina o
   turno por timer; ambos são incompatíveis com o novo modelo.
4. Retry de settlement GEM parte do browser e não deve ser autoridade económica.

Estes pontos não devem ser remendados para “reativar” PvP. A resolução é ligar o futuro
cliente a init interno, POST de comandos, GET de projeção e settlement server-only; até
lá, gates permanecem fechados.

## Critérios cumpridos para esta limpeza

- perfis lentos, falha parcial, troca de par e retorno ao cache testados;
- um único pedido in-flight por jogador mesmo em Strict Mode;
- fake/state transitions visuais isoladas em funções puras;
- zero loops, fetch duplicado ou replay entre partidas nos casos cobertos.

Critérios transversais: nenhuma inicialização, UUID de carta, deadline ou `finish` construída
no browser; projeção autenticada como única fonte de reconexão; zero loops/fetch duplicado
sob Strict Mode. O gate estático também impede regressão do `Math.random()` no render do
`GameScreen`.
