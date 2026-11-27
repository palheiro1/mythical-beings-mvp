# Checkpoints de implementação — Wisdom Duel

Este registo acompanha a execução do plano de melhoria de 28 de agosto de 2026.

## Legenda

| Código | Estado | Significado |
|---|---|---|
| 🟢 | Completo | Implementado e validado localmente |
| 🟡 | Em progresso | Parte entregue; falta um critério de aceitação ou validação em produção |
| ⚪ | Pendente | Ainda não iniciado neste ciclo |
| 🔴 | Bloqueado | Depende de acesso, decisão ou material externo |

## Checkpoint C1 — treino público, honestidade e base técnica

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado localmente; alterações ainda não publicadas  
**Limite de segurança:** nenhuma tabela, migração, política RLS, função de base de dados ou dado remoto foi alterado.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| F0-1 | 🟢 | Corrigir promessa no Play Hub | Cartão apresenta `Training Preview`, treino solo e indisponibilidade de PvP/GEM |
| F0-2 / F1-1 | 🟢 | Remover o beco de convidado | Treino abre em dois cliques, sem conta nem wallet |
| F0-3 | 🟢 | Eliminar imagem partida e testar assets | 30/30 imagens referenciadas são verificadas; Lafaic usa placeholder explícito até chegar a arte oficial |
| F0-4 | 🟢 | Atualizar React Router e dependências vulneráveis | Auditoria npm completa: zero vulnerabilidades conhecidas |
| F0-5 | 🟢 | Alinhar runtime, CI e documentação | Node 22.22 fixado; typecheck, testes e build fazem parte do CI |
| F0-6 | 🟢 | Identificar versão/build no jogo | Navegação mostra versão e SHA do build |
| F0-7 | 🟡 | Impedir ativação acidental de PvP/GEM | Rotas e UI ficam desligadas por omissão; falta o bloqueio autoritativo do servidor |
| F1-2 | 🟡 | Otimizar imagens | 30 imagens WebP, lazy loading e fallback entregues; falta fechar `srcset`/dimensões e medir produção |
| F1-3 | 🟢 | Corrigir modal e controlos | Foco preso e devolvido, Escape, fundo inerte, alvos tácteis e sem controlos aninhados |
| F1-4 | 🟡 | Acessibilidade durante a partida | Anúncios `aria-live` e movimento reduzido entregues; falta histórico textual integral |
| F1-5 | 🟡 | Cache e headers Netlify | Regras implementadas e testadas estaticamente; falta verificar headers no deploy |
| F1-6 | 🟡 | 404, assets e descoberta | 404, rotas, robots, sitemap, manifest e metadados entregues; falta verificar respostas no deploy |
| F1-7 | 🟡 | Tutorial curto | Copy e navegação corrigidas; falta o tutorial guiado e catálogo filtrável |
| F1-8 | ⚪ | Error Boundary, tracking e RUM | Próximo ciclo de qualidade operacional |
| P2-1 | 🟢 | Reduzir o pacote inicial | Bloco principal: 792,54 kB → 34,46 kB; maior bloco: 234,07 kB |
| P2-2 | 🟢 | Reduzir peso da galeria | Fontes JPG de 42 MB substituídas por WebP com cerca de 1,8 MB |
| P2-3 | 🟢 | Evitar 200 falso em assets/rotas | Regras explícitas de rotas e 404 estático |
| P2-5 | 🟢 | Respeitar movimento reduzido | Regras globais para `prefers-reduced-motion` |
| P2-6 | 🟢 | Corrigir alvos e interações aninhadas | Validação real em desktop e viewport móvel |
| P2-8 | 🟢 | Remover timer sem consequência | Seleção de treino deixou de expirar artificialmente |
| P2-9 | ⚪ | Reduzir logs de produção | Planeado para o próximo ciclo |
| P2-10 | ⚪ | Observabilidade operacional | Planeado para o próximo ciclo |
| F2-* | ⚪ | Núcleo PvP autoritativo | Não iniciado; PvP continua indisponível |
| F3-* | ⚪ | Reconciliação/hardening Supabase | Não iniciado para proteger a base partilhada |
| F4-* | ⚪ | Lançamento progressivo | Depende dos gates A, B e C |

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 50 ficheiros, 221 testes, 100% aprovados |
| TypeScript e build | Aprovados; nenhum chunk acima de 500 kB |
| Lint | Zero erros; permanecem 117 warnings herdados |
| Dependências | Zero vulnerabilidades conhecidas, incluindo ferramentas de desenvolvimento |
| Browser | Fluxo público, desktop, móvel, modal/foco, imagens e overflow verificados |
| Play Hub | 26 ficheiros, 116 testes aprovados; build de produção aprovado |
| Integridade do diff | `git diff --check` aprovado nos dois repositórios |

### Próximo ciclo

1. Definir e testar o bloqueio autoritativo de PvP sem tocar na base partilhada.
2. Especificar o protocolo de ações e as invariantes do futuro motor autoritativo.
3. Inventariar schema/migrações/RLS de modo estritamente read-only antes de propor qualquer SQL.
4. Introduzir Error Boundary, logs por ambiente e observabilidade com decisão explícita de privacidade.
5. Fechar tutorial, histórico textual, imagens responsivas e validação dos headers em preview.

## Checkpoint C2 — fronteira PvP, protocolo e qualidade operacional

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado localmente; alterações ainda não publicadas  
**Limite de segurança:** zero escritas na base partilhada. O inventário remoto usou apenas a configuração pública e leituras; não foram aplicadas migrações, políticas, funções, segredos ou alterações ao catálogo de modos.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| F0-7 | 🟡 | Bloqueio autoritativo de PvP por omissão | Edge Function e clientes de mutação recusam PvP com o código estável `multiplayer_disabled`; falta publicar a função/segredo e desligar ou proteger os modos no SDK partilhado |
| F1-8 | 🟡 | Error Boundary, RUM e privacidade | Fallback acessível, captura de erros e métricas nativas entregues; telemetria é totalmente opt-in e falta escolher endpoint/política antes da ativação |
| F2-1 | 🟢 | Protocolo de comandos do jogo | Envelope versionado, comandos permitidos, respostas, validação e testes entregues; estado arbitrário, `playerId` e vencedor não entram no pedido do cliente |
| F2-2 | 🟡 | Invariantes do estado autoritativo | Validador e testes cobrem jogadores, cartas, fases, turnos, contadores, mercado, efeitos pendentes e vencedor; falta o endpoint servidor que o execute em cada comando |
| F2-3 | ⚪ | Concorrência e idempotência reais | `expectedVersion`, chave de idempotência e conflitos estão especificados; persistência CAS/transacional ainda não implementada |
| F2-4 | 🟡 | Projeções privadas e de espectador | Regras e limites de informação documentados; transformação/endpoint ainda não implementados |
| F2-5 | ⚪ | RNG determinístico e auditável | O deal atual continua atrás do gate; o futuro motor ainda precisa de seed/commitment e testes de replay |
| F3-1 | 🟡 | Inventário e reconciliação de schema | Inventário local e consulta remota read-only concluídos; existem migrações locais incompletas/duplicadas e falta acesso administrativo para comparar o schema remoto integral |
| F3-2 | 🟡 | Matriz RLS/RPC | Riscos, permissões esperadas e lacunas foram registados; falta inspeção administrativa das políticas e grants realmente publicados |
| P2-9 | 🟢 | Remover logs de produção | `console` e `debugger` próprios são eliminados no build; verificação automática e passo de CI entregues |
| P2-10 | 🟡 | Observabilidade operacional | Erros, TTFB, FCP, LCP, CLS e INP têm infraestrutura sanitizada, amostragem e identificação de build; permanece desligada até decisão explícita de privacidade/endpoint |
| A11Y-1 | 🟢 | Um único landmark principal | Todas as rotas usam exatamente um `main#main-content`; regressão coberta por teste e validada no browser |
| CI-EDGE | 🟢 | Validar Edge Function com Deno | Imports modernos e fixados; verificação Deno 2.9.6 adicionada ao projeto e ao CI |

### Descobertas de segurança que condicionam o lançamento

1. Os modos remotos `casual` e `competitive_gem` aparecem ativos no catálogo público da base partilhada.
2. O SDK partilhado não contém um gate de lançamento independente para as funções competitivas.
3. As migrações locais do jogo não são uma representação segura e completa do estado remoto: há ficheiro vazio, sobreposição entre migrações e funcionalidades presentes no SDK mas ausentes neste repositório.
4. Por estes motivos, o gate está pronto no código mas não é marcado como completo em produção. Nenhum SQL foi proposto ou executado às cegas.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 57 ficheiros, 254 testes, 100% aprovados |
| Testes Play Hub | 29 ficheiros, 126 testes, 100% aprovados na execução serial de confirmação |
| TypeScript, Edge e build | Typecheck aprovado; Edge Function aprovada em Deno 2.9.6; build aprovado sem chunk acima de 500 kB |
| Logs de produção | 20 chunks próprios verificados; nenhum `console`, `debugger` ou diagnóstico sensível |
| Lint | Zero erros; permanecem as mesmas 117 advertências herdadas |
| Dependências | Auditoria npm completa: zero vulnerabilidades conhecidas |
| Browser | Home e seleção de bot verificadas no build real; um `main`, sem overflow horizontal e sem pedidos externos de telemetria |
| Base partilhada | Zero escritas, zero migrações, zero alterações de RLS/RPC e zero alterações de segredos |
| Integridade do diff | `git diff --check` aprovado nos dois repositórios |

### Próximo ciclo

1. Construir um executor autoritativo em memória para o protocolo, com CAS, idempotência, invariantes e projeções privadas, sem ligação à base partilhada.
2. Criar fixtures/replays determinísticos que demonstrem rejeição de comandos falsificados, repetidos, fora de turno e concorrentes.
3. Fechar tutorial guiado, histórico textual acessível e imagens responsivas.
4. Preparar, sem aplicar, um pacote de reconciliação Supabase com pré-condições, rollback e matriz RLS/RPC para revisão humana.
5. Validar headers, 404, cache e CSP no deploy de preview antes de qualquer ativação de PvP.

## Checkpoint C3 — executor autoritativo local e replay determinístico

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; sem endpoint, persistência ou publicação  
**Limite de segurança:** zero acessos de escrita à base partilhada e zero alterações no SDK/Hub. Todo o executor usa um store efémero em memória.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C3-1 | 🟢 | Executor autoritativo em memória | Fronteira default-off recebe a identidade fora do payload, valida protocolo/participante/regras e só comita após as invariantes pós-reducer |
| C3-2 | 🟢 | Idempotência local | Retry idêntico devolve `duplicate`; colisão do mesmo `commandId` com outro payload ou ator é recusada |
| C3-3 | 🟢 | CAS e evento local | Dois comandos em `expectedVersion` igual produzem um aceite e um `version_conflict`; versão, sequência, evento e snapshot avançam juntos |
| C3-4 | 🟢 | Projeções privadas | Jogador vê a própria mão e apenas a contagem rival; seed e ordem do deck são omitidas; escolhas ocultas usam chaves opacas |
| C3-5 | 🟢 | Espectador default-off | A projeção opcional está recusada por omissão e nunca contém mãos nem efeitos pendentes |
| C3-6 | 🟢 | RNG determinístico | Stream `chacha20-v1`, seed de 256 bits, Fisher–Yates sem bias e sem `Math.random()`/`crypto.randomUUID()` no motor |
| C3-7 | 🟢 | Commitment e reveal local | Commitment SHA-256 com domínio; seed só é revelada após `gameOver` e o commitment é novamente verificado |
| C3-8 | 🟢 | Replay verificável | Eventos aceites reconstroem exatamente o snapshot privado; sequência, versão, ID ou tipo adulterados abortam o replay |
| C3-9 | 🟢 | Invariantes de escolhas | Referências pendentes precisam de existir no snapshot, ter tipo/ator corretos e ser únicas |
| F2-2 | 🟡 | Motor autoritativo completo | A execução local está provada; falta colocá-la numa Edge Function isolada e autenticada |
| F2-3 | 🟡 | Concorrência/idempotência duráveis | Semântica local concluída; falta CAS transacional e chave única em Postgres |
| F2-4 | 🟡 | Projeções persistidas/autorizadas | Transformação local concluída; falta persistência separada, RLS e Realtime apenas sobre projeções |
| F2-5 | 🟡 | RNG auditável em produção | Algoritmo/replay local concluídos; falta persistir commitment/eventos e revelar a seed pelo servidor final |
| F2-6 | 🟡 | Deadlines do servidor | Relógio injetado e recusa sem commit implementados; falta adjudicação transacional de timeout |

### Casos adversariais comprovados

1. Payload com identidade fabricada é `invalid_command`.
2. Utilizador autenticado fora da partida recebe `not_participant`.
3. Jogador B no turno de A recebe `rule_violation` sem mudança de versão.
4. Uma instância copiada da mão rival não concede posse nem revela a carta.
5. Retry idêntico não repete a rotação nem cria um segundo evento.
6. Dois comandos concorrentes na versão zero deixam apenas um evento/versão.
7. A escolha `choice-1` resolve a referência privada mantida no servidor sem a expor na projeção.
8. Deadline expirado não altera snapshot nem eventos.
9. Seed e `privateRandom` não aparecem em projeções; o espectador não recebe `pendingEffect`.
10. Replay com metadados adulterados é recusado.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 61 ficheiros, 275 testes, 100% aprovados |
| Testes focados autoritativos | 32 testes de protocolo, invariantes, executor, projeções e RNG aprovados antes da suíte integral |
| TypeScript e build | Aprovados; bloco do estado 41,73 kB e maior bloco 234,07 kB, ambos abaixo de 500 kB |
| Edge Function | Verificação Deno 2.9.6 aprovada |
| RNG | Vetor zero-key do RFC 8439 aprovado; política estática impede fontes aleatórias não determinísticas no motor |
| Logs de produção | 20 chunks próprios verificados, sem `console`, `debugger` ou diagnósticos sensíveis |
| Lint | Zero erros em 144 ficheiros; permanecem as mesmas 117 advertências herdadas em 37 ficheiros |
| Dependências | Auditoria npm completa: zero vulnerabilidades conhecidas |
| Base/Hub/SDK | Não tocados neste ciclo; zero escritas remotas |
| Integridade do diff | `git diff --check` aprovado |

### Próximo ciclo

1. Fechar o tutorial guiado e um histórico textual completo para a partida de treino.
2. Adicionar dimensões/srcset às cartas e validar as imagens em viewports móveis reais.
3. Verificar headers, CSP, cache e 404 nos dois deploys públicos sem os modificar.
4. Preparar um pacote Supabase apenas documental/aplicável em branch, com preflight, migração canónica, rollback e matriz RLS/RPC.
5. Definir a autenticação e o contrato HTTP da futura Edge Function sem a publicar nem ligar à base comum.

