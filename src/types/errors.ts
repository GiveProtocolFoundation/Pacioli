/**
 * Type guard to check if an error has a message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Type guard to check if an error has a code property
 */
export function isErrorWithCode(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'number'
  );
}

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Get error code from unknown error type
 */
export function getErrorCode(error: unknown): number | undefined {
  if (isErrorWithCode(error)) {
    return error.code;
  }

  return undefined;
}
