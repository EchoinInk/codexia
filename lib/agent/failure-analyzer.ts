import type {
  VerificationResult,
} from "./verification";


export interface FailureAnalysis {

  failed: boolean;

  summary: string;

  failures: string[];

}



export function analyseFailures(
  results: VerificationResult[]
): FailureAnalysis {

  const failures =
    results
      .filter(
        result =>
          !result.success
      )
      .map(
        result =>
          `${result.command}: ${result.output}`
      );


  return {

    failed:
      failures.length > 0,

    summary:
      failures.length > 0
        ? "Verification failed"
        : "Verification passed",

    failures,

  };

}