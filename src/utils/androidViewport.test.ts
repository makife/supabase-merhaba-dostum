import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { toCssViewport } from "./androidViewport";

describe("Android physical window to CSS coordinates", () => {
  test("converts window and permanent insets with the same scale", () => {
    const result = toCssViewport({
      width: 1080, height: 1920, top: 66, bottom: 132, left: 0, right: 0,
    }, 360);
    assert.equal(result.height, 640);
    assert.equal(result.top, 22);
    assert.equal(result.bottom, 44);
    assert.equal(result.height - result.top - result.bottom, 574);
  });

  test("uses WebView width instead of assuming device pixel ratio", () => {
    const result = toCssViewport({
      width: 1080, height: 1920, top: 60, bottom: 120, left: 30, right: 30,
    }, 432);
    assert.equal(result.height, 768);
    assert.equal(result.bottom, 48);
    assert.equal(result.left, 12);
  });
});