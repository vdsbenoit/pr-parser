/**
 * Checks if the app is running from the app bundle
 */
export function isRunningFromApp(): boolean {
  const execPath = Deno.execPath();
  return execPath.includes(".app/") || Deno.args.includes("--app-mode");
}

/**
 * Shows a macOS dialog using osascript
 */
export async function showDialog(
  message: string,
  title: string = "PR Parser",
  type: "info" | "error" = "info",
): Promise<void> {
  if (!isRunningFromApp()) {
    console.log(`${type === "error" ? "❌" : "✅"} ${title}: ${message}`);
    return;
  }

  const iconType = type === "error" ? "stop" : "note";
  const script =
    `display dialog "${message.replace(/"/g, "\\\"")}" with title "${title}" buttons {"OK"} default button "OK" with icon ${iconType}`;

  const process = new Deno.Command("osascript", {
    args: ["-e", script],
    stdout: "piped",
    stderr: "piped",
  });

  await process.output();
}

/**
 * Shows a progress notification
 */
export async function showProgress(message: string): Promise<void> {
  if (!isRunningFromApp()) {
    console.log(message);
    return;
  }

  const script =
    `display notification "${message.replace(/"/g, "\\\"")}" with title "PR Parser"`;

  const process = new Deno.Command("osascript", {
    args: ["-e", script],
    stdout: "piped",
    stderr: "piped",
  });

  await process.output();
}

/**
 * Simulates Cmd+V to paste content
 */
export async function pasteResult(): Promise<void> {
  if (!isRunningFromApp()) {
    return;
  }

  const script =
    `tell application "System Events" to keystroke "v" using command down`;

  const process = new Deno.Command("osascript", {
    args: ["-e", script],
    stdout: "piped",
    stderr: "piped",
  });

  await process.output();
}
