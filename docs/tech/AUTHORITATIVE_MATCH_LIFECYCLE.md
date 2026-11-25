# Wisdom Duel — ciclo de vida autoritativo da partida

**Estado:** inicialização, concorrência, commitment, deadline e reconexão provados num
adapter transacional em memória; sem endpoint ou Supabase.

## Inicialização

A inicialização é interna e usa uma fonte de sessão fornecida pela persistência. O browser
não envia jogadores, slots, seleções, seed ou deadline.

Uma sessão só é aceite quando:

- `session_id` e os dois `player_id` são UUIDs válidos e distintos;
- `game_id='card_game'`, `mode_id='casual'` e `status='playing'`;
- existem exatamente slots 1 e 2;
- cada slot tem exatamente três criaturas válidas e não repetidas;
- existe uma revisão opaca da fonte, novamente comparada no create atómico.

O modo GEM é deliberadamente recusado. Será uma operação separada depois de settlement,
locks e reconciliação económica autoritativos.

## Seed, commitment e corrida

Cada worker gera 32 bytes com `crypto.getRandomValues`, constrói a stream `chacha20-v1` e
calcula o commitment SHA-256 antes do create. A porta faz `create-if-absent` sob lock/CAS
por `session_id`:

- o primeiro worker cria snapshot, commitment, deadline e as duas projeções;
- workers concorrentes devolvem `existing` com o commitment vencedor;
- a seed perdedora é descartada;
- nenhuma resposta de inicialização contém a seed;
- versão e sequência iniciais são zero, sem evento fictício.

A futura RPC deve repetir dentro da transação as condições de jogo/modo/status,
participantes, slots e revisão; não basta confiar no snapshot lido pela Edge Function.

## Deadlines

O primeiro deadline é calculado pelo relógio do servidor. Comandos dentro do mesmo turno
não o prolongam. Um `end_turn` aceite cria o deadline do jogador seguinte e persiste-o na
mesma troca atómica que snapshot/evento/projeções.

Comandos de jogador após o deadline continuam recusados sem commit. A consequência
automática do timeout — passar, perder poder ou perder a partida — ainda é uma decisão de
regras/produto. Nenhuma dessas opções foi assumida silenciosamente; até existir uma regra
versionada e teste de replay, o adjudicador automático permanece pendente e o PvP fechado.

## Reconexão

Uma nova instância lê `wisdom_duel_player_projections` por `(session_id, auth.uid())`. A
resposta contém versão, turno e deadline atuais, própria mão e contagem rival. Não carrega
snapshot privado para o browser nem revela seed/ordem futura.

## Eventos operacionais

O schema `wisdom-duel-operation-v1` aceita apenas:

- operação (`initialize`, `command`, `projection_read`, `timeout`);
- resultado estável, duração e timestamp;
- request ID opaco opcional;
- tipo de comando e versão opcionais.

Campos extra são descartados por construção. Não existem actor/match/command IDs, JWT,
origem, envelope, cartas, projeção, snapshot, seed, erro ou stack. A falha do collector é
isolada e nunca muda o resultado da partida. Correlação pseudónima só poderá ser adicionada
com salt rotativo e aprovação explícita de privacidade.

