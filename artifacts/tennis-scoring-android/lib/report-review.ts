import type { LocalReportNameLabels } from '@/lib/local-report-labels';

export function getReportNameVisibilityVersion(
  hidePlayerNames: boolean,
  labels: LocalReportNameLabels,
): string {
  return hidePlayerNames ? JSON.stringify(labels) : 'named';
}

export function buildReportReviewVersion(
  reportVersion: string | null | undefined,
  selectedSections: readonly string[],
  benchmarkVersion: string,
  nameVisibilityVersion: string,
): string | null {
  if (!reportVersion) return null;
  return `${reportVersion}:${selectedSections.join(',')}:${benchmarkVersion}:${nameVisibilityVersion}`;
}

export function isReportReviewCurrent(
  reviewedVersion: string | null | undefined,
  currentVersion: string | null | undefined,
): boolean {
  return Boolean(currentVersion) && reviewedVersion === currentVersion;
}
