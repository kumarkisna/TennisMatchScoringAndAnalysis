export interface ReportPrintAdapter {
  printAsync(options: { html: string } | { uri: string }): Promise<void>;
  printToFileAsync(options: { html: string }): Promise<{ uri: string }>;
}

export interface ReportSharingAdapter {
  isAvailableAsync(): Promise<boolean>;
  shareAsync(
    uri: string,
    options: { mimeType: string; dialogTitle: string; UTI: string },
  ): Promise<void>;
}

export async function createAndPreviewLocalPdf(
  html: string,
  platform: string,
  print: ReportPrintAdapter,
): Promise<string | null> {
  if (platform === 'web') {
    await print.printAsync({ html });
    return null;
  }

  const file = await print.printToFileAsync({ html });
  if (!file.uri) throw new Error('The PDF report could not be saved on this device.');
  await print.printAsync({ uri: file.uri });
  return file.uri;
}

export async function shareReviewedLocalPdf(
  uri: string,
  dialogTitle: string,
  sharing: ReportSharingAdapter,
): Promise<void> {
  if (!uri) throw new Error('Review the PDF before sharing it.');
  if (!(await sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  });
}
