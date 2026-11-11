import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "../../../convex/_generated/api";
import { appErrorData } from "../../../convex/lib/errors";

export type AccountState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "failed"; message: string; retry?: () => void };

const NOT_ACCEPTED =
  "The LendLoop server didn't accept your sign-in. Check the Clerk and Convex setup in the README.";
const SETUP_FAILED = "LendLoop couldn't set up your account. Try again in a moment.";

/**
 * Creates or refreshes the signed-in user's Convex row (`users:ensureUser`) once Convex has
 * accepted the Clerk session. App pages render their data only when this is `ready`, because
 * their queries need the row (architecture.md §5.2).
 */
export function useEnsureUser(): AccountState {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<{ attempt: number; error: string | null } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let current = true;
    ensureUser().then(
      () => {
        if (current) setOutcome({ attempt, error: null });
      },
      (error: unknown) => {
        if (current) setOutcome({ attempt, error: appErrorData(error)?.message ?? SETUP_FAILED });
      },
    );
    return () => {
      current = false;
    };
  }, [isAuthenticated, ensureUser, attempt]);

  if (isLoading) {
    return { status: "loading" };
  }
  if (!isAuthenticated) {
    return { status: "failed", message: NOT_ACCEPTED };
  }
  if (outcome === null || outcome.attempt !== attempt) {
    return { status: "loading" };
  }
  if (outcome.error !== null) {
    return { status: "failed", message: outcome.error, retry: () => setAttempt(attempt + 1) };
  }
  return { status: "ready" };
}
