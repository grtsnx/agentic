import { ConfigService } from '@nestjs/config';

export const MCP_NAMES = {
  INSFORGE: 'insforge',
  COOLIFY: 'coolify',
} as const;

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
  };
}
