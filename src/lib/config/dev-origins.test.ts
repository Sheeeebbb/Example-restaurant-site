import { describe, expect, it, vi } from "vitest";
import { isCsrfOriginAllowed } from "next/dist/server/app-render/csrf-protection";
import { allowedDevOrigins, parseAllowedOrigins } from "./dev-origins";

/*
 * Matched with Next's own matcher rather than a re-implementation of it: the
 * patterns are only correct if the thing that reads them agrees. If this import
 * ever fails after an upgrade the matcher has moved, and these patterns are
 * worth re-checking against wherever it went rather than deleting the test.
 */
const allows = (host: string, env?: Record<string, string | undefined>) =>
  isCsrfOriginAllowed(host, allowedDevOrigins(env ?? {}));

describe("the default dev origins", () => {
  it("allows the addresses a router hands out", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "192.168.1.5",
      "192.168.178.24",
      "10.0.0.7",
      "172.16.4.9",
      "172.31.255.1",
      "100.101.102.103",
      "marta-macbook.local",
    ]) {
      expect(allows(host), host).toBe(true);
    }
  });

  it("allows nothing on the public internet", () => {
    for (const host of [
      "evil.com",
      "8.8.8.8",
      "203.0.113.9",
      // The half of 172/8 that is public. A single wildcard octet would have
      // swept these in with the private 172.16–172.31 block.
      "172.32.0.1",
      "172.15.0.1",
      "100.63.0.1",
      "100.128.0.1",
      // Not a subdomain of localhost, however much it would like to be.
      "localhost.evil.com",
    ]) {
      expect(allows(host), host).toBe(false);
    }
  });
});

describe("ALLOWED_DEV_ORIGINS", () => {
  const withEnv = (ALLOWED_DEV_ORIGINS: string) => ({ ALLOWED_DEV_ORIGINS });

  it("adds a tunnel host without disturbing the defaults", () => {
    const env = withEnv("urban-table.ngrok-free.app");
    expect(allows("urban-table.ngrok-free.app", env)).toBe(true);
    expect(allows("192.168.1.5", env)).toBe(true);
    expect(allows("evil.com", env)).toBe(false);
  });

  it("takes a list separated by commas, spaces or both", () => {
    expect(parseAllowedOrigins("a.test, b.test  c.test,,")).toEqual([
      "a.test",
      "b.test",
      "c.test",
    ]);
  });

  it("keeps only the host from a pasted URL", () => {
    expect(parseAllowedOrigins("http://staging.test:3000/menu")).toEqual([
      "staging.test",
    ]);
  });

  it("refuses a pattern that would match every host", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = withEnv("**, *.*.*.*, real.test");

    expect(parseAllowedOrigins(env.ALLOWED_DEV_ORIGINS)).toEqual(["real.test"]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(allows("evil.com", env)).toBe(false);

    warn.mockRestore();
  });

  it("is optional", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
  });
});
