import { describe, expect, test } from "bun:test";
import { InputRenderable, TextareaRenderable } from "@opentui/core";
import { setupMultipleLines } from "../src/tui";

// 最小的 Context 替身：仅实现插件用到的 storage/keymap/ui/renderer/options 四部分。
function createMockContext(initial: boolean, focusedEditor: unknown) {
  const layers: Array<{ factory: () => unknown }> = [];
  const dispatches: string[] = [];
  const toasts: Array<{ message: string }> = [];
  let storeValue = { multipleLines: initial };
  let selectResult: boolean | undefined = undefined;
  let lastSelectOptions: unknown = undefined;

  const updateSettings = async (mutation: (draft: { multipleLines: boolean }) => void) => {
    const draft = { ...storeValue };
    mutation(draft);
    storeValue = draft;
  };

  const context = {
    options: {},
    renderer: { currentFocusedEditor: focusedEditor, isDestroyed: false },
    storage: {
      store: (_key: string, _options: { initial: { multipleLines: boolean } }) => [storeValue, updateSettings] as const,
      memory: () => {
        throw new Error("not used");
      },
    },
    keymap: {
      layer: (factory: () => unknown) => {
        layers.push({ factory });
      },
      dispatch: (id: string) => {
        dispatches.push(id);
      },
      shortcuts: () => [] as string[],
      commands: () => [] as never[],
      pending: () => [] as never[],
      active: () => [] as never[],
      mode: { current: () => "base", push: () => () => {} },
    },
    ui: {
      dialog: {
        show: () => {},
        set: () => {},
        clear: () => {},
        alert: async () => {},
        confirm: async () => undefined,
        prompt: async () => undefined,
        select: async (options: unknown) => {
          lastSelectOptions = options;
          return selectResult;
        },
      },
      toast: {
        show: (options: { message: string }) => {
          toasts.push(options);
        },
      },
      format: { path: (value: string) => value },
      router: {
        register: () => () => {},
        navigate: () => {},
        current: () => ({ type: "home" }) as never,
      },
      panel: { open: () => false, close: () => {}, current: () => undefined },
      tabs: {
        enabled: () => false,
        list: () => [],
        open: () => false,
        focus: () => false,
        move: () => false,
        close: () => false,
      },
      model: { current: () => undefined, variant: { list: () => [], set: () => false } },
      slot: () => () => {},
    },
  } as never;

  return {
    layers,
    dispatches,
    toasts,
    context,
    getStore: () => storeValue,
    setSelectResult: (value: boolean | undefined) => {
      selectResult = value;
    },
    getLastSelectOptions: () => lastSelectOptions,
  };
}

function createTextareaFake(): unknown {
  // 不调用构造器，只借原型链以通过 instanceof 判断（与真实宿主类同一模块实例）。
  // isDestroyed 为原型 getter（未构造时为 falsy），不赋值即可。
  return Object.create(TextareaRenderable.prototype) as object;
}

function createInputFake(): unknown {
  return Object.create(InputRenderable.prototype) as object;
}

