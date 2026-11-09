// Consumer-visible rewrite behavior using the production implementation.
import assert from "node:assert/strict"
import { addExcludes, buildExcludeArgs, DEFAULT_EXCLUDE_DIRS } from "../src/rewrite.ts"

const args = buildExcludeArgs(["only"])
const cases = [
  ['grep -rn "foo" .', 'grep --exclude-dir=only -rn "foo" .'],
  ["grep", "grep --exclude-dir=only"],
  ["ls | grep foo", "ls | grep --exclude-dir=only foo"],
  ["cd /x && grep foo | grep bar", "cd /x && grep --exclude-dir=only foo | grep --exclude-dir=only bar"],
  ["find . -name '*.ts' | xargs grep -l foo", "find . -name '*.ts' | xargs grep --exclude-dir=only -l foo"],
  ["xargs -0 grep foo", "xargs -0 grep --exclude-dir=only foo"],
  ["command grep -n x f", "command grep --exclude-dir=only -n x f"],
  ["grep --exclude-dir=.git foo; grep bar", "grep --exclude-dir=.git foo; grep --exclude-dir=only bar"],
  ["grep foo; grep --exclude-dir .git bar", "grep --exclude-dir=only foo; grep --exclude-dir .git bar"],
  ["grep -e '--exclude-dir' file; grep bar", "grep --exclude-dir=only -e '--exclude-dir' file; grep --exclude-dir=only bar"],
  ["grep -- '--exclude-dir' file", "grep --exclude-dir=only -- '--exclude-dir' file"],
  ["grep --regexp='--exclude-dir=x' file", "grep --exclude-dir=only --regexp='--exclude-dir=x' file"],
  ["grep '--exclude-dir=.git' foo", "grep '--exclude-dir=.git' foo"],
  ["grep foo # grep bar\ngrep baz", "grep --exclude-dir=only foo # grep bar\ngrep --exclude-dir=only baz"],
  ["grep 'a|b; grep' file", "grep --exclude-dir=only 'a|b; grep' file"],
  ["git -C /repo grep foo", "git -C /repo grep foo"],
  ["git -c a=b grep foo", "git -c a=b grep foo"],
  ["git --no-pager grep foo | grep bar", "git --no-pager grep foo | grep --exclude-dir=only bar"],
  ["echo grep foo", "echo grep foo"],
  ["printf '%s' grep", "printf '%s' grep"],
  ["cat grep", "cat grep"],
  ["find . -name grep", "find . -name grep"],
  ["busybox grep foo", "busybox grep foo"],
  ["rtk grep foo", "rtk grep foo"],
  ["grep foo; for x in a; do grep bar; done", "grep foo; for x in a; do grep bar; done"],
  ["case x in x) grep foo;; esac", "case x in x) grep foo;; esac"],
  ["function f { grep foo; }", "function f { grep foo; }"],
  ["VAR=value grep foo", "VAR=value grep foo"],
  ['grep "$(echo foo)"', 'grep "$(echo foo)"'],
  ["grep foo \\\nbar", "grep foo \\\nbar"],
  ["grep foo *.txt", "grep foo *.txt"],
  ["cat <<EOF\ngrep foo\nEOF\ngrep bar", "cat <<EOF\ngrep foo\nEOF\ngrep bar"],
  ["grep foo <<<'grep bar'", "grep foo <<<'grep bar'"],
  ["grep foo; cat <<'EOF'\ngrep bar\nEOF", "grep foo; cat <<'EOF'\ngrep bar\nEOF"],
  ["grep foo $(echo bar)", "grep foo $(echo bar)"],
  ["grep foo > output", "grep foo > output"],
  ["if true; then grep foo; fi", "if true; then grep foo; fi"],
  ["grep foo && (grep bar)", "grep foo && (grep bar)"],
  ["echo 'unterminated; grep foo", "echo 'unterminated; grep foo"],
]
for (const [input, expected] of cases) {
  assert.equal(addExcludes(input, args), expected, input)
  assert.equal(addExcludes(expected, args), expected, `idempotence: ${input}`)
}
assert.deepEqual(DEFAULT_EXCLUDE_DIRS, [".svn", ".git", ".vs", "node_modules"])
assert.equal(buildExcludeArgs(), "--exclude-dir=.svn --exclude-dir=.git --exclude-dir=.vs --exclude-dir=node_modules")
assert.equal(buildExcludeArgs(["a", "b"]), "--exclude-dir=a --exclude-dir=b")
assert.equal(buildExcludeArgs([]), "")
assert.equal(buildExcludeArgs(["my dir", "ok", 'bad"quote', "semi;colon"]), "--exclude-dir=ok")
assert.equal(addExcludes("grep x", ""), "grep x")
console.log("All rewrite tests passed")
