export const APP_NAME = "Transcripto";

export const HE = {
  // Navigation
  nav: {
    dashboard: "לוח בקרה",
    projects: "פרויקטים",
    newProject: "פרויקט חדש",
    settings: "הגדרות",
    search: "חיפוש...",
    overview: "סקירה כללית",
    management: "ניהול",
  },

  // Dashboard
  dashboard: {
    welcome: "בוקר טוב",
    subtitle: "נהל את התמלולים שלך בקלות",
    totalProjects: "סה״כ פרויקטים",
    inProgress: "בתהליך",
    completed: "הושלמו",
    recentProjects: "פרויקטים אחרונים",
    viewAll: "הצג הכל",
    noProjects: "אין פרויקטים עדיין",
    startFirst: "התחל את הפרויקט הראשון שלך",
    stats: "סטטיסטיקה",
  },

  // Projects
  project: {
    title: "כותרת",
    description: "תיאור",
    created: "נוצר",
    updated: "עודכן",
    duration: "משך",
    status: "סטטוס",
    engine: "מנוע תמלול",
    actions: "פעולות",
    delete: "מחק",
    edit: "ערוך",
    export: "ייצוא",
    transcribe: "תמלל",
    autoTag: "תיוג אוטומטי",
    uploadFile: "העלאת קובץ",
    dragDrop: "גרור ושחרר קבצים כאן",
    orClick: "או לחץ לבחירת קבצים",
    supportedFormats: "פורמטים נתמכים: MP4, MP3, WAV, M4A, WebM, OGG",
    newProject: "פרויקט חדש",
    allProjects: "כל הפרויקטים",
    multipleFiles: "העלאה מרובה",
    filesSelected: "קבצים נבחרו",
    uploadingFile: "מעלה",
    batchUploadComplete: "ההעלאה הושלמה",
    searchProjects: "חיפוש פרויקטים...",
    noResults: "לא נמצאו פרויקטים",
    filterByStatus: "סנן לפי סטטוס",
    all: "הכל",
  },

  // Status
  status: {
    uploaded: "הועלה",
    extracting_audio: "מחלץ אודיו",
    processing: "מעבד",
    transcribed: "תומלל",
    tagging: "מתייג",
    tagged: "תויג",
    reviewed: "נבדק",
    completed: "הושלם",
  },

  // Tags
  tags: {
    title: "תגיות",
    addTag: "הוסף תגית",
    editTag: "ערוך תגית",
    deleteTag: "מחק תגית",
    label: "תווית",
    category: "קטגוריה",
    notes: "הערות",
    auto: "אוטומטי",
    manual: "ידני",
    quote: "ציטוט",
    topic_change: "שינוי נושא",
    emotion: "רגש",
    keyword: "מילת מפתח",
    name_place: "שם/מקום",
    timestamp: "חותמת זמן",
    endTimestamp: "חותמת זמן סיום",
    segment: "קטע",
    selectCategory: "בחר קטגוריה",
    selectSegment: "בחר קטע",
    noTags: "אין תגיות עדיין",
    autoTagging: "מתייג אוטומטית...",
    confirmDelete: "האם למחוק תגית זו?",
  },

  // LLM Providers
  llmProviders: {
    title: "ספק AI",
    select: "בחר ספק",
    unavailable: "לא זמין",
  },

  // Player
  player: {
    play: "נגן",
    pause: "השהה",
    forward: "קדימה 5 שניות",
    rewind: "אחורה 5 שניות",
    speed: "מהירות",
    noAudio: "אין קובץ אודיו",
  },

  // Transcript
  transcript: {
    title: "תמליל",
    noTranscript: "אין תמליל עדיין",
    startTranscription: "התחל תמלול",
    segments: "קטעים",
    speaker: "דובר",
    confidence: "ביטחון",
    extractingAudio: "מחלץ אודיו...",
    transcribing: "מתמלל...",
    diarizing: "מזהה דוברים...",
    diarize: "זיהוי דוברים",
    transcriptionComplete: "התמלול הושלם",
    transcriptionError: "שגיאה בתמלול",
    liveSegments: "קטעים בזמן אמת",
  },

  // Engines
  engines: {
    title: "מנוע תמלול",
    select: "בחר מנוע",
    unavailable: "לא זמין",
  },

  // Export
  export: {
    title: "ייצוא",
    format: "פורמט",
    download: "הורדה",
    downloading: "מוריד...",
    exportSuccess: "הקובץ הורד בהצלחה",
    exportError: "שגיאה בייצוא",
    formats: {
      srt: "SRT (כתוביות)",
      vtt: "VTT (אינטרנט)",
      txt: "TXT (טקסט)",
      json: "JSON (נתונים מלאים)",
      edl: "EDL (עורכי וידאו)",
    },
  },

  // Common
  common: {
    save: "שמור",
    cancel: "ביטול",
    close: "סגור",
    loading: "טוען...",
    error: "שגיאה",
    success: "הצלחה",
    confirm: "אישור",
    back: "חזור",
    next: "הבא",
    of: "מתוך",
  },
} as const;

export const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-100 text-blue-700",
  extracting_audio: "bg-yellow-100 text-yellow-700",
  processing: "bg-orange-100 text-orange-700",
  transcribed: "bg-emerald-100 text-emerald-700",
  tagging: "bg-purple-100 text-purple-700",
  tagged: "bg-violet-100 text-violet-700",
  reviewed: "bg-cyan-100 text-cyan-700",
  completed: "bg-green-100 text-green-700",
};

// Hebrew letters alef..yod for speaker labels
const SPEAKER_HEBREW_LETTERS = [
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
];

/** Map a pyannote speaker id like "SPEAKER_00" to a Hebrew label "דובר א". */
export function speakerLabel(speaker: string | null | undefined): string | null {
  if (!speaker) return null;
  const match = speaker.match(/(\d+)/);
  if (!match) return speaker;
  const idx = parseInt(match[1], 10);
  const letter = SPEAKER_HEBREW_LETTERS[idx] ?? String(idx + 1);
  return `דובר ${letter}`;
}

/** Consistent color per speaker index. */
export function speakerColor(speaker: string | null | undefined): string {
  const palette = [
    "#8B5CF6",
    "#F59E0B",
    "#10B981",
    "#EF4444",
    "#3B82F6",
    "#EC4899",
    "#14B8A6",
    "#F97316",
  ];
  if (!speaker) return palette[0];
  const match = speaker.match(/(\d+)/);
  const idx = match ? parseInt(match[1], 10) : 0;
  return palette[idx % palette.length];
}

export const TAG_CATEGORY_COLORS: Record<string, string> = {
  quote: "#8B5CF6",
  topic_change: "#F59E0B",
  emotion: "#EF4444",
  keyword: "#3B82F6",
  name_place: "#10B981",
};

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
