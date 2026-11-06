// 纯逻辑：不依赖 OpenCode 运行时，便于单测。
// 插件仅支持 OpenCode TUI v2。

export type MultipleLinesSettings = {
  /** true 表示 Multiple Lines 开启（Enter 换行），false 表示关闭（Enter 发送，默认行为）。 */
  multipleLines: boolean;
};

export const MULTIPLE_LINES_TITLE = "Multiple Lines";
export const MULTIPLE_LINES_COMMAND_ID = "multiple-lines.toggle";
export const MULTIPLE_LINES_PLUGIN_ID = "multiple-lines";
export const MULTIPLE_LINES_PRIORITY = 100;

/** 默认 Enter 键（OpenCode 默认 input.submit）。開啟时用于换行。 */
export const RETURN_KEY = "return" as const;

/**
 * OpenCode 原本的换行键（input.newline 默认值）。
 * 开启 Multiple Lines 后，这些键改为发送。
 * 与 https://opencode.ai/v2/docs/cli/keybinds 中 input.newline 默认值保持一致。
 */
export const NEWLINE_KEYS = ["shift+return", "ctrl+return", "alt+return", "ctrl+j"] as const;

export function formatOnOff(value: boolean): "on" | "off" {
  return value ? "on" : "off";
}

export type ParsedMultipleLinesInput =
  | { type: "dialog" }
  | { type: "toggle" }
  | { type: "set"; value: boolean }
  | { type: "invalid"; raw: string };

/**
 * 解析 slash 命令的入参（/multiple-lines ...）。
 * - 空字符串/未提供 → 打开设置对话框（dialog）
 * - "toggle" → 直接翻转
 * - "on"/"true"/"1"/"enable"/"enabled" → 开启
 * - "off"/"false"/"0"/"disable"/"disabled" → 关闭
 * - 其他 → invalid
 */
export function parseMultipleLinesInput(input: string | undefined): ParsedMultipleLinesInput {
  const rawText = input ?? "";
  const normalized = rawText.trim().toLowerCase();
  if (normalized === "") return { type: "dialog" };
  if (normalized === "toggle") return { type: "toggle" };
  if (
    normalized === "on" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "enable" ||
    normalized === "enabled"
  ) {
    return { type: "set", value: true };
  }
  if (
    normalized === "off" ||
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "disable" ||
    normalized === "disabled"
  ) {
    return { type: "set", value: false };
  }
  return { type: "invalid", raw: rawText };
}

/**
 * 从 cli.json 的插件 options 读取初始值（仅首次，无存储文件时生效）。
 * 支持 multipleLines / "multiple-lines" / multiple_lines 三种写法，布尔值才有效。
 */
export function resolveInitialMultipleLines(options: Record<string, unknown> | undefined): boolean {
  if (!options) return false;
  const value = options.multipleLines ?? options["multiple-lines"] ?? options.multiple_lines;
  return value === true;
}

/**
 * 兜底判断：目标是否为多行编辑器（聊天输入框）。
 * 运行时正常路径使用 instanceof（见 tui.ts），本函数用于双模块实例等极端情况。
 * 约定：InputRenderable（单行对话框输入）不是聊天输入框，返回 false；
 * TextareaRenderable 返回 true；已销毁的编辑器返回 false；
 * 其它对象仅在具备 newLine/submit 且不具备单行特有字段时返回 true。
 */
export function isMultilineEditorLike(editor: unknown): boolean {
  if (!editor || typeof editor !== "object") return false;
  const record = editor as Record<string, unknown> & { isDestroyed?: boolean };
  if (record.isDestroyed === true) return false;
  const ctorName = (editor as { constructor?: { name?: string } }).constructor?.name;
  if (ctorName === "InputRenderable") return false;
  if (ctorName === "TextareaRenderable") return true;
  if ("maxLength" in record || "minLength" in record) return false;
  return typeof record.newLine === "function" && typeof record.submit === "function";
}
