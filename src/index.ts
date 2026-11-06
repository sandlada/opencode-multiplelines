import { Plugin } from "@opencode/plugin";
import { MULTIPLE_LINES_PLUGIN_ID } from "./settings";

// Server part: this plugin only takes effect in the TUI; the server part is a no-op.
// Kept so `opencode plugin add` can recognize the package (the v2.2.5 install flow requires a server/GUI/TUI entrypoint)
// and so the TUI part is loaded automatically by the CLI alongside the server plugin list.
export default Plugin.define({
  id: MULTIPLE_LINES_PLUGIN_ID,
  setup() {},
});