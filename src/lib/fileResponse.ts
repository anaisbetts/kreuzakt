import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";

/** Small JPEGs only — loads into memory. */
export async function jpegThumbnailResponse(absolutePath: string) {
  const buffer = await readFile(absolutePath);
  const body = new Uint8Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(body.byteLength),
    },
  });
}

/** Stream arbitrary files without buffering entire content. */
export function streamedFileResponse(
  absolutePath: string,
  headers: Record<string, string>,
) {
  const nodeReadable = createReadStream(absolutePath);
  const webStream = Readable.toWeb(nodeReadable);
  return new Response(webStream as unknown as BodyInit, { headers });
}
