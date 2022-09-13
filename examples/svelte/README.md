# Svelte Langauge Server Example

This example show how to create a Svelte langauge server via Volar framework.

With this solution you can avoid dealing with problems that usually require a lot of effort to solve, such as:

- Multi-level nested embedded language
- Embedded code mapping
- TypeScript langauge service performance optimization
- Web IDE support
- Incremental parser

Even downstream IDE clients (`coc-volar`, `sublimelsp/LSP-volar`...) can simply support the language server created by this.

To run this example, you can run `Launch Svelte Example` on debug, and open a Svelte project in the newly opened VSCode window.

Please note that this example is not support `vsce package` for `vsce publish` out of box, because this repo using pnpm and vsce do not support it. To resolve it, you should change pnpm to yarn / npm, or [bundling the extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