## Checkpoint C4 — aprendizagem, histórico acessível e carga visual

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; produção continua no bundle anterior  
**Limite de segurança:** zero escritas na base partilhada, zero alterações no Hub/SDK e zero deploys. As alterações do Hub já presentes na cópia local pertencem a outro trabalho e foram preservadas.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| F1-7A | 🟢 | Tutorial guiado no treino | Cinco etapas não modais apontam Mercado, mão, criaturas e barra de ações; timer não corre durante o guia; Escape, salto, retrocesso, conclusão e reabertura estão disponíveis |
| F1-7B | 🟢 | Guia rápido e catálogo pesquisável | Página “How to Play” ganhou percurso de 60 segundos, CTA direto para treino e filtros por texto, tipo e quatro elementos |
| F1-4 | 🟢 | Histórico integral e acessível | Nenhum evento é filtrado; lista numerada, nomes legíveis, anúncio apenas do evento mais recente e botão “Jump to latest event” preservam consulta e leitura assistiva |
| F1-2A | 🟢 | Imagens responsivas | 30 variantes WebP de 360 px, fontes de 720 px, `srcset`, `sizes`, dimensões intrínsecas e lazy loading verificados no browser |
| F1-2B | 🟢 | Limpeza do payload público | Recursos redundantes e não referenciados removidos; `public/` passou de 73.445.596 para 8.126.961 bytes (−88,9%) |
| F1-2C | 🟢 | Logótipos leves | Header e fundo principal migrados de PNG para WebP; referências, 404 e documentação atualizadas |
| F1-2D | 🟢 | Orçamento e integridade de assets | Testes falham se uma referência local estiver partida, faltar uma variante responsiva ou o payload público exceder 12 MiB |
| F1-5 | 🟡 | Headers e cache em produção | Regras locais continuam prontas; os dois domínios públicos ainda não as servem porque usam o deploy anterior |
| F1-6 | 🟡 | 404 real em produção | Regras locais estão aprovadas; caminhos inexistentes e WebP inexistente ainda devolvem o HTML da SPA com HTTP 200 nos deploys atuais |
| PERF-RUM | 🟡 | Core Web Vitals de laboratório | QA de payload, seleção de imagens, overflow e build concluído; a ferramenta de trace Chrome DevTools não está disponível nesta sessão, portanto não foram inventados LCP/INP/CLS |
| DEPLOY-C4 | ⚪ | Publicar e validar os dois domínios | Não autorizado/executado neste ciclo; precisa de um deploy controlado antes da validação final de headers, cache e 404 |

### QA real no browser

1. Em viewport de 390 × 844 não existe overflow horizontal na página de aprendizagem nem na partida.
2. O browser escolheu efetivamente `*-360.webp` para cartas apresentadas a ~179 px, mantendo 720 px para contextos maiores.
3. A pesquisa por “Lupus” devolveu exatamente um resultado e escondeu corretamente a secção de criaturas.
4. A seleção de três criaturas abriu o treino e o tutorial automaticamente em `1/5`.
5. Cada avanço destacou e centrou a zona correta; o diálogo permaneceu legível sobre o alvo.
6. Depois da conclusão, realces e diálogo desapareceram e a preferência persistiu no recarregamento.
7. O histórico final mostrou `Game initialized. You start.` em vez do ID efémero da partida e manteve o evento de dano zero.
8. O override móvel foi reposto e o separador de teste fechado no fim do QA.

### Estado observado nos deploys públicos antes de publicar

| Superfície | Observação |
|---|---|
| `mythical-mvp.netlify.app` | Serve o fluxo antigo com exigência de identidade/wallet; não contém o guia, os WebP novos nem os headers locais |
| `wisdomduel.mythicalbeings.io` | Serve o mesmo bundle anterior; caminho inexistente devolve a SPA com HTTP 200 |
| `/images/beings/adaro.webp` no Netlify | Devolve HTML com HTTP 200 no deploy antigo, confirmando fallback incorreto para assets ausentes |
| `my.mythicalbeings.io/home` | Hub respondeu sem alteração; nenhuma sessão, ficheiro ou catálogo foi modificado por este ciclo |

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 65 ficheiros, 286 testes, 100% aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB e payload `dist/` completo de 9.231.850 bytes |
| Edge Function | Verificação Deno 2.9.6 aprovada |
| Logs de produção | 20 chunks próprios aprovados, sem diagnósticos de produção |
| Lint | Zero erros; advertências herdadas não bloqueantes permanecem fora do âmbito deste ciclo |
| Dependências de produção | Auditoria npm: zero vulnerabilidades conhecidas |
| Assets | 30/30 variantes responsivas presentes; nenhuma referência local quebrada; orçamento público abaixo de 12 MiB |
| Browser | Desktop e 390 px aprovados; filtros, tutorial, persistência, histórico e escolha real de `srcset` verificados |
| Base/Hub/SDK | Não tocados; zero SQL, migrações, políticas, dados, segredos ou ficheiros do Hub alterados |
| Integridade do diff | `git diff --check` aprovado |

## Checkpoint C5 — fronteira HTTP e plano seguro de persistência partilhada

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; sem endpoint, migração ou deploy  
**Limite de segurança:** zero SQL remoto, zero DDL/DML, zero ficheiros novos ou alterados
em `supabase/migrations`, zero secrets e zero alterações no Hub/SDK. O pacote SQL criado é
apenas um preflight `READ ONLY`, protegido por teste contra verbos de escrita.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C5-1 | 🟢 | Fronteira HTTP autoritativa | Handler neutro de plataforma liga JWT revalidado ao executor local; identidade nunca vem do payload e ainda não existe endpoint publicável |
| C5-2 | 🟢 | Release gate antes da fronteira privilegiada | 503 default-off ocorre antes de autenticação, corpo e futuro acesso a dados; ordem coberta por testes |
| C5-3 | 🟢 | CORS e headers defensivos | Allowlist exata, wildcard proibido, preflight limitado, `no-store`, `nosniff`, referrer fechado, `Vary` correto e request ID opaco |
| C5-4 | 🟢 | Limite real do pedido | `application/json`, máximo 16 KiB lido em stream, corte antes de autenticação e rejeição de UTF-8 inválido |
| C5-5 | 🟢 | Rate limit obrigatório | O executor só é chamado após decisão positiva injetada; falhas e recusa têm resposta sanitizada/429 |
| C5-6 | 🟢 | Contrato HTTP testado | 10 casos cobrem auth, CORS, gate, tamanho, encoding, identidade, privacidade, idempotência, CAS e rate limit |
| C5-7 | 🟢 | Verificação JWT da função existente | `deal-cards` passou localmente de `verify_jwt=false` para `true`; continua protegida também pelo gate e não foi publicada |
| F3-1A | 🟢 | Preflight Supabase estritamente read-only | Script abre `BEGIN TRANSACTION READ ONLY`, inventaria objetos/columns/constraints/RLS/grants/RPC/publicações e termina em `ROLLBACK` |
| F3-1B | 🟡 | Reconciliação remota | Desenho e pré-condições estão completos; falta branch/admin/dump para comparar o projeto partilhado real |
| F3-2A | 🟢 | Arquitetura de persistência proposta | Schema privado para snapshot/comandos/eventos, projeções públicas mínimas e commit curto com lock/CAS/idempotência |
| F3-2B | 🟡 | Matriz RLS/RPC | Matriz por `anon`, outsider, jogadores, espectador e service role definida; falta executá-la com pgTAP numa branch isolada |
| F3-3 | 🟢 | Rollback forward-only | Ordem de contenção fecha gates/GEM primeiro, preserva dados e corrige por nova migração, sem `DROP` durante incidente |
| F4-1 | 🟢 | Runbook de publicação progressiva | Training Preview, persistência, sombra, PvP casual e GEM são cinco fases independentes com gates e sinais de rollback |
| DEPLOY-C5 | ⚪ | Branch, migração, endpoint e publicação | Deliberadamente não iniciados sem acesso administrativo, revisão do Hub e autorização operacional |

### Decisões que protegem os outros jogos do Hub

1. O schema privado proposto chama-se `wisdom_duel_private`; os objetos expostos usam o
   prefixo `wisdom_duel_` e não alteram tabelas de outros jogos.
2. A primeira migração seria apenas aditiva. RPCs/tabelas legadas não são apagadas nem
   reescritas no mesmo lançamento.
3. A Data API recebe grants explícitos e mínimos; clientes só leem a própria projeção por
   `player_id = (select auth.uid())` e nunca escrevem.
4. O schema `realtime` não é modificado. Uma projeção só entra na publicação depois da
   matriz RLS e permanece fora por omissão.
5. O commit `SECURITY DEFINER` fica num schema não exposto, com `search_path=''` e EXECUTE
   apenas interno; participantes e sessão `card_game` são reverificados dentro da transação.
6. O repositório canónico provisório para qualquer futura migração é o SDK do Hub, não
   esta cópia do jogo.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 67 ficheiros, 299 testes, 100% aprovados |
| Testes focados C5 | 24 testes de HTTP, gate, fronteira RNG e segurança do preflight aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.850 bytes |
| Edge Function | Verificação Deno 2.9.6 aprovada; `verify_jwt=true` confirmado por teste |
| Logs de produção | 20 chunks próprios aprovados, sem diagnósticos de produção |
| Lint | Zero erros; 117 advertências herdadas, nenhuma introduzida pelo C5 |
| Dependências de produção | Auditoria npm: zero vulnerabilidades conhecidas |
| Preflight | Teste lexical impede DDL/DML e confirma transação read-only + rollback |
| Base partilhada | Zero consultas remotas neste ciclo e zero escrita em qualquer ciclo da implementação |
| Hub/SDK | Estado read-only preservado; nenhum ficheiro alterado por este trabalho |
| Integridade do diff | `git diff --check` aprovado |

### Próximo ciclo

1. Extrair uma porta de persistência autoritativa e comprovar a mesma semântica contra
   um adapter transacional simulado, sem Supabase e sem endpoint.
2. Adicionar testes de falhas injetadas, retries após timeout e concorrência multi-instância.
3. Modelar a inicialização autoritativa da partida e a leitura/reconexão de projeções.
4. Definir rate limiting e observabilidade do endpoint sem recolher tokens, cartas ou
   dados pessoais.
5. Manter branch/migração/deploy bloqueados até existirem acesso administrativo e revisão.

## Checkpoint C6 — semântica durável e concorrência multi-instância

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; adapter apenas de referência  
**Limite de segurança:** store transacional integralmente em memória, sem driver Supabase,
rede, endpoint, SQL, migração, secret, Hub ou SDK.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C6-1 | 🟢 | Porta de persistência autoritativa | Contrato separa load de snapshot/comando, leitura de projeção e commit CAS atómico |
| C6-2 | 🟢 | Fingerprint canónico | SHA-256 de envelope ordenado; ordem JSON não altera a chave lógica e payload diferente colide |
| C6-3 | 🟢 | Adapter transacional partilhado | Duas instâncias do serviço usam o mesmo store com lock curto por partida e estado clonado |
| C6-4 | 🟢 | Cálculo fora do lock | Serviço faz load → reducer/invariantes/projeções → commit; a secção crítica apenas revalida e troca o registo |
| C6-5 | 🟢 | CAS multi-instância | Duas jogadas na versão 0 produzem exatamente um `accepted` e um `version_conflict`, com um evento |
| C6-6 | 🟢 | Idempotência multi-instância | O mesmo `commandId` concorrente produz `accepted` + `duplicate`; colisão de payload é recusada |
| C6-7 | 🟢 | Falhas atómicas | Falha antes do commit deixa versão/eventos a zero; falha após commit recupera como `duplicate` no retry |
| C6-8 | 🟢 | Reconexão por projeção | Nova instância lê versão materializada atual; seed e ID da carta rival não aparecem |
| C6-9 | 🟢 | Transporte assíncrono | Fronteira HTTP aguarda o futuro serviço durável sem alterar o contrato de resposta |
| F2-3 | 🟡 | Persistência durável real | Semântica e conformance local provadas; falta adapter Postgres numa branch isolada |
| F2-4 | 🟡 | Projeções persistidas reais | Porta e leitura de reconexão provadas; falta tabela/RLS/Realtime aprovados |
| DEPLOY-C6 | ⚪ | Endpoint/DB/deploy | Continua deliberadamente não iniciado |

### Casos adversariais comprovados

