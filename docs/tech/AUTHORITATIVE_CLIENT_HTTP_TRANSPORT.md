# Wisdom Duel — transporte HTTP do cliente autoritativo

**Estado:** adapter e guardas wire validados localmente; nenhuma URL de produção está
configurada e o adapter não é importado pela aplicação.  
**Implementação:** `src/game/authoritativeClientHttpTransport.ts`  
**Guarda de projeção:** `src/game/projectionWire.ts`

## Fronteira de segurança

O adapter recebe obrigatoriamente `commandUrl`, `projectionUrl` e `getAccessToken`.
O token é obtido de novo imediatamente antes de cada GET/POST, usado apenas para construir
o header daquela chamada e nunca guardado no estado do jogo, resposta normalizada ou log.

Os endpoints:

- têm de usar HTTPS, sem credenciais, query ou hash embutidos;
- têm de partilhar a mesma origem;
- usam `credentials: omit`, `cache: no-store`, `referrerPolicy: no-referrer`;
- usam `redirect: error`, impedindo o browser de reenviar Authorization num redirect.

O `fetch` é injetável. Os testes usam apenas Responses locais e nenhuma rede.

## Pedido e resposta

O POST serializa exatamente o envelope já validado, preservando `commandId`. O GET cria
uma query com um único `matchId`. Ambos propagam o `AbortSignal` do controlador.

Antes de interpretar JSON, a resposta precisa de:

1. `Content-Type: application/json`;
2. corpo UTF-8 válido;
3. máximo 256 KiB por omissão, verificado pelo header e pelos bytes lidos;
4. status/body coerentes (`200` para sucesso, não-2xx para rejeição);
5. shape v1 estrito, sem campos desconhecidos.

`requestId` é deliberadamente descartado da resposta de domínio. `Retry-After` é limitado
a 1–86400 segundos. HTML, JSON truncado, payload excessivo, status inconsistente ou shape
desconhecido tornam-se `invalid_response`; para comandos, o controlador conserva o mesmo
pending porque o commit pode ter ocorrido.

## Guarda da projeção

`isGameProjectionWire` verifica protocolo, UUIDs, versão/sequência, jogadores, mãos,
cartas, campo, mercado, descarte, pending choices, deadline e commitment. Rejeita campos
desconhecidos em todos os objetos sensíveis. Assim, `privateRandom`, `knowledgeDeck` ou
cartas anexadas a uma mão `hidden` nunca chegam à UI mesmo se um servidor regressar.

## Integração futura

Uma configuração real só deve ser criada no bootstrap opt-in da rota PvP e alimentada por
URLs públicas revistas. O provider deverá ler a sessão Supabase corrente sem imprimir o
JWT. Não adicionar service-role, fallback anónimo, redirect permitido ou armazenamento de
responses. Continuam necessários CSP/connect-src, gate de release, RLS e adapter servidor
antes de ligar este transporte à aplicação.

## Evidência vertical local

`tests/integration/authoritativeBrowserToStore.test.ts` encaminha o `fetch` para os handlers
reais dentro do mesmo processo. Sem rede, prova controller → adapter → JSON/headers →
auth/quota → serviço durável → store → projeção e o caminho inverso. Inclui 504 depois do
commit, retry duplicate, corrida de duas versões, abort antes do handler e resposta acima
do limite depois do commit.
