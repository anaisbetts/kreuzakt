import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface DocumentsTable {
  id: Generated<number>;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_hash: string;
  file_size: number;
  page_count: number | null;
  title: string;
  description: string;
  document_date: string | null;
  content: string;
  added_at: string;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface DocumentsFtsTable {
  title: string;
  description: string;
  content: string;
  original_filename: string;
}

export interface ProcessingQueueTable {
  id: Generated<number>;
  filename: string;
  status: Generated<ProcessingStatus>;
  error: string | null;
  document_id: number | null;
  created_at: Generated<string>;
  completed_at: string | null;
}

export interface DB {
  documents: DocumentsTable;
  documents_fts: DocumentsFtsTable;
  processing_queue: ProcessingQueueTable;
}

export type DocumentRow = Selectable<DocumentsTable>;
export type NewDocument = Insertable<DocumentsTable>;
export type DocumentUpdate = Updateable<DocumentsTable>;

export type QueueRow = Selectable<ProcessingQueueTable>;
export type NewQueueRow = Insertable<ProcessingQueueTable>;
export type QueueUpdate = Updateable<ProcessingQueueTable>;
