# Transcripto

Hebrew-first transcription web app for journalists. Upload video/audio, get transcripts with timestamps, and auto-tag key moments for the edit room.

## Features (Phase 1 - Current)

- **RTL Hebrew UI** — Full Hebrew interface with Heebo font, purple accent theme
- **Dashboard** — Project overview with stats and recent activity
- **Project Management** — Create, list, and view transcription projects
- **File Upload** — Drag-and-drop media upload (MP4, MP3, WAV, M4A, WebM, OGG)
- **Transcription** — faster-whisper (local) with Hebrew language support
- **Transcript Viewer** — Timestamped segments display
- **Tag System** — Manual tags with categories (quote, topic change, emotion, keyword, name/place)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, TypeScript |
| Backend | FastAPI, SQLAlchemy (async), SQLite, Python 3.13 |
| Transcription | faster-whisper (Whisper large-v3), ffmpeg |
| Font | Heebo (Google Fonts, Hebrew subset) |

## Getting Started

### Prerequisites

- Node.js 24+
- Python 3.13+
- ffmpeg installed (`brew install ffmpeg`)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:3000

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API at http://localhost:8000 (docs at /docs)

### Environment

Copy and edit the backend `.env`:

```
DATABASE_URL=sqlite+aiosqlite:///./storage/transcripto.db
UPLOAD_DIR=./storage/uploads
AUDIO_DIR=./storage/audio
DEFAULT_LANGUAGE=he
WHISPER_MODEL=large-v3
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Next Steps

### Phase 2: Transcription UX
- [ ] WebSocket real-time progress during transcription
- [ ] Media player (HTML5 audio/video) synced with transcript — click segment to seek
- [ ] Segment text editing (inline corrections)
- [ ] Multi-engine support (add Groq API, Google Gemini, HuggingFace ivrit-ai)

### Phase 3: Tagging & Intelligence
- [ ] AI auto-tagging — send transcript to LLM to detect quotes, topic changes, emotions, keywords, names/places
- [ ] Tag editor dialog — create/edit/delete tags with category picker and color coding
- [ ] Tag markers on media timeline
- [ ] Filter tags by category and type (auto vs manual)

### Phase 4: Export & Polish
- [ ] Export transcripts: SRT, VTT, TXT, JSON formats
- [ ] WaveSurfer.js waveform visualization with tag markers
- [ ] Dashboard stats panel with charts
- [ ] Framer Motion page transitions and micro-animations
- [ ] Keyboard shortcuts (play/pause, seek, save)

### Phase 5: Advanced
- [ ] Speaker diarization (who said what)
- [ ] Batch processing (multiple files)
- [ ] Project search and filtering
- [ ] Settings page (engine selection, API keys, preferences)
- [ ] EDL export for professional video editors

## License

MIT
