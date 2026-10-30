export interface ReportPrintAdapter {
  printAsync(options: { html: string } | { uri: string }): Promise<void>;
  printToFileAsync(options: { html: string }): Promise<{ uri: string }>;
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
