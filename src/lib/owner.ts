export const OWNER_EMAIL = "pratham.work3115@gmail.com";

export function isOwnerEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
