# Changelog

## 3.2.1 (2025-12-xx)

fix(component-meta): skip schema resolution correctly when `option` is `false` (#5891) - Thanks to @KazariEX!
fix(component-type-helpers): add missing reference to tsconfig (#5893)
fix(language-core): infer array type in `v-for` (#5896) - Thanks to @serkodev!

## 3.2.0 (2025-12-20)

### vscode

- **fix:** Vue TS highlighting when trailing type alias is missing semicolon (#5853) - Thanks to @serkodev!
- **perf:** replace `fast-diff` with custom character-by-character alignment algorithm (#5849) (#5851)
- **refactor:** update Vue grammar scope name to "text.html.vue" (#5856)
- **test:** add test for embedded grammars (#5861) - Thanks to @serkodev!

### language-service

- **feat:** rich hover message (#5881)
- **feat:** support markdown JSDoc for rich hover message description (#5890) - Thanks to @serkodev!
- **chore:** adjust rich hover message title layout (#5889) - Thanks to @serkodev!

### component-meta

- **feat:** add `tags` to slots and exposed (#5862) - Thanks to @aj-dev!
- **feat:** filter out irrelevant properties from `exposed` (#5868) - Thanks to @aj-dev!
- **refactor:** redundant logic between deduplication and language-core (#5875)
- **refactor:** de-dependency from component-type-helpers (#5876)
- **refactor:** search prop defaults with symbol declarations (#5879)
- **refactor:** deprecate "noDeclarations" and "forceUseTs" options (#5887)

### typescript-plugin

- **feat:** include leading dot when finding references to CSS classes (#5852)
- **fix:** missing module error after file rename (#5839) - Thanks to @serkodev!
- **fix:** prioritize non-warning completion entries over warning ones (#5847)
- **fix:** always pass rest parameters for future compatibility (#5859) - Thanks to @KazariEX!
- **fix:** add nullish guards before accessing `ts.CompletionEntryData` (#5869) - Thanks to @KazariEX!
- **fix:** handle import type nodes in definition proxy (#5873)
- **fix:** handle type imports in component auto-import(#5874)

### language-core

- **feat:** revert overcorrection of `v-for` type inference (#5836)
- **feat:** align `v-for` key type with `Object.keys` (#5837) - Thanks to @serkodev!
- **feat:** narrow component and directive types (#5841)
- **feat:** support `<!-- @strictTemplates -->` magic comment (#5845)
- **fix:** correctly resolve `<script src="">` (#5838)
- **fix:** preserve template slot wrappers during `createIfBranch` (#5844) - Thanks to @serkodev!
- **fix:** include end tag locations when renaming global components
- **refactor:** replace dynamic types generation with static files (#5872)
- **refactor:** improve Vue version detection and plugin resolution

### component-type-helpers

- **refactor:** remove `ComponentType` helper

### workspace

- **chore:** update testing infrastructure (#5848)
- **chore:** use tsgo in development (#5860)
- **chore:** reduce local dependencies and update workflows (#5863)
- **chore:** upgrade tsslint and vite to pre-release versions
- **chore:** delete tests for Vue 3.4 (#5871)

## 3.1.8 (2025-12-09)

### Features

- feat(vscode): support multiline attribute for `<script>` and `<style>` tag (#5830) - Thanks to @serkodev!
- feat(vscode): supports format with selected range (#5761) - Thanks to @serkodev!
- feat(language-service): add tsconfig-based document link support for Pug

### Bug Fixes

- fix(language-core): limit the range of parseDiagnostics checks (#5823)
- fix(language-core): restore default import bindings for template scope (#5824) - Thanks to @serkodev!
- fix(typescript-plugin): get `preferences` and `formatOptions` in tsserver (#5829)
- fix(language-core): avoid generating component options within the setup scope (#5832)

### Other Changes

- perf(language-core): dedupe component options generation (#5831)

## 3.1.7 (2025-12-08)

### Features

- feat(language-core): cache virtual code by `scriptId` (#5811) - Thanks to @serkodev!

### Bug Fixes

- fix(language-core): avoid using `Identifier.text` property (#5810)
- fix(language-core): generate script separator on demand (#5816)
- fix(language-core): avoid invalid `__VLS_Slots` generation

### Other Changes

- feat(lint): add typescript services types lint rule (#5813) - Thanks to @serkodev!

## 3.1.6 (2025-12-06)

### Features

- feat(vscode): add settings to enable per-block formatting (#5784) - Thanks to @serkodev!
- feat(language-service): enhanced component auto import (#5790)
- feat(component-meta): add component name and description fields (#5797)
- feat(typescript-plugin): add support for template "Add Import" quick fix (#5799) - Thanks to @serkodev!
- feat(typescript-plugin): mapping JSDoc informations from `<script setup>` (#5805)
- feat(vscode): support tsdk path for Eclipse Theia (#5806) - Thanks to @serkodev!

### Bug Fixes

- fix(language-service): ignore intrinsic elements when detect tag name casing (#5771)
- fix(language-core): `createParsedCommandLineByJson` parsed incorrect options since v3.1.5 (https://github.com/vuejs/language-tools/pull/5768#issuecomment-3569623037)
- fix(vscode): make `vue.server.path` compatible with Windows (#5772)
- fix(vscode): analyze interpolation highlight ranges based on AST (#5777)
- fix(vscode): sync latest vscode html language configuration (#5740)
- fix(language-core): enhance `getVIfNode` to support `v-else-if` directives (#5765) - Thanks to @serkodev!
- fix(language-core): generate `{}` instead of its string value for `style="..."` (#5781) - Thanks to @KazariEX!
- fix(language-core): `v-bind="$attrs"` loses navigation when `inferTemplateDollarAttrs` is disabled (#5783)
- fix(language-service): skip `const props =` completion in StringLiteral (#5786)
- fix(language-core): unable to get completion for the second scoped class name
- fix(language-service): format components with HTML void-element names (#5788) - Thanks to @serkodev!
- fix(language-service): properly handle promise when resolving CSS links (#5785)
- fix(language-core): infer `$el` type for generic components using `inferComponentDollarEl` (#5794)
- fix(language-core): ensure `<script>` content generates before `<script setup>` (#5795)
- fix(language-core): remove `bypassDefineComponent` hack for better JS support (#4876) (#5379)
- fix(language-core): `Prettify<T>` caused generic props gets inferred as `unknown`  (#5667) - Thanks to @so1ve!
- fix(vscode): handle leading `<` as operator in SFC scripts (#5801) - Thanks to @serkodev!
- fix(vscode): patch `isTypeScriptDocument` in VSCode for `typescript.preferences.autoImportSpecifierExcludeRegexes` config support (#5364)
- fix(language-core): ensure type consistency for optional boolean props (#5803)
- fix(language-core): add compatibility for `vapor` attr (#5496)
- fix(language-core): AST fault tolerance for key binding on template (#5807)

### Performance

- perf(language-core): reuse ts asts for `:class` - Thanks to @KazariEX!

### Other Changes

- Revert "refactor(typescript-plugin): remove go to definition trick for auto imported components (#5733)"
- docs(typescript-plugin): update Neovim configuration link (#5775) - Thanks to @AlexVagrant!
- refactor(language-core): normalize template AST (#5782)
- refactor(language-core): split style codegen (#5787)
- refactor(language-core): remove `debugger` from virtual code for tsslint compatibility
- refactor(language-core): remove legacy navigation support in `ref="xxx"`
- refactor(language-core): reduce codegen options (#5804)
- refactor(component-meta): deprecated `rawType` and `__internal__.tsLs` (#5808)
- chore: update volar to 2.4.26
  - feat: fallback resolution mode for `createResolveModuleName` (https://github.com/volarjs/volar.js/pull/293) (#5644) - Thanks to @serkodev!

## 3.1.5 (2025-11-23)

### Features

- feat(language-service): support tsconfig path alias resolution for document links (#5562) - Thanks to @KazariEX!
- feat(language-server): add `serverInfo` to initialized result (#5767) - Thanks to @kada49!

### Bug Fixes

- fix(vscode): correct highlighting of tags starting with `template` (#5755) - Thanks to @serkodev and @KazariEX!
- fix(language-core): allow loose props checks on generic components (#5748) - Thanks to @serkodev!
- fix(language-core): avoid `vue-tsc` crash during single file checks (#5768) - Thanks to @KazariEX!
- fix(language-core): dispose virtual code correctly - Thanks to @KazariEX!

### Performance

- perf(language-core): skip unnecessary runtime codegen step (#5766) - Thanks to @KazariEX!

## 3.1.4 (2025-11-16)

### Bug Fixes

- fix(language-service): prevent auto-insertion of html snippets in template interpolation (#5744) - Thanks to @serkodev!
- fix(language-service): strip interpolations from document passed to html service - Thanks to @KazariEX!
- fix(language-core): report unused `@ts-expect-error` directive on components with loose props checks (#5750) - Thanks to @serkodev and @KazariEX!
- fix(language-core): respect directive comments before `v-else` (#5753) - Thanks to @serkodev and @KazariEX!

### Other Changes

- refactor(language-core): re-implement component references by codegen (#5736) - Thanks to @KazariEX!
- refactor(language-core): simplify calculation of full interpolation content - Thanks to @KazariEX!

## 3.1.3 (2025-11-03)

### Features

- feat(typescript-plugin): allow triggering file references on `<template>` (#5734) - Thanks to @KazariEX!

### Bug Fixes

- fix(vscode): correct syntax highlight in template with `lang="html"` (#5728) - Thanks to @serkodev!

### Other Changes

- refactor(language-core): generate intrinsic elements variable into global types (#5730) - Thanks to @KazariEX!
- refactor(typescript-plugin): remove go to definition trick for auto imported components (#5733) - Thanks to @KazariEX!

## 3.1.2 (2025-10-25)

### Bug Fixes

- fix(component-meta): import type helpers by relative path
- fix(language-core): fix syntax error when `propTypes` has no elements (#5704) - Thanks to @so1ve!
- fix(language-core): omit defined emit props only (#5705) - Thanks to @so1ve!

### Other Changes

- docs: fix `vue-tsc` broken link to example boilerplate in `README.md` (#5721) - Thanks to @heyakyra!

## 3.1.1 (2025-10-07)

### Features

- feat(language-server): support `--tsdk` command line arg (#5691)

### Bug Fixes

- fix(language-core): tolerate non-literal export default (#5675) - Thanks to @KazariEX!
- fix(language-core): use component instance props as fallthrough attributes (#5686) - Thanks to @KazariEX!
- fix(typescript-plugin): determine if variable is `Ref` by `RefSymbol` property (#5687) - Thanks to @KazariEX!
- fix(language-core): exclude effect of comments on root node (#5689) - Thanks to @KazariEX!
- fix(typescript-plugin): place `__vue__` in project instead of program (#5690)
- fix(component-type-helpers): remove deprecated `$scopedSlots` support for Vue 2
- fix(language-core): replace markdown links after sfc blocks processing (#5695) - Thanks to @KazariEX!
- fix(language-core): do not report unused error on `__VLS_export` (#5696) - Thanks to @KazariEX!

### Other Changes

- refactor(language-core): reimplement `writeGlobalTypes` without side effects

## 3.1.0 (2025-09-28)

### Performance

- perf(language-core): drop internal component (#5532) - Thanks to @KazariEX!

### Other Changes

- refactor: drop Vue 2 support (#5636) - Thanks to @KazariEX!
- chore(lint): enforce use of type-only imports (#5658) - Thanks to @so1ve!
- ci: upgrade node version (#5668) - Thanks to @so1ve!
- refactor(typescript-plugin): move reactivity analysis logic to a seperate typescript plugin (#5672) - Thanks to @KazariEX!

## 3.0.10 (2025-10-25)

### Bug Fixes

- fix(typescript-plugin): place `__vue__` in project instead of program (#5690)

## 3.0.9 (2025-10-07)

### Features

- feat(language-server): support `--tsdk` command line arg (#5691)

## 3.0.8 (2025-09-23)

### Features

- feat(vscode): introduce `vue.server.path` setting (#5647)

### Bug Fixes

- fix(language-core): initialize properties of `VueVirtualCode` in constructor (#5635) - Thanks to @KazariEX!
- fix(vscode): flatten reactivity visualization decorators (#5642) - Thanks to @KazariEX!
- fix(vscode): normalize reactivity visualization ranges
- fix(vscode): patch `typescriptServerPlugin` languages without FS hack
- fix(language-service): do not provide semantic tokens and document highlights for non-`file` scheme files (#5653) - Thanks to @KazariEX!

### Performance

- perf(typescript-plugin): redo single-file language service for reactivity visualization (#5652)

### Other Changes

- refactor(typescript-plugin): externalize reactivity analysis logic (#5645) - Thanks to @KazariEX!

## 3.0.7 (2025-09-12)

### Bug Fixes

- fix(vscode): show welcome page only when opening a Vue file
- fix(language-core): generate slot parameters in the same way as interpolation (#5618) - Thanks to @KazariEX!
- fix(language-core): do not generate variables for builtin directives - Thanks to @KazariEX!

### Other Changes

- docs(vscode): add descriptions for premium feature configurations (#5612) - Thanks to @KazariEX!
- refactor(typescript-plugin): explicitly request parameters (#5623)
- chore(lint): enable `@typescript-eslint/no-unnecessary-condition` (#5630)
- refactor(language-server): reimplement Reactivity Visualization in typescript plugin (#5632)
- refactor(language-server): parsing interpolations in extension client (#5633)
- refactor(vscode): reimplement Focus Mode base on folding ranges (#5634)
- chore(vscode): disable Focus Mode by default (#5578)
- refactor(vscode): set delay of reactivity visualization updates to 250ms - Thanks to @KazariEX!

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
