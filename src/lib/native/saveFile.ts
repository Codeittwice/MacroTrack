import { isNativeApp } from './platform';

/**
 * Hands a text file to the user. Browsers download it; the Android WebView ignores download
 * links, so there the file is written to the app cache and offered through the share sheet
 * (save to Files/Drive, send to the PC, etc.).
 */
export async function saveTextFile(fileName: string, text: string, mimeType = 'application/json'): Promise<'downloaded' | 'shared'> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: fileName, url: uri, dialogTitle: 'Save your MacroTrack backup' });
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
