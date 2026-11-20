import { describe, expect, it, mock } from "bun:test";
import OpenAI from "openai";

import {
  buildMetadataSystemPrompt,
  parseMetadataResponse,
  requestMetadataCompletion,
} from "./metadata";

describe("buildMetadataSystemPrompt", () => {
  it("returns the base prompt when preferred language is unset", () => {
    const prompt = buildMetadataSystemPrompt(null);

    expect(prompt).toContain(
      "Extract metadata from the following document text.",
    );
    expect(prompt).not.toContain(
      "Generate all text in the following language:",
    );
  });

  it("appends the preferred language instruction when set", () => {
    const prompt = buildMetadataSystemPrompt("German");

    expect(prompt).toContain(
      "Extract metadata from the following document text.",
    );
    expect(prompt).toContain(
      "Generate all text in the following language: German",
    );
  });
});

describe("parseMetadataResponse", () => {
  const metadata = {
    title: "Water Bill 2024",
    description: "Annual water bill for the flat.",
    document_date: "2024-03-01",
    language: "de",
  };
  const json = JSON.stringify(metadata);
  const fallback = {
    title: "Scan 001",
    description: "",
    document_date: null,
    language: "en",
  };

  it("parses JSON wrapped in a ```json fence", () => {
    expect(
      parseMetadataResponse(`\`\`\`json\n${json}\n\`\`\``, "scan_001.pdf"),
    ).toEqual(metadata);
  });

  it("parses JSON surrounded by prose", () => {
    expect(
      parseMetadataResponse(
        `Here is the metadata:\n${json}\nLet me know if you need more.`,
        "scan_001.pdf",
      ),
    ).toEqual(metadata);
  });

  it("keeps fences and braces that appear inside string values", () => {
    const tricky = {
      title: "Config {draft}",
      description: "Uses ``` fences and { braces }.",
      document_date: null,
      language: "en",
    };

    expect(
      parseMetadataResponse(
        `Here is the {metadata}:\n\`\`\`json\n${JSON.stringify(tricky)}\n\`\`\``,
        "x.pdf",
      ),
    ).toEqual(tricky);
  });

  it("ignores <think> blocks before the JSON payload", () => {
    const withThinking = `<think>Draft {"title": "Wrong"} inside \`\`\`json\n{"title":"Also Wrong"}\n\`\`\`</think>\n\`\`\`json\n${json}\n\`\`\``;
    expect(parseMetadataResponse(withThinking, "scan_001.pdf")).toEqual(
      metadata,
    );
  });

  it("salvages valid fields when another field has a non-string value", () => {
    expect(
      parseMetadataResponse(
        JSON.stringify({
          title: "Water Bill 2024",
          description: null,
          document_date: "2024-03-01",
          language: "de",
        }),
        "scan_001.pdf",
      ),
    ).toEqual({
      title: "Water Bill 2024",
      description: "",
      document_date: "2024-03-01",
      language: "de",
    });
  });

  it("falls back to the filename when there is no JSON object", () => {
    for (const content of ["I cannot do that.", "```json\n```", "[1, 2]"]) {
      expect(parseMetadataResponse(content, "scan_001.pdf")).toEqual(fallback);
    }
  });
});

describe("requestMetadataCompletion", () => {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "user", content: "text" },
  ];
  const completion = { id: "chatcmpl-1", choices: [] };

  function fakeClient(create: ReturnType<typeof mock>) {
    return { chat: { completions: { create } } } as unknown as OpenAI;
  }

  function apiError(status: number) {
    return OpenAI.APIError.generate(
      status,
      { message: `error ${status}` },
      `${status} error`,
      new Headers(),
    );
  }

  function responseFormatOf(create: ReturnType<typeof mock>, call: number) {
    const params = (create.mock.calls as unknown[][])[call]?.[0] as {
      response_format: {
        type: string;
        json_schema?: { name: string; schema: Record<string, unknown> };
      };
    };
    return params.response_format;
  }

  it("sends a json_schema without $schema", async () => {
    const create = mock().mockResolvedValueOnce(completion);

    const response = await requestMetadataCompletion(
      fakeClient(create),
      "some-model",
      messages,
    );

    expect(response).toBe(completion as never);
    expect(create).toHaveBeenCalledTimes(1);

    const format = responseFormatOf(create, 0);
    expect(format.type).toBe("json_schema");
    expect(format.json_schema?.name).toBe("document_metadata");
    expect(format.json_schema?.schema).not.toHaveProperty("$schema");
    expect(format.json_schema?.schema).toMatchObject({
      type: "object",
      required: ["title", "description", "document_date", "language"],
      additionalProperties: false,
    });
  });

  it("retries in json_object mode when json_schema is rejected with 400 or 422", async () => {
    for (const status of [400, 422]) {
      const create = mock()
        .mockRejectedValueOnce(apiError(status))
        .mockResolvedValueOnce(completion);

      const response = await requestMetadataCompletion(
        fakeClient(create),
        "some-model",
        messages,
      );

      expect(response).toBe(completion as never);
      expect(create).toHaveBeenCalledTimes(2);
      expect(responseFormatOf(create, 0).type).toBe("json_schema");
      expect(responseFormatOf(create, 1).type).toBe("json_object");
    }
  });

  it("does not retry other failures", async () => {
    const failure = apiError(500);
    const create = mock(async () => {
      throw failure;
    });

    await expect(
      requestMetadataCompletion(fakeClient(create), "some-model", messages),
    ).rejects.toBe(failure);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
