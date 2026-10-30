const URL_LIKE_TEXT =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b(?:(?:https?|ftp):\/\/|www\.)[^\s<>"']+|\blocalhost(?::\d+)?(?:[/?#][^\s<>"']*)?|\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#][^\s<>"']*)?|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"']*)?/gi;

export function anonymizeReportPlayerNames(
  value: string,
  trackedPlayer: string,
  opponent: string,
): string {
  const names = [
    { name: trackedPlayer.trim(), label: 'Player A' },
    { name: opponent.trim(), label: 'Player B' },
  ]
    .filter(({ name }) => name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);

  return names.reduce((text, { name, label }) => {
    const escapedName = name
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    const namePattern = new RegExp(`(^|[^\\w])${escapedName}(?=$|[^\\w])`, 'gi');
    return text.replace(namePattern, (_match, prefix: string) => `${prefix}${label}`);
  }, value);
}

export function escapeReportHtml(value: string): string {
  return value
    .replace(URL_LIKE_TEXT, '')
    .replace(/[&<>"']/g, (character) => {
      const replacements: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return replacements[character] ?? character;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}
