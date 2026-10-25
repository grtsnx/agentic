import { WorkspaceStore } from '../../../../../src/modules/v1/workspaces/workspace-store.service.js';
import { WorkspaceFilesService } from '../../../../../src/modules/v1/workspaces/workspace-files.service.js';

describe('scoped file extraction', () => {
  const setup = () => {
    const store = new WorkspaceStore();
    const a = store.create();
    const b = store.create();
    return {
      files: new WorkspaceFilesService(),
      a: store.authorize(a.id, a.token),
      b: store.authorize(b.id, b.token),
    };
  };
  it('retrieves cited chunks only from the authorized scope', async () => {
    const { files, a, b } = setup();
    const file = await files.upload(a, {
      originalname: 'notes.md',
      mimetype: 'text/markdown',
      buffer: Buffer.from('The launch budget is 42 dollars.'),
    });
    expect(files.search(a, 'budget', [file.id])[0]).toMatchObject({
      fileId: file.id,
      filename: 'notes.md',
      text: expect.stringContaining('42'),
    });
    expect(files.search(a, 'notes.md', [])[0]?.fileId).toBe(file.id);
    expect(() => files.search(b, 'budget', [file.id])).toThrow();
    expect(files.search(b, 'budget', [])).toEqual([]);
  });
  it.each([
    ['binary.txt', 'text/plain', Buffer.from([0, 1, 2])],
    ['bad.txt', 'text/plain', Buffer.from([0xff])],
    ['bad.json', 'application/json', Buffer.from('{invalid}')],
    ['script.exe', 'text/plain', Buffer.from('hello')],
    ['notes.txt', 'image/png', Buffer.from('hello')],
    ['large.txt', 'text/plain', Buffer.alloc(1_048_577, 65)],
  ])('rejects invalid upload %s before storing it', async (name, mime, buffer) => {
    const { files, a } = setup();
    await expect(
      files.upload(a, { originalname: name, mimetype: mime, buffer }),
    ).rejects.toThrow();
    expect(a.files.size).toBe(0);
  });
});
