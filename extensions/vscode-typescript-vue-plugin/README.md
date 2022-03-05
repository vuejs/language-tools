# TypeScript Vue Plugin

> A [TS server plugin](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin) to make TS server know *.vue files.

[Plugin's page on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin)

⚠️ It's recommended to [use take over mode instead of this plugin](https://github.com/johnsoncodehk/volar/discussions/471).

This plugin proxies TS server requests to provide some extra functionality:

- When finding references in *.ts files, you also get results from *.vue files.
- When renaming in *.ts files, references on *.vue files also get adjusted.
- When typing import statements, .vue* files will also appear for autocompletion.
- (And some extra details most people don't need to know...)

## Sponsors

This company is [sponsoring this project](https://github.com/sponsors/johnsoncodehk) to improve your DX. 💪

<a href="https://github.com/Leniolabs">
  <img itemprop="image" src="https://github.com/Leniolabs.png" width="100" height="100">
</a>
