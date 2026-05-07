import { expect, test } from "bun:test";
import { VERSION } from "@sixfive/core/version";

test("VERSION is a non-empty string", () => {
  expect(typeof VERSION).toBe("string");
  expect(VERSION.length).toBeGreaterThan(0);
});
