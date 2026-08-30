# Wisdom Duel — fronteira HTTP autoritativa

**Estado:** contrato e testes locais concluídos; não existe Edge Function publicada nem
ligação à base partilhada.  
**Implementação neutra de plataforma:** `src/game/authoritativeHttp.ts`  
**Wire protocol:** `wisdom-duel-command-v1`

## Objetivo

Esta fronteira transforma um pedido HTTP autenticado numa chamada ao executor
autoritativo. Ela não conhece Supabase, não guarda estado e não lê o Hub; todas essas
capacidades são dependências injetadas. Assim, o contrato pode ser testado sem secrets,
rede ou base de dados.

O fluxo obrigatório é:

```text
origem/método → release gate → tipo/tamanho → JWT revalidado → rate limit
→ parse estrito → executor autoritativo → resposta privada do ator
```

O *release gate* precede autenticação, leitura do corpo e qualquer futuro acesso a dados.
Se `WISDOM_DUEL_PVP_ENABLED` não for exatamente `true`, o servidor responde 503 sem abrir
a fronteira privilegiada.

## Pedido aceite

- Método: `POST`.
- `Content-Type`: `application/json`.
- Autenticação: `Authorization: Bearer <JWT>`; a identidade é obtida pela revalidação do
  token no servidor e nunca pelo JSON.
- Corpo máximo: 16 KiB, verificado pelo tamanho declarado e pelos bytes realmente lidos.
- Origem: allowlist exata; `*` é recusado na construção do handler.
- Corpo: envelope descrito em `AUTHORITATIVE_GAME_PROTOCOL.md`.

`apikey` é um header de plataforma separado e nunca substitui o JWT do utilizador.

## Respostas HTTP

| HTTP | Código | Significado |
|---:|---|---|
| 200 | `accepted` / `duplicate` | Aplicado uma vez ou retry idempotente |
| 400 | `invalid_json` / `invalid_command` | JSON ou protocolo inválido |
| 401 | `unauthorized` | Bearer ausente/inválido ou JWT não revalidado |
| 403 | `origin_not_allowed` / `not_participant` | Origem ou identidade sem acesso |
| 405 | `method_not_allowed` | Método diferente de POST/OPTIONS |
| 409 | `version_conflict`, `match_not_playable`, `deadline_expired` | Estado concorrente ou partida fechada |
| 413 | `payload_too_large` | Corpo acima do limite |
| 415 | `unsupported_media_type` | Tipo de conteúdo diferente de JSON |
| 422 | `rule_violation` | Intenção válida no wire mas ilegal nas regras |
| 429 | `rate_limited` | Limite obrigatório recusou o comando |
| 500 | `internal_error` | Falha sanitizada, sem detalhes internos |
| 504 | `operation_timeout` | Budget total excedido; retry conserva o mesmo `commandId` |
| 503 | `multiplayer_disabled` | Gate do servidor fechado |

Todas as respostas contêm `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
`X-Content-Type-Options: nosniff` e um `X-Request-Id`. Erros não incluem token, snapshot,
stack, seed ou informação privada.

## CORS e preflight

`OPTIONS` só devolve CORS quando a origem consta da allowlist. A origem recebida nunca é
refletida por omissão. Headers autorizados: `authorization`, `apikey`, `content-type` e
`x-client-info`; métodos: `POST, OPTIONS`; cache de preflight: 600 segundos.

A allowlist de produção deve conter apenas as origens canónicas realmente servidas, por
exemplo os domínios finais do jogo e, apenas se o Hub fizer pedidos cross-origin, a origem
do Hub. URLs de preview devem ser adicionadas explicitamente e removidas após o teste.

## Dependências que a futura Edge Function tem de fornecer

1. `isReleaseEnabled`: leitura default-off do secret do servidor.
2. `authenticateBearerToken`: revalidação do JWT e devolução de `user.id`.
3. `checkRateLimit`: limite obrigatório por utilizador e, como defesa adicional, por IP
   truncado/hasheado; falhar fechado se o mecanismo estiver indisponível.
4. `executeCommand`: carregar snapshot privado, executar regras e chamar o commit
   transacional com CAS/idempotência.
5. `createRequestId`: identificador opaco; nunca usar como chave lógica de comando.

O handler cria um `AbortSignal` para o budget total (5 s por omissão, configurável entre
10 ms e 30 s para teste/operação). Autenticação, quota e executor recebem o signal. Um 504
após commit é seguro: o retry usa o mesmo `commandId` e recupera `duplicate`.

## Leitura de projeção/reconexão

`authoritativeProjectionHttp.ts` define um GET separado e autenticado:

```text
GET ?matchId=<uuid> → gate → query estrita → JWT → quota → projeção (session, auth.uid)
```

Só aceita um parâmetro `matchId`; duplicados e campos extra são recusados. Outsider e
partida inexistente partilham a mesma resposta 404 opaca. CORS, headers, request ID,
budget e autenticação são os mesmos do POST. A resposta tem `no-store` e contém apenas a
projeção materializada do ator.

## Rate limiting

`authoritativeRateLimit.ts` fornece o contrato e uma referência em memória multi-janela.
As chaves são SHA-256 com salt separado para ator e rede; o store nunca recebe UUID/IP em
claro. O actor autenticado é obrigatório; uma identidade de rede só pode vir de metadata
confiável do gateway, nunca de um header forwarded lido diretamente.

O consumo é atómico por chave, cobre burst + sustained e devolve `Retry-After`. Store
indisponível falha fechado. A implementação em memória é apenas para conformance; a
produção precisa de um store partilhado com TTL/capacidade e métricas.

## Eventos operacionais

POST e GET podem emitir `wisdom-duel-operation-v1`: operação, outcome, duração, timestamp,
request ID e versão. Token, ator, match, command ID, corpo, projeção, cartas, seed e erro
não fazem parte do tipo nem chegam ao sink. Falha do sink é isolada do resultado.

## Configuração Supabase necessária antes de existir endpoint

- `verify_jwt = true` na função que aceite comandos de utilizador.
- `Authorization` com JWT do utilizador; service role apenas dentro da função.
- A service role não pode ser enviada ao browser, logs ou respostas.
- Timeout e limite de corpo também configurados na camada de plataforma.
- Nenhuma função deployada enquanto o schema, o rate limit e a matriz RLS não estiverem
  aprovados numa branch isolada.

Referências oficiais: [autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth),
[JWT](https://supabase.com/docs/guides/auth/jwts) e
[configuração local de funções](https://supabase.com/docs/guides/functions/function-configuration).

## Evidência local

Os testes cobrem wildcard CORS, preflight, ordem do release gate, origem proibida,
tipo/tamanho/JSON, JWT, identidade injetada, não participante, fora de turno, resposta
privada, seed omitida, retry idempotente, conflito CAS e rate limit obrigatório.
