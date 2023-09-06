# TypeScript Vue Plugin

> A [TS server plugin](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin) to make TS server know *.vue files.

[Plugin's page on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)

⚠️ It's recommended to [use take over mode instead of VSCode built-in TS plugin](https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode).

This plugin proxies TS server requests to provide some extra functionality:

- When finding references in *.ts files, you also get results from *.vue files.
- When renaming in *.ts files, references on *.vue files also get adjusted.
- When typing import statements, *.vue files will also appear for autocompletion.
- (And some extra details most people don't need to know...)

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.png"/>
  </a>
</p>
