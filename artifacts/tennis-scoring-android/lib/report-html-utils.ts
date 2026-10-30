const URL_LIKE_TEXT =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b(?:(?:https?|ftp):\/\/|www\.)[^\s<>"']+|\blocalhost(?::\d+)?(?:[/?#][^\s<>"']*)?|\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#][^\s<>"']*)?|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"']*)?/gi;

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
