import { configuredRequestWorkspace, RequestError } from "@/lib/local-request";
import { analyseArchitecture } from "@/lib/intelligence/architecture-analysis";
import { diagnoseWorkspace } from "@/lib/intelligence/diagnostics";
import { getWorkspaceIntelligenceSnapshot } from "@/lib/intelligence/workspace-intelligence-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RELATIONSHIPS = 200;
const MAX_DIAGNOSTICS = 500;
const MAX_FINDINGS = 500;
const MAX_EVOLUTION = 25;
const MAX_LEARNING = 25;

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const requestedWorkspace = params.get("workspace");
    const workspace =
      configuredRequestWorkspace(
        requestedWorkspace === null
          ? undefined
          : requestedWorkspace
      );
    const snapshot =
      await getWorkspaceIntelligenceSnapshot(
        workspace
      );

    if (
      snapshot.status === "unavailable" ||
      snapshot.status === "failed"
    ) {
      return Response.json(
        createResponse(snapshot),
        { status: 503 }
      );
    }

    if (
      !snapshot.evidence ||
      !snapshot.provenance ||
      snapshot.status === "incomplete"
    ) {
      return Response.json(
        createResponse(snapshot),
        { status: 200 }
      );
    }

    const index =
      snapshot.evidence.index;
    const snapshotId =
      snapshot.provenance.snapshotId;
    const analysisErrors: string[] = [];

    let architecture:
      ReturnType<typeof analyseArchitecture> | undefined;
    try {
      architecture =
        analyseArchitecture(
          index
        );
    } catch (error) {
      analysisErrors.push(
        `architecture: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    let diagnostics:
      Awaited<ReturnType<typeof diagnoseWorkspace>> | undefined;
    try {
      diagnostics =
        await diagnoseWorkspace(
          index
        );
    } catch (error) {
      analysisErrors.push(
        `diagnostics: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const evolution = (snapshot.evidence.memory?.evolution ?? []).slice(0, MAX_EVOLUTION);
    const learning = (snapshot.evidence.memory?.learning ?? []).slice(0, MAX_LEARNING);

    return Response.json({
      ...createResponse(snapshot),

      summary: {
        fileCount: index.files.length,
        directoryCount: index.directories.length,
        relationshipCount:
          index.relationships?.relationships.length ?? 0,
      },

      dependencies: {
        snapshotId,
        relationships:
          (index.relationships?.relationships ?? [])
            .slice(0, MAX_RELATIONSHIPS),
        truncated:
          (index.relationships?.relationships.length ?? 0) >
          MAX_RELATIONSHIPS,
      },

      architecture: architecture
        ? {
            snapshotId,
            findings:
              architecture.findings.slice(0, MAX_FINDINGS),
            findingCount:
              architecture.findings.length,
            truncated:
              architecture.findings.length > MAX_FINDINGS,
            limitations: architecture.limitations,
            graph: {
              nodeCount: architecture.graph.nodes.length,
              orderCount: architecture.graph.order.length,
            },
          }
        : undefined,

      diagnostics: diagnostics
        ? {
            snapshotId,
            diagnostics:
              diagnostics.diagnostics.slice(0, MAX_DIAGNOSTICS),
            diagnosticCount:
              diagnostics.diagnostics.length,
            truncated:
              diagnostics.diagnostics.length > MAX_DIAGNOSTICS,
            providerErrors: diagnostics.providerErrors,
            limitations: diagnostics.limitations,
          }
        : undefined,

      evolution: {
        snapshotId,
        entries: evolution,
        entryCount: snapshot.evidence.memory?.evolution?.length ?? 0,
        truncated: (snapshot.evidence.memory?.evolution?.length ?? 0) > MAX_EVOLUTION,
      },

      learning: {
        snapshotId,
        entries: learning,
        entryCount: snapshot.evidence.memory?.learning?.length ?? 0,
        truncated: (snapshot.evidence.memory?.learning?.length ?? 0) > MAX_LEARNING,
      },

      activity: {
        snapshotId,
        memory: snapshot.evidence.memory,
      },

      analysisErrors:
        analysisErrors.length
          ? analysisErrors
          : undefined,
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return Response.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 400 }
    );
  }
}

function createResponse(
  snapshot: Awaited<ReturnType<typeof getWorkspaceIntelligenceSnapshot>>
): Record<string, unknown> {
  return {
    workspace: snapshot.workspace,
    status: snapshot.status,
    usable: snapshot.usable,
    dirty: snapshot.dirty,
    pending: snapshot.pending,
    refresh: snapshot.refresh,
    provenance: snapshot.provenance,
    failure: snapshot.failure,
  };
}