1. Dois workers calculam sobre o mesmo snapshot; só o primeiro consegue CAS.
2. Dois workers recebem o mesmo retry; só existe um evento e uma versão nova.
3. Uma falha antes da troca atómica não deixa snapshot, comando ou evento parcial.
4. Uma falha/timeout depois da troca não volta a executar a jogada no retry.
5. O mesmo ID com ator/payload diferente não recupera a resposta anterior.
6. Reconexão por outro worker devolve a projeção privada atual, não o snapshot.
7. Actor ausente, match ID inválido e outsider falham fechados na leitura.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 69 ficheiros, 310 testes, 100% aprovados |
| Testes focados C6 | 32 testes de executor local/durável, fingerprint e HTTP aprovados |
| TypeScript e build | Aprovados; chunks do browser inalterados, maior 234,07 kB; `dist/` 9.231.850 bytes |
| Lint | Zero erros; 117 advertências herdadas, nenhuma nos ficheiros C6 |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; pasta `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Criar protocolo de inicialização autoritativa a partir de uma sessão/seleções validadas.
2. Garantir seed criptográfica, commitment e init idempotente entre workers.
3. Modelar deadlines renovados no commit e timeout adjudicado pelo servidor.
4. Definir eventos operacionais sanitizados para comando/reconexão sem payload privado.
5. Continuar sem endpoint/DB até a branch administrativa existir.

## Checkpoint C7 — inicialização, deadlines e eventos operacionais privados

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; lifecycle apenas no adapter em memória  
**Limite de segurança:** nenhum endpoint, job, scheduler, Supabase, SQL, migração, secret,
Hub ou SDK. O modo competitivo GEM é recusado explicitamente.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C7-1 | 🟢 | Fonte de inicialização interna | Browser não fornece identidade, slots, seleção, seed ou deadline; a porta fornece uma revisão de sessão |
| C7-2 | 🟢 | Validação estrita da sessão | Exige `card_game/casual/playing`, UUIDs distintos, slots 1/2 e três criaturas válidas/únicas por jogador |
| C7-3 | 🟢 | Seed e commitment no servidor | 256 bits por `crypto.getRandomValues`, ChaCha20 e commitment SHA-256; seed só no snapshot privado |
| C7-4 | 🟢 | Create-if-absent multi-worker | Workers com seeds diferentes convergem para uma partida/commitment; vencedor cria, outro recebe `existing` |
| C7-5 | 🟢 | Revalidação no create | Revisão, participantes e seleções são comparados novamente dentro da troca atómica simulada |
| C7-6 | 🟢 | Deadline inicial | Relógio/duração do servidor criam deadline na mesma operação que snapshot e projeções |
| C7-7 | 🟢 | Renovação por mudança de turno | Ações dentro do turno conservam deadline; `end_turn` aceite persiste o deadline seguinte atomicamente |
| C7-8 | 🟢 | Comandos tardios fail-closed | O executor recusa jogadas após deadline sem evento ou alteração de versão |
| C7-9 | 🟢 | Evento operacional sanitizado | Schema fixo descarta campos extra e nunca aceita IDs de jogador/partida, JWT, payload, cartas, seed, erro ou stack |
| C7-10 | 🟢 | Telemetria não interfere no jogo | Sink opcional/falhado é isolado e não muda o resultado autoritativo |
| F2-6 | 🟡 | Adjudicação automática de timeout | Bloqueio e renovação estão prontos; consequência (passar/perder poder/perder) requer regra de produto versionada |
| DEPLOY-C7 | ⚪ | Scheduler/endpoint/DB/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. Sessão de outro jogo, modo GEM, estado `waiting`, participante em falta/duplicado e
   seleção repetida/desconhecida não criam partida.
2. Uma revisão alterada entre load e create aborta sem snapshot parcial.
3. Seed inválida falha fechada e não cria registo.
4. Duas seeds concorrentes deixam uma única seed privada verificável pelo commitment.
5. O retorno de init inclui commitment/deadline, mas não a seed.
6. Ação intermédia não estende o relógio; mudança de turno sim.
7. Campos hostis anexados a um evento operacional são eliminados pelo sanitizer.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 71 ficheiros, 320 testes, 100% aprovados |
| Testes focados C7 | 18 testes de init, deadlines, store durável e eventos operacionais aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.850 bytes |
| Lint | Zero erros; 117 advertências herdadas, nenhuma nos ficheiros C7 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Criar rate limiting partilhável por actor e defesa de origem, com referência em memória.
2. Ligar eventos operacionais sanitizados à fronteira HTTP e testar que tokens/payloads
   nunca chegam ao sink.
3. Criar contrato HTTP autenticado de leitura/reconexão da projeção.
4. Definir budgets/timeouts do endpoint e testes de degradação fail-closed.
5. Manter o adjudicador, endpoint real e DB bloqueados pelas decisões/acessos externos.

## Checkpoint C8 — abuso, reconexão HTTP e budgets

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; transportes continuam sem rota/Edge  
**Limite de segurança:** handlers são funções neutras chamadas apenas por testes. Não há
config de função, endpoint, deploy, rede, Supabase, SQL, migração, secret, Hub ou SDK.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C8-1 | 🟢 | Store de quota transacional | Janela deslizante partilhável e lock por chave garantem limite exato sob pedidos concorrentes |
| C8-2 | 🟢 | Burst + sustained | Política suporta 1–4 janelas, valores limitados e `Retry-After` derivado da janela bloqueante |
| C8-3 | 🟢 | Chaves privadas | Actor e rede são SHA-256 com salt/domínio separados; UUID/IP nunca entram em claro no store |
| C8-4 | 🟢 | Rede apenas confiável | Resolver de rede é injetado pela plataforma; implementação não lê headers forwarded falsificáveis |
| C8-5 | 🟢 | Rate limit fail-closed | Indisponibilidade/erro do store recusa execução com retry curto |
| C8-6 | 🟢 | GET de reconexão | Query aceita exatamente um `matchId` UUID, JWT revalidado, quota e leitura da projeção privada |
| C8-7 | 🟢 | Anti-enumeração | Outsider e partida/projeção ausente partilham resposta opaca `match_not_playable` |
| C8-8 | 🟢 | Segurança HTTP partilhada | POST e GET reutilizam normalização de origem, Bearer, CORS, headers e request ID |
| C8-9 | 🟢 | Budget total abortável | Auth, quota e executor/store recebem `AbortSignal`; timeout devolve 504 sem dados parciais |
| C8-10 | 🟢 | Retry após 504 | Mensagem do comando exige conservar `commandId`; semântica C6 recupera eventual commit como `duplicate` |
| C8-11 | 🟢 | Métricas ligadas ao transporte | POST/GET emitem apenas operação/outcome/duração/request ID/versão; nem token, ator, match ou payload |
| F4-OBS | 🟡 | Store/collector de produção | Contratos prontos; faltam infraestrutura partilhada, TTL/capacidade, alertas e aprovação de privacidade |
| DEPLOY-C8 | ⚪ | Rotas/Edge/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. Seis pedidos simultâneos para quota 2 permitem exatamente dois.
2. Actor B não herda quota de A; uma rede confiável comum pode impor defesa agregada.
3. Store de quota que lança erro não deixa o comando chegar ao executor.
4. Query duplicada ou com `actorId` fabricado é recusada antes do store de projeções.
5. Preflight não autentica nem produz telemetria.
6. Auth/store que não respondem ultrapassam o budget, recebem signal abortado e devolvem 504.
7. Sink de sucesso não contém JWT, IDs, carta ou projeção.
8. Request ID de transporte pode ser aleatório; a regra estática continua a proibir
   `Math.random`/`crypto.randomUUID` no estado/RNG do jogo.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 73 ficheiros, 333 testes, 100% aprovados |
| Testes focados C8 | 27 testes de POST/GET, rate limit e eventos operacionais aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.850 bytes |
| Lint | Zero erros; 117 advertências herdadas, nenhuma nos ficheiros C8 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Definir contrato de conformance que qualquer adapter Postgres deve passar.
2. Produzir casos de rollback/restore e matriz de falhas em formato executável local.
3. Auditar warnings React de maior risco (hooks/stale state) sem alterar o fluxo PvP.
4. Medir/limitar capacidade do store de referência para evitar crescimento ilimitado.
5. Continuar a bloquear adapter real, Edge e DB até existir branch administrativa.

### Próximo ciclo

1. Preparar o contrato HTTP autenticado e o adaptador isolado da futura Edge Function autoritativa, ainda sem persistência nem publicação.
2. Escrever o pacote Supabase de reconciliação como proposta revisável: preflight, migração canónica, matriz RLS/RPC e rollback; não aplicar nada.
3. Criar testes contratuais que comprovem autenticação, autorização, projeções privadas, idempotência e conflitos através da fronteira HTTP.
4. Criar uma checklist de deploy/rollback para publicar C1–C4 e validar headers, cache, 404 e CSP nos dois domínios.
5. Medir Core Web Vitals com trace Chrome DevTools quando a capacidade estiver disponível.

## Checkpoint C9 — capacidade, conformance de persistência e risco React

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; adapter e quota continuam apenas em memória  
**Limite de segurança:** nenhum endpoint, deploy, rede, Supabase, SQL, migração, secret,
Hub ou SDK. As correções React limitam-se a dependências comprovadamente seguras.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C9-1 | 🟢 | Limite de cardinalidade da quota | Store de referência tem capacidade configurável, limite validado e recusa fail-closed quando cheio |
| C9-2 | 🟢 | Expiração e recuperação de capacidade | Apenas buckets totalmente expirados em todas as janelas são removidos antes de admitir uma nova chave |
| C9-3 | 🟢 | Suite reutilizável de conformance | Qualquer futuro adapter autoritativo recebe o mesmo contrato executável de isolamento, CAS, idempotência e falhas |
| C9-4 | 🟢 | Ausência e projeção privada | Match desconhecido não cria estado; projeção nunca revela seed nem mão rival |
| C9-5 | 🟢 | Idempotência e colisão | Commit ocorre uma vez, retry é duplicado e reutilização hostil do ID do comando é recusada |
| C9-6 | 🟢 | CAS e isolamento entre partidas | Há um único vencedor por versão na mesma partida; partidas diferentes não se bloqueiam nem contaminam |
| C9-7 | 🟢 | Rollback e recuperação | Falha antes do commit não deixa estado parcial; falha percebida depois do commit é recuperada como duplicado |
| C9-8 | 🟢 | Quatro riscos React corrigidos | Dependências estabilizadas em debug, ações e jogo contra bot sem alterar a semântica PvP |
| C9-9 | 🟢 | Auditoria de hooks documentada | Sete warnings restantes do `GameScreen` foram classificados e mantidos por exigirem substituição arquitetural, não patch mecânico |
| F4-OBS | 🟡 | Store/collector de produção | Contratos e referência limitada prontos; faltam TTL/evicção distribuída, alertas e infraestrutura aprovada |
| F2-UI | 🟡 | Fluxo PvP legado | Continua a inicializar/temporizar/liquidar parcialmente no browser; deve migrar para projeções e comandos autoritativos |
| DEPLOY-C9 | ⚪ | Adapter Postgres/rotas/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. Um store com capacidade dois recusa a terceira chave enquanto as duas anteriores estão
   ativas e volta a admiti-la apenas depois da expiração completa.
2. Leitura de partida inexistente permanece nula e não cria snapshot lateralmente.
3. Uma projeção entregue a um jogador não contém seed nem cartas privadas do adversário.
4. Retry do mesmo comando não volta a executar; o mesmo ID com outro payload/ator colide.
5. Dois commits concorrentes sobre a mesma versão deixam um único vencedor.
6. Operações concorrentes em partidas diferentes mantêm isolamento.
7. Falha antes da troca atómica deixa tudo intacto; resposta perdida depois do commit é
   recuperada sem repetir efeitos.
8. Os warnings React restantes foram rastreados ao fluxo PvP legado, incluindo inicialização,
   relógio, geração de identidade e liquidação GEM no cliente.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 74 ficheiros, 339 testes, 100% aprovados |
| Testes focados C9 | 11 testes de quota e conformance aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.828 bytes |
| Lint | Zero erros; 113 advertências herdadas (menos quatro), nenhuma nos novos ficheiros C9 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Exercitar HTTP, autenticação, quota, serviço durável, persistência e projeção num teste
   vertical único, ainda totalmente em memória e sem rota.
2. Comprovar reconexão entre instâncias, retry pós-resposta perdida, conflito de versão e
   não exposição de segredos ao longo de toda a pilha.
3. Eliminar o `Math.random` usado como chave de render no `GameScreen` se a alteração puder
   ser isolada sem modificar a lógica PvP.
4. Transformar os sete warnings de hooks do `GameScreen` em critérios explícitos da futura
   migração para o cliente de projeções autoritativas.
5. Manter Postgres, Edge, Hub e deploy bloqueados até existir autorização e branch isolada.

## Checkpoint C10 — ensaio vertical autoritativo e identidade visual estável

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; toda a pilha continua sem rota  
**Limite de segurança:** composição criada apenas dentro dos testes, com stores em memória.
Nenhuma função Edge, URL, configuração Supabase, SQL, migração, rede, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C10-1 | 🟢 | Pilha vertical em memória | Request atravessa CORS, JWT, quota, handler, serviço, store, projeção e Response reais |
| C10-2 | 🟢 | Reconexão entre instâncias | Comando num serviço e GET noutro observam a mesma versão e sequência persistidas |
| C10-3 | 🟢 | Privacidade ponta a ponta | Respostas não contêm seed nem carta da mão rival; telemetria não contém tokens ou IDs privados |
| C10-4 | 🟢 | Retry após resposta perdida | Primeiro handler comita e excede o budget; retry do mesmo envelope noutra instância devolve `duplicate` |
| C10-5 | 🟢 | Conflito HTTP concorrente | Dois comandos sobre a versão zero produzem exatamente um 200 e um 409 com projeção atualizável |
| C10-6 | 🟢 | Quota partilhada no transporte | Dois handlers consomem o mesmo bucket de actor hashed; o terceiro pedido recebe 429/Retry-After |
| C10-7 | 🟢 | Floater sem aleatoriedade em render | ID sequencial nasce apenas com o evento e callback estável evita reinícios por render não relacionado |
| C10-8 | 🟢 | Gate anti-regressão | Teste estático proíbe `Math.random()` no `GameScreen` e exige passagem direta do evento estável |
| C10-9 | 🟢 | Critérios React verificáveis | Cada warning legado ficou associado a uma condição concreta da migração autoritativa |
| F2-UI | 🟡 | Cliente autoritativo React | A fronteira servidor foi provada; falta controlador de comandos/projeções e substituição do PvP legado |
| DEPLOY-C10 | ⚪ | Adapter Postgres/rotas/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. Um POST autenticado comita uma vez e um GET posterior noutra instância devolve a versão 1.
2. Seed privada e instance ID da mão rival não atravessam nenhuma das duas respostas.
3. Token, IDs dos jogadores/partida e seed não entram nos eventos operacionais.
4. Se a resposta fica pendurada depois do commit, o budget devolve 504; repetir o mesmo
   `commandId` recupera o resultado como duplicado sem segundo evento de jogo.
5. Duas instâncias que disputam a mesma versão deixam um evento/commit e fornecem ao perdedor
   a projeção da versão vencedora.
6. A quota mantém apenas SHA-256 do actor, é partilhada entre handlers e produz Retry-After 60.
7. Renders auxiliares já não inventam uma nova key do floater nem reiniciam o seu timer.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 75 ficheiros, 344 testes, 100% aprovados |
| Testes focados C10 | 7 testes verticais e de boundary aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.887 bytes |
| Lint | Zero erros; 113 advertências herdadas, nenhuma introduzida pelo C10 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Criar um controlador de cliente autoritativo independente de React, com transporte e
   gerador de command IDs injetados.
2. Modelar estados de reconexão, envio, timeout, retry do mesmo comando, conflito e erro opaco.
3. Ignorar respostas fora de ordem e nunca fazer optimistic update do snapshot privado.
4. Expor apenas a última projeção autenticada e metadados seguros para uma futura hook React.
5. Manter o controlador desligado do `GameScreen` até existirem rota e adapter aprovados.

## Checkpoint C11 — controlador do cliente autoritativo

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; controlador ainda não importado pela UI  
**Limite de segurança:** transporte, UUID e respostas são injetados em testes. Não há fetch,
token real, React, storage, endpoint, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C11-1 | 🟢 | Máquina de estados explícita | `idle/reconnecting/ready/sending/retryable/conflict/rejected/disconnected/unavailable` |
| C11-2 | 🟢 | Reconexão antes de comandos | Não cria intenção sem projeção autenticada; `expectedVersion` deriva sempre dessa projeção |
| C11-3 | 🟢 | Zero update otimista | Durante `sending` a UI continua a observar a versão confirmada, nunca um snapshot inventado |
| C11-4 | 🟢 | Retry idempotente | Falha de rede/resultado desconhecido conserva envelope, ID, payload e versão; só incrementa tentativas |
| C11-5 | 🟢 | Conflito sem replay | Adota projeção/versão do 409, limpa pending e exige nova decisão do jogador |
| C11-6 | 🟢 | Ordem monotónica | Uma reconexão antiga não reduz `stateVersion` nem `eventSequence` já observadas |
| C11-7 | 🟢 | Intenções serializadas | Segundo comando e reconexão são recusados enquanto o resultado do pending é desconhecido |
| C11-8 | 🟢 | Resposta fail-closed | Match errado, IDs/versões/sequências inconsistentes mantêm o comando retryable ou desconectam |
| C11-9 | 🟢 | Estado público mínimo | Pending público contém só ID, tipo, versão e tentativas; snapshots e listeners são clonados/isolados |
| C11-10 | 🟢 | Contrato de integração | Documento define adapter HTTP futuro, hook React e gates antes de substituir o legado |
| F2-UI | 🟡 | Ligação React | Controlador pronto mas não ligado; falta adapter HTTP autenticado e hook opt-in |
| DEPLOY-C11 | ⚪ | Adapter Postgres/rotas/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. Enquanto uma resposta está pendente, a projeção permanece na versão anterior confirmada.
2. Uma ligação perdida depois de estado desconhecido conserva o mesmo envelope; o retry
   `duplicate` usa um único UUID e sobe para a versão confirmada.
3. Um conflito atualiza a projeção mas não volta a chamar o transporte.
4. Uma resposta tardia de reconexão v1 não substitui v2 já observada.
5. Uma resposta `accepted` com outro command ID permanece retryable e não altera projeção.
6. Uma projeção de outra partida é recusada antes de ficar disponível à UI.
7. Segundo comando/reconnect durante pending não chega ao transporte.
8. Rejeição definitiva limpa pending sem modificar a projeção.
9. Listener que muta o snapshot e lança erro não contamina o estado nem outros resultados.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 76 ficheiros, 353 testes, 100% aprovados |
| Testes focados C11 | 9 testes do controlador aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.887 bytes (controlador ainda não bundled) |
| Lint | Zero erros; 113 advertências herdadas, zero nos ficheiros C11 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Implementar um adapter HTTP browser neutro para o controlador, ainda com `fetch` e
   provider de token injetados e sem URL de produção configurada.
2. Obter token fresco em cada operação, nunca o guardar, logar ou incluir no estado.
3. Validar HTTPS, content type, tamanho máximo e shape das respostas antes do controlador.
4. Preservar `commandId` exatamente no POST e construir a query GET sem campos extra.
5. Testar abort, rede, resposta não JSON/grande e rejeições 401/429/504 localmente.

## Checkpoint C12 — transporte HTTP e validação wire do cliente

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; adapter não importado pelo bundle  
**Limite de segurança:** URLs e Responses são fixtures; `fetch` e token provider são
injetados. Não houve rede, token real, configuração runtime, endpoint, Supabase, SQL,
migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C12-1 | 🟢 | Endpoints estritos | Apenas HTTPS, sem credentials/query/hash, e command/projection obrigatoriamente same-origin |
| C12-2 | 🟢 | Token just-in-time | Provider é chamado em cada operação; token ausente/malformado não chega ao fetch nem ao estado |
| C12-3 | 🟢 | Fetch anti-leak | `credentials: omit`, `cache: no-store`, `referrerPolicy: no-referrer` e `redirect: error` |
| C12-4 | 🟢 | POST idempotente | Envelope validado é serializado exatamente e conserva `commandId`/`expectedVersion` |
| C12-5 | 🟢 | GET mínimo | URL recebe um único `matchId`; signal é propagado a auth e fetch |
| C12-6 | 🟢 | Corpo limitado | Content-Type JSON, UTF-8 fatal e máximo 256 KiB verificado por header e stream |
| C12-7 | 🟢 | Normalização segura | Request ID do servidor é descartado; 401/429/504 viram códigos de domínio e Retry-After limitado |
| C12-8 | 🟢 | Guarda completa de projeção | V1 valida campos/cartas/mãos/players/versões/deadline/commitment e recusa unknown fields |
| C12-9 | 🟢 | Anti-segredos | `privateRandom`, `knowledgeDeck` e cards anexados a mão `hidden` falham antes da UI |
| C12-10 | 🟢 | Resultado desconhecido retryable | JSON/content/status/shape inválido conserva o pending no controlador para retry com mesmo ID |
| C12-11 | 🟢 | Contrato de integração | Documento fixa limites e proíbe service-role, fallback anónimo, redirects e armazenamento de response |
| F2-UI | 🟡 | Bootstrap/hook opt-in | Cliente+adapter prontos mas sem configuração de produção e fora do bundle atual |
| DEPLOY-C12 | ⚪ | Adapter Postgres/rotas/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. HTTP, query embutida e origens diferentes são recusados na construção.
2. Dois pedidos obtêm dois tokens frescos; nenhum token fica serializado no adapter.
3. Sessão ausente ou token com whitespace devolve unauthorized sem chamar fetch.
4. POST usa body exato; GET contém apenas `matchId`; ambos recebem o mesmo AbortSignal.
5. 429 preserva Retry-After 7; 401/504 não expõem request IDs operacionais.
6. HTML, JSON truncado e Content-Length superior ao budget viram `invalid_response`.
7. Projeção envenenada com seed privada é recusada e o segredo não aparece no resultado.
8. Erro de rede e AbortError propagam-se para classificação retryable pelo controlador.
9. Mão rival `hidden` com campo `cards`, versão negativa, outsider current e commitment
   inválido são recusados pela guarda wire.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 78 ficheiros, 364 testes, 100% aprovados |
| Testes focados C12 | 11 testes de transporte/guarda; 20 com o controlador, todos aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.887 bytes (C11/C12 fora do bundle) |
| Lint | Zero erros; 113 advertências herdadas, zero nos ficheiros C12 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Ligar controller + adapter a handlers HTTP reais dentro de um fetch falso in-process,
   provando o wire completo do browser ao store sem rede.
2. Testar reconexão, comando, resposta perdida/504, retry duplicate e conflito através de
   serialização JSON real e guardas C12.
3. Comprovar que JWT só existe nos headers e que seed/carta rival não chegam ao controller.
4. Medir que request/response limits e aborts não deixam estado parcial.
5. Manter o bootstrap React e qualquer URL real bloqueados.

## Checkpoint C13 — wire completo browser-to-store sem rede

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; fetch encaminhado dentro do processo  
**Limite de segurança:** todos os Requests terminam nos handlers em memória do teste.
Nenhuma rede, URL runtime, token real, React, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C13-1 | 🟢 | Fetch in-process | Converte init browser em Request real, acrescenta Origin e encaminha por path aos handlers C8 |
| C13-2 | 🟢 | Stack completa | Controller → adapter → JSON/headers → auth/quota → serviço/store → projeção → guarda/controller |
| C13-3 | 🟢 | JWT só no header | Token é reobtido por GET/POST; não aparece no body, projection, estado ou evento operacional |
| C13-4 | 🟢 | Privacidade browser-to-store | Seed e carta rival permanecem ausentes no controller após reconnect e comando |
| C13-5 | 🟢 | 504 pós-commit | Budget do handler expira depois do commit; retry serializa body idêntico e recebe duplicate |
| C13-6 | 🟢 | Corrida de browsers | Dois clientes em v0 terminam ready/conflict, ambos em v1, com um único evento persistido |
| C13-7 | 🟢 | Abort pré-handler | Signal já abortado impede o Request de chegar ao handler e deixa snapshot/eventos em v0 |
| C13-8 | 🟢 | Response budget pós-commit | Resposta >64 KiB é `invalid_response`; retry recupera o commit como duplicate |
| C13-9 | 🟢 | Evidência documentada | Documento do transporte referencia explicitamente o teste vertical e os cenários de falha |
| F2-UI | 🟡 | Hook React opt-in | Wire completo provado; falta apenas uma integração de estado desligada por omissão |
| DEPLOY-C13 | ⚪ | Adapter Postgres/rotas/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. GET inicial v0 e POST aceite v1 percorrem serialização/parsing e dois tokens frescos.
2. Body do comando não contém JWT, actor ID, seed ou snapshot; telemetria também não.
3. O 504 acontece depois de estado v1; o retry usa byte-for-byte o mesmo JSON e não cria
   segundo evento.
4. Dois browsers com expectedVersion 0 produzem um único vencedor e ambos recebem v1.
5. Abort antes do fake fetch preserva v0; retry posterior do mesmo pending chega a v1.
6. Uma resposta artificial de 70 KiB é recusada após o commit; retry encontra o comando
   persistido e termina `duplicate` com um único evento.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 79 ficheiros, 368 testes, 100% aprovados |
| Testes focados C13 | 4 testes verticais browser-to-store aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.887 bytes (cliente ainda fora do bundle) |
| Lint | Zero erros; 113 advertências herdadas, zero no teste C13 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Criar hook React que recebe um controller já construído e permanece disabled por omissão.
2. Subscrever/dessubscrever com cleanup, abortar reconnect no unmount e expor ações estáveis.
3. Testar enable tardio, Strict Mode, troca de controller, unmount e callbacks de retry.
4. Não criar URLs, tokens, controller singleton nem ligar ao `GameScreen` dentro da hook.
5. Continuar a preservar o bundle de produção até existir gate e backend aprovados.

## Checkpoint C14 — hook React autoritativa default-off

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado localmente; hook sem consumidores no runtime  
**Limite de segurança:** controller é injetado e `enabled` omisso significa false. A hook
não cria URL, token, transporte, singleton ou side effect externo. Sem rede, Supabase,
SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C14-1 | 🟢 | Opt-in explícito | `enabled === true` é obrigatório; por omissão state é null e transporte não é chamado |
| C14-2 | 🟢 | Controller injetado | Hook não conhece construção, URL, auth, Supabase, fetch ou release config |
| C14-3 | 🟢 | Subscribe-before-reconnect | Observador liga antes do GET, capturando estados transitórios e projeção confirmada |
| C14-4 | 🟢 | Cleanup abortável | Unmount/troca aborta reconnect com AbortError e remove subscriber |
| C14-5 | 🟢 | Anti-contaminação | Snapshot de controller antigo fica imediatamente oculto e emissões posteriores são ignoradas |
| C14-6 | 🟢 | Ações estáveis | `reconnect/send/retry` conservam identidade enquanto client/enabled não mudam |
| C14-7 | 🟢 | Ações bloqueadas | Disabled recusa chamada antes do controller/transporte |
| C14-8 | 🟢 | Strict Mode | Duplo lifecycle não gera loop, comando duplicado nem callback instável |
| C14-9 | 🟢 | Retry via React | Resposta perdida passa a retryable e `retry` recupera duplicate com um único command ID |
| F2-UI | 🟡 | Componente PvP de projeção | Infra React pronta mas ainda não renderiza a projeção nem substitui `GameScreen` |
| DEPLOY-C14 | ⚪ | Config/rotas/DB/deploy | Deliberadamente não iniciado |

### Casos adversariais comprovados

1. Render default não chama `readProjection`; tentativa de ação falha localmente.
2. Enable false→true inicia uma única reconexão normal e publica v0.
3. Unmount durante GET pendente aborta signal e dessubscreve.
4. Troca A→B publica v2; reconexão posterior de A para v3 não contamina a hook.
5. Em Strict Mode, falha de resposta deixa pending; retry devolve duplicate e as três
   callbacks mantêm a mesma identidade.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 80 ficheiros, 373 testes, 100% aprovados |
| Testes focados C14 | 5 testes da hook React aprovados |
| TypeScript e build | Aprovados; maior bloco 234,07 kB; `dist/` 9.231.887 bytes (hook sem consumidor) |
| Lint | Zero erros; 113 advertências herdadas, zero na hook/teste C14 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Remover o estado/effect legado de `isMyTurn` e substituí-lo por seletor puro derivado.
2. Reutilizar o mesmo índice de viewer em `GameScreen`, reduzindo stale render e um warning.
3. Testar jogador 1/2, spectator, winner e estado incompleto sem tocar em persistência PvP.
4. Rever se outro warning pode ser eliminado por derivação pura; não alterar fetch/animações
   com patches mecânicos.
5. Manter todo o cliente autoritativo fora da rota de produção.

## Checkpoint C15 — turno/viewer derivados sem state React

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; pequena melhoria no `GameScreen` legado  
**Limite de segurança:** apenas seleção de viewer/turno no browser. Nenhuma alteração a
ações, timer, persistência, settlement, rede, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C15-1 | 🟢 | Seletor de viewer puro | Resolve slot 0/1 ou spectator (-1) a partir de players + identity atuais |
| C15-2 | 🟢 | Seletor de turno puro | Exige participante, currentPlayerIndex correspondente e winner null |
| C15-3 | 🟢 | State/effect removidos | `isMyTurn` já não passa por setState nem fica um render atrás |
| C15-4 | 🟢 | Índice único | O mesmo `playerIndex` alimenta turno, spectator e orientação dos painéis |
| C15-5 | 🟢 | Fail-closed | State/viewer ausente, players incompletos, outsider e winner devolvem false/spectator |
| C15-6 | 🟢 | Auditoria atualizada | Risco sai da lista pendente e entra nas correções comprovadas |
| F2-UI | 🟡 | Seis warnings de hooks restantes | Fetch de perfis e três efeitos visuais ainda exigem derivação/cancelamento cuidadosos |
| DEPLOY-C15 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Player 1 e 2 resolvem os slots corretos; outsider é spectator.
2. Null/undefined e tuple incompleto falham fechados.
3. Mudar currentPlayerIndex troca o turno derivado imediatamente, sem effect intermédio.
4. Depois de winner, nenhum participante continua marcado como ativo.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 81 ficheiros, 377 testes, 100% aprovados |
| Testes focados C15 | 4 testes dos seletores aprovados |
| TypeScript e build | Aprovados; `GameScreen` 19,28 kB/7,12 kB gzip; `dist/` 9.231.570 bytes |
| Lint | Zero erros; 112 advertências herdadas (menos uma); seis warnings em `GameScreen` |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Extrair parser puro da defesa a partir de logs e testá-lo com entradas recentes/hostis.
2. Derivar power/IDs/log antes do effect do floater e usar dependências simples completas.
3. Provar que renders sem mudança de power não geram novo evento e que delta/defesa continuam
   corretos.
4. Remover apenas os quatro warnings associados a esse effect; manter os outros até terem
   desenho e testes próprios.
5. Não tocar em fluxo PvP, timers, Supabase ou cliente autoritativo runtime.

## Checkpoint C16 — delta de power e defesa com dependências completas

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; effect visual do `GameScreen` isolado  
**Limite de segurança:** apenas deteção/apresentação de dano. Nenhuma regra, action, timer,
persistência, rede, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C16-1 | 🟢 | Parser de defesa puro | Procura apenas os dez logs mais recentes, target explícito, Defense numérico e bypass |
| C16-2 | 🟢 | Detector de delta puro | Compara snapshots de power e devolve player/damage/defesa sem tocar em React/DOM |
| C16-3 | 🟢 | Sem falso positivo | Primeira amostra, power igual ou aumento não geram evento |
| C16-4 | 🟢 | Sem stale closures | Effect depende de game ID, powers, IDs, log e registry por nomes simples completos |
| C16-5 | 🟢 | Troca de partida segura | Novo game ID estabelece baseline e não interpreta power antigo como dano novo |
| C16-6 | 🟢 | Sem replay por render | Ref avança após cada amostra; estado visual local não repete o mesmo delta |
| C16-7 | 🟢 | Semântica preservada | Se ambos descem no mesmo snapshot, mantém prioridade histórica ao player 0 |
| F2-UI | 🟡 | Três warnings restantes | Fetch de perfis, descarte e novo log/dano continuam pendentes |
| DEPLOY-C16 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Log relevante fora dos dez mais recentes é ignorado.
2. Log recente do target devolve blocked 3 + bypass; outro target/ID vazio não casa.
3. Baseline null, power igual e power maior devolvem null.
4. Queda do player 2 de 20 para 16 devolve damage 4 e Defense 2.
5. Queda simultânea continua a escolher player 0, como o código anterior.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 81 ficheiros, 380 testes, 100% aprovados |
| Testes focados C16 | 7 testes de viewer/power/log aprovados |
| TypeScript e build | Aprovados; `GameScreen` 19,51 kB/7,23 kB gzip; `dist/` 9.231.802 bytes |
| Lint | Zero erros; 109 advertências herdadas (menos três); três warnings em `GameScreen` |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Extrair snapshot/detector puro para Knowledge removida do field.
2. Derivar players/game ID usados pelo effect de descarte e incluir registry explicitamente.
3. Evitar animação falsa entre partidas e provar ordem my→opponent/imagem anterior.
4. Remover apenas o warning do descarte e manter fetch/log até ciclos próprios.
5. Preservar integralmente ações e persistência legadas.

## Checkpoint C17 — descarte visual com snapshots mínimos

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; effect de descarte isolado  
**Limite de segurança:** apenas deteção/animação visual de carta que saiu do field. Nenhuma
regra, action, timer, persistência, rede, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C17-1 | 🟢 | Snapshot mínimo de field | Guarda IDs mine/opponent e mapa ID→imagem, sem capturar GameState completo |
| C17-2 | 🟢 | Orientação por viewer | Viewer 0/1 recebe corretamente o seu field e o rival |
| C17-3 | 🟢 | Detector puro | Compara previous/current e devolve apenas primeira remoção + imagem anterior |
| C17-4 | 🟢 | Prioridade preservada | Remoções simultâneas mantêm ordem histórica mine antes de opponent |
| C17-5 | 🟢 | Sem falso replay | Snapshot igual devolve null; ref avança depois da observação |
| C17-6 | 🟢 | Reset entre jogos | Novo game ID cria baseline e não anima cartas da partida anterior |
| C17-7 | 🟢 | Dependências completas | Effect usa game ID, players derivados, registry e viewer index explicitamente |
| F2-UI | 🟡 | Dois warnings restantes | Fetch de perfis e parsing/movimento do novo log ainda pendentes |
| DEPLOY-C17 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Carta própria removida devolve o instance ID e a imagem guardada antes da remoção.
2. Snapshot sem mudança não gera animação.
3. Duas remoções simultâneas escolhem a carta própria primeiro.
4. Para viewer 2, mine/opponent são invertidos corretamente.
5. Se anchors DOM faltam, estado de baseline avança e não cria loop de retry visual.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 81 ficheiros, 383 testes, 100% aprovados |
| Testes focados C17 | 10 testes do módulo viewer/visual aprovados |
| TypeScript e build | Aprovados; `GameScreen` 19,52 kB/7,22 kB gzip; `dist/` 9.231.811 bytes |
| Lint | Zero erros; 108 advertências herdadas (menos uma); dois warnings em `GameScreen` |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Extrair parser puro do último log estruturado de dano e alvo UUID.
2. Separar movimento de ataque da criação do floater para evitar overwrite/duplicação.
3. Derivar player IDs/fields/log e completar dependências do último effect visual.
4. Reiniciar cursor de log em troca de partida para não reproduzir histórico na reconexão.
5. Manter o fetch de perfis como único warning até existir hook cancelável própria.

## Checkpoint C18 — log de combate sem floater duplicado

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; último effect visual isolado  
**Limite de segurança:** apenas parsing de log e animação de ataque. Nenhuma regra, action,
timer, persistência, rede, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C18-1 | 🟢 | Parser de dano puro | Aceita amount positivo e target UUID v1; rejeita zero, IDs legados e logs não relacionados |
| C18-2 | 🟢 | Fonte de ataque pura | Resolve target 0/1 e primeira carta do field oposto, ou null sem inventar origem |
| C18-3 | 🟢 | Floater único | Log já não escreve `damageEvent`; apenas delta real de power cria o floater |
| C18-4 | 🟢 | Movimento preservado | Se anchors existem, carta atacante move-se para o power do alvo com imagem correta |
| C18-5 | 🟢 | Cursor por partida | Novo game ID posiciona o cursor no histórico atual e não reproduz logs antigos |
| C18-6 | 🟢 | Dependências completas | Effect usa game ID, players, log e registry derivados, sem GameState oculto |
| F2-UI | 🟡 | Um warning restante | Apenas fetch de perfis precisa de hook com cache/in-flight/cancelamento |
| DEPLOY-C18 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Log com damage 4 + UUID válido é parseado; target textual e damage zero são recusados.
2. Target player 2 escolhe a primeira carta do field do player 1.
3. Outsider UUID e attacker field vazio devolvem null.
4. Em troca/reconexão de partida, o último log existente torna-se baseline sem animação.
5. Um update de combate já não disputa/overwrite o `damageEvent` criado pelo delta de power.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 81 ficheiros, 386 testes, 100% aprovados |
| Testes focados C18 | 13 testes do módulo viewer/visual aprovados |
| TypeScript e build | Aprovados; `GameScreen` 19,69 kB/7,26 kB gzip; `dist/` 9.231.983 bytes |
| Lint | Zero erros; 107 advertências herdadas (menos uma); um warning em `GameScreen` |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Extrair `usePlayerProfiles` com upstream loading, IDs estáveis, cache e in-flight map.
2. Ignorar resultados de pedidos antigos após troca de IDs/unmount e normalizar falha parcial.
3. Provar Strict Mode sem pedidos duplicados, switch rápido e retorno ao cache.
4. Substituir state/effect local do `GameScreen` e eliminar o último warning de hooks.
5. Não alterar serviço de perfis, autenticação ou contrato Supabase.

## Checkpoint C19 — perfis concorrentes, deduplicados e sem respostas obsoletas

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; `GameScreen` sem warnings de hooks  
**Limite de segurança:** apenas leitura e apresentação dos perfis existentes. Nenhuma alteração
ao serviço, autenticação, contratos, persistência, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C19-1 | 🟢 | Hook próprio de perfis | `usePlayerProfiles` recebe IDs/upstream loading e devolve perfis + loading normalizados |
| C19-2 | 🟢 | Pedidos deduplicados | Mapa in-flight partilhado impede duplicação causada por Strict Mode |
| C19-3 | 🟢 | Cache por utilizador | Regressar a um par já carregado não consulta novamente o serviço |
| C19-4 | 🟢 | Respostas antigas ignoradas | Troca rápida de jogadores não deixa o pedido anterior sobrescrever o par atual |
| C19-5 | 🟢 | Falha parcial tolerada | Um perfil que falha recebe fallback vazio sem perder o perfil válido |
| C19-6 | 🟢 | Loading determinístico | Enquanto o upstream carrega não há pedidos; IDs inválidos terminam sem spinner infinito |
| C19-7 | 🟢 | Effect local removido | `GameScreen` deixou de gerir fetch/state concorrente e passou a consumir o hook |
| F2-UI | 🟢 | Dívida de hooks fechada | Zero warnings `react-hooks/exhaustive-deps` no `GameScreen` |
| LINT-C19 | 🟡 | Dívida global herdada | 106 warnings sem erros; requer orçamento regressivo próprio |
| DEPLOY-C19 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Upstream ainda em loading não dispara qualquer leitura de perfil.
2. Strict Mode monta/desmonta o effect sem duplicar os dois pedidos necessários.
3. Uma troca rápida A/B → C/D ignora a resolução atrasada de A/B.
4. Falha isolada de um utilizador preserva o perfil carregado do outro.
5. Voltar a um par já visto usa cache e não cria novos pedidos.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 82 ficheiros, 391 testes, 100% aprovados |
| Testes focados C19 | 5 testes do hook de perfis aprovados |
| TypeScript e build | Aprovados; `GameScreen` 20,59 kB/7,49 kB gzip; `dist/` 9.232.885 bytes |
| Lint | Zero erros; 106 advertências herdadas (menos uma); zero warnings de hooks em `GameScreen` |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Classificar a dívida de lint por regra e separar correções mecânicas de decisões semânticas.
2. Aplicar apenas autofixes seguros de `prefer-const`, inspecionando o diff resultante.
3. Criar um orçamento de warnings regressivo, verificável localmente e no CI.
4. Provar que o orçamento coincide com a contagem real e impede novas advertências.
5. Manter base compartilhada, Hub, runtime autoritativo e deploy fora do âmbito.

## Checkpoint C20 — dívida de lint reduzida e orçamento regressivo no CI

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; 31 warnings mecânicos removidos  
**Limite de segurança:** refactor exclusivamente sintático (`let` → `const`) e configuração de
qualidade. Nenhuma regra de jogo, efeito, action, persistência, rede, Supabase, SQL, migração,
Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C20-1 | 🟢 | Dívida classificada | Baseline inicial: 72 unused, 31 prefer-const e 3 Fast Refresh |
| C20-2 | 🟢 | Autofix limitado | Removidos os 31 `prefer-const`: 26 em código e 5 em testes, sem alterar valores/ordem |
| C20-3 | 🟢 | Orçamento por regra | `.lint-warning-budget.json` fixa total 75 = unused 72 + Fast Refresh 3 |
| C20-4 | 🟢 | Gate exato | Verificador falha tanto por regressão como por orçamento desatualizado que já pode baixar |
| C20-5 | 🟢 | CI protegido | Workflow usa `npm run lint:ci`; lint normal continua disponível para diagnóstico |
| C20-6 | 🟢 | Configuração testada | Soma, versão, inteiros, script npm e ligação ao workflow têm cobertura automática |
| C20-7 | 🟢 | Regressão comprovada | Warning sintético elevou 75→76 e foi rejeitado; ficheiro-prova foi depois removido |
| LINT-C20 | 🟡 | Dívida semântica isolada | Restam 72 unused vars/imports e 3 exports Fast Refresh, sem erros |
| DEPLOY-C20 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Uma regra nova não incluída no orçamento recebe limite implícito zero e falha o gate.
2. Aumentar unused vars de 72 para 73 falha mesmo que outra categoria pudesse baixar.
3. Reduzir warnings sem baixar o ficheiro de orçamento também falha e obriga a consolidar o ganho.
4. Soma declarada diferente da soma por regra é rejeitada como configuração inválida.
5. O mesmo scope de produção/testes/functions/scripts do lint normal é verificado pelo CI.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 83 ficheiros, 393 testes, 100% aprovados |
| Testes focados C20 | 2 testes de orçamento/configuração aprovados |
| TypeScript e build | App, Node e Edge Function aprovados; `GameScreen` 20,59 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.779 bytes; chunk `state` baixou para 41,63 kB/11,03 kB gzip |
| Lint | Zero erros; orçamento exato de 75 warnings, menos 31 que no C19 |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado; prova adversarial ausente |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Classificar os 72 unused por código de produção, testes e scripts.
2. Remover primeiro imports, parâmetros e locals comprovadamente mortos em produção.
3. Evitar renomear para `_` quando a eliminação segura for possível; não esconder dívida.
4. Atualizar o orçamento exatamente após cada grupo validado.
5. Manter os três warnings Fast Refresh para um ciclo arquitetural separado.

## Checkpoint C21 — produção sem símbolos mortos

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; unused isolados exclusivamente nos testes  
**Limite de segurança:** remoção de imports, destructuring, constantes e helpers sem referências.
Nenhuma regra ativa, contrato de action, comportamento, persistência, rede, Supabase, SQL,
migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C21-1 | 🟢 | Produção classificada | 11 unused revistos individualmente em game code e script administrativo |
| C21-2 | 🟢 | Imports/locals mínimos | Removidos retorno Supabase não lido, payload field não usado, import e constante mortos |
| C21-3 | 🟢 | Callbacks preservados | Índices omitidos apenas nos loops que não os usam; branch de summon mantém index/opponent |
| C21-4 | 🟢 | Helpers mortos removidos | Três helpers locais sem qualquer referência eliminados de `passives.ts` |
| C21-5 | 🟢 | Produção sem unused | Scope src/scripts/functions tem apenas os 3 warnings Fast Refresh conhecidos |
| C21-6 | 🟢 | Orçamento reduzido | 75→64: unused 72→61; Fast Refresh permanece 3 |
| C21-7 | 🟢 | Guardas funcionais | 31 ficheiros/123 testes de actions, effects e passives aprovados |
| TEST-FLAKE-C21 | 🟡 | Timeout sob carga | Um teste HTTP temporal falhou concorrendo com build; isolado e suite repetida passaram |
| DEPLOY-C21 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. A primeira tentativa de remover índices no loop errado foi detetada por 17 testes de passives.
2. A correção restaurou o contrato do branch summon e eliminou apenas os valores mortos no draw.
3. Todos os 123 testes diretamente afetados passaram depois da correção localizada.
4. O gate exato confirmou 61 unused apenas em testes; produção não contém nenhum.
5. O teste de retry/duplicate sensível a timeout passou isolado e na repetição integral.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | Repetição final: 83 ficheiros, 393 testes, 100% aprovados |
| Testes focados C21 | 31 ficheiros, 123 testes de actions/effects/passives aprovados |
| TypeScript e build | Aprovados; `GameScreen` 20,59 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.711 bytes; chunk `state` 41,56 kB/11,03 kB gzip |
| Lint | Zero erros; orçamento exato 64 = 61 unused de testes + 3 Fast Refresh |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Tornar o teste de timeout/duplicate determinístico sob carga sem aumentar cegamente sleeps.
2. Provar o timeout com uma barreira controlada em vez de depender de poucos milissegundos reais.
3. Repetir o teste em série para confirmar ausência de flake.
4. Depois, remover unused dos testes por grupos pequenos e semanticamente relacionados.
5. Manter produção, base partilhada, Hub e deploy fora deste ciclo de testes.

## Checkpoint C22 — timeout autoritativo determinístico sob carga

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; flake temporal reproduzida e eliminada  
**Limite de segurança:** seam opcional de testabilidade no handler HTTP, mantendo o mesmo factory
de `AbortSignal` por omissão. Nenhum contrato wire, comando, persistência, rede real, Supabase,
SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C22-1 | 🟢 | Causa identificada | Timeout real de 10 ms podia vencer antes do commit quando havia contenção de CPU |
| C22-2 | 🟢 | Sinal injetável | Handler aceita factory opcional; produção continua a usar `createAuthoritativeOperationSignal` |
| C22-3 | 🟢 | Barreira de commit | Teste recebe confirmação explícita de commit antes de disparar o timeout controlado |
| C22-4 | 🟢 | Sem sleeps frágeis | Cenário já não depende de relógio real nem de aumentar arbitrariamente a espera |
| C22-5 | 🟢 | Semântica preservada | Primeira resposta é 504 timeout; retry com mesmo commandId é duplicate 200 |
| C22-6 | 🟢 | Idempotência preservada | Exatamente um evento persistido e outcomes `timeout`, `duplicate` |
| TEST-FLAKE-C22 | 🟢 | Risco fechado | Três execuções paralelas e suite+build concorrentes passaram |
| LINT-C22 | 🟡 | Dívida restante | Orçamento mantém 64 = 61 unused de testes + 3 Fast Refresh |
| DEPLOY-C22 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. O timeout só pode ser disparado no teste depois de o primeiro serviço confirmar o commit.
2. A resposta perdida não deixa o cliente concluir erroneamente que o comando não foi aplicado.
3. O retry por outra instância vê o commandId persistido e responde duplicate.
4. Três processos de teste concorrentes aprovaram 4/4 cenários cada (12/12).
5. Suite integral concorrendo com build aprovou 393/393, reproduzindo a carga antes problemática.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel sob carga | 83 ficheiros, 393 testes, 100% aprovados, concorrendo com build |
| Testes focados C22 | 4/4 isolados + 12/12 em três execuções simultâneas |
| TypeScript e build | Aprovados; `GameScreen` 20,59 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.711 bytes; sem variação funcional do C21 |
| Lint | Zero erros; orçamento exato de 64 warnings |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Agrupar os 61 unused de testes entre imports, fixture locals e parâmetros de helpers.
2. Começar pelos imports e locals sem referência, sem mudar asserções ou cenários.
3. Manter fixtures com intenção semântica se forem parte legível do arranjo do teste.
4. Atualizar o orçamento apenas após testes focados e suite integral.
5. Deixar os três warnings Fast Refresh para extração de módulos/hooks própria.

## Checkpoint C23 — unused eliminados em toda a base TypeScript

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; dívida de lint reduzida a três separações arquiteturais  
**Limite de segurança:** apenas imports, IDs e snapshots locais sem referência nos testes.
Nenhuma chamada de fixture/setup, asserção, cenário, regra, runtime, persistência, Supabase, SQL,
migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C23-1 | 🟢 | Inventário completo | 61 unused separados em imports, IDs/snapshots locais e helpers de teste |
| C23-2 | 🟢 | Lote transversal limpo | 16 warnings removidos de effects, rules, initialization, setup e helpers |
| C23-3 | 🟢 | Lote passives limpo | 45 warnings removidos sem apagar criação/mutação de fixtures |
| C23-4 | 🟢 | Imports mínimos | Named imports foram reduzidos sem eliminar símbolos ainda usados |
| C23-5 | 🟢 | Zero unused global | `@typescript-eslint/no-unused-vars` ausente em src, tests, functions e scripts |
| C23-6 | 🟢 | Orçamento reduzido | 64→3; só `react-refresh/only-export-components` permanece |
| C23-7 | 🟢 | Cenários preservados | 117 testes do primeiro lote + 60 de passives aprovados antes da suite total |
| LINT-C23 | 🟡 | Última dívida | 3 exports não-componente requerem separação em módulos próprios |
| DEPLOY-C23 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Leituras locais sem uso foram eliminadas, mas chamadas de criação/setup foram preservadas.
2. Imports parcialmente usados foram reduzidos símbolo a símbolo, não removidos em bloco.
3. Todo o diretório tests passa ESLint com `--max-warnings=0`.
4. O orçamento exato falharia se qualquer unused regressasse, pois a regra já não está listada.
5. Todos os cenários de passives continuam a executar 60/60 depois da limpeza.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 83 ficheiros, 393 testes, 100% aprovados |
| Testes focados C23 | 20 ficheiros/117 testes + 16 ficheiros/60 testes aprovados |
| TypeScript e build | Aprovados; `GameScreen` 20,59 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.711 bytes; runtime inalterado |
| Lint | Zero erros; orçamento exato de 3 warnings Fast Refresh; zero unused |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Inspecionar cada export não-componente e respetivos importadores.
2. Extrair hooks/constants de UI, Auth e CardRegistry para módulos próprios sem ciclos.
3. Preservar APIs públicas com reexports apenas se não reintroduzirem o warning.
4. Baixar o orçamento a zero e tornar qualquer warning futuro falha de CI.
5. Validar autenticação, registry e componentes consumidores com testes focados.

## Checkpoint C24 — lint totalmente limpo e Fast Refresh isolado

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; orçamento de warnings chegou a zero  
**Limite de segurança:** reorganização de módulos/imports para utilitário, contextos e hooks.
Nenhum fluxo de autenticação, método de registry, componente visual, regra, persistência, Supabase,
SQL, migração, Hub, SDK ou deploy alterado semanticamente.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C24-1 | 🟢 | Utilitário UI isolado | `cn` vive em módulo puro; 12 consumidores usam import direto |
| C24-2 | 🟢 | Contexto Auth separado | Tipos/contexto ficam em módulo sem componente; provider exporta só o provider |
| C24-3 | 🟢 | Hook Auth próprio | `useAuth` vive em `hooks/` e preserva erro fora do provider |
| C24-4 | 🟢 | Contexto Registry separado | Registry types/contexto deixaram o ficheiro do provider |
| C24-5 | 🟢 | Hook Registry próprio | Todos os componentes/testes consumidores usam o novo caminho sem ciclo |
| C24-6 | 🟢 | Fast Refresh limpo | Zero `react-refresh/only-export-components` no projeto |
| C24-7 | 🟢 | Gate absoluto | Orçamento 3→0; qualquer novo warning, de qualquer regra, falha no CI |
| LINT-C24 | 🟢 | Dívida encerrada | Zero erros e zero warnings em src, tests, functions, scripts e config |
| DEPLOY-C24 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Pesquisa posterior confirmou ausência de imports de `cn` pelo barrel de componentes.
2. Nenhum consumidor continua a importar `useAuth` de `AuthProvider`.
3. Nenhum consumidor continua a importar `useCardRegistry` do provider.
4. Typecheck apanhou dez consumidores de `cn` omitidos no primeiro mapa; todos foram corrigidos.
5. Orçamento vazio `{}` passa apenas com contagem global exatamente zero.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 83 ficheiros, 393 testes, 100% aprovados |
| Testes focados C24 | 6 ficheiros, 15 testes de Auth/Registry/UI aprovados |
| TypeScript e build | Aprovados; `GameScreen` 20,60 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.724 bytes; `index` 39,69 kB/12,21 kB gzip |
| Lint | Zero erros; zero warnings; orçamento CI zero |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Regressar ao plano de auditoria e recalcular prioridades após C1–C24.
2. Identificar o maior risco ainda corrigível sem ativar multiplayer ou tocar na base partilhada.
3. Selecionar um ciclo pequeno com critério de aceitação e rollback claro.
4. Preservar gate de lint zero e a suite de 393 testes como baseline obrigatória.
5. Manter deploy bloqueado até existir decisão explícita e backend autoritativo real.

## Checkpoint C25 — artefacto público sem material privilegiado

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; gate de segurança pós-build ativo  
**Limite de segurança:** análise local, read-only, do conteúdo de `dist/` e configuração CI.
Nenhuma credencial real, rede de jogo, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C25-1 | 🟢 | Política de ficheiros públicos | Rejeita `.env*`, sourcemaps, PEM/KEY, chaves SSH e symlinks no artefacto |
| C25-2 | 🟢 | Marcadores server-only | Rejeita nomes de service-role/escrow signer e cabeçalhos de chave privada |
| C25-3 | 🟢 | JWT inspecionado | Decodifica payloads JWT encontrados e rejeita role `service_role`; `anon` é permitido |
| C25-4 | 🟢 | Sourcemap fechado | Rejeita tanto ficheiros `.map` como referências `sourceMappingURL` embebidas |
| C25-5 | 🟢 | Gate pós-build no CI | `verify:public-artifact` corre depois do build e antes da política de logs |
| C25-6 | 🟢 | Prova adversarial real | `.env.c25-probe` causou falha e foi removido antes do fecho |
| C25-7 | 🟢 | Artefacto atual aprovado | 111 ficheiros; 37 textuais analisados; zero findings |
| PERF-C25 | 🔴 | Core Web Vitals | Skill pausada: Chrome DevTools MCP não está configurado; nenhum valor foi inventado |
| DEPLOY-C25 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Ficheiro `.env.production` e extensões `.map`, `.pem` e `.key` são recusados.
2. Marcadores de service role, private key e source map produzem findings tipados.
3. JWT com `role=service_role` falha; JWT com `role=anon` não é falso positivo.
4. Um `.env` criado no `dist/` real fez o comando terminar com código 1.
5. Depois da remoção e rebuild, o mesmo gate aprovou o artefacto completo.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 84 ficheiros, 397 testes, 100% aprovados |
| Testes focados C25 | 4 testes negativos/integração CI da política aprovados |
| TypeScript e build | Aprovados; `GameScreen` 20,60 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.724 bytes; 111 ficheiros; 37 textuais inspecionados |
| Lint | Zero erros; zero warnings; orçamento CI zero |
| Dependências | Auditoria npm de produção: zero vulnerabilidades conhecidas |
| Segurança do build | Sem credenciais privilegiadas, chaves, sourcemaps ou symlinks |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado; prova adversarial ausente |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Adicionar baseline de cobertura executável para os módulos críticos, sem confundir cobertura com correção.
2. Priorizar protocolo, invariantes, persistência em memória, HTTP e release gates.
3. Manter cobertura global como informação e thresholds apenas onde os riscos são definidos.
4. Integrar o gate no CI se a ferramenta não introduzir vulnerabilidades.
5. Retomar CWV apenas quando `chrome-devtools-mcp` estiver disponível.

## Checkpoint C26 — cobertura crítica executável na CI

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; regressões de cobertura crítica passam a bloquear a CI  
**Limite de segurança:** configuração de testes, política de cobertura e workflow local.
Nenhuma regra de jogo, runtime, persistência, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C26-1 | 🟢 | Escopo crítico explícito | 18 ficheiros de release, protocolo, invariantes, replay, random, cliente, HTTP e persistência |
| C26-2 | 🟢 | Provedor fixado | `@vitest/coverage-v8` e Vitest resolvidos em 3.2.6, sem intervalo de versão no provider |
| C26-3 | 🟢 | Gate agregado nativo | Mínimos de 86% statements/lines, 80% branches e 95% functions |
| C26-4 | 🟢 | Gate individual | Cada ficheiro exige 70% statements/lines, 65% branches e 75% functions |
| C26-5 | 🟢 | Release integral | `src/config/release.ts` exige 100% nas quatro métricas |
| C26-6 | 🟢 | Uma única suite | Um relatório JSON alimenta o gate individual; não se executam os 402 testes duas vezes |
| C26-7 | 🟢 | CI ligada ao gate | O antigo teste sem medição foi substituído por `npm run test:coverage` |
| C26-8 | 🟢 | Política testável | Ausência de ficheiro crítico e regressão abaixo do mínimo são cenários automatizados |
| ENV-C26 | 🟡 | Runtime local desatualizado | Shell atual usa Node 22.11.0, abaixo de `engines >=22.13`; `.nvmrc` já fixa 22.22.0 |
| PERF-C26 | 🔴 | Core Web Vitals | Continua bloqueado pela ausência de Chrome DevTools MCP; nenhum valor foi estimado |
| DEPLOY-C26 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Baseline crítico observado

| Métrica | Resultado | Gate agregado | Mínimo individual |
|---|---:|---:|---:|
| Statements | 86,91% | 86% | 70% |
| Branches | 80,43% | 80% | 65% |
| Functions | 95,67% | 95% | 75% |
| Lines | 86,91% | 86% | 70% |
| Release | 100% nas quatro métricas | 100% | 100% |

### Casos adversariais comprovados

1. A tentativa inicial de combinar dois níveis através de `perFile` aplicou o limite agregado a cada
   ficheiro e falhou; a configuração incorreta foi rejeitada, não acomodada por redução do baseline.
2. Elevar temporariamente branches individuais de 65% para 70% fez o gate recusar
   `invariants.ts` a 69,23%, com código de saída 1.
3. Depois do restauro a 65%, o mesmo relatório voltou a passar para os 18 ficheiros.
4. O teste de política simula simultaneamente um ficheiro crítico ausente e branches a 64,99%.
5. O teste de CI confirma que a suite antiga sem cobertura não permanece duplicada no workflow.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel + cobertura | 85 ficheiros, 402 testes, 100% aprovados |
| Testes focados C26 | 5 cenários de config/política aprovados |
| TypeScript e build | Aprovados; `GameScreen` 20,60 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.724 bytes; 111 ficheiros; 37 textuais inspecionados |
| Lint | Zero erros; zero warnings; orçamento CI zero |
| Dependências | Auditoria completa e de produção: zero vulnerabilidades conhecidas |
| Segurança do build | Política de material privilegiado/sourcemaps aprovada |
| Logs de produção | 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado; `coverage/` ignorado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Tornar a versão efetiva de Node verificável antes de instalar/testar, sem alterar o runtime do jogo.
2. Alinhar CI, `.nvmrc`, `engines` e documentação numa única política executável.
3. Provar que uma versão abaixo de 22.13 é recusada com mensagem clara.
4. Manter o novo gate de cobertura e todos os gates C1–C26 verdes.
5. Continuar sem qualquer operação na base partilhada ou no deploy.

## Checkpoint C27 — runtime Node reproduzível e executável

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; versões incompatíveis falham antes dos entry points  
**Limite de segurança:** metadados de runtime, script de verificação, CI, README e testes.
Nenhum código funcional do jogo, persistência, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C27-1 | 🟢 | Linhas suportadas explícitas | `engines.node` aceita 22.13+ e 24.x, mas já não aceita Node 23 EOL |
| C27-2 | 🟢 | Pin reproduzível | `.nvmrc` fixa Node 22.22.2 |
| C27-3 | 🟢 | CI alinhada | `actions/setup-node` lê `node-version-file: .nvmrc` em vez de um major solto |
| C27-4 | 🟢 | Gate sem dependências | `verify-runtime.mjs` usa apenas módulos nativos e corre antes de `npm ci` |
| C27-5 | 🟢 | Entry points protegidos | `dev`, `build`, `test` e `test:coverage` validam o runtime antes de arrancar |
| C27-6 | 🟢 | Instruções reproduzíveis | README indica mínimos e os passos `nvm install`/`nvm use` |
| C27-7 | 🟢 | Compatibilidade real | Node 22.22.2 e Node 24.18.0 locais foram ambos aprovados pelo gate |
| ENV-C27 | 🟡 | Shell hospedeiro | O shell por omissão continua em 22.11.0; o projeto agora o recusa e orienta `nvm use` |
| PERF-C27 | 🔴 | Core Web Vitals | Continua bloqueado pela ausência de Chrome DevTools MCP |
| DEPLOY-C27 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. O Node 22.11.0 real terminou com código 1 e mensagem para executar `nvm install && nvm use`.
2. As versões simuladas 22.12.99, 23.11.1, 25.0.0 e uma string malformada são recusadas.
3. As versões 22.13.0, 22.22.2, 24.0.0 e 24.99.99 são aceites pela política.
4. Node 22.22.2 executou o lifecycle completo de cobertura e build, incluindo os pre-gates.
5. Node 24.18.0 confirmou a segunda linha suportada sem alterar o pin da CI.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel + cobertura | 86 ficheiros, 406 testes, 100% aprovados |
| Testes focados C27 | 2 ficheiros, 9 cenários de runtime/cobertura aprovados |
| Cobertura crítica | 86,91% statements/lines, 80,45% branches, 95,67% functions; 18/18 ficheiros aprovados |
| TypeScript e build | Aprovados sob Node 22.22.2; `GameScreen` 20,60 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.724 bytes; 111 ficheiros; 37 textuais inspecionados |
| Lint | Zero erros; zero warnings; orçamento CI zero |
| Lockfile | `npm install --package-lock-only --ignore-scripts` confirmou estado atualizado |
| Dependências | Auditoria completa e de produção: zero vulnerabilidades conhecidas |
| Segurança e logs | Artefacto público e 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Recalcular o backlog do relatório de auditoria depois de C1–C27.
2. Escolher o maior risco ainda tratável sem browser DevTools, backend real ou base partilhada.
3. Preferir um gate executável com prova negativa a uma melhoria apenas documental.
4. Preservar cobertura, runtime, artefacto, lint e suite como baseline.
5. Manter deploy e qualquer escrita partilhada bloqueados.

## Checkpoint C28 — orçamento executável do carregamento inicial

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; crescimento do bundle passa a bloquear a CI  
**Limite de segurança:** inspeção pós-build de `dist/`, política pura, testes e workflow.
Nenhum componente/runtime do jogo, persistência, Supabase, SQL, migração, Hub, SDK ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C28-1 | 🟢 | Medição do carregamento real | Lê o script de entrada e todos os `modulepreload`/stylesheets declarados no HTML produzido |
| C28-2 | 🟢 | Compressão reproduzível | Mede gzip com `node:zlib`, sem depender da estimativa textual do bundler |
| C28-3 | 🟢 | Baseline inicial | JavaScript inicial limitado a 250 KiB gzip; valor atual 234,32 KiB em 8 ficheiros |
| C28-4 | 🟢 | Limite por chunk | Qualquer chunk JavaScript acima de 80 KiB gzip falha; máximo atual 69,13 KiB |
| C28-5 | 🟢 | Limite CSS | CSS inicial limitado a 20 KiB gzip; valor atual 14,86 KiB |
| C28-6 | 🟢 | Entradas obrigatórias | HTML sem script inicial ou stylesheet também falha, mesmo que reporte zero bytes |
| C28-7 | 🟢 | Gate pós-build na CI | Corre imediatamente depois do build e antes da política do artefacto público |
| PERF-BUNDLE-C28 | 🟡 | Meta madura por atingir | 234,32 KiB ainda excede a meta de 170 KiB em 64,32 KiB; requer retirar SDK/auth do caminho inicial |
| PERF-C28 | 🔴 | Core Web Vitals | Continua bloqueado pela ausência de Chrome DevTools MCP |
| DEPLOY-C28 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. Baixar temporariamente o teto de 250 para 230 KiB recusou o build real de 234,32 KiB
   com código de saída 1.
2. Depois do restauro a 250 KiB, o mesmo artefacto voltou a passar.
3. A política unitária recusa um único byte acima de cada um dos três limites.
4. A política recusa zero scripts iniciais e zero stylesheets, impedindo um falso verde por parsing vazio.
5. O teste de workflow prova a ordem build → bundle budget → artefacto público.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel + cobertura | 87 ficheiros, 409 testes, 100% aprovados |
| Testes focados C28 | 2 ficheiros, 7 cenários de bundle/runtime aprovados |
| Cobertura crítica | 86,91% statements/lines, 80,45% branches, 95,67% functions; 18/18 ficheiros aprovados |
| Runtime | Gate aprovado sob Node 22.22.2 |
| Bundle | 234,32 KiB JS inicial; 69,13 KiB maior chunk; 14,86 KiB CSS inicial |
| TypeScript e build | Aprovados; `GameScreen` 20,60 kB/7,49 kB gzip |
| Artefacto | `dist/` 9.232.724 bytes; 111 ficheiros; 37 textuais inspecionados |
| Lint | Zero erros; zero warnings; orçamento CI zero |
| Dependências | Auditoria completa e de produção: zero vulnerabilidades conhecidas |
| Segurança e logs | Artefacto público e 20 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Construir o grafo do caminho inicial a partir dos oito assets pré-carregados.
2. Separar auth/wallet/Supabase do treino público sem degradar login nem sessão existente.
3. Reduzir o JavaScript inicial para ≤170 KiB gzip e baixar o gate apenas depois da medição.
4. Testar utilizador anónimo e autenticado, incluindo cancelamento/erro do carregamento tardio.
5. Preservar todos os gates e não publicar a alteração.

## Checkpoint C29 — SDK/auth fora do preload do treino público

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; caminho inicial abaixo da meta madura de 130 KiB  
**Limite de segurança:** bootstrap de autenticação, imports dinâmicos, chunking, política de bundle e testes.
Nenhuma regra de jogo, persistência, Supabase remoto, SQL, migração, Hub, SDK publicado ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C29-1 | 🟢 | Auth carregada tardiamente | Mythical, Supabase e wallet services deixaram de ser imports estáticos do `AuthProvider` |
| C29-2 | 🟢 | Rotas sensíveis imediatas | Callback, lobby, perfil, game, initialization, selection e waiting iniciam auth sem adiamento |
| C29-3 | 🟢 | Treino prioriza render | Rotas públicas iniciam auth em idle, com timeout máximo de 2 s e fallback de 1 s |
| C29-4 | 🟢 | Interações preservadas | Login email/Google, wallet, refresh e logout mantêm a mesma API e carregam os serviços quando usados |
| C29-5 | 🟢 | Chunking sem hoisting | `onlyExplicitManualChunks` impede o helper de preload de arrastar web3/crypto para o entrypoint |
| C29-6 | 🟢 | Redução material | JavaScript inicial 234,32→94,52 KiB gzip (−59,7%); oito→seis ficheiros |
| C29-7 | 🟢 | Gate apertado | Teto inicial 250→110 KiB; ainda conserva 15,48 KiB de margem sobre o build atual |
| C29-8 | 🟢 | Dependências opcionais proibidas | Gate recusa chunks Mythical, Play Hub auth/wallet, Supabase, web3 e crypto no preload |
| PERF-BUNDLE-C29 | 🟢 | Meta de auditoria superada | 94,52 KiB fica abaixo do gate inicial 170 KiB e do objetivo maduro 130 KiB |
| PERF-C29 | 🔴 | Core Web Vitals | A melhoria de bytes é comprovada; LCP/INP/CLS continuam sem medição por falta de DevTools MCP |
| DEPLOY-C29 | ⚪ | Cliente autoritativo/runtime/deploy | Continua desligado e não configurado |

### Casos adversariais comprovados

1. O primeiro build dinâmico chegou a 175,15 KiB porque o helper de preload foi colocado no chunk
   web3; o grafo foi corrigido, não aceite como conclusão parcial.
2. Baixar temporariamente o novo teto de 110 para 90 KiB recusou os 94,52 KiB reais com saída 1.
3. Depois do restauro a 110 KiB, o mesmo artefacto voltou a passar.
4. Rotas protegidas e callback são testadas como imediatas; home e bot selection são diferidas.
5. Cancelar o idle no unmount impede inicialização obsoleta; browsers sem idle usam timeout limitado.
6. A política rejeita nominalmente qualquer reentrada de Supabase/web3/Mythical no HTML inicial.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel + cobertura | 88 ficheiros, 414 testes, 100% aprovados |
| Testes focados C29 | 4 ficheiros, 12 cenários de bootstrap/bundle/Home/NavBar aprovados |
| Cobertura crítica | 86,91% statements/lines, 80,43% branches, 95,67% functions; 18/18 ficheiros aprovados |
| Runtime | Gate aprovado sob Node 22.22.2 |
| Bundle | 94,52 KiB JS inicial; 69,12 KiB maior chunk; 14,86 KiB CSS inicial |
| TypeScript e build | Aprovados; `GameScreen` 20,71 kB/7,55 kB gzip |
| Artefacto | `dist/` 9.236.452 bytes; 116 ficheiros; 42 textuais inspecionados |
| Lint | Zero erros; zero warnings; orçamento CI zero |
| Dependências | Auditoria completa e de produção: zero vulnerabilidades conhecidas |
| Segurança e logs | Artefacto público e 25 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados; `supabase/migrations` continua sem alterações |

### Próximo ciclo

1. Testar o `AuthProvider` real contra sucesso, falha e desmontagem do carregamento tardio.
2. Garantir que uma falha de chunk/SDK termina o loading e mostra erro recuperável.
3. Confirmar que múltiplas chamadas concorrentes partilham uma única importação/inicialização.
4. Medir novamente o bundle e preservar o teto de 110 KiB.
5. Continuar sem deploy nem escrita na infraestrutura partilhada.

## Checkpoint C30 — bootstrap auth resiliente e fecho da sessão

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado e validado; último checkpoint desta sessão por pedido do utilizador  
**Limite de segurança:** testes de integração do provider e determinismo de um harness de timeout.
Nenhuma regra funcional, persistência, Supabase remoto, SQL, migração, Hub, SDK publicado ou deploy.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C30-1 | 🟢 | Provider real sob teste | Harness isola Mythical/auth/wallet sem rede e usa o contexto público verdadeiro |
| C30-2 | 🟢 | Rota pública diferida | SDK não é consultado antes do idle; depois termina como visitor e subscreve auth |
| C30-3 | 🟢 | Rota protegida imediata | `/lobby` inicia sessão sem `requestIdleCallback` |
| C30-4 | 🟢 | Falha recuperável | Erro de SDK termina `loading` e aparece no estado público, sem spinner infinito |
| C30-5 | 🟢 | Ação antes do idle | Login email normaliza endereço e funciona antes da leitura de sessão diferida |
| C30-6 | 🟢 | Concorrência deduplicada | StrictMode mantém uma única leitura de sessão e uma subscrição |
| C30-7 | 🟢 | Flake pós-commit eliminada | Timeout browser-to-store usa AbortSignal controlado depois do commit, não 10 ms reais |
| SESSION-C30 | 🟢 | Relatórios consolidados | Auditoria e checkpoints contêm resultados finais e backlog priorizado |
| PERF-C30 | 🔴 | Core Web Vitals | Continua sem medição por ausência de Chrome DevTools MCP |
| DEPLOY-C30 | ⚪ | Publicação | Nenhuma alteração foi publicada |

### Casos adversariais comprovados

1. Erro `Play Hub unavailable` termina loading e produz estado recuperável.
2. Login email antes do idle chama o serviço uma vez com endereço normalizado e sem leitura prévia de sessão.
3. Montagem dupla StrictMode não duplica inicialização nem listener.
4. A suite integral expôs uma race no teste de 504 pós-commit sob cobertura; o relógio real foi removido.
5. Três processos concorrentes aprovaram 27/27 cenários de AuthProvider + browser-to-store após a correção.
6. A repetição integral sob cobertura aprovou o cenário anteriormente instável.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel + cobertura | 89 ficheiros, 419 testes, 100% aprovados |
| Testes focados C30 | 2 ficheiros/9 testes + 27/27 em três processos concorrentes |
| Cobertura crítica | 86,91% statements/lines, 80,45% branches, 95,67% functions; 18/18 ficheiros aprovados |
| Runtime | Gate aprovado sob Node 22.22.2 |
| Bundle | 94,52 KiB JS inicial; 69,12 KiB maior chunk; 14,86 KiB CSS inicial |
| TypeScript e build | Aprovados; último artefacto de produção verificado |
| Artefacto | `dist/` 9.236.452 bytes; 116 ficheiros; 42 textuais inspecionados |
| Lint | Zero erros; zero warnings; orçamento CI zero |
| Dependências | Auditoria completa e de produção: zero vulnerabilidades conhecidas |
| Segurança e logs | Artefacto público e 25 chunks próprios aprovados |
| Integridade do diff | `git diff --check` aprovado |
| Base/Hub/SDK | Não tocados neste ciclo; `supabase/migrations` continua sem alterações |

### Tarefas pendentes após a sessão

1. Backend PvP autoritativo e adapter Postgres real em ambiente isolado.
2. Reconciliação do schema partilhado e matriz RLS/grants com acesso administrativo read-only primeiro.
3. Deploy preview controlado, QA dos dois domínios e plano de rollback.
4. Verificação do cartão/copy/status no Play Hub atual.
5. Chrome DevTools/Lighthouse e CWV reais; RUM apenas após decisão de privacidade.
6. E2E browser/mobile e QA manual assistivo dos fluxos completos.
7. Privacidade, termos, retenção, wallet, antifraude e revisão externa antes de GEM.

## Checkpoint C31 — auditoria remota read-only da base partilhada

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado no próximo checkpoint, por pedido do utilizador  
**Limite de segurança:** inventário administrativo e `SELECT` de metadados/configuração agregada.
Nenhum DDL/DML, migração, secret, branch, deploy, alteração no catálogo, Hub ou SDK.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C31-1 | 🟢 | Projeto remoto confirmado | `mythical-beings-play-hub`, saudável, `eu-west-1`, PostgreSQL 17.6 |
| C31-2 | 🟢 | Histórico reconciliado | Produção e `mythicalSDK` alinham 34/34 versões; o jogo local tem apenas 10 migrações |
| C31-3 | 🟢 | RLS/grants/policies inventariados | Tabelas do jogo têm RLS; tabelas nucleares mantêm grants amplos e leitura pública |
| C31-4 | 🔴 P0 | Resultado económico controlado pelo host | `playhub_finish_session` transforma payload cliente em GEM, saldos e leaderboard |
| C31-5 | 🔴 P0 | Estado e informação privada controláveis | `card_game_set_state` substitui snapshot integral; `get_session_state` devolve ambas as mãos |
| C31-6 | 🔴 P0 | Drift do kill switch | `deal-cards` remoto v9 não inclui o gate default-off já existente no worktree |
| C31-7 | 🔴 P0 | Superfície operacional ativa | Jogo, casual, competitive GEM e season casual ativos; oito Edge Functions do jogo ativas |
| C31-8 | 🟡 | RNG e hardening | `Math.random()` no deal, sete FKs candidatas a índice e `SECURITY DEFINER` sem search path vazio |
| C31-9 | 🟢/🟡 | Sinais administrativos | Advisors 0/0 e zero logs Wisdom Duel em 24 h; não equivalem a ausência de risco |
| C31-10 | 🔴 | Ambiente de teste remoto | Zero branches Supabase; schema privado/projeções autoritativas ainda inexistentes |
| DATA-C31 | 🟢 | Produção preservada | Nenhum registo individual consultado e nenhuma operação de escrita executada |
| DEPLOY-C31 | ⚪ | Publicação | Nenhuma alteração foi publicada |

### Achados que alteram a prioridade

1. O caminho legado não é apenas uma dívida de arquitetura: o host autenticado fornece o resultado
   que a RPC converte em recompensa GEM e leaderboard.
2. A idempotência de `playhub_finish_session` impede duplicação, mas não valida a verdade do jogo.
3. O frontend/gate local não contém a superfície remota enquanto `deal-cards`, RPCs e catálogo
   continuarem ativos em produção.
4. A leitura privada continua inadequada: qualquer participante obtém o JSON completo de
   `dealt_hands`.
5. Os advisors não detetam regras de domínio; o seu resultado vazio não reduz a severidade.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Projeto | `ACTIVE_HEALTHY`; referência cruzada com URL/configuração local |
| Schema | Objetos Wisdom Duel, policies, grants, RPCs, FKs e Realtime inspecionados por metadata |
| Migrações | 34 versões remotas; 34 no SDK canónico; 10 neste repo |
| Edge Functions | 8 relacionadas com o jogo; código remoto de `deal-cards` comparado com o worktree |
| Advisors | 0 segurança; 0 desempenho |
| Atividade | 0 eventos Wisdom Duel nos logs das últimas 24 h; janela insuficiente para conclusão histórica |
| Dados | Apenas configuração e contagens agregadas; sem PII, wallets, mãos ou resultados individuais |
| Integridade | Base, migrations, Hub e SDK sem alterações; só documentação do jogo atualizada |
| Baseline de código | Não repetida porque C31 alterou apenas Markdown; permanece C30: 89 ficheiros/419 testes verdes |

### Tarefas pendentes após a sessão

1. **P0 — contenção coordenada:** desenhar gate default-off para as oito Edge Functions e uma
   alteração de catálogo com impacto/rollback explícitos; não aplicar diretamente em produção.
2. **P0 — cortar autoridade cliente de Wisdom Duel:** bloquear o uso de `card_game_set_state` e
   `playhub_finish_session` por este jogo sem romper os consumidores dos outros jogos.
3. **P0 — branch isolada:** obter confirmação de custo, criar branch, baseline recuperável e
   executar preflight/pgTAP antes de qualquer migração.
4. **P0/P1 — persistência autoritativa:** comandos, CAS/idempotência, snapshots privados,
   projeções por jogador, RNG auditável e settlement server-only.
5. **P1 — rever exposição pública:** classificar `game_sessions`, participantes e resultados;
   reduzir policies/grants apenas depois de mapear todos os consumidores do Hub.
6. **P1/P2 — hardening:** schema privado, `search_path=''`, EXECUTE mínimo e avaliação dos sete
   índices de FK com planos reais.
7. **P1 — release:** só depois, preview controlado, E2E/QA, observabilidade e canário sem GEM.
8. **Gate C:** GEM real continua proibido até auditoria externa, antifraude, reversão, jurídico e
   operação de incidentes estarem aprovados.

## Checkpoint C32 — contenção preparada e branch efémera diagnosticada

**Data:** 2026-08-28  
**Estado do ciclo:** encerrado com artefacto local validado; teste remoto bloqueado pela baseline
partilhada não reproduzível  
**Limite de segurança:** patch não aplicado e branch sem dados de produção. Nenhum merge, deploy,
DDL/DML em produção, secret, policy, grant, catálogo, Hub ou SDK partilhado foi alterado.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C32-1 | 🟢 | Concorrência mapeada | Alterações não commitadas de Swarm Hunt identificadas em `wallet` e `mythicalSDK`; preservadas integralmente |
| C32-2 | 🟢 | Patch de contenção isolado | Gate default-off preparado para as sete funções competitivas do SDK; `deal-cards` local já tem gate equivalente |
| C32-3 | 🟢 | Falha segura antes do privilégio | 503 `wisdom_duel_disabled` ocorre antes de body, env privilegiado, cliente ou `service_role` |
| C32-4 | 🟢 | Compatibilidade comprovada | Patch aplica sobre o SDK atual com `--check`, sem tocar migrações nem caminhos de Bestiary/Swarm |
| C32-5 | 🔴 P0 | Replay histórico não reproduzível | Branch falhou em `20260518153000_unify_playhub_games`: `games.slug` não existe na cadeia reconstruída |
| C32-6 | 🟢 | Branch removida | Branch sem dados eliminada após diagnóstico; custo horário interrompido; apenas `main` permanece |
| C32-7 | 🟢 | Produção preservada | 34 migrações e versões das oito funções Wisdom permanecem iguais; zero escrita desta sessão |
| C32-8 | 🟡 | Atividade concorrente observada | Swarm Hunt mudou remotamente durante a janela; nenhuma mudança foi absorvida ou revertida |
| DEPLOY-C32 | ⚪ | Publicação | Patch não aplicado ao SDK nem publicado em Supabase |

### Causa raiz comprovada

1. O utilizador confirmou o custo de US$ 0,01344/h e a branch foi criada sem dados de produção.
2. O replay parou depois de 12 migrações, em `games.slug`; produção depende de um estado
   intermédio ausente na cadeia reconstruída.
3. Os primeiros catorze ficheiros canónicos incluem placeholders e não constituem uma baseline
   schema-only independente.
4. A branch parcial chegou a criar 38 tabelas Dilema vazias sem RLS, porque o hardening posterior
   não executou; isso ocorreu apenas na branch já eliminada.
5. Acrescentar uma migração no fim não resolve o replay, pois a execução falha antes de lá chegar;
   editar migrações aplicadas também não é uma solução segura.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel | 90 ficheiros, 430 testes, 100% aprovados |
| Testes focados C32 | 3 ficheiros, 23 testes, 100% aprovados |
| Deno | 2 testes do gate e `deno check` das sete funções aprovados numa cópia limpa do SDK |
| TypeScript e lint | Aprovados; zero erros de lint |
| Patch | 10 ficheiros, 104 inserções/1 alteração; `git apply --check --unidiff-zero` aprovado |
| Base remota | Apenas `main`, saudável; 34 migrações; nenhuma branch paga restante |
| Wisdom remoto | Oito funções continuam ativas nas mesmas versões; nenhum deploy C32 |
| Base/Hub/SDK | Worktrees partilhados e `supabase/migrations` não tocados |

### Tarefas pendentes após o ciclo

1. **P0 — baseline partilhada:** responsáveis de Hub/SDK devem produzir uma baseline schema-only
   verificável e reconciliar checksums/histórico sem reescrever produção.
2. **P0 — branch verde:** criar uma nova branch apenas após a correção acima e provar replay das
   34 migrações, RLS, advisors e rollback.
3. **P0 — contenção remota:** depois de integrar o trabalho concorrente, aplicar o patch C32 revisto
   somente na branch e provar 503/OPTIONS nas oito funções com o flag ausente.
4. **P0 — RPCs do jogo:** bloquear `card_game_set_state`, leitura privada indevida e settlement
   controlado pelo host de forma específica a Wisdom Duel, sem revogar consumidores globais.
5. **P0/P1 — autoridade real:** implementar comandos, CAS/idempotência, projeções privadas, RNG
   auditável e settlement server-only antes de PvP.
6. **P1 — matriz multi-jogo:** executar pgTAP e testes de regressão de Bestiary Trails, Swarm Hunt,
   Mythic Expedition e Hub antes de qualquer merge.
7. **Release:** manter PvP/GEM **NO-GO** até branch verde, revisão conjunta, rollback, observabilidade
   e todos os requisitos dos Gates B/C.

Relatório técnico e patch: `docs/tech/WISDOM_DUEL_CONTAINMENT_C32.md` e
`docs/tech/patches/WISDOM_DUEL_CONTAINMENT_C32.patch`.

## Checkpoint C33 — contenção publicada e treino promovido a produção

**Data:** 2026-08-30

**Estado do ciclo:** Fases 0/1 concluídas para o frontend standalone e contenção runtime; Hub
publicado ainda aguarda o PR isolado; Fase 2 permanece bloqueada pela baseline partilhada

**Limite de segurança:** nenhuma migração, policy, grant, RPC, tabela, catálogo ou linha de dados da
base partilhada foi alterada. Bestiary Trails e Swarm Hunt não receberam mudanças.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C33-1 | 🟢 | Preservação recuperável | Snapshot `18c0a03`, branch backup e branch de upgrade separada; integração dividida em commits temáticos |
| C33-2 | 🟢 | SDK/runtime alinhados | Wisdom fixa `@mythicalb/sdk`, `@mythicalb/ardor-core` e `@mythicalb/ardor-provider` em `0.2.0` |
| C33-3 | 🟢 | Treino público sem identidade | Seleção, partida e resignação contra bot funcionam sem Play Hub, conta ou carteira |
| C33-4 | 🟢 | Hosting endurecido | Fallback SPA, CSP aplicada, HSTS, nosniff, referrer/permissions policy, HTML revalidável e assets com hash imutáveis |
| C33-5 | 🟢 | Contenção C32 publicada | Oito Edge Functions recusam execução competitiva por omissão antes de body/segredos/service role |
| C33-6 | 🟢 | Release standalone | Commit `2948ddd`, deploy Netlify `6a94067fb54da37c14aa8e4f`, mesmo artefacto nos dois domínios |
| C33-7 | 🟡 | Hub corrigido em PR isolado | PR `Tarasca-DAO/card-game-wallet-v2#176`, commit `11d3e9c`; 112 testes verdes, preview Vercel bloqueado por plano da conta |
| C33-8 | 🔴 P0 | Baseline DB ainda não reproduzível | 36 migrações inventariadas; reset limpo falha quando `games.slug` é usado antes de existir na cadeia |
| C33-9 | 🟡 | Escrow implementado localmente | Repo `wisdom-duel-escrow`, commit `895817a`; contrato não-upgradeable e 10 testes/invariantes verdes; falta auditoria externa |
| PERF-C33 | 🔴 | Trace CWV | Chrome DevTools MCP continua indisponível; nenhuma métrica LCP/INP/CLS foi inventada |

