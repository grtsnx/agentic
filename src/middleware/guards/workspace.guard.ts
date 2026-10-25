import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { WorkspaceRequest } from '@/config';
// Guard is owned by the workspace module; avoid importing its own module barrel.
import { WorkspaceStore } from '../../modules/v1/workspaces/workspace-store.service.js';
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly store: WorkspaceStore) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    if (!request.params.id) return true; // The sole unscoped route creates a new capability.
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    request.workspace = this.store.authorize(String(request.params.id), token);
    return true;
  }
}
