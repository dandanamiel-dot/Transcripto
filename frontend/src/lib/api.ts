import { BACKEND_URL } from "./constants";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  original_filename: string;
  file_path: string | null;
  audio_path: string | null;
  duration_seconds: number | null;
  status: string;
  transcription_engine: string | null;
  speaker_names: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: number;
  project_id: number;
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
  confidence: number | null;
  speaker: string | null;
}

export interface Tag {
  id: number;
  project_id: number;
  segment_id: number | null;
  label: string;
  tag_type: "auto" | "manual";
  category: string | null;
  timestamp: number | null;
  end_timestamp: number | null;
  color: string;
  notes: string | null;
  created_at: string;
}

export interface Engine {
  name: string;
  label: string;
  label_he: string;
  available: boolean;
}

export interface LlmProvider {
  name: string;
  label: string;
  label_he: string;
  available: boolean;
}

export interface DashboardStats {
  total_projects: number;
  in_progress: number;
  completed: number;
  recent_projects: Project[];
}

export const api = {
  dashboard: {
    stats: () => request<DashboardStats>("/api/dashboard/stats"),
  },

  projects: {
    list: () => request<Project[]>("/api/projects"),
    get: (id: number) => request<Project>(`/api/projects/${id}`),
    create: (formData: FormData) =>
      fetch(`${BACKEND_URL}/api/projects`, { method: "POST", body: formData }).then(
        async (res) => {
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
          return res.json() as Promise<Project>;
        }
      ),
    update: (id: number, data: Partial<Project>) =>
      request<Project>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/api/projects/${id}`, { method: "DELETE" }),
    transcribe: (id: number, engine?: string, diarize?: boolean) => {
      const params = new URLSearchParams();
      if (engine) params.set("engine", engine);
      if (diarize != null) params.set("diarize", String(diarize));
      const query = params.toString();
      return request<{ message: string }>(
        `/api/projects/${id}/transcribe${query ? `?${query}` : ""}`,
        { method: "POST" },
      );
    },
  },

  segments: {
    list: (projectId: number) =>
      request<Segment[]>(`/api/projects/${projectId}/segments`),
    update: (projectId: number, segmentId: number, text: string) =>
      request<Segment>(`/api/projects/${projectId}/segments/${segmentId}`, {
        method: "PUT",
        body: JSON.stringify({ text }),
      }),
  },

  tags: {
    list: (projectId: number) =>
      request<Tag[]>(`/api/projects/${projectId}/tags`),
    create: (projectId: number, data: Partial<Tag>) =>
      request<Tag>(`/api/projects/${projectId}/tags`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (projectId: number, tagId: number, data: Partial<Tag>) =>
      request<Tag>(`/api/projects/${projectId}/tags/${tagId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (projectId: number, tagId: number) =>
      request<void>(`/api/projects/${projectId}/tags/${tagId}`, {
        method: "DELETE",
      }),
    autoTag: (projectId: number, provider?: string) =>
      request<Tag[]>(
        `/api/projects/${projectId}/auto-tag${provider ? `?provider=${encodeURIComponent(provider)}` : ""}`,
        { method: "POST" },
      ),
  },

  engines: {
    list: () => request<Engine[]>("/api/engines"),
  },

  llmProviders: {
    list: () => request<LlmProvider[]>("/api/llm-providers"),
  },

  exports: {
    create: async (
      projectId: number,
      format: string,
    ): Promise<{ blob: Blob; filename: string }> => {
      const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Export failed ${res.status}: ${body}`);
      }
      const blob = await res.blob();
      // Parse Content-Disposition for a filename if available.
      const disposition = res.headers.get("content-disposition") || "";
      let filename = `transcript.${format}`;
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match) {
        try {
          filename = decodeURIComponent(utf8Match[1]);
        } catch {
          /* ignore */
        }
      } else {
        const basicMatch = disposition.match(/filename="([^"]+)"/i);
        if (basicMatch) filename = basicMatch[1];
      }
      return { blob, filename };
    },
  },
};
