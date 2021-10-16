# Volar

> Explore high-performance Vue language support in some aspects

- VSCode Extension: [Vue Language Features](https://github.com/johnsoncodehk/volar/tree/master/extensions/vscode-vue-language-features)
- TS Server Plugin: [TypeScript Vue Plugin](https://github.com/johnsoncodehk/volar/tree/master/extensions/vscode-typescript-vue-plugin)
- CLI Interface: [vue-tsc](https://github.com/johnsoncodehk/volar/tree/master/packages/vue-tsc)

Discord: https://discord.gg/5bnSSSSBbK

## Community Language Client Implements

- coc.nvim: https://github.com/yaegassy/coc-volar ⚡ 🤝
- nvim: https://github.com/neovim/nvim-lspconfig
- vim-lsp: https://github.com/mattn/vim-lsp-settings ⚡
- Sublime: https://github.com/sublimelsp/LSP-volar

⚡ This implement supported [multiple servers](https://github.com/johnsoncodehk/volar/discussions/393#discussioncomment-1213736) \
🤝 This implement supported [take over mode](https://github.com/johnsoncodehk/volar/discussions/471)

## Sponsors

If you want to support the sustainability of this project, please consider becoming a sponsor, thank you!

This company is [sponsoring this project](https://github.com/sponsors/johnsoncodehk) to improve your DX. 💪

<table>
  <tr>
    <td>
      <a href="https://github.com/Leniolabs">
        <img itemprop="image" src="https://github.com/Leniolabs.png" width="100" height="100">
      </a>
    </td>
    <td>
      <h3>Leniolabs_</h3>
      <p>Scale your Front-end development with our unique approach</p>
      <p>
        <a href="https://www.leniolabs.com/">https://www.leniolabs.com/</a>
        ・<a href="https://twitter.com/Leniolabs_">@Leniolabs_</a>
        ・<a href="mailto:info@leniolabs.com">info@leniolabs.com</a>
      </p>
    </td>
  </tr>
</table>

## Using

See https://github.com/johnsoncodehk/volar/tree/master/extensions/vscode-vue-language-features#using

## Limitations

- Due to performance, *.ts content update don't update template diagnosis for now. ([#565](https://github.com/johnsoncodehk/volar/issues/565)) (Block by [microsoft/TypeScript#41051](https://github.com/microsoft/TypeScript/issues/41051))

## Credits

- [vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples) shows all the knowledge required to develop the extension.
- [angular](https://github.com/angular/angular) shows how TS server plugin working with language service.
- Syntax highlight is rewritten by [vue-syntax-highlight](https://github.com/vuejs/vue-syntax-highlight).
- https://github.com/mjbvz/vscode-fenced-code-block-grammar-injection-example shows how to inject vue syntax highlight to markdown.
- Out of the box formatting working by:
  - [prettyhtml](https://github.com/Prettyhtml/prettyhtml): html
  - [pug-beautify](https://github.com/vingorius/pug-beautify): pug
  - [prettier](https://github.com/prettier/prettier): css, less, scss, postcss
  - [typescript](https://github.com/microsoft/TypeScript): js, ts, jsx, tsx

## By-product

- [@volar/server](https://www.npmjs.com/package/@volar/server): Bridging module for LSP <-> vscode-vue-languageservice.
- [typescript-vue-plugin](https://www.npmjs.com/package/typescript-vue-plugin): See [#169](https://github.com/johnsoncodehk/volar/issues/169#issuecomment-832377254).
- [vscode-vue-languageservice](https://www.npmjs.com/package/vscode-vue-languageservice) : Generic language server module for Vue
- [vscode-pug-languageservice](https://www.npmjs.com/package/vscode-pug-languageservice): Generic language server module for Pug
- [vscode-typescript-languageservice](https://www.npmjs.com/package/vscode-typescript-languageservice): Generic language server module for TypeScript
