// grep 命令改写核心逻辑（纯字符串处理，跨平台、无 IO）。
export const DEFAULT_EXCLUDE_DIRS = [".svn", ".git", ".vs", "node_modules"]

const SAFE_DIR_RE = /^[A-Za-z0-9._-]+$/

/** 把安全的目录名列表转成 grep 参数串；空列表禁用改写。 */
export function buildExcludeArgs(dirs: string[] = DEFAULT_EXCLUDE_DIRS): string {
  return dirs
    .filter((d) => typeof d === "string" && SAFE_DIR_RE.test(d))
    .map((d) => `--exclude-dir=${d}`)
    .join(" ")
}

type Word = { value: string; end: number; bare: boolean }
type Token = { kind: "word"; word: Word } | { kind: "separator" }

// Only accept a deliberately small shell grammar. In particular, redirections
// (including heredocs and here-strings), expansions, escapes and shell compound
// constructs are left to bash unchanged rather than approximating their syntax.
function tokenize(cmd: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  while (i < cmd.length) {
    const c = cmd[i]
    if (c === " " || c === "\t" || c === "\r") { i++; continue }
    if (c === "#") {
      while (i < cmd.length && cmd[i] !== "\n") i++
      continue
    }
    if (c === "\n" || c === ";" || c === "|" || c === "&") {
      if (c === "&" && cmd[i + 1] !== "&") return null
      if (c === ";" && (cmd[i + 1] === ";" || cmd[i + 1] === "&")) return null
      if (c === "|" && cmd[i + 1] === "&") return null
      tokens.push({ kind: "separator" })
      i += (c === "|" || c === "&") && cmd[i + 1] === c ? 2 : 1
      continue
    }
    let value = ""
    let bare = true
    while (i < cmd.length && !/[ \t\r\n;|&]/.test(cmd[i])) {
      const ch = cmd[i]
      if (ch === "'" || ch === '"') {
        bare = false
        const quote = ch
        i++
        while (i < cmd.length && cmd[i] !== quote) {
          // Double-quoted expansions and escapes require full shell evaluation.
          if (quote === '"' && /[$`\\]/.test(cmd[i])) return null
          value += cmd[i++]
        }
        if (i === cmd.length) return null
        i++
      } else {
        // These can change parsing, expand into words, or introduce shell syntax.
        if (/[<>$`\\(){}*?\[\]~]/.test(ch)) return null
        value += ch
        i++
      }
    }
    tokens.push({ kind: "word", word: { value, end: i, bare } })
  }
  return tokens
}
const GREP_LONG_VALUE_OPTIONS: Record<string, true> = {
  "--regexp": true, "--file": true, "--max-count": true, "--after-context": true,
  "--before-context": true, "--context": true, "--directories": true, "--devices": true,
  "--include": true, "--exclude": true, "--exclude-from": true, "--label": true,
  "--binary-files": true,
}
const GREP_SHORT_VALUE_OPTIONS: Record<string, true> = {
  e: true, f: true, m: true, A: true, B: true, C: true, d: true, D: true,
}

function hasExcludeOption(args: Word[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].value
    if (arg === "--") return false
    if (arg === "--exclude-dir" || arg.startsWith("--exclude-dir=")) return true
    if (arg.startsWith("--")) {
      if (!arg.includes("=") && GREP_LONG_VALUE_OPTIONS[arg]) i++
    } else if (arg.startsWith("-") && arg !== "-") {
      for (let j = 1; j < arg.length; j++) {
        if (GREP_SHORT_VALUE_OPTIONS[arg[j]]) {
          if (j === arg.length - 1) i++
          break
        }
      }
    }
  }
  return false
}
const SHELL_KEYWORDS: Record<string, true> = {
  if: true, then: true, else: true, elif: true, fi: true, for: true, while: true,
  until: true, do: true, done: true, case: true, esac: true, in: true,
  select: true, function: true, coproc: true, time: true, "!": true, "[[": true, "]]": true,
}

/** 只改写可确定为独立命令或简单 xargs/command 调用的裸 grep。 */
export function addExcludes(cmd: string, excludeArgs: string = buildExcludeArgs()): string {
  if (!excludeArgs) return cmd
  const tokens = tokenize(cmd)
  if (!tokens) return cmd
  const insertions: number[] = []
  let segment: Word[] = []
  const processSegment = (): boolean => {
    if (!segment.length) return true
    const first = segment[0]
    // Assignments, reserved words and ambiguous command names need shell parsing.
    if ((first.bare && SHELL_KEYWORDS[first.value]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(first.value)) return false
    let index = 0
    if (first.bare && first.value === "command") {
      index = 1
    } else if (first.bare && first.value === "xargs") {
      index = 1
      // Only flags without operands; options such as -I can alter command words.
      while (index < segment.length && segment[index].bare && /^-(?:0|r|t|p|x)+$/.test(segment[index].value)) index++
      if (segment[index]?.bare && segment[index].value === "--") index++
    }
    const command = segment[index]
    if (command?.bare && command.value === "grep" && !hasExcludeOption(segment.slice(index + 1))) {
      insertions.push(command.end)
    }
    return true
  }
  for (const token of tokens) {
    if (token.kind === "word") segment.push(token.word)
    else {
      if (!processSegment()) return cmd
      segment = []
    }
  }
  if (!processSegment()) return cmd
  let result = cmd
  for (let i = insertions.length - 1; i >= 0; i--) {
    const at = insertions[i]
    result = result.slice(0, at) + " " + excludeArgs + result.slice(at)
  }
  return result
}
