export interface MasterNoteSummary {
  id: string;
  master_id: string;
  title: string;
  preview: string;
  updated_at: string;
}

export interface MasterNote extends MasterNoteSummary {
  content: string;
}

export type NoteSaveStatus = "idle" | "saving" | "saved" | "error";

export interface PendingNoteDraft {
  id: string;
  master_id: string;
  title: string;
  content: string;
  updated_at: string;
}
