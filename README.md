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
  "prefix": "/",
  "botName": "Corvus",
  "iaName": "Masayoshi",
  "owner": { "nick": "T4", "numbers": ["5511999999999"] },
  "flags": { "menuAudio": false, "forwarding": false }
}
```

- **`prefix`**: prefixo dos comandos (padrão atual: `/`). Pode ser trocado aqui ou via
  `.env` (`BOT_PREFIX=...`) — todas as mensagens do bot exibem o prefixo dinamicamente.
- **`owner.numbers`**: número(s) do dono (só dígitos, com DDI). Habilita os comandos
  restritos ao dono. Pode também ser definido via `.env` (`OWNER_NUMBERS=...`), que tem
  precedência. Veja [`.env.example`](.env.example).
- A conta que **hospeda** o bot também pode usar comandos (digitados no próprio aparelho),
  com privilégio de dono.

## Uso

```bash
npm start          # inicia o bot (banner + QR code no terminal)
npm run qr         # apaga a sessão atual e gera um novo QR
npm run dev        # modo desenvolvimento (reinicia ao salvar)
```

Escaneie o QR exibido com o WhatsApp do número do bot. A sessão é salva em
`data/session/` (ignorada pelo git) — reinícios reconectam sozinhos, sem novo QR.

## Menu

`/menu` envia a arte do bot com os atalhos de navegação na legenda (100% texto — funciona
igual em celular, Web e Desktop):

- `/menu utilidades` · `/menu mídia` · `/menu áudio` · `/menu downloads` · `/menu diversão`
  · `/menu admin` — comandos da categoria (aceita com ou sem acento)
- `/menu geral` — todos os comandos numa mensagem só
- `/menu <comando>` (ex.: `/menu velha`) — cartão de detalhe: aliases, permissões, cooldown

## Comandos

**Utilidades**

| Comando | Descrição |
|---------|-----------|
| `/ping` | Status, latência e uptime |
| `/menu` | Menu de comandos (ver acima) |
| `/dono` | Mostra o dono (T4) e a IA (Masayoshi) |
| `/level` (`/nivel`) / `/rank` | Seu nível/XP e o ranking de XP |
| `/corvusfrase` (`/frase`) | Frase da Masayoshi |
| `/regras` / `/diretoria` | Regras e Diretoria (dono edita com `set`/`clear`) |
| `/evento` | Agenda de eventos (admins: `add`/`del`) |

**Mídia**

| Comando | Descrição |
|---------|-----------|
| `/sticker` (`/fig`, `/s`) | Imagem/vídeo curto → figurinha |
| `/toimg` | Figurinha → imagem |
| `/emojimix 😀 😎` | Combina dois emojis numa figurinha |
| `/traduzir [idioma] <texto>` | Traduz texto (padrão: português) |
| `/ler` | Extrai texto de uma imagem (OCR) |

**Áudio**

| Comando | Descrição |
|---------|-----------|
| `/tts <texto>` (`/voz`) | Texto → voz |
| `/viraraudio` (`/mp3`) | Vídeo → áudio |

**Downloads**

| Comando | Descrição |
|---------|-----------|
| `/play <nome\|link>` | Baixa o áudio (YouTube; links do Spotify viram busca) |
| `/baixar`/`/tiktok`/`/instagram`/`/twitter` `<link>` | Baixa vídeo de redes sociais |

**Diversão**

| Comando | Descrição |
|---------|-----------|
| `/velha @oponente` | Jogo da velha (depois `/velha <1-9>`) |
| `/forca` | Jogo da forca (`/forca <letra\|palavra>`) |
| `/anagrama` / `/quiz` | Desembaralhe a palavra / trivia |
| `/ppt pedra\|papel\|tesoura` | Pedra, papel e tesoura |
| `/enquete Pergunta \| op1 \| op2` | Cria uma enquete nativa |

**Administração** (requer admin; ações destrutivas exigem o bot como admin)

| Comando | Descrição |
|---------|-----------|
| `/ban` (`/kick`) | Remove membro mencionado/citado |
| `/promover` / `/rebaixar` | Dá/remove cargo de admin |
| `/grupo abrir\|fechar` | Abre/fecha o grupo |
| `/todos` (`/marcar`) | Marca todos os membros |
| `/del` | Apaga a mensagem citada |
| `/adv` / `/advs` / `/resetadv` | Advertências (remove com 3) |
| `/antilink on\|off` | Apaga convites de outros grupos e adverte |
| `/rankmsg` / `/msgs` | Ranking e contagem de mensagens |
| `/link` | Link de convite do grupo |
| `/welcome on\|off` | Ativa/desativa boas-vindas |

**Dono**

| Comando | Descrição |
|---------|-----------|
| `/bcgrupos <mensagem>` (`/bc`) | Comunicado para todos os grupos |
| `/reiniciar` | Encerra o processo (religa se o host usar pm2/loop) |

> XP é concedido por atividade (com cooldown anti-farm) e o bot anuncia quando alguém sobe de
> nível. Comandos pesados (downloads, mídia) têm cooldown próprio.

### Observações

- **Downloads**: arquivos muito grandes são recusados pelo limite do WhatsApp (áudio ~16MB);
  algumas redes sociais podem exigir login e falhar.
- **`/ler` (OCR)**: baixa o modelo de idioma na primeira execução (requer internet).
- **`/traduzir` e `/emojimix`**: usam endpoints públicos não oficiais e podem ficar indisponíveis.
- **`/del`** e **`/antilink`** (apagar/remover) exigem o bot como admin; **`/limpar`** só limpa
  visualmente (o WhatsApp não permite apagar o histórico de terceiros).
- **`/reiniciar`** apenas encerra o processo — para religar sozinho, rode o bot sob pm2
  (`pm2 start src/index.js --name corvus`) ou um loop de shell.

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
`isOwner`, `isAdmin`, `isBotAdmin`, `groupMetadata`, `config`, `commands` e
`reply(textoOuConteúdo)`. Flags disponíveis: `ownerOnly`, `groupOnly`, `adminOnly`,
`botAdmin`, `cooldown` (segundos) e `category` (agrupa no menu).

A identidade visual (emojis, paleta, helpers de mensagem) fica centralizada em
[`src/ui/theme.js`](src/ui/theme.js).
