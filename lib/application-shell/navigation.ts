import type { LucideIcon } from "lucide-react";
import { Activity, Folder, MessageSquare, PanelsTopLeft, Settings } from "lucide-react";

export type ShellView = "chat" | "files" | "intelligence" | "operations" | "settings";

export interface ShellRoute {
  id: ShellView;
  label: string;
  shortLabel: string;
  description: string;
  group: "Workspace" | "System";
  icon: LucideIcon;
  keywords: string[];
}

export const shellRoutes: readonly ShellRoute[] = [
  { id: "chat", label: "Codier Workspace", shortLabel: "Codier", description: "Plan, build, and refine your project with Codier.", group: "Workspace", icon: MessageSquare, keywords: ["chat", "assistant", "mission"] },
  { id: "files", label: "Workspace Files", shortLabel: "Files", description: "Browse and edit files in your active project.", group: "Workspace", icon: Folder, keywords: ["code", "editor", "project"] },
  { id: "intelligence", label: "Workspace Intelligence", shortLabel: "Intelligence", description: "Inspect current, stale, incomplete, unavailable, and failed evidence.", group: "Workspace", icon: Activity, keywords: ["diagnostics", "symbols", "analysis"] },
  { id: "operations", label: "Control Centre", shortLabel: "Control Centre", description: "Coordinate lifecycle, recovery, evidence, and resources across authorized workspaces.", group: "Workspace", icon: PanelsTopLeft, keywords: ["runtime", "status", "tasks", "agents"] },
  { id: "settings", label: "Settings", shortLabel: "Settings", description: "Configure Codexia and your development environment.", group: "System", icon: Settings, keywords: ["preferences", "account", "configuration"] },
] as const;

export const defaultShellView: ShellView = "chat";

export function isShellView(value: string | null | undefined): value is ShellView {
  return shellRoutes.some(route => route.id === value);
}

export function shellViewFromSearch(search: string): ShellView {
  const view = new URLSearchParams(search).get("view");
  return isShellView(view) ? view : defaultShellView;
}

export function searchShellRoutes(query: string): readonly ShellRoute[] {
  const term = query.trim().toLowerCase();
  if (!term) return shellRoutes;
  return shellRoutes.filter(route => [route.label, route.shortLabel, route.description, ...route.keywords]
    .some(value => value.toLowerCase().includes(term)));
}

export function shellRoute(view: ShellView): ShellRoute {
  return shellRoutes.find(route => route.id === view) ?? shellRoutes[0];
}
