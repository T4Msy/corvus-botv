# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Corvus Bot** — the WhatsApp face of the *Masayoshi* AI, owner **T4**. A multi-device WhatsApp
bot built on `@whiskeysockets/baileys`. This is a **ground-up rewrite** of the old, obfuscated
Sakura-Bot v6. The legacy code lives in `legacy/` as a **read-only reference** for porting
features — it is not executed and should not be edited.

## Commands

```bash
npm install        # install dependencies (Node 20+, see .nvmrc)
npm start          # start the bot: prints CORVUS banner + QR code
npm run qr         # wipe data/session and force a new QR pairing
npm run dev        # dev mode (node --watch, restarts on save)
```

There is no test suite yet. For a quick smoke test without connecting to WhatsApp:

```bash
node -e "require('./src/config'); require('./src/commands/_registry').loadCommands()"
```

## Architecture

```
src/
  index.js        # bootstrap: banner → load commands → connect (handlers obj)
  connection.js   # Baileys socket: QR, auto-reconnect, getMessage (retry), sendMessage wrapper
  config.js       # loads config/settings.json + .env, exposes config.isOwner()
  handler.js      # message → dedupe/fromMe → counters/XP → antilink → prefix → permissions → run
  commands/       # one file per command (or an ARRAY of commands), auto-loaded by _registry.js
    _registry.js  # scans *.js (except _-prefixed) into a Map (name + aliases); accepts arrays
    ping menu dono level rank corvusfrase regras diretoria evento   # Geral (menu: "Utilidades")
    sticker toimg emojimix traduzir ler              # Mídia
    tts viraraudio                                   # Áudio
    play redes(baixar/tiktok/instagram/...)          # Downloads
    velha forca anagrama quiz ppt enquete            # Jogos (menu: "Diversão")
    ban promover rebaixar grupo todos del adv advs resetadv antilink
    rankmsg msgs limpar link welcome                 # Admin (menu: "Administração")
    reiniciar bcgrupos                               # Dono (ownerOnly)
  events/
    groupParticipants.js  # join/leave welcome messages (toggle via /welcome); exports groups store
  lib/
    store.js      # atomic JSON persistence (cache + tmp+rename + write queue)
    leveling.js   # XP/level system (uses store('levels'))
    ratelimit.js  # per-(command,user) cooldown for the `cooldown` flag
    group.js      # getAdmins() (all @lid/phone variants), botJid(), botJids(), getTargets()
    warns.js      # applyWarn() shared by /adv and antilink (3 warns ⇒ remove)
    categories.js # category labels/order + groupByCategory (internal name → display label)
    menuview.js   # categoryToText(), commandCard(), commandsOfCategory() (menu rendering)
    msgcache.js   # sent-message cache: getMessage retries (anti-"aguardando mensagem")
                  # + markSent/wasSentByBot (distinguish code-sent vs host-typed fromMe)
    media.js      # resolveMedia()/downloadMedia() — image/video/audio/sticker, quoted or own
    sticker.js    # createSticker(): sharp (image) + ffmpeg-static (video) + node-webpmux (EXIF)
    audio.js      # ffmpeg effects lib (applyEffect/EFFECTS) + toMp3/toOpus — effects commands
                  # were removed; the lib stays for /tts and /viraraudio
    tts.js translate.js ocr.js emojimix.js ytdlp.js cobalt.js  # feature helpers (free/no-key)
    games/ttt.js  # pure tic-tac-toe logic
    fetch.js text.js
  data/           # game data: anagrama.json, quiz.json (committed)
  ui/
    theme.js      # SINGLE source of visual style: emojis, palette, tag/header/divider,
                  # success/error/loading/info, box() — red/black + wine-glass identity
    banner.js     # terminal CORVUS banner (cfonts, red)
config/settings.json  # prefix (currently "/"), botName, iaName, owner T4, flags (unused today)
assets/           # stickers/<category>/, audios/ (both unused for now), images/menu.jpg (menu art)
data/             # runtime: WhatsApp session + JSON state (gitignored)
legacy/           # archived Sakura-Bot v6 — reference only, do not run/edit
```

### How a command flows

