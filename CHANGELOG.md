# Changelog

## 0.27.21

- feat: support css settings ([#492](https://github.com/johnsoncodehk/volar/issues/492))
- perf: cache vscode configuration
- fix: props auto-complete not working for hyphenate components ([#487](https://github.com/johnsoncodehk/volar/issues/487))
- fix: inline style with line break is broken ([#489](https://github.com/johnsoncodehk/volar/issues/489))
- fix: cannot find module 'upath' in vscode-pug-languageservice ([#493](https://github.com/johnsoncodehk/volar/issues/493))

## 0.27.20

- perf: improve template type-checking performance
- fix: template component tags coloring range incorrect
- fix: improve vue-tsc version checking accuracy
- fix: language server broken when typed `\` ([#468](https://github.com/johnsoncodehk/volar/issues/468))
- fix: remove old status bar items when restart servers ([#486](https://github.com/johnsoncodehk/volar/issues/486))
- fix: fixed emits type extract failed edge cases

## 0.27.19

- feat: support dynamic prop
- perf: much faster template type-checking for vue-tsc

## 0.27.18

- feat: support renaming for `ref="xxx"` ([#472](https://github.com/johnsoncodehk/volar/issues/472))
- feat: support bracket pair colorization
- fix: request failed when typing `import |` if TS version < 4.3 ([#468](https://github.com/johnsoncodehk/volar/issues/468))
- fix: `ref` attribute type incorrect ([#473](https://github.com/johnsoncodehk/volar/issues/473))
- fix: `v-bind` + single quote parse failed ([#474](https://github.com/johnsoncodehk/volar/issues/474))
- fix: tag name conversion not working ([#475](https://github.com/johnsoncodehk/volar/issues/475))
- fix: auto import path preview not working

## 0.27.17

- 🎉 feat: take over mode ([#471](https://github.com/johnsoncodehk/volar/discussions/471))
- feat: ts plugin status bar default hide
- feat: improve accurate style variables support ([#463](https://github.com/johnsoncodehk/volar/issues/463))
- fix: javascript format settings not working ([#466](https://github.com/johnsoncodehk/volar/issues/466))
- fix: semantics token not working in *.ts ([#469](https://github.com/johnsoncodehk/volar/issues/469))
- fix: fixed formatting result broken extreme case ([#470](https://github.com/johnsoncodehk/volar/issues/470))

## 0.27.16

- feat: reuse `volar.tsPlugin`
- fix: can't override events type by props
- fix: don't report error on unknown events
- fix: `any` type comoponent should not show red ([#461](https://github.com/johnsoncodehk/volar/issues/461))
- fix: html element attrs type-check broken

## 0.27.15

- fix: template slot type-checking broken ([vue-tsc#70](https://github.com/johnsoncodehk/vue-tsc/issues/70))
- fix: more accurate component props extract ([#459](https://github.com/johnsoncodehk/volar/issues/459))

## 0.27.14

- feat: expose `@volar/server/out/index.js` to `volar-server` command ([#458](https://github.com/johnsoncodehk/volar/issues/458))
- fix: component type incorrect if duplicate name in props ([#453](https://github.com/johnsoncodehk/volar/issues/453))
- fix: fixed `typescript.serverPath` relative path finding

## 0.27.13

- feat: support TS 4.4 ([#428](https://github.com/johnsoncodehk/volar/issues/428))

## 0.27.12

- feat: support vue2 nameless event ([vue-tsc#67](https://github.com/johnsoncodehk/vue-tsc/issues/67))
- feat: support lsp client which unsupported workspaceFolders
- fix: `/** */` auto close not working ([#446](https://github.com/johnsoncodehk/volar/issues/446))

## 0.27.11

- feat: unused dynamic registration to adapt nvim LSP [#441#issuecomment-895019036](https://github.com/johnsoncodehk/volar/discussions/441#discussioncomment-1258701)
- fix: can't not find template context properties if `<script>` block missing ([#437](https://github.com/johnsoncodehk/volar/issues/437))
- fix: import completion incorrectly append `$1` ([#371](https://github.com/johnsoncodehk/volar/issues/371))
- fix: completion should retrigger by space
- fix: json types cannot update in *.vue on editing

## 0.27.10

- fix: `<script src>` unprocessed since v0.27.8 ([vue-tsc#65](https://github.com/johnsoncodehk/vue-tsc/issues/65))
- fix: TS plugin not working since v0.27.8 ([#435](https://github.com/johnsoncodehk/volar/issues/435))
- fix: de-ref-sugar conversion can't add missing imports
- fix: more acurrate code action result

## 0.27.9

- feat: low power mode ([#390](https://github.com/johnsoncodehk/volar/issues/390))
- feat: improve setup sugar conversion
- fix: setup sugar convert failed since v0.27.8
- fix: incorrect indentation after generic argument ([#429](https://github.com/johnsoncodehk/volar/issues/429))

## 0.27.8

- feat: consistent folding range with typescript-language-features ([#414](https://github.com/johnsoncodehk/volar/issues/414))
- feat: support custom directives type-checking with `<script setup>` ([#422](https://github.com/johnsoncodehk/volar/issues/422))
- feat: check directives used for `<script setup>` ([#327](https://github.com/johnsoncodehk/volar/issues/327))
- feat: improve SFC parser ([#420](https://github.com/johnsoncodehk/volar/issues/420))
- feat: .vscodeignore whitelist ([#423](https://github.com/johnsoncodehk/volar/issues/423))
- feat: more loose template type-check with `<script lang="js">`
- fix: specific language syntax highlighting not working with single quotes ([#409](https://github.com/johnsoncodehk/volar/issues/409))
- fix: component should be `any` is no script block ([#412](https://github.com/johnsoncodehk/volar/issues/412))
- fix: add `@volar/server` missing deps ([LSP-volar#9](https://github.com/sublimelsp/LSP-volar/issues/9))
- fix: add `@volar/transforms` missing deps ([#430](https://github.com/johnsoncodehk/volar/issues/430))
- fix: jsx / tsx syntax highlighting broken by html syntax injection ([#426](https://github.com/johnsoncodehk/volar/issues/426))
- perf: fixed high CPU usage after switched branch ([#432](https://github.com/johnsoncodehk/volar/issues/432))

**Breaking changes**

- remove tsPlugin required / unrequired prompt and `volar.tsPlugin` setting 

## 0.27.7

- feat: check vue-tsc version on start extension ([#381](https://github.com/johnsoncodehk/volar/issues/381))
- feat: support for non-tsconfig project ([#349](https://github.com/johnsoncodehk/volar/issues/349))
- fix: tsconfig priority should be higher than jsconfig ([#400](https://github.com/johnsoncodehk/volar/issues/400))
- fix: fixed hover info broken in *.ts when TS plugin enabled

## 0.27.6

- feat: support multiple `v-bind(...)` in single css expression
- feat: support `v-bind(...)` expression syntax with quotes
- fix: unhandled language client option: `showReferencesNotification`
- fix: codeLens resolve request broken in template

## 0.27.5

- fix: language server borken when execute sugar convert commands ([#397](https://github.com/johnsoncodehk/volar/issues/397))

## 0.27.4

- feat: support css variable injection ([#335](https://github.com/johnsoncodehk/volar/issues/335))
- feat: make `<script setup>` below `<script>` when convert to setup sugar ([#378](https://github.com/johnsoncodehk/volar/issues/378))
- feat: support sfc named css modules ([#379](https://github.com/johnsoncodehk/volar/issues/379))
- fix: `export default { ... }` syntax broken with setup sugar ([#383](https://github.com/johnsoncodehk/volar/issues/383))
- fix: attr name case option "pascalCase" -> "camelCase" ([#384](https://github.com/johnsoncodehk/volar/issues/384))
- fix: html completion edit range incorrect if typing before old completion request finish ([#385](https://github.com/johnsoncodehk/volar/issues/385))
- perf: faster intellisense and diagnostic in `<template>`

## 0.27.3

- fix: go to component props definition broken in template
- perf: reduce virtual files for TS project (against 0.27.2)

## 0.27.2

- feat: support template type-checking with jsdoc in `<script lang="js">`
- fix: `setup()` return properties unused check not working for component
- fix: radio v-model should not bind to checked
- fix: clear registered commands when restart servers ([#374](https://github.com/johnsoncodehk/volar/issues/374))

## 0.27.1

- fix: remove `vscode-emmet-helper` rename warning for vue-tsc
- fix: components option should be remove when convert to setup sugar
- fix: fixed sometime throw error when convert setup sugar
- fix: prevent top level await error in `<script>` block

## 0.27.0

- feat: support ref sugar (take 2) convert codeLens
- feat: support setup sugar convert codeLens
- feat: support more TS refactor code actions
- perf: faster code action and validation
- fix: setup returns unused check not working

**Breaking changes**

- unsupported ref sugar (take 1) syntax and convert codeLens

## 0.26.16

- feat: improve pug conversion result ([#363](https://github.com/johnsoncodehk/volar/issues/363))
- feat: improve `DocumentSymbolRequest` support
- feat: support `SelectionRangeRequest`
- fix: diagnostics do not report with open second vue document
- fix: add missing `vscode-uri` dep ([#365](https://github.com/johnsoncodehk/volar/issues/365))
- fix: "Delete all unused imports" code action not working
- perf: faster split editors
- perf: faster document update for html server
- perf: move codeAction to api server to prevent codeAction request blocking by diagnostics when save + auto-formatting

**`@volar/server` Breaking changes**

- ServerInitializationOptions: features -> languageFeatures
- ServerInitializationOptions: htmlFeatures -> documentFeatures
- ServerInitializationOptions: move `selectionRange`, `documentSymbol`, `documentColor` to documentFeatures
- remove `RestartServerNotification` (restart by client now)

## 0.26.15

- feat: support GraphQL custom block
- feat: support inline GraphQL syntax highlighting ([#358](https://github.com/johnsoncodehk/volar/issues/358))
- fix: checkbox, radio input tag v-model prop name should be "checked" ([#356](https://github.com/johnsoncodehk/volar/issues/356)) ([vue-tsc#55](https://github.com/johnsoncodehk/vue-tsc/issues/55))
- fix: ignore `"checkJs": true` for template interpolations ([#353](https://github.com/johnsoncodehk/volar/issues/353))
- perf: reuse `ts.createSourceFile` result to reduce script contents update cost

## 0.26.14

- fix: prevent `vue-tsc --noEmit` warnings with `"experimentalCompatMode": 2` [#351#issuecomment-895019036](https://github.com/johnsoncodehk/volar/pull/351#issuecomment-895019036)
- fix: vue-tsc build failed with `<xxx v-for v-slot>` due to code gen side effects ([vue-tsc#53](https://github.com/johnsoncodehk/vue-tsc/issues/53))

## 0.26.13

- fix: republish to replace incorrect script name: `vue2templateCompiler.js` -> `vue2TemplateCompiler.js` ([#352](https://github.com/johnsoncodehk/volar/issues/352))

## 0.26.12

- 🎉 feat: support for vue 2 template ([#351](https://github.com/johnsoncodehk/volar/issues/351))
- fix: support for `"noPropertyAccessFromIndexSignature": true` ([#350](https://github.com/johnsoncodehk/volar/issues/350))
- fix: `.value` should not append in function parameter name
- fix: `.value` should not append in object property assignment name
- perf: reuse template compile result

## 0.26.11

- feat: support for workspace trust
- feat: support config for HTML formatting print width by `volar.formatting.printWidth` option ([#321](https://github.com/johnsoncodehk/volar/issues/321))
- feat: support for typescript `updateImportsOnFileMove` setting to disable prompt ([#332](https://github.com/johnsoncodehk/volar/issues/332))
- feat: add "Show in Browser" button to component preview
- fix: `<input>`, `<textarea>`, `<select>` v-model prop name shoud be `value`
- fix: component preview not working on windows
- fix: delete file can't trigger related scripts diagnostics update
- fix: disable component tag type-checking to avoid some unable fix edge cases ([#333](https://github.com/johnsoncodehk/volar/issues/333))

## 0.26.10

- chore: refactor `@volar/server` API and released `@volar/server`
- perf: remove `vscode.css-language-features` and `vscode.html-language-features` rely ([vscode#98621](https://github.com/microsoft/vscode/issues/98621))
- fix: `.value` should not append in function declaration name and literal type
- fix: update extra virtual files before check virtual file exist ([#326](https://github.com/johnsoncodehk/volar/issues/326))
- fix: convert tag name case command not working

## 0.26.9

- feat: improve for slot name type-check
- feat: experimental component preview
- feat: improve template code finder ([#208](https://github.com/johnsoncodehk/volar/issues/208))
- feat: add refresh webview button
- fix: hover request failed with jsdoc `@link`
- fix: prevent null emmet configs ([#247](https://github.com/johnsoncodehk/volar/issues/247))

## 0.26.8

- feat: remove import type checking for `<script setup>` ([#325](https://github.com/johnsoncodehk/volar/issues/325))
- feat: add ref sugar deprecated message
- fix: goto definition not working for `lang="js"` target without allowJs

## 0.26.7

- feat: support formatting in v-for expressions
- feat: change interpolation braces syntax token
- fix: fixed a few problems when goto definition to import file path
- fix: `<script lang="x">` change should update template verification
- perf: faster diagnostics

## 0.26.6

- feat: support component auto-import with empty script block ([#232](https://github.com/johnsoncodehk/volar/issues/232))
- feat: disable template type-checking with `<script lang="js">` ([#46](https://github.com/johnsoncodehk/volar/issues/46))
- fix: remove missing deps ([vue-tsc#45#issuecomment-882319471](https://github.com/johnsoncodehk/vue-tsc/issues/45#issuecomment-882319471))
- fix: change TS library file rely from tsserver.js to tsserverlibrary.js
- fix: css references codeLens broken
- fix: TS completion resolve failed with jsdoc link
- fix: convert tag name case failed edge case

## 0.26.5

- feat: add remove all ref sugar command
- feat: improve ref sugar remove tool
- fix: fixed find references never finish edge cases
- fix: template type-checking not working with `<script lang="js">` ([#319](https://github.com/johnsoncodehk/volar/issues/319))
- fix: definition selection range incorrect
- fix: fixed monorepo project alway pop warning
- fix: preset empty object if can't get TS settings ([#316](https://github.com/johnsoncodehk/volar/issues/316))

## 0.26.4

- feat: update supports for vscode 1.58
- refactor: remove formatters deps for `vue-tsc`
- fix: script block virtual script language incorrect (should not force to `ts`)
- fix: goto definition broken with ref sugar

## 0.26.3

- feat: support FunctionalComponent events type-check
- feat: support for TS setttings (for TS preferences, formatOptions)
- fix: withDefaults props type incorrect in template
- fix: downgrade `@vue/compiler-sfc` to fix template range for formatting, codeLens
- fix: handle SFC parse failed for component auto-import
- fix: semanticTokens search range incorrect


## 0.26.2

- fix: fixed a few TS semanticTokens problems
- fix: namespace imports should expose to template ([#311](https://github.com/johnsoncodehk/volar/issues/311))
- fix: events auto-complete names incorrect with `attr: pascalCase` config ([#312](https://github.com/johnsoncodehk/volar/issues/312))
- fix: validation for "virtual script exist" not working
- fix: TS completion documentation incomplete
- perf: fix can't reuse old TS program if `<script lang="js">` exist since 0.26.0

## 0.26.1

- fix: fixed a few TS renaming, find referenecs problems
- fix: first time *.vue file change can't effect *.ts diagnostics

## 0.26.0

- feat: split TS language service to script TS language service and template TS language service ([#94](https://github.com/johnsoncodehk/volar/issues/94)) ([#253](https://github.com/johnsoncodehk/volar/issues/253))
- fix: optional props type incorrect in `<script setup>` ([#302](https://github.com/johnsoncodehk/volar/issues/302))
- fix: formatting make double spacing in empty pug template block ([#304](https://github.com/johnsoncodehk/volar/issues/304))
- fix: fixed callHierarchy request failed if skip prepare request

## 0.25.28

- feat: improve `volar.autoCompleteRefs` and make it out of experimental ([#201](https://github.com/johnsoncodehk/volar/issues/201))
- fix: ref sugar not working with nullish coalescing operator ([#291](https://github.com/johnsoncodehk/volar/issues/291))

## 0.25.27

- fix: hover broken with jsdoc @link tag ([#289](https://github.com/johnsoncodehk/volar/issues/289))
- fix: prop type incorrect in template with `withDefaults()` ([#290](https://github.com/johnsoncodehk/volar/issues/290))

## 0.25.26

- feat: support `withDefaults()` in `<script setup>`
- feat: expose `<script>` variables to template in `<script setup>`
- feat: change defineEmit to defineEmits in `<script setup>` (defineEmit still support a period of time)
- fix: improve event type infer ([#286](https://github.com/johnsoncodehk/volar/issues/286)) ([#287](https://github.com/johnsoncodehk/volar/issues/287))
- fix: improve empty attribute type infer ([#288](https://github.com/johnsoncodehk/volar/issues/288))

## 0.25.25

- fix: can't assign expression to no args event ([#270](https://github.com/johnsoncodehk/volar/issues/270))
- fix: empty attr type incorrect ([#261](https://github.com/johnsoncodehk/volar/issues/261))
- fix: completion resolve broken in TS 3.4

## 0.25.24

- fix: prevent throw error with unknown tag's properties ([#284](https://github.com/johnsoncodehk/volar/issues/284))
- fix: add patch for `<script src>` TS file path ([vue-tsc#30](https://github.com/johnsoncodehk/vue-tsc/issues/30))

## 0.25.23

- feat: expose ClassDeclaration, EnumDeclaration from `<script setup>` ([#274](https://github.com/johnsoncodehk/volar/issues/274))
- fix: template context broken with `<script lang="tsx">` ([#275](https://github.com/johnsoncodehk/volar/issues/275))
- fix: don't convert source code to unicode with component auto-import ([#272](https://github.com/johnsoncodehk/volar/issues/272))
- fix: don't infer `update:xxx` event type by props ([#266](https://github.com/johnsoncodehk/volar/issues/266))
- fix: functional component type-check behavior inconsistent with JSX ([#268](https://github.com/johnsoncodehk/volar/issues/268))

## 0.25.22

- feat: improve TS diagnostic message ([#259](https://github.com/johnsoncodehk/volar/issues/259))
- fix: incorrect unescaping of literal strings ([#262](https://github.com/johnsoncodehk/volar/issues/262))
- fix: dynamic slot name do not consume variable ([#263](https://github.com/johnsoncodehk/volar/issues/263))
- fix: temporary html completion info leak to hover info
- fix: TS definition result duplicate

## 0.25.21

- feat: support for typescript pnp ([#248](https://github.com/johnsoncodehk/volar/issues/248))
- feat: improve component auto-import path calculate
- fix: `Write Virtual Files` command not working

## 0.25.20

- fix: remove `fs-extra` to fix `at-least-node` module missing

## 0.25.19

- feat: support json schema request service ([#243](https://github.com/johnsoncodehk/volar/issues/243))
- feat: support shortest component auto-import path ([#233](https://github.com/johnsoncodehk/volar/issues/233))
- fix: component auto-import not working with dash ([#249](https://github.com/johnsoncodehk/volar/issues/249))
- fix: fix some `Cannot read property ...` errors ([#247](https://github.com/johnsoncodehk/volar/issues/247)) ([#251](https://github.com/johnsoncodehk/volar/issues/251))
- fix: syntax highlighting not working for `lang="jsx"`
- fix: folding not working for jsx ([#234](https://github.com/johnsoncodehk/volar/issues/234))

## 0.25.18

- fix: fix vue-tsc build failed

## 0.25.17

- feat: support for change TS version by `typescript.tsdk` option ([#224](https://github.com/johnsoncodehk/volar/issues/224))
- feat: support for TS 4.3
- fix: auto import component should prior choice `<script setup>`
- fix: disable component auto import if no any `<script>` block

## 0.25.16

- fix: language server broken with incorrect module importing

## 0.25.15

- feat: auto import component in template ([#194](https://github.com/johnsoncodehk/volar/issues/194))
- feat: filter duplicate event modifiers completion
- fix: path completion not working for `<script src>` without `lang="ts"` ([#223](https://github.com/johnsoncodehk/volar/issues/223))

## 0.25.14

- feat: add option to hide the split icon at the top right corner ([#195](https://github.com/johnsoncodehk/volar/issues/195))
- feat: add ts plugin description link in ts plugin menu
- fix: file icons are emptied when importing ([#198](https://github.com/johnsoncodehk/volar/issues/198))
- fix: css prepareRename range incorrect if no `<template>` ([#212](https://github.com/johnsoncodehk/volar/issues/212))
- fix: don't report `lang="ts"` missing if script content is empty ([#215](https://github.com/johnsoncodehk/volar/issues/215))
- fix: ts plugin features broken with json script kind [0386094](https://github.com/johnsoncodehk/volar/commit/038609477093911674cf842e3650bc8daf4d733d)
- fix: component rename breaks the component source file ([#206](https://github.com/johnsoncodehk/volar/issues/206))
- fix: emmet should not working in template expression interpolations

## 0.25.13

- fix: add patching for a serious TS freeze bug ([#205](https://github.com/johnsoncodehk/volar/issues/205)) ([vscode#124561](https://github.com/microsoft/vscode/issues/124561))

## 0.25.12

- feat: support props type override ([#202](https://github.com/johnsoncodehk/volar/issues/202#issuecomment-846670594))
- fix: support `<component :is>` type-checking with VNode ([vue-tsc#34](https://github.com/johnsoncodehk/vue-tsc/issues/34))
- fix: cannot find module 'upath' with pnpm ([#204](https://github.com/johnsoncodehk/volar/issues/204))

## 0.25.11

- feat: support find definition in `*.ts` even ts plugin disabled
- feat: new experimental preview feature
- fix: `<script setup>` component name incorrect
- fix: inline style breaks SFC syntax highlighting ([#199](https://github.com/johnsoncodehk/volar/issues/199))

## 0.25.10

- fix: `<template>` tag child nodes syntax highlighting broken

## 0.25.9

- feat: support recursive components for `<script setup>`
- fix: improve type-checking for `<component :is>` ([#196](https://github.com/johnsoncodehk/volar/issues/196))
- fix: fix `<template>` block syntax highlighting broken edge cases ([#192](https://github.com/johnsoncodehk/volar/issues/192#issuecomment-845089387))

## 0.25.8

- feat: support for `<component :is>` type-checking

## 0.25.7

- 🎉 feat: support for named recursive components ([#190](https://github.com/johnsoncodehk/volar/issues/190))

## 0.25.6

- fix: custom events type-checking broken
- perf: optimize get script version ([#186](https://github.com/johnsoncodehk/volar/issues/186))

## 0.25.5

- feat: improve UX for TS plugin status bar
- feat: support syntax highlighting for `lang="json"`, `lang="jsonc"`, `lang="yaml"`, `lang="md"` ([#127](https://github.com/johnsoncodehk/volar/issues/127))
- feat: support validation for `lang="json"`, `lang="jsonc"`
- feat: support emmet for JSX, TSX ([#184](https://github.com/johnsoncodehk/volar/issues/184))
- fix: fix template syntax highlighting broken edge cases
- fix: fix auto-import not working edge cases
- fix: should not have auto-import from virtual files
- fix: native events types incorrect if component do not have emits option ([#180](https://github.com/johnsoncodehk/volar/issues/180))

## 0.25.4

- feat: improve embedded languages syntax highlight
- feat: support html snippets in template
- feat: add create workspace snippets command
- fix: pug autocomplete broken with class attribute ([#177](https://github.com/johnsoncodehk/volar/issues/177))

## 0.25.3

- perf: fix pug semantic tokens performance loophole ([#162](https://github.com/johnsoncodehk/volar/issues/162))
- feat: released `typescript-vue-plugin` ([#169](https://github.com/johnsoncodehk/volar/issues/169))
- fix: split editors icon size incorrect ([#170](https://github.com/johnsoncodehk/volar/issues/170))

## 0.25.2

- feat: improve component tag hover info
- feat: improve component types for `export default { ... }`
- feat: support for generic functional component

## 0.25.1

- feat: move "Start Split Editing Mode" to command
- fix: props auto-complete not working
- fix: fix released npm package size

## 0.25.0

- feat: split status bar item `<TagName attr-name>` to `Tag: xxx`, `Attr: xxx`
- fix: tag name case status bar item not working on start
- fix: `<style module>` class name renaming result incorrect
- fix: hyphenat component renaming not working
- fix: ref sugar renaming result incorrect with destructure
- fix: ref sugar renaming not working on right expression

## 0.24.6

- 🎉 feat: support find references in `*.ts` even ts plugin disabled
- fix: `Set<any>` item type incorrect in `v-for`
- fix: server initializing progress not working
- fix: add patching for `@vue/composition-api` event types for now

## 0.24.5

- fix: css hover quick info not working
- perf: don't send source map to lsp protocol to avoid json parse

## 0.24.4

- feat: support path completion for template languages (html, pug)
- feat: support path completion for style languages (css, less, scss, postcss)
- feat: support css code action
- feat: dynamic resolve url links in css
- fix: filter invalid component names [#159](https://github.com/johnsoncodehk/volar/issues/159)
- fix: css completion broken
- fix: don't increase indent on `<script>`, `<style>`

## 0.24.3

- feat: new IDE option `volar.preferredAttrNameCase`
- feat: support change props completion name case in status bar
- fix: component tag name case conversion not working edge case
- perf: fix html completion should not calculate every times typing

## 0.24.2

- feat: new IDE option `volar.preferredTagNameCase` [#156](https://github.com/johnsoncodehk/volar/issues/156)
- feat: new status bar item for support change completion tag name case
- feat: component tag name case conversion
- feat: support adding breakpoints [#107](https://github.com/johnsoncodehk/volar/issues/107)
- fix: don't report error if class name does not exist in `$style` [#157](https://github.com/johnsoncodehk/volar/issues/157)
- fix: don't complete attribute value for `v-else`, `scoped`, `module`, `setup`
- revoke: remove `Volar: Format All Scripts` command (use [Format All Files in Workspace](https://marketplace.visualstudio.com/items?itemName=alexr00.formatallfilesinworkspace) extension for replacement)

## 0.24.1

- fix: ref sugar report incorrect errors on `vue-tsc` [vue-tsc#18](https://github.com/johnsoncodehk/vue-tsc/issues/18)
- fix: `<slot>` should not report error with `defineComponent(function () { ... })` [vue-tsc#21](https://github.com/johnsoncodehk/vue-tsc/issues/21)

## 0.24.0

- feat: new option `Don't care` for TS plugin by default to reduce reload vscode
- feat: check variables is valid returns for `<script setup>`
- fix: pug template checking broken with vue-tsc [vue-tsc#14](https://github.com/johnsoncodehk/vue-tsc/issues/14)
- fix: emmet completion working incorrectly [#135](https://github.com/johnsoncodehk/volar/issues/135)
- fix: import path completion replace range incorrect
- fix: define slot props as const
- perf: faster typescript diagnosis response

**Breaking changes**

See: https://github.com/johnsoncodehk/volar/discussions/134

- feat: unsupport `volar.style.defaultLanguage` option
- feat: unsupport `@vue-ignore`

## 0.23.7

- feat: improve type-checking of dynamic slot
- chore: simplify `v-on` modifiers completion label

## 0.23.6

- feat: event modifiers auto-complete [#126](https://github.com/johnsoncodehk/volar/issues/126)
- fix: `v-else-if` type narrowing not works in last branch [#130](https://github.com/johnsoncodehk/volar/issues/130)

## 0.23.5

- feat: improve types infer without defineComponent [#59](https://github.com/johnsoncodehk/volar/issues/59)
- fix: handle readonly array in `v-for`
- fix: template context not update on completion
- perf: don't update project version if document content no changes

## 0.23.4

- fix: vnode hooks typing broken in template
- fix: global components typing broken if no `<script>` block
- fix: local components typing broken with pnpm [#123](https://github.com/johnsoncodehk/volar/issues/123)
- fix: init progress broken
- perf: reuse import suggestions cache

## 0.23.3

- fix: `<script setup>` components unused report incorrect [#122](https://github.com/johnsoncodehk/volar/issues/122)
- fix: unused cache to fix completion resolve crash edge cases

## 0.23.2

- fix: `v-if` intellisense not working
- fix: type-only `defineProps` declarations broke template intellisense [#121](https://github.com/johnsoncodehk/volar/issues/121)

## 0.23.1

- perf: faster intellisense for `<script setup>`
- fix: ref sugar variables types incorrect edge case

## 0.23.0

- 🎉 feat: new split editing mode
- feat: auto import path preview
- fix: remove typescript hover info from `<style scoped>` classes
- perf: faster auto-complete and completion resolve

**Breaking changes**

- feat: unsupported global component by `app.component(...)` calls, see: https://github.com/johnsoncodehk/volar#using

## 0.22.29

- fix: fix diagnostics shaking
- fix: events hover info not working if no expression
- fix: template diagnosis response delay

## 0.22.28

- fix: reduce diagnostics shaking
- fix: only diagnosis import variables in `<script setup>` return

## 0.22.27

- feat: report error if import type in `<script setup>` incorrectly
- perf: `<script setup>` performance small improvement
- fix: allow `ref:` declarations without initialized
- fix: export assignment intellisense not working if `<script setup>` exist

## 0.22.26

- feat: improve events hover info
- feat: support pug new line syntax `\` [#118](https://github.com/johnsoncodehk/volar/issues/118)
- fix: `v-for` not working with `v-slot` [#110](https://github.com/johnsoncodehk/volar/issues/110)
- fix: completion detail not working when keep typing

## 0.22.25

- feat: support pass props as `v-bind="..."` syntax [vue-tsc#9](https://github.com/johnsoncodehk/vue-tsc/issues/9)
- feat: support use not compiled `@vue/runtime-dom` library
- fix: `defineEmit()` types incorrect in template if use pure type define
- perf: improve virtual documents update performance

## 0.22.24

- feat: improve `v-for` type-checking [#117](https://github.com/johnsoncodehk/volar/issues/117)
- feat: improve events type-checking [#116](https://github.com/johnsoncodehk/volar/issues/116)
- feat: support `"noUncheckedIndexedAccess": true` [vue-tsc#8](https://github.com/johnsoncodehk/vue-tsc/issues/8)
- fix: auto-complete duplicate in `v-model="..."`

## 0.22.23

- feat: sfc parse diagnostics
- feat: improve v-slot support
- fix: `vue-tsc` throw on `component()` call without string literal
- fix: kebab case slots not working
- chore: update vue to 3.0.9 to fix a few bugs

## 0.22.22

- feat: improve props js doc hover info
- feat: improve component recognition
- fix: don't patch diagnostics without postcss
- fix: handle `documents.onDidChangeContent` send incorrect file name
- fix: html hover info not working

## 0.22.21

- fix: diagnostics should update if tsconfig.json update
- fix: fix style attributes duplicate error [#109](https://github.com/johnsoncodehk/volar/issues/109)
- fix: patch postcss diagnostics [#103](https://github.com/johnsoncodehk/volar/issues/103)

## 0.22.20

- fix: handle file name is `Foo.vue` but LSP send `file:///.../foo.vue`
- fix: fix lsp not working on monorepo edge case

## 0.22.19

- fix: pug tag less element mapping incorrect
- fix: extra hover info duplicate
- fix: error when hovering the slot bindings

## 0.22.18

- feat: props jsdoc support
- fix: emmet not working for inline css

## 0.22.17

- fix: use `for...in` instead of `for...of` to v-for

## 0.22.16

- fix: extra files watcher not working on windows
- fix: vue-tsc not working on windows

## 0.22.15

- feat: improve v-for type-checking
- chore: disabled declaration diagnostics for now to avoid monorepo performance issue

## 0.22.14

- fix: emit declaration diagnostics with declaration option
- chore: improve extra files watcher

## 0.22.13

- feat: watch extra files update
- fix: cannot find global properties if no `<script>` block
- fix: project verification not working

## 0.22.12

- fix: cannot find name for text attribute

## 0.22.11

- feat: script refactors, source actions, organize imports support
- perf: improve monorepo memory using
- fix: text attribute auto-complete not working
- fix: declaration diagnostics missing
- fix: typescript diagnostic related Information unhandled

## 0.22.10

- perf: improve monorepo memory using
- feat: remove emit dts feature

## 0.22.9

- fix: props auto-complete not working for vue 2 and nuxt
- fix: `@vue/runtime-dom` missing checking not working

## 0.22.8

- revert: "fix: ignore script content if script src is exist"

## 0.22.7

- fix: script src mapping incorrect if script content is empty
- fix: ignore script content if script src is exist

## 0.22.6

- fix: semantic token incorrect if tag name in component context

## 0.22.5

- fix: quick fix not working in `<script setup>` if no import statement
- fix: typescript code fixes throw if import path not exist

## 0.22.4

- fix: diagnosis not working for windows vscode 1.54.1

## 0.22.3

- fix: ts plugin vue files missing edge case
- fix: go to definition for 'vue' import not working

## 0.22.2

- fix: vue language service broke by vscode 1.54.1
- fix: 'vue' module auto-import broke by vscode 1.54.1 (ts 4.2.2)
- chore: improve vue 2 warning message (Thanks to @posva !)

## 0.22.1

- fix: code fix affect by virtual code
- fix: don't always ask refactoring when move vue file
- fix: ts auto-complete replace range incorrect

## 0.22.0

- feat: new apis for command line type-checking support (https://github.com/johnsoncodehk/vue-tsc)
- feat: support for event handlers in kebab-case
- feat: improve ts plugin status color
- feat: typescript quick fix
- fix: remove incorrect location from component options definition result
- fix: language server crash with `ref: in`
- chore: update display name

## 0.21.20

- feat: added default `<style>` tag language config

## 0.21.19

- fix: textDocumet/formatting fails with stylus and sass

## 0.21.18

- feat: sass language support
- feat: stylus language support

## 0.21.17

- feat: auto-indent in template section support
- feat: multi-root workspaces support
- fix: should not throw when edit untitled vue documents
- fix: type checking doesn't work for components written in .ts files

## 0.21.16

- fix: can't reference .vue file out of rootDir

## 0.21.15

- fix: v-on type-checking not working with function assign

## 0.21.14

- feat: rename fail message
- fix: revert narrowed type patch for v-on
- fix: event type incorrect if given `null` (for example: `emits: { foo: null }`)

## 0.21.13

- fix: ignore `postcss(unknownAtRules)`
- fix: postcss completion word range
- fix: v-on expression should not affect variables types in template

## 0.21.12

- feat: postcss language support (required [language-postcss](https://marketplace.visualstudio.com/items?itemName=cpylua.language-postcss) for syntax highlighting)
- fix: `lang="ts"` missing should not throw error

## 0.21.11

- fix: nameless slot not working

## 0.21.10

- fix: definition selection range not working for global components
- fix: auto-complete word range incorrect

## 0.21.9

- feat: component tag auto-complete info in template
- feat: ts definition selection range
- fix: script block should not have emmet auto-complete
- perf: fix some performance issues

## 0.21.8

- fix: sometime emmet completion missing
- fix: auto-complete throw error [#65](https://github.com/johnsoncodehk/volar/issues/65)

## 0.21.7

- fix: auto import `*.vue` not working

## 0.21.6

- fix: `<script setup>` unused report not working if no any `import` statement
- fix: narrowed type by v-if should not be widened in v-on
- fix: `:style` type check not working
- fix: scoped class name references should not have hover info

## 0.21.5

- fix: tsconfig parsing for ts plugin incorrect

## 0.21.4

- feat: `vue.d.ts` emit support
- fix: events type-checking not working for array emits define

## 0.21.3

- fix: slot name expression types incorrect

## 0.21.2

- feat: support slot name expression

## 0.21.1

- feat: show reload button on switch ts plugin
- fix: ts plugin status not sync on dropdown menu

## 0.21.0

- feat: props `@update` event support
- feat: `v-model="..."` support
- feat: ts plugin status bar item
- fix: improve events type-checking
- fix: tsconfig update not working for ts plugin
- fix: ref sugar variables hover info incorrect
- fix: services not working for hyphenate events
- fix: don't show confirm box if no import will change on move file
- fix: props rename references should keep with hyphenate

## 0.20.9

- feat: emit event type not matching warning
- feat: ts plugin support (default is disabled, run `Volar: Switch TS Plugin` to enable)
- fix: typescript auto-complete should not replace suffix
- chore: emit overloads infer nums 2 -> 4
- chore: switch auto `.value` feature to default disabled

## 0.20.8

- fix: `.value` auto-complete should not occur at definition
- fix: multi-line pug attribute not working
- fix: pug-html convert tool should not convert to pug class literal if exist illegal characters

## 0.20.7

- fix: inline css service broke in pug

## 0.20.6

- 🎉 feat: better pug support (https://github.com/johnsoncodehk/volar/projects/1#card-50201163)
- feat: improve html -> pug convert
- fix: `.value` auto-complete not working if typing inside `()`

## 0.20.5

- fix: `.value` auto-complete corner case
- feat: enabled `.value` auto-complete in .ts

## 0.20.4

- feat: auto close tag delay 0ms -> 100ms
- feat: auto-complete ref value with `.value` (Experimental)

## 0.20.3

- feat: localized typescript diagnostics
- feat: report errors count with `Verify All Scripts` command
- feat: show warning notification if project invalid (Thanks to @IWANABETHATGUY !)

## 0.20.2

- fix: `<script setup>` props rename broke
- fix: inline css service broke

## 0.20.1

- fix: ref sugar broke in 0.20.0

## 0.20.0

- feat: import path renaming
- feat: refactor import path on rename file
- feat: options to disable codeLens
- feat: verification before renaming
- perf: incremental update server documents (Thanks to @IWANABETHATGUY !)
- fix: accurate ref sugar renaming
- fix: ref sugar should convert with type args

## 0.19.16

- fix: remove incorrect props hover info
- fix: file name parsing incorrect with `[]` characters

## 0.19.15

- feat: support global component with `component(..., defineAsyncComponent(...))`
- feat: preview client improve
- fix: js files should handle in language server

## 0.19.14

- feat: `@vue-ignore` support
- fix: don't diagnose `lang="sass"`, `lang="stylus"` with css language

## 0.19.13

- feat: preview client (experimental)

## 0.19.12

- fix: ref sugar unused report incorrect with `noUnusedLocals` enabled

## 0.19.11

- fix: should not support old `<script setup>` declare props, emit, slots
- fix: should not allow export keywords in `<script setup>`
- fix: ref sugar right side expression services duplicate
- fix: ref sugar references semantic token incorrect

## 0.19.10

- feat: ref sugar hover info add dollar variable
- fix: ref sugar autocomplete not working for `ref: { | } = foo()`
- fix: ref sugar goto definition not working for `ref: { | } = foo()`
- fix: ref sugar semantic token not working

## 0.19.9

- fix: language server broke with monorepo tsconfig.json (outDir + rootDir + composite/incremental)

## 0.19.8

- feat: show underscore with css scoped classes
- fix: css scoped classes definition goto wrong place if define in import file
- fix: FunctionalComponent services not working with `setup()` return

## 0.19.7

- feat: `<script src>` support

## 0.19.6

- fix: prop types incorrect if duplicate name with HTMLAttributes
- fix: symbols outline incorrect

## 0.19.5

- feat: add split editors button
- feat: improve split editors
- fix: `<template lang="pug">` block folding not working with `>` character

## 0.19.4

- feat: split editors

## 0.19.3

- fix: component props auto complete broke
- fix: interpolation formatting incorrect edge case
- chore: remove unneeded files to reduce extension size

## 0.19.2

- fix: ref sugar variables unused report incorrect
- fix: `@click` type check not working for non native elements

## 0.19.1

- fix: css class references codeLens broke

## 0.19.0

- feat: unsupported workspaceExtensions formatter
- feat: unsupported old `<script setup>`
- fix: references codeLens should not counting itself
- fix: hyphenate format slot name have duplicate references codeLens
- fix: `<script setup>` unused checking not working for `"noUnusedLocals": true`

## 0.18.17

- feat: server init progress
- feat: vue block completion
- fix: tsconfig.json update not working
- fix: __VLS_GlobalComponents not working if no `<script>` block
- fix: element tag mapping incorrect corner case

## 0.18.16

- feat: codeLens for `app.component(...)`
- feat: codeLens for slots
- fix: css codeLens location incorrect corner case

## 0.18.15

- fix: `<script setup>` unused variables report broke with html

## 0.18.14

- fix: `<script setup>` variables should report unused when use as component

## 0.18.13

- feat: unused variables report for `<script setup>`
- fix: `<script setup>` imports should not have global completion

## 0.18.12

- feat: pnpm support
- feat: unlimited emits overloads support
- fix: formatting remove `export default {}` if exist two `<script>` block

## 0.18.11

- fix: ref sugar variable define diagnostic not working
- fix: `ref: foo = false` should be `boolean` not `false` type in template
- fix: ref sugar convert tool fail with `()`

## 0.18.10

- fix: props services fail for `DefineComponent<...>` declare component

## 0.18.9

- fix: folding ranges not working in `<script setup>` block

## 0.18.8

- feat: improve pug diagnosis
- fix: find emits references not working with hyphenate
- fix: hover info not working for hyphenate component tag tail
- pert: faster script setup gen
- perf: faster pug mapper

## 0.18.7

- chore: change component tag hover info
- fix: filter same html tag in completion
- fix: ctx properties types incorrect corner cases
- fix: should not detect all ctx properties as component
- fix: `@click` event type check broke

## 0.18.6

- feat: rollback typescript diagnostic modes
- perf: faster diagnostics

## 0.18.5

- feat(experiment): added a new typescript diagnostic mode and default enabled (not prompt for unused variables)
- fix: `foo=""` attribute should not detect as `true` type

## 0.18.4

- fix: script formatting broke
- fix: when return `foo: foo as true` in setup(), template context should get `foo: true` not `foo: boolean`

## 0.18.3

- fix: interpolations formatting indent broke

## 0.18.2

- fix: interpolations formatting broke
- fix: props missing checking not working for non hyphenate component
- perf: emit overloads support nums 16 -> 4 (faster template diagnostics when using v-on)

## 0.18.1

- perf: faster template diagnostics

## 0.18.0

- feat: [Linked Editing](https://code.visualstudio.com/updates/v1_44#_synced-regions)
- fix: script not found error not working for `<script setup>`

## 0.17.7

- chore: rename extension in marketplace [#35](https://github.com/johnsoncodehk/volar/discussions/35)

## 0.17.6

- fix: ref sugar variable renaming no effect to template
- fix: `v-else-if` semantic token
- perf: split `<script>` and `<template>` to speed up current editing block diagnostics

  > when editing `<script>`, `<template>` block delay 1000ms make diagnosis

  > when editing `<template>`, `<script>` block delay 1000ms make diagnosis

## 0.17.5

- perf: faster default formatter
- perf: faster diagnostics

## 0.17.4

- fix: can't disable html mirror cursor
- feat: improve folding range

## 0.17.3

- feat: improve html mirror cursor
- feat: improve default formatter

## 0.17.2

- fix: `<script setup>` crash corner cases
- fix: diagnostic feature was accidentally disabled in v0.17.1

## 0.17.1

- perf: prevent auto close tag blocked by autocomplete
- perf: faster semantic tokens

## 0.17.0

- feat: ts semantic tokens
- feat: faster auto close tag
- chore: remove icon avoid it like a virus in marketplace

## 0.16.15

- perf: prevent semantic tokens request block autocomplete request (occurred in 0.16.4)
- feat: improve ts autocomplete

## 0.16.14

- feat: pure type defineEmit() syntax support
- feat: increase support emits overloads nums to 16
- fix: pure type defineProps properties required incorrect
- fix: monorepo services can't update cross root scripts
- fix: `<script setup>` formatting broke in 0.16.13

## 0.16.13

- fix: crash if allowJs not set and working on js script block
- fix: crash with user action when server not ready

## 0.16.12

- feat: html mirror cursor

## 0.16.11

- feat: support directives syntax `:=`, `@=`, `#=`
- fix: v-slot bind properties missing attribute values
- fix: template validation broke with v-slot bind properties
- fix: slot services disturbed slot element hover info

## 0.16.10

- feat: reference, rename, definition support to js

## 0.16.9

- feat: template validation support to js
- fix: should not error when css class not exist
- fix: inline style hover info wrong mapping

## 0.16.8

- feat: slot name services (find references, goto definition, diagnostic, completion, hover info)

## 0.16.7

- fix: call graph links incomplete

## 0.16.6

- fix: find references crash in node_modules files

## 0.16.5

- feat: restart server command
- fix: auto import not working for .vue files

## 0.16.4

- fix: can't use export default with `<script>` when `<script setup>` exist
- fix: auto import items should not show virtual files
- fix: style attr services broke
- fix: v-for elements types incorrect
- refactor: sensitive semantic tokens update

## 0.16.3

- feat: inline css service within `<template>`

## 0.16.2

- fix: `<script setup>` formatting wrongly replace `ref:` to `ref`

## 0.16.1

- fix: fix some Call Hierarchy failed cases
- perf: faster typescript language service for new `<script setup>`

## 0.16.0

- feat: [Call Hierarchy](https://code.visualstudio.com/updates/v1_33#_call-hierarchy) support
- feat: auto declare `__VLS_GlobalComponents` by `app.component()` calls

## 0.15.x

TODO
