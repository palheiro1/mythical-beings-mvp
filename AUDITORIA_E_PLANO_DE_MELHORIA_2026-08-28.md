# Auditoria integral e plano de melhoria — Wisdom Duel

**Data:** 28 de agosto de 2026  
**Âmbito:** aplicação pública, integração no Play Hub, experiência desktop/mobile, acessibilidade, desempenho, segurança, integridade do jogo, Supabase, qualidade, operação e produto.  
**Ambientes observados:**

- `https://mythical-mvp.netlify.app/`
- `https://wisdomduel.mythicalbeings.io/`
- percurso de entrada em `https://my.mythicalbeings.io/home`
- código-fonte local do projeto `mythical-beings-mvp`

> **Atualização de encerramento:** depois da auditoria inicial foram concluídos 30 checkpoints
> locais. Os números históricos da secção 14 representam o ponto de partida; o estado final e
> as tarefas ainda abertas estão consolidados na secção 15. Nada foi publicado nem escrito na
> base partilhada.

## 1. Veredito executivo

O Wisdom Duel já é uma **boa demonstração de treino**: tem identidade visual coerente, funciona sem overflow nos ecrãs móveis observados, separa razoavelmente a lógica do jogo da interface, usa carregamento diferido das rotas e dispõe de uma base de testes relevante. O bloqueio de PvP na versão pública atual é uma decisão correta.

Contudo, o produto **não está pronto para PvP competitivo nem para apostas/recompensas em GEM**. O estado decisivo da partida é atualmente validado e reduzido no navegador, enviado por inteiro para a base de dados e inclui informação secreta dos dois jogadores. Um participante tecnicamente capaz consegue contornar a interface, fabricar estados, conhecer a mão adversária e provocar conflitos de escrita. Enquanto isto não for substituído por autoridade no servidor, qualquer ranking, prémio ou stake seria vulnerável.

Há também uma contradição importante no funil: o Play Hub anuncia sessões casuais e com GEM e permite “Continue as Guest”, mas o destino apresenta apenas treino e volta a exigir identidade do Play Hub e carteira Polygon. Isto prejudica confiança e conversão.

### Decisão por modo

| Modo | Estado recomendado | Condição |
|---|---|---|
| Treino contra bot | **Pode continuar público**, com correções rápidas | Corrigir promessa do funil, imagem em falta, acessibilidade essencial, headers e dependência vulnerável |
| PvP sem stake | **NO-GO** | Só abrir após estado autoritativo no servidor, informação privada por jogador, concorrência controlada e reconexão testada |
| PvP com GEM | **NO-GO estrito** | Além do anterior: settlement totalmente autoritativo, aleatoriedade auditável, idempotência, revisão de segurança e plano de reversão |

### Nível de risco por área

| Área | Estado | Razão principal |
|---|---|---|
| Apresentação visual | Bom | Coerência forte e boa adaptação geral a mobile |
| Onboarding/conversão | Fraco | Treino local bloqueado por login + wallet; percurso Guest termina num novo bloqueio |
| Acessibilidade | Insuficiente | Modal não gere foco; falta anúncio do estado do jogo; alvos pequenos; movimento sem preferência reduzida |
| Desempenho | Insuficiente | Bundle principal grande, imagens JPG muito pesadas, galeria carrega tudo, cache ineficaz |
| SEO/partilha/PWA | Fraco | Metadados mínimos, sem manifest/robots reais, rotas inexistentes respondem 200 |
| Segurança frontend | Médio | Segredo de serviço não está no cliente, mas há logs excessivos e uma dependência de produção vulnerável |
| Integridade do jogo/PvP | Crítico | Estado e resultado controláveis pelo cliente; segredos do adversário expostos |
| Base de dados/RLS | Alto | View pública exposta, migrações não reproduzíveis e ausência de testes de políticas |
| Testes/CI | Médio | 215 testes passam, mas faltam E2E, testes de DB/RLS, cobertura mínima e quality gates de warnings |
| Operação/observabilidade | Fraco | Sem medição real de Core Web Vitals, tracking de erros ou versão de build visível |

## 2. Metodologia e limites

A auditoria combinou:

- navegação real dos dois domínios do jogo, em desktop e viewport móvel;
- percurso Guest do Play Hub até à abertura do Wisdom Duel;
- inspeção da árvore acessível, foco, modal, landmarks, headings, nomes acessíveis e overflow;
- inspeção de respostas HTTP, cache, redirecionamentos, fallback de SPA e ficheiros públicos;
- análise do bundle produzido, peso de assets e estratégia de carregamento;
- revisão do frontend, motor do jogo, sincronização PvP, Edge Function, migrações e RLS;
- execução local de lint, testes, build e auditoria de dependências.

Limites:

- não havia integração com Chrome DevTools/Lighthouse disponível neste ambiente; por isso **não são inventados scores Lighthouse nem valores de LCP/INP/CLS**;
- os tempos HTTP registados são uma amostra sintética a partir do ambiente de auditoria, não representam utilizadores reais;
- não foi realizada uma partida PvP de produção, porque a funcionalidade está desativada e não seria apropriado contornar esse bloqueio;
- a auditoria não é um pentest independente nem substitui revisão jurídica de pagamentos, privacidade ou ativos digitais.

## 3. O que já está bem

1. **Identidade visual reconhecível.** Paleta, tipografia, molduras, botões e ilustrações constroem uma atmosfera consistente.
2. **Resposta mobile aceitável.** A landing e o guia não apresentaram overflow horizontal nas dimensões observadas; a navegação móvel mantém nomes acessíveis.
3. **Feature flag prudente.** O PvP está indisponível no deployment atual e a aplicação comunica “Training Preview”. Isto reduz o impacto imediato das falhas de integridade competitiva.
4. **Base de engenharia razoável.** Rotas são divididas em chunks, lógica do jogo está relativamente separada da apresentação e existem 215 testes unitários/de componentes.
5. **Higiene básica de segredos.** A chave `service_role` está limitada a código de servidor/scripts; `.env.local` está ignorado pelo Git.
6. **Validações úteis na Edge Function.** JWT, anfitrião, número de participantes e ownership da wallet são verificados antes de operações competitivas.
7. **Transporte seguro.** Os domínios usam HTTPS e HSTS; o alias Netlify aponta canonicamente para o domínio próprio através de header.

