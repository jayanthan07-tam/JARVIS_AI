# Unreal MCP setup

## Verified local setup

- Unreal Engine `5.8.3` is installed at `D:\Epic Games\UE_5.8`.
- The existing project is `MyProject 5.8/MyProject.uproject`.
- The experimental `ModelContextProtocol` plugin is enabled in that project descriptor. Its default auto-start setting remains off.
- The installed plugin source defines the default Streamable HTTP endpoint as `http://127.0.0.1:8000/mcp`.
- Unreal's HTTP server defaults to the `localhost` bind address. The verification run listened on `127.0.0.1:8000`.
- The existing Antigravity entry is in `%USERPROFILE%\.gemini\config\mcp_config.json` and points to this endpoint using the supported legacy `serverUrl` property. No MCP entries were changed.

## Start it manually

Run this from PowerShell when you want the Unreal project and its MCP server active:

```powershell
& "D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" `
  "D:\Jayanthan\Documents\JARVIS_AI\MyProject 5.8\MyProject.uproject" `
  -ModelContextProtocolStartServer
```

The plugin's source confirms that `-ModelContextProtocolStartServer` explicitly starts the server. The editor must remain open while Antigravity uses it. J.A.R.V.I.S. does not launch Unreal automatically.

Check the listener with:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8000
```

Keep the listener on loopback. Do not change the HTTP server bind address to a LAN or public interface.

## Verification record

On 2026-10-18, the Unreal Editor was started with the source-confirmed `-ModelContextProtocolStartServer` flag. The listener bound to `127.0.0.1:8000` (not a LAN or public interface). A direct local MCP client completed `initialize` with protocol `2025-11-25` (HTTP 200), sent `notifications/initialized`, listed the three exposed tools (`list_toolsets`, `describe_toolset`, and `call_tool`), and called the harmless read-only `list_toolsets` operation. It returned `AgentSkillToolset` and `AIAssistantToolset`.

The editor remains running for the current session. If it is closed, the endpoint stops; start it again with the command above. `http://127.0.0.1:8000/mcp` is an MCP protocol endpoint, not a browser page or the J.A.R.V.I.S. UI. Use the configured MCP client rather than opening the URL as a web page. The Next.js J.A.R.V.I.S. UI runs separately.

This verifies the local Unreal endpoint and protocol. The Antigravity application's own UI connection has not been verified. The installed MCP toolsets expose project-context and AgentSkill functions, not level, actor, or asset authoring. The separate optional JARVIS editor scene and its verification are documented in `Unreal/JARVIS_Experience/README.md`; MCP is not used to create that scene.
