# Nexus Bible

A modern Bible study application for the BSB (Berean Standard Bible) translation, featuring a comprehensive reader, library, study tools, and personal notes with local sync.

## Features

- **Reader**: Browse any chapter with audio playback
- **Library**: Organized book catalog by category
- **Search**: Full-text search across the English Bible database
- **Study Tools**: 
  - Compare multiple translations side-by-side
  - Read commentaries from various scholars
  - Follow cross-references with datasets
  - Word frequency analysis and study
- **Personal Sync**: Notes, highlights, and reading plans with local SQLite storage
- **Deep Links**: Direct passage links `/read/{translation}/{book}/{chapter}`

## Quick Start

### One-Line Install (Ubuntu/Debian)

Install everything automatically:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nexus-bible/main/install.sh | bash
```

The install script will:
- ✅ Install Node.js and dependencies
- ✅ Download the Bible database (~100MB)
- ✅ Set up environment configuration
- ✅ Build the application
- ✅ Optionally configure PM2 or systemd

**See [INSTALL.md](INSTALL.md) for detailed options** • **[Installation Guide](INSTALL_SCRIPT_GUIDE.md)**

### Manual Development Setup

```bash
# Install dependencies
npm install

# Start frontend only
npm run dev

# Start both frontend + backend server
npm run dev:full
```

Frontend: http://localhost:5173  
Backend API: http://localhost:8787

### Setup Search Database

Download the English Bible database for full-text search:

```bash
# Create data directory
mkdir -p server/data

# Download database (~100MB)
curl -L -o server/data/bible.eng.db https://bible.helloao.org/bible.eng.db
```

## Project Structure

```
nexus-bible/
├── src/
│   ├── App.tsx           # Main application routes and components
│   ├── App.css           # Global styles
│   ├── api/
│   │   ├── bsbClient.ts  # Bible API integration
│   │   └── localDbClient.ts  # Local server API
│   └── assets/
├── server/
│   ├── index.ts          # Express server with SQLite
│   └── data/             # Database files (gitignored)
├── public/
└── index.html
```

## Available Routes

- `/` - Bible reader
- `/overview` - Feature overview and daily focus
- `/read/:translation/:book/:chapter` - Direct passage link
- `/search` - Full-text Bible search
- `/library` - Browse books by category
- `/notes` - Personal notes, highlights, and reading plans
- `/tools` - Study tools overview
- `/tools/compare` - Compare translations
- `/tools/word-study` - Word frequency analysis
- `/tools/commentary` - Read commentaries
- `/tools/cross-references` - Explore cross-references
- `/diagnostics` - API connectivity check
- `/signup` - Create account for local sync

## Technologies

- **Frontend**: React 18, TypeScript, React Router, Vite
- **Backend**: Express, SQLite (better-sqlite3), JWT auth
- **API**: Free Use Bible API (bible.helloao.org)
- **Styling**: Custom CSS with CSS variables

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
BSB_JWT_SECRET=your-secret-key
BSB_DB_PATH=./server/data/bsb.sqlite
BSB_BIBLE_DB_PATH=./server/data/bible.eng.db
BSB_ORIGIN=http://localhost:5173
PORT=8787
```

## Building for Production

```bash
# Build frontend
npm run build

# Preview production build
npm run preview

# Build backend (if deploying compiled)
npm run build:server
npm run start:server
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment guides including:

- VPS deployment with Nginx and PM2
- Serverless split (Vercel + Railway/Render)
- Docker containerization
- Large-scale cloud architecture

**Recommended for initial deployment**: 
- Frontend: Vercel (free tier, global CDN)
- Backend: Railway or Render ($0-10/month)

## Development Scripts

- `npm run dev` - Start Vite dev server
- `npm run server` - Start backend only (with watch mode)
- `npm run dev:full` - Start both frontend and backend
- `npm run build` - Build frontend for production
- `npm run build:server` - Compile backend TypeScript
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## API Integration

The app uses the Free Use Bible API from bible.helloao.org:

- **Development**: Proxied through Vite (`/bible-api/*`)
- **Production**: Configure proxy in your deployment platform

All Bible data fetching is abstracted in `src/api/bsbClient.ts`.

## Local Sync Features

When signed in, the following are synced to the local SQLite database:

- **Notes**: Reference-based scripture notes
- **Highlights**: Colored highlights with optional notes
- **Reading Plans**: Custom reading plans with progress tracking

Data is stored in `server/data/bsb.sqlite` (auto-created on first run).

## License

This project uses the Free Use Bible API. Check [bible.helloao.org](https://bible.helloao.org) for API usage terms.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` to check for issues
5. Submit a pull request

---

For deployment questions, see [DEPLOYMENT.md](./DEPLOYMENT.md).
