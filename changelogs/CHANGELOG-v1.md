## 1.8.27 (2023/12/26)

- fix(language-core): remove misuse of `JSX.Element` for compatible with vue 3.4 (https://github.com/vuejs/core/issues/9923)

## 1.8.26 (2023/12/22)

- fix: upgrade typescript-auto-import-cache to v0.3.1 to be compatible with TS 5.3 (https://github.com/volarjs/typescript-auto-import-cache/pull/3) ([#3802](https://github.com/vuejs/language-tools/issues/3802))

## 1.8.25 (2023/12/6)

- fix(component-type-helpers): correct type inference for FunctionalComponent ([#3766](https://github.com/vuejs/language-tools/issues/3766)) - thanks @pinguet62
- fix(language-core): camelize props for dynamic component ([#3774](https://github.com/vuejs/language-tools/issues/3774)) - thanks @so1ve

## 1.8.24 (2023/11/29)

- refactor(component-type-helpers): vue 2 types now move to `vue-component-type-helpers/vue2` ([#3404](https://github.com/vuejs/language-tools/issues/3404))
- feat(language-core): expose `defineEmits`'s `arg` and `typeArg` in `parseScriptSetupRanges` ([#3710](https://github.com/vuejs/language-tools/issues/3710)) - thanks @so1ve
- fix(language-core): `strictTemplates` fails to report unknown components ([#3539](https://github.com/vuejs/language-tools/issues/3539))
- fix(language-core): script syntax breaks if script options does not have trailing comma ([#3755](https://github.com/vuejs/language-tools/issues/3755))
- fix(language-core): script syntax breaks if options are enclosed in parentheses ([#3756](https://github.com/vuejs/language-tools/issues/3756))
- fix(language-core): allow using `as` with multiple `<script>` blocks ([#3733](https://github.com/vuejs/language-tools/issues/3733)) - thanks @so1ve
- fix(language-core): component type narrowing not working in template
- fix(language-core): incremental insertion incorrect if input `<script setup>` tag above `<script>` tag ([#3743](https://github.com/vuejs/language-tools/issues/3743)) - thanks @so1ve
- fix(language-core): don't camelize attributes for plain elements ([#3750](https://github.com/vuejs/language-tools/issues/3750)) - thanks @rchl
- fix(vscode): syntax highlighting for `.prop` shorthand ([#3729](https://github.com/vuejs/language-tools/issues/3729)) - thanks @so1ve

#### Volar.js 1.11.1 updates:

- fix: browser integration no longer requires node polyfill (https://github.com/volarjs/volar.js/pull/70)
- fix: document continuous change merge results are incorrect in WebStorm (https://github.com/volarjs/volar.js/pull/77) - thanks @browsnet

## 1.8.22 (2023/10/27)

- fix: `experimentalResolveStyleCssClasses: "always"` not working ([#3689](https://github.com/vuejs/language-tools/issues/3689)) - thanks @maIIady
- fix: `__VLS_Prettify` missing for dts build when uses `withDefaults()` ([#3691](https://github.com/vuejs/language-tools/issues/3691))

## 1.8.21 (2023/10/25)

#### Volar.js 1.10.5 updates:

- fix(monaco): completion cannot insert text starting with `$` (https://github.com/volarjs/volar.js/issues/69)
- fix(typescript): automatic type acquisition not working since v1.10.0

## 1.8.20 (2023/10/23)

- feat: added Italian integration documentation
- feat: enforce `v-bind` argument to be an object ([#3666](https://github.com/vuejs/language-tools/issues/3666)) - thanks @so1ve
- fix: JSDoc comments not emitted when using type-only defineProps macro ([#3645](https://github.com/vuejs/language-tools/issues/3645))
- fix: autocomplete for directive comments without a space ([#3665](https://github.com/vuejs/language-tools/issues/3665)) - thanks @so1ve
- fix: fix slot type when using a interpolation in template string ([#3657](https://github.com/vuejs/language-tools/issues/3657)) - thanks @so1ve
- fix: add autocomplete for v-slot parameters ([#3661](https://github.com/vuejs/language-tools/issues/3661)) - thanks @so1ve
- fix: export correct SlotsPropertyName for vue2 ([#3669](https://github.com/vuejs/language-tools/issues/3669)) - thanks @zhiyuanzmj
- fix(types): infer discriminated unions in child component props ([#3672](https://github.com/vuejs/language-tools/issues/3669)) - thanks @davidmatter
- fix: access to slots directly ([#3671](https://github.com/vuejs/language-tools/issues/3671)) - thanks @so1ve
- fix: autocomplete not working for `$event` ([#3668](https://github.com/vuejs/language-tools/issues/3668)) - thanks @so1ve
- perf: remove duplicate virtual code for native tags
- chore: rename `volar` to `vue` in diagnostics ([#3667](https://github.com/vuejs/language-tools/issues/3667)) - thanks @so1ve
- chore: publish ts plugin to open-vsx ([#3589](https://github.com/vuejs/language-tools/issues/3589)) - thanks @brc-dd

## 1.8.19 (2023/10/11)

- feat: no longer checking save time ([#3650](https://github.com/vuejs/language-tools/issues/3650))
- fix(ts-plugin): tsserver doesnt have updated list of external files when new vue files are added (required TS 5.3) ([#3555](https://github.com/vuejs/language-tools/issues/3555)) ([#3649](https://github.com/vuejs/language-tools/issues/3649))
- fix: false positive error when accessing local variables in defineProps parameter ([#3643](https://github.com/vuejs/language-tools/issues/3643)) ([#3644](https://github.com/vuejs/language-tools/issues/3644)) - thanks @so1ve

## 1.8.18 (2023/10/9)

#### Upgrade required VSCode version to 1.82.0 ([#3642](https://github.com/vuejs/language-tools/issues/3642))

## 1.8.17 (2023/10/9)

- fix: extension cannot run on vscode versions lower than 1.82.0 ([#3631](https://github.com/vuejs/language-tools/issues/3631)) ([#3635](https://github.com/vuejs/language-tools/issues/3635))
- fix: make `defineProps` work when reading a property from `defineProps()` ([#3633](https://github.com/vuejs/language-tools/issues/3633)) - thanks @so1ve
- fix: avoid reading `props` from `__VLS_ctx` ([#3636](https://github.com/vuejs/language-tools/issues/3636)) - thanks @so1ve
- fix: regression with `defineExpose` ([#3639](https://github.com/vuejs/language-tools/issues/3639)) - thanks @so1ve

## 1.8.16 (2023/10/7)

- fix: merge default export's properties properly ([#3600](https://github.com/vuejs/language-tools/issues/3600)) - thanks @so1ve
- fix: accurate exposed type with refs in generic component ([#3604](https://github.com/vuejs/language-tools/issues/3604)) - thanks @so1ve
- fix: make emits type correct when user assigns emit function a custom name ([#3624](https://github.com/vuejs/language-tools/issues/3624)) - thanks @so1ve

#### Volar.js 1.10.3 updates:

- fix: performance issue with o(n^2) complexity of `directoryExists()` (https://github.com/volarjs/volar.js/issues/66) - thanks @Akryum
- fix: directory named "constructor" could crash (https://github.com/volarjs/volar.js/issues/65) - thanks @Dmitrigar, @franz-bendezu

## 1.8.15 (2023/9/26)

- fix: props type missing in JS component context ([#3592](https://github.com/vuejs/language-tools/issues/3592))
- fix: ignore `$emit` return type for Vue 2 ([#3596](https://github.com/vuejs/language-tools/issues/3596))

## 1.8.14 (2023/9/26)

- feat: `defineEmit` now able to infer event types with more than 4 overloads ([#3379](https://github.com/vuejs/language-tools/issues/3379)) ([#1855](https://github.com/vuejs/language-tools/issues/1855))
- feat: more accurately distinguish component internal context and external context types ([#3591](https://github.com/vuejs/language-tools/issues/3591)) ([#3517](https://github.com/vuejs/language-tools/issues/3517)) - thanks @so1ve
- fix: don't import alias macros ([#3576](https://github.com/vuejs/language-tools/issues/3576)) - thanks @sxzz
- fix: make generic components' emit type compactible with Vue core types ([#3569](https://github.com/vuejs/language-tools/issues/3569)) ([#3257](https://github.com/vuejs/language-tools/issues/3257)) - thanks @so1ve
- fix: use universal `__VLS_ConstructorOverloads` when emits type is not inlined ([#3585](https://github.com/vuejs/language-tools/issues/3585)) - thanks @so1ve
- fix: inherit emits props and supports generic component emit type for JSX ([#3533](https://github.com/vuejs/language-tools/issues/3533)) ([#3289](https://github.com/vuejs/language-tools/issues/3289)) ([#3476](https://github.com/vuejs/language-tools/issues/3476)) - thanks @so1ve
- perf: generate less TS virtual code for TS performance ([#3581](https://github.com/vuejs/language-tools/issues/3581))

## 1.8.13 (2023/9/20)

- fix: generate valid syntax when `noPropertyAccessFromIndexSignature` is not enabled ([#3575](https://github.com/vuejs/language-tools/issues/3575)) - thanks @so1ve

## 1.8.12 (2023/9/20)

- feat: support vitepress's code snippet import ([#3559](https://github.com/vuejs/language-tools/issues/3559)) - thanks @so1ve
- fix(component-meta): fix modules interoperability with `vue-component-type-helper`
- fix: avoid losing generic types with `strictTemplates: false` ([#3565](https://github.com/vuejs/language-tools/issues/3565)) - thanks @so1ve
- fix: format slots with typeannotation correctly ([#3573](https://github.com/vuejs/language-tools/issues/3573)) - thanks @so1ve

## 1.8.11 (2023/9/13)

- feat: slot references codeLens counting fragment default slot ([#932](https://github.com/vuejs/language-tools/issues/932))
- fix: correct message for `@vue-expect-error` ([#3541](https://github.com/vuejs/language-tools/issues/3541)) - thanks @so1ve
- fix: avoid global macros conflicts with local variables ([#3550](https://github.com/vuejs/language-tools/issues/3550)) - thanks @so1ve
- fix: script setup comments at top breaks global macros ([#3549](https://github.com/vuejs/language-tools/issues/3549)) - thanks @so1ve
- fix(vue-tsc): prevent rebuild in incremental mode throwing error ([#3556](https://github.com/vuejs/language-tools/issues/3556)) - thanks @blake-newman

## 1.8.10 (2023/9/6)

- feat: added Portuguese integration documentation ([#3535](https://github.com/vuejs/language-tools/issues/3535))
- feat: exposed `configFileName` for `createParsedCommandLineByJson()` function ([#3456](https://github.com/vuejs/language-tools/issues/3456)) - thanks @qmhc
- feat: support nested plugins ([#3530](https://github.com/vuejs/language-tools/issues/3530)) - thanks @so1ve
- feat(vscode): add `vue.server.runtime` setting and support for Bun runtime
- feat(vscode): add `vue.server.path` setting for customize server module path
- fix: correctly hyphen-case props ([#3424](https://github.com/vuejs/language-tools/issues/3424)) - thanks @so1ve
- fix: generic components should respect `strictTemplates` ([#3487](https://github.com/vuejs/language-tools/issues/3487)) - thanks @so1ve
- fix(vue-component-type-helpers): correctly handle generic components when using `ComponentExposed` ([#3536](https://github.com/vuejs/language-tools/issues/3536)) - thanks @so1ve

## 1.8.8 (2023/7/27)

- fix: language server crashed due to importing unexist library ([#3453](https://github.com/vuejs/language-tools/issues/3453)) ([#3454](https://github.com/vuejs/language-tools/issues/3454))

## 1.8.7 (2023/7/27)

- feat: support auto-complete for directives ([#2559](https://github.com/vuejs/language-tools/issues/2559))
- feat: support extract component for options api
- feat: re-support external component parsing ([#3328](https://github.com/vuejs/language-tools/issues/3328))
- feat: support function expression emit event ([#3445](https://github.com/vuejs/language-tools/issues/3445)) - thanks @lvjiaxuan
- perf: reuse VueFile instances between monorepo packages ([#3450](https://github.com/vuejs/language-tools/issues/3450))
- fix: handle node next module resolution ([#3159](https://github.com/vuejs/language-tools/issues/3159)) - thanks @kalvenschraut
- fix: generate valid code when using `__VLS_PropsChildren` ([#3442](https://github.com/vuejs/language-tools/issues/3442)) - thanks @so1ve
- fix: component auto-import cannot insert import statement
- fix: extract component cannot extract interpolations
- fix: allow top-level await in script setup blocks with generics ([#3441](https://github.com/vuejs/language-tools/issues/3441)) - thanks @so1ve

## 1.8.6 (2023/7/22)

- feat: add support for extract component code action ([#2496](https://github.com/vuejs/language-tools/issues/2496)) - thanks @zardoy
- feat: add support for `v-bind` toggle code action ([#2524](https://github.com/vuejs/language-tools/issues/2524)) - thanks @zardoy
- feat: more dull "Saving time is too long" popup
- fix: `vue.server.petiteVue.supportHtmlFile`, `vue.server.vitePress.supportMdFile` settings not working ([#3238](https://github.com/vuejs/language-tools/issues/3238))
- fix: don't check element type for directives ([#3140](https://github.com/vuejs/language-tools/issues/3140))
- fix: `@ts-nocheck` cannot work from script setup ([#3420](https://github.com/vuejs/language-tools/issues/3420)) - thanks @so1ve
- fix(ts-plugin): module resolving should be able to fallback to `.d.ts` ([#3419](https://github.com/vuejs/language-tools/issues/3419))
- fix(language-plugin-pug): `@vue-ignore`, `@vue-skip`, `@vue-expected-error` not working for pug template

## 1.8.5 (2023/7/14)

- 🔥 feat(labs): support for TS memory usage treemap
- 🔥 perf: properly support TS DocumentRegistry to drastically reduce memory usage in monorepo projects
- feat(ts-plugin): re-support auto-import
- fix: remove invalid `volar.action.serverStats` command ([#3366](https://github.com/vuejs/language-tools/issues/3366)) - thanks @yaegassy
- fix: don't remove comments when comment is in the first line ([#3365](https://github.com/vuejs/language-tools/issues/3365)) - thanks @so1ve
- fix: allow slots to have no arguments ([#3376](https://github.com/vuejs/language-tools/issues/3376)) - thanks @so1ve
- fix: camel case components is not recognized as used ([#3377](https://github.com/vuejs/language-tools/issues/3377)) - thanks @so1ve
- perf: hoist regexp if possible ([#3378](https://github.com/vuejs/language-tools/issues/3378)) - thanks @so1ve
- fix: non scoped classes resolution regression ([#3381](https://github.com/vuejs/language-tools/issues/3381)) - thanks @maIIady
- feat: don't to request reload editor when server options changed ([#3393](https://github.com/vuejs/language-tools/issues/3393)) - thanks @zardoy
- feat: don't hide output channel on server restart ([#3401](https://github.com/vuejs/language-tools/issues/3401)) - thanks @zardoy

**Breaking changes**

- Deprecate language server `json.customBlockSchemaUrls` option ([#3398](https://github.com/vuejs/language-tools/issues/3398))

## 1.8.4 (2023/7/5)

- feat(monaco): support for custom file system provider (https://github.com/volarjs/volar.js/pull/50)
- feat: support auto-complete for template directive comments
- fix: local component type should override a global component ([#1886](https://github.com/vuejs/language-tools/issues/1886)) ([#3333](https://github.com/vuejs/language-tools/issues/3333)) - thanks @so1ve
- fix: support type narrowing for components define in script setup ([#3138](https://github.com/vuejs/language-tools/issues/3138)) ([#3350](https://github.com/vuejs/language-tools/issues/3350)) - thanks @so1ve

## 1.8.3 (2023/6/28)

- fix(ts-plugin): tsserver crashes when import > 4MB .vue file ([#3332](https://github.com/vuejs/language-tools/issues/3332))
- fix(language-server): in specific os `fileExists()` throws ([#3336](https://github.com/vuejs/language-tools/issues/3336))

## 1.8.2 (2023/6/27)

- fix: should not auto closing `<img>` tag ([#3217](https://github.com/vuejs/language-tools/issues/3217))
- fix: allow passing undefined as events ([#3122](https://github.com/vuejs/language-tools/issues/3122)) ([#3217](https://github.com/vuejs/language-tools/issues/3217)) - thanks @so1ve
- fix: fixes object literal parsing for <component :is> ([#3324](https://github.com/vuejs/language-tools/issues/3324)) ([#3171](https://github.com/vuejs/language-tools/issues/3171)) - thanks @so1ve
- fix: symbol types are lost ([#3300](https://github.com/vuejs/language-tools/issues/3300)) ([#3295](https://github.com/vuejs/language-tools/issues/3295)) - thanks @so1ve
- fix(ts-plugin): suppress errors when `composite` is enabled
- fix(language-server): trigger characters missing on web IDE
- perf(language-server): debounce for `isCancellationRequested()`
- perf(typescript): caching `getScriptFileNames()` result

**Breaking changes**

- no longer parse vue files outside tsconfig `include` option to avoid TS performance concerns ([#3326](https://github.com/vuejs/language-tools/issues/3326))

## 1.8.1 (2023/6/20)

- fix(language-server): 3 consecutive directories with the same name cause infinite recursion ([#3282](https://github.com/vuejs/language-tools/issues/3282)) - thanks @FelipeAzambuja
- fix(language-server): diagnostics were not properly refreshed when creating files
- fix(monaco): unrecognized relative path file
- types: simplify `__VLS_IsAny` - thanks @so1ve
- perf(ts-plugin): work without overriding language service instance to reduce half of memory usage ([#3221](https://github.com/vuejs/language-tools/issues/3221))

## 1.8.0 (2023/6/17) ([Release notes](https://github.com/vuejs/language-tools/releases/tag/v1.8.0))

## 1.7.14 (2023/6/16) - pre-release

- perf: intellisense is very slow when referencing lots of external .vue files ([#3264](https://github.com/vuejs/language-tools/issues/3264))
- fix: read directory infinite recursion on Darwin os ([#3282](https://github.com/vuejs/language-tools/issues/3282))

## 1.7.13 (2023/6/15) - pre-release

- feat: support Vue 3.3 `defineEmits` shorthand ([#3169](https://github.com/vuejs/language-tools/issues/3169)) ([#3283](https://github.com/vuejs/language-tools/issues/3283)) - thanks @so1ve
- feat: allow trailing text for directive comments (https://github.com/vuejs/language-tools/pull/3215#issuecomment-1591397008)
- feat: switch `vue.inlayHints.optionsWrapper` to disabled by default ([#3147](https://github.com/vuejs/language-tools/issues/3147)) - thanks @wenfangdu
- feat(component-meta): expose component type ([#3151](https://github.com/vuejs/language-tools/issues/3151)) ([#3286](https://github.com/vuejs/language-tools/issues/3286))
- fix: can't define variables in inline event handler ([#3258](https://github.com/vuejs/language-tools/issues/3258)) ([#3280](https://github.com/vuejs/language-tools/issues/3280)) - thanks @so1ve
- fix(vue-tsc): `--emitDeclarationOnly` not working since 1.7.9
- fix(vue-tsc): `@vue-expect-error`, `@vue-ignore` not working for vue-tsc ([#3284](https://github.com/vuejs/language-tools/issues/3284)) - thanks @sapphi-red
- fix: compatible functional component typecheck with TS 5.1.3 ([#3255](https://github.com/vuejs/language-tools/issues/3255))

## 1.7.12 (2023/6/14) - pre-release

- feat: reintroduce `nativeTags` ([#3279](https://github.com/vuejs/language-tools/issues/3279))
- fix: compatible with TS 5.1.3 ([#3274](https://github.com/vuejs/language-tools/issues/3274)) ([#3277](https://github.com/vuejs/language-tools/issues/3277)) - thanks @so1ve
- perf(vue-tsc): addressed a performance regression since 1.5.1 by reintroducing `nativeTags` ([#3148](https://github.com/vuejs/language-tools/issues/3148))

## 1.7.11 (2023/6/9) - pre-release

- fix: ignore errors for `statSync` ([#3260](https://github.com/vuejs/language-tools/issues/3260))

## 1.7.10 (2023/6/9) - pre-release

- feat: upgrade framework to v1.7 ([#3248](https://github.com/vuejs/language-tools/issues/3248))
- fix: `strictTemplates` not working for IntrinsicElement ([#3214](https://github.com/vuejs/language-tools/issues/3214))
- fix: failed to load tsconfig json schema ([#3224](https://github.com/vuejs/language-tools/issues/3224)) ([#3228](https://github.com/vuejs/language-tools/issues/3228)) - thanks @tjx666
- fix(vue-tsc): `vue-tsc` ignores type errors in `.vue` files if the incremental setting is true ([#2756](https://github.com/vuejs/language-tools/issues/2756)) ([#3218](https://github.com/vuejs/language-tools/issues/3218)) - thanks @lucasavila00
- fix: properly merge `defineModel` and `defineProps` types ([#3164](https://github.com/vuejs/language-tools/issues/3164))
- fix(language-server): show component meta command not working

**Breaking changes**

- Simplify `JSX.IntrinsicElements` type inference for better TS performance ([#3259](https://github.com/vuejs/language-tools/issues/3259))
- Update `@vue-expected-error` to `@vue-expect-error` (https://github.com/vuejs/language-tools/pull/3215#issuecomment-1560355284)

## 1.7.8 (2023/5/22) - pre-release

- fix: directive comments not working in production builds

## 1.7.7 (2023/5/22) - pre-release

- feat: support for `@vue-ignore`, `@vue-skip`, `@vue-expected-error` directive comments ([#3215](https://github.com/vuejs/language-tools/issues/3215))
- refactor(language-service): removed `vscode-languageserver-protocol` runtime dependency
- perf(monaco): much faster first time intellisense
- fix: ts project not updated when virtual ts file created / deleted

## 1.7.6 (2023/5/19) - pre-release

- refactor(language-service): fewer runtime dependencies
- chore: low-level API adjustment

## 1.7.4 (2023/5/18) - pre-release

- feat: more reliable intellisense for monaco
- fix: avoid adds ".js" extension when auto importing components ([#3150](https://github.com/vuejs/language-tools/issues/3150))

## 1.6.5 (2023/5/13), 1.7.3 (2023/5/13) - pre-release

- chore: bump vue deps to 3.3 stable ([#3167](https://github.com/vuejs/language-tools/issues/3167)) - thanks @ferferga
- fix(vue-tsc): avoid throw when composite is enabled ([#2622](https://github.com/vuejs/language-tools/issues/2622))
- perf(language-service): avoid request name casing from language client multiple times ([#3158](https://github.com/vuejs/language-tools/issues/3158)) - thanks @kalvenschraut
- fix: avoid slot name report TS8013 in js component ([#3121](https://github.com/vuejs/language-tools/issues/3121))

## 1.7.2 (2023/5/11) - pre-release

- feat: compatible with the latest Labs

## 1.7.1 (2023/5/10) - pre-release

- ⭐ feat: support for [Volar.js Labs](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs)
- fix(language-core): add missing peer dependency `typescript` ([#3145](https://github.com/vuejs/language-tools/issues/3145)) - thanks @HunYan-io
- perf: style code change should not increase ts virtual script version
- perf: avoid virtual file version always increase due to source map update

**Breaking changes**

- Removed the `VueLanguageServiceHost` interface

## 1.7.0 (2023/5/7) - pre-release

- feat(language-service): compatible with Volar.js 1.5 Scripts API, Rules API
- fix: `volar.config.js` does not load on Windows (https://github.com/volarjs/volar.js/issues/36)

**Breaking changes**

- rename packages from `@volar/vue-*` to `@vue/*` ([#3134](https://github.com/vuejs/language-tools/issues/3134))
- `volar.config.js` specification update (base on Volar.js v1.5)

## 1.6.4 (2023/5/4)

- feat: support color pickers for inline css
- feat: support `lang="vue"` ([#3105](https://github.com/vuejs/language-tools/issues/3105)) - thanks @HunYan-io
- fix: when the source type of `v-for` is `any`, the item type should be `any` ([#3108](https://github.com/vuejs/language-tools/issues/3108)) ([#3112](https://github.com/vuejs/language-tools/issues/3112))
- fix: avoid slots report error when `noPropertyAccessFromIndexSignature` enabled ([#3106](https://github.com/vuejs/language-tools/issues/3106))
- fix(component-type-helpers): import module causes tsc error ([#3114](https://github.com/vuejs/language-tools/issues/3114))
- fix: empty slot name auto-complete not working
- fix: accessing an unknown slot name does not report an error
- fix: format adds spaces to `v-for` if nested template element assigns type to slot props ([#2750](https://github.com/vuejs/language-tools/issues/2750)) ([#2757](https://github.com/vuejs/language-tools/issues/2757))
- fix: parentheses auto insert not working in template

**Breaking changes**

- drop support for Vue 3.3 slots short definition ([#3116](https://github.com/vuejs/language-tools/issues/3116))

## 1.6.3 (2023/5/2)

- feat: expose custom blocks attrs ([#3099](https://github.com/vuejs/language-tools/issues/3099)) - thanks @HunYan-io
- fix: event "@update:" syntax causes TS error ([#3100](https://github.com/vuejs/language-tools/issues/3100))
- fix: generic attr unexpectedly trimmed when formatting if attr value includes "<" ([#3101](https://github.com/vuejs/language-tools/issues/3101))
- fix: required event props always shows in missing props hint
- fix: exclude null / undefined from `v-for` source type ([#3102](https://github.com/vuejs/language-tools/issues/3102))

## 1.6.2 (2023/5/1)

- fix: consume required props for events ([#2468](https://github.com/vuejs/language-tools/issues/2468))
- fix: support infer v-for types for generic ([#2758](https://github.com/vuejs/language-tools/issues/2758))
- fix: slot missing props don't report error
- fix: cannot assign generic component to components option of defineComponent
- fix: "TS1002: Unterminated string literal" in slots edge case ([#2710](https://github.com/vuejs/language-tools/issues/2710))
- fix: generic component prop with default type incorrect ([#2754](https://github.com/vuejs/language-tools/issues/2754))

## 1.6.1 (2023/4/28)

- feat: support for specify vue library name by `vueCompilerOptions.lib` option ([#2722](https://github.com/vuejs/language-tools/issues/2722))
- fix: avoid `<component :is>` type checking with string literal assignment ([#2725](https://github.com/vuejs/language-tools/issues/2725))
- fix: `<slot>` reporting false positive error when `strictTemplates` enabled ([#2726](https://github.com/vuejs/language-tools/issues/2726)) ([#2723](https://github.com/vuejs/language-tools/issues/2723))
- fix: error using custom directive: `Expected 2 arguments, but got 1.` ([#2730](https://github.com/vuejs/language-tools/issues/2730))
- fix: namespaced tag not working without script setup
- fix: component intellisense not working in template if TS version < 5.0 ([#2742](https://github.com/vuejs/language-tools/issues/2742))
- fix: class is not assignable to generic components ([#2744](https://github.com/vuejs/language-tools/issues/2744))
- fix: components options is not set correctly when component name is kebab-case and auto-importing ([#2745](https://github.com/vuejs/language-tools/issues/2745))

## 1.6.0 (2023/4/27)

- feat(doctor): show warning for TS 4.9 ([#2190](https://github.com/vuejs/language-tools/issues/2190))
- feat: support inlayHints for `vueCompilerOptions.optionsWrapper`
- fix: avoid props type-checking for `VNode` ([#2720](https://github.com/vuejs/language-tools/issues/2720))
- fix: revert "fix: trim modifiers for slot name"
- refactor: update extension settings from `volar.*` to `vue.*`
- refactor(language-server): remove `petiteVue`, `vitePress` from server init options 
  > for IDEs other than VSCode, use `additionalExtensions: ['html', 'md']` instead of

**Breaking changes**

- deprecated `vueCompilerOptions.jsxTemplates` ([#2677](https://github.com/vuejs/language-tools/issues/2677))
- deprecated `vueCompilerOptions.nativeTags` ([#2685](https://github.com/vuejs/language-tools/issues/2685))


## 1.5.4 (2023/4/26) - pre-release

- fix: `defineExpose` macro missing for Vue 3.3
- fix(component-meta): meta info is empty if missing `vue-component-type-helpers` dependency
- fix: don't check time for codeActions when saving multiple files

## 1.5.3 (2023/4/26) - pre-release

- feat: support type-checking for dynamic components
- feat: support element type-checking for directives
- fix: cannot infer event type for `<Transition>` ([#2700](https://github.com/vuejs/language-tools/issues/2700))
- fix: tag / prop casing status not working
- fix: slot name accidentally included modifiers in virtual code
- fix: avoid always pop "Saving time is too long" edge case
- fix: only generate `JSX.ElementChildrenAttribute` type when `vueCompilerOptions.jsxSlots` enabled ([#2714](https://github.com/vuejs/language-tools/issues/2714))
- fix: top level await error in SFC if two script blocks are present ([#2712](https://github.com/vuejs/language-tools/issues/2712))
- fix: cannot use generic components inside defineComponent ([#2709](https://github.com/vuejs/language-tools/issues/2709))
- fix: intellisense not working in es module project ([#2661](https://github.com/vuejs/language-tools/issues/2661))

## 1.5.2 (2023/4/24) - pre-release

- fix: cannot recognize hyphenate tag name ([#2688](https://github.com/vuejs/language-tools/issues/2688))

## 1.5.1 (2023/4/23) - pre-release

- refactor: deprecate `nativeTags` option ([#2685](https://github.com/vuejs/language-tools/issues/2685))
- fix: props type-check not working for one argument functional component ([#2686](https://github.com/vuejs/language-tools/issues/2686))
- fix: `<Suspense>` default slot reporting error ([#2683](https://github.com/vuejs/language-tools/issues/2683))
- fix: cannot infer slots type in vue2 project ([#2682](https://github.com/vuejs/language-tools/issues/2682))
- fix: static directive arg should not recognize as expression ([#2678](https://github.com/vuejs/language-tools/issues/2678))

## 1.5.0 (2023/4/23) - pre-release

- refactor: deprecate `jsxTemplates` option ([#2677](https://github.com/vuejs/language-tools/issues/2677))

## 1.4.4 (2023/4/23)

- fix: missing FunctionalComponent props are no longer reported in the template ([#2676](https://github.com/vuejs/language-tools/issues/2676))

## 1.4.3 (2023/4/22)

- feat: add `volar.nameCasing.status` setting to disable nameCasing status ([#2453](https://github.com/vuejs/language-tools/issues/2453))
- fix(vue-typescript): add missing peer dependency `typescript` ([#2665](https://github.com/vuejs/language-tools/issues/2665)) - thanks @merceyz
- fix: slots references codeLens, renaming not working
- fix: pug multiline attribute values are marked as error ([#2413](https://github.com/vuejs/language-tools/issues/2413))
- fix: incorrect extra inlay hints inside template when enabled `typescript.inlayHints.parameterNames` ([#2670](https://github.com/vuejs/language-tools/issues/2670))
- fix: failed to resolve tsdk path for "JavaScript and TypeScript Nightly" ([#2663](https://github.com/vuejs/language-tools/issues/2663))
- revert: "fix(vue-tsc): add throw message if composite / incremental enabled" (https://github.com/vuejs/language-tools/commit/b596a60154a0f2a6345244a90868b5cc67eb9ff8)

## 1.4.2 (2023/4/21)

- fix: cannot disable auto insert `.value` feature
- fix: avoid slot props reporting error if component does not have `$slots` type ([#2646](https://github.com/vuejs/language-tools/issues/2646))
- fix: prefer component constructor signature instead of call signature ([#2647](https://github.com/vuejs/language-tools/issues/2647))
- fix: avoid tsconfig reporting "Comments are not permitted" when takeover mode enabled ([#2648](https://github.com/vuejs/language-tools/issues/2648))

## 1.4.1 (2023/4/21)

- fix: generic slot props type not incorrect ([#2639](https://github.com/vuejs/language-tools/issues/2639))
- fix: third-party library components cannot accept unknown props ([#2636](https://github.com/vuejs/language-tools/issues/2636))
- fix: allow props less functional component ([#2638](https://github.com/vuejs/language-tools/issues/2638))
- fix: native tags event type become never ([#2640](https://github.com/vuejs/language-tools/issues/2640))
- fix: cannot resolve tsdk on windows ([#2637](https://github.com/vuejs/language-tools/issues/2637))

## 1.4.0 (2023/4/21)

- feat: support intellisense for directive arg expression ([#2588](https://github.com/vuejs/language-tools/issues/2588))
- feat: asking disable codeActions if saving time is too long
- feat: file definition cross file mapping result fall back to 0:0
- fix: fixed dynamic slot arg expression virtual code ([#2586](https://github.com/vuejs/language-tools/issues/2586)) ([#2617](https://github.com/vuejs/language-tools/issues/2617)) ([#2592](https://github.com/vuejs/language-tools/issues/2592))
- fix: add hack support for v-if + v-slot template ([#625](https://github.com/vuejs/language-tools/issues/625))
- fix: goto definition not working for alias path without script setup ([#2600](https://github.com/vuejs/language-tools/issues/2600))
- fix: avoid missing prop hint for native tags ([#2616](https://github.com/vuejs/language-tools/issues/2616))
- fix: vue-language-plugin-pug broken with yarn ([#2608](https://github.com/vuejs/language-tools/issues/2608))
- fix: native tags reporting missing prop error ([#2629](https://github.com/vuejs/language-tools/issues/2629))
- fix(vue-tsc): add throw message if composite / incremental enabled ([#2622](https://github.com/vuejs/language-tools/issues/2622))
- fix: slot props are not recognized at the root component ([#2554](https://github.com/vuejs/language-tools/issues/2554))
- fix: missing props hint incorrect for model property for vue 2 ([#2635](https://github.com/vuejs/language-tools/issues/2635))
- fix: cannot show css hover message ([#2634](https://github.com/vuejs/language-tools/issues/2634))
- fix: duplicate ts unused reports if noUnusedLocals is enabled ([#2627](https://github.com/vuejs/language-tools/issues/2627))

## 1.3.19 (2023/4/19) - pre-release

- feat: change `vue.features.codeActions.enable` default value to `true`
- feat: auto disable `vue.features.codeActions.enable` when document saving time is too long
- feat: changing `vue.features.*` settings no longer requires reload vscode

## 1.3.18 (2023/4/18) - pre-release

Extension settings refactoring

- `codeActions` disabled by default
- `updateImportsOnFileMove` disable by default
- missing props hint, event argument hint disabled by default

For more details, see [#2620](https://github.com/vuejs/language-tools/issues/2620).

## 1.3.17 (2023/4/17) - pre-release

- feat: support document links for tsconfig when takeover mode is actived ([#2467](https://github.com/vuejs/language-tools/issues/2467))
- fix: avoid server crash when tsconfig extends path invalid
- fix: auto import should not appending `.js` ([#1763](https://github.com/vuejs/language-tools/issues/1763)) ([#2518](https://github.com/vuejs/language-tools/issues/2518))
- fix: inhibit unknown props error when if `strictTemplates` is disabled
- fix: absolute SCSS import resolving inconsistency ([#2517](https://github.com/vuejs/language-tools/issues/2517))
- fix: `<template>` multi-line comments shift with each format ([#2505](https://github.com/vuejs/language-tools/issues/2505))

## 1.3.16 (2023/4/16) - pre-release

- feat(component-meta): expose definition location information as `declarations` property
- perf: fixed TS auto import performance regression since v1.13.11 (https://github.com/volarjs/typescript-auto-import-cache/pull/2)
- fix(language-server): show component meta command not working
- fix: `v-for` item adds spaces if enabled `insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets` ([#2571](https://github.com/vuejs/language-tools/issues/2571))
- fix: when the takeover mode is enabled, json documents shows duplicate outline ([#2573](https://github.com/vuejs/language-tools/issues/2573))

## 1.3.14 (2023/4/10) - pre-release

- feat: add `vue-component-type-helpers` package ([#2590](https://github.com/vuejs/language-tools/issues/2590))
- feat(component-meta): integrated `vue-component-type-helpers`
- feat: upgrade to lerna-lite 2.0 ([#2597](https://github.com/vuejs/language-tools/issues/2597)) - thanks @ghiscoding
- feat: support prop renaming for defineModel and defineProp
- fix: template-based slots type incorrect ([#2590](https://github.com/vuejs/language-tools/issues/2590))
- fix(vue-tsc): patch build info roots for TS 5.0 ([#2580](https://github.com/vuejs/language-tools/issues/2580)) - thanks @blake-newman

## 1.3.12 (2023/4/4) - pre-release

- feat: Support for Vue 3.3 experimental `defineModel()` API ([#2579](https://github.com/vuejs/language-tools/issues/2579))
- feat: Support for vue-macros `defineProp()` API ([#2579](https://github.com/vuejs/language-tools/issues/2579))
- feat: support short define for `defineSlots()`
- feat: new `<script setup>` codegen implement for DX improve ([#2582](https://github.com/vuejs/language-tools/issues/2582)) ([#2421](https://github.com/vuejs/language-tools/issues/2421))
- fix: falsely reports "Virtual script not found"
- fix(vue-tsc): emit declaration throws TS4060 ([#2581](https://github.com/vuejs/language-tools/issues/2581)) - thanks @blake-newman

## 1.3.11 (2023/4/2) - pre-release

- feat: support goto source file definition for project references for TS 5.0 (https://github.com/volarjs/volar.js/pull/24) ([#1344](https://github.com/vuejs/language-tools/issues/1344)) ([#2296](https://github.com/vuejs/language-tools/issues/2296)) ([#2340](https://github.com/vuejs/language-tools/issues/2568)) ([#1815](https://github.com/vuejs/language-tools/issues/1815)) - thanks @blake-newman
- feat: support auto imports for unused modules for TS 5.0 (https://github.com/volarjs/volar.js/pull/24) (https://github.com/volarjs/volar.js/issues/19) ([#963](https://github.com/vuejs/language-tools/issues/963)) - thanks @blake-newman

## 1.3.10 (2023/4/1) - pre-release

- feat: support for vue 3.3 `defineSlots()` API ([#2568](https://github.com/vuejs/language-tools/issues/2568))
- feat(vue-tsc): prettify script setup props, emits type in emit
- fix: `plugins`, `hooks`, `experimentalAdditionalLanguageModules` options of `vueCompilerOptions` not working ([#2558](https://github.com/vuejs/language-tools/issues/2558)) - thanks @rchl
- fix(vue-tsc): fixed typescript 5 support ([#2555](https://github.com/vuejs/language-tools/issues/2555)) - thanks @blake-newman
- fix: incorrectly incremented end offset when deleting the last text in an directive expression
- fix: `"typescript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis": true` caused formatting issues with v-bind expressions ([#2507](https://github.com/vuejs/language-tools/issues/2507))
- fix: `normalizeComponentAutoImportName` not working for import statement completion ([#2511](https://github.com/vuejs/language-tools/issues/2511))
- fix: ignore `null` type for dynamic argument ([#2514](https://github.com/vuejs/language-tools/issues/2514))
- fix: `vue-twoslash-queries` plugin not working
- fix: redo `JSX.ElementChildrenAttribute` implement ([#2472](https://github.com/vuejs/language-tools/issues/2472))
- fix(component-meta): support for functional component ([#1992](https://github.com/vuejs/language-tools/issues/1992))
- fix: avoid crash when `chdir()` ([#2480](https://github.com/vuejs/language-tools/issues/2480))
- fix: expand selection ranges incorrect ([#2477](https://github.com/vuejs/language-tools/issues/2477))
- fix: directive semanticTokens display range incorrect ([#2454](https://github.com/vuejs/language-tools/issues/2454))
- fix: `<textarea>` formatting indent incorrect
- perf(vue-tsc): streamline virtual code to improve emit performance

## 1.3.8 (2023/3/27) - pre-release

- fix: missing props type check stop working

## 1.3.7 (2023/3/26) - pre-release

- feat: support `normalizeComponentImportName` for `additionalExtensions` ([#2481](https://github.com/vuejs/language-tools/issues/2481))
- feat: support generic component without `jsxTemplates`
- feat: support slot references for anonymous default slot ([#2547](https://github.com/vuejs/language-tools/issues/2547))
- feat: recognize slots property with `JSX.ElementChildrenAttribute` ([#2472](https://github.com/vuejs/language-tools/issues/2472))
- feat: support slot required checking when enabled `strictTemplates` ([#1820](https://github.com/vuejs/language-tools/issues/1820))
- fix: handle edge tag name casing `<xxx--yyy>` ([#2463](https://github.com/vuejs/language-tools/issues/2463))
- fix: incremental update causes multi-line style node damage ([#2519](https://github.com/vuejs/language-tools/issues/2519))
- fix: formatting break multi-line attribute value indent ([#2519](https://github.com/vuejs/language-tools/issues/2519))
- fix: formatting break `<pre>` tag contents indent ([#2520](https://github.com/vuejs/language-tools/issues/2520))
- fix: typescript `labelDetails` in completions not processed (https://github.com/volarjs/plugins/issues/31) - thanks @zardoy

**Breaking changes**

- deprecated `volar.vueserver.textDocumentSync` setting
- deprecated `narrowingTypesInInlineHandlers` for `vueCompilerOptions` and always enabled now

## 1.3.6 (2023/3/25) - pre-release

- feat: RFC 436 leaves experimental ([#2545](https://github.com/vuejs/language-tools/issues/2545))
- feat: auto resolve `vueCompilerOptions.target` by default
- feat: auto append `/** @jsxImportSource vue */` when `jsxTemplates` enabled and target >= 3.3 for avoid #592
- feat(doctor): remove target check for `vueCompilerOptions`

## 1.3.4 (2023/3/20) - pre-release

- fix: some environments throws `Failed to resolve tsconfig path` (https://github.com/vuejs/language-tools/pull/2471#issuecomment-1475350770)
- fix: diagnostics break when changing code (https://github.com/yaegassy/coc-volar/pull/262#issuecomment-1475468100)
- fix: all server capabilities loss in IDEs other than VSCode ([#2526](https://github.com/vuejs/language-tools/issues/2526))

## 1.3.3 (2023/3/19) - pre-release

- feat: disable `missingRequiredProps`, `eventArgumentInInlineHandlers` by default
- fix: `vueCompilerOptions` cannot extends from non-relative paths ([#2345](https://github.com/vuejs/language-tools/issues/2345)) - thanks @dschmidt
- fix(vue-component-meta): `exposed` missing when use TS 5.0
- perf(vue-component-meta): `props`, `events`, `slots`, `exposed` lazy calculation
- perf: provide change range of virtual file snapshot for typescript program

## 1.3.2 (2023/3/14) - pre-release

- feat(language-server): declare workspaceFolders support in server capabilities for IDEs (https://github.com/volarjs/volar.js/pull/18) - thanks @the-mikedavis
- feat(vue-tsc): supports incremental emit (https://github.com/volarjs/volar.js/pull/17) - thanks @blake-newman
- feat: allow code actions to run rename command after applying ([#2498](https://github.com/vuejs/language-tools/issues/2498)) (https://github.com/volarjs/plugins/pull/29) - thanks @zardoy
- perf(vue-component-meta): faster initialization ([#2506](https://github.com/vuejs/language-tools/issues/2506)) - thanks @stafyniaksacha
- perf: search tsconfig on demand (https://github.com/volarjs/volar.js/pull/16)

## 1.3.0 (2023/3/10) - pre-release

- feat: support for korean html data
- feat(doctor): remove `vue-tsc` version check
- feat(doctor): rename setting from `volar.doctor.statusBarItem` to `volar.doctor.status`
- feat(doctor): check VSCode settings `emmet.includeLanguages`, `files.associations` ([#2487](https://github.com/vuejs/language-tools/issues/2487))
- feat(doctor): check plugins version for `volar.config.js`
- feat: add description link for `$event =>` hint ([#2445](https://github.com/vuejs/language-tools/issues/2445))
- feat(language-server): support for `ServerMode.PartialSemantic`
- fix: `Show Component Meta` command not working
- fix: name casing status do not update with changed settings ([#2460](https://github.com/vuejs/language-tools/issues/2460))
- fix: component auto import not working with kebab case ([#2458](https://github.com/vuejs/language-tools/issues/2458))
- fix: missing props hints do not recognize `@xxx` ([#4568](https://github.com/vuejs/language-tools/issues/4568))
- fix: code action document version incorrect (https://github.com/yaegassy/coc-volar/issues/254)

**Breaking changes**

- Remove built-in web intellisense support and recommended [TypeScript IntelliSense for Web](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-web) instead of ([#2475](https://github.com/vuejs/language-tools/issues/2475))
- Upgrade required version of `@volar-plugins/*` to `>= 2.0.0`
  - After upgrade, you need to access `default` property with `require('@volar-plugins/xxx').default` in `volar.config.js`
- Upgrade build target from ES2016 to ES2021 ([#2489](https://github.com/vuejs/language-tools/issues/2489))


## 1.2.0 (2023/2/25)

- feat: compatible with upstream monaco integration (https://github.com/volarjs/volar.js/pull/10)
- feat: support array extends for tsconfig ([#2344](https://github.com/vuejs/language-tools/issues/2344))
- feat: make cursor inside quotes when insert missing required props edit ([#2414](https://github.com/vuejs/language-tools/issues/2414))
- feat: support mixin child nodes for pug ([#2447](https://github.com/vuejs/language-tools/issues/2447))
- fix: ignore native tags for missing required props hint
- fix: ignore methods for missing required props hint ([#2443](https://github.com/vuejs/language-tools/issues/2443))
- fix: SFC outline not show child nodes ([#2446](https://github.com/vuejs/language-tools/issues/2446))

## 1.1.7 (2023/2/22)

- fix: document symbols request crash with arrow function declaration ([#2438](https://github.com/vuejs/language-tools/issues/2438))
- fix: document symbols child node range incorrect
- fix: SFC document symbols tree incorrect

## 1.1.6 (2023/2/22)

- fix: template comments were trimmed with formatting in production mode ([#2435](https://github.com/vuejs/language-tools/issues/2435))
- fix: inaccurate outline view of script content
- fix: takeover mode causes IDE to get stuck in large `.ts` files due to a long list in the outline view

## 1.1.5 (2023/2/21)

- feat: prettify type for css module `$style`
- fix: only generate component with function type when use `generic` attribute
- fix: document links feature broken ([#2426](https://github.com/vuejs/language-tools/issues/2426))
- fix: missing props inlay hints not working for namespace components
- fix: component tags type-check not working
- fix: pug template reporting TS2339 when `strictTemplates` enabled ([#2431](https://github.com/vuejs/language-tools/issues/2431))
- fix: pug tag completion not working at empty lines

## 1.1.4 (2023/2/20)

- feat: support for script src path intellisense ([#2331](https://github.com/vuejs/language-tools/issues/2331))
- feat: support name casing setting for component auto import ([#2362](https://github.com/vuejs/language-tools/issues/2362))
- feat: add `volar.vueserver.fullCompletionList` setting ([#2422](https://github.com/vuejs/language-tools/issues/2422))
- perf: filter completion items in language server for better performance ([#2306](https://github.com/vuejs/language-tools/issues/2306))
- fix: `strictTemplates` did not check for unknown components ([#2291](https://github.com/vuejs/language-tools/issues/2291))
- fix: duplicate document links in the template
- fix: completion not working for namespace components ([#2382](https://github.com/vuejs/language-tools/issues/2382))
- fix: html comments and js template strings format indent incorrect ([#2420](https://github.com/vuejs/language-tools/issues/2420))
- fix: do not correspond `v-model` to `checked` prop for checkbox and radio input tags ([#2415](https://github.com/vuejs/language-tools/issues/2415))

## 1.1.3 (2023/2/18)

- feat: visualize event argument in inline handlers
- feat: add description for model modifiers ([#2405](https://github.com/vuejs/language-tools/issues/2405))
- fix: remove deprecated preview commands ([#2402](https://github.com/vuejs/language-tools/issues/2402))
- fix: missing required props hint not working with v-model ([#2407](https://github.com/vuejs/language-tools/issues/2407))
- fix: cannot collapse code in .js / .ts files with takeover mode ([#2408](https://github.com/vuejs/language-tools/issues/2408))
- fix: symbols view stopped working for .js / .ts files with takeover mode ([#2404](https://github.com/vuejs/language-tools/issues/2404))
- fix: cannot rename html tags ([#2410](https://github.com/vuejs/language-tools/issues/2410))
- fix: cannot display rename fail message
- fix: format on type cannot working for code blocks that enabled `volar.format.initialIndent` ([#2401](https://github.com/vuejs/language-tools/issues/2401))
- fix: vue-tsc crashes in watch mode when file changed ([#2403](https://github.com/vuejs/language-tools/issues/2403))
- fix: prop type definition inaccurate for `v-model` directive on native input ([#2399](https://github.com/vuejs/language-tools/issues/2399))

## 1.1.2 (2023/2/17)

- fix: format adding unnecessary newline to CRLF document ([#2385](https://github.com/vuejs/language-tools/issues/2385))
- fix: incidentally inserting indents when inserting new lines when if `editor.formatOnType` ([#2394](https://github.com/vuejs/language-tools/issues/2394))
- fix: template formatting last line indent incorrect ([#2393](https://github.com/vuejs/language-tools/issues/2393))
- fix: template start tag got deleting if first line is comment ([#2390](https://github.com/vuejs/language-tools/issues/2390))
- fix: takeover mode status incorrect in display ([#2389](https://github.com/vuejs/language-tools/issues/2389))
- fix: diff window's document was unexpectedly diagnosed ([#2391](https://github.com/vuejs/language-tools/issues/2391))
- fix: emmet completions appear inside open tag ([#1329](https://github.com/vuejs/language-tools/issues/1329))
- fix: `opencc` is depended on by language server ([#2388](https://github.com/vuejs/language-tools/issues/2388))

## 1.1.0 (2023/2/16)

- feat: support `initialIndent` for `pug` and `sass`
- feat: add description for built-in directives, attributes, component, and elements
- feat: support localization for event modifiers and props modifiers
- feat: missing required props inlay hints (needs enabled `volar.inlayHints.missingRequiredProps`)
- feat: show `(takeover)` instead of `(vue)` in status bar for takeover mode ([#2365](https://github.com/vuejs/language-tools/issues/2365))
- feat: more reliable formatting edits combine
- fix(doctor): update source code link ([#2307](https://github.com/vuejs/language-tools/issues/2307))
- fix(ts-plugin): tsserver multiple initializations lead to infinite loop (https://github.com/microsoft/vscode/issues/171591)
- fix: syntactic features not working for untitled vue document
- fix: spaces removed from ternary operator inside `{{ }}` ([#2305](https://github.com/vuejs/language-tools/issues/2305))
- fix: `source.addMissingImports` accidentally made imports for properties used the template ([#2304](https://github.com/vuejs/language-tools/issues/2304))
- fix: code action auto import should not append to the same line with the script tag ([#916](https://github.com/vuejs/language-tools/issues/916))
- fix: multi-line interpolation last line indent incorrect
- fix: declaring empty emits like `defineEmits<{}>()` would fail the type-checking process ([#2370](https://github.com/vuejs/language-tools/issues/2370))
- fix: ignore `name` prop / attr for slot ([#2308](https://github.com/vuejs/language-tools/issues/2308))

**Breaking changes**

- Removed pug convert tool
- Removed script setup convert tool
- Unsupported tracing for vue-tsc ([#2378](https://github.com/vuejs/language-tools/issues/2378))
- Extract Vite, Nuxt and component preview features to [Vue and Nuxt Preview](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-vue-preview)
	- feat: support `vite-plugin-vue-component-preview` for nuxt 3.2
	- feat: add `vue-preview.root` setting for Nuxt component preview
	- fix: prevent random creation of multiple preview terminals
	- fix: support nuxt preview without vite serving allow list ([#2287](https://github.com/vuejs/language-tools/issues/2287))

## 1.0.24 (2023/1/8)

- feat: add `vueCompilerOptions.macros` setting for vue-macros plugins
- feat(framework): expose `FileCapabilities.full`, `FileRangeCapabilities.full`, `MirrorBehaviorCapabilities.full`
- feat: renamed `normalizeComponentAutoImportName` setting to `normalizeComponentImportName`
- feat: support normalize component name for import statement completion ([#2286](https://github.com/vuejs/language-tools/issues/2286))
- feat: normalize `Index` to folder name when `normalizeComponentImportName` enabled (https://github.com/vuejs/language-tools/issues/2071#issuecomment-1373701277)
- feat: support update imports on multiple files move
- fix(ts-plugin): fixed `Projects must list all files or use an 'include' pattern` error ([#2271](https://github.com/vuejs/language-tools/issues/2271))
- fix: language client sending `parseSfc` requests when not a vue document changed
- fix: typescript actions not working for `codeActionsOnSave` setting ([#2188](https://github.com/vuejs/language-tools/issues/2188))
- fix: fixed `c is not iterable` error edge case ([#2282](https://github.com/vuejs/language-tools/issues/2282))
- fix: cannot select workspace tsdk on status bar with takeover mode
- fix(plugin-api): cannot catch errors for `getEmbeddedFileNames()`, `resolveEmbeddedFile()`
- fix(component-meta): cannot detection of slots in script-less SFC ([#2113](https://github.com/vuejs/language-tools/issues/2113))
- perf(component-meta): resolve schema on demand ([#2288](https://github.com/vuejs/language-tools/issues/2288))

## 1.0.22 (2023/1/5)

- fix: document folding ranges not working in .ts

## 1.0.21 (2023/1/5)

- fix: cannot jump to .vue definition from .ts with takeover mode
- fix: cannot detect `@volar/vue-language-plugin-pug` installed ([#2272](https://github.com/vuejs/language-tools/issues/2272))
- fix: ignore incremental update for v-for expression ([#2266](https://github.com/vuejs/language-tools/issues/2266))
- fix: auto insert spaces for `{{}}` not working
- fix: completion in template inserts stray leading dot ([#2155](https://github.com/vuejs/language-tools/issues/2155))
- fix: if source document EOL is `\r\n`, virtual document mapping decorations range incorrect

## 1.0.20 (2023/1/4)

- feat: support browser navigation for embedded preview
- feat: released pug extension ([#2274](https://github.com/vuejs/language-tools/issues/2274))
- feat: add `volar.takeOverMode.extension` setting for choice extension that takeover *.ts language support
- fix(typescript-vue-plugin): can't always get latest status of .vue files ([#2271](https://github.com/vuejs/language-tools/issues/2271))
- fix: multi-line template interpolation formatting indentation incorrect
- refactor(framework): simplify `LanguageServerPlugin` api and dependency injection connection ([#2273](https://github.com/vuejs/language-tools/issues/2273))
- refactor(framework): combine `createLanguageService` and `createDocumentService`

## 1.0.19 (2022/12/31)

- feat: add `experimentalAdditionalLanguageModules` option for `vueCompilerOptions` ([#2267](https://github.com/vuejs/language-tools/issues/2267))
- fix: TS `typescript/javascript.preferences.autoImportFileExcludePatterns` setting not working
- fix: formatting not working for extra vue file extensions ([#2263](https://github.com/vuejs/language-tools/issues/2263))
- fix(doctor): accidentally report `@vue/compiler-dom` warning ([#2262](https://github.com/vuejs/language-tools/issues/2262))
- fix(vue-component-meta): `required` property incorrect ([#2256](https://github.com/vuejs/language-tools/issues/2256))
- fix(preview): cannot start preview if project never start run vite server ([#2223](https://github.com/vuejs/language-tools/issues/2223))
- fix: references codeLens not working

## 1.0.18 (2022/12/26)

- feat: check deprecated properties for `vueCompilerOptions` in tsconfig
- fix: auto add spaces for `{{}}` not working if template block not at the top
- fix: remove duplicate file watchers for .vue files
- fix: auto complete randomly report `[TS Error] { }` and failed ([#2190](https://github.com/vuejs/language-tools/issues/2190))
- fix: cross-file renaming cannot be performed consecutively
- fix: should not report unknown tag error without `strictTemplates` enabled ([#2255](https://github.com/vuejs/language-tools/issues/2255))

## 1.0.17 (2022/12/26)

- feat: support syntax highlighting for `lang="json5"` ([#2244](https://github.com/vuejs/language-tools/issues/2244))
- feat: support for generating virtual file from multiple sources ([#2253](https://github.com/vuejs/language-tools/issues/2253))
- feat: display mapping data on hover for virtual document
- feat: re-support component semantic token ([#2252](https://github.com/vuejs/language-tools/issues/2252))
- fix(vue-tsc): cannot resolve hook path from extends options
- fix: fixed workspace configs caching not working edge case ([#2062](https://github.com/vuejs/language-tools/issues/2062))
- fix: cannot find volar.config.js for sub folder tsconfig project
- fix: emmet abbreviation suggestion keeps disappearing every third letter ([#2240](https://github.com/vuejs/language-tools/issues/2240))
- fix: `{{ }}` colorizedBracketPairs not working ([#1759](https://github.com/vuejs/language-tools/issues/1759))
- fix: fixed volar-base language servers executePluginCommand duplicate registration error
- fix: avoid throw on un-exist workspace folder ([#2039](https://github.com/vuejs/language-tools/issues/2039))
- fix: ignore class, style attrs when `v-bind` exist ([#2166](https://github.com/vuejs/language-tools/issues/2166))
- fix: functional component type check not working when return type includes `props` property ([#2206](https://github.com/vuejs/language-tools/issues/2206))
- fix: v-slot error when `noPropertyAccessFromIndexSignature` is enabled ([#2236](https://github.com/vuejs/language-tools/issues/2236))
- fix: `skipTemplateCodegen` should ignore template slots emit ([#2237](https://github.com/vuejs/language-tools/issues/2237))
- fix: recursive closing of html tag edge cases ([#2238](https://github.com/vuejs/language-tools/issues/2238)) ([#2247](https://github.com/vuejs/language-tools/issues/2247))
- fix: double quotes not allowed in attribute value ([#2250](https://github.com/vuejs/language-tools/issues/2250))
- perf: embedded files on demand calculation not working

## 1.0.16 (2022/12/20)

- feat(component-meta): make `schema.ignore` accept functions ([#2232](https://github.com/vuejs/language-tools/issues/2232))
- feat: add `volar.icon.splitEditors` setting ([#2163](https://github.com/vuejs/language-tools/issues/2163))
- feat: support twoslash queries in .ts when using takeover mode
- fix: fixed typescript-vue-plugin performance regression ([#2228](https://github.com/vuejs/language-tools/issues/2228))
- fix: deleting space for `{{ |}}` become `{{ | }}` ([#2222](https://github.com/vuejs/language-tools/issues/2222))
- fix: dynamic slot name type `<slot :name="(name as 'a' | 'b')" />` not working ([#2233](https://github.com/vuejs/language-tools/issues/2233))
- fix: typed template slots missing when template only exist dynamic slots ([#2233](https://github.com/vuejs/language-tools/issues/2233))
- fix: fixed template `Type 'void' has no call signatures` errors ([#2225](https://github.com/vuejs/language-tools/issues/2225))
- fix(vue-tsc): shim `vue-tsc/out/proxy.js` for vite-plugin-checker (https://github.com/fi3ework/vite-plugin-checker/issues/193)
- perf: rewrite typescript-vue-plugin for much better performance and fixed path resolve edge case ([#2137](https://github.com/vuejs/language-tools/issues/2137))

## 1.0.14 (2022/12/18)

- feat: add angular language server example ([#2215](https://github.com/vuejs/language-tools/issues/2215))
- feat(vue-tsc): support for hook api ([#2217](https://github.com/vuejs/language-tools/issues/2217))
- feat: add `vue-tsc-eslint-hook` module to support use eslint in vue-tsc ([#2220](https://github.com/vuejs/language-tools/issues/2220))
- feat: add setting `volar.vueserver.maxFileSize` ([#2186](https://github.com/vuejs/language-tools/issues/2186))
- feat: add setting `volar.doctor.checkVueTsc` and disable by default ([#2186](https://github.com/vuejs/language-tools/issues/2186))
- feat: add setting `volar.vueserver.configFilePath` ([#2078](https://github.com/vuejs/language-tools/issues/2078))
- feat: auto add space between double curly brackets ([#2088](https://github.com/vuejs/language-tools/issues/2088))
- feat: support formatting for style `v-bind` ([#2105](https://github.com/vuejs/language-tools/issues/2105))
- fix: virtual code mapping ignored offset 0 ([#2052](https://github.com/vuejs/language-tools/issues/2052))
- fix: auto complete ref value with '.value' not working ([#2203](https://github.com/vuejs/language-tools/issues/2203))
- fix: template AST broken by slot name incremental update ([#2207](https://github.com/vuejs/language-tools/issues/2207))
- fix: preview not working for Vite v4 ([#2198](https://github.com/vuejs/language-tools/issues/2198))

## 1.0.13 (2022/12/12)

- feat(web-ide): show loading file at status bar
- feat(web-ide): support node_modules types via CDN
- feat(web-ide): support locale typescript diagnostic messages
- fix(web-ide): cannot use default typescript lib types
- fix(web-ide): cannot found match tsconfig
- fix: `volar.config.js` plugins dirty cache between different tsconfig projects

## 1.0.12 (2022/12/9)

- feat: added `@volar/vscode-language-client` package ([#2181](https://github.com/vuejs/language-tools/issues/2181))
- fix: document content messed up randomly ([#1807](https://github.com/vuejs/language-tools/issues/1807))
- fix: "Show Virtual Files" mapping background color unclear with light theme ([#2147](https://github.com/vuejs/language-tools/issues/2147)) ([#2170](https://github.com/vuejs/language-tools/issues/2170))
- fix: props type checking not working for Element Plus components ([#2176](https://github.com/vuejs/language-tools/issues/2176)) ([#2180](https://github.com/vuejs/language-tools/issues/2180))
- fix: attribute values being wrapped in parentheses while typing ([#2182](https://github.com/vuejs/language-tools/issues/2182))
- fix: formatting crashes ([#2077](https://github.com/vuejs/language-tools/issues/2077))
- fix: cannot emit component type with `DefineComponent` when template has slots ([#2161](https://github.com/vuejs/language-tools/issues/2161))

## 1.0.11 (2022/12/3)

- fix(vue-tsc): dts emit do not generated `DefineComponent` type ([#2161](https://github.com/vuejs/language-tools/issues/2161))
- fix: global components types loss in vue 2 projects ([#2157](https://github.com/vuejs/language-tools/issues/2157))
- fix: Vite / Nuxt app preview crash when template includes `<html>` tag

## 1.0.10 (2022/11/29)

- feat: add `volar.vueserver.json.customBlockSchemaUrls` setting to support preset json schema urls for custom blocks ([#2079](https://github.com/vuejs/language-tools/issues/2079))
- feat: add `volar.vueserver.reverseConfigFilePriority` setting to support customize tsconfig priority ([#1815](https://github.com/vuejs/language-tools/issues/1815))
- feat: add `volar.vueserver.disableFileWatcher` setting for better performance ([#2027](https://github.com/vuejs/language-tools/issues/2027))
- feat(vue-tsc): support for TypeScript 5.0 ([#2095](https://github.com/vuejs/language-tools/issues/2095))
- feat: auto insert parentheses for `instanceof` expressions ([#2099](https://github.com/vuejs/language-tools/issues/2099))
- feat: more accurate HTML attributes auto-complete
- feat: add `nativeTags` instead of `experimentalRuntimeMode` to vueCompilerOptions for uni-app supports ([#2065](https://github.com/vuejs/language-tools/issues/2065))
- feat: remove split editors icon and use command instead of
- fix: goto definition not working with nvim-lspconfig (https://github.com/vuejs/language-tools/pull/1916#issuecomment-1293166322)
- fix(preview): more accurate script judgment ([#2135](https://github.com/vuejs/language-tools/issues/2135))
- fix: local components types should cover global components types ([#1886](https://github.com/vuejs/language-tools/issues/1886))
- fix: auto insert parentheses for AsExpressions not working
- fix: template code mapping confusion when undo with invalid template code ([#2151](https://github.com/vuejs/language-tools/issues/2151))
- fix: output Server Stats through LSP API ([#2050](https://github.com/vuejs/language-tools/issues/2050))
- fix: vite app preview not working if project path includes spaces (https://github.com/johnsoncodehk/vite-plugin-vue-component-preview/issues/7)
- fix: avoid component preview create multiple terminals ([#2128](https://github.com/vuejs/language-tools/issues/2128))
- fix: avoid folding when join split editors ([#1887](https://github.com/vuejs/language-tools/issues/1887))
- fix: split editors command crash with empty document ([#2072](https://github.com/vuejs/language-tools/issues/2072))
- fix: avoid escape `&quot;` ([#2091](https://github.com/vuejs/language-tools/issues/2091))
- fix: script setup first variable jsdoc missing (https://github.com/vuejs/language-tools/issues/1327#issuecomment-1304784005)
- fix: document symbols of SFC blocks range incorrect ([#2118](https://github.com/vuejs/language-tools/issues/2118))
- fix: `strictTemplates` option works only bound props ([#2136](https://github.com/vuejs/language-tools/issues/2136))
- fix: props required warning missing when `jsxTemplates` option enabled ([#2139](https://github.com/vuejs/language-tools/issues/2139))
- fix: cannot infer events parameter type in recursive component ([#2140](https://github.com/vuejs/language-tools/issues/2140))
- perf: faster semantic tokens parsing ([#2053](https://github.com/vuejs/language-tools/issues/2053)) ([#2056](https://github.com/vuejs/language-tools/issues/2056))
- perf: avoid create file watchers in syntactic server
- perf: cache workspace configuration in language servers ([#2062](https://github.com/vuejs/language-tools/issues/2062))

## 1.0.9 (2022/10/23)

- feat(vue-tsc): add error message for `noEmitOnError` ([#2053](https://github.com/vuejs/language-tools/issues/1669))
- feat: add support for custom file extensions ([#1931](https://github.com/vuejs/language-tools/issues/1931))
- feat: add support for `typescript/javascript.suggest.completeFunctionCalls` ([#956](https://github.com/vuejs/language-tools/issues/956))
- feat: add support for JSX auto closing tags and tags commenting ([#1494](https://github.com/vuejs/language-tools/issues/1494))
- feat: add support for auto import component from .ts sources ([#1643](https://github.com/vuejs/language-tools/issues/1643))
- feat: add `Server Stats` command for debugging loading files
- feat: add `volar.completion.normalizeComponentAutoImportName` setting to support remove `Vue` ending for component auto import ([#82](https://github.com/vuejs/language-tools/issues/82))
- feat: add `volar.vueserver.diagnosticModel` setting to support pull model for diagnostic
- feat: add `experimentalUseElementAccessInTemplate` setting in vueCompilerOptions for class component supports ([#997](https://github.com/vuejs/language-tools/issues/997))
- feat: migrated to standard token types for support semantic tokens IDE other than VSCode
- feat: register file watchers in language server for support IDE other than VSCode ([#2037](https://github.com/vuejs/language-tools/issues/2037))
- perf: load scripts on demand on inferred project
- fix(doctor): update valid `@types/node` version and clarity words ([#2043](https://github.com/vuejs/language-tools/issues/2043))
- fix: avoid language server crash by invalid tsconfig references path ([#1957](https://github.com/vuejs/language-tools/issues/1957))
- fix: `LanguageServicePlugin` error don'ts reporting
- fix: SCSS At-Rule autocomplete not working
- fix: intellisense not working for files path start with `.` ([#1147](https://github.com/vuejs/language-tools/issues/1147))
- fix: avoid reporting partial diagnostic when failed to update cache range
- fix: formatting not working for template interpolations ([#2026](https://github.com/vuejs/language-tools/issues/2026))
- fix: file watchers not working ([#2028](https://github.com/vuejs/language-tools/issues/2028))
- fix: document version of code action incorrect ([#2025](https://github.com/vuejs/language-tools/issues/2025))
- fix: don't filter `onXxx` for props autocomplete ([#2034](https://github.com/vuejs/language-tools/issues/2034))
- fix: import statements completion not working (https://github.com/vuejs/language-tools/issues/1983#issuecomment-1278778898)
- fix: server throwing errors due to component auto import completion canceled ([#1983](https://github.com/vuejs/language-tools/issues/1983))
- fix: expand selection does not work correctly in `<template>` ([#1465](https://github.com/vuejs/language-tools/issues/1465))
- fix: component tags messes with duplicate name template properties ([#2030](https://github.com/vuejs/language-tools/issues/2030))
- fix: improve invalid content trimming in .md files for VitePress
- fix: avoid language server throwing when changing built-in TS plugin activation


## 1.0.8 (2022/10/15)

- feat: support for twoslash queries (https://github.com/volarjs/services/issues/9)
- feat: support `generic` attribute auto-complete
- feat: add `volar.vueserver.noProjectReferences` setting for support jump to source files from reference projects ([#1344](https://github.com/vuejs/language-tools/issues/1344))
- fix: SFC parse failed if script content including `<script>` ([#1982](https://github.com/vuejs/language-tools/issues/1982))
- fix: avoid report type error for invalid component without enable `jsxTemplates` ([#2007](https://github.com/vuejs/language-tools/issues/2007))
- fix: intrinsic tag highlight should only including open tag and close tag ([#2009](https://github.com/vuejs/language-tools/issues/2009))
- fix: component type should take capitalize property takes precedence over camelize property from context ([#2010](https://github.com/vuejs/language-tools/issues/2010))
- fix: references codeLens should not including sources on display (https://github.com/vuejs/language-tools/issues/1989#issuecomment-1277585337)

## 1.0.7 (2022/10/13)

- feat(vue-language-core): support custom v-model prefix ([#2004](https://github.com/vuejs/language-tools/issues/2004))
- feat: allow passing attributes array for `experimentalModelPropName` ignore setting ([#1821](https://github.com/vuejs/language-tools/issues/1821))
- fix: `@volar/vue-language-plugin-pug` cause to doctor warns in Vue 2.7 project ([#2002](https://github.com/vuejs/language-tools/issues/2002))
- fix: mitigate virtual file mapping highlights dislocation
- fix: tag hover not working when enabled `jsxTemplates`
- fix: avoid convert invalid JSX type to any when enabled `jsxTemplates`
- fix: component JSX type invalid when enabled `jsxTemplates` but template has no any slots
- perf: try skip convert attribute value to unicode

## 1.0.6 (2022/10/12)

- fix: component ast broken when use script setup with `export default` ([#1996](https://github.com/vuejs/language-tools/issues/1996))
- fix: `experimentalModelPropName` link invalid ([#1999](https://github.com/vuejs/language-tools/issues/1999))
- fix: `@volar/pug-language-service` crash ([#2000](https://github.com/vuejs/language-tools/issues/2000))

## 1.0.5 (2022/10/12)

- feat(doctor): report warning for `@types/node` version `>= 18.8.1` ([#1985](https://github.com/vuejs/language-tools/issues/1985))
- fix: `@volar-examples/svelte-tsc`, `@volar-examples/svelte-typescript` released empty dist
- fix: component syntax minor defect when enabled `experimentalRfc436`
- fix: force use VSCode display language in language server ([#1959](https://github.com/vuejs/language-tools/issues/1959))
- fix: don't hoisting defineProps type arg when disabled `experimentalRfc436` ([#1994](https://github.com/vuejs/language-tools/issues/1994))

## 1.0.4 (2022/10/12)

- feat: Support generic typed template slots for RFC 436 ([#1987](https://github.com/vuejs/language-tools/issues/1987))
- feat: add `resolveTemplateCompilerOptions` API for `VueLanguagePlugin`
- feat: support intellisense for `generic` attribute ([#1967](https://github.com/vuejs/language-tools/issues/1967))
- feat: add `Show Component Meta` command for inspect `vue-component-meta` result
- feat: add `vueCompilerOptions.experimentalModelPropName` for customize `v-model` binding prop for vue 2 component ([#1969](https://github.com/vuejs/language-tools/issues/1969))
- fix: `TypeScript Vue Plugin (Volar)` stop working
- fix: change `vueCompilerOptions.dataAttributes` default value from `["data-*"]` to `[]` ([#1965](https://github.com/vuejs/language-tools/issues/1965))
- fix: component props order should be on the top ([#1972](https://github.com/vuejs/language-tools/issues/1972))
- fix: `@volar/vue-language-plugin-pug` crash due to missing depend
- fix: component tag highlight not working for pug template ([#1977](https://github.com/vuejs/language-tools/issues/1977))
- fix: references codeLens number incorrect ([#1989](https://github.com/vuejs/language-tools/issues/1989))

**Breaking changes**

- Removed `experimentalTemplateCompilerOptions`, `experimentalTemplateCompilerOptionsRequirePath` from `vueCompilerOptions` ([#1991](https://github.com/vuejs/language-tools/issues/1991))

## 1.0.3 (2022/10/10)

- feat: support `as` expressions in export assignment for script setup ([#1882](https://github.com/vuejs/language-tools/issues/1882))
- feat: support RFC 436 with new option `vueCompilerOptions.experimentalRfc436` ([#1964](https://github.com/vuejs/language-tools/issues/1964)) (https://github.com/vuejs/rfcs/discussions/436)

## 1.0.2 (2022/10/9)

- fix: `TypeScript Vue Plugin (Volar)` breaks VSCode tsserver ([#1956](https://github.com/vuejs/language-tools/issues/1956))
- fix: pug intellisense not working
- fix: semantic tokens confused git diff window (https://github.com/vuejs/language-tools/issues/1946#issuecomment-1272430742)
- fix(doctor): cannot resolve `vueCompilerOptions` from extends tsconfig
- fix(doctor): cannot resolve vue version from sub folder ([#1961](https://github.com/vuejs/language-tools/issues/1961)) ([#1962](https://github.com/vuejs/language-tools/issues/1962))
- fix: scoped class name no longer displays underline ([#1960](https://github.com/vuejs/language-tools/issues/1960))

## 1.0.1 (2022/10/9)

- feat(doctor): added more postcss syntax highliters ([#1945](https://github.com/vuejs/language-tools/issues/1945))
- fix(doctor): `@vue/compiler-dom` missing message incorrect ([#1953](https://github.com/vuejs/language-tools/issues/1953))
- fix: name casing tool typo ([#1941](https://github.com/vuejs/language-tools/issues/1941))
- fix: takeover mode document link incorrect ([#1944](https://github.com/vuejs/language-tools/issues/1944))
- fix: code color disordered if .ts script do not include to tsconfig ([#1946](https://github.com/vuejs/language-tools/issues/1946))
- fix: cannot start language server if worksapce tsdk path invalid ([#1942](https://github.com/vuejs/language-tools/issues/1942))
- fix: "Show Virtual Files" command not working for .md / .html
- fix: tag autocomplete add duplicated import if the tag not use in template ([#1952](https://github.com/vuejs/language-tools/issues/1952))
- fix: template AST broken when input space after tag name
- fix: don't use native event type for component ([#1948](https://github.com/vuejs/language-tools/issues/1948)) ([#1951](https://github.com/vuejs/language-tools/issues/1951))
- fix: command + hover `@click` cannot show selection range

## 1.0.0 (2022/10/7)

## 1.0.0-rc.5 (2022/10/7)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- fix: "Reload Project" command do not update diagnostics
- feat: use svelte2tsx for svelte language server example ([#1940](https://github.com/vuejs/language-tools/issues/1940))

## 1.0.0-rc.4 (2022/10/6)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- fix: html / css custom data not working (https://github.com/vuejs/language-tools/issues/707#issuecomment-1268513358)
- fix: should not show tsconfig / name casing on status bar for md / html by default
- fix: cannot watch *.ts changes without takeover mode (https://github.com/vuejs/language-tools/issues/1880#issuecomment-1269466716)

## 1.0.0-rc.3 (2022/10/5)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat: support .cjs, .mjs, .cts, .mts on takeover mode ([#1928](https://github.com/vuejs/language-tools/issues/1928))
- fix: multiple style attributes report false positive error ([#1929](https://github.com/vuejs/language-tools/issues/1929))

## 1.0.0-rc.0 (2022/10/5)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat(vue-component-meta): add file update apis for support HMR ([#1889](https://github.com/vuejs/language-tools/issues/1889))
- feat: add `dataAttributes`, `htmlAttributes` options for vueCompilerOptions ([#1871](https://github.com/vuejs/language-tools/issues/1871))
- feat: support for `typescript.autoImportFileExcludePatterns`

**Breaking changes**

- Some `vueCompilerOptions` perperties leave experimental
  - `experimentalComponentOptionsWrapper` -> `optionsWrapper`
  - `experimentalAllowTypeNarrowingInInlineHandlers` -> `narrowingTypesInInlineHandlers`
  - `experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup` -> `bypassDefineComponentToExposePropsAndEmitsForJsScriptSetupComponents`

## 1.0.0-beta.6 (2022/10/4)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- fix: vue-language-server not release

## 1.0.0-beta.5 (2022/10/4)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat: show plugin path in output of `vueCompilerOptions.plugins` if it failed to load
- fix: document symbols not working in IDE other than VSCode ([#1925](https://github.com/vuejs/language-tools/issues/1925))
- fix: hover info cannot show after save document (https://github.com/vuejs/language-tools/issues/1880#issuecomment-1266343050)
- fix: cannot show "No tsconfig"

## 1.0.0-beta.4 (2022/10/4)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat: support document doctor for common problems checking ([#1254](https://github.com/vuejs/language-tools/issues/1254))
- feat: add "Show Virtual Files" command for debug virtual code and mapping

## 1.0.0-beta.3 (2022/10/3)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat: support `ParseSFCRequest` LSP request for parse SFC to avoid language client depend on `@vue/compiler-sfc`
- feat: add `VueServerInitializationOptions#cancellationPipeName` option for language client cancellation token supports
- feat: remove second semantic language server and `volar.vueserver.useSecondServer` setting
- perf: cancel asynchronous request via named pipes (https://github.com/vuejs/language-tools/pull/1916#issuecomment-1264709112)
- chore: change extension icon to Vue logo
- chore: optimize bunding (2.2MB -> 975KB)

## 1.0.0-beta.2 (2022/9/30)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

**Breaking changes**

- Update VueLanguagePlugin API to v1.0 ([Example](https://github.com/johnsoncodehk/muggle-string#usage))
- Update language server `initializationOptions` interface ([#1916](https://github.com/vuejs/language-tools/issues/1916))

## 1.0.0-beta.1 (2022/9/27)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat: support autocomplete for `v-model:xxx`
- feat: simplify status bar
- feat: support prop name case conversion in the status bar
- feat: remove "auto", "both" and add "auto-kebab", "auto-pascal" for `volar.completion.preferredTagNameCase`
- fix: cannot resolve `compilerOptions.types` from a higher level directory in a workspace sub directory ([#1764](https://github.com/vuejs/language-tools/issues/1764))
- fix: should not trigger autocomplete lang attribute in templates ([#1836](https://github.com/vuejs/language-tools/issues/1836))
- fix: cannot trigger autocomplete end with `v-xxx` ([#1905](https://github.com/vuejs/language-tools/issues/1905))
- fix: auto insert parentheses remove `$x` from `$x as y`
- fix: auto insert parentheses not working on props

## 1.0.0-beta.0 (2022/9/25)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- perf: reduce input files to improve performance for large project
- fix: template incremental update not working

## 1.0.0-alpha.5 (2022/9/25)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- fix: language server crash on diagnosis `<style lang="postcss">` ([#1902](https://github.com/vuejs/language-tools/issues/1902))
- fix: template tags selection range incorrect with definition

## 1.0.0-alpha.4 (2022/9/24)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- fix: iterating `Symbol.Iterator` is not correctly inferred in `v-for` ([#1892](https://github.com/vuejs/language-tools/issues/1892))
- fix: false positive error on `<CustomComponent @click.stop />` ([#464](https://github.com/vuejs/language-tools/issues/464#issuecomment-1159303260))
- perf: improve for large template memory usage
- perf: improve for monorepo project memory usage

**Breaking changes**

- vueCompilerOptions property `experimentalDisableTemplateSupport` renamed to `skipTemplateCodegen`

## 1.0.0-alpha.3 (2022/9/21)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- fix: don't ignore `@vue/compiler-dom` compile errors for vue2 templates
- fix: cannot start language server with `@volar/vue-language-server` since v1.0.0-alpha.0 ([#1888](https://github.com/vuejs/language-tools/issues/1888))

## 1.0.0-alpha.2 (2022/9/21)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat: add less support for initial indent ([#1883](https://github.com/vuejs/language-tools/issues/1883))
- feat: use `vue-template-compiler` instead of `@vue/compiler-dom` to collect template errors for target < 3
- fix: moving components doesn't trigger import updates ([#1884](https://github.com/vuejs/language-tools/issues/1884))

## 1.0.0-alpha.1 (2022/9/17)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- fix: `vue-tsc` depends version resolve failed ([#1881](https://github.com/vuejs/language-tools/issues/1881))

## 1.0.0-alpha.0 (2022/9/16)

[[Download](https://github.com/vuejs/language-tools/issues/1880)]

- feat: framework agnostic language server ([#1859](https://github.com/vuejs/language-tools/issues/1859))
- feat: improve `.value` auto insert invalid location filting
- feat: add `vueCompilerOptions.jsxTemplates` for more fault tolerant template ([#1865](https://github.com/vuejs/language-tools/issues/1865))
- feat: add `volar.vueserver.petiteVue.processHtmlFile`, `volar.vueserver.vitePress.processMdFile` to config language support for petite-vue, VitePress ([#1878](https://github.com/vuejs/language-tools/issues/1878))
- fix: template context types broken with `"moduleResolution": "nodenext"` ([#1862](https://github.com/vuejs/language-tools/issues/1862))
- fix: language server throw when use `lang="js"` without `"allowJs": true`
- fix: auto `.value` failed if position immediately after another property `.value` access expression ([#1853](https://github.com/vuejs/language-tools/issues/1853))
- fix: language onEnterRules, increaseIndentPattern incorrect in `<script>`, `<style>` ([#1847](https://github.com/vuejs/language-tools/issues/1847))
- fix: source-map vue version inconsistent ([#1874](https://github.com/vuejs/language-tools/issues/1874))
- fix: fix pug tag offset ([#1783](https://github.com/vuejs/language-tools/issues/1783))

**Breaking changes**

- Remove Alpine extension ([#1858](https://github.com/vuejs/language-tools/issues/1858))
- No built-in support for pug template anymore, if you have use pug with vue-tsc before, please follow below changes:

`package.json`
```
{
	"devDependencies": {
-		"@volar/pug-language-service": "latest"
+		"@volar/vue-language-plugin-pug": "latest"
	}
}
```

`tsconfig.json`
```
{
	"vueCompilerOptions": {
		"plugins": ["@volar/vue-language-plugin-pug"]
	}
}
```
