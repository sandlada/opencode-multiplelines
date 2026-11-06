import { Plugin } from "@opencode/plugin/tui";
import { InputRenderable, TextareaRenderable } from "@opentui/core";
import type { Context } from "@opencode/plugin/tui/context";
import {
  MULTIPLE_LINES_COMMAND_ID,
  MULTIPLE_LINES_PLUGIN_ID,
  MULTIPLE_LINES_PRIORITY,
  MULTIPLE_LINES_TITLE,
  NEWLINE_KEYS,
  RETURN_KEY,
  isMultilineEditorLike,
  parseMultipleLinesInput,
  resolveInitialMultipleLines,
  type MultipleLinesSettings,
} from "./settings";

type TuiContext = Context;

/**
 * 判断当前焦点是否为聊天输入框（多行 Textarea）。
 * 与 OpenCode 宿主的 managed textarea layer 判断保持一致：
 * `editor instanceof TextareaRenderable && !(editor instanceof InputRenderable)`。
 * 对话框的单行输入（InputRenderable）不属于聊天输入框，autocomplete/dialog 中的 Enter 不受本插件影响。
 */
function isPromptTextarea(context: TuiContext): boolean {
  const renderer = context.renderer as unknown as {
    isDestroyed?: boolean;
    currentFocusedEditor?: unknown;
  } | null | undefined;
  if (!renderer || renderer.isDestroyed) return false;
  const editor = renderer.currentFocusedEditor;
  if (!editor || typeof editor !== "object") return false;
  if ((editor as { isDestroyed?: boolean }).isDestroyed) return false;
  if (editor instanceof InputRenderable) return false;
  if (editor instanceof TextareaRenderable) return true;
  // 双模块实例兜底（instanceof 失效时按构造器名/能力判断）。
  return isMultilineEditorLike(editor);
}

async function setMultipleLines(
  context: TuiContext,
  updateSettings: (mutation: (draft: MultipleLinesSettings) => void) => Promise<void>,
  value: boolean,
): Promise<void> {
  await updateSettings((draft) => {
    draft.multipleLines = value;
  });
  context.ui.toast.show({
    title: MULTIPLE_LINES_TITLE,
    message: value ? "Multiple Lines: on" : "Multiple Lines: off",
    variant: "success",
    duration: 2500,
  });
}

async function openMultipleLinesSettings(
  context: TuiContext,
  settings: { multipleLines: boolean },
  updateSettings: (mutation: (draft: MultipleLinesSettings) => void) => Promise<void>,
): Promise<void> {
  const current = settings.multipleLines === true;
  const selected = await context.ui.dialog.select({
    title: MULTIPLE_LINES_TITLE,
    placeholder: "Enter inserts a newline in the chat input when on",
    options: [
      {
        title: "on",
        value: true,
        description: "Enter inserts a newline; Shift+Enter, Ctrl+Enter, Alt+Enter, Ctrl+J send",
      },
      {
        title: "off",
        value: false,
        description: "Enter sends the prompt (default OpenCode behavior)",
      },
    ],
    current,
  });
  if (selected === undefined) return;
  if (selected === current) {
    context.ui.toast.show({
      title: MULTIPLE_LINES_TITLE,
      message: selected ? "Multiple Lines: on" : "Multiple Lines: off",
      duration: 2500,
    });
    return;
  }
  await setMultipleLines(context, updateSettings, selected === true);
}

export function setupMultipleLines(context: TuiContext): void {
  const [settings, updateSettings] = context.storage.store("settings", {
    initial: { multipleLines: resolveInitialMultipleLines(context.options) } satisfies MultipleLinesSettings,
  });

  // 设置入口：Ctrl+P 命令面板 / slash 命令。
  // - 在命令面板中运行 → 打开对话框选择 on/off（标题即设置名 Multiple Lines）。
  // - /multiple-lines 同上；/multiple-lines on|off 直接设置；/multiple-lines toggle 直接翻转。
  context.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: MULTIPLE_LINES_COMMAND_ID,
        title: MULTIPLE_LINES_TITLE,
        description: "When on, Enter inserts a newline and Shift+Enter, Ctrl+Enter, Alt+Enter, Ctrl+J send",
        group: MULTIPLE_LINES_TITLE,
        palette: true,
        slash: { name: "multiple-lines", aliases: ["multiline"], arguments: true },
        run: async (input?: string) => {
          const parsed = parseMultipleLinesInput(input);
          if (parsed.type === "invalid") {
            context.ui.toast.show({
              title: MULTIPLE_LINES_TITLE,
              message: `Expected on/off, got "${parsed.raw.trim()}"`,
              variant: "error",
            });
            return;
          }
          if (parsed.type === "set") {
            await setMultipleLines(context, updateSettings, parsed.value);
            return;
          }
          if (parsed.type === "toggle") {
            await setMultipleLines(context, updateSettings, settings.multipleLines !== true);
            return;
          }
          await openMultipleLinesSettings(context, settings, updateSettings);
        },
      },
    ],
  }));

  // 键位交换层（仅 base 模式，dialog/autocomplete 等 modal 模式互斥，互不干扰）。
  // - managed textarea 宿主层优先级为 0，本层 100 更优先；关闭时 enabled=false，完全保持默认行为。
  // - 非聊天输入框焦点时返回 false，让按键继续分发给原本的处理者。
  context.keymap.layer(() => ({
    mode: "base",
    priority: MULTIPLE_LINES_PRIORITY,
    enabled: settings.multipleLines === true,
    commands: [
      {
        bind: RETURN_KEY,
        title: "Insert newline",
        group: MULTIPLE_LINES_TITLE,
        run: () => {
          if (!isPromptTextarea(context)) return false;
          context.keymap.dispatch("input.newline");
          return undefined;
        },
      },
      ...NEWLINE_KEYS.map((key) => ({
        bind: key,
        title: "Submit prompt",
        group: MULTIPLE_LINES_TITLE,
        run: () => {
          if (!isPromptTextarea(context)) return false;
          context.keymap.dispatch("input.submit");
          return undefined;
        },
      })),
    ],
  }));
}

export default Plugin.define({
  id: MULTIPLE_LINES_PLUGIN_ID,
  setup(context) {
    setupMultipleLines(context);
  },
});
