import { detectDesktopAction } from "../lib/desktopActions.ts";

console.log("=== RUNNING DESKTOP ACTION DETECTION SUITE ===");

const testQueries = [
  // Supported actions
  { q: "Open YouTube", expected: "open_youtube" },
  { q: "open youtube", expected: "open_youtube" },
  { q: "Jarvis, open YouTube", expected: "open_youtube" },
  { q: "Can you please open youtube?", expected: "open_youtube" },
  { q: "open up youtube for me", expected: "open_youtube" },
  { q: "Open Google", expected: "open_google" },
  { q: "launch google", expected: "open_google" },
  { q: "Open Notepad", expected: "open_notepad" },
  { q: "launch notepad", expected: "open_notepad" },
  { q: "open the notepad", expected: "open_notepad" },
  { q: "Open Notepad now", expected: "open_notepad" },
  { q: "Open Calculator", expected: "open_calculator" },
  { q: "open calc", expected: "open_calculator" },
  { q: "open the calculator", expected: "open_calculator" },
  { q: "bring up calculator", expected: "open_calculator" },
  { q: "Open Settings", expected: "open_settings" },
  { q: "Open laptop settings", expected: "open_settings" },
  { q: "open my laptop settings", expected: "open_settings" },
  { q: "open windows settings", expected: "open_settings" },
  { q: "settings", expected: "open_settings" },
  { q: "laptop settings", expected: "open_settings" },
  { q: "Open File Explorer", expected: "open_explorer" },
  { q: "open explorer", expected: "open_explorer" },
  { q: "open files", expected: "open_explorer" },
  { q: "open the file explorer", expected: "open_explorer" },
  { q: "open task manager", expected: "open_taskmgr" },
  { q: "launch paint", expected: "open_paint" },
  { q: "open downloads", expected: "open_downloads" },
  { q: "open documents", expected: "open_documents" },
  { q: "open project folder", expected: "open_project_folder" },
  { q: "lock workstation", expected: "lock_workstation" },
  { q: "confirm shutdown", expected: "confirm_shutdown" },
  { q: "abort shutdown", expected: "abort_shutdown" },

  // Consequential actions requiring explicit confirmation
  { q: "shutdown pc", expectedUnsupported: true },
  { q: "restart computer", expectedUnsupported: true },

  // Unsupported action directives
  { q: "Open Spotify", expectedUnsupported: true },
  { q: "launch discord", expectedUnsupported: true },
  { q: "open terminal", expectedUnsupported: true },
  { q: "run hack.exe", expectedUnsupported: true },
  { q: "open firefox", expectedUnsupported: true },

  // Non-action general questions
  { q: "What time is it?", expectedNonAction: true },
  { q: "What is today's date?", expectedNonAction: true },
  { q: "How do I open a file in Python?", expectedNonAction: true },
  { q: "Tell me a joke about robots", expectedNonAction: true },
  { q: "Open source software benefits", expectedNonAction: true }
];

let errors = 0;
for (const tc of testQueries) {
  const result = detectDesktopAction(tc.q);
  if (tc.expected) {
    if (!result.isAction || !result.isSupported || result.actionDef?.id !== tc.expected) {
      console.error(`FAIL: "${tc.q}" expected action ${tc.expected}, got:`, result);
      errors++;
    } else {
      console.log(`PASS: "${tc.q}" -> Detected: ${result.actionDef.displayName} (${result.actionDef.id})`);
    }
  } else if (tc.expectedUnsupported) {
    if (!result.isAction || result.isSupported) {
      console.error(`FAIL: "${tc.q}" should be unsupported action, got:`, result);
      errors++;
    } else {
      console.log(`PASS: "${tc.q}" -> Blocked as unsupported: "${result.unsupportedMessage}"`);
    }
  } else if (tc.expectedNonAction) {
    if (result.isAction) {
      console.error(`FAIL: "${tc.q}" should NOT be action, got:`, result);
      errors++;
    } else {
      console.log(`PASS: "${tc.q}" -> Correctly passed through (non-action)`);
    }
  }
}

if (errors === 0) {
  console.log("\nALL DESKTOP ACTION DETECTION TESTS PASSED!");
} else {
  console.error(`\nFAILED ${errors} TESTS`);
  process.exit(1);
}
