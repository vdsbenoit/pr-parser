/**
 * Reads HTML content from the clipboard
 */
export async function readClipboard(): Promise<string> {
  const process = new Deno.Command("pbpaste", {
    stdout: "piped",
    stderr: "piped",
  });

  const output = await process.output();

  if (!output.success) {
    throw new Error("Failed to read clipboard");
  }

  return new TextDecoder().decode(output.stdout);
}

/**
 * Writes content to the clipboard
 */
export async function writeClipboard(content: string): Promise<void> {
  const process = new Deno.Command("pbcopy", {
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });

  const child = process.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(content));
  await writer.close();

  const output = await child.output();

  if (!output.success) {
    throw new Error("Failed to write to clipboard");
  }
}
