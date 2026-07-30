export interface ChangeSummary {

  filesChanged: string[];

  actions: string[];

  verification: string[];

  retries: number;

}



export function createChangeSummary(): ChangeSummary {

  return {

    filesChanged: [],

    actions: [],

    verification: [],

    retries: 0,

  };

}



export function addChangedFile(
  summary: ChangeSummary,
  file: string
): ChangeSummary {

  if (
    summary.filesChanged.includes(file)
  ) {

    return summary;

  }


  return {

    ...summary,

    filesChanged: [
      ...summary.filesChanged,
      file,
    ],

  };

}



export function addAction(
  summary: ChangeSummary,
  action: string
): ChangeSummary {

  return {

    ...summary,

    actions: [
      ...summary.actions,
      action,
    ],

  };

}



export function addVerification(
  summary: ChangeSummary,
  result: string
): ChangeSummary {

  return {

    ...summary,

    verification: [
      ...summary.verification,
      result,
    ],

  };

}



export function addRetry(
  summary: ChangeSummary
): ChangeSummary {

  return {

    ...summary,

    retries:
      summary.retries + 1,

  };

}