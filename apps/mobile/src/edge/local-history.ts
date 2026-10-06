import * as FileSystem from "expo-file-system/legacy";
import type { LocalTurn } from "./local-assistant";

const ROOT = `${FileSystem.documentDirectory}openmuse-edge/local-apps/`;
const CHAT_FILE = `${ROOT}chat-history.json`;
const LANGUAGE_FILE = `${ROOT}language-progress.json`;

export type LanguageProgress = {
  language: string;
  level: string;
  practiceTurns: number;
  lastPracticedAt?: string;
};

async function ensureRoot() {
  await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
}

async function readJson<T>(uri: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return fallback;
    return JSON.parse(await FileSystem.readAsStringAsync(uri)) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(uri: string, value: unknown) {
  await ensureRoot();
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(value, null, 2));
}

export async function loadChatHistory() {
  return readJson<LocalTurn[]>(CHAT_FILE, []);
}

export async function saveChatHistory(turns: LocalTurn[]) {
  await writeJson(CHAT_FILE, turns.slice(-40));
}

export async function clearChatHistory() {
  await FileSystem.deleteAsync(CHAT_FILE, { idempotent: true });
}

export async function loadLanguageProgress() {
  return readJson<LanguageProgress>(LANGUAGE_FILE, {
    language: "French",
    level: "Beginner",
    practiceTurns: 0,
  });
}

export async function saveLanguageProgress(progress: LanguageProgress) {
  await writeJson(LANGUAGE_FILE, progress);
}