## 4. Achados prioritários

### P0 — bloqueadores de PvP/GEM

#### P0.1 — O cliente pode fabricar o estado completo da partida

**Evidência:** `useGameActions` aplica as regras no browser e chama `card_game_set_state(session_id, p_state)` com o `GameState` inteiro. A função `SECURITY DEFINER` confirma apenas que o utilizador participa e que a sessão está em jogo; depois substitui o JSON completo.

**Impacto:** um participante pode chamar a função diretamente com vida, poder, mão, deck, turno ou vencedor adulterados. O anfitrião também reporta o fim e o resultado com base nesse estado. É crítico para rankings e inaceitável para GEM.

**Correção:** trocar “cliente envia novo estado” por “cliente envia uma ação/intenção”. Exemplo: `play_card`, `draw`, `attack`, `end_turn`, cada uma com `session_id`, `expected_version`, `action_id` e parâmetros mínimos. Uma transação no servidor deve:

1. bloquear/ler a sessão atual;
2. confirmar participante, turno, fase e recursos;
3. aplicar o reducer autoritativo;
4. incrementar `state_version`;
5. gravar evento e estado;
6. devolver apenas a projeção permitida ao jogador.

**Aceitação:** alterar manualmente o payload nunca permite jogada ilegal; ações repetidas com o mesmo `action_id` são idempotentes; duas ações sobre a mesma versão produzem uma vitória e um conflito explícito, nunca last-write-wins.

#### P0.2 — Mãos e deck secretos são visíveis aos dois participantes

**Evidência:** o `GameState` persistido e emitido por Realtime inclui as mãos de ambos e a ordem do deck. Os participantes conseguem ler o estado integral.

**Impacto:** qualquer adversário pode conhecer cartas ocultas e próximas compras, tornando o jogo competitivamente inválido.

**Correção:** guardar o estado completo numa área não selecionável pelo cliente e expor projeções distintas:

- jogador A: mão A completa, contagem da mão B;
- jogador B: mão B completa, contagem da mão A;
- espectador: apenas informação pública;
- servidor: estado integral.

O canal Realtime deve publicar eventos públicos ou projeções autorizadas, nunca a linha privada completa.

**Aceitação:** testes com JWT de A, B, espectador e anon provam que nenhum recebe a mão rival, ordem do deck, seed secreta ou dados internos.

#### P0.3 — Resultado e settlement derivam de estado controlado pelo cliente

**Evidência:** o cliente anfitrião reporta o fim da partida; o vencedor deriva do estado que o próprio cliente consegue substituir.

**Impacto:** criação de resultados falsos, duplicação/reversão de prémios e disputa de stakes.

**Correção:** o servidor declara o resultado como consequência da última ação válida, encerra a sessão e cria um registo de settlement imutável na mesma transação lógica. O cliente apenas observa o resultado.

**Aceitação:** não existe endpoint/RPC público que aceite `winner`, `result`, `reward` ou estado final arbitrário; reexecuções não pagam duas vezes; falhas parciais são retomáveis.

#### P0.4 — Concorrência, turnos e timeout não são autoritativos

**Evidência:** não existe versão/CAS do estado; o timeout vive num intervalo do browser; `END_TURN` pode passar durante uma ação em voo.

**Impacto:** ações perdidas, duplo turno, estados divergentes, vantagem ao fechar/suspender o separador e partidas presas.

**Correção:** `state_version`, lock transacional, `turn_deadline_at` calculado no servidor, job/cron para expirar turnos e protocolo de reconexão por snapshot + eventos posteriores.

**Aceitação:** testes de concorrência e rede lenta demonstram ordem única; suspender o browser não suspende o relógio; reconectar recupera exatamente o estado oficial.

#### P0.5 — Aleatoriedade e deal não são adequados a stakes

**Evidência:** embaralhamento usa `Math.random`; a Edge Function usa `sort(() => Math.random() - 0.5)`, que é enviesado; invocações simultâneas podem ler “não distribuído” e gravar distribuições distintas.

**Impacto:** resultados não auditáveis, viés e race conditions.

**Correção:** Fisher–Yates com fonte criptográfica no servidor; operação de deal atómica/idempotente. Para stakes relevantes, usar seed commit–reveal ou mecanismo verificável adequado ao modelo de ameaça, guardando prova para auditoria.

**Aceitação:** uma sessão só pode ser distribuída uma vez; distribuição é reproduzível a partir da prova autorizada; testes estatísticos básicos e de concorrência passam.

### P1 — corrigir antes de promover o treino

#### P1.1 — Promessa do Play Hub contradiz o produto entregue

**Evidência:** o cartão do Play Hub anuncia sessões casuais e com GEM e está marcado “Live”; o jogo de destino diz “Training Preview” e desativa PvP/GEM.

**Impacto:** quebra de confiança, suporte desnecessário e risco reputacional.

**Correção imediata:** alterar o cartão para “Training preview — play against the bot. PvP and GEM sessions coming later” e trocar o estado por “Preview”/“Beta”. Não mencionar stakes até existirem gates de segurança aprovados.

**Aceitação:** a mesma capacidade é descrita na landing, no cartão, no lobby e em qualquer campanha.

#### P1.2 — “Continue as Guest” conduz a um beco sem saída

**Evidência:** o Guest entra no Play Hub e pode abrir Wisdom Duel, mas o destino volta a exigir Play Hub identity e carteira Polygon.

**Impacto:** abandono precisamente no momento de maior intenção.

