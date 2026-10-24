/**
 * Safe Desktop Command Execution Engine for J.A.R.V.I.S.
 * Runs strictly on local Windows host with an immutable security allowlist.
 * Never executes arbitrary shell commands, user strings, or LLM-generated code.
 */

import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectApprovedWebsiteCommand } from "@/lib/webCommands";

export type ActionType = "url" | "app" | "uri" | "folder" | "command";

export interface DesktopActionDef {
  id: string;
  displayName: string;
  type: ActionType;
  target: string;
  args?: string[];
  statusMessage: string;
  successMessage: string;
}

export const APPROVED_DESKTOP_ACTIONS: Record<string, DesktopActionDef> = {
  open_youtube: {
    id: "open_youtube",
    displayName: "YouTube",
    type: "url",
    target: "https://www.youtube.com",
    statusMessage: "Opening YouTube...",
    successMessage: "Directive confirmed: YouTube has been opened in your default browser, sir.",
  },
  open_google: {
    id: "open_google",
    displayName: "Google",
    type: "url",
    target: "https://www.google.com",
    statusMessage: "Opening Google...",
    successMessage: "Directive confirmed: Google search has been opened in your default browser, sir.",
  },
  open_notepad: {
    id: "open_notepad",
    displayName: "Notepad",
    type: "app",
    target: "notepad.exe",
    statusMessage: "Opening Notepad...",
    successMessage: "Directive confirmed: Windows Notepad is now active on your desktop, sir.",
  },
  open_calculator: {
    id: "open_calculator",
    displayName: "Calculator",
    type: "app",
    target: "calc.exe",
    statusMessage: "Opening Calculator...",
    successMessage: "Directive confirmed: Windows Calculator has been launched, sir.",
  },
  open_settings: {
    id: "open_settings",
    displayName: "Windows Settings",
    type: "uri",
    target: "ms-settings:",
    statusMessage: "Opening Windows Settings...",
    successMessage: "Directive confirmed: Windows Settings interface has been opened, sir.",
  },
  open_explorer: {
    id: "open_explorer",
    displayName: "File Explorer",
    type: "app",
    target: "explorer.exe",
    statusMessage: "Opening File Explorer...",
    successMessage: "Directive confirmed: File Explorer has been opened, sir.",
  },
  open_taskmgr: {
    id: "open_taskmgr",
    displayName: "Task Manager",
    type: "app",
    target: "taskmgr.exe",
    statusMessage: "Opening Task Manager...",
    successMessage: "Directive confirmed: Windows Task Manager is active on your desktop, sir.",
  },
  open_paint: {
    id: "open_paint",
    displayName: "Paint",
    type: "app",
    target: "mspaint.exe",
    statusMessage: "Opening Paint...",
    successMessage: "Directive confirmed: Windows Paint has been opened, sir.",
  },
  open_downloads: {
    id: "open_downloads",
    displayName: "Downloads",
    type: "folder",
    target: path.join(os.homedir(), "Downloads"),
    statusMessage: "Accessing Downloads folder...",
    successMessage: "Directive confirmed: Downloads directory opened in File Explorer, sir.",
  },
  open_documents: {
    id: "open_documents",
    displayName: "Documents",
    type: "folder",
    target: path.join(os.homedir(), "Documents"),
    statusMessage: "Accessing Documents folder...",
    successMessage: "Directive confirmed: Documents directory opened in File Explorer, sir.",
  },
  open_desktop_folder: {
    id: "open_desktop_folder",
    displayName: "Desktop Folder",
    type: "folder",
    target: path.join(os.homedir(), "Desktop"),
    statusMessage: "Accessing Desktop workspace folder...",
    successMessage: "Directive confirmed: Desktop workspace folder opened in File Explorer, sir.",
  },
  open_project_folder: {
    id: "open_project_folder",
    displayName: "J.A.R.V.I.S. Project Directory",
    type: "folder",
    target: process.cwd(),
    statusMessage: "Accessing J.A.R.V.I.S. project directory...",
    successMessage: "Directive confirmed: J.A.R.V.I.S. project directory opened in File Explorer, sir.",
  },
  lock_workstation: {
    id: "lock_workstation",
    displayName: "Lock Workstation",
    type: "command",
    target: "rundll32.exe",
    args: ["user32.dll,LockWorkStation"],
    statusMessage: "Securing workstation console...",
    successMessage: "Directive confirmed: Workstation has been securely locked, sir.",
  },
  confirm_shutdown: {
    id: "confirm_shutdown",
    displayName: "Workstation Shutdown",
    type: "command",
    target: "shutdown.exe",
    args: ["/s", "/t", "60", "/c", "J.A.R.V.I.S. initiated system shutdown."],
    statusMessage: "Initiating workstation shutdown sequence...",
    successMessage: "Directive confirmed: Workstation shutdown scheduled with a 60-second grace window, sir. Transmit 'abort shutdown' to cancel.",
  },
  confirm_restart: {
    id: "confirm_restart",
    displayName: "Workstation Restart",
    type: "command",
    target: "shutdown.exe",
    args: ["/r", "/t", "60", "/c", "J.A.R.V.I.S. initiated system restart."],
    statusMessage: "Initiating workstation restart sequence...",
    successMessage: "Directive confirmed: Workstation restart scheduled with a 60-second grace window, sir. Transmit 'abort shutdown' to cancel.",
  },
  abort_shutdown: {
    id: "abort_shutdown",
    displayName: "Abort Shutdown",
    type: "command",
    target: "shutdown.exe",
    args: ["/a"],
    statusMessage: "Aborting system shutdown directive...",
    successMessage: "Directive confirmed: System shutdown sequence has been cancelled, sir.",
  },
};

/**
 * Normalizes query string for action intent matching
 */
function cleanActionQuery(rawQuery: string): string {
  let q = rawQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip conversational address and openers (supporting combined like 'can you please')
  q = q.replace(/^(hey\s+|hi\s+|hello\s+|ok\s+)?jarvis\s+/, "");
  q = q.replace(/^(can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+|please\s+)+(tell\s+me\s+)?/, "");
  q = q.replace(/\s+(for\s+me|right\s+now|now|please|sir|jarvis|thanks|thank\s+you)$/, "").trim();

  // Normalize "open up" or "bring up"
  q = q.replace(/^(open\s+up|bring\s+up)\s+/, "open ");

  // Strip articles/possessives after action verbs: "open the calculator" -> "open calculator"
  q = q.replace(/^(open|launch|start|run|show)\s+(the|my|our|a)\s+/, "$1 ");

  return q.trim();
}

export interface ActionDetectionResult {
  isAction: boolean;
  isSupported: boolean;
  actionDef: DesktopActionDef | null;
  unsupportedMessage?: string;
}

/**
 * Deterministically detects whether a user query is a desktop action directive.
 */
export function detectDesktopAction(rawQuery: string): ActionDetectionResult {
  const q = cleanActionQuery(rawQuery);

  const websiteCommand = detectApprovedWebsiteCommand(rawQuery);
  if (websiteCommand) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS[websiteCommand.id],
    };
  }

  // 1. YouTube
  if (/^(open|launch|start|show)\s+(youtube(\s+com)?|yt)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_youtube,
    };
  }

  // 2. Google
  if (/^(open|launch|start|show)\s+google(\s+com)?$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_google,
    };
  }

  // 3. Notepad
  if (/^(open|launch|start|show)\s+(notepad|text\s+editor|notes)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_notepad,
    };
  }

  // 4. Calculator
  if (/^(open|launch|start|show)\s+(calculator|calc)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_calculator,
    };
  }

  // 5. Settings / Laptop Settings
  if (
    /^(open|launch|start|show)\s+(laptop\s+settings|windows\s+settings|system\s+settings|computer\s+settings|settings)$/.test(q) ||
    q === "laptop settings" ||
    q === "windows settings" ||
    q === "settings"
  ) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_settings,
    };
  }

  // 6. File Explorer
  if (
    /^(open|launch|start|show)\s+(file\s+explorer|files|explorer|windows\s+explorer|folder)$/.test(q)
  ) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_explorer,
    };
  }

  // 7. Task Manager
  if (
    /^(open|launch|start|show)\s+(task\s+manager|taskmgr)$/.test(q) ||
    q === "task manager" ||
    q === "taskmgr"
  ) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_taskmgr,
    };
  }

  // 8. Paint
  if (/^(open|launch|start|show)\s+(paint|mspaint)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_paint,
    };
  }

  // 9. Downloads Folder
  if (
    /^(open|launch|start|show)\s+(downloads|download\s+folder)$/.test(q) ||
    q === "downloads" ||
    q === "open downloads"
  ) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_downloads,
    };
  }

  // 10. Documents Folder
  if (
    /^(open|launch|start|show)\s+(documents|my\s+documents|document\s+folder)$/.test(q) ||
    q === "documents" ||
    q === "open documents"
  ) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_documents,
    };
  }

  // 11. Desktop Folder
  if (/^(open|show)\s+(desktop\s+folder|desktop\s+files)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_desktop_folder,
    };
  }

  // 12. Project Directory
  if (/^(open|show)\s+(project\s+folder|project\s+directory|jarvis\s+folder|jarvis\s+project)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.open_project_folder,
    };
  }

  // 13. Lock Workstation
  if (/^(lock\s+(workstation|pc|computer|screen)|secure\s+workstation)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.lock_workstation,
    };
  }

  // 14. Consequential Actions: Explicit Confirmation Handlers
  if (/^(confirm\s+shutdown|yes\s+shutdown)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.confirm_shutdown,
    };
  }

  if (/^(confirm\s+restart|confirm\s+reboot|yes\s+restart)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.confirm_restart,
    };
  }

  if (/^(abort\s+shutdown|cancel\s+shutdown|stop\s+shutdown)$/.test(q)) {
    return {
      isAction: true,
      isSupported: true,
      actionDef: APPROVED_DESKTOP_ACTIONS.abort_shutdown,
    };
  }

  // Require explicit confirmation for unconfirmed consequential requests
  if (
    /^(shutdown|turn\s+off|power\s+off)\s+(pc|computer|laptop|workstation|system)$/.test(q) ||
    q === "shutdown pc" ||
    q === "shutdown"
  ) {
    return {
      isAction: true,
      isSupported: false,
      actionDef: null,
      unsupportedMessage:
        "Workstation shutdown is a consequential directive, sir. All active tasks will terminate. To proceed with a 60-second graceful shutdown, please explicitly transmit: 'confirm shutdown' (or 'abort shutdown' to cancel).",
    };
  }

  if (
    /^(restart|reboot)\s+(pc|computer|laptop|workstation|system)$/.test(q) ||
    q === "restart pc" ||
    q === "restart"
  ) {
    return {
      isAction: true,
      isSupported: false,
      actionDef: null,
      unsupportedMessage:
        "Workstation restart is a consequential directive, sir. To proceed with a 60-second restart, please explicitly transmit: 'confirm restart' (or 'abort shutdown' to cancel).",
    };
  }

  // 15. Check for unsupported action requests (e.g. "Open Spotify", "Launch Discord", "Open Terminal")
  if (/^(open|launch|start|run|show)\s+([a-z0-9_\-\.\s]+)$/.test(q)) {
    const nonActionTerms = [
      "how",
      "why",
      "what",
      "can",
      "if",
      "when",
      "where",
      "explain",
      "meaning",
      "source",
      "code",
      "file",
      "project",
      "ai",
      "mindedness",
    ];
    const words = q.split(" ");
    const isConceptual = words.some((w) => nonActionTerms.includes(w));

    if (!isConceptual) {
      const requestedTarget = q.replace(/^(open|launch|start|run|show)\s+/, "").trim();
      return {
        isAction: true,
        isSupported: false,
        actionDef: null,
        unsupportedMessage: `I am unable to execute the directive to open "${requestedTarget}", sir. For workstation security, only authorized actions on the allowlist (YouTube, Google, Notepad, Calculator, Task Manager, Paint, Downloads, Documents, Settings, and File Explorer) are permitted.`,
      };
    }
  }

  return {
    isAction: false,
    isSupported: false,
    actionDef: null,
  };
}