### Evidência de produção

1. `https://mythical-mvp.netlify.app` e `https://wisdomduel.mythicalbeings.io` servem o asset
   `assets/index-CobMpAUg.js` e apresentam o build `2948ddd`.
2. SHA-256 do HTML publicado: `568cd5e1d9f611891fbb2b1ff06160704343e56abe8ec9a62ac2b2c2e8c31cfa`.
3. SHA-256 do entry chunk: `e6eb5532788cb91d4a0036849c613a3d171f2cedadc154aa2aff95f2c384db7d`.
4. Bundles com hash devolvem `Cache-Control: public,max-age=31536000,immutable`; HTML e rotas
   SPA devolvem `max-age=0,must-revalidate`.
5. Browser real confirmou home, rota direta, refresh, seleção de três criaturas, partida local,
   tutorial e resignação: `You resigned. Bot wins.` / `GAME OVER`.
6. Viewport 390×844 confirmou CTA visível e ausência de overflow horizontal. Ativação completa por
   teclado fica como QA manual: o CTA é um `button` nativo e recebe foco, mas a automação disponível
   não sintetizou o Enter de forma fiável.
7. Smoke remoto pós-release confirmou `503` nas oito funções: `deal-cards` devolve
   `multiplayer_disabled`; as sete funções SDK devolvem `wisdom_duel_disabled`.