describe("TUI 插件 setup", () => {
  test("默认关闭时交换层禁用，两个 layer 分别为设置入口与交换层", () => {
    const mock = createMockContext(false, createTextareaFake());
    setupMultipleLines(mock.context);
    expect(mock.layers.length).toBe(2);
    const [settingsLayer, swapLayer] = mock.layers.map((l) => l.factory() as {
      mode?: string;
      priority?: number;
      enabled?: unknown;
      commands: Array<{ id?: string; bind?: string; run: (input?: string) => unknown }>;
    });
    expect(settingsLayer.mode).toBe("global");
    expect(settingsLayer.commands[0]?.id).toBe("multiple-lines.toggle");
    expect(swapLayer.mode).toBe("base");
    expect(swapLayer.priority).toBe(100);
    expect(swapLayer.enabled).toBe(false);
    expect(swapLayer.commands.map((c) => c.bind)).toEqual([
      "return",
      "shift+return",
      "ctrl+return",
      "alt+return",
      "ctrl+j",
    ]);
  });

  test("开启时 return 分发换行、原换行键分发发送", () => {
    const mock = createMockContext(true, createTextareaFake());
    setupMultipleLines(mock.context);
    const swapLayer = mock.layers[1]?.factory() as unknown as {
      enabled: unknown;
      commands: Array<{ run: () => unknown }>;
    };
    expect(swapLayer.enabled).toBe(true);

    const [newline, ...submitCommands] = swapLayer.commands;
    expect(newline?.run()).not.toBe(false);
    expect(mock.dispatches).toEqual(["input.newline"]);

    mock.dispatches.length = 0;
    for (const command of submitCommands) {
      expect(command.run()).not.toBe(false);
    }
    expect(mock.dispatches).toEqual(["input.submit", "input.submit", "input.submit", "input.submit"]);
  });

  test("单行输入/无焦点时返回 false 回退，不拦截", () => {
    const inputMock = createMockContext(true, createInputFake());
    setupMultipleLines(inputMock.context);
    const inputLayer = inputMock.layers[1]?.factory() as unknown as {
      commands: Array<{ run: () => unknown }>;
    };
    expect(inputLayer.commands[0]?.run()).toBe(false);
    expect(inputMock.dispatches).toEqual([]);

    const emptyMock = createMockContext(true, null);
    setupMultipleLines(emptyMock.context);
    const emptyLayer = emptyMock.layers[1]?.factory() as unknown as {
      commands: Array<{ run: () => unknown }>;
    };
    expect(emptyLayer.commands[0]?.run()).toBe(false);
    expect(emptyMock.dispatches).toEqual([]);
  });

  test("toggle 命令：slash on/off 直接设置并 toast", async () => {
    const mock = createMockContext(false, createTextareaFake());
    setupMultipleLines(mock.context);
    const settingsLayer = mock.layers[0]?.factory() as unknown as {
      commands: Array<{ run: (input?: string) => Promise<void> }>;
    };
    await settingsLayer.commands[0]?.run("on");
    expect(mock.getStore().multipleLines).toBe(true);
    expect(mock.toasts.at(-1)?.message).toBe("Multiple Lines: on");
    await settingsLayer.commands[0]?.run("off");
    expect(mock.getStore().multipleLines).toBe(false);
    expect(mock.toasts.at(-1)?.message).toBe("Multiple Lines: off");
  });

  test("toggle 命令：无参数打开对话框并按选择设置", async () => {
    const mock = createMockContext(false, createTextareaFake());
    mock.setSelectResult(true);
    setupMultipleLines(mock.context);
    const settingsLayer = mock.layers[0]?.factory() as unknown as {
      commands: Array<{ run: (input?: string) => Promise<void> }>;
    };
    await settingsLayer.commands[0]?.run(undefined);
    expect(mock.getStore().multipleLines).toBe(true);
    const options = mock.getLastSelectOptions() as { title: string; options: Array<{ title: string; value: boolean }> };
    expect(options.title).toBe("Multiple Lines");
    expect(options.options.map((o) => o.title)).toEqual(["on", "off"]);
    expect(options.options.map((o) => o.value)).toEqual([true, false]);
  });

  test("toggle 命令：toggle 翻转，非法输入报错不改值", async () => {
    const mock = createMockContext(true, createTextareaFake());
    setupMultipleLines(mock.context);
    const settingsLayer = mock.layers[0]?.factory() as unknown as {
      commands: Array<{ run: (input?: string) => Promise<void> }>;
    };
    await settingsLayer.commands[0]?.run("toggle");
    expect(mock.getStore().multipleLines).toBe(false);
    await settingsLayer.commands[0]?.run("maybe");
    expect(mock.getStore().multipleLines).toBe(false);
    expect(mock.toasts.at(-1)?.message).toContain('Expected on/off');
  });
});
