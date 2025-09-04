# Changelog

## 3.0.7 (2025-09-02)

### Bug Fixes

- fix(vscode): show welcome page only when opening a Vue file
- fix(language-core): generate slot parameters in the same way as interpolation (#5618) - Thanks to @KazariEX!
- fix(language-core): do not generate variables for builtin directives - Thanks to @KazariEX!

### Other Changes

- docs(vscode): add descriptions for premium feature configurations (#5612) - Thanks to @KazariEX!

## 3.0.6 (2025-08-20)

### Bug Fixes

- fix(language-core): wrap `:class` expression with parens - Thanks to @KazariEX!
- fix(vscode): revert Vue 2 versions in `target` option (#5583) - Thanks to @gxres042!
- fix(language-service): skip document highlight from tsserver within element tags (#5584) - Thanks to @KazariEX!
- fix(component-meta): re-export `vue-component-type-helpers` to `lib/helpers` (#5600)
- fix(language-core): remove the non-strict `configFileName` default value (#5606)
- fix(language-core): don't look for input files during evaluation of vueCompilerOptions (#5598)
- fix(vscode): Improved reliability of handling extension activation contention (#5588)
- chore: update volar to 2.4.23
  - Support `js/ts.hover.maximumLength` and `typescript.experimental.expandableHover` (#5577)

### Other Changes

- feat(lint): update tsslint config (#5602)
- refactor(language-core): generate setup returns on demand - Thanks to @KazariEX!
- chore(language-service): remove `exclude` config suggestion from global types error message (#5579) - Thanks to @Ciallo-Chiaki
- chore(vscode): update extension display name "Vue.js" (#5582)
- chore: update `vue-component-type-helpers` to current version (#5589) - Thanks to @kingyue737!

## 3.0.5 (2025-08-01)

### Features

- feat(language-core): introduce `compileSFCStyle` to provide style related infomation (#5548) - Thanks to @KazariEX!
- feat(language-service): completion snippet for `v-for` (#5553) - Thanks to @KazariEX!

### Bug Fixes

- fix(language-core): generate `modelModifiers` for explicitly declared default model name (#5558) - Thanks to @KazariEX!
- fix(language-service): more responsive `.value` insertion
- fix(vscode): add `class` scope fallback for `component` semantic tokens (#5559) - Thanks to @KazariEX!
- fix(vscode): make sure extension is loaded immediately
- fix(language-service): only check `globalTypesPath` for FS files
- fix(vscode): handle fail tsserver requests to avoid memory leak
- fix(vscode): do not delay the execution of `restartExtensionHost`
- fix(language-core): avoid references highlight of unrelated native element tags (#5563) - Thanks to @KazariEX!
- fix(language-core): tolerance for incomplete root template tag
- fix(language-core): enable navigation code feature on directive modifiers - Thanks to @KazariEX!

### Other Changes

- chore(language-service): improve global types error message for JS projects (#5574) - Thanks to @Ciallo-Chiaki!

## 3.0.4 (2025-07-25)

### Features

- feat(language-service): check casing when dropping component into template - Thanks to @KazariEX!
- feat(language-service): native completion experience for slot names (#5552) - Thanks to @KazariEX!

### Bug Fixes

- fix(language-core): avoid clearing global types path when local compiler options is present - Thanks to @KazariEX!
- fix(language-core): do not evaluate `skipTemplateCodegen` when exposing `$slots` - Thanks to @KazariEX!
- fix(language-service): correct kind and order of component completion items - Thanks to @KazariEX!
- fix(component-meta): filter events out of props (#5547) - Thanks to @Akryum!

### Other Changes

- refactor(language-core): allow configuring `checkUnknownEvents` and `checkUnknownComponents` in sfc (#5537) - Thanks to @KazariEX!
- chore(language-service): add restart server hint to global types warning - Thanks to @KazariEX!

## 3.0.3 (2025-07-18)

### Bug Fixes

- fix(language-core): find `node_modules` based on file's directory (#5525) - Thanks to @KazariEX!
- fix(language-core): do not spread exposed object (#5526) - Thanks to @KazariEX!
- fix(vscode): prompt manual reload in remote envs (#5530)

### Other Changes

- refactor(tsc): return the result of runTsc (#5517) - Thanks to @escaton!

## 3.0.2 (2025-07-18)

### Features

- feat(language-core): introduce `globalTypesPath` option for non-npm like environment (#5505) - Thanks to @KazariEX!
- feat: forward tsserver's semantic tokens via language server (#5512) - Thanks to @KazariEX!

### Bug Fixes

- fix(vscode): correct syntax highlight of control directives ending with `/` or `)` - Thanks to @KazariEX!
- fix(language-core): infer parameter type of union slots to be union instead of intersection (#5475) - Thanks to @KazariEX!
- fix(vscode): remove `colorizedBracketPairs` config for plaintext
- fix(language-core): avoid early access to local types to skip unnecessary type generation - Thanks to @KazariEX!
- fix(language-core): treat `<component>` without `is` prop as normal component - Thanks to @KazariEX!
- fix(vscode): make sure tsserver loads `@vue/typescript-plugin` last (#5483)
- fix(language-core): only keep navigation code feature on static `name` value of `<slot>` - Thanks to @KazariEX!
- fix(language-server): add `allowJs` to reactivity analyze host - Thanks to @KazariEX!
- fix(language-core): do not set template lang to `md` for markdown (#5497) - Thanks to @KazariEX!
- fix(typescript-plugin): exclude items of kind `module` from template completion - Thanks to @KazariEX!
- fix(language-core): walk identifiers correctly within type nodes in interpolation (#5501) - Thanks to @KazariEX!
- fix(language-service): correct position calculation of twoslash queries (#5503) - Thanks to @KazariEX!
- fix(language-core): avoid redundant increment of block variable depth (#5511) - Thanks to @KazariEX!
- fix(language-service): re-implement twoslash queries in script - Thanks to @KazariEX!

### Other Changes

- refactor(vscode): make welcome page code public - Thanks to @KazariEX!
- refactor(vscode): add premium feature settings
- chore: migrate from `minimatch` to `picomatch` (#5499) - Thanks to @KazariEX!
- chore: update volar to 2.4.19
  - fix(typescript): skip source file search when `.d.${ext}.ts` file exists (volarjs/volar.js#277)
- revert: type support of slot children (#5137) (#5514) - Thanks to @KazariEX!

## 3.0.1 (2025-07-02)

### Bug Fixes

- fix(language-core): remove calculation logic of element inner loc (#5460) - Thanks to @KazariEX!
- fix(vscode): correct syntax highlight of `v-else` (#5470) - Thanks to @KazariEX!

### Other Changes

- docs(vscode): update Russian translation for VS Code extension (#5461) - Thanks to @AndreyYolkin!
- chore: update volar to 2.4.17
  - typescript: correctly use `getModeForUsageLocation` to calculate the resolution mode

## 3.0.0 (2025-07-01)

### Features

- feat(typescript-plugin): skip declaration files in goto components definition (#5221) - Thanks to @KazariEX!
- feat(language-core): introduce `strictVModel` option (#5229) - Thanks to @KazariEX!
- feat(vscode, language-server, typescript-plugin): communicate with tsserver based on request forwarding (#5252, #5395, #5443)
- feat(language-core): support navigation of events with `v-on` syntax (#5275) - Thanks to @KazariEX!
- feat(language-core): type support of slot children (#5137) - Thanks to @KazariEX!
- feat(language-service): autocomplete for props with union type
- feat(language-service): document links for template refs (#5385) - Thanks to @alex-snezhko!
- feat(language-core): resolve external stylesheets (#5136) - Thanks to @KazariEX!
- feat(language-core): add `strictCssModules` option (#5164) - Thanks to @KazariEX!
- feat(component-type-helpers): add `ComponentAttrs` type for attribute extraction
- feat(vscode): add support for `typescript.sortImports`, `typescript.removeUnusedImports` commands (#5444)
- feat(vscode): i18n support of configurations and commands with `zh-CN`, `zh-TW`, `ru` and `ja` (#5330, #5340, #5404) - Thanks to @KazariEX, @PurplePlanen and @zyoshoka!

### Bug Fixes

- fix(language-core): generate condition guards for model events (#5225) - Thanks to @KazariEX!
- fix(language-core): prevent global types generation in declaration files (#5239) - Thanks to @KazariEX!
- fix(language-core): prevent eager inference of slot props from generics (#5247) - Thanks to @KazariEX!
- fix(typescript-plugin): prevent highlighting native element tags with same name as components (#5253) - Thanks to @KazariEX!
- fix(language-service): do not provide required props inlay hints for intrinsic elements (#5258) - Thanks to @KazariEX!
- fix(vscode): handle `typescript-language-features` module loading race condition (#5260)
- fix(component-meta): update event type representation to include array notation
- fix(language-core): correct error mapping when prop exp is arrow function (#5262) - Thanks to @KazariEX!
- fix(language-service): add document highlights support (#5263) - Thanks to @KazariEX!
- fix(language-core): correct type inference of multiple template refs with same name (#5271) - Thanks to @KazariEX!
- fix(language-core): skip AST parsing when the expression is an identifier (#5268) - Thanks to @KazariEX!
- fix(language-core): do not drop leading comments of `defineModels` (#5273) - Thanks to @KazariEX!
- fix(language-core): improve fault tolerance for unsupported script languages
- fix(language-core): avoid invalid auto import edit position when setup global types fails
- fix(language-core): transform slot parameter list into equivalent binding pattern (#5245) - Thanks to @KazariEX!
- fix(language-core): correct codegen when src path does not match the generated length - Thanks to @KazariEX!
- fix(language-service): exclude `data-` attribute completion from sfc level nodes - Thanks to @KazariEX!
- fix(language-core): remove semantic highlight of v-bind shorthand (#5321) - Thanks to @KazariEX!
- fix(vscode): inline html comment pattern in Vue syntax definition (#5327) - Thanks to @zyoshoka!
- fix(language-core): avoid unrelated virtual code recomputes on style and template change - Thanks to @KazariEX!
- fix(component-meta): attach namespace prefix correctly on generated types (#5326) - Thanks to @KazariEX!
- fix(language-core): drop `undefined` from optional prop type with default in template (#5339) - Thanks to @Dylancyclone!
- fix: depend on exact volar version (#5345) - Thanks to @tomblachut!
- fix(language-core): ignore frontmatter block in markdown files (#5362) - Thanks to @brc-dd!
- fix(component-meta): only exclude vnode events from props (#5369) - Thanks to @KazariEX!
- fix(language-core): skip css references for position within virtual code with `navigation: true` (#5378) - Thanks to @KazariEX!
- fix(language-core): hoist export declarations from generic script block (#5398) - Thanks to @KazariEX!
- fix(vscode): correct syntax highlight for directives starting with `v-for` (#5399) - Thanks to @KazariEX!
- fix(language-core): correct support for flatten plugins (#5392) - Thanks to @zhiyuanzmj!
- fix(language-core): remove `semantic` code feature on first argument of `useCssModule` and `useTemplateRef` - Thanks to @KazariEX!
- fix(typescript-plugin): filter completion items of macros and global variables in template and styles (#5425) - Thanks to @KazariEX!
- fix(language-core): do not generate redundant function scopes to affect type narrowing (#5430) - Thanks to @KazariEX!
- fix(component-meta): add new file name in `updateFile` (#5438) - Thanks to @Akryum!
- fix(language-core): `Prettify<T>` breaks generics inferencing (#5424) - Thanks to @so1ve!
- fix(language-core): use `var` instead of `let` to declare `attrsVar` that may be hoisted - Thanks to @KazariEX!

### Performance

- perf(language-core): cache and reuse inline ts asts during full updates (#5435) - Thanks to @KazariEX!

### Other Changes

- refactor(vscode, language-server): remove hybrid mode configuration (#5248)
- refactor(vscode): remove write virtual files command
- chore(vscode): correct `directory` path in package.json (#5283) - Thanks to @zyoshoka!
- chore(vscode): use rolldown for bundling (#5337) - Thanks to @KazariEX!
- refactor(vscode): remove doctor - Thanks to @KazariEX!
- docs: update instructions for neovim lsp configuration (#5361) - Thanks to @kshksdrt!
- refactor(vscode): remove Vite problem matcher (#5375)
- chore(docs): update vue language package name (#5376) - Thanks to @marktlinn!
- chore(ci): set pre-release status when publishing to Open VSX (#5377) - Thanks to @lukashass!
- docs: fallback workaround of `vue_language_server_path` in nvim setup example (#5391) - Thanks to @menuRivera!
- test(component-meta): simplify code with snapshots (#5403) - Thanks to @KazariEX!
- docs(nvim): move neovim lspconfig docs to wiki page (#5408) - Thanks to @RayGuo-ergou!
- refactor(language-server): drop `typescript.tsdk` initialization option (#5409)
- refactor(language-service): drop name casing convertion and its language status item (#5411) - Thanks to @KazariEX!
- refactor(language-core): drop `defineProp` support (#5415) - Thanks to @KazariEX!
- chore(vscode): change display name to "Vue (Official)"
- refactor: cleanup dependencies relationship (#5421)
- refactor(component-meta): use type-helpers as a peer dependency
- refactor(vscode): cleanup extension client (#5422)
- refactor(language-server): move in server code from insiders edition (#5423)
- chore: introduce oxlint for faster linting (#5416) - Thanks to @KazariEX!
- refactor(vscode): remove split editor feature (#5446)
- refactor(vscode): rename configuration keys from `complete` to `suggest` for clarity

## Previous Changelogs

### 2.x.x (2024/3/2 - 2025-04-22)

See [changelog v2](./changelogs/CHANGELOG-v2.md)

### 1.x.x (2022/10/7 - 2023/12/26)

See [changelog v1](./changelogs/CHANGELOG-v1.md)

### 0.x.x (2020/5/2 - 2022/9/8)

See [changelog v0](./changelogs/CHANGELOG-v0.md)