### Validação de fecho

| Superfície | Resultado |
|---|---|
| Testes Wisdom Duel + cobertura | 91 ficheiros, 433 testes, 100% aprovados |
| Cobertura | 86,91% statements/lines, 80,19% branches, 98,69% functions; 18/18 críticos aprovados |
| TypeScript/Deno/build | Typecheck web e Edge aprovados; Vite build aprovado |
| Lint | Zero warnings |
| Bundle | 94,48 KiB JS inicial; 69,12 KiB maior chunk; 14,86 KiB CSS inicial |
| Artefacto público | 115 ficheiros, 41 textuais; sem material privilegiado nem sourcemaps |
| Dependências | `npm audit --omit=dev --audit-level=high`: zero vulnerabilidades |
| Escrow | 8 unit/fuzz + 2 invariantes; 256 runs e 128.000 calls por invariante; zero falhas/reverts |
| Hub main isolado | 25 ficheiros/112 testes verdes; só cartão Wisdom e teste alterados no PR #176 |
| Base partilhada | Zero DDL/DML/repair/push; catálogo, grants, policies e RPCs inalterados |

### Estado das fases

1. **Fase 0 — concluída no runtime:** oito funções default-off em produção. A alteração de catálogo
   continua adiada para uma janela coordenada; o bloqueio server-side impede operação privilegiada.
