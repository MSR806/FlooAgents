import { expect, test } from "bun:test";
import { parseConnectionFeedback, parseToolkitPage, toolkitSearchUrl } from "./connectors-helpers";

test("parseToolkitPage validates and unwraps toolkit results", () => {
  const page = {
    configured: true,
    items: [
      {
        slug: "github",
        name: "GitHub",
        description: "Manage repositories",
        logo: "https://example.com/github.svg",
        toolsCount: 12,
        connected: true,
        noAuth: false,
      },
    ],
    nextCursor: "next-page",
  };

  expect(parseToolkitPage(page)).toEqual(page);
  expect(() =>
    parseToolkitPage({ ...page, items: [{ ...page.items[0], toolsCount: "12" }] }),
  ).toThrow("Invalid toolkit catalog");
});

test("toolkitSearchUrl maps and encodes search and pagination", () => {
  expect(toolkitSearchUrl("/api", "google drive", "next/1")).toBe(
    "/api/composio/toolkits?query=google+drive&cursor=next%2F1",
  );
  expect(toolkitSearchUrl("/api", "")).toBe("/api/composio/toolkits");
});

test("parseConnectionFeedback maps callback parameters", () => {
  expect(parseConnectionFeedback("?connected=github&status=success")).toEqual({
    kind: "success",
    message: "Connected github.",
  });
  expect(parseConnectionFeedback("?connected=github&status=error")).toEqual({
    kind: "error",
    message: "Could not connect github (error).",
  });
  expect(parseConnectionFeedback("?connected=google_drive&status=connected")).toEqual({
    kind: "success",
    message: "Connected google_drive.",
  });
  expect(parseConnectionFeedback("?connected=%3Cscript%3E&status=success")).toBeNull();
  expect(parseConnectionFeedback(`?connected=${"a".repeat(65)}&status=success`)).toBeNull();
  expect(parseConnectionFeedback("?connected=github&status=provider+failed")).toBeNull();
  expect(parseConnectionFeedback("")).toBeNull();
});
