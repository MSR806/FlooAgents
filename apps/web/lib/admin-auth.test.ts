import { expect, test } from "bun:test";
import { isAdminAuthorization, isAdminPath } from "./admin-auth.ts";

const basic = (username: string, password: string) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

test("admin authorization requires the configured password and admin username", () => {
  expect(isAdminAuthorization(basic("admin", "secret"), "secret")).toBe(true);
  expect(isAdminAuthorization(basic("admin", "wrong"), "secret")).toBe(false);
  expect(isAdminAuthorization(basic("user", "secret"), "secret")).toBe(false);
  expect(isAdminAuthorization(null, "secret")).toBe(false);
});

test("admin paths cover gateway tool setup and its management catalog", () => {
  expect(isAdminPath("/connectors")).toBe(true);
  expect(isAdminPath("/api/composio/toolkits/gmail/connect")).toBe(true);
  expect(isAdminPath("/api/connectors/composio/credentials")).toBe(true);
  expect(isAdminPath("/api/tools")).toBe(true);
  expect(isAdminPath("/api/connectors")).toBe(false);
  expect(isAdminPath("/api/agents")).toBe(false);
  expect(isAdminPath("/api/grants")).toBe(false);
});
