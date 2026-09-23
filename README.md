# pi-grep-guard

[pi](https://github.com/earendil-works/pi-coding-agent) 扩展：在 bash 命令执行前，自动给 `grep` 追加 `--exclude-dir`，跳过 `.svn` / `.vs` / `.git` / `node_modules` / `obj` 这些重量级目录。

## 为什么需要它

在 Windows + 老项目（`.svn` 与 `.git` 双版本控制、VS 缓存）环境下，递归 `grep` 是纯 I/O 等待，且 pi 的 bash 超时会截断结果——**不只是慢，还会静默漏结果**：

```
同一查询 "R001" @ 某项目 source/（27k 文件）：
grep -rl                             → 90s 超时，仅 4 项（结果不完整）
grep -rl + --exclude-dir 排除参数     → 1.5s，19 项（完整）
```

根因是 `.svn/pristine`（每文件历史副本）与 `.vs/FileContentIndex` 被全量遍历。本扩展让 agent（以及你自己的 `!` 命令）不必记得手写排除参数。

## 工作原理

- 监听 `bash` 工具的 `tool_call` 事件，在命令执行前原地改写；
- 只给**引号之外**的命令词位置上的 `grep` 追加参数，字符串 / `sed` 脚本里的 "grep" 不动；
- 跳过 `git grep`（它的选项集不同）；
- 非递归 `grep` 会静默忽略 `--exclude-dir`，因此无需判断 `-r`，统一追加；
- 覆盖复合命令：`cd x && grep y`、`ls | grep y`、`xargs grep y`、`rtk grep y`；
- 幂等：命令里已有 `--exclude-dir` 时不做任何事；
- 失败开放：任何意外都放行原命令，绝不阻断执行。

它**不替换** grep 为 rg（那是 [`@piotr-oles/pi-reflag`](https://pi.dev/packages/@piotr-oles/pi-reflag) 的做法，速度更快但 rg 默认跳过隐藏目录，`.notes/` 等目录会静默漏结果）——本扩展保持 grep 语义完全不变。

## 安装

```bash
# 本地路径（开发时）
pi install /absolute/path/to/pi-grep-guard

# git 源（发布到 GitHub 后）
pi install git:github.com/<you>/pi-grep-guard
```

安装后重启 pi 生效。

## 配置

- 排除目录列表在 `src/rewrite.ts` 的 `EXCLUDE_ARGS`，按需增删；
- 临时禁用：环境变量 `GREP_GUARD_DISABLED=1`；
- 改写日志会以 `[grep-guard] +exclude-dir: ...` 输出到 pi 日志，便于排查。

## 开发

```bash
npm test    # node --experimental-strip-types test/rewrite.test.mjs（19 用例）
```

结构：

- `src/rewrite.ts` — 纯字符串改写逻辑（跨平台、无 IO、可单测）
- `src/index.ts` — pi 扩展入口（tool_call 钩子）
- `test/rewrite.test.mjs` — 直接 import 生产代码的单测

## 许可证

MIT
