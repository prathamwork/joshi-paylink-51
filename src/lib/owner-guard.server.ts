// Server-only helper: throws if the authenticated caller is not the sole owner.
import { OWNER_EMAIL } from "./owner";

export function assertOwner(claims: { email?: string | null } | null | undefined) {
  const email = (claims?.email ?? "").toString().trim().toLowerCase();
  if (!email || email !== OWNER_EMAIL) {
    throw new Error("Forbidden: owner-only endpoint.");
  }
}