2. **Fase 1 — concluída no standalone:** ambos os domínios executam o novo treino. O cartão publicado
   do Hub ainda usa a cópia antiga `Live/GEM`; o href canónico está correto e o PR #176 contém a
   correção mínima.
3. **Fase 2 — bloqueada corretamente:** não executar `migration repair`, `db push` ou nova branch até
   existir baseline schema-only, ensaio isolado e janela exclusiva dos três jogos.
4. **Fase 3 — protótipo local apenas:** executor, CAS/idempotência, replay, HTTP e projeções têm testes;
   não existe ainda persistência/Edge Function Postgres autorizada para produção.
5. **Fase 4 — implementação local:** contrato e invariantes existem; testnet, Safe/HSM, auditoria
   externa, retest e reconciliador continuam obrigatórios.
6. **Fase 5 — NO-GO:** beta GEM não abre antes dos gates DB, contrato, jurídico, allowlist e operação.

### Tarefas pendentes prioritárias

1. Rever e integrar o PR Hub #176; resolver o bloqueio Vercel de organização privada e validar em
   guest e sessão real que `Start Training` abre o domínio canónico.
2. Executar QA manual de teclado, leitor de ecrã, contraste/áudio e trace Lighthouse/CWV com Chrome
   DevTools MCP configurado.
