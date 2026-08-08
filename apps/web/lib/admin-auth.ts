import { createHash, timingSafeEqual } from "node:crypto";

function equalSecret(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function isAdminAuthorization(value: string | null, password: string): boolean {
  if (!value || !password) return false;
  const [scheme, encoded, extra] = value.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded || extra) return false;
  let credentials: string;
  try {
    credentials = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }
  const separator = credentials.indexOf(":");
  return (
    separator >= 0 &&
    credentials.slice(0, separator) === "admin" &&
    equalSecret(credentials.slice(separator + 1), password)
  );
}

export function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/connectors" ||
    pathname.startsWith("/connectors/") ||
    pathname === "/api/composio/toolkits" ||
    pathname.startsWith("/api/composio/toolkits/") ||
    (pathname.startsWith("/api/connectors/") &&
      (pathname.endsWith("/credentials") || pathname.endsWith("/connect")))
  );
}
