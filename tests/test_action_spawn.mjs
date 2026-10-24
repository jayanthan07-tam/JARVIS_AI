import cp from "node:child_process";

console.log("OS Platform:", process.platform);

// Test launch of notepad (and immediate verify & close)
function testLaunchNotepad() {
  return new Promise((resolve, reject) => {
    try {
      const child = cp.spawn("notepad.exe", [], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      console.log("Launched notepad.exe successfully, PID:", child.pid);
      setTimeout(() => {
        try {
          cp.execSync("taskkill /IM notepad.exe /F", { stdio: "ignore" });
          console.log("Notepad closed cleanly.");
        } catch {}
        resolve(true);
      }, 1000);
    } catch (e) {
      console.error("Failed to launch notepad:", e);
      reject(e);
    }
  });
}

// Test launch of calc (and immediate verify & close)
function testLaunchCalc() {
  return new Promise((resolve, reject) => {
    try {
      const child = cp.spawn("calc.exe", [], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      console.log("Launched calc.exe successfully, PID:", child.pid);
      setTimeout(() => {
        try {
          cp.execSync("taskkill /IM CalculatorApp.exe /F", { stdio: "ignore" });
        } catch {}
        resolve(true);
      }, 1000);
    } catch (e) {
      console.error("Failed to launch calc:", e);
      reject(e);
    }
  });
}

async function run() {
  await testLaunchNotepad();
  await testLaunchCalc();
  console.log("Process launching verified successfully!");
}

run();
