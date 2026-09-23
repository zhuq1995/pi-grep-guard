// grep 命令改写核心逻辑（纯字符串处理，跨平台，可单测）。
//
// 为什么：Windows + .svn/.vs/node_modules 双版本控制目录下，递归 grep 是
// I/O 密集型，实测同一查询 90s 超时且结果被截断（4 项），追加排除后 1.5s
// 完整返回（19 项）。排除 .svn 等目录即消除 60× 以上的浪费。

export const EXCLUDE_ARGS =
  "--exclude-dir=.svn --exclude-dir=.vs --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=obj"

// 命令行位置上的裸 grep；跳过 `git grep`（它的选项集不同，没有 --exclude-dir）
const GREP_RE = /(?<!git\s+)\bgrep\b(?=[\s;|&)]|$)/g

function rewriteSegment(seg: string): string {
  return seg.replace(GREP_RE, (m) => `${m} ${EXCLUDE_ARGS}`)
}

/**
 * 给命令中所有（非 git 的）grep 追加 --exclude-dir 参数。
 *
 * - 引号感知：单/双引号内的 grep（字符串、sed 脚本等）不改写；
 * - 非递归 grep 会静默忽略 --exclude-dir，所以无需检测 -r，统一追加即可；
 * - `ls | grep x`、`cd x && grep y`、`xargs grep` 等复合场景均覆盖；
 * - 幂等：调用方需先检查命令是否已含 --exclude-dir（见 index.ts）。
 */
export function addExcludes(cmd: string): string {
  let out = ""
  let quote: string | null = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (quote) {
      out += c
      if (c === quote && cmd[i - 1] !== "\\") quote = null
    } else if (c === "'" || c === '"') {
      quote = c
      out += c
    } else {
      let j = i
      while (j < cmd.length && cmd[j] !== "'" && cmd[j] !== '"') j++
      out += rewriteSegment(cmd.slice(i, j))
      i = j - 1
    }
  }
  return out
}
