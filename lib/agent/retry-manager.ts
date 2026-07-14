export interface RetryState {

  attempts: number;

  maxAttempts: number;

}



export function createRetryState(
  maxAttempts = 3
): RetryState {

  return {

    attempts: 0,

    maxAttempts,

  };

}



export function canRetry(
  state: RetryState
): boolean {

  return (
    state.attempts <
    state.maxAttempts
  );

}



export function incrementRetry(
  state: RetryState
): RetryState {

  return {

    ...state,

    attempts:
      state.attempts + 1,

  };

}