import { ConfigService } from '@nestjs/config';

export const MCP_NAMES = {
  INSFORGE: 'insforge',
  COOLIFY: 'coolify',
  REFERO: 'refero',
} as const;

export const REFERO_MCP_URL = 'https://api.refero.design/mcp';

export function buildMcpServers(config: ConfigService) {
  return {
    INSFORGE: {
      type: 'url',
      name: MCP_NAMES.INSFORGE,
      url: `${config.get('INSFORGE_API_BASE_URL', 'https://insforge.blydr.ai')}/mcp`,
    },
    COOLIFY: {
      type: 'url',
      name: MCP_NAMES.COOLIFY,
      url: config.get('COOLIFY_MCP_URL', 'https://cloud2.blydr.ai/mcp'),
    },
    REFERO: {
      type: 'url',
      name: MCP_NAMES.REFERO,
      url: config.get('REFERO_MCP_URL', REFERO_MCP_URL),
    },
  };
}

/**
 * Refero MCP requires a Pro subscription and authenticates via a static bearer
 * token stored in the vault. Only attach it to an agent when the key is present.
 */
export function referoEnabled(config: ConfigService): boolean {
  return Boolean(config.get<string>('REFERO_API_KEY'));
}
