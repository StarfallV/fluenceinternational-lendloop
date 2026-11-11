"use client";

import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";

/** Until block 005 builds the admin screens. The role check here only picks the text. */
export function AdminPlaceholder() {
  const me = useQuery(api.users.me);

  if (me === undefined) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  return (
    <p className="mt-2 text-muted-foreground">
      {me.role === "admin"
        ? "Moderation and automation health will appear here."
        : "This page is for admins."}
    </p>
  );
}
