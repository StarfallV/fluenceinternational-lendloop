import type { AuthConfig } from "convex/server";

// Convex evaluates this file on its own when it deploys, so it reads process.env directly: the one
// exception to lib/env.ts. The value is the Clerk Frontend API URL, which is public. While it is
// unset, Convex refuses to deploy and names the variable, so the fallback only satisfies the type.
export default {
  // Clerk's Convex integration issues session tokens with `aud: "convex"`.
  providers: [{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN ?? "", applicationID: "convex" }],
} satisfies AuthConfig;
