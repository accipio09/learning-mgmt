# learning-mgmt

A personal learning management system that ingests daily news briefs (rotating across 7 languages by day of week), generates spaced-repetition study nodes using Claude, and provides a chat interface for discussing brief content.

## Features

- **Daily briefs** — Drop a markdown file into `briefs/` and it gets parsed, stored, and displayed with full markdown rendering
- **Learning nodes** — Click any bullet point to generate a study exercise (flashcard, multiple choice, or free response) via Claude
- **Anki import** — Migrate existing Anki decks (`.apkg` files) with full SM-2 scheduling preservation via `import-anki` script
- **Spaced repetition** — SM-2 algorithm schedules reviews based on your performance ratings
- **Deck filtering** — Choose which decks to study, with an option to override SM-2 and review all cards
- **Brief chat** — Ask questions about any brief with a persistent chat history backed by Claude
- **Node library** — Browse all previously created nodes organized by deck name with exercise counts
- **7 languages** — UI rotates daily: Monday (German), Tuesday (Russian), Wednesday (Japanese), Thursday (Ukrainian), Friday (Spanish), Saturday (French), Sunday (Vietnamese)

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, i18next
- **Backend**: Express, better-sqlite3, TypeScript
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Algorithm**: SM-2 spaced repetition

## Setup

```bash
# Install all dependencies (root, server, client)
npm run install:all

# Create your environment file
cp .env.example .env
# Edit .env and add your Anthropic API key

# Start development (server + client concurrently)
npm run dev
```

The client runs on `http://localhost:5173` and proxies API requests to the Express server on port 3001.

## Project Structure

```
briefs/              # Drop markdown briefs here (watched by server)
server/src/
  routes/            # Express API routes (briefs, nodes, chat)
  services/          # Claude integration, brief parser, SM-2 algorithm
  scripts/           # import-anki.ts CLI script
  db/                # SQLite schema and client
client/src/
  pages/             # BriefsPage, ArchivePage, LibraryPage, StudyPage
  components/        # NavBar, BriefChat
  i18n/locales/      # Translation files (de, ru, ja, uk, es, fr, vi)
  lib/               # API client, utilities
```

## Anki Import

Import an existing Anki `.apkg` export into the system, preserving SM-2 scheduling state:

```bash
cd server
npx tsx src/scripts/import-anki.ts /path/to/deck.apkg \
  --map "DeckName=lang,OtherDeck=lang" \
  --dry-run  # preview without writing
```

Each Anki deck becomes a node set. The `--map` flag assigns a language code (`de`, `ru`, `ja`, `uk`, `es`, `fr`, `vi`, `en`) to each deck name. Cards with images are skipped. HTML entities are cleaned automatically.

## Notes

This is a single-user local application. There is no authentication — all endpoints are open. Do not deploy this to a public server without adding auth.

## License

MIT
