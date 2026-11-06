import { describe, expect, test } from "bun:test";
import {
  MULTIPLE_LINES_TITLE,
  NEWLINE_KEYS,
  RETURN_KEY,
  formatOnOff,
  isMultilineEditorLike,
  parseMultipleLinesInput,
  resolveInitialMultipleLines,
} from "../src/settings";

describe("Multiple Lines 设置", () => {
  test("设置标题为 Multiple Lines", () => {
    expect(MULTIPLE_LINES_TITLE).toBe("Multiple Lines");
  });

  test("on/off 展示遵循 TUI 约定", () => {
    expect(formatOnOff(true)).toBe("on");
    expect(formatOnOff(false)).toBe("off");
  });

  test("默认换行键与 OpenCode v2 一致", () => {
    expect(RETURN_KEY).toBe("return");
    expect([...NEWLINE_KEYS]).toEqual(["shift+return", "ctrl+return", "alt+return", "ctrl+j"]);
  });

  test("空输入打开对话框", () => {
    expect(parseMultipleLinesInput(undefined)).toEqual({ type: "dialog" });
    expect(parseMultipleLinesInput("")).toEqual({ type: "dialog" });
    expect(parseMultipleLinesInput("   ")).toEqual({ type: "dialog" });
  });

  test("toggle 直接翻转", () => {
    expect(parseMultipleLinesInput("toggle")).toEqual({ type: "toggle" });
    expect(parseMultipleLinesInput(" Toggle ")).toEqual({ type: "toggle" });
  });

  test("on/off 解析（大小写/空白无关）", () => {
    expect(parseMultipleLinesInput("on")).toEqual({ type: "set", value: true });
    expect(parseMultipleLinesInput("ON")).toEqual({ type: "set", value: true });
    expect(parseMultipleLinesInput(" true ")).toEqual({ type: "set", value: true });
    expect(parseMultipleLinesInput("off")).toEqual({ type: "set", value: false });
    expect(parseMultipleLinesInput(" Off ")).toEqual({ type: "set", value: false });
    expect(parseMultipleLinesInput("enabled")).toEqual({ type: "set", value: true });
    expect(parseMultipleLinesInput("disabled")).toEqual({ type: "set", value: false });
  });

  test("非法输入报 invalid", () => {
    const parsed = parseMultipleLinesInput("maybe");
    expect(parsed.type).toBe("invalid");
    if (parsed.type === "invalid") expect(parsed.raw).toBe("maybe");
  });

  test("插件 options 仅布尔值有效", () => {
    expect(resolveInitialMultipleLines(undefined)).toBe(false);
    expect(resolveInitialMultipleLines({})).toBe(false);
    expect(resolveInitialMultipleLines({ multipleLines: true })).toBe(true);
    expect(resolveInitialMultipleLines({ multipleLines: "true" })).toBe(false);
    expect(resolveInitialMultipleLines({ "multiple-lines": true })).toBe(true);
    expect(resolveInitialMultipleLines({ multiple_lines: true })).toBe(true);
  });

  test("单行输入不是聊天输入框", () => {
    class InputRenderable {}
    class TextareaRenderable {}
    const input = new InputRenderable();
    const textarea = new TextareaRenderable();
    // 构造器名模拟真实类名
    Object.defineProperty(input, "constructor", { value: { name: "InputRenderable" } });
    // 用 Object.create + 构造器名难以精确模拟时，isMultilineEditorLike 按 maxLength 区分
    (textarea as unknown as Record<string, unknown>).newLine = () => {};
    (textarea as unknown as Record<string, unknown>).submit = () => {};
    expect(isMultilineEditorLike(null)).toBe(false);
    expect(isMultilineEditorLike(undefined)).toBe(false);
    expect(isMultilineEditorLike({ isDestroyed: true, newLine: () => {}, submit: () => {} })).toBe(false);
    expect(isMultilineEditorLike(textarea)).toBe(true);
    expect(isMultilineEditorLike({ maxLength: 10, newLine: () => {}, submit: () => {} })).toBe(false);
    expect(isMultilineEditorLike({ newLine: () => {}, submit: () => {} })).toBe(true);
  });
});
