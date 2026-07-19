import type {
  WorkflowResult,
} from "./workflow";

import type {
  AgentAuditResult,
} from "./audit";

import type {
  ToolResult,
} from "./types";


type FsNode = {
  name: string;

  path: string;

  type: "file" | "dir";

  children?: FsNode[];
};


function isReadOnlyWorkflow(
  workflow: WorkflowResult
): boolean {
  return (
    workflow.execution.filesModified.length === 0 &&
    workflow.execution.context.toolResults.length > 0 &&
    workflow.execution.context.toolResults.every(
      result =>
        result.tool === "list_files" ||
        result.tool === "read_file" ||
        result.tool === "git_diff" ||
        result.tool === "git_status"
    )
  );
}


function parseToolOutput(
  result: ToolResult
): unknown {
  if (
    typeof result.output !== "string"
  ) {
    return result.output;
  }

  try {
    return JSON.parse(
      result.output
    );
  } catch {
    return result.output;
  }
}


function flattenFsNodes(
  nodes: FsNode[]
): FsNode[] {
  return nodes.flatMap(
    node => [
      node,

      ...flattenFsNodes(
        node.children ?? []
      ),
    ]
  );
}


function getListFilesNodes(
  workflow: WorkflowResult
): FsNode[] {
  const listResult =
    workflow.execution.context.toolResults.find(
      result =>
        result.tool === "list_files" &&
        result.success
    );

  if (!listResult) {
    return [];
  }

  const output =
    parseToolOutput(
      listResult
    );

  if (
    typeof output !== "object" ||
    output === null ||
    !(
      "files" in output
    ) ||
    !Array.isArray(
      output.files
    )
  ) {
    return [];
  }

  return output.files as FsNode[];
}


function inferProjectType(
  paths: string[]
): string {
  const traits: string[] = [];

  if (
    paths.some(
      file =>
        file.startsWith(
          "next.config"
        )
    )
  ) {
    traits.push(
      "Next.js"
    );
  }

  if (
    paths.includes(
      "tsconfig.json"
    )
  ) {
    traits.push(
      "TypeScript"
    );
  }

  if (
    paths.includes(
      "package.json"
    )
  ) {
    traits.push(
      "Node.js"
    );
  }

  return traits.length > 0
    ? traits.join(
        " / "
      )
    : "project";
}


function describeDirectories(
  directories: string[]
): string[] {
  const descriptions: string[] = [];

  if (
    directories.includes(
      "app"
    )
  ) {
    descriptions.push(
      "- `app/`: Next.js application routes and API handlers."
    );
  }

  if (
    directories.includes(
      "components"
    )
  ) {
    descriptions.push(
      "- `components/`: reusable UI components."
    );
  }

  if (
    directories.includes(
      "lib"
    )
  ) {
    descriptions.push(
      "- `lib/`: core agent, tooling, model, filesystem, and intelligence code."
    );
  }

  if (
    directories.includes(
      "docs"
    )
  ) {
    descriptions.push(
      "- `docs/`: architecture, roadmap, design, operations, and contract documentation."
    );
  }

  if (
    directories.includes(
      "archive"
    )
  ) {
    descriptions.push(
      "- `archive/`: legacy code retained for reference."
    );
  }

  return descriptions;
}


function createNotableFiles(
  paths: string[]
): string[] {
  return [
    "package.json",
    "tsconfig.json",
    "next.config.mjs",
    "Codexia_Project_Transfer_Pack.md",
    "docs/roadmap/phases.md",
  ]
    .filter(
      path =>
        paths.includes(
          path
        )
    )
    .map(
      path =>
        `- \`${path}\``
    );
}


export function createReadOnlyAgentReport(
  workflow: WorkflowResult,
  audit: AgentAuditResult
): string {
  const nodes =
    getListFilesNodes(
      workflow
    );

  const flattened =
    flattenFsNodes(
      nodes
    );

  const files =
    flattened.filter(
      node =>
        node.type === "file"
    );

  const directories =
    flattened.filter(
      node =>
        node.type === "dir"
    );

  const paths =
    flattened.map(
      node =>
        node.path
    );

  const topLevelDirectories =
    nodes
      .filter(
        node =>
          node.type === "dir"
      )
      .map(
        node =>
          node.name
      );

  const directorySummary =
    describeDirectories(
      topLevelDirectories
    );

  const notableFiles =
    createNotableFiles(
      paths
    );

  return [
    `I inspected the workspace and found a ${inferProjectType(paths)} codebase.`,

    "",

    "Summary:",

    `- ${files.length} files indexed in the visible workspace tree.`,

    `- ${directories.length} directories indexed in the visible workspace tree.`,

    `- ${audit.metrics.toolsUsed} workspace tool call${audit.metrics.toolsUsed === 1 ? "" : "s"} used.`,

    "",

    "Main areas:",

    ...(directorySummary.length > 0
      ? directorySummary
      : [
          "- No recognised top-level application directories were identified.",
        ]),

    "",

    "Notable files:",

    ...(notableFiles.length > 0
      ? notableFiles
      : [
          "- No standard project files were identified in the visible tree.",
        ]),

    "",

    "No files were modified.",
  ].join(
    "\n"
  );
}


export function createAgentReport(
  workflow: WorkflowResult,
  audit: AgentAuditResult
): string {
  if (
    isReadOnlyWorkflow(
      workflow
    )
  ) {
    return createReadOnlyAgentReport(
      workflow,
      audit
    );
  }

  const validation =
    workflow.validation.valid
      ? "Passed"
      : workflow.validation.errors.join("\n");


  return [

    workflow.execution.output,

    "",

    "Workflow:",

    workflow.state.stage,

    "",

    "Review:",

    workflow.review.summary,

    "",

    "Validation:",

    validation,

    "",

    "Files Modified:",

    workflow.review.filesModified.length > 0
      ? workflow.review.filesModified.join("\n")
      : "None",

    "",

    "Audit:",

    JSON.stringify(
      audit.metrics,
      null,
      2
    ),

  ].join("\n");

}