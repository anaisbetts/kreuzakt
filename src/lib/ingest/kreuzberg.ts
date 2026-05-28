const KREUZBERG_CLI_ENV = "KREUZAKT_KREUZBERG_CLI";
const KREUZBERG_CLI_NAME = "kreuzakt-kreuzberg";
const LOCAL_CLI_PATH = `target/debug/${KREUZBERG_CLI_NAME}`;

export interface ExtractionResult {
  content: string;
  mimeType: string;
  metadata?: {
    pageCount?: number;
  };
}

type RenderPdfPageOptions = {
  dpi?: number | null;
};

type CliExtractResponse = {
  content: string;
  mimeType: string;
  pageCount: number | null;
};

type CliDetectMimeResponse = {
  mimeType: string;
};

let resolvedCliPath: Promise<string> | null = null;

export async function detectMimeTypeFromPathWithNativeBinding(
  filePath: string,
): Promise<string> {
  const result = await runKreuzbergJson<CliDetectMimeResponse>("detect-mime", {
    filePath,
  });
  return result.mimeType;
}

export async function extractFileWithNativeConfig(
  filePath: string,
  mimeType: string | null,
  config: unknown,
): Promise<ExtractionResult> {
  const result = await runKreuzbergJson<CliExtractResponse>("extract", {
    filePath,
    mimeType,
    config,
  });

  return {
    content: result.content,
    mimeType: result.mimeType,
    metadata: {
      pageCount: result.pageCount ?? undefined,
    },
  };
}

export async function renderPdfPageWithNativeBinding(
  filePath: string,
  pageIndex: number,
  options?: RenderPdfPageOptions,
): Promise<Buffer> {
  return runKreuzbergBytes("render-pdf-page", {
    filePath,
    pageIndex,
    dpi: options?.dpi ?? null,
  });
}

async function runKreuzbergJson<T>(
  command: string,
  request: unknown,
): Promise<T> {
  const output = await runKreuzberg(command, request);

  try {
    return JSON.parse(output.toString("utf8")) as T;
  } catch (error) {
    throw new Error(
      `Kreuzberg CLI returned invalid JSON for ${command}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function runKreuzbergBytes(
  command: string,
  request: unknown,
): Promise<Buffer> {
  return runKreuzberg(command, request);
}

async function runKreuzberg(
  command: string,
  request: unknown,
): Promise<Buffer> {
  const cliPath = await getCliPath();
  const child = Bun.spawn([cliPath, command], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = streamToBuffer(child.stdout);
  const stderr = streamToText(child.stderr);

  child.stdin.write(JSON.stringify(request));
  child.stdin.end();

  const [code, output, errorOutput] = await Promise.all([
    child.exited,
    stdout,
    stderr,
  ]);

  if (code === 0) {
    return output;
  }

  throw new Error(
    `Kreuzberg CLI failed for ${command} with exit code ${code}: ${
      errorOutput.trim() || "no stderr output"
    }`,
  );
}

async function getCliPath(): Promise<string> {
  resolvedCliPath ??= resolveCliPath();
  return resolvedCliPath;
}

async function resolveCliPath(): Promise<string> {
  const configured = process.env[KREUZBERG_CLI_ENV]?.trim();

  if (configured) {
    return configured;
  }

  return LOCAL_CLI_PATH;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) {
    return Buffer.alloc(0);
  }

  return Buffer.from(await new Response(stream).arrayBuffer());
}

async function streamToText(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) {
    return "";
  }

  return new Response(stream).text();
}
