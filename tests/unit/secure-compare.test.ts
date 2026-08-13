import { describe, expect, it } from "vitest";
import { secureCompare, sha256Hex } from "@/lib/utils/secure-compare";

describe("secureCompare", () => {
  it("matches equal strings", () => {
    expect(secureCompare("secret-value", "secret-value")).toBe(true);
    expect(secureCompare("", "")).toBe(true);
  });

  it("rejects different strings, including different lengths", () => {
    expect(secureCompare("secret-value", "secret-valuE")).toBe(false);
    expect(secureCompare("short", "a-much-longer-string")).toBe(false);
  });

  it("rejects missing inputs without throwing", () => {
    expect(secureCompare(null, "secret")).toBe(false);
    expect(secureCompare(undefined, "secret")).toBe(false);
    expect(secureCompare("secret", null)).toBe(false);
    expect(secureCompare(null, null)).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("produces the known digest for a fixed input", () => {
    // echo -n "abc" | sha256sum
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("never equals the raw input", () => {
    expect(sha256Hex("admin-secret")).not.toBe("admin-secret");
  });
});
