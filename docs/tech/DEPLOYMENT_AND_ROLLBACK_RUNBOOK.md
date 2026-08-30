# Wisdom Duel — runbook de publicação e rollback

**Estado:** plano operacional; nenhuma publicação autorizada ou executada.  
**Princípio:** Training Preview e PvP/GEM são lançamentos separados. A base partilhada é
alterada apenas pelo repositório/processo canónico do Hub e sempre forward-only.

## Gates de entrada

| Gate | Dono | Evidência necessária |
|---|---|---|
| A — frontend público | Wisdom Duel | suíte/build/QA, headers/404/cache/CSP em preview |
| B — servidor autoritativo | Wisdom Duel + Hub | Edge auth, rate limit, CAS/idempotência, replay, carga |
| C — dados partilhados | Hub/DB | branch, dump, preflight, diff, RLS/RPC/Realtime, restore ensaiado |
| D — economia GEM | Hub/economia | settlement autoritativo, locks, reconciliação e limites de stake |

Falhar qualquer gate mantém o respetivo recurso desligado; não se compensa um gate em falta
abrindo outro.

## Fase 1 — publicar apenas o Training Preview

1. Criar deploy imutável de preview do frontend, sem `VITE_ENABLE_PVP`.
2. Verificar manual e automaticamente desktop/móvel, tutorial, acessibilidade e assets.
3. Verificar por HTTP em todas as origens: CSP, HSTS, `nosniff`, referrer policy, cache de
   HTML/assets, 404 real para rota e asset inexistentes, manifest/robots/sitemap.
4. Medir LCP/CLS/INP em laboratório e ativar RUM apenas se endpoint/política de privacidade
   tiverem aprovação explícita.
5. Publicar canário Netlify, validar smoke test e só depois promover o mesmo artefacto.
6. Confirmar `mythical-mvp.netlify.app` e `wisdomduel.mythicalbeings.io`; atualizar o cartão
   do Hub apenas se a copy/URL final corresponderem ao treino realmente publicado.

Rollback do frontend: promover o deploy anterior conhecido, confirmar hashes e voltar a
executar smoke/headers. Não alterar a base para resolver um problema apenas visual.

## Fase 2 — preparar persistência autoritativa

1. Abrir branch Supabase isolada e backup recuperável.
2. Executar o preflight read-only e reconciliar com o repositório canónico do SDK.
3. Criar migração nova pelo CLI no SDK; revisão a quatro olhos.
4. Testar reset, lint, advisors, pgTAP, concorrência, carga, restore e rollback operacional.
5. Aplicar schema aditivo com todos os gates fechados; não revogar legado ainda.
6. Confirmar métricas/locks/grants/policies após aplicação antes de avançar.

## Fase 3 — Edge Function em sombra

1. Deploy da nova função com `verify_jwt=true` e `WISDOM_DUEL_PVP_ENABLED=false`.
2. Allowlist CORS exata, service role apenas no secret store, rate limit fail-closed.
3. Teste de que o endpoint devolve 503 antes de autenticação/dados.
4. Abrir apenas para contas internas e sessões sem valor económico.
5. Validar CAS, retries, reconexão, timeout, replay e ausência de dados privados nos logs.
6. Observar p50/p95/p99, 401/403/409/429/5xx, lock waits e deadlocks.

## Fase 4 — PvP casual canário

1. Ativar catálogo, servidor e frontend para uma allowlist interna/coorte pequena, na mesma
   janela operacional; GEM continua fechado.
2. Usar apenas o novo caminho autoritativo; não dual-write snapshots legados.
3. Aumentar gradualmente a coorte após uma janela sem incidentes e com replays verificados.
4. Fechar criação no caminho legado; confirmar zero tráfego.
5. Revogar as mutações legadas do cliente numa migração própria e monitorizada.

## Fase 5 — competitivo GEM

É um lançamento separado. Exige Gate D, adjudicação/settlement internos e idempotentes,
card locks, expiração, reconciliação financeira, limites operacionais e procedimento humano
para partidas disputadas. Nenhuma seed, resultado ou quantia vem como autoridade do
browser.

## Sinais de rollback imediato

- projeção de outro jogador, seed ou mão privada exposta;
- mais de um comando aceite para a mesma versão;
- resultado/recompensa divergente do replay;
- grants/policy/publicação inesperados;
- aumento material de 5xx, deadlocks, lock waits ou latência de commit;
- função acessível com gate fechado/JWT inválido;
- alteração involuntária noutro jogo do Hub.

## Ordem de contenção

1. Fechar `WISDOM_DUEL_PVP_ENABLED`.
2. Desativar modos Wisdom Duel no catálogo e bloquear novos depósitos/locks GEM.
3. Preservar logs sanitizados, request IDs, eventos e snapshot para investigação.
4. Retirar projeções da publicação Realtime se o incidente envolver exposição.
5. Reverter o frontend para Training Preview.
6. Revogar acesso interno novo se necessário; congelar objetos, não apagar dados.
7. Restaurar serviço apenas por correção forward-only revista e ensaiada.

## Checklist de encerramento da janela

- artefacto e SHA registados;
- gates e catálogo confirmados no estado pretendido;
- smoke tests nas duas origens;
- headers/cache/404 medidos, não inferidos;
- dashboards e alertas sem dados pessoais/sensíveis;
- RLS/grants/publicações comparados com a baseline;
- nenhum outro jogo do Hub degradado;
- decisão go/no-go e responsável de rollback registados.