**Correção recomendada:** tornar o treino contra bot verdadeiramente público/local. Login deve ser opcional para guardar progresso/telemetria; wallet só deve ser pedida no momento em que uma função on-chain realmente a exija.

**Aceitação:** um visitante novo inicia a primeira partida de treino em até dois cliques, sem conta e sem extensão de wallet; o upgrade para conta preserva progresso quando possível.

#### P1.3 — Imagem de Lafaic está partida

**Evidência:** `/images/beings/lafaic.jpg` não existe. O fallback de SPA responde com HTML 200 e o browser mostra uma carta sem imagem.

**Correção:** adicionar o asset correto ou corrigir o caminho/case; incluir um teste de integridade que percorra todas as referências de imagens e falhe se o ficheiro não existir.

**Aceitação:** todas as 30 cartas do guia carregam imagem válida e `naturalWidth > 0` no E2E.

#### P1.4 — Dependência React Router com vulnerabilidade alta

**Evidência:** a auditoria de produção assinala `react-router-dom 7.18.1`; existe correção compatível em `7.18.2`.

**Correção:** atualizar, executar suite/build e bloquear vulnerabilidades high/critical de produção no CI, com processo explícito de exceção temporária.

**Aceitação:** `npm audit --omit=dev --audit-level=high` passa.

#### P1.5 — Modal de detalhe não cumpre o padrão de diálogo

**Evidência observada:** tem `role="dialog"` e `aria-modal`, mas o foco permanece no conteúdo de fundo, não fica contido, o fundo continua operável/scrollável e ao fechar o foco vai para `body`, não para o botão invocador.

**Impacto:** utilizadores de teclado e leitores de ecrã perdem contexto.

**Correção:** mover foco para título/primeiro controlo ao abrir; aplicar focus trap; tornar fundo `inert`; bloquear scroll; fechar com Escape; devolver foco ao invocador; manter nome e descrição acessíveis.

**Aceitação:** testes automatizados e manuais cobrem Tab/Shift+Tab/Escape/reabertura e retorno de foco conforme o padrão de diálogo modal da W3C.

#### P1.6 — Cache dos assets versionados está desativado na prática

**Evidência:** HTML, JS/CSS com hash, imagens e PDF respondem `cache-control: public,max-age=0,must-revalidate`.

**Impacto:** cada visita revalida ficheiros imutáveis, aumentando latência e tráfego.

**Correção Netlify:**

- `/assets/*`: `public, max-age=31536000, immutable`;
- imagens versionadas: cache longo; se os nomes não tiverem hash, versioná-los;
- HTML: `no-cache` ou revalidação curta;
- PDF: nome/versionamento e cache coerente.

**Aceitação:** uma segunda navegação reutiliza assets versionados sem revalidação; novos deploys continuam a atualizar o HTML.

#### P1.7 — Headers defensivos em falta

