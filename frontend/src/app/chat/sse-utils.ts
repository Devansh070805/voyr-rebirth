"use client";

/**
 * SSE Utilities — Shared SSE parsing for the frontend.
 *
 * Mirrors the same pattern as backend/src/infra/sse-utils.ts to
 * eliminate the triplicated SSE parsing loop.
 */

/**
 * Async generator that yields trimmed data lines from a ReadableStream reader.
 * Handles the SSE protocol: splits on newlines, buffers partial lines,
 * and yields each line that starts with "data: " (with the prefix stripped).
 */
export async function* iterSSEDataLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
): AsyncGenerator<string> {
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      yield trimmed.slice(6);
    }
  }
}
