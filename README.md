# @sandlada/opencode-multiplelines

为 **OpenCode TUI v2** 准备的插件（只支持 v2，V1 完全无效）。
本包仅做一件事：增加一个名为 **Multiple Lines** 的布尔设置（`on`/`off` 表示开和关）。

- **关闭（`off`，默认）**：保持 OpenCode 原本行为 —— 聊天输入框中 `Enter` 发送，换行用 `Shift+Enter` / `Ctrl+Enter` / `Alt+Enter` / `Ctrl+J`。
- **开启（`on`）**：`Enter` 改为换行；原本的换行键（`Shift+Enter` / `Ctrl+Enter` / `Alt+Enter` / `Ctrl+J`）改为发送。

设置是持久化的（重启后保留，跨 TUI 实例同步），且仅影响聊天输入框：对话框、autocomplete 弹出、出队队列等模态界面中的 `Enter` 不受影响。

## 安装

本包只提供 TUI 入口（`./tui`），请加到 OpenCode 的 `cli.json` 的 `plugins`（不是 `opencode.json(c)`）：

```jsonc title="~/.config/opencode/cli.json"
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["@sandlada/opencode-multiplelines"]
}
```

本地开发时可直接指向本地目录：

```jsonc title="~/.config/opencode/cli.json"
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["./plugins/multiple-lines"]
}
```

> 只支持 OpenCode v2（`engines.opencode` 要求 `>=2.0.0`）。V1 会直接忽略本包，不会报错，也不会误改行为。

## 使用

打开 **Multiple Lines** 设置，二选一：

1. 按 `Ctrl+P`，运行命令 **Multiple Lines**，在弹出的对话框中选择 `on` / `off`；
2. 在输入框输入 slash 命令：
   - `/multiple-lines` —— 打开上述对话框；
   - `/multiple-lines on` —— 开启；
   - `/multiple-lines off` —— 关闭；
   - `/multiple-lines toggle` —— 直接翻转。

每次切换都会弹出 `Multiple Lines: on/off` 的 toast 提示。当前值保存在插件 storage（`settings`），默认 `off`。

也可以在 `cli.json` 的插件 options 里写初始值（仅首次、无存储文件时生效，之后以存储为准）：

```jsonc
{
  "plugins": [
    {
      "package": "@sandlada/opencode-multiplelines",
      "options": { "multipleLines": true }
    }
  ]
}
```

## 原理（小结）

插件注册两层 keymap：

- `global` 的命令层：提供上述设置命令；
- `base` 的交换层（`priority: 100`，高于宿主 managed textarea 层的默认 0），`enabled` 绑定设置值：
  - 开启时，`return` 分发 `input.newline`，`shift+return` / `ctrl+return` / `alt+return` / `ctrl+j` 分发 `input.submit`；
  - `run` 内会检查当前焦点是否为多行 `Textarea`（排除单行的 `Input`），非聊天输入框时返回 `false` 让按键继续分发；
  - 交换层只在 `base` 模式生效，`modal`/`autocomplete` 等模态只在对应模式生效，因此对话框的 `Enter` 不会误换行。

> 注：本插件按 OpenCode v2 的默认键位实现（`input.submit` = `return`，`input.newline` = `shift+return,ctrl+return,alt+return,ctrl+j`）。如果你在 `cli.json` 里改过这两个键位，本插件仍会拦截上述默认键，改动后的键位需要自行在插件外的 keybind 中适配。

## 开发与验证

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test            # bun test（settings 纯逻辑 + mock context 集成测试）
pnpm run pack:dry-run
```

单测覆盖：设置标题、on/off 解析、slash 入参、options 初始值、焦点的多行/单行区分、开启/关闭的交换层行为与回退。

## 目录

```text
package.json     # npm 插件清单（exports "./tui"，仅 v2）
src/tui.ts       # 插件入口（Plugin.define）
src/settings.ts  # 纯逻辑（标题、键名、解析、兜底判断）
test/*.test.ts   # Bun 测试
```
