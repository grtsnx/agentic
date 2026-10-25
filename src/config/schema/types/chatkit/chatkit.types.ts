import type { z } from 'zod';
import type { Attachment, Widgets } from '@openai/chatkit';
import type { chatkitRequestSchema } from '../../chatkit/chatkit.schema.js';
import type { OpenaiStreamResponse } from '../openai/openai.types.js';
import type { WorkspaceFile } from '../workspaces/workspace.types.js';
import type { WorkspaceScope } from '../workspaces/workspace.types.js';

export type ChatkitRequest = z.infer<typeof chatkitRequestSchema>;
export type ChatkitInput = Extract<
  ChatkitRequest,
  { type: 'threads.create' }
>['params']['input'];
export type ChatkitAnnotation = {
  type: 'annotation';
  source: { type: 'url'; url: string; title: string; attribution: string };
  index?: number;
};
export type ChatkitContent = {
  type: 'output_text';
  text: string;
  annotations: ChatkitAnnotation[];
};
export type ChatkitItem = {
  id: string;
  thread_id: string;
  created_at: string;
} & (
  | {
      type: 'user_message';
      content: ChatkitInput['content'];
      attachments: Attachment[];
      inference_options: {};
      quoted_text?: string | null;
    }
  | {
      type: 'assistant_message';
      content: ChatkitContent[];
      agentic?: OpenaiStreamResponse;
    }
  | { type: 'widget'; widget: Widgets.Card; copy_text?: string }
);
export type ChatkitThread = {
  ownerId: string;
  ownerSignal: AbortSignal;
  scope: WorkspaceScope;
  createdAt: string;
  title: string;
  items: ChatkitItem[];
  approvals: Map<string, string>;
  busy: boolean;
  // Model-history offsets avoid duplicating the complete session for every turn.
  checkpoints: Map<string, number>;
};
export type ChatkitEvent =
  | { type: 'thread.item.removed'; item_id: string }
  | { type: 'thread.created' | 'thread.updated'; thread: ChatkitThreadView }
  | {
      type: 'thread.item.added' | 'thread.item.done' | 'thread.item.replaced';
      item: ChatkitItem;
    }
  | {
      type: 'thread.item.updated';
      item_id: string;
      update:
        | {
            type: 'assistant_message.content_part.text_delta';
            content_index: number;
            delta: string;
          }
        | {
            type: 'assistant_message.content_part.done';
            content_index: number;
            content: ChatkitContent;
          };
    }
  | { type: 'progress_update'; text: string }
  | { type: 'stream_options'; stream_options: { allow_cancel: boolean } }
  | { type: 'error'; code: 'custom'; message: string; allow_retry: boolean };
export type ChatkitPage<T> = {
  data: T[];
  has_more: boolean;
  after: string | null;
};
export type ChatkitThreadView = {
  id: string;
  title: string;
  created_at: string;
  status: { type: 'active' };
  items: ChatkitPage<ChatkitItem>;
  files: Pick<
    WorkspaceFile,
    'id' | 'filename' | 'mime' | 'bytes' | 'kind' | 'pages'
  >[];
};
