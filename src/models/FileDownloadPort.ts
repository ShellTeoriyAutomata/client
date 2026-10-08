/** Boundary for downloading an assignment export independently of the browser. */
export interface FileDownloadPort {
  /** Save text under the given filename and MIME type. */
  saveFile(filename: string, contents: string, mimeType: string): void;
}
