<p align="center">
  <img src="docs/screenshot.png" alt="Cursor Learn" width="800" />
</p>

# Cursor Learn

A desktop app to browse, search, and learn from your Cursor AI conversations.

## Features

- **Browse Conversations** - View all your Cursor chat and composer conversations organized by project
- **Search** - Full-text search across all your conversations
- **AI-Powered Summaries** - Generate compact summaries and overviews of long conversations
- **Resource Discovery** - AI finds relevant learning resources based on conversation topics
- **Notes** - Take notes with rich text editing
- **Snippets** - Save and organize code snippets from conversations
- **Todos** - Track learning tasks and reminders
- **Agent Chat** - Continue conversations with AI using your own API keys
- **Export to PDF** - Export conversations and summaries

## Tech Stack

- **Framework**: [Nextron](https://github.com/nicegram/nextron) (Next.js + Electron)
- **UI**: React, Tailwind CSS, Radix UI
- **Database**: SQLite (better-sqlite3) with Drizzle ORM
- **AI**: Vercel AI SDK with multi-provider support

## Development

### Prerequisites

- Node.js 20+
- Yarn

### Install

```bash
yarn install
```

### Run

```bash
yarn dev
```

### Build

```bash
yarn build
```

Outputs the packaged app to `dist/`.

## Releasing

Releases are handled via GitHub Actions. The workflow builds the app on macOS and creates a GitHub release with the DMG.

### Option 1: GitHub UI (Recommended)

1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Enter the version (e.g., `1.0.1`)
4. Click **Run workflow**

### Option 2: Terminal (requires [GitHub CLI](https://cli.github.com/))

```bash
# Release current version from package.json
yarn release

# Or specify a version
gh workflow run release.yml -f version=1.0.1
```

### Setup Requirements

To push workflow files, your GitHub PAT needs the `workflow` scope:
1. Go to [GitHub Token Settings](https://github.com/settings/tokens)
2. Edit your token → check **workflow** → Save

## License

MIT