/**
 * Validates whether the application is running in a local Windows workstation environment.
 */
export function isLocalWindowsEnvironment(): { allowed: boolean; reason?: string } {
  // 1. Operating system platform check
  if (process.platform !== "win32") {
    return {
      allowed: false,
      reason: `The host system is running in a non-Windows environment (${process.platform}). Desktop command execution is restricted to local Windows workstations.`,
    };
  }

  // 2. Containerized / Sandbox detection
  if (
    process.env.CONTAINER ||
    process.env.DOCKER_CONTAINER ||
    process.env.KUBERNETES_SERVICE_HOST ||
    process.env.WSL_DISTRO_NAME
  ) {
    return {
      allowed: false,
      reason: "This instance is operating inside a container or sandbox environment. Desktop host controls cannot be executed safely.",
    };
  }

  // 3. Remote Cloud deployment detection
  if (
    process.env.VERCEL ||
    process.env.RENDER ||
    process.env.FLY_ALLOC_ID ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.HEROKU_APP_ID
  ) {
    return {
      allowed: false,
      reason: "This instance is hosted on a remote cloud server. Desktop commands can only execute directly on a local Windows PC.",
    };
  }

  return { allowed: true };
}

/**
 * Safely executes an approved desktop action on Windows host.
 * Guarantees zero user input or arbitrary strings are executed.
 */
