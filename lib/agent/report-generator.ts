import type {
  WorkflowResult,
} from "./workflow";

import type {
  AgentAuditResult,
} from "./audit";


export function createAgentReport(
  workflow: WorkflowResult,
  audit: AgentAuditResult
): string {

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