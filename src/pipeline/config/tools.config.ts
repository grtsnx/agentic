export const TOOLS = {
  ALL: [{ type: 'agent_toolset_20260401' }],

  CODE: [
    {
      type: 'agent_toolset_20260401',
      default_config: { enabled: false },
      configs: [
        { name: 'bash', enabled: true },
        { name: 'read', enabled: true },
        { name: 'write', enabled: true },
        { name: 'edit', enabled: true },
        { name: 'glob', enabled: true },
        { name: 'grep', enabled: true },
      ],
    },
  ],

  READ: [
    {
      type: 'agent_toolset_20260401',
      default_config: { enabled: false },
      configs: [
        { name: 'read', enabled: true },
        { name: 'web_search', enabled: true },
        { name: 'web_fetch', enabled: true },
      ],
    },
  ],

  BASH: [
    {
      type: 'agent_toolset_20260401',
      default_config: { enabled: false },
      configs: [{ name: 'bash', enabled: true }],
    },
  ],

  BASH_READ: [
    {
      type: 'agent_toolset_20260401',
      default_config: { enabled: false },
      configs: [
        { name: 'bash', enabled: true },
        { name: 'read', enabled: true },
        { name: 'glob', enabled: true },
        { name: 'grep', enabled: true },
      ],
    },
  ],

  WEB: [
    {
      type: 'agent_toolset_20260401',
      default_config: { enabled: false },
      configs: [
        { name: 'web_fetch', enabled: true },
        { name: 'web_search', enabled: true },
      ],
    },
  ],

  NONE: [{ type: 'agent_toolset_20260401', default_config: { enabled: false } }],

  withMcp: (serverName: string) => ({
    type: 'mcp_toolset',
    mcp_server_name: serverName,
    default_config: { permission_policy: { type: 'always_allow' } },
  }),
};
