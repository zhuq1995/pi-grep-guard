// 配置读取：~/.pi/pi-grep-guard-config.json
//
// 每次 bash 工具调用前读取（文件很小，开销可忽略），因此修改配置即时生效，
// 无需重启 pi。文件不存在时自动写入默认配置，便于用户直接编辑。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { DEFAULT_EXCLUDE_DIRS } from "./rewrite.ts"

export const CONFIG_PATH = join(homedir(), ".pi", "pi-grep-guard-config.json")

export interface GrepGuardConfig {
  excludeDirs: string[]
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string")
}

/** 读取排除目录配置；文件缺失时写入默认值；任何异常回退默认值。 */
export function loadExcludeDirs(): string[] {
  try {
    if (!existsSync(CONFIG_PATH)) {
      mkdirSync(dirname(CONFIG_PATH), { recursive: true })
      writeFileSync(CONFIG_PATH, JSON.stringify({ excludeDirs: DEFAULT_EXCLUDE_DIRS }, null, 2) + "\n")
      return [...DEFAULT_EXCLUDE_DIRS]
    }
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<GrepGuardConfig> | null
    if (raw && isStringArray(raw.excludeDirs)) return raw.excludeDirs
    console.warn(`[grep-guard] ${CONFIG_PATH}: excludeDirs 应为字符串数组，回退默认值`)
  } catch (err) {
    console.warn("[grep-guard] 读取配置失败，回退默认值", err)
  }
  return [...DEFAULT_EXCLUDE_DIRS]
}
