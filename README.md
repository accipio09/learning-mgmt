# learning-mgmt

A personal learning management system that ingests daily news briefs (rotating across 7 languages by day of week), generates spaced-repetition study nodes using Claude, and provides a chat interface for discussing brief content.

## Features

- **Daily briefs** — Drop a markdown file into `briefs/` and it gets parsed, stored, and displayed with full markdown rendering
- **Learning nodes** — Click any bullet point to generate a study exercise (flashcard, multiple choice, or free response) via Claude
- **Spaced repetition** — SM-2 algorithm schedules reviews based on your performance ratings
- **Brief chat** — Ask questions about any brief with a persistent chat history backed by Claude
- **Node library** — Browse all previously created nodes organized by week
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
  db/                # SQLite schema and client
client/src/
  pages/             # BriefsPage, ArchivePage, LibraryPage, StudyPage
  components/        # NavBar, BriefChat
  i18n/locales/      # Translation files (de, ru, ja, uk, es, fr, vi)
  lib/               # API client, utilities
```

## Notes

This is a single-user local application. There is no authentication — all endpoints are open. Do not deploy this to a public server without adding auth.

## License

MIT
