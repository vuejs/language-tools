# Vue (Official)

<!-- https://github.com/badges/shields/pull/11792
<p>
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/v/Vue.volar?labelColor=18181B&color=1584FC" alt="Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Vue.volar"><img src="https://img.shields.io/visual-studio-marketplace/i/Vue.volar?labelColor=18181B&color=1584FC" alt="Downloads"></a>
</p>
-->

Vue language support extension for VSCode, providing a full development experience for Vue Single File Components (SFCs).

## Features

- **Syntax Highlighting** - Supports HTML, CSS, JavaScript, TypeScript, Pug, SCSS, Less, etc. in Vue SFCs
- **Intelligent Completion** - Auto-completion for components, props, events, slots, and directives
- **Type Checking** - Full TypeScript type inference, including expressions in templates
- **Error Diagnostics** - Real-time display of Vue compiler errors
- **Code Navigation** - Go to definition, find references
- **Refactoring** - Rename, extract component
- **Formatting** - Format SFCs by block

## Installation

Search for `Vue (Official)` or `Vue.volar` in the VSCode extension marketplace and click install.

The version 4 alphas are not on the Marketplace. To try one, build a VSIX from its tag (e.g. `v4.0.0-alpha.0`; for later tags, clone with `--recurse-submodules`) and install it with `Extensions: Install from VSIX...`:

```sh
pnpm install --frozen-lockfile && pnpm run build
cd extensions/vscode && npx @vscode/vsce package --no-dependencies
```

## Configuration

### Editor Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vue.editor.focusMode` | `boolean` | `false` | Enable focus mode |
| `vue.editor.reactivityVisualization` | `boolean` | `true` | Show reactivity variable visualization |
| `vue.editor.templateInterpolationDecorators` | `boolean` | `true` | Show template interpolation decorators |

### Completion Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vue.suggest.componentNameCasing` | `string` | `preferPascalCase` | Component name casing style (`preferKebabCase`, `preferPascalCase`, `alwaysKebabCase`, `alwaysPascalCase`) |
| `vue.suggest.propNameCasing` | `string` | `preferCamelCase` | Prop name casing style (`preferKebabCase`, `preferCamelCase`, `alwaysKebabCase`, `alwaysCamelCase`) |
| `vue.suggest.defineAssignment` | `boolean` | `true` | Suggest assignments for `defineProps`, etc. |

### Auto-Insert Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vue.autoInsert.dotValue` | `boolean` | `false` | Auto-insert `.value` |
| `vue.autoInsert.bracketSpacing` | `boolean` | `true` | Auto-insert spaces in `{{ }}` |

### Inlay Hints Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vue.inlayHints.destructuredProps` | `boolean` | `false` | Show types for destructured props |
| `vue.inlayHints.inlineHandlerLeading` | `boolean` | `false` | Show parameters for inline handlers |
| `vue.inlayHints.missingProps` | `boolean` | `false` | Show missing required props |
| `vue.inlayHints.optionsWrapper` | `boolean` | `false` | Show Options API wrapper |
| `vue.inlayHints.vBindShorthand` | `boolean` | `false` | Show v-bind shorthand hints |

### Formatting Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vue.format.script.enabled` | `boolean` | `true` | Enable script block formatting |
| `vue.format.template.enabled` | `boolean` | `true` | Enable template block formatting |
| `vue.format.style.enabled` | `boolean` | `true` | Enable style block formatting |
| `vue.format.wrapAttributes` | `string` | `auto` | Attribute wrapping style |

### Server Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vue.server.path` | `string` | - | Custom language server path |
| `vue.server.includeLanguages` | `(string \| { language, pattern })[]` | `["vue", { "language": "markdown", "pattern": "**/*.vue.md" }]` | Documents to process: language IDs, or a language ID with a glob pattern |
| `vue.trace.server` | `string` | `off` | Server trace level |

## Commands

| Command | Description |
| :--- | :--- |
| `Vue: Welcome` | Open the welcome page |
| `Vue: Restart Server` | Restart the language server |

## TypeScript 7 Setup

Version 4 type-checks `.vue` files through TypeScript 7.1 content mappers, served by the TypeScript (Native Preview) extension.

1. Install [TypeScript (Native Preview)](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview)
2. Install TypeScript 7.1 in your project: `npm i -D typescript@beta`
3. Point Native Preview at it in `.vscode/settings.json`, because its bundled TypeScript (7.0) has no content mappers:

```json
{
  "js/ts.tsdk.path": "node_modules/typescript/lib"
}
```

## Troubleshooting

If you encounter any issues, you can try the following steps:

1. **Reload Window**: Run the `Developer: Reload Window` command in VSCode
2. **Type-check**: Run `npx tsc --noEmit --runExternalCode` in the command line to check for type errors
3. **Check Output Channel**: In VSCode's "Output" panel, select `Vue Language Server` to see if there are any error messages

If the problem persists, feel free to open an issue on [GitHub Issues](https://github.com/vuejs/language-tools/issues).

## ❤️ Sponsors

This project's continued development is made possible by our generous sponsors:

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.png"/>
  </a>
</p>

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
