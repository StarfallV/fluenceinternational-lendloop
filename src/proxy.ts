import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// For UX only: signed-out visitors are sent to sign-in instead of seeing an empty app. Convex makes
// every authorization decision (ADR-002).
const isAppRoute = createRouteMatcher([
  "/tools(.*)",
  "/listings(.*)",
  "/requests(.*)",
  "/incoming(.*)",
  "/admin(.*)",
]);

export default clerkMiddleware(
  async (auth, request) => {
    if (isAppRoute(request)) {
      await auth.protect();
    }
  },
  { signInUrl: "/sign-in" },
);

export const config = {
  matcher: [
    // Every route except Next.js internals and static files (Clerk's recommended matcher).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
