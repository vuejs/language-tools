# Changelog

## 0.34.9

- fix: vue documents diagnostics cannot update when other drive ts file changed
- fix: ts declaration diagnostics missing ([#1222](https://github.com/johnsoncodehk/volar/issues/1222))

## 0.34.8

- feat: support inlay hints ([#452](https://github.com/johnsoncodehk/volar/pull/452))
  - if you're not using VSCode, you should config new option `languageFeatures.inlayHints = true` in initializationOptions to enable it
- feat: allow disable highlight dom elements on preview ([#1209](https://github.com/johnsoncodehk/volar/issues/1209))
- feat: improve dom elements highlight display refresh
- fix: `typescript.format.semicolons` should not affect text interpolation ([#1210](https://github.com/johnsoncodehk/volar/issues/1210))
- fix: vscode settings cannot update for document features ([#1210](https://github.com/johnsoncodehk/volar/issues/1210))
- fix: `{{ { foo } }}` object literal expression not working on text interpolations
- fix: cannot infer event type with prop name format `onFoo-bar` ([#1023](https://github.com/johnsoncodehk/volar/issues/1023))
- fix: scoped class references not accurate on long document ([#1059](https://github.com/johnsoncodehk/volar/issues/1059))
- fix: cannot update unediting vue document diagnostics ([#1163](https://github.com/johnsoncodehk/volar/issues/1163))
- fix: emmet not working in style block ([#1145](https://github.com/johnsoncodehk/volar/issues/1145))
- fix: nuxt preview not working on windows ([#1123](https://github.com/johnsoncodehk/volar/issues/1123))

## 0.34.7

- feat: add option `experimentalShamefullySupportOptionsApi` to vueCompilerOptions ([#1202](https://github.com/johnsoncodehk/volar/issues/1202))
- fix: use html renaming instead of ts renaming on tags ([#1201](https://github.com/johnsoncodehk/volar/issues/1201))
- fix: not support lowser node version ([#1200](https://github.com/johnsoncodehk/volar/issues/1200))
- fix: cannot update global components props completion list ([#1196](https://github.com/johnsoncodehk/volar/issues/1196))
- fix: `svg` attributes report false positive void type ([#1184](https://github.com/johnsoncodehk/volar/issues/1184))
- fix: css module types missing on template context ([#1178](https://github.com/johnsoncodehk/volar/issues/1178))
- fix: false positive error with withDefaults + "strictNullChecks": false ([#1187](https://github.com/johnsoncodehk/volar/issues/1187))

**Breaking changes**
- sass formatter is moved to external plugin: https://github.com/johnsoncodehk/volar-plugins/tree/master/packages/sass-formatter

## 0.34.6

- feat: add prompt for `"jsx": "preserve"` missing
- fix: auto-complete break language server if `"jsx": "preserve"` missing ([#1171](https://github.com/johnsoncodehk/volar/issues/1171))
- fix: typescript plugin extension not working ([#1173](https://github.com/johnsoncodehk/volar/issues/1173))
- fix: code action not working on *.ts with take over mode ([#1169](https://github.com/johnsoncodehk/volar/issues/1169))
- fix: object computed property name report false positive error in template ([#1176](https://github.com/johnsoncodehk/volar/issues/1176))
- fix: should count variable uses with ref attribute ([#1168](https://github.com/johnsoncodehk/volar/issues/1168))

## 0.34.5

- feat: preset `"jsx": "preserve"` for non-tsconfig project
- fix: avoid template report errors if `"jsx": "preserve"` missing ([#1161](https://github.com/johnsoncodehk/volar/issues/1161))
- fix: attrs auto-complete and tag highlight incorrect on js project ([#1158](https://github.com/johnsoncodehk/volar/issues/1158))
- fix: script setup report false positive error with defineExpose type arg ([#1165](https://github.com/johnsoncodehk/volar/issues/1165))

**Breaking changes**

- `@volar/pug-language-service` now is a optional depend on vue-tsc, you need to install it additionally to support pug template type-checking on vue-tsc ([#1092](https://github.com/johnsoncodehk/volar/issues/1092))

## 0.34.4

- fix: script setup report false positive error with multi-line interpolation
- fix: object spread assignment not working in template
- fix: html formatting result incorrect

## 0.34.3

- feat: release `@volar/preview` for support vite, nuxt 3 app preview features other then vscode IDEs ([#1115](https://github.com/johnsoncodehk/volar/issues/1115))
- fix: `require()` should not report error in template ([#1161](https://github.com/johnsoncodehk/volar/issues/1161))
- fix: template interpolations syntax broken with inline block comments ([#1143](https://github.com/johnsoncodehk/volar/issues/1143))
- fix: vue-tsc emit declaration diagnostics incomplete ([#1127](https://github.com/johnsoncodehk/volar/issues/1127))
- fix: ts plugin should not affect to non-vue project ([#1144](https://github.com/johnsoncodehk/volar/issues/1144))
- fix: object literal santax not working in directive and v-for expressions ([#1160](https://github.com/johnsoncodehk/volar/issues/1160))
- fix: shorthand property assignment santax not working in template ([#1156](https://github.com/johnsoncodehk/volar/issues/1156))
- fix: should not emit `__VLS_` files file with `vue-tsc --declaration --emitDeclarationOnly`
- fix: `experimentalDisableTemplateSupport` not working
- fix: formatting crashes with inline v-bind on scoped v-slot ([#1151](https://github.com/johnsoncodehk/volar/issues/1151))
- fix: language server broken in js project without allowJs

**Breaking changes**

- Changed `experimentalResolveNonScopedCssClasses` to `experimentalResolveStyleCssClasses` ([#1121](https://github.com/johnsoncodehk/volar/issues/1121))

## 0.34.2

- fix: add missing depend for vue-tsc ([#1154](https://github.com/johnsoncodehk/volar/issues/1154))
- fix: css format should not trimmed new lines ([#1155](https://github.com/johnsoncodehk/volar/issues/1155))

## 0.34.1

- fix: fixed vue-tsc broken regression

## 0.34.0

- feat: expose `useConfigurationHost` for external language feature plugins
- perf: faster language server initialization
- perf: simplify template script generation ([#455](https://github.com/johnsoncodehk/volar/issues/455))
- perf: reduce TS language service instances ([#1108](https://github.com/johnsoncodehk/volar/issues/1108))
- fix: web bundle lead to package size greatly increased ([#1084](https://github.com/johnsoncodehk/volar/issues/1084))
- fix: undefined sortText break vim ([#1118](https://github.com/johnsoncodehk/volar/issues/1118))
- fix: template context do not update by external .ts scripts ([#565](https://github.com/johnsoncodehk/volar/issues/565))
- fix: not respect HTML completion settings ([#1139](https://github.com/johnsoncodehk/volar/issues/1139))
- chore: default disabled `volar.autoCompleteRefs` for reduce CPU usage

**Breaking changes**

- Not support typed template slots for now ([#1108](https://github.com/johnsoncodehk/volar/issues/1108))
- Not support emits renaming
- Not support props renaming for `Vue.extends` or `lang="js"`
- Changed built-in HTML formatter from `prettyhtml` to `vscode-html-languageservice` ([#1078](https://github.com/johnsoncodehk/volar/issues/1078))
  - If you would like to use `prettyhtml`, see `prettyhtml` section in https://github.com/johnsoncodehk/volar/discussions/1027
- Changed built-in CSS formatter from `prettier` to `vscode-css-languageservice` ([#1131](https://github.com/johnsoncodehk/volar/issues/1131))
  - If you would like to use `Prettier`, see `Prettier` section in https://github.com/johnsoncodehk/volar/discussions/1027
- Changed setting `volar.lowPowerMode` to `volar.vueserver.useSecondServer` and disabled by default
  - When disabled, language service instance reduce a half of memory usage, but auto-complete should be slower in expected
- `"jsx": "preserve"` now is required for template type-checking ([#1153](https://github.com/johnsoncodehk/volar/issues/1153))

## 0.33.10

- feat: support preview features on external browser
  - press `Alt` key to activating go to code feature
- fix: can't open multiple preview windows

## 0.33.9

- perf: faster vue-tsc watch response
- fix: memory leak on vue-tsc watch ([#1106](https://github.com/johnsoncodehk/volar/issues/1106))
- fix: emmet block html src path completion ([#1105](https://github.com/johnsoncodehk/volar/issues/1106))

## 0.33.8

- feat: highlight selections code on preview
- feat: add setting to disable preview icons ([#1101](https://github.com/johnsoncodehk/volar/issues/1101))

## 0.33.7

- feat: support nuxt 3 app preview and goto code
- fix: avoid click event on element when use goto code
- fix: style codeLens references always show 0 references ([#1095](https://github.com/johnsoncodehk/volar/issues/1095))

## 0.33.6

- fix: TS completion not working in interpolations ([#1088](https://github.com/johnsoncodehk/volar/issues/1088))
- fix: not respected `html.autoCreateQuotes`, `html.autoClosingTags` settings ([#840](https://github.com/johnsoncodehk/volar/issues/840))
- fix: organize imports code action edge range incorrect ([#1091](https://github.com/johnsoncodehk/volar/issues/1091))
- fix: don't report css module `$style` types error on vue-tsc ([#1089](https://github.com/johnsoncodehk/volar/issues/1089))
- fix: css vars no effect on vue-tsc ([#1093](https://github.com/johnsoncodehk/volar/issues/1093))

## 0.33.5

- fix: diagnostics not update ([#1076](https://github.com/johnsoncodehk/volar/issues/1076))

## 0.33.4

- fix: expand selection broken since 0.33.0 ([#1085](https://github.com/johnsoncodehk/volar/issues/1085))
- fix: vueCompilerOptions typo `experimentalRsolveNonScopedCssClasses` -> `experimentalResolveNonScopedCssClasses`
- fix: 0.33.3 release packages missing `/out` directory ([#1086](https://github.com/johnsoncodehk/volar/issues/1086))

## 0.33.3

- feat: support attribute binding syntax `:<name>.attr` ([#1047](https://github.com/johnsoncodehk/volar/pull/1047))
- feat: supoprt document features for Web IDE ([#612](https://github.com/johnsoncodehk/volar/issues/612))
- feat: add option to support intellisense for non-scoped css ([#1038](https://github.com/johnsoncodehk/volar/issues/1038))
- feat: reduce vue-tsc depends
- fix: json schema request service not available since 0.33.0 ([#243](https://github.com/johnsoncodehk/volar/issues/243))
- fix: remove `console.log` avoid vim-lsp crash ([#1046](https://github.com/johnsoncodehk/volar/pull/1046))
- fix: emmet suggestions messed up embedded language suggestions ([#1039](https://github.com/johnsoncodehk/volar/issues/1039))
- fix: missing proposals for HTML attribute value ([#1072](https://github.com/johnsoncodehk/volar/issues/1072))
- fix: vue-tsc watch not always catch vue file changes ([#1082](https://github.com/johnsoncodehk/volar/issues/1082))
- fix: previewer not working with pnpm ([#1074](https://github.com/johnsoncodehk/volar/issues/1074))
- fix: global components type not working with `vue-class-component` ([#1061](https://github.com/johnsoncodehk/volar/issues/1061))
- fix: goto component definition not working with some syntax ([#435](https://github.com/johnsoncodehk/volar/issues/435)) ([#1048](https://github.com/johnsoncodehk/volar/issues/1048))
- fix: directives argument should be optional if argument could be undefined ([#1040](https://github.com/johnsoncodehk/volar/issues/1040))

## 0.33.2

- feat: add option `vueCompilerOptions.experimentalDisableTemplateSupport` to disable template type-check and intellisense ([#577](https://github.com/johnsoncodehk/volar/issues/577))
- fix: avoid props jsdoc erase by `withDefaults`
- fix: sponsors svg never update

## 0.33.1

- feat: improve formatting error tolerance ([#1033](https://github.com/johnsoncodehk/volar/issues/1033))
- fix: template report unexpected errors ([#1036](https://github.com/johnsoncodehk/volar/issues/1036)) ([#1037](https://github.com/johnsoncodehk/volar/issues/1037))
- fix: can't extract template context in js ([#1035](https://github.com/johnsoncodehk/volar/issues/1035))

## 0.33.0

- feat: reduce vue-tsc depends
- feat: support more language features for `lang="json"` custom block
- feat: support for goto implementations
  - if you're not using VSCode, you should config new option `languageFeatures.implementation = true` in initializationOptions to enable it
- feat: support custom language service plugins for ([#1028](https://github.com/johnsoncodehk/volar/pull/1028)):
  - change built-in formatters
  - add language support for custom block with any other language yourself
- feat: support vue-tsc watch ([#1030](https://github.com/johnsoncodehk/volar/pull/1030))
- feat: preview features not longer needed authentication
- fix: pug formatting broken ([#1002](https://github.com/johnsoncodehk/volar/issues/1002))
- fix: vite app preview not working on windows ([#1013](https://github.com/johnsoncodehk/volar/issues/1013))
- fix: fallback event type behavior for invalid type components ([#1001](https://github.com/johnsoncodehk/volar/issues/1001)) ([#1026](https://github.com/johnsoncodehk/volar/issues/1026))

**Breaking changes**

- `@volar/server` renamed to `@volar/vue-language-server`
  - cli command `vue-server` changed to `vue-language-server`
- `vscode-vue-languageservice` renamed to `@volar/vue-language-service`
- `vscode-typescript-languageservice` renamed to `@volar/typescript-language-service`
- `vscode-json-languageservice` renamed to `@volar/json-language-service`

## 0.32.1

- feat: support generic events with props ([#981](https://github.com/johnsoncodehk/volar/issues/981))
- fix: slots references always 0 ([#932](https://github.com/johnsoncodehk/volar/issues/932))
- fix: `source.organizeImports` not working in `editor.codeActionsOnSave` ([#906](https://github.com/johnsoncodehk/volar/issues/906))
- fix: component type incorrect if duplicate name with current `<script setup>` file name ([#944](https://github.com/johnsoncodehk/volar/issues/944))
- fix: language server broken if TS version < 4.4 ([#962](https://github.com/johnsoncodehk/volar/issues/962))
- fix: pug outline element level incorrect ([#969](https://github.com/johnsoncodehk/volar/issues/969))
- fix: document symbols confusion between `<script>` and `<script setup>` ([#994](https://github.com/johnsoncodehk/volar/issues/994))
- fix: vite icon do not show with first editor

## 0.32.0

- feat: experimental webview features for vite ([#208](https://github.com/johnsoncodehk/volar/issues/208))
- perf: bundle extension to speed up startup

## 0.31.4

- perf: faster auto-import completion ([#808](https://github.com/johnsoncodehk/volar/issues/808))

## 0.31.3

- feat: trigger event auto-complete when input `@` ([#949](https://github.com/johnsoncodehk/volar/issues/949))
- feat: add `v-bind:*`, `v-on:*` to auto-complete ([#949](https://github.com/johnsoncodehk/volar/issues/949))
- feat: avoid auto import added in script block first line ([#916](https://github.com/johnsoncodehk/volar/issues/916))
- fix: language features not working in symbolic link project ([#914](https://github.com/johnsoncodehk/volar/issues/914))
- fix: language server throw in `process.env.NODE_ENV === 'production'` env ([#915](https://github.com/johnsoncodehk/volar/issues/915))
- fix: component type broken by union event key type ([#926](https://github.com/johnsoncodehk/volar/issues/926))
- fix: document symbol not working for `<script setup>` ([#938](https://github.com/johnsoncodehk/volar/issues/938))

## 0.31.2

- feat: improve scoped css class name references codeLens, auto-complete ([#907](https://github.com/johnsoncodehk/volar/issues/907))

## 0.31.1

- fix: support type export statements on the top in `<script setup>` ([#886](https://github.com/johnsoncodehk/volar/issues/886))

## 0.31.0

- feat: support generic emits ([#877](https://github.com/johnsoncodehk/volar/issues/877))
- feat: support top level await in `<script setup>` without extra tsconfig setting ([#538](https://github.com/johnsoncodehk/volar/issues/538))
- feat: fully support formatting for v-for expression
- fix: can't ignore variable unused report by `_` prefixes in v-for ([#878](https://github.com/johnsoncodehk/volar/issues/878))
- fix: no error when definitions from `<script setup>` used in `<script>` ([#766](https://github.com/johnsoncodehk/volar/issues/766))

## 0.30.6

- fix: re-support `withDefaults` for props type in template ([#868](https://github.com/johnsoncodehk/volar/issues/868))
- fix: tsconfig report `schemas/tsconfig.schema.json` missing ([#869](https://github.com/johnsoncodehk/volar/issues/869))
- fix: enabled `editor.semanticHighlighting.enabled` by default to avoid component tag show invalid color when installed some themes
- fix: export default expression semicolon breaks component type in script setup ([#874](https://github.com/johnsoncodehk/volar/issues/874))
- fix: don't wrap options with defineComponent when convert to setup sugar

**Breaking changes**

- When use `<script setup>`, ignore extra component options wrapper function (`defineComponent` / `Vue.extends` ...)

## 0.30.5

- fix: `vueCompilerOptions` intellisense not working on jsconfig
- fix: vue-tsc broken on windows in 0.30.3

## 0.30.4

- fix: component tag semantic highlisht token incorrect with folding ([#801](https://github.com/johnsoncodehk/volar/issues/801))
- fix: component type broken by `withDefaults` in 0.30.3

**Breaking changes**

- Unsupported `withDefaults` for component props type

## 0.30.3

- feat: auto wrap `()` to as expression (`v-bind="foo as string"` -> `v-bind="(foo as string)"` ([#859](https://github.com/johnsoncodehk/volar/issues/859))
- feat: support tsconfig properties intellisense on take over mode ([#833](https://github.com/johnsoncodehk/volar/issues/833))
- feat: support `vueCompilerOptions` intellisense in tsconfig ([#833](https://github.com/johnsoncodehk/volar/issues/833))
- fix: vue-tsc and typescript could't guaranteed found each other ([#851](https://github.com/johnsoncodehk/volar/pull/851))
- fix: avoid vue-tsc stripped props jsdoc comments for script setup components ([#799](https://github.com/johnsoncodehk/volar/issues/799))
- fix: string source type incorrect in v-for ([#839](https://github.com/johnsoncodehk/volar/pull/839))

**Known regressions**

- component type broken by `withDefaults`
- vue-tsc broken on windows

## 0.30.2

- feat: jsdoc comment suggestion ([#827](https://github.com/johnsoncodehk/volar/issues/827))
- feat: TS directive comment suggestion
- feat: auto insert attribute quotes
- fix: css error range not reliable ([#826](https://github.com/johnsoncodehk/volar/issues/826))
- fix: html, css completion trigger characters
- fix: allow loose vue language id for markdown ([#831](https://github.com/johnsoncodehk/volar/issues/831))
- fix: avoid auto close tag with undo ([#837](https://github.com/johnsoncodehk/volar/issues/837))

## 0.30.1

- feat: support vue 2 component slots type ([#819](https://github.com/johnsoncodehk/volar/pull/819))
- feat: expose component public instance type by `defineExpose`
- feat: support scoped class name auto-complete ([#752](https://github.com/johnsoncodehk/volar/issues/752))
- feat: alway show commands after extension activated ([#795](https://github.com/johnsoncodehk/volar/issues/795))

**Breaking changes**

- Unsupported `vueCompilerOptions.experimentalExposeScriptSetupContext` option

## 0.30.0

- feat: support components type-check by `static components` for class-base component ([#753](https://github.com/johnsoncodehk/volar/issues/753))
- feat: support `vueCompilerOptions.experimentalExposeScriptSetupContext` option for jest ([#805](https://github.com/johnsoncodehk/volar/issues/805))
- feat: support `typescript.suggest.autoImports` setting ([#746](https://github.com/johnsoncodehk/volar/issues/746))
- fix: `@vue/composition-api` defineComponent types incorrect in template ([#780](https://github.com/johnsoncodehk/volar/issues/780))
- fix: directives syntax highlight incorrect in svg tag ([#776](https://github.com/johnsoncodehk/volar/issues/776))
- fix: project references ignored jsconfig ([#756](https://github.com/johnsoncodehk/volar/issues/756))
- fix: html semantic tokens range incorrect in long template code ([#801](https://github.com/johnsoncodehk/volar/issues/801))
- fix: `typescript.preferences.importModuleSpecifier` setting not working for component auto import ([#793](https://github.com/johnsoncodehk/volar/issues/793))
- fix: `Organize Imports` commmand not always working ([#798](https://github.com/johnsoncodehk/volar/issues/798))
- fix: css variable injection virtual code cannot update ([#777](https://github.com/johnsoncodehk/volar/issues/777))
- fix: should not initializes new language service when create a new file ([#802](https://github.com/johnsoncodehk/volar/issues/802))
- fix: new file first diagnostics incorrect 

**Breaking changes**

- Do not support component context types in template for `export default { ... }` without `Vue.extend` or `defineComponent` ([#750](https://github.com/johnsoncodehk/volar/pull/750))

## 0.29.8

- perf: cache `URI.file`, `URI.parse` results
- fix: pug template type-check broken with omit tag name
- fix: language server broken with tsconfig extends a non-relative path ([#747](https://github.com/johnsoncodehk/volar/issues/747)) ([#749](https://github.com/johnsoncodehk/volar/issues/749))

## 0.29.7

- feat: support html, css custom data ([#707](https://github.com/johnsoncodehk/volar/issues/707))
- feat: support extends tsconfig `vueCompilerOptions` ([#731](https://github.com/johnsoncodehk/volar/issues/731))
- fix: cannot config project reference by directory path ([#712](https://github.com/johnsoncodehk/volar/issues/712))
- fix: pug attrs type-check borken by nested tags ([#721](https://github.com/johnsoncodehk/volar/issues/721))
- fix: import path rename result incorrect ([#723](https://github.com/johnsoncodehk/volar/issues/723))
- fix: `editor.codeActionsOnSave: ["source.organizeImports"]` not working ([#726](https://github.com/johnsoncodehk/volar/issues/726))
- fix: goto definition not working with some component import statement ([#728](https://github.com/johnsoncodehk/volar/issues/728))
- fix: don't show volar commands in non-vue document ([#733](https://github.com/johnsoncodehk/volar/issues/733))
- fix: vue-tsc not working with symlink ([#738](https://github.com/johnsoncodehk/volar/issues/738))

## 0.29.6

- fix: attrs show unexpected "not exist" error ([#710](https://github.com/johnsoncodehk/volar/issues/710))
- fix: verify all scripts not working if no jsconfig / tsconfig
- fix: organize import edit text range incorrect ([#714](https://github.com/johnsoncodehk/volar/issues/714))
- fix: class component props type-check not working with multiple props ([#705](https://github.com/johnsoncodehk/volar/issues/705))
- fix: emmet should not active in template interpolations
- fix: TS semantic highlight not working

## 0.29.5

- feat: open tsconfig when click in status bar
- feat: add `experimentalTemplateCompilerOptionsRequirePath` option to allow import compiler options from js file ([#698](https://github.com/johnsoncodehk/volar/issues/698))
- fix: pug folding ranges break by empty line ([#688](https://github.com/johnsoncodehk/volar/issues/688))
- fix: reduce the intrusiveness of template type-check hacks ([#689](https://github.com/johnsoncodehk/volar/issues/689))
- fix: `@volar/server` entry files missing in npm publish ([#695](https://github.com/johnsoncodehk/volar/issues/695))
- fix: language server immediately crashes when trigger request at incomplete TS code ([#699](https://github.com/johnsoncodehk/volar/issues/699))
- fix: html / css path resolve incorrect on windows edge cases ([#694](https://github.com/johnsoncodehk/volar/issues/694))
- doc: fix incorrect `experimentalTemplateCompilerOptions` example: `"compatConfig": { "Mode": 2 }` -> `"compatConfig": { "MODE": 2 }`

## 0.29.4

- feat: syntax highlight support for Web IDE ([#612](https://github.com/johnsoncodehk/volar/issues/612))
- fix: semantic highlight can't update if project have no tsconfig or jsconfig ([#685](https://github.com/johnsoncodehk/volar/issues/685))

## 0.29.3

- feat: support syntax highlighting for `lang="toml"` ([#684](https://github.com/johnsoncodehk/volar/pull/684))
- fix: subfolder path resolve logic cause to TS crash edge case ([#679](https://github.com/johnsoncodehk/volar/issues/679))

## 0.29.2

- fix: document server created multi time
- fix: html hover not working in some non-VSCode clients ([#678](https://github.com/johnsoncodehk/volar/issues/678))

## 0.29.1

- fix: template AST broken by empty line in pug ([#676](https://github.com/johnsoncodehk/volar/issues/676))
- fix: intellisense not working if project have no jsconfig / tsconfig ([#680](https://github.com/johnsoncodehk/volar/issues/680)) ([#681](https://github.com/johnsoncodehk/volar/issues/681))

## 0.29.0

- feat: support namespaced component ([#372](https://github.com/johnsoncodehk/volar/issues/372))
- feat: more strict `.value` auto-complete condition
- feat: show current tsconfig on status bar
- feat: provide public api to generate script setup type-check code ([#650](https://github.com/johnsoncodehk/volar/issues/650))
- feat: add sass formatter
- fix: can't exit split editors by click icon edge cases
- fix: semantic tokens not working in pug template
- fix: script setup component name not recognized edge cases
- fix: ignore template language support if not `html` or `pug` ([#659](https://github.com/johnsoncodehk/volar/pull/659))
- fix: tsconfig `types` paths resolve incorrect in monorepo ([#661](https://github.com/johnsoncodehk/volar/issues/661))
- fix: can't update diagnostics on windows + atom
- fix: project finding logic incorrect with tsconfig `referencecs` option ([#649](https://github.com/johnsoncodehk/volar/issues/649))
- fix: `{{ }}` colorized bracket pairs not working
- fix: documentSymbol, foldingRanges not working to some *.ts files on take over mode

**Breaking changes**

- experimentalCompatMode behavior changed ([#576](https://github.com/johnsoncodehk/volar/issues/576))\
do not force config `compatConfig: { Mode: 2 }` to template compiler with `"experimentalCompatMode": 2`

## 0.28.10

- feat: improve pug folding range ([#636](https://github.com/johnsoncodehk/volar/issues/636))
- feat: improve pug tag, attr auto-complete ([#638](https://github.com/johnsoncodehk/volar/issues/638))
- fix: if trigger component auto-import multiple times, import edit text accumulate ([#639](https://github.com/johnsoncodehk/volar/issues/639))
- fix: filter current component from component auto-import list
- fix: normalize request uri for Sublime / Atom ([#637](https://github.com/johnsoncodehk/volar/issues/637))

**Known regressions**

- semantic tokens not working in pug template

## 0.28.9

- feat: use VSCode 1.61 `Split Editor In Group` instead of create new editor ([#608](https://github.com/johnsoncodehk/volar/issues/608))
- feat: split editors layout change from `script | template | style` to `script + style | template`
- feat: tag name conversion work done progress
- fix: language server broken by circular tsconfig project references ([#525](https://github.com/johnsoncodehk/volar/issues/525)) ([#631](https://github.com/johnsoncodehk/volar/issues/631)) ([#632](https://github.com/johnsoncodehk/volar/issues/632))
- fix: vue-tsc can't show "incremental mode / watch mode not support" error message ([#630](https://github.com/johnsoncodehk/volar/issues/630))
- fix: tag name kebab case -> pascal case conversion not working
- fix: LSP workspace configuration option not supported ([#626](https://github.com/johnsoncodehk/volar/issues/626))
- fix: no edit to `components` option when component auto-import ([#634](https://github.com/johnsoncodehk/volar/issues/634))

## 0.28.8

- feat: support html hover settings ([#627](https://github.com/johnsoncodehk/volar/issues/627)) ([#615](https://github.com/johnsoncodehk/volar/pull/628))
- fix: `withDefaults` can't narrowing props undefined ([#611](https://github.com/johnsoncodehk/volar/issues/611)) ([#614](https://github.com/johnsoncodehk/volar/issues/614))
- fix: vueCompilerOptions not working with vue-tsc --project flag ([#613](https://github.com/johnsoncodehk/volar/issues/613)) ([#615](https://github.com/johnsoncodehk/volar/pull/615))
- fix: tsconfig project references are not respected ([#525](https://github.com/johnsoncodehk/volar/issues/525))

## 0.28.7

- fix: can't access `$slots`, `$props`... in template if no script block ([#601](https://github.com/johnsoncodehk/volar/issues/601))
- fix: defineEmit not working with type alias ([#607](https://github.com/johnsoncodehk/volar/issues/607))
- fix: `GlobalComponents` working for vue2 ([#609](https://github.com/johnsoncodehk/volar/issues/609))

## 0.28.6

- feat: support for emit SFC dts by vue-tsc (See https://github.com/johnsoncodehk/volar/tree/master/packages/vue-tsc#using)

## 0.28.5

- feat: support search workspace symbols (command / ctrl + T) ([#549](https://github.com/johnsoncodehk/volar/issues/549))
- fix: alias path completion not working in root segment ([#589](https://github.com/johnsoncodehk/volar/issues/589))
- fix: can't convert invalid component type to `any` ([#594](https://github.com/johnsoncodehk/volar/issues/594))
- fix: `<script>` document symbols result inconsistent to TS

## 0.28.4

- feat: support for open `*.ts` to enable take over mode
- fix: `any` type component should not show red color
- fix: auto-import should not from virtual file `__VLS_vue` ([#584](https://github.com/johnsoncodehk/volar/issues/584))
- fix: path auto-complete not working in template ([#589](https://github.com/johnsoncodehk/volar/issues/589))

## 0.28.3

- feat: add option to disable component auto import ([#440](https://github.com/johnsoncodehk/volar/issues/440))
- feat: add `volar.takeOverMode.enabled` setting to allow enable take over mode even TS extension active
- fix: only the last typed event of defineEmits gets recognized ([#578](https://github.com/johnsoncodehk/volar/issues/578))
- fix: syntax highlight incorrect if event name has number
- fix: dynamic slot syntax highlight incorrect
- fix: interpolations syntax highlight should not active in html comment block
- fix: multi-line event expression formatting indent incorrect ([#579](https://github.com/johnsoncodehk/volar/issues/579))

## 0.28.2

- fix: args-less events type incorrect ([#575](https://github.com/johnsoncodehk/volar/issues/575))
- fix: `@vue/composition-api` events type incorrect ([#576](https://github.com/johnsoncodehk/volar/issues/576))

## 0.28.1

- fix: don't report error `Its return type 'xxx' is not a valid JSX element.` to invalid functional component type ([#574](https://github.com/johnsoncodehk/volar/issues/574))
- fix: improve `$emit` types extract for events type-checking ([#567](https://github.com/johnsoncodehk/volar/issues/567))
- fix: css class references not working for pug ([#569](https://github.com/johnsoncodehk/volar/issues/569))
- fix: completion broken in Sublime ([#573](https://github.com/johnsoncodehk/volar/issues/573))

## 0.28.0

- feat: make vue-tsc version consistency to volar ([vue-tsc#72](https://github.com/johnsoncodehk/vue-tsc/issues/72))
- feat: remove tsPlugin prompt
- feat: remove vue-tsc version checking
- fix: avoid `noPropertyAccessFromIndexSignature` effect to slots ([#561](https://github.com/johnsoncodehk/volar/issues/561))
- fix: interpolations syntax highlight not working in html ([#562](https://github.com/johnsoncodehk/volar/issues/562))
- fix: style attr can't end with `'` ([#563](https://github.com/johnsoncodehk/volar/issues/563))
- refactor: rewrite vue-tsc by TS

## 0.27.30

- feat: support syntax highlight for vue blocks in markdown
- feat: support vue directives, interpolations syntax highlight for html / pug code outside vue script
- fix: template type-checking incorrectly reports error when using pnpm
- fix: template slots type-check broken
- fix: allow component type that missing `$props` property
- fix: slots type broken by expression-less attributes

## 0.27.29

- fix: don't pass unsupport component type to JSX ([#553](https://github.com/johnsoncodehk/volar/issues/553))
- fix: dynamic props borken ([#555](https://github.com/johnsoncodehk/volar/issues/555))
- fix: don't show virtual files in find references result
- fix: directives type-check broken

**Breaking changes since 0.27.27**

- If your project includes Storybook or `@types/react`, you need to config tsconfig `types` option to avoid `@types/react` affect to template type-checking. See [#552](https://github.com/johnsoncodehk/volar/issues/552).

## 0.27.28

- feat: support generic `$slots` types
- feat: improve `v-for` typing ([#546](https://github.com/johnsoncodehk/volar/pull/546))
- feat: support vue project isn't root folder ([#541](https://github.com/johnsoncodehk/volar/issues/541))
- fix: slots type of any type component incorrect ([#547](https://github.com/johnsoncodehk/volar/issues/547))
- fix: optional `$slots` type incorrect
- fix: ignore union type component to avoid error in template ([vue-tsc#80](https://github.com/johnsoncodehk/vue-tsc/issues/80))

## 0.27.27

- feat: support slots type-checking by `$slots` property ([#539](https://github.com/johnsoncodehk/volar/issues/539))
- fix: generic props type-check not working
- fix: `Map` index type incorrect in v-for ([#544](https://github.com/johnsoncodehk/volar/issues/544))

## 0.27.26

- fix: variables unused report can't update in *.ts in take over mode
- fix: when save file, next document changes diagnostics, semantic tokens incorrect

## 0.27.25

- feat: add open VSCode settings json button in takeover mode prompt
- feat: disable code convert codeLens by default
- perf: use VSCode's file watcher instead of TS file watcher to reduce cpu usage ([#523](https://github.com/johnsoncodehk/volar/issues/523))
- perf: remove redundant fileExists logic
- fix: fixed zero length TS diagnostics missing ([#527](https://github.com/johnsoncodehk/volar/pull/527))
- fix: import statements auto-complete not working in latest VSCode

## 0.27.24

- feat: support TS annotation on v-model ([#518](https://github.com/johnsoncodehk/volar/issues/518))
- fix: events type-check don't report errors ([#516](https://github.com/johnsoncodehk/volar/issues/516)) ([#517](https://github.com/johnsoncodehk/volar/issues/517))
- fix: hyphen events types incorrect ([#515](https://github.com/johnsoncodehk/volar/issues/515))
- fix: find references, renaming not working to template in takeover mode ([#519](https://github.com/johnsoncodehk/volar/issues/519))
- fix: exclude files should fallback to inferred project ([#511](https://github.com/johnsoncodehk/volar/issues/511)) ([#445](https://github.com/johnsoncodehk/volar/issues/445))

## 0.27.23

- feat: support `<script setup>` types in template expressions
- feat: support TS syntax highlighting in template expressions
- perf: cpu keep high usages if node_modules contains lot of d.ts files ([#507](https://github.com/johnsoncodehk/volar/issues/507))
- perf: lazy calculation TS plugin proxy, TS program proxy to reduce initialization time ([#507](https://github.com/johnsoncodehk/volar/issues/507))
- fix: SFC validation broken with `lang="postcss"` ([#508](https://github.com/johnsoncodehk/volar/issues/508))

## 0.27.22

- feat: remove TS plugin to single extension ([#501](https://github.com/johnsoncodehk/volar/issues/501))
- fix: `v-for` item type report circular reference edge case
- fix: external file snapshot cannot update in TS plugin ([#506](https://github.com/johnsoncodehk/volar/issues/506))
- fix: cannot extract superset `DefineComponent` emit option type ([#495](https://github.com/johnsoncodehk/volar/issues/495))
- fix: sometime component props auto-complete not working in template
- fix: should not ignore `.vitepress` folder ([#506](https://github.com/johnsoncodehk/volar/issues/506))
- fix: fixed a few drive file update event logic

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