export async function executeDesktopAction(
  action: DesktopActionDef
): Promise<{ success: boolean; message: string }> {
  const envCheck = isLocalWindowsEnvironment();
  if (!envCheck.allowed) {
    return {
      success: false,
      message: `Directive aborted, sir: ${envCheck.reason}`,
    };
  }

  return new Promise((resolve) => {
    try {
      let child: cp.ChildProcess | null = null;

      if (action.type === "app") {
        // Launch fixed desktop app executable without shell
        child = cp.spawn(action.target, action.args || [], {
          detached: true,
          stdio: "ignore",
        });
      } else if (action.type === "url" || action.type === "uri") {
        // Launch approved URL or URI scheme via cmd start
        child = cp.spawn("cmd.exe", ["/c", "start", "", action.target], {
          detached: true,
          stdio: "ignore",
        });
      } else if (action.type === "folder") {
        // Validate path exists on disk before launching
        if (!fs.existsSync(action.target)) {
          return resolve({
            success: false,
            message: `Directive failed: The directory path was not found on your workstation (${action.target}), sir.`,
          });
        }
        child = cp.spawn("explorer.exe", [action.target], {
          detached: true,
          stdio: "ignore",
        });
      } else if (action.type === "command") {
        // Launch specific verified system command with fixed arguments
        child = cp.spawn(action.target, action.args || [], {
          detached: true,
          stdio: "ignore",
        });
      }

      if (!child) {
        return resolve({
          success: false,
          message: `Directive failed: Process could not be initialized for ${action.displayName}, sir.`,
        });
      }

      let hasResolved = false;

      child.on("error", (err) => {
        if (!hasResolved) {
          hasResolved = true;
          resolve({
            success: false,
            message: `Directive failed, sir: Unable to launch ${action.displayName} (${err.message}).`,
          });
        }
      });

      // Report success only once Node confirms the process was spawned.
      child.once("spawn", () => {
        if (!hasResolved) {
          hasResolved = true;
          resolve({
            success: true,
            message: action.successMessage,
          });
        }
      });

      child.unref();

      // Safety net: never hang the stream if neither event fires.
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          resolve({
            success: false,
            message: `Directive failed, sir: ${action.displayName} did not confirm launch in time.`,
          });
        }
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution fault";
      resolve({
        success: false,
        message: `Directive failed, sir: ${msg}`,
      });
    }
  });
}
