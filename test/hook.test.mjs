// Exercise the registered tool_call hook against an isolated, disposable home.
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"

const home = mkdtempSync(join(tmpdir(), "pi-grep-guard-test-"))
const previousHome = process.env.HOME
const previousProfile = process.env.USERPROFILE
const previousDisabled = process.env.GREP_GUARD_DISABLED
process.env.HOME = home
process.env.USERPROFILE = home
delete process.env.GREP_GUARD_DISABLED

try {
  // Refuse to import the configuration module unless its home is isolated.
  assert.equal(homedir(), home)
  const { default: register } = await import("../src/index.ts")
  const { CONFIG_PATH } = await import("../src/config.ts")
  assert.equal(CONFIG_PATH, join(home, ".pi", "pi-grep-guard-config.json"))

  const hooks = new Map()
  await register({ on(name, handler) { hooks.set(name, handler) } })
  const hook = hooks.get("tool_call")

  async function dispatch(toolName, command) {
    const event = { toolName, input: { command } }
    await hook(event, {})
    return event.input.command
  }
  const defaults = [".svn", ".git", ".vs", "node_modules"]
  const defaultArgs = defaults.map(dir => `--exclude-dir=${dir}`).join(" ")
  assert.equal(await dispatch("bash", "grep needle ."), `grep ${defaultArgs} needle .`)
  assert.deepEqual(JSON.parse(readFileSync(CONFIG_PATH, "utf8")), { excludeDirs: defaults })
  assert.equal(await dispatch("read", "grep needle ."), "grep needle .")
  assert.equal(await dispatch("powershell", "grep needle ."), "grep needle .")
  assert.equal(await dispatch("bash", "echo grep"), "echo grep")
  assert.equal(await dispatch("bash", "git grep needle"), "git grep needle")

  process.env.GREP_GUARD_DISABLED = "1"
  assert.equal(await dispatch("bash", "grep needle ."), "grep needle .")
  delete process.env.GREP_GUARD_DISABLED

  const configure = dirs => writeFileSync(CONFIG_PATH, JSON.stringify({ excludeDirs: dirs }))
  configure([])
  assert.equal(await dispatch("bash", "grep needle ."), "grep needle .")
  configure(["custom", "invalid dir"])
  assert.equal(await dispatch("bash", "grep needle ."), "grep --exclude-dir=custom needle .")
  const compound = "grep --exclude-dir=existing first . && grep second ."
  assert.equal(await dispatch("bash", compound), "grep --exclude-dir=existing first . && grep --exclude-dir=custom second .")
  assert.equal(await dispatch("bash", "grep --exclude-dir=existing first ."), "grep --exclude-dir=existing first .")
  assert.equal(await dispatch("bash", "grep needle . | grep other"), "grep --exclude-dir=custom needle . | grep --exclude-dir=custom other")
  configure(["other"])
  assert.equal(await dispatch("bash", "grep needle ."), "grep --exclude-dir=other needle .")

  // Malformed configuration falls back to defaults without blocking the command.
  writeFileSync(CONFIG_PATH, "{")
  assert.equal(await dispatch("bash", "grep needle ."), `grep ${defaultArgs} needle .`)
  const brokenEvent = { toolName: "bash", get input() { throw new Error("test failure") } }
  await assert.doesNotReject(hook(brokenEvent, {}))
  console.log("Hook tests passed")
} finally {
  if (previousHome === undefined) delete process.env.HOME
  else process.env.HOME = previousHome
  if (previousProfile === undefined) delete process.env.USERPROFILE
  else process.env.USERPROFILE = previousProfile
  if (previousDisabled === undefined) delete process.env.GREP_GUARD_DISABLED
  else process.env.GREP_GUARD_DISABLED = previousDisabled
  rmSync(home, { recursive: true, force: true })
}
