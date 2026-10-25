export const FILE_MAX_BYTES = 1_048_576;
export const WORKSPACE_MAX_BYTES = 2_097_152;
export const FILE_MIME_TYPES: Readonly<Record<string, string>> = Object.freeze({
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});
export const FILE_ACCEPT = Object.keys(FILE_MIME_TYPES).map(extension => '.' + extension).join(',');
