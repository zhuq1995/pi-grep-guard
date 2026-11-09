// pi-grep-guard — 在 bash tool_call 层为 grep 自动追加 --exclude-dir。
//
// 排除目录列表来自 ~/.pi/pi-grep-guard-config.json（每次调用前读取，改动即时生效）。
// 仅改写能安全识别的 grep 命令；无法确定语义的命令保持原样。
// 不替换工具（不改写成 rg）；排除目录可能改变搜索结果。
// 禁用：环境变量 GREP_GUARD_DISABLED=1，或将配置 excludeDirs 置为空数组。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { loadExcludeDirs } from "./config.ts"
import { addExcludes, buildExcludeArgs } from "./rewrite.ts"

export default async function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, _ctx) => {
    try {
      if (event.toolName !== "bash") return
      const cmd = event.input.command
      if (typeof cmd !== "string" || !cmd.includes("grep")) return
      if (process.env.GREP_GUARD_DISABLED === "1") return

      const excludeArgs = buildExcludeArgs(loadExcludeDirs())
      if (!excludeArgs) return // 配置为空 → 停用改写

      const next = addExcludes(cmd, excludeArgs)
      if (next !== cmd) {
        console.warn(`[grep-guard] +exclude-dir: ${cmd.slice(0, 100)}`)
        event.input.command = next
      }
    } catch (err) {
      // Fail open：任何意外都不阻断命令执行。
      console.warn("[grep-guard] unexpected error; passing through", err)
    }
  })
}
