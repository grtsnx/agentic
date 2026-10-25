import sharp from 'sharp';
import { DocumentsService } from '../../../../src/lib/documents/documents.service.js';
import { docxFixture, pdfFixture } from '../../../fixtures/files/documents.js';
const signal = () => new AbortController().signal;
describe('bounded document parsing', () => {
  it.each(['pdf', 'docx'])(
    'extracts real %s text',
    async (kind) => {
      const result = await new DocumentsService().parse(
        kind,
        kind === 'pdf' ? pdfFixture() : docxFixture(),
        signal(),
      );
      expect(result.text).toContain('PINE-742');
    },
    20_000,
  );
  it.each(['jpeg', 'png'] as const)(
    'validates and normalizes %s images',
    async (format) => {
      const source = await sharp({
        create: { width: 32, height: 24, channels: 3, background: '#16a34a' },
      })
        .toFormat(format)
        .toBuffer();
      const result = await new DocumentsService().parse(
        format,
        source,
        signal(),
      );
      expect(result.kind).toBe('image');
      expect(result.content!.length).toBeGreaterThan(0);
      expect((await sharp(result.content).metadata()).format).toBe(format);
    },
  );
  it.each(['pdf', 'docx', 'png', 'jpg'])(
    'rejects disguised or corrupt %s files',
    async (kind) => {
      await expect(
        new DocumentsService().parse(
          kind,
          Buffer.from('<html>not a document</html>'),
          signal(),
        ),
      ).rejects.toThrow();
    },
  );
  it('rejects forbidden DOCX entity declarations', async () => {
    await expect(
      new DocumentsService().parse(
        'docx',
        docxFixture('<!DOCTYPE x>'),
        signal(),
      ),
    ).rejects.toThrow();
  });
  it('rejects a cancelled extraction before work starts', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new DocumentsService().parse('pdf', pdfFixture(), controller.signal),
    ).rejects.toThrow();
  });
});
