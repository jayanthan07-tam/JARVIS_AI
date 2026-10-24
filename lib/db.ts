import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const configuredDataDir = process.env.JARVIS_DATA_DIR?.trim();
const DATA_DIR = configuredDataDir
  ? path.resolve(configuredDataDir)
  : path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "jarvis.db");

// Singleton connection
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      fact TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      due_time TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
}

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: number;
}

export interface Memory {
  id: string;
  fact: string;
  category: string;
  created_at: number;
}

export interface Reminder {
  id: string;
  title: string;
  due_time: string;
  completed: number;
  created_at: number;
}
