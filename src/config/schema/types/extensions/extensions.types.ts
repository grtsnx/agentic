import type { z } from 'zod';
import type {
  extensionInputSchema,
  extensionsConfigSchema,
  mcpServerConfigSchema,
  mcpActionSchema,
} from '../../extensions/extensions.schema.js';
import type {
  WorkspaceAction,
  ActionApproval,
  ToolAudit,
} from '../workspaces/workspace.types.js';
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type ExtensionsConfig = z.infer<typeof extensionsConfigSchema>;
export type ExtensionInput = z.infer<typeof extensionInputSchema>;
export type McpAction = z.infer<typeof mcpActionSchema>;
export interface ExtensionContext {
  scopeId?: string;
  traceId?: string;
  audit?: (event: ToolAudit) => void;
  propose?: (action: WorkspaceAction) => ActionApproval;
}

export type SkillInstallAction = z.infer<
  typeof import('../../extensions/skill-install.schema.js').skillInstallActionSchema
>;
