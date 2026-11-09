# pi-grep-guard

[pi](https://github.com/earendil-works/pi-coding-agent) 扩展：在 bash 工具执行命令前，自动给可安全识别的 `grep` 追加 `--exclude-dir`，默认跳过 `.svn`、`.git`、`.vs` 和 `node_modules`。

## 用途

递归搜索时，版本控制目录、IDE 缓存和依赖目录会增加搜索范围。插件为可安全识别的 `grep` 命令添加排除参数，具体目录由配置文件决定。

## 工作原理

- 监听 Pi 的 `bash` 工具的 `tool_call` 事件，在命令执行前改写；不覆盖用户的 `!` / `!!` 命令、`powershell` 工具或 `ffgrep`；
- 只给能确定是 `grep` 的命令追加参数，不修改其他命令的参数、引号中的文本或注释，跳过 `git grep`；
- 支持一般 grep、管道、`&&` 和 `xargs grep` 等用法；当命令包含重定向、变量展开或 heredoc（多行文本输入）等无法安全识别的语法时，整条命令保持原样；
- 幂等按单个 grep 判断：已有 `--exclude-dir` 的 grep 不追加，但不影响后续独立 grep；
- 失败开放：任何意外都放行原命令，不阻断执行。

本扩展不将 grep 替换为 rg。追加的排除参数会让递归搜索跳过对应目录，因此这些目录内的匹配不会出现在结果中；如需搜索它们，请调整配置或临时禁用扩展。非递归搜索通常不受目录排除影响。

## 安装

```bash
pi install git:github.com/zhuq1995/pi-grep-guard

# 本地路径安装
# Windows
pi install C:/path/to/pi-grep-guard

# macOS / Linux
pi install /absolute/path/to/pi-grep-guard
```

Pi 配置中只保留一个 `pi-grep-guard` 来源，避免重复加载。

安装后重启 pi 生效。

## 配置

配置文件 `~/.pi/pi-grep-guard-config.json`（首次运行时自动创建）:

```json
{
  "excludeDirs": [
    ".svn", ".git", ".vs", "node_modules"
  ]
}
```

- 修改后**即时生效**（每次命令执行前读取），无需重启 pi；
- 置为空数组 `[]` 即停用改写；
- 目录名仅允许 `A-Za-z0-9._-`；含空格/引号等的条目会被忽略（避免拼进 shell 命令出问题）；
- 临时禁用：环境变量 `GREP_GUARD_DISABLED=1`；
- 改写日志会以 `[grep-guard] +exclude-dir: ...` 输出到 pi 日志，便于排查。

## 开发

```bash
npm test    # 运行改写逻辑和入口钩子测试
```

结构：

- `src/rewrite.ts` — 纯字符串改写逻辑（跨平台、无 IO、可单测）
- `src/config.ts` — 读取 `~/.pi/pi-grep-guard-config.json`（缺失时自动创建）
- `src/index.ts` — pi 扩展入口（tool_call 钩子）
- `test/rewrite.test.mjs` — 直接 import 生产代码的单测
- `test/hook.test.mjs` — 使用隔离临时 home 测试入口钩子与配置

## 许可证

MIT
