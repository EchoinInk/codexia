import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ContinuousEngineeringState } from "./types";

export class ContinuousEngineeringStore {
  private readonly file: string;
  constructor(workspace: string) {
    this.file = path.resolve(workspace, ".codexia/runtime/continuous-engineering.json");
  }
  async load(): Promise<ContinuousEngineeringState | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as ContinuousEngineeringState;
      if (!parsed || parsed.version !== 1 || typeof parsed.enabled !== "boolean" || !Array.isArray(parsed.decisions)) {
        throw new Error("Corrupt continuous-engineering state");
      }
      return parsed;
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
  }
  async save(state: ContinuousEngineeringState): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.file);
  }
}
