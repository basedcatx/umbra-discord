# Dun — Agent Guide

## Project layout

- Everything lives in `src/` (package.json, tsconfig, all source code, commands, events)
- Work from `src/` for all commands and imports

## Commands & events

- Interaction commands go in `commands/interaction/`, message commands in `commands/message/`
- Each command file must `export default { name, description, data, cooldown, execute(client, interaction) }`
- Event files must `export default { name, once, execute(client, ...args) }`

## Working style — the user is training to be a GOAT at software engineering

- **Race conditions / Redis subtleties: hint, don't fix.** Give the location, the pattern name (TOCTOU, lost update, NX semantics, TTL leak, etc.), and guiding questions — then let the user attempt the fix. The suffering IS the point.
- Only give the full fix when the user explicitly says so ("show me", "just fix it"), or they've made a genuine attempt and are stuck. If they're burning the whole session, step in.
- **Non-Redis correctness bugs** (off-by-ones, dead logic, etc.) get flagged directly with full detail — that is not the muscle being trained.

## Running

```sh
bun ./index.ts          # run the bot
bun deploy_cmds.ts      # register slash commands
```

## Linting & testing

- Lint: `bun run lint` runs oxlint (config at `.oxlintrc.json`)
- Test: `bun test` (zero-config, picks up `*.test.ts`) — 16 tests across 4 files
- No typecheck script exists; tsconfig is strict with `moduleResolution: "bundler"`

## Framework

- **discord.js v14.26.2** with Components v2 API (`MessageFlags.IsComponentsV2`, `ContainerBuilder`, `TextDisplayBuilder`)
- Game state lives on the client: `client.gameManagers` keyed by channel Snowflake, `client.playerManagers`
- GameManager is singleton per channel — always use `GameManager.fromChannelId(id, client)`

## Game state & phase flow

- Game loop order: DAY → NIGHT → resolveNight → VOTING → resolveVoting → check win → repeat
- Phases: `GamePhase.LOBBY`, `DAY`, `NIGHT`, `VOTING` — `VOTING` is set inside `runVotingPhase` and properly gated
- PlayerFlags (`WasKilled`, `WasSaved`, `HasPerformedAction`) are transient night-cycle flags, cleared in `resolveNightPhase`
- Death tracking uses `LifeStatus.ALIVE` / `LifeStatus.DEAD`, set in `resolveNightPhase` / `resolveVotingPhase`
- Dead players are locked out of button interactions in both `runDayPhase` and `runNightPhase`
- `PlayerFlags.WasKilled` is checked in the night "Check life status" button — shows attack warning before resolution
- Game over announcement sent via `announcementComponent` when loop exits, then `this.reset()` clears state
- Winner = either `PlayerRole.IMP` (Imposters) or `PlayerRole.TOWNIE` (Townies); winning team members are mentioned

## Known codebase gaps (don't assume these work)

- `GamePhase.VOTING` defined but never set in the game loop (cycle is DAY → NIGHT → DAY)
- `round` hardcoded to `0` or `1` everywhere — not tracked
- `types.d.ts` imports from `../structures/game/` but files are at `../structures/` (no `game/` subdir)
- `GameQueueManager`, `LobbyManager`, `GameQueueManagerError`, `LobbyManagerError`, `PlayerManagerError` imported but don't exist
- `GuildChannelConfig` type and `GAME_GUILD_CHANNEL_SETTINGS_DEFAULTS` constant referenced in schema but undefined
- Redis imported in `database/index.ts` but entirely commented out in `index.ts`

## Database

- **Drizzle ORM** + **postgres-js** driver; config at `drizzle.config.ts`
- Schema: `database/schemas/`, migrations: `database/drizzle/`
- Generate: `bunx drizzle-kit generate`, migrate: `bunx drizzle-kit migrate`
- `.env` required at `src/.env` with: `BOT_API_TOKEN`, `BOT_CLIENT_ID`, `DATABASE_URL`, `DATABASE_POOL_URL`, `SUPPORT_GUILD_ID`, `SUPPORT_DEVELOPMENT_CHANNEL_ID`

## Install

```sh
bun install
```