3. Convocar janela exclusiva DB com os donos de Wisdom, Bestiary Trails e Swarm Hunt; recolher dump
   schema-only, ledger, grants/policies/checksums e ensaiar baseline + diff zero fora de produção.
4. Só depois do gate anterior, criar migrações forward-only do schema privado/projeções e a matriz
   pgTAP multi-ator/multi-jogo; não tocar no schema `realtime`.
5. Materializar a Edge Function autoritativa, timeout de 120 s, 20 auto-passes, load test de 50
   partidas e canário allowlisted sem GEM.
6. Publicar o escrow em testnet apenas após definir tokens/chain/Safe/signer; contratar auditoria
   independente e fechar retest antes de qualquer mainnet.
7. Concluir parecer jurídico, allowlist, retenção, monitorização financeira e runbooks antes da beta
   mainnet fechada.

## Checkpoint C34 — Hub integrado e baseline ensaiada localmente

**Data:** 2026-08-31

**Estado do ciclo:** PR mínimo do Hub integrado; deploy canónico do Hub bloqueado externamente;
reconstrução DB local repetível com paridade de inventário; produção preservada

**Limite de segurança:** nenhum `db push`, `migration repair`, branch Supabase, DDL/DML remoto,
config push, alteração de catálogo ou exposição de dados de jogadores. As stacks locais de
Bestiary Trails e Galeguia não foram reutilizadas, resetadas ou paradas.

