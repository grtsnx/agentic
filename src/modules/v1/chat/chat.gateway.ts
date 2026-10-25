import { WorkspaceService } from '../workspaces/workspace.service.js';
import type { ConnectionState, ChatSocketResponse } from '@/config';
import { randomUUID } from 'node:crypto';
import { Optional, UseFilters } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  catchError,
  concat,
  finalize,
  from,
  map,
  of,
  type Observable,
} from 'rxjs';
import type { Socket } from 'socket.io';
import { WorkspaceSocketDto } from '@/dto';
import { OpenaiService } from '@/lib';
import { ApplicationException, WebsocketExceptionFilter } from '@/middleware';

@UseFilters(WebsocketExceptionFilter)
@WebSocketGateway({
  namespace: '/v1/chat',
  transports: ['websocket'],
  maxHttpBufferSize: 8 * 1024,
})
export class ChatV1Gateway
  implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
  // Each socket owns ephemeral history that becomes unreachable after disconnect.
  private readonly connections = new WeakMap<Socket, ConnectionState>();

  constructor(private readonly openaiService: OpenaiService, @Optional() private readonly workspaces?: WorkspaceService) {}

  handleConnection(client: Socket): void {
    this.connections.set(client, {
      session: this.openaiService.createSession(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.connections.get(client)?.abortController?.abort();
    this.connections.delete(client);
  }

  @SubscribeMessage('chat.send')
  sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() request: WorkspaceSocketDto,
  ): Observable<ChatSocketResponse> {
    const state = this.getConnectionState(client);
    // Prevent concurrent turns from interleaving deltas in one conversation.
    if (state.abortController) {
      return of({
        event: 'chat.error',
        data: {
          code: 'CHAT_BUSY',
          message: 'Wait for the active response or cancel it first.',
        },
      });
    }

    const workspace = request.workspaceId && this.workspaces
      ? this.workspaces.store.authorize(request.workspaceId,request.workspaceToken ?? '') : undefined;
    const requestId = randomUUID();
    const abortController = new AbortController();
    state.abortController = abortController;

    const response$ = from(
      workspace && this.workspaces ? this.workspaces.stream(workspace,request.message.trim(),abortController.signal) : this.openaiService.streamReply(request.message.trim(), {
        session: state.session,
        signal: abortController.signal,
      }),
    ).pipe(
      map((event): ChatSocketResponse => {
        if (event.type === 'status') {
          return {
            event: 'chat.status',
            data: {
              requestId,
              phase: event.phase,
              message: event.message,
              ...(event.detail ? { detail: event.detail } : {}),
            },
          };
        }

        if (event.type === 'delta') {
          return {
            event: 'chat.delta',
            data: { requestId, delta: event.delta },
          };
        }

        return {
          event: 'chat.completed',
          data: { requestId, response: event.response },
        };
      }),
      catchError((error: unknown) =>
        of({
          event: abortController.signal.aborted
            ? 'chat.cancelled'
            : 'chat.error',
          data: {
            requestId,
            ...(abortController.signal.aborted
              ? {}
              : {
                  code:
                    error instanceof ApplicationException
                      ? error.code
                      : 'STREAM_FAILED',
                  message:
                    error instanceof ApplicationException
                      ? error.message
                      : 'The chat stream could not be completed.',
                  ...(error instanceof ApplicationException
                    ? { retryable: error.retryable }
                    : {}),
                }),
          },
        }),
      ),
      finalize(() => {
        if (state.abortController === abortController) {
          state.abortController = undefined;
        }
      }),
    );

    return concat(
      of({ event: 'chat.started', data: { requestId } }),
      response$,
    );
  }

  @SubscribeMessage('chat.cancel')
  cancel(@ConnectedSocket() client: Socket): ChatSocketResponse {
    const state = this.getConnectionState(client);
    if (!state.abortController) {
      return {
        event: 'chat.error',
        data: { code: 'NO_ACTIVE_CHAT', message: 'There is no active chat.' },
      };
    }

    state.abortController.abort();
    return { event: 'chat.cancelling', data: {} };
  }

  private getConnectionState(client: Socket): ConnectionState {
    const current = this.connections.get(client);
    if (current) return current;

    const state = { session: this.openaiService.createSession() };
    this.connections.set(client, state);
    return state;
  }
}
