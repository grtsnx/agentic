import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Widgets } from '@openai/chatkit';
import type {
  ActionApproval,
  ChatkitContent,
  ChatkitItem,
  ChatkitPage,
  ChatkitThread,
  ChatkitThreadView,
  OpenaiStreamResponse,
} from '@/config';

// Wire-format adapter only. Agent execution and approval policy stay in the feature services.
@Injectable()
export class ChatkitAdapterService {
  page<T extends { id: string }>(
    items: T[],
    limit = 20,
    order: 'asc' | 'desc' = 'desc',
    after?: string | null,
  ): ChatkitPage<T> {
    limit = Math.min(limit, 100);
    const sorted = order === 'asc' ? [...items] : [...items].reverse();
    const offset = after
      ? sorted.findIndex((item) => item.id === after) + 1
      : 0;
    const data = sorted.slice(offset, offset + limit);
    const has_more = offset + limit < sorted.length;
    return { data, has_more, after: has_more ? data.at(-1)!.id : null };
  }

  thread(record: ChatkitThread, withItems = true): ChatkitThreadView {
    return {
      id: record.scope.id,
      title: record.title,
      created_at: record.createdAt,
      status: { type: 'active' },
      items: this.page(withItems ? record.items : []),
    };
  }

  base(threadId: string) {
    return {
      id: randomUUID(),
      thread_id: threadId,
      created_at: new Date().toISOString(),
    };
  }

  content(response: OpenaiStreamResponse): ChatkitContent {
    return {
      type: 'output_text',
      text: response.message,
      annotations: response.sources
        .filter((source) => /^https?:\/\//i.test(source.url))
        .map((source) => ({
          type: 'annotation',
          source: {
            type: 'url',
            url: source.url,
            title: source.title,
            attribution: source.domain,
          },
          ...(source.endIndex !== undefined &&
          source.endIndex <= response.message.length
            ? { index: source.endIndex }
            : {}),
        })),
    };
  }

  usage(threadId: string, response: OpenaiStreamResponse): ChatkitItem {
    const { tokens, durationMs, cost, models } = response.runtime;
    return {
      ...this.base(threadId),
      type: 'widget',
      widget: {
        type: 'Card',
        children: [
          {
            type: 'Text',
            value: `${tokens.input} in / ${tokens.output} out / ${tokens.total} total`,
            size: 'sm',
          },
          {
            type: 'Text',
            value: `${(durationMs / 1000).toFixed(1)}s · Estimated $${cost.estimatedUsd.toFixed(6)} USD · ${models.map((model) => model.name).join(', ')}`,
            size: 'sm',
          },
        ],
      },
    };
  }

  approval(
    threadId: string,
    approval: ActionApproval,
    id: string = randomUUID(),
    result?: string,
  ): ChatkitItem {
    const children: Widgets.WidgetComponent[] = [
      { type: 'Text', value: 'Review action', weight: 'semibold' },
      { type: 'Text', value: approval.target },
      { type: 'Text', value: `Scope: this conversation. ${approval.risk}` },
      {
        type: 'Text',
        value:
          approval.action.tool === 'execute_code'
            ? approval.action.code
            : `File: ${approval.action.fileId}`,
      },
      {
        type: 'Text',
        value: `Expires: ${new Date(approval.expiresAt).toISOString()}`,
        size: 'sm',
      },
    ];
    if (approval.status === 'pending' && !result) {
      children.push({
        type: 'Row',
        children: [
          {
            type: 'Button',
            label: 'Approve once',
            onClickAction: {
              type: 'approval.decide',
              payload: { decision: 'approve' },
            },
          },
          {
            type: 'Button',
            label: 'Deny',
            onClickAction: {
              type: 'approval.decide',
              payload: { decision: 'deny' },
            },
          },
        ],
      });
    } else children.push({ type: 'Text', value: result ?? approval.status });
    return {
      ...this.base(threadId),
      id,
      type: 'widget',
      widget: { type: 'Card', children },
    };
  }
}
