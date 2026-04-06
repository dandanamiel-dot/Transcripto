# Transcripto

Hebrew-first transcription web app for journalists.

## Project Structure

- `frontend/` — Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui, TypeScript
- `backend/` — FastAPI, SQLAlchemy async, SQLite, Python 3.13

## Running

### Frontend
```bash
cd frontend && npm run dev
```

### Backend
```bash
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Key Conventions

- UI is full Hebrew (RTL). Root layout uses `lang="he" dir="rtl"`.
- Font: Heebo (Google Fonts, Hebrew subset).
- All Hebrew UI strings live in `frontend/src/lib/constants.ts`.
- Logo and app name "Transcripto" stay in English.
- Purple accent theme (`oklch(0.55 0.22 275)`).
- Backend API prefix: `/api/`.
- Transcription engine: faster-whisper (local, CPU).
