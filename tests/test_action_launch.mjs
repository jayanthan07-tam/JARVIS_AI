import cp from "node:child_process";

console.log("Testing process launching on platform:", process.platform);

export function launchAction(action) {
  if (process.platform !== "win32") {
    return { success: false, error: "Non-Windows platform" };
  }

  try {
    let child;
    if (action.type === "app") {
      child = cp.spawn(action.target, [], {
        detached: true,
        stdio: "ignore",
      });
    } else if (action.type === "url" || action.type === "uri") {
      // Use cmd.exe /c start "" <url/uri>
      child = cp.spawn("cmd.exe", ["/c", "start", "", action.target], {
        detached: true,
        stdio: "ignore",
      });
    }
    if (child) {
      child.unref();
      return { success: true, pid: child.pid };
    }
    return { success: false, error: "Process could not be created" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Test dry launch of notepad
const res = launchAction({ type: "app", target: "notepad.exe" });
console.log("Launch notepad result:", res);

setTimeout(() => {
  try {
    cp.execSync("taskkill /IM notepad.exe /F", { stdio: "ignore" });
    console.log("Cleaned up notepad.");
  } catch {}
}, 500);
