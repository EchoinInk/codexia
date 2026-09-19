export interface FileBufferState {
  path: string;
  content: string;
  original: string;
  version?: string;
  loading: boolean;
  editing: boolean;
  saving: boolean;
  error?: string;
}
const empty = (path: string): FileBufferState => ({ path, content: "", original: "", loading: true, editing: false, saving: false });

/** Saved-file editor state, shared across view switches; never executes agent work. */
export class FileBuffer {
  private state = empty("");
  private drafts = new Map<string, FileBufferState>();
  private listeners = new Set<() => void>();
  private generation = 0;
  private controller?: AbortController;
  constructor(private readonly request: typeof fetch = (...args) => fetch(...args)) {}
  getSnapshot = (): FileBufferState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(state: FileBufferState) {
    this.state = state;
    if (state.content !== state.original || state.saving) this.drafts.set(state.path, state);
    else this.drafts.delete(state.path);
    for (const listener of this.listeners) listener();
  }
  stopLoading = () => { this.generation++; this.controller?.abort(); };
  async select(path: string): Promise<void> {
    this.stopLoading();
    const generation = this.generation;
    const draft = this.drafts.get(path);
    if (draft) { this.publish(draft); return; }
    const controller = new AbortController();
    this.controller = controller;
    this.publish(empty(path));
    try {
      const response = await this.request(`/api/fs/read?path=${encodeURIComponent(path)}`, { signal: controller.signal, cache: "no-store" });
      const body = await response.json();
      if (generation !== this.generation) return;
      if (!response.ok || body.error) throw new Error(body.error || `Read failed (${response.status})`);
      if (body.path !== path || typeof body.content !== "string" || typeof body.version !== "string") throw new Error("Invalid file response");
      this.publish({ ...empty(path), loading: false, content: body.content, original: body.content, version: body.version });
    } catch (error) {
      if (generation === this.generation) this.publish({ ...empty(path), loading: false, error: String(error) });
    }
  }
  canSave(path: string): boolean {
    return this.state.path === path && !this.state.loading && !this.state.saving && this.state.version !== undefined && this.state.editing;
  }
  edit(path: string) {
    if (this.state.path === path && !this.state.loading && this.state.version !== undefined && !this.state.saving) {
      this.publish({ ...this.state, editing: true });
    }
  }
  change(path: string, content: string) {
    if (this.canSave(path)) this.publish({ ...this.state, content });
  }
  discard(path: string) {
    if (this.state.path === path && !this.state.saving) this.publish({ ...this.state, content: this.state.original, editing: false, error: undefined });
  }
  async save(path: string): Promise<boolean> {
    if (!this.canSave(path)) return false;
    const selected = this.state;
    this.publish({ ...selected, saving: true, error: undefined });
    try {
      const response = await this.request("/api/fs/write", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected.path, content: selected.content, expectedVersion: selected.version }),
      });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error || `Save failed (${response.status})`);
      if (body.path !== selected.path || typeof body.version !== "string") throw new Error("Invalid save response");
      const saved = { ...selected, original: selected.content, version: body.version, saving: false, editing: false, error: undefined };
      this.drafts.delete(selected.path);
      if (this.state.path === selected.path) this.publish(saved);
      return true;
    } catch (error) {
      const failed = { ...selected, saving: false, error: String(error) };
      this.drafts.set(selected.path, failed);
      if (this.state.path === selected.path) this.publish(failed);
      return false;
    }
  }
}
