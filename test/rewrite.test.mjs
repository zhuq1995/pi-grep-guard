// pi-grep-guard 逻辑单测：node --experimental-strip-types test/rewrite.test.mjs
// 断言直接 import 生产代码（src/rewrite.ts），不做逻辑复制。
import { addExcludes, buildExcludeArgs, DEFAULT_EXCLUDE_DIRS } from "../src/rewrite.ts"

let fail = 0
function check(cond, label, detail = "") {
  if (!cond) fail++
  console.log(`${cond ? "PASS" : "FAIL"} | ${label}${detail ? " -> " + detail : ""}`)
}

// ---- 改写用例：[input, expectRewritten, label] ----
const cases = [
  ['grep -rn "foo" .', true, "plain recursive grep"],
  ["cd /x && grep -rl foo source/ | head", true, "compound with pipe"],
  ["git grep foo", false, "git grep untouched"],
  ["git  grep foo", false, "git grep double-space"],
  ["git log --oneline | grep R001", true, "pipe-end grep"],
  ['echo "use grep -r here"', false, "inside double quotes"],
  ["sed 's/grep/x/' f.txt", false, "inside single quotes"],
  ['python -c \'print("grep")\'', false, "python string"],
  ["egrep -r foo .", false, "egrep untouched"],
  ["zgrep foo f.gz", false, "zgrep untouched"],
  ["ls -la", false, "no grep at all"],
  ["grep_var=1; echo $grep_var", false, "variable names"],
  ["ls\ngrep -rn foo .\ncd /x", true, "multiline"],
  ["busybox grep foo", true, "busybox (known limit: no --exclude-dir support)"],
  ["command grep -n x f", true, "command prefix"],
  ["rtk grep -rn foo .", true, "after rtk rewrite"],
  ["grep", true, "bare grep (harmless: same usage error either way)"],
  ["find . -name '*.ts' | xargs grep -l foo", true, "xargs grep"],
  ["grep --exclude-dir=.svn -rn foo .", true, "idempotence handled by caller (still appends here)"],
]
for (const [input, expect, label] of cases) {
  const got = addExcludes(input)
  const changed = got !== input
  check(changed === expect, label, changed ? got.slice(0, 110) : "")
}

// ---- 参数构造（配置化）----
check(
  buildExcludeArgs() === DEFAULT_EXCLUDE_DIRS.map((d) => `--exclude-dir=${d}`).join(" "),
  "default exclude args (derived from DEFAULT_EXCLUDE_DIRS)"
)
check(buildExcludeArgs(["a", "b"]) === "--exclude-dir=a --exclude-dir=b", "custom list")
check(buildExcludeArgs([]) === "", "empty list -> empty args")
check(
  buildExcludeArgs(["my dir", "ok", 'bad"quote', "semi;colon"]) === "--exclude-dir=ok",
  "unsafe entries filtered"
)
check(addExcludes("grep -rn x .", "") === "grep -rn x .", "empty args -> no rewrite")
check(
  addExcludes("grep -rn x .", buildExcludeArgs(["only"])) === "grep --exclude-dir=only -rn x .",
  "custom args applied"
)
check(DEFAULT_EXCLUDE_DIRS.length === 21, "defaults exported (21 dirs)")

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
