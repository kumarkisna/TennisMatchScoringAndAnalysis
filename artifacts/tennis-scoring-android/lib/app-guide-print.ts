import { APP_GUIDE_SECTIONS } from './app-guide';
import { APP_BRAND_NAME, APP_COPYRIGHT_NOTICE } from './branding';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

export function buildAppGuidePrintHtml(): string {
  const contents = APP_GUIDE_SECTIONS.map(
    (section) => `<li>${escapeHtml(section.navLabel)}</li>`,
  ).join('');
  const sections = APP_GUIDE_SECTIONS.map(
    (section, sectionIndex) => `
      <section>
        <h2>${sectionIndex + 1}. ${escapeHtml(section.title)}</h2>
        <p class="intro">${escapeHtml(section.intro)}</p>
        <ol>
          ${section.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>
      </section>
    `,
  ).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(APP_BRAND_NAME)} — How to use the app</title>
    <style>
      @page { margin: 16mm 14mm; }
      body {
        color: #1e2924;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11pt;
        line-height: 1.55;
        margin: 0 auto;
        max-width: 760px;
      }
      h1 { font-size: 24pt; line-height: 1.2; margin: 0 0 5px; }
      h2 { color: #214b3a; font-size: 15pt; margin: 0 0 7px; }
      p { margin: 0 0 10px; }
      .copyright { color: #536158; font-size: 9pt; margin-bottom: 18px; }
      .contents { background: #f4f1e8; border-radius: 8px; padding: 12px 12px 12px 34px; }
      .intro { color: #536158; }
      section { border-top: 1px solid #d9ddd7; margin-top: 20px; padding-top: 16px; page-break-inside: avoid; }
      ol { padding-left: 22px; }
      li { margin: 0 0 7px; padding-left: 3px; }
      @media print {
        body { max-width: none; }
        section { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(APP_BRAND_NAME)}</h1>
      <p class="copyright">${escapeHtml(APP_COPYRIGHT_NOTICE)}</p>
    </header>
    <h2>How to use the app</h2>
    <ol class="contents">${contents}</ol>
    ${sections}
  </body>
</html>`;
}
