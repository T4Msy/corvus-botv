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
  connection.js   # Baileys socket: QR, auto-reconnect; wires onMessage + onGroupParticipants
  config.js       # loads config/settings.json + .env, exposes config.isOwner()
  handler.js      # message → XP grant → prefix → resolve command → permissions → run
  commands/       # one file per command, auto-loaded by _registry.js
    _registry.js  # scans *.js (except _-prefixed) into a Map (name + aliases)
    ping menu dono sticker level rank          # general
    ban promover rebaixar grupo todos link welcome  # group admin
  events/
    groupParticipants.js  # join/leave welcome messages (toggle via !welcome)
  lib/
    store.js      # atomic JSON persistence (cache + tmp+rename + write queue)
    leveling.js   # XP/level system (uses store('levels'))
    group.js      # getAdmins(), botJid(), getTargets()
    media.js      # resolveMedia()/downloadMedia() for quoted/own media
    sticker.js    # createSticker(): sharp (image) + ffmpeg-static (video) + node-webpmux (EXIF)
    fetch.js text.js
  ui/
    theme.js      # SINGLE source of visual style: emojis, palette, menu box()
    banner.js     # terminal CORVUS banner (cfonts)
config/settings.json  # prefix, botName, iaName, owner T4, flags
assets/           # stickers/<category>/ (ex-FIGURINHAS), audios/, images/ (ex-logos)
data/             # runtime: WhatsApp session + JSON state (gitignored)
legacy/           # archived Sakura-Bot v6 — reference only, do not run/edit
```

### How a command flows

1. `connection.js` emits `messages.upsert` → `handler.js`.
2. The handler extracts text (`extractText` covers conversation / captions), checks the
   prefix, splits into command + args, and looks the command up in the registry Map.
3. It enforces `ownerOnly` (via `config.isOwner(sender)`) and `groupOnly`, then calls
   `command.run(ctx)`. Errors are caught per-message — a failing command never crashes the bot.

### Adding a command

Drop a file in `src/commands/` exporting
`{ name, aliases?, ownerOnly?, groupOnly?, adminOnly?, botAdmin?, desc?, run(ctx) }`.
It is auto-registered. Permission flags are enforced by the handler before `run`:
- `ownerOnly` → only `config.owner.numbers`
- `groupOnly` → only in groups
- `adminOnly` → group admins (or owner)
- `botAdmin` → the bot itself must be group admin

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
  `levels` (XP) and `groups` (per-group toggles like welcome).

## Porting from legacy

`legacy/` holds the original bot. Useful references:
- `legacy/menus/*.js` — the full list of old commands/menus (what to port or drop).
- `legacy/armor/funcoes/functions.js` — readable helpers to reimplement in `src/lib/`.
- `legacy/dono/*.json` — old feature flags and data structure.

The three core legacy files (`legacy/index.js` ~4.2MB, `connect.js`, `consts-func.js`) are
**obfuscated** — read them only to infer behavior, never to copy.
