# Observabilidade e privacidade

Wisdom Duel não envia telemetria por omissão. A recolha só é instalada quando estas duas
condições são verdadeiras:

```dotenv
VITE_OBSERVABILITY_ENABLED=true
VITE_OBSERVABILITY_ENDPOINT=https://observability.example/ingest
```

`VITE_OBSERVABILITY_SAMPLE_RATE` aceita um valor entre `0` e `1`. O endpoint tem de usar
HTTPS (localhost é permitido em desenvolvimento). Pedidos omitem cookies, credenciais,
referrer, query string e hash.

## Dados permitidos

- versão e SHA do build;
- rota normalizada;
- timestamp;
- tipo/nome/mensagem/stack sanitizados de erro;
- component stack sanitizada;
- TTFB, FCP, LCP, CLS e INP quando suportados pelo browser.

## Dados proibidos

- email, user id, wallet ou endereço;
- tokens, cookies, authorization ou secrets;
- query strings, códigos de convite e UUIDs de partidas;
- mãos, deck, payload, estado completo ou escolhas privadas;
- conteúdo de chat ou dados do perfil.

O sanitizador remove chaves sensíveis, emails, endereços EVM, JWTs e UUIDs antes de criar o
payload. O build de produção remove chamadas `console` e `debugger`; desenvolvimento
mantém os logs para diagnóstico local.

Se o endpoint for externo, a origem deve ser adicionada deliberadamente ao `connect-src`
da CSP antes do deploy. Ativar telemetria exige revisão de privacidade, retenção, acesso,
base legal/consentimento e teste do payload recebido.
