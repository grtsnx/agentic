import { ConfigService } from '@nestjs/config';

export const MCP_NAMES = {
  INSFORGE: 'insforge',
  COOLIFY: 'coolify',
  REFERO: 'refero',
} as const;

export const REFERO_MCP_URL = 'https://api.refero.design/mcp';

/**
 * Animate UI (https://animate-ui.com) is a shadcn-compatible component REGISTRY of
 * Motion-powered animated React components — NOT an npm package and NOT a remote MCP.
 * The "shadcn MCP" (`npx shadcn@latest mcp`) is a local stdio server, which Anthropic
 * managed agents cannot run (they only accept remote URL MCP servers). So Animate UI is
 * made compulsory at code-gen time instead: the CodeWriter + Animation agents install
 * its components with the shadcn CLI over bash, pointed at this registry, and ground the
 * exact component names / peer deps with web_fetch of the docs.
 *
 * CLI usage in the generated project:
 *   npx shadcn@latest add @animate-ui/<component>
 *   npx shadcn@latest add "https://animate-ui.com/r/<component>.json"
 * components.json registries map:
 *   { "@animate-ui": "https://animate-ui.com/r/{name}.json" }
 */
export const ANIMATE_UI_REGISTRY = 'https://animate-ui.com/r/{name}.json';
export const ANIMATE_UI_URL = 'https://animate-ui.com';

/**
 * React Bits (https://reactbits.dev) — another shadcn-compatible registry of animated/
 * creative React components. Same constraints as Animate UI (registry + CLI, not an MCP).
 * components.json registries map:
 *   { "@react-bits": "https://reactbits.dev/r/{name}.json" }
 * CLI usage: npx shadcn@latest add @react-bits/<component>
 */
export const REACT_BITS_REGISTRY = 'https://reactbits.dev/r/{name}.json';
export const REACT_BITS_URL = 'https://reactbits.dev';

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
