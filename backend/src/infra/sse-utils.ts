/**
 * SSE Utilities — Shared SSE parsing primitives.
 *
 * Extracts the common SSE line-splitting and data-line yielding pattern
 * that was triplicated across streamOpenAI / streamAnthropic / useStreamSSE.
 */

/**
 * Yield trimmed data lines from a ReadableStream reader.
 * Handles the SSE protocol: splits on newlines, buffers partial lines,
 * and yields each line that starts with "data: " (with the prefix stripped).
 *
 * Usage:
 *   for await (const data of iterSSEDataLines(reader, decoder)) {
 *     if (data === '[DONE]') { ... }
 *     const parsed = JSON.parse(data);
 *     ...
 *   }
 */
export async function* iterSSEDataLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: { decode(buffer: Uint8Array, options?: { stream?: boolean }): string },
): AsyncGenerator<string> {
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim(); // Handle data: [DONE] or data:[DONE]
        yield dataStr;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
