/** Typed auth failures so route handlers can return 401/403 without a 500. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 400 = 401,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
