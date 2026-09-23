// pi-grep-guard — 在 bash tool_call 层为 grep 自动追加 --exclude-dir。
//
// 排除目录列表来自 ~/.pi/pi-grep-guard-config.json（每次调用前读取，改动即时生效）。
// 改写只发生在命令引号之外的 grep 词元上，语义与手写排除参数完全一致；
// 不替换工具（不改写成 rg），因此没有隐藏目录漏结果之类的行为差异。
// 与 rtk 之类的命令改写扩展任意顺序共存：`rtk grep ...` 同样会被追加参数。
// 禁用：环境变量 GREP_GUARD_DISABLED=1，或将配置 excludeDirs 置为空数组。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { isToolCallEventType } from "@earendil-works/pi-coding-agent"
import { loadExcludeDirs } from "./config.ts"
import { addExcludes, buildExcludeArgs } from "./rewrite.ts"

export default async function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, _ctx) => {
    try {
      if (!isToolCallEventType("bash", event)) return
      const cmd = event.input.command
      if (typeof cmd !== "string" || !cmd.includes("grep")) return
      if (cmd.includes("--exclude-dir")) return // 已有排除（用户手写或其它扩展），保持幂等
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
