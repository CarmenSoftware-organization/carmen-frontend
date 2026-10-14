/**
 * สร้าง JSON สำหรับวางใน .mcp.json ของ Claude Code — backendUrl มาจาก runtime config (ไม่มี trailing slash)
 */
export function buildMcpConfigSnippet(backendUrl: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        carmen: {
          type: "http",
          url: `${backendUrl}/mcp`,
          headers: { "x-mcp-token": token },
        },
      },
    },
    null,
    2,
  );
}