### Entregas

| Código | Estado | Entrega | Evidência/nota |
|---|---|---|---|
| C34-1 | 🟢 | Hub validado em instalação limpa | `npm ci`: 914 pacotes; 25 ficheiros/112 testes; build Vite completo |
| C34-2 | 🟢 | Cartão Wisdom integrado | PR `card-game-wallet-v2#176` merged em `main`; commit `30acbfe` |
| C34-3 | 🟡 | Hub canónico aguarda deploy | Produção ainda mostra `Live/GEM`; conta local não tem acesso ao scope Vercel `mythicalbeings` |
| C34-4 | 🟢 | Smoke local do Hub | Guest → Play Hub; Battlegrounds/Elyxir preservados; Wisdom `Preview`/`Start Training`; zero erros de consola |
| C34-5 | 🟢 | Contenção C32 integrada | PR SDK `#26` merged em `main`, commit `feb06ca`; Deno 2/2 e typecheck das sete funções verdes |
| C34-6 | 🟢 | Ledger isolado da contenção | Branch `chore/shared-db-ledger-recovery-20260831`, commits `415d9cd` e `8ec1bcd` |
| C34-7 | 🟢 | Rehearsal DB reproduzível | Snapshot fixado por SHA-256 + 24 migrações posteriores + ACL explícito; start e reset limpo aprovados |
| C34-8 | 🟢 | Paridade de inventário atual | 769 colunas, 349 constraints, 70 funções, 182 índices, 115 policies, 37 triggers, 2 views e grants iguais |
| C34-9 | 🟡 | Diff integral condicionado | Dump schema-only/definições completas requer autorização específica; não foi contornado |
| C34-10 | 🟡 | Dívida de dependências do Hub | Instalação reporta 17 vulnerabilidades totais, 9 high; PR não altera lockfile; audit production-only ficou sem resposta de rede |

### Evidência do Hub

1. O diff integrado altera somente `src/components/Pages/PlayHubPage/data.js` e o respetivo teste.
2. O build local mostra Wisdom como treino solo, sem conta/carteira e com PvP/GEM indisponíveis;
   o link aponta para `https://wisdomduel.mythicalbeings.io`.
3. Battlegrounds mantém `Live / Enter Battlegrounds` e Elyxir mantém `Live / Enter Elyxir`.
4. O Vercel check falha por `github-private-org-to-hobby`, não por teste ou build.
5. `palheiro1` está autenticado na CLI, mas os scopes acessíveis são pessoais/`ssdfsd`; o scope
   `mythicalbeings` não está disponível. Nenhum projeto alternativo, link ou DNS foi criado.

### Evidência da baseline isolada

1. O primeiro ensaio aplicou o snapshot e provou a falta de DML: Bestiary Trails V3 rejeitou
   `game_modes.game_id='mythic_expedition'` porque o catálogo não tinha sido reposto.
2. O segundo ensaio aplicou o snapshot como `202605050000`, seguido pelas 24 migrações autênticas
   `202605050001`–`20260829084636`; todas foram aplicadas.
3. Um ACL idempotente removeu seis privilégios herdados localmente de
   `card_game_session_state`, deixando apenas o `SELECT` autenticado existente em produção.
4. `supabase db reset --local` repetiu a reconstrução desde zero e terminou sem erro.
5. A consulta live foi apenas de catálogo agregado. Não leu perfis, wallets, mãos, partidas,
   resultados ou qualquer PII.
6. `npm run migrations:baseline-rehearsal` gera a candidata numa diretoria temporária, valida o
   snapshot `ac762b262855ab7c36e52973296605fe904afac0c04165524a454b1719db706f` e nunca contacta produção.
7. A stack temporária Wisdom foi parada no fecho e o seu volume local ficou recuperável. As stacks
   `mundo-aberto-bestiary` e `Galeguia` continuaram ativas e saudáveis.

### Estado dos gates

1. **Fase 1:** frontend standalone concluído; código do Hub integrado; publicação do Hub pendente
   de acesso/upgrade Vercel e smoke publicado.
2. **Fase 2:** o bloqueio baixou de “cadeia desconhecida” para “candidata local com paridade de
   inventário”. Continua **NO-GO** para produção até dump fresco, diff de definições, pgTAP,
   testes multi-jogo e janela exclusiva.
3. **Fase 3:** nenhuma migração autoritativa foi criada/aplicada; PvP continua default-off.
4. **Fases 4/5:** sem alteração; escrow continua local e beta GEM continua **NO-GO**.

### Tarefas pendentes prioritárias

1. Obter acesso ao scope Vercel `mythicalbeings` ou corrigir o plano/integration check; publicar o
   commit `30acbfe` e repetir guest + sessão autenticada no Hub canónico.
2. Manter `WISDOM_DUEL_PVP_ENABLED` ausente/false e incluir o smoke 503 nas verificações de release.
3. Autorizar explicitamente o dump schema-only e a comparação de definições; fazer backup do ledger,
   funções, grants e policies sem dados de produção.
4. Rever localmente a branch do ledger; abrir draft PR só depois de autorização específica para
   publicar os artefactos de schema/inventário.
5. Executar pgTAP e smokes Bestiary Trails/Swarm Hunt na candidata; adicionar lint, type generation
   e diff de schema ao CI antes de qualquer `migration repair`.
6. Classificar e corrigir as vulnerabilidades do Hub num PR de dependências separado do cartão.
7. Só após o gate DB, materializar a persistência autoritativa e iniciar o canário PvP sem GEM.
