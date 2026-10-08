import type { FileDownloadPort } from '../models/FileDownloadPort';

/** Download text through the browser or Electron renderer. */
export class BrowserFileDownload implements FileDownloadPort {
  /** Start a download and release its temporary object URL afterwards. */
  saveFile(filename: string, contents: string, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement('a');
    try {
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}