1. `connection.js` emits `messages.upsert` → `handler.js`. It accepts `notify` (third parties)
   and `append` (own account). Own-account messages typed on the bot's phone count as **owner
   commands**; messages the code itself sent are skipped via `msgcache.wasSentByBot()` (with a
   200 ms delay to close the send/receive race) and a processed-id dedupe set.
2. The handler extracts text (`extractText` covers conversation / captions / list replies),
   runs antilink (if enabled for the group), checks the prefix, splits into command + args,
   and looks the command up in the registry Map.
3. It enforces permissions, then calls `command.run(ctx)`. A failing command replies a themed
   error and never crashes the bot.

**Identity note (@lid):** new groups identify participants as `@lid` instead of phone JIDs.
All admin/owner comparisons must go through `lib/group.js` (`getAdmins` collects every id/jid/
phoneNumber variant; `botJids()` covers the bot's phone JID + LID) and `msg.key.participantPn`.
Never compare raw JID strings.

**"Aguardando mensagem" fix:** the socket has a `getMessage` callback backed by
`lib/msgcache.js`; every sent message is cached (wrapped `sock.sendMessage`) so decryption
retries can be honored. Keep this intact when touching `connection.js`.

**Interactive UI warning:** listMessage / nativeFlow buttons / poll-menus were all tried and
**removed** — none renders consistently across phone + Web/Desktop for normal accounts. The
menu is 100% text (`/menu`, `/menu <categoria>`, `/menu geral`, `/menu <comando>` — rendering
in `lib/menuview.js`). Don't reintroduce interactive formats without testing on both.

### Adding a command

Drop a file in `src/commands/` exporting
`{ name, aliases?, category?, cooldown?, ownerOnly?, groupOnly?, adminOnly?, botAdmin?, desc?, run(ctx) }`.
A file may also export an **array** of such objects (see `redes.js`).
It is auto-registered. Permission flags are enforced by the handler before `run`:
- `ownerOnly` → only `config.owner.numbers` (or the hosting account itself)
- `groupOnly` → only in groups
- `adminOnly` → group admins (or owner)
- `botAdmin` → the bot itself must be group admin
- `cooldown` (seconds) → per-user rate limit via `lib/ratelimit.js` (owners exempt)
- `category` → menu grouping. Internal names (`Geral`, `Jogos`, `Admin`, …) are mapped to
  display labels (Utilidades, Diversão, Administração) by `lib/categories.js`; `ownerOnly` ⇒
  Dono, `adminOnly` ⇒ Admin. Don't put display labels in command files.

When a command sets `adminOnly`/`botAdmin`, the handler resolves `groupMetadata` once and
passes `isAdmin`, `isBotAdmin`, `groupMetadata` in `ctx`. Full `ctx`: `sock, msg, args, text,
from, sender, isGroup, isOwner, isAdmin, isBotAdmin, groupMetadata, config, commands, reply`.

This per-file design is the whole point of the rewrite — adding/removing features no longer
means editing one giant obfuscated blob.

### Conventions

- **Visual style lives only in `src/ui/theme.js`.** Don't hardcode emojis/borders in commands;
  use `theme.emoji` and `theme.box()`.
- **Owner/identity comes only from config.** Never hardcode owner numbers (the legacy bot had
  `5512978986457` scattered everywhere). Use `config.owner` / `config.isOwner()`.
- **CommonJS** (`require`), Node 20+. Keep it consistent for easy porting from `legacy/`.
- **Persistence** goes through `lib/store.js` — `store('name')` returns a collection backed by
  `data/name.json` with in-memory cache and atomic, queued writes. Never `fs.writeFileSync`
  raw JSON like the legacy did (that caused the corruption/race issues). Current collections:
  `levels` (XP), `groups` (toggles like welcome), `counters` (per-group message counts),
  `warns` (advertências), and per-group game state (`ttt`, `forca`, `anagrama`, `quiz`).

## Porting from legacy

`legacy/` holds the original bot. Useful references:
- `legacy/menus/*.js` — the full list of old commands/menus (what to port or drop).
- `legacy/armor/funcoes/functions.js` — readable helpers to reimplement in `src/lib/`.
- `legacy/dono/*.json` — old feature flags and data structure.

The three core legacy files (`legacy/index.js` ~4.2MB, `connect.js`, `consts-func.js`) are
**obfuscated** — read them only to infer behavior, never to copy.
