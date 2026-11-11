"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

// Written by `npx convex dev` into .env.local, and inlined by Next.js at build time.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl === undefined || convexUrl === "") {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` once, which writes it (README).",
  );
}

const convex = new ConvexReactClient(convexUrl);

/** Convex queries and mutations carry the Clerk session token, which Convex verifies. */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
