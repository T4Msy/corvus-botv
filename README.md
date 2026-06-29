# Corvus Bot 🐦‍⬛

A face WhatsApp da IA **Masayoshi**. Bot multi-device construído sobre
[`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys), com base de código
própria, modular e mantível.

> Sucessor do antigo Sakura-Bot v6 (cujo motor estava ofuscado). O código legado foi
> arquivado em [`legacy/`](legacy/) apenas como referência para portar funcionalidades.

## Requisitos

- Node.js **20+** (há um `.nvmrc`; use `nvm use`)
- O FFmpeg vem empacotado via `ffmpeg-static` — não precisa instalar nada à parte.

## Instalação

```bash
nvm use          # opcional, fixa o Node 20
npm install
```

## Configuração

Edite [`config/settings.json`](config/settings.json):

```json
{
  "prefix": "!",
  "botName": "Corvus",
  "iaName": "Masayoshi",
  "owner": { "nick": "T4", "numbers": ["5511999999999"] },
  "flags": { "menuAudio": false, "forwarding": false }
}
```

- **`owner.numbers`**: número(s) do dono (só dígitos, com DDI). Habilita os comandos
  restritos ao dono. Pode também ser definido via `.env` (`OWNER_NUMBERS=...`), que tem
  precedência. Veja [`.env.example`](.env.example).

## Uso

```bash
npm start          # inicia o bot (banner + QR code no terminal)
npm run qr         # apaga a sessão atual e gera um novo QR
npm run dev        # modo desenvolvimento (reinicia ao salvar)
```

Escaneie o QR exibido com o WhatsApp do número do bot. A sessão é salva em
`data/session/` (ignorada pelo git) — reinícios reconectam sozinhos, sem novo QR.

## Comandos

**Geral**

| Comando | Descrição |
|---------|-----------|
| `!ping` | Status, latência e uptime |
| `!menu` | Lista os comandos (agrupados por categoria) |
| `!dono` | Mostra o dono (T4) e a IA (Masayoshi) |
| `!level` (`!nivel`) / `!rank` | Seu nível/XP e o ranking de XP |

**Mídia**

| Comando | Descrição |
|---------|-----------|
| `!sticker` (`!fig`, `!s`) | Imagem/vídeo curto → figurinha |
| `!toimg` | Figurinha → imagem |
| `!emojimix 😀 😎` | Combina dois emojis numa figurinha |
| `!traduzir [idioma] <texto>` | Traduz texto (padrão: português) |
| `!ler` | Extrai texto de uma imagem (OCR) |

**Áudio**

| Comando | Descrição |
|---------|-----------|
| `!tts <texto>` (`!voz`) | Texto → voz |
| `!viraraudio` (`!mp3`) | Vídeo → áudio |
| `!grave` `!agudo` `!rapido` `!lento` `!reverse` `!robot` `!volume` | Efeitos sobre um áudio citado |

**Downloads**

| Comando | Descrição |
|---------|-----------|
| `!play <nome\|link>` | Baixa o áudio (YouTube) |
| `!video <nome\|link>` | Baixa o vídeo |
| `!baixar`/`!tiktok`/`!instagram`/`!twitter`/`!facebook <link>` | Baixa vídeo de redes sociais |

**Jogos**

| Comando | Descrição |
|---------|-----------|
| `!velha @oponente` | Jogo da velha (depois `!velha <1-9>`) |
| `!forca` | Jogo da forca (`!forca <letra\|palavra>`) |
| `!anagrama` / `!quiz` | Desembaralhe a palavra / trivia |
| `!ppt pedra\|papel\|tesoura` | Pedra, papel e tesoura |
| `!enquete Pergunta \| op1 \| op2` | Cria uma enquete nativa |

**Administração de grupo** (requer admin; o bot precisa ser admin)

| Comando | Descrição |
|---------|-----------|
| `!ban` (`!kick`) | Remove membro mencionado/citado |
| `!promover` / `!rebaixar` | Dá/remove cargo de admin |
| `!grupo abrir\|fechar` | Abre/fecha o grupo |
| `!todos` (`!marcar`) | Marca todos os membros |
| `!del` | Apaga a mensagem citada |
| `!adv` / `!advs` / `!resetadv` | Advertências (remove com 3) |
| `!rankmsg` / `!msgs` | Ranking e contagem de mensagens |
| `!link` | Link de convite do grupo |
| `!welcome on\|off` | Ativa/desativa boas-vindas |

> XP é concedido por atividade (com cooldown anti-farm) e o bot anuncia quando alguém sobe de
> nível. Comandos pesados (downloads, mídia) têm cooldown próprio.

### Observações

- **Downloads**: arquivos muito grandes são recusados pelo limite do WhatsApp (áudio ~16MB);
  algumas redes sociais podem exigir login e falhar.
- **`!ler` (OCR)**: baixa o modelo de idioma na primeira execução (requer internet).
- **`!traduzir` e `!emojimix`**: usam endpoints públicos não oficiais e podem ficar indisponíveis.
- **`!del`** exige o bot como admin; **`!limpar`** só limpa visualmente (o WhatsApp não permite
  apagar o histórico de terceiros).

## Adicionando comandos

Crie um arquivo em `src/commands/`. Ele é carregado automaticamente:

```js
module.exports = {
  name: 'oi',
  aliases: ['ola'],
  ownerOnly: false,   // restringe ao dono
  groupOnly: false,   // restringe a grupos
  desc: 'Responde uma saudação.',
  async run ({ reply }) {
    await reply('Opa! 🐦‍⬛')
  }
}
```

O contexto `run(ctx)` traz: `sock`, `msg`, `args`, `text`, `from`, `sender`, `isGroup`,
`isOwner`, `config`, `commands` e `reply(textoOuConteúdo)`.

A identidade visual (emojis, paleta, bordas de menu) fica centralizada em
[`src/ui/theme.js`](src/ui/theme.js).
