import type { Status } from "./recon/match";

// Keep this order: neighbouring colours were checked for colour-blind readability.
export const STATUS_ORDER: Status[] = ["matched", "unmatched_a", "amount_mismatch", "unmatched_b", "duplicate"];

export const STATUS_HINT: Record<Status, string> = {
  matched: "Reference and amount agree",
  unmatched_a: "In the bank, missing from ERP",
  amount_mismatch: "Same reference, different amount",
  unmatched_b: "In ERP, no bank transaction",
  duplicate: "Reference repeated in one file",
};

// light fills that need dark text
export const DARK_INK_ON: Status[] = ["unmatched_a", "duplicate"];
