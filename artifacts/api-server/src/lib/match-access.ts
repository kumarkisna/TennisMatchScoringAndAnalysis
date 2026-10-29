export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canReadMatch(
  ownerId: string,
  viewerId: string,
  verifiedEmails: string[],
  invitedEmails: string[],
): boolean {
  if (ownerId === viewerId) return true;
  const verified = new Set(verifiedEmails.map(normalizeInviteEmail));
  return invitedEmails.some((email) => verified.has(normalizeInviteEmail(email)));
}
