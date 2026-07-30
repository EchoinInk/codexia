import { AppShell } from "@/components/control-centre/AppShell";
import { WorkspaceProvider } from "@/components/control-centre/WorkspaceProvider";

export default function Page() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}
