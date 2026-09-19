import type { ChatRequestContext } from "@/lib/agent/engineering/chat-contract";
import type { EngineeringSessionClient } from "@/lib/engineering/session";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  requestId: number;
}

export interface ChatSessionView {
  messages: ChatMessage[];
  input: string;
  selectedFile?: string;
  busy: boolean;
  activeRequest?: number;
}

/** View-lifecycle state only; engineering authority remains in EngineeringSessionClient. */
export class ChatSessionClient {
  private state: ChatSessionView = { messages: [], input: "", busy: false };
  private listeners = new Set<() => void>();
  private nextId = 1;

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private publish(update: Partial<ChatSessionView>) {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener();
  }

  setInput(input: string) { this.publish({ input }); }
  selectFile(selectedFile?: string) { this.publish({ selectedFile }); }

  async send(engineering: EngineeringSessionClient): Promise<boolean> {
    const content = this.state.input.trim();
    if (!content || this.state.busy) return false;
    const requestId = this.nextId++;
    const user: ChatMessage = { id: this.nextId++, role: "user", content, requestId };
    const messages = [...this.state.messages, user];
    this.publish({ messages, input: "", busy: true, activeRequest: requestId });
    const history = messages.map(message => ({ role: message.role, content: message.content }));
    const context: ChatRequestContext = { selectedFile: this.state.selectedFile };
    try {
      const response = await engineering.submit(history, context);
      this.complete(requestId, response.content || "Agent returned an empty response.");
    } catch (error) {
      this.complete(requestId, `**Error:** ${error instanceof Error ? error.message : String(error)}`);
    }
    return true;
  }

  private complete(requestId: number, content: string) {
    if (this.state.activeRequest !== requestId) return;
    const assistant: ChatMessage = { id: this.nextId++, role: "assistant", content, requestId };
    this.publish({ messages: [...this.state.messages, assistant], busy: false, activeRequest: undefined });
  }
}
