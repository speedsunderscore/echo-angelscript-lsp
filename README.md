# Echo AngelScript LSP

A Visual Studio Code extension that brings full IDE support to AngelScript projects targeting the [Echo](https://echo-23.gitbook.io/angel) API.

The entire Echo API is bundled. Every feature works out-of-the-box the moment you open a `.as` file.

## Features

| Feature | What you'll see |
|---|---|
| **Syntax highlighting** | Keywords, types, primitives, strings, numbers, comments all colored. |
| **Semantic highlighting** | Namespaces, classes, enums, methods, parameters etc. each get their own theme color, even for symbols defined in your own code. |
| **Autocompletion** | Type `.` after a variable to list its members; type `::` after a namespace or enum to list its contents; `Ctrl+Space` anywhere lists every in-scope name. |
| **Hover docs** | Mouse over any symbol to see its signature plus its doc-comment text. |
| **Signature help** | Inside a function call, a panel shows the parameter list with the current arg highlighted. Steps through overloads as you type. |
| **Go to definition** | `F12` or `Ctrl+click` any symbol. Works cross-file across the entire workspace, and for Echo API calls jumps into the bundled declaration files. |
| **Find references** | `Shift+F12` lists every use of the symbol under the cursor in the current file. |
| **Same-symbol highlight** | Click a symbol; every other occurrence in the file gets outlined. |
| **Document outline** | `Ctrl+Shift+O` shows the file's classes, methods, namespaces, etc. in a navigable tree. |
| **Real-time errors** | Lex and parse errors appear as red squiggles as you type, with the same panic-mode recovery used by the parser so one bad line doesn't break the rest of the file. |
| **Cross-file analysis** | Every `.as` file in the workspace is auto-discovered. A symbol declared in one file is resolvable from any other. |
| **Bundler** | Built-in command bundles your project into a single `.as` file, following `#include` directives. |

## Bundled Echo API

Every category from the Echo docs site is included as a parsed declaration set (~1900 symbols total):

- **Memory** - `process::`, `zydis::`, `uc::` (Unicorn), SIMD/bit ops
- **Drawing** - `render::`, `fonts::`, `ui::` (menu / elements / callbacks)
- **Utilities** - `util::`, `hash::`, `alert::`, `console::`, `print`, `file::`, `dir::`, `input::`, `json::` (+ `json_obj`)
- **Containers** - `hash_set_*`, `hash_map`
- **Networking** - `http::`, `ws::`
- **Threading** - `create_thread`, `on_render`, `mutex`, `atomic_*`
- **Math** - `vec2`/`vec3`/`vec4`, `matrix*x*`, `bvh_tree`, `trace::`, `math::` (constants + angle/vector helpers)
- **Engines** - `source::`, `source2::`, `unreal::`, `iw_engine::`

API symbols ship with their Echo doc text, so hover gives you the same explanation you'd find on the docs site.

## Installation

**From VSCode (UI):**

1. Open the Extensions panel (`Ctrl+Shift+X`).
2. Click the `...` menu in the top-right of the panel.
3. Choose **Install from VSIX...** and pick `echo-angelscript-lsp-0.0.1.vsix`.
4. Reload the window when prompted, or run `Developer: Reload Window` from the command palette (`Ctrl+Shift+P`).

**From the command line:**

```
code --install-extension echo-angelscript-lsp-0.0.1.vsix --force
```

Then open your project folder. The extension activates the moment you open any `.as` file.

## Bundler

The bundler walks a source directory for `.as` files, resolves `#include "..."` directives in dependency order, and writes a single concatenated output file.

Three ways to run it:

- Press `Ctrl+Shift+B` while editing any `.as` file.
- Run `Echo AngelScript: Bundle Project` from the command palette (`Ctrl+Shift+P`).
- Bind your own key to the `echoAngelscript.bundle` command.

Three ways to configure it:

- **Wizard** - run `Echo AngelScript: Configure Bundler...` from the command palette. Native folder + file pickers, results saved to the workspace's `.vscode/settings.json` automatically. The first time you run the bundle command without settings, it'll prompt you to launch the wizard.
- **Settings UI** - `Ctrl+,`, search "echoAngelscript.bundler", switch between User / Workspace tabs at the top to choose scope.
- **Edit JSON directly**:

  ```jsonc
  // <project>/.vscode/settings.json
  {
    "echoAngelscript.bundler.source": "source",       // relative to workspace, or absolute
    "echoAngelscript.bundler.output": "bundled.as",   // relative to workspace, or absolute
    "echoAngelscript.bundler.strip":  false           // strip comment-only lines
  }
  ```

Settings have `resource` scope, so per-project settings in `.vscode/settings.json` override your user defaults.

## Settings

| Setting | Default | Description |
|---|---|---|
| `echoAngelscript.maxNumberOfProblems` | 1000 | Cap on diagnostics reported per file. |
| `echoAngelscript.trace.server` | `off` | LSP protocol trace (`off`, `messages`, `verbose`). |
| `echoAngelscript.bundler.source` | `source` | Bundler source directory. |
| `echoAngelscript.bundler.output` | `bundled.as` | Bundler output path. |
| `echoAngelscript.bundler.strip` | `false` | Strip comment-only lines when bundling. |

## File layout

```
.as     AngelScript source files - parsed automatically when present in any workspace folder.
```

Doc comments on your own declarations use the JSDoc-style block form and show up in hover:

```angelscript
/** The hero's current HP. Clamped to [0, maxHealth]. */
int health;
```
