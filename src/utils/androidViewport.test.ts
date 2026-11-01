import { describe, expect, test } from "bun:test";
import { toCssViewport } from "./androidViewport";

describe("Android physical window to CSS coordinates", () => {
  test("converts window and permanent insets with the same scale", () => {
    const result = toCssViewport({
      width: 1080, height: 1920, top: 66, bottom: 132, left: 0, right: 0,
    }, 360);
    expect(result.height).toBe(640);
    expect(result.top).toBe(22);
    expect(result.bottom).toBe(44);
    expect(result.height - result.top - result.bottom).toBe(574);
  });

  test("uses WebView width instead of assuming device pixel ratio", () => {
    const result = toCssViewport({
      width: 1080, height: 1920, top: 60, bottom: 120, left: 30, right: 30,
    }, 432);
    expect(result.height).toBe(768);
    expect(result.bottom).toBe(48);
    expect(result.left).toBe(12);
  });
});