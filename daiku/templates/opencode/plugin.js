// opencode auto-loads every immediate `.js` child of `.opencode/plugins/`, and reads its `default`
// as the plugin definition. This one line re-exports the guard adapter the deposit lays down beside
// the modules it imports, so the plugin opencode sees is the adapter itself and the wiring lives in
// one place — the adapter, whose own file declares which guards are carried and which are not.
//
// The path is relative to this file's seat after the deposit (`.opencode/plugins/daiku.js`): the
// adapter sits at `.opencode/daiku/hooks/opencode-plugin.mjs`, beside `hooks/lib/`.
export { default } from '../daiku/hooks/opencode-plugin.mjs';
