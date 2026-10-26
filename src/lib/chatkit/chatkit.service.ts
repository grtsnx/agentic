import { describeComputerAction } from '../../config/agent/tools/computer-tools.js';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Attachment, Widgets } from '@openai/chatkit';
import type {
  ActionApproval,
  WorkspaceFile,
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
      files: withItems
        ? [...record.scope.files.values()].map(
            ({ id, filename, mime, bytes, kind, pages }) => ({
              id,
              filename,
              mime,
              bytes,
              kind,
              pages,
            }),
          )
        : [],
    };
  }

  base(threadId: string) {
    return {
      id: randomUUID(),
      thread_id: threadId,
      created_at: new Date().toISOString(),
    };
  }

  attachment(file: WorkspaceFile): Attachment {
    const base = { id: file.id, name: file.filename, mime_type: file.mime };
    // Image bytes have already passed the shared parser. No bearer tokens or
    // unauthenticated file URLs are placed in the hosted component.
    return file.kind === 'image'
      ? {
          ...base,
          type: 'image',
          preview_url: `data:${file.mime};base64,${file.content.toString('base64')}`,
        }
      : { ...base, type: 'file' };
  }

  files(threadId: string, files: WorkspaceFile[]): ChatkitItem {
    return {
      ...this.base(threadId),
      type: 'widget',
      widget: {
        type: 'Card',
        children: files.map((file) => ({
          type: 'Button',
          label: `Preview ${file.filename}`,
          variant: 'outline',
          onClickAction: {
            type: 'file.preview',
            payload: { fileId: file.id },
            handler: 'client',
          },
        })),
      },
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
      {
        type: 'Text',
        value: `Scope: ${approval.action.tool === 'install_skill' ? 'all local chats and voice' : 'this conversation'}. ${approval.risk}`,
      },
      {
        type: 'Text',
        value:
          approval.action.tool === 'install_skill'
            ? `Source: https://github.com/${approval.action.repository}/tree/${approval.action.commit}/${approval.action.directory}\nFiles: ${approval.action.files.map((file) => file.path).join(', ')}\nOmitted non-document files: ${approval.action.omittedFiles}\nPreview:\n${approval.action.preview}`
            : approval.action.tool === 'mcp_call_tool'
              ? `${approval.action.server} / ${approval.action.name}\n${approval.action.argumentsJson}`
              : approval.action.tool === 'computer_action'
                ? describeComputerAction(approval.action)
                : approval.action.tool === 'execute_code'
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
      approval: {
        action: approval.action,
        target: approval.target,
        risk: approval.risk,
        expiresAt: approval.expiresAt,
        status: approval.status,
      },
    };
  }
}
