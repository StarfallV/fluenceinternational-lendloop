/**
 * Domain constants shared by Convex and the UI, so client and server limits cannot drift.
 * Lengths count Unicode code points, not UTF-16 units.
 */

/** BR-16: display names are at most 40 characters. */
export const DISPLAY_NAME_MAX_LENGTH = 40;
