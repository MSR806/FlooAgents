import { describe, expect, it } from "bun:test";
import { builderChatHref, relativeTime } from "./builder";

describe("builderChatHref", () => {
  it("omits the prompt when there is nothing to send", () => {
    expect(builderChatHref()).toBe("/chat/agent-builder");
    expect(builderChatHref("   ")).toBe("/chat/agent-builder");
  });

  it("encodes the prompt so newlines and & survive the handoff", () => {
    expect(builderChatHref("a & b\nc")).toBe("/chat/agent-builder?prompt=a%20%26%20b%0Ac");
  });

  it("trims before encoding", () => {
    expect(builderChatHref("  hi  ")).toBe("/chat/agent-builder?prompt=hi");
  });
});

describe("relativeTime", () => {
  const now = 1_000_000_000_000;
  const ago = (ms: number) => relativeTime(now - ms, now);

  it("buckets by the largest unit that fits", () => {
    expect(ago(5_000)).toBe("just now");
    expect(ago(5 * 60_000)).toBe("5m ago");
    expect(ago(4 * 3_600_000)).toBe("4h ago");
    expect(ago(3 * 86_400_000)).toBe("3d ago");
    expect(ago(90 * 86_400_000)).toBe("3mo ago");
  });

  it("never renders a negative age for clock skew", () => {
    expect(relativeTime(now + 10_000, now)).toBe("just now");
  });
});
