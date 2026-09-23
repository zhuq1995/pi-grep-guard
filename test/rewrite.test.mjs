// pi-grep-guard 逻辑单测：node --experimental-strip-types test/rewrite.test.mjs
// 断言直接 import 生产代码（src/rewrite.ts），不做逻辑复制。
import { addExcludes, EXCLUDE_ARGS } from "../src/rewrite.ts"

const cases = [
  // [input, expectRewritten, label]
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

let fail = 0
for (const [input, expect, label] of cases) {
  const got = addExcludes(input)
  const changed = got !== input
  const ok = changed === expect
  if (!ok) fail++
  console.log(`${ok ? "PASS" : "FAIL"} | ${label}${changed ? " -> " + got.slice(0, 110) : ""}`)
}

// 参数完整性：每个排除目录都要带上
for (const dir of [".svn", ".vs", ".git", "node_modules", "obj"]) {
  if (!EXCLUDE_ARGS.includes(`--exclude-dir=${dir}`)) {
    console.log(`FAIL | EXCLUDE_ARGS missing ${dir}`)
    fail++
  }
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