**Evidência:** HSTS está presente; não foram observados CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` nem controlo explícito de framing.

**Correção:** configurar headers em `public/_headers` ou `netlify.toml`. Começar CSP em report-only, inventariar Supabase/auth/assets e depois aplicar. Usar `frame-ancestors` conforme a decisão de integração com Play Hub, `nosniff`, política de referrer e permissões mínimas.

**Aceitação:** scanner de headers no CI passa e login, wallet, Realtime e integração autorizada continuam funcionais.

#### P1.8 — Migrações não reproduzem o backend real

**Evidência:** a sequência versionada mistura um modelo `games` legado com colunas/tabelas que não foram criadas antes; contém criação duplicada de uma policy no mesmo bloco; há migração vazia; a aplicação chama uma função pública cuja definição não existe no repositório. A produção, portanto, está à frente ou divergente.

**Impacto:** recuperação, staging e deploy de base de dados deixam de ser determinísticos; correções de segurança podem não chegar a todos os ambientes.

**Correção:** fazer inventário do schema remoto, reconciliar com uma baseline canónica, corrigir migrações e provar `db reset` de zero num ambiente limpo. Não editar história já aplicada sem estratégia; criar migrações de reparação explícitas.

**Aceitação:** uma base vazia chega ao schema esperado só com ficheiros versionados; `supabase db lint` e testes SQL passam no CI.

#### P1.9 — View pública pode contornar RLS

**Evidência:** `available_active_games` foi criada em `public` sem `security_invoker`; uma chamada REST anónima em produção devolveu HTTP 200. Estava vazia no momento da verificação, mas poderá expor IDs de jogo/jogadores e valores quando houver sessões.

**Correção:** decidir se a listagem deve ser pública. Se sim, expor apenas uma projeção mínima e não identificável; se não, revogar acesso. Usar `security_invoker=true` em Postgres compatível ou mover a origem para schema privado/RPC segura. Auditar grants de todas as views e funções.

**Aceitação:** matriz anon/auth/A/B/admin demonstra exatamente os campos permitidos e nega todos os restantes.

### P2 — qualidade estrutural e experiência

#### P2.1 — Bundle inicial demasiado grande

**Evidência:** build local produz JS principal de cerca de **789 KB raw / 233 KB gzip**, acima do aviso de 500 KB do Vite; CSS cerca de **89 KB raw / 14 KB gzip**.

**Correção:** analisar o bundle; separar SDKs de auth/wallet/Supabase por rota; importar ícones individualmente; remover código/debug não usado; garantir que treino público não descarrega dependências competitivas antes de serem necessárias.

**Aceitação inicial:** chunk principal abaixo de 170 KB gzip e orçamento por rota no CI; objetivo final definido com dados reais e não apenas pelo número arbitrário do bundler.

#### P2.2 — Galeria de regras transfere dezenas de megabytes

**Evidência:** 15 creatures + 15 knowledge cards são renderizadas de uma vez, sem `loading="lazy"`. Os JPG individuais observados rondam 1,25–1,78 MB; as pastas de beings e spells totalizam aproximadamente **42 MB**. Só três cartas decorativas da landing somam cerca de 4,2 MB em JPG.

**Correção:** gerar AVIF/WebP e fallback; thumbnails de tamanho apropriado; `srcset`/`sizes`; lazy loading; `width`/`height`; virtualizar/paginar a galeria se necessário; não descarregar imagens ocultas por breakpoint.

**Aceitação:** landing móvel e primeiro ecrã do guia cumprem orçamento acordado; imagens fora do viewport não são pedidas antes do scroll; nenhuma imagem de carta excede o tamanho necessário à sua renderização.

#### P2.3 — Fallback SPA mascara erros como sucesso

**Evidência:** asset inexistente, rota arbitrária, `robots.txt` e `manifest.webmanifest` devolvem o `index.html` com HTTP 200.

**Impacto:** monitorização não deteta 404, crawlers indexam páginas falsas e bugs de assets ficam silenciosos.

**Correção:** criar regras anteriores ao fallback para `/assets/*`, `/images/*` e extensões estáticas devolverem 404; adicionar uma rota Not Found real; fornecer `robots.txt`/manifest válidos ou devolver 404 explícito.

**Aceitação:** URL de asset inexistente e rota inexistente devolvem 404; rotas SPA válidas continuam a funcionar em refresh direto.

#### P2.4 — Estado do jogo não é anunciado a leitores de ecrã

**Evidência:** alterações de turno, compras, efeitos e resultado são sobretudo visuais; não foi identificado um `aria-live`/`role=status` adequado.

**Correção:** criar um announcer conciso para turno, ação adversária, dano, compra, timer crítico e resultado; evitar anunciar logs completos; permitir consultar histórico textual.

**Aceitação:** uma partida de treino pode ser acompanhada por leitor de ecrã sem depender de cor, animação ou posição.

#### P2.5 — Movimento não respeita preferência reduzida

**Evidência:** não há tratamento `prefers-reduced-motion` para as animações observadas.

**Correção:** reduzir/desativar transições não essenciais, parallax, pulsos e deslocações; manter feedback funcional instantâneo.

**Aceitação:** com Reduce Motion ativo não existem animações longas/repetitivas e nenhuma informação se perde.

#### P2.6 — Elementos interativos aninhados e alvos pequenos

**Evidência:** existem links que envolvem botões no Sign In e no rulebook, produzindo controlos interativos aninhados. Alguns controlos móveis medem 28×28 ou 32×36 px.

**Correção:** renderizar cada ação como um único `a` ou `button`; aumentar áreas de toque para cerca de 44×44 px quando possível, mantendo pelo menos o mínimo WCAG 2.2 de 24×24 px ou espaçamento equivalente.

**Aceitação:** HTML sem interactive-in-interactive; navegação por teclado previsível; todos os controlos importantes confortáveis no toque.

#### P2.7 — Guia extenso, mas não ensina a primeira partida

**Evidência:** a página móvel observada tem cerca de 7.144 px de altura e funciona sobretudo como catálogo de regras/cartas. Há terminologia e inglês inconsistentes: `aeric/aerial`, `inmediately`, `Spells of Allies`, `Knowledge/Knowledges`, `Rival/Opponent`.

**Correção:** acrescentar tutorial em 4–6 passos, primeira partida guiada, glossário e ajuda contextual; pesquisar/filtrar cartas; normalizar terminologia e fazer revisão editorial por falante nativo.

**Aceitação:** teste com novos jogadores mede conclusão do primeiro turno sem ajuda externa e compreensão das três ações nucleares.

#### P2.8 — Timer do treino expira sem consequência

**Evidência:** o contador de seleção chega a zero e comunica expiração, mas a ação continua disponível.

**Correção:** no treino, remover o timer ou explicar que é apenas indicador; se fizer parte das regras, aplicar escolha automática/penalização de forma consistente.

**Aceitação:** texto, comportamento e regra são sempre equivalentes.

#### P2.9 — Logs de produção expõem demasiado estado

**Evidência:** o motor e os hooks escrevem estados, identificadores, mãos e transições extensas na consola. O componente visual de debug é condicionado, mas os logs não.

**Impacto:** ruído, possível fuga de informação, custo no main thread e suporte mais difícil.

**Correção:** logger estruturado por ambiente; remover dados secretos; sampling e redaction; guardar apenas IDs de correlação e eventos necessários.

**Aceitação:** build de produção não imprime mãos, tokens, wallets completas ou estado integral; erros têm correlation ID pesquisável.

#### P2.10 — Sem observabilidade operacional real

**Evidência:** existe código de performance aparentemente não montado, mas não há error tracking global, RUM/Core Web Vitals ou build SHA visível. O footer do Play Hub observado mostra `Build:` sem valor.

**Correção:** Error Boundary global; captura de exceções com source maps protegidos; `web-vitals` com consentimento/privacidade; versão/SHA/ambiente no suporte; health checks de imagens, auth, RPC e Realtime.

**Aceitação:** uma exceção simulada e uma falha de RPC aparecem com versão, rota e correlation ID; dashboard mostra p75 de LCP/INP/CLS por dispositivo.

### P3 — maturidade, conteúdo e manutenção

#### P3.1 — Metadados e descoberta incompletos

**Evidência:** `index.html` tem title, viewport e favicon, mas não description, Open Graph, Twitter Card, canonical no domínio principal nem manifest. A home também não usa landmark `<main>`.

**Correção:** metadata completa e consistente, imagem social otimizada, canonical próprio, robots/sitemap adequados, manifest apenas se houver intenção PWA, `<main>` na landing e titles/descriptions por rota.

#### P3.2 — Documentação e runtime divergentes

**Evidência:** README usa clone placeholder, anuncia Node 20+ e comandos/ficheiros que não estão presentes; CI usa Node 20; pacote está em `0.0.0`; o repositório declara MIT mas não contém `LICENSE`. As versões atuais de Supabase deixaram de suportar Node 20 em junho de 2026.

**Correção:** adotar Node 22 ou 24 LTS e `engines`, atualizar CI/README, validar todos os comandos, versionar releases, adicionar licença correta após confirmação do titular.

#### P3.3 — Dívida estática não bloqueia integração

**Evidência:** lint passa com **117 warnings**, incluindo dependências de hooks e expressões complexas; o CI não impõe máximo.

**Correção:** corrigir primeiro warnings de hooks e concorrência; estabelecer baseline decrescente e depois `--max-warnings=0`.

#### P3.4 — Testes não cobrem os riscos principais

**Evidência:** passam 47 ficheiros/215 testes, mas não há E2E de browser, testes SQL/RLS, reset do schema, concorrência, reconexão, acessibilidade de fluxos ou coverage gate. A suite também produz muito output de consola.

**Correção:** pirâmide de testes descrita na secção 8 e silenciar logs esperados.

#### P3.5 — Privacidade, termos e contexto de wallet

**Evidência:** a aplicação pede Google/email e carteira, mas não apresenta links claros para privacidade/termos nem explica por que razão a wallet é necessária num treino local.

**Correção:** remover wallet do treino; fornecer informação just-in-time, política de privacidade, termos e retenção; rever juridicamente qualquer mecânica com ativos digitais antes do lançamento.

## 5. Desempenho: baseline e orçamento

### Dados medidos nesta auditoria

Build local:

| Recurso | Tamanho raw | Gzip aproximado |
|---|---:|---:|
| JS principal | 788,70 KB | 233,15 KB |
| CSS principal | 89,49 KB | 14,48 KB |

Amostra HTTP do domínio próprio, numa única execução:

| Pedido | TTFB | Tempo total | Transferência |
|---|---:|---:|---:|
| HTML | ~0,504 s | — | 635 B |
| JS principal comprimido | ~0,474 s | ~0,787 s | 222.540 B |
| CSS comprimido | ~0,497 s | ~0,536 s | 12.886 B |
| Imagem Adaro | ~0,480 s | ~1,663 s | 1.780.518 B |

Estes números ajudam a localizar custos, mas não são Core Web Vitals. Os objetivos de produto devem seguir a recomendação de p75, separada entre mobile e desktop:

- LCP ≤ 2,5 s;
- INP ≤ 200 ms;
- CLS ≤ 0,1.

### Orçamentos propostos

| Métrica | Gate inicial | Gate maduro |
|---|---:|---:|
| JS inicial gzip, landing | ≤ 170 KB | ≤ 130 KB |
| CSS inicial gzip | ≤ 20 KB | ≤ 15 KB |
| Imagem hero/decorativa mobile | ≤ 150 KB/unidade | ≤ 100 KB/unidade |
| Transferência inicial mobile | ≤ 1,2 MB | ≤ 800 KB |
| LCP/INP/CLS | “good” em ≥75% | “good” em ≥90% dos utilizadores elegíveis |

Instrumentação necessária:

1. Lighthouse CI como controlo sintético, com mobile throttling estável;
2. RUM com `web-vitals`, versão do build, rota e classe de dispositivo;
3. alertas por regressão, não apenas valores absolutos;
4. profiling de uma partida completa para detetar renders/efeitos caros.

## 6. Segurança e Supabase: desenho-alvo

### Arquitetura recomendada

```text
Cliente
  └─ envia ação mínima + action_id + expected_version
       └─ função/RPC autoritativa
            ├─ autentica e autoriza jogador
            ├─ bloqueia sessão e valida turno/fase
            ├─ aplica reducer único no servidor
            ├─ grava evento append-only
            ├─ atualiza snapshot + versão + deadline
            ├─ encerra/settle se necessário
            └─ publica projeções redigidas A/B/espectador
```

### Modelo de dados sugerido

- `game_sessions`: estado público, fase, versão, jogadores, deadline, resultado oficial;
- `game_private_state`: estado integral num schema privado, sem grants ao cliente;
- `game_actions`: log append-only com `action_id` único, versão anterior/nova, ator, tipo, payload validado e timestamp do servidor;
- `game_player_views` ou RPCs: projeções redigidas por `auth.uid()`;
- `game_settlements`: máquina de estados idempotente (`pending`, `submitted`, `confirmed`, `failed`, `reversed`), sem valores fornecidos pelo cliente;
- `game_audit`: provas de seed/deal e eventos relevantes, com retenção definida.

### Hardening adicional

- fixar versão exata/intervalo controlado das dependências da Edge Function;
- CORS apenas para origens necessárias, sem `*` quando há credenciais/ações sensíveis;
- limites de body e rate limit por utilizador/sessão/IP conforme risco;
- `SECURITY DEFINER` com `search_path` seguro/vazio, nomes totalmente qualificados e grants mínimos;
- revogar `EXECUTE` público por defeito e conceder apenas a roles necessárias;
- policies sempre com `USING` e `WITH CHECK` coerentes;
- schemas privados para tabelas internas; Data API apenas para superfícies deliberadas;
- rotação e inventário de segredos, logs com redaction e alertas de abuso.

## 7. Acessibilidade e UX: checklist de aceitação

### Navegação e semântica

- um único `<main>` por página e hierarquia H1–H3 lógica;
- skip link visível ao foco;
- links e botões nunca aninhados;
- estado atual da navegação comunicado;
- foco visível com contraste adequado;
- todos os fluxos concluíveis só com teclado.

### Jogo

- cada carta comunica nome, tipo, estado, custo/efeito e disponibilidade;
- seleção não depende apenas de cor/brilho;
- ações inválidas explicam a razão;
- histórico textual consultável;
- turno, efeitos, timer e resultado anunciados com `aria-live` sem verbosidade excessiva;
- drag-and-drop, se existir, tem alternativa por botão/teclado;
- zoom até 200% e reflow sem perda funcional.

### Movimento e modal

- `prefers-reduced-motion` respeitado;
- modal com foco inicial, trap, fundo inert, Escape, scroll lock e retorno ao invocador;
- alvos essenciais próximos de 44×44 px; mínimo WCAG preservado;
- teste manual com VoiceOver/NVDA/TalkBack em pelo menos uma partida.

## 8. Estratégia de testes e CI

### Pipeline por pull request

1. instalação determinística em Node 22/24;
2. typecheck explícito;
3. lint com baseline de warnings decrescente;
4. 215+ testes unitários/de componentes;
5. build e budget de bundle/assets;
6. `npm audit --omit=dev --audit-level=high`;
7. arranque de Supabase local, `db reset`, lint SQL e testes pgTAP/RLS;
8. E2E smoke desktop/mobile;
9. axe em landing, login, guia, modal, seleção e jogo;
10. Lighthouse CI e verificação de links/assets/headers.

### Casos E2E mínimos

- Guest abre treino sem conta/wallet, escolhe deck e termina uma partida;
- refresh/reentrada recupera ou explica claramente o estado;
- imagem de todas as cartas responde com MIME de imagem e dimensão válida;
- modal gere corretamente foco e Escape;
- rota/asset inexistente devolve 404;
- login email/Google e link de wallet cobrem sucesso, cancelamento e erro;
- jogador A nunca observa mão/deck privado de B;
- ação fora de turno/duplicada/na versão antiga é recusada;
- duas ações concorrentes não corrompem o estado;
- timeout funciona com browser suspenso;
- settlement repetido não duplica recompensa.

### Matriz de RLS

Para cada tabela, view e função testar:

| Papel | Leitura | Inserção | Atualização | Eliminação/execução |
|---|---|---|---|---|
| anon | explicitamente definida | negada por defeito | negada | negada |
| auth não participante | apenas catálogo público | negada | negada | negada |
| jogador A | projeção A | ações permitidas | nunca estado arbitrário | RPCs mínimas |
| jogador B | projeção B | ações permitidas | nunca estado arbitrário | RPCs mínimas |
| serviço | apenas jobs necessários | controlada | controlada | auditada |

## 9. Plano de execução detalhado

### Fase 0 — 24–48 horas: honestidade, regressões e higiene

| ID | Ação | Esforço | Dono sugerido | Critério de conclusão |
|---|---|---:|---|---|
| F0-1 | Alinhar copy/status do cartão Play Hub com “Training Preview” | S | Produto/Conteúdo | Nenhuma referência a PvP/GEM disponível |
| F0-2 | Remover beco Guest ou permitir treino realmente público | M | Frontend/Produto | Guest inicia treino sem novo bloqueio |
| F0-3 | Corrigir imagem Lafaic e criar teste de assets | S | Frontend | 30/30 imagens válidas |
| F0-4 | Atualizar React Router para versão corrigida | S | Frontend | audit de produção sem high |
| F0-5 | Atualizar CI/README para Node 22/24 | S | Plataforma | instalação/testes/build verdes |
| F0-6 | Publicar build SHA no jogo e corrigir `Build:` no Hub | S | Plataforma | versão visível e pesquisável |
| F0-7 | Bloquear qualquer ativação acidental de PvP/GEM | S | Backend/Produto | flag server-side default-off e gate documentado |

### Fase 1 — semana 1–2: treino rápido, acessível e leve

| ID | Ação | Esforço | Dependência | Critério de conclusão |
|---|---|---:|---|---|
| F1-1 | Separar rotas públicas de treino das proteções de auth/wallet | M | F0-2 | primeiro jogo ≤2 cliques |
| F1-2 | Otimizar imagens, thumbnails, `srcset`, lazy load e dimensões | M/L | — | budget inicial e zero layout shifts de imagem |
| F1-3 | Corrigir modal/foco e controlos aninhados | M | — | keyboard + axe + teste manual passam |
| F1-4 | Adicionar announcer, histórico textual e reduce motion | M | — | partida acompanhável sem visão/animação |
| F1-5 | Implementar cache e headers Netlify | M | inventário de origens | headers testados em preview e produção |
| F1-6 | Tratar 404/assets, robots e metadata social | M | — | respostas/status/MIME corretos |
| F1-7 | Converter guia em tutorial curto + catálogo filtrável | M | revisão editorial | novos utilizadores concluem primeiro turno |
| F1-8 | Montar Error Boundary, error tracking e RUM | M | decisão de privacidade | erros/CWV têm rota e build |

### Fase 2 — semanas 2–4: núcleo PvP autoritativo

| ID | Ação | Esforço | Dependência | Critério de conclusão |
|---|---|---:|---|---|
| F2-1 | Especificar protocolo de ações e invariantes do jogo | M | regras fechadas | documento + casos de propriedade aprovados |
| F2-2 | Portar reducer para execução autoritativa | L | F2-1 | cliente não grava estado |
| F2-3 | Criar versionamento/CAS, idempotência e log append-only | L | F2-2 | concorrência determinística |
| F2-4 | Separar estado privado e projeções A/B/espectador | L | F2-2 | testes provam zero fuga |
| F2-5 | Implementar timer/deadline e abandono no servidor | M/L | F2-3 | suspensão do cliente não altera prazo |
| F2-6 | Deal atómico e RNG criptográfico/auditável | M/L | F2-3 | deal único e verificável |
| F2-7 | Reconexão por snapshot + sequência de eventos | M | F2-3/4 | recuperação sob rede instável |

### Fase 3 — semanas 4–6: dados, segurança e operação

| ID | Ação | Esforço | Dependência | Critério de conclusão |
|---|---|---:|---|---|
| F3-1 | Reconciliar schema remoto e migrações canónicas | L | acesso aos ambientes | reset de zero reproduz produção esperada |
| F3-2 | Auditar views, functions, grants e RLS | L | F3-1 | matriz pgTAP completa |
| F3-3 | Corrigir view pública e hardening SECURITY DEFINER | M | F3-2 | anon vê apenas projeção deliberada |
| F3-4 | Integrar Supabase local/reset/lint/test no CI | M | F3-1 | drift quebra o PR |
| F3-5 | E2E concorrência, reconexão, a11y e mobile | L | F2 | gates estáveis |
| F3-6 | Load/failure testing e runbooks | M/L | observabilidade | SLOs e recuperação ensaiados |
| F3-7 | Reduzir warnings a zero e definir coverage gate | M | — | PR não aumenta dívida |

### Fase 4 — lançamento progressivo

1. **PvP interno sem GEM:** equipa e contas de teste; telemetria detalhada.
2. **Beta fechada sem GEM:** cohort pequena; kill switch; análise de fraude e reconexão.
3. **PvP público sem GEM:** apenas após SLOs e zero fuga de informação.
4. **GEM em sandbox/testnet:** settlement e reversão ensaiados.
5. **GEM real:** revisão de segurança independente, decisão jurídica, limites conservadores e resposta a incidentes 24/7 proporcional ao risco.

## 10. Gates de lançamento

### Gate A — promover o treino

- copy do Hub alinhada;
- Guest/treino sem wallet funcional;
- Lafaic e restantes assets válidos;
- vulnerabilidade de produção resolvida;
- modal, teclado e anúncios essenciais corrigidos;
- cache/headers/404 aplicados;
- error tracking, versão e RUM ativos;
- métricas de funil definidas.

### Gate B — abrir PvP sem stakes

- zero escrita de estado integral pelo cliente;
- reducer, timer e resultado autoritativos;
- projeções privadas testadas;
- CAS/idempotência/reconexão aprovados;
- migrações reproduzíveis e matriz RLS verde;
- E2E de rede/concorrência e load test aprovados;
- kill switch server-side e runbook.

### Gate C — ativar GEM

- todos os requisitos do Gate B;
- RNG/deal auditável;
- settlement idempotente e não controlável pelo cliente;
- limites, antifraude, reconciliação e reversão;
- revisão externa de segurança sem findings críticos/altos em aberto;
- validação jurídica, termos, privacidade e suporte de incidentes;
- lançamento gradual com limites de exposição.

## 11. Métricas de produto e operação

### Funil

- visita à landing → clique em treino;
- clique → jogo carregado;
- jogo carregado → primeira ação;
- primeira ação → partida concluída;
- Guest → criação opcional de conta;
- conta → wallet linked apenas quando necessário.

### Qualidade da experiência

- tempo mediano até primeira ação;
- taxa de abandono por ecrã/erro;
- partidas concluídas e rematches;
- acessos a ajuda durante o primeiro jogo;
- p75 LCP/INP/CLS mobile e desktop;
- crash-free sessions e RPC error rate.

### PvP futuro

- conflitos de versão por 1.000 ações;
- reconexão bem-sucedida;
- timeouts/abandono;
- divergências de settlement = objetivo zero;
- incidentes de informação privada = objetivo zero;
- tempo de deteção e recuperação.

## 12. Ordem recomendada do backlog

1. Corrigir a promessa do Play Hub e libertar o treino de auth/wallet.
2. Corrigir Lafaic, React Router, Node/CI e build traceability.
3. Otimizar imagens/cache e implementar headers/404.
4. Corrigir modal, semântica, anúncios e reduce motion.
5. Adicionar observabilidade, E2E e RUM.
6. Congelar a interface atual de PvP e desenhar o protocolo autoritativo.
7. Implementar servidor, projeções privadas, CAS, timer e RNG.
8. Reconciliar migrações/RLS e automatizar testes Supabase.
9. Abrir PvP sem stake por etapas.
10. Só depois iniciar trabalho de lançamento GEM com auditoria independente.

## 13. Referências normativas/técnicas

- [Core Web Vitals — web.dev](https://web.dev/articles/vitals)
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WAI-ARIA Authoring Practices — Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Netlify — Custom headers](https://docs.netlify.com/manage/routing/headers/)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — fim do suporte a Node.js 20](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20)
- [Supabase — alteração de exposição automática na Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## 14. Resultado das verificações locais

| Verificação | Resultado |
|---|---|
| Testes | **215/215 passaram** em 47 ficheiros |
| Build de produção | Passou; aviso de chunk >500 KB |
| Lint | 0 erros, **117 warnings** |
| Audit de dependências de produção | 1 vulnerabilidade alta, com correção compatível |
| Audit completo, incluindo dev | 5 vulnerabilidades altas, 0 críticas |
| Estado do repositório antes do relatório | limpo |

---

**Conclusão:** a prioridade não deve ser “ligar PvP”. Deve ser tornar o treino imediato e convincente enquanto se reconstrói o núcleo competitivo com autoridade no servidor. Esta sequência permite melhorar aquisição já, sem criar uma dívida de confiança ou segurança que se torne muito mais cara quando houver ranking ou valor económico em jogo.

## 15. Atualização final após os checkpoints C1–C30

### Resultado local consolidado

| Área | Estado final local | Evidência |
|---|---|---|
| Treino público | 🟢 | Início sem conta/wallet, tutorial guiado, guia pesquisável e histórico acessível |
| Acessibilidade | 🟢/🟡 | Modal, foco, teclado, announcer, movimento reduzido e alvos corrigidos; falta validação manual assistiva completa |
| Assets | 🟢 | Referências válidas, WebP responsivo, payload público <12 MiB e gate de integridade |
| Bundle | 🟢 | JavaScript pré-carregado 234,32→94,52 KiB gzip; teto CI 110 KiB |
| Hosting local | 🟢/🟡 | Headers, cache, 404, robots, sitemap e manifest configurados/testados; falta publicar e verificar os domínios |
| Dependências | 🟢 | Auditoria npm completa e de produção sem vulnerabilidades conhecidas |
| Qualidade | 🟢 | 89 ficheiros/419 testes, typecheck, lint zero, runtime Node e gates de CI |
| Cobertura crítica | 🟢 | 18 módulos: 86,91% statements/lines, 80,45% branches e 95,67% functions |
| Artefacto público | 🟢 | Sem service-role JWT, chaves, `.env`, sourcemaps, symlinks ou logs próprios |
| PvP/GEM | 🔴 NO-GO | Arquitetura/protótipo local prontos; backend autoritativo e persistência/RLS reais não existem |
| Base partilhada | ⚪ preservada | Zero alterações em `supabase/migrations`; inventário/proposta permanecem read-only |
| Core Web Vitals | 🔴 sem medição | Chrome DevTools MCP ausente; nenhum LCP/INP/CLS foi inventado |
| Deploy | ⚪ não realizado | Todas as melhorias continuam apenas no worktree local |

### Tarefas pendentes, por prioridade

1. **Não ativar PvP/GEM.** Implementar a rota autoritativa real, adapter Postgres transacional,
   projeções privadas, CAS/idempotência, deadlines, RNG auditável e settlement server-only.
2. **Trabalhar a base apenas numa branch/projeto isolado.** O acesso read-only e o inventário remoto
   já existem; falta criar uma branch aprovada, obter baseline recuperável e provar RLS/grants com
   pgTAP antes de qualquer proposta para a base partilhada.
3. **Preparar um deploy controlado.** Rever o diff, publicar primeiro em preview, validar login,
   treino, assets, headers/cache/404 e rollback; só depois promover os domínios públicos.
4. **Revalidar o Play Hub.** Confirmar que cartão/status/copy continuam alinhados com “Training
   Preview” e que Guest chega ao treino sem promessa de PvP/GEM.
5. **Medir desempenho real.** Configurar Chrome DevTools MCP/Lighthouse, medir mobile/desktop e
   recolher LCP/INP/CLS; manter RUM desligado até endpoint, consentimento, retenção e privacidade.
6. **Executar QA assistivo e E2E real.** VoiceOver/NVDA/TalkBack, browser mobile, auth email/Google,
   wallet cancelada/ausente e falhas de chunk/rede em preview.
7. **Fechar produto/jurídico/operação.** Privacidade, termos, retenção, contexto de wallet,
   antifraude, limites, kill switch, SLOs e resposta a incidentes antes de ativos digitais.
8. **Antes de GEM real:** revisão externa independente sem findings críticos/altos abertos.

## 16. Atualização C31 — acesso administrativo Supabase read-only

O inventário remoto removeu a incerteza que permanecia no fecho C30 e elevou o backend legado a
risco operacional confirmado. A base partilhada está saudável e o histórico do SDK alinha 34/34
versões com produção, mas o jogo local não é uma fonte reproduzível do schema remoto.

| Prioridade | Confirmação remota | Decisão |
|---|---|---|
| P0 | O host envia ranks/scores a `playhub_finish_session`, que atribui GEM, saldo e leaderboard | PvP/GEM permanece **NO-GO**; settlement tem de ser server-only e derivado do jogo |
| P0 | Participante substitui o JSON integral por `card_game_set_state` | Migrar para comandos, CAS/idempotência e validação autoritativa |
| P0 | Participante recebe ambas as mãos por `card_game_get_session_state` | Separar snapshot privado e projeções A/B antes de PvP |
| P0 | `deal-cards` remoto não tem o gate default-off local; jogo/modos/season continuam ativos | Conter todas as funções e catálogo num change set coordenado, não por deploy isolado |
| P1 | Policies públicas expõem sessões, participantes e resultados; grants base são amplos | Classificar dados e reduzir acesso só após mapa completo de consumidores do Hub |
| P1 | Deal remoto usa `Math.random()` | RNG criptográfico/auditável antes de competição |
| P1 | Zero branches Supabase e zero schema privado | Criar branch isolada e provar pgTAP/rollback antes de DDL |

Advisors sem avisos e ausência de logs do jogo nas últimas 24 horas são sinais úteis, mas não
contradizem os achados de domínio. Nenhuma alteração foi feita na base, no Hub, no SDK ou no
deploy. O inventário técnico completo e o plano seguro estão em
`docs/tech/SUPABASE_READ_ONLY_INVENTORY_2026-08-28.md`.

## 17. Atualização C32 — contenção isolada e falha de reprodutibilidade

O primeiro passo de contenção foi preparado sem competir com as sessões de Bestiary Trails e
Swarm Hunt. As sete funções competitivas do SDK receberam um patch local, ainda não aplicado, com
gate default-off antes de qualquer acesso privilegiado; combinado com `deal-cards`, cobre as oito
Edge Functions Wisdom Duel. A suite integral permaneceu verde: 90 ficheiros e 430 testes, além de
TypeScript, lint, testes Deno e verificação estática do patch.

A branch Supabase, criada sem dados após confirmação de US$ 0,01344/h, demonstrou que o histórico
partilhado não é reproduzível: a migração `unify_playhub_games` pressupõe `games.slug`, ausente no
schema produzido pelas etapas anteriores. O replay parou em 12 de 34 migrações. A branch falhada
foi eliminada imediatamente; nenhuma alteração chegou a produção e não resta branch paga.

Isto muda a ordem do P0:

1. reconciliar uma baseline schema-only canónica sem editar migrações já aplicadas;
2. provar numa branch nova as 34 migrações, RLS, advisors e rollback;
3. aplicar/testar o kill switch das oito funções apenas nessa branch;
4. conter as RPCs Wisdom sem quebrar RPCs partilhadas por outros jogos;
5. só então continuar para persistência autoritativa e qualquer preview PvP.

Durante o diagnóstico houve atividade remota de Swarm Hunt por outra sessão. Ela foi observada,
mas não incorporada, sobrescrita nem revertida. PvP/GEM continua **NO-GO**. O detalhe técnico está
em `docs/tech/WISDOM_DUEL_CONTAINMENT_C32.md`.
