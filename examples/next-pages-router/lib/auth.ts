export type Session = { userId: string; accessToken: string };

/** Replace this example with the application's session/JWT verification. */
export function getSession(req: { cookies: Partial<Record<string, string>> }): Session | undefined {
  const accessToken = req.cookies.session;
  return accessToken ? { userId: accessToken, accessToken } : undefined;
}
