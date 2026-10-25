import { Test } from '@nestjs/testing';
import { OpenaiService } from '@/lib';
import { ChatV1Service } from '@/modules';

describe('ChatV1Service', () => {
  it('delegates a normalized message to OpenAI', async () => {
    const generateReply = vi.fn().mockResolvedValue('Version 1 response');
    const module = await Test.createTestingModule({
      providers: [
        ChatV1Service,
        { provide: OpenaiService, useValue: { generateReply } },
      ],
    }).compile();

    await expect(
      module.get(ChatV1Service).sendMessage('  Ask this  '),
    ).resolves.toEqual({ message: 'Version 1 response' });
    expect(generateReply).toHaveBeenCalledWith('Ask this');
  });
});
