import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NotificationPreferences, NotificationPreferencesStore } from "./types";

const defaults: NotificationPreferences = { enabled: true, events: ["progress", "action_required", "approval", "completed", "failed", "recovery", "developer_action"] };

export class FileNotificationPreferencesStore implements NotificationPreferencesStore {
  private readonly file: string;
  constructor(workspace: string) {
    this.file = path.resolve(workspace, ".codexia/runtime/notification-preferences.json");
  }
  async load(): Promise<NotificationPreferences | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as NotificationPreferences;
      if (typeof parsed.enabled !== "boolean" || !Array.isArray(parsed.events) ||
        parsed.events.some(event => !defaults.events.includes(event))) throw new Error("Corrupt notification preferences");
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
      throw error;
    }
  }
  async save(preferences: NotificationPreferences): Promise<void> {
    const safe = { enabled: !!preferences.enabled, events: [...new Set(preferences.events)].filter(event => defaults.events.includes(event)) };
    await mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(safe, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.file);
  }
}

export const defaultNotificationPreferences = (): NotificationPreferences => structuredClone(defaults);
