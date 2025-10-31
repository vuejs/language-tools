## 2.2.10 <sup>official</sup> (2025-04-22)

## Bug Fixes

- fix(language-core): generate condition guards for model events (#5225) - Thanks to @KazariEX!
- fix(language-core): prevent global types generation in declaration files (#5239) - Thanks to @KazariEX!
- fix(language-core): prevent eager inference of slot props from generics (#5247) - Thanks to @KazariEX!
- fix(typescript-plugin): prevent highlighting native element tags with same name as components (#5253) - Thanks to @KazariEX!

## 2.2.8 <sup>official</sup>, 2.2.9 <sup>insiders</sup> (2025-03-02)

### Bug Fixes

- revert "fix(language-core): validate `v-model` variable against model type"

## 2.2.6 <sup>official</sup>, 2.2.7 <sup>insiders</sup> (2025-03-01)

### Features

- feat(language-core): infer prop JSDoc from `defineModel`'s leading comments (#5211) - Thanks to @KazariEX!

### Bug Fixes

- fix(language-core): map camelized prop name correctly (#5207) - Thanks to @KazariEX!
- fix(component-meta): resolve `defineModel` options to collect `default` value (#5209) - Thanks to @KazariEX!
- fix(language-core): avoid duplicate generation of `defineExpose`'s codes - Thanks to @KazariEX!
- fix(language-core): generate camelized prop name for `defineModel` (#5213) - Thanks to @KazariEX!
- fix(language-core): validate `v-model` variable against model type (#5214) - Thanks to @KazariEX!
- fix(language-core): use keywords instead of semicolons to separate script sections (#5217) - Thanks to @KazariEX!

### Other Changes

- ci: auto close issues with `can't reproduce` label - Thanks to @KazariEX!
- refactor(language-core): defer the calculation of `linkedCodeMappings` offsets (#5220) - Thanks to @KazariEX!

## 2.2.4 <sup>official</sup>, 2.2.5 <sup>insiders</sup> (2025-02-22)

### Features

- feat(language-service): map sfc compiler errors outside the template inner content (#5045) - Thanks to @KazariEX!
- feat(language-core): introduce options to control type inference of `$attrs`, `$el`, `$refs` and `$slots` (#5135) - Thanks to @KazariEX!
- feat(language-core): enhance single root nodes collection (#4819) - Thanks to @KazariEX!

### Bug Fixes

- fix(language-core): move `generateSfcBlockSection` to the end to fix missing comma errors (#5184) - Thanks to @zhiyuanzmj!
- fix(language-core): handle edge case of default slot name mismatch - Thanks to @KazariEX!
- fix(language-core): combine dollar variable keys from the upper level interface - Thanks to @KazariEX!
- fix(language-core): hoist the variables that may cause `TS4081` (#5192) - Thanks to @KazariEX!
- fix(language-core): adjust regex match for `@vue-generic` to improve offset calculation (#5193) - Thanks to @Gehbt!
- fix(language-core): correct codegen of native element refs - Thanks to @KazariEX!
- fix(language-core): ignore latex block content (#5151) - Thanks to @KazariEX!
- fix(language-core): do not emit `undefined` for model with default value (#5198) - Thanks to @RylanBueckert-Broadsign!
- fix(language-service): typescript-semantic renaming first in style blocks (#4685) - Thanks to @KazariEX!
- fix(typescript-plugin): prevent removed components from appearing in the completion list - Thanks to @KazariEX!

### Other Changes

- refactor(language-core): drop invalid `v-scope` implemention - Thanks to @KazariEX!
- refactor(language-core): improve type declaration of `v-for` - Thanks to @KazariEX!
- test: enable `declaration` to track more errors - Thanks to @KazariEX!
- refactor(language-core): remove semantic highlight of style module names - Thanks to @KazariEX!
- chore(language-core): add docs for `@vue-expect-error` support (#5176) - Thanks to @machty!
- ci: upload extension as artifact for each commit - Thanks to @KazariEX!

## 2.2.2 <sup>official</sup>, 2.2.3 <sup>insiders</sup> (2025-02-15)

### Features

- feat(language-core): navigation support for `$attrs`, `$slots`, `$refs` and `$el` in the template (#5056) - Thanks to @KazariEX!
- feat(language-service): support global directives completion (#4989) - Thanks to @KazariEX!
- feat(language-core): type support of `useAttrs` (#5106) - Thanks to @KazariEX!
- feat(language-core): add options for fine-grained configuration of `strictTemplates` (#5138)
- feat(language-service): display deprecated info of props in completion (#5134) - Thanks to @KazariEX!
- feat(component-meta): collect destructured props defaults (#5101) - Thanks to @Akryum!
- feat(language-core): add `checkUnknownDirectives` option (#5141) - Thanks to @KazariEX!
- feat(language-core): support `<script vapor>` - Thanks to @KazariEX!

### Bug Fixes

- fix(language-core): ignore ts errors in function-scoped declare expressions (#5090) - Thanks to @zhiyuanzmj!
- fix(language-core, typescript-plugin): handle self-reference component correctly (#5102) - Thanks to @KazariEX!
- fix(language-core): do not generate element for `<template>` with `v-slot` (#5077) - Thanks to @KazariEX!
- fix(language-service): set code action kinds to avoid warning (#5096) - Thanks to @KazariEX!
- fix(language-core): handle parentheses in v-for exp
- fix(language-core): slot exp formatting virtual code syntax incorrect
- fix(language-core): arrow function formatting virtual code syntax incorrect in interpolation
- fix(language-core): improve multiple lines event formatting result
- fix(language-core): prefer `loc.source` instead of node content
- fix(language-core): intersect local `$attrs` with `__VLS_ctx.$attrs` (#5113) - Thanks to @KazariEX!
- fix(language-core): only generate model modifiers for components - Thanks to @KazariEX!
- fix(language-plugin-pug): ignore duplicate attribute error of `class` (#5100) - Thanks to @KazariEX!
- fix(language-core): align types of `v-for` with core (#5084) - Thanks to @KazariEX!
- fix(language-core): map interpolation error with multiple variables correctly (#5158) - Thanks to @KazariEX!
- fix(vscode): ask user to reload extension host when configuration changes (#5160) - Thanks to @typed-sigterm!
- fix(typescript-plugin): update component names correctly for the first time - Thanks to @KazariEX!
- fix(language-core): add `undefined` to first param type of optional model emits (#5171) - Thanks to @KazariEX!
- fix(language-core): intersect `__VLS_slots` with `__VLS_ctx.$slots` (#5083) - Thanks to @KazariEX!
- fix(language-core): complete codegen of slot name prop (#5139) - Thanks to @KazariEX!

### Other Changes

- refactor(language-service): read ast from codegen instead of parsing it repeatedly (#5086) - Thanks to @KazariEX!
- refactor(language-core): rewrite `vueCompilerOptions` resolution logic
- refactor(component-meta): read `scriptSetupRanges` from codegen - Thanks to @KazariEX!
- refactor(component-meta): read node directly instead of creating sub ast - Thanks to @KazariEX!
- refactor(component-meta): read ast from `sfc.script` - Thanks to @KazariEX!
- refactor(language-core): generate the type of slots with function property (#5173) - Thanks to @KazariEX!
- refactor(language-core): reduce codegen size of template returns - Thanks to @KazariEX!
- refactor(language-core): remove semantic highlight of directives - Thanks to @KazariEX!
- refactor: update alien-signals to 1.0.3 (#5181) - Thanks to @KazariEX!

## 2.2.0 <sup>official</sup>, 2.2.1 <sup>insiders</sup> (2024-12-24)

### Features

- feat(language-core): support `@vue-generic` (#4971) - Thanks to @KazariEX!
- feat(vscode): add configuration for skipping automatic detection of Hybrid Mode (#5046) - Thanks to @KazariEX!
- feat(language-service): crawl html data of `data-allow-mismatch` - Thanks to @KazariEX!
- feat(language-core): type support of `$attrs` (#5076) - Thanks to @KazariEX!
- feat(language-core): type support of `useSlots` and `$slots` (#5055) - Thanks to @KazariEX!
- feat(language-core): type support of `v-model` modifiers (#5061) - Thanks to @KazariEX!
- feat(language-service): process references data at runtime to reduce bundle size (#5054) - Thanks to @KazariEX!
- feat(language-core): support the use of sfc root comment to configure `vueCompilerOptions` (#4987) - Thanks to @KazariEX!
- feat(vscode): add timeout logic for insiders fetching (#5048) - Thanks to @KazariEX!
- feat(vscode): add examples to inlay hints configuration (#5068) - Thanks to @KazariEX!

### Performance

- perf(typescript-plugin): use named pipe servers more efficiently (#5070)

### Bug Fixes

- fix(language-core): generate script setup starting from last leading comment without `@ts-check` - Thanks to @KazariEX!
- fix(language-core): make model modifiers optional (#4978) - Thanks to @stafyniaksacha!
- fix(language-core): always report missing props on `<slot>` (#4982) - Thanks to @KazariEX!
- fix(language-core): avoid unchecked index access when parsing `defineEmits` (#5028) - Thanks to @KazariEX!
- fix(language-service): handle text edit of special closing tags completion correctly (#5016) - Thanks to @KazariEX!
- fix(language-core): don't generate variable access of template refs using `useTemplateRef` (#5032) - Thanks to @KazariEX!
- fix(vscode): update `enabledHybridMode` before activate extension (#5019) - Thanks to @nieyuyao!
- fix(tsc): point to shimmed tsc entry point to support ts 5.7 (#5020) - Thanks to @davidmatter!
- fix(vscode): add `GitHub.copilot-chat` to hybrid mode compatible list (#5047) - Thanks to @KazariEX!
- fix(language-core): generate generics normally when `useTemplateRef` has no parameters (#5051) - Thanks to @KazariEX!
- fix(language-core): avoid clipping prop name using `.prop` or `.attr` on `v-model` - Thanks to @KazariEX!
- fix(language-core): handle named default import of components correctly (#5066) - Thanks to @KazariEX!
- fix(language-core): disable navigation feature on non-binding prop values (#5040) - Thanks to @KazariEX!
- fix(language-core): do not generate `useTemplateRef` parameter repeatedly (#5009)
- fix(language-core): generate macros after script setup content (#5071) - Thanks to @KazariEX!
- fix(language-core): correct type and completion support of `vue:` event (#4969) - Thanks to @KazariEX!
- fix(language-core): prevent visiting functional components for `parseScriptSetupRanges` (#5049) - Thanks to @zhiyuanzmj!
- fix(language-service): don't provide modifier completion for `@` and `:` (#5052) - Thanks to @KazariEX!
- fix(language-core): consistent interpolation behavior of shorthand binding (#4975) - Thanks to @KazariEX!
- fix(language-core): resolve components with various name cases correctly (#5067) - Thanks to @KazariEX!
- fix(language-core): map `v-slot` correctly to report error when missing default slot - Thanks to @KazariEX!
- fix(language-core): map component loc to instance variable for verification - Thanks to @KazariEX!

### Other Changes

- refactor: improve code consistency (#4976) - Thanks to @KazariEX!
- docs: update nvim guide (#4984) - Thanks to @zeromask1337!
- docs: fix broken marketplace page (#5004) - Thanks to @rioj7!
- chore: upgrade `reactive-vscode` to v0.2.7 (#4997) - Thanks to @KermanX!
- refactor(language-service): consistent style of source and virtual code operation (#5053) - Thanks to @KazariEX!
- refactor(language-core): remove unnecessary linked code mappings of `defineProp` (#5058) - Thanks to @KazariEX!
- refactor(language-core): simplify current component info passing (#5078) - Thanks to @KazariEX!
- Upgraded Volar from `v2.4.8` to `v2.4.11`:
  - fix(typescript): avoid crash when converting relatedInformation from overly large files
  - fix(typescript): fix interactive refactors (https://github.com/volarjs/volar.js/pull/244) - Thanks to @andrewbranch!
  - fix(typescript): should not suppressing getLanguageId crashes (https://github.com/volarjs/volar.js/issues/253)
  - fix(typescript): force update the opened script snapshot after the language plugin is ready (https://github.com/volarjs/volar.js/issues/254)
  - feat(typescript): add typescriptObject option to runTsc (https://github.com/volarjs/volar.js/pull/245) - Thanks to @zhiyuanzmj!
  - fix(typescript): fix issue with transpiled TypeScript files not being registered with a project at all (https://github.com/volarjs/volar.js/pull/250) - Thanks to @piotrtomiak!
  - docs(source-map): updated API section based on #207 (https://github.com/volarjs/volar.js/pull/248) - Thanks to @alamhubb!
  - fix(typescript): resolve the shim used for tsc in Typescript v5.7 and up (#252) - Thanks to @kitsune7!

## 2.1.10 <sup>official</sup>, 2.1.11 <sup>insiders</sup> (2024-10-31)

### Features

- **language-service:** auto insert `const props =` with `props` completion (#4942) - Thanks to @KazariEX!

### Bug Fixes

- **language-core:** revert #4902
- **language-core:** inject `as` assertion of `useCssModule` into correct location (#4952) - Thanks to @KazariEX!
- **language-core:** hold prev track id correctly (#4961) - Thanks to @KazariEX!
- **language-core:** generate style modules type as needed (#4953) - Thanks to @KazariEX!
- **language-core:** reference global types file with relative path (#4966)

### Refactors

- **vscode:** rewrite with [Reactive VSCode](https://kermanx.github.io/reactive-vscode/) (#4945) - Thanks to @KazariEX, @KermanX!

## 2.1.8 <sup>official</sup>, 2.1.9 <sup>insiders</sup> (2024-10-26)

### Features

- **vscode:** reactions visualization now identifies more use cases <sup>Insiders</sup>
- **language-core:** auto infer `$el` type (#4805) - Thanks to @KazariEX!
- **language-core:** typed directive arg and modifiers (#4813) - Thanks to @KazariEX!

### Bug Fixes

- **language-core:** avoid generic type loss due to destructured props (#4821) - Thanks to @KazariEX!
- **language-core:** handle `v-for` with `v-once` correctly (#4830) - Thanks to @KazariEX!
- **language-core:** avoid generating zero-length mappings for interpolation edges
- **language-core:** don't assign `this` to `__VLS_ctx` (#4845) - Thanks to @KazariEX!
- **language-service:** initialize scope with null prototype object (#4855) - Thanks to @KazariEX!
- **language-core:** inlay hints for `<component :is>` and `<slot :name>` (#4661) - Thanks to @KazariEX, @so1ve!
- **language-core:** should error when invalid syntax at script end (#4692) - Thanks to @KazariEX!
- **language-core:** correct type inference of `defineModel` & `defineEmits` in generic (#4823) - Thanks to @KazariEX!
- **language-core:** inject generics of `useTemplateRef` into correct location (#4829) - Thanks to @KazariEX!
- **language-core:** prevent the generation of generics in JS (#4836) - Thanks to @KazariEX, @zhiyuanzmj!
- **language-core:** generate correct reference for `v-on` on `<slot>` (#4864) - Thanks to @KazariEX!
- **language-core:** match classname before `)` (#4887) - Thanks to @KazariEX!
- **language-service:** handle internal item key with leading slash correctly (#4894) - Thanks to @KazariEX!
- **language-core:** correctly obtain the index of style modules (#4907) - Thanks to @KazariEX!
- **language-core:** refer absolute path of global types file (#4924) - Thanks to @depressedX!
- **component-meta:** error when signatures is undefined (#4930) - Thanks to @Hannesrasmussen!
- **language-core:** intersect props of generic component with attrs (#4886) - Thanks to @KazariEX!
- **language-core:** fix incorrect syntax for class component virtual code
- **language-core:** generate `value` instead of model name into tuple (#4892) - Thanks to @KazariEX!
- **language-core:** infer template ref's type of native elements with `v-for` correctly (#4933) - Thanks to @KazariEX!
- **language-core:** should wrap item with `Reactive` on `v-for` (#4902) - Thanks to @KazariEX!

### Performance

- **language-service:** find destructured props only with enabled setting (#4815) - Thanks to @KazariEX!

### Other Changes

- Upgraded Volar from `v2.4.1` to `v2.4.8`:
  - Changing vue files causes internal state to desync in Sublime Text (#4909) - Thanks to @rchl!
  - The syntax highlighting is not applied when destructuring props (#4811)
- chore: fix nvim config snippet in README (#4881) - Thanks to @LiamEderzeel!
- chore: remove side effects (#4871) - Thanks to @vikingair!
- chore: remove `importsNotUsedAsValues` (#4897) - Thanks to @KazariEX!
- chore(vscode): switch to `"module": "CommonJS"` (#4944) - Thanks to @KazariEX!
- test: fix incorrect default value (#4934) - Thanks to @jh-leong!
- test(tsc): add a test case for class component

## 2.1.6 <sup>official</sup>, 2.1.7 <sup>insiders</sup> (2024-09-05)

### Features

- **language-plugin-pug:** support initial indentation (#4774)
- **language-service:** JSDoc display support when typing props on component template (#4796) - Thanks to @joy-yu!
- **language-core:** typed directives in template (#4807) - Thanks to @KazariEX!

### Bug Fixes

- **language-core:** wrap template refs with `unref` in interpolation (#4777) - Thanks to @KazariEX!
- **language-core:** ensure to pass tsc on inline global types (#4782) - Thanks to @KazariEX!
- **language-core:** infer native template ref as build-in element interface (#4786) - Thanks to @KazariEX!
- **language-core:** generate `__VLS_StyleModules` after template (#4790) - Thanks to @KazariEX!
- **language-core:** make `expose` of non-generic template ref required (#4795) - Thanks to @zhiyuanzmj!
- **language-core:** avoid using `__typeProps` with runtime props (#4800) - Thanks to @KazariEX!
- **language-core:** ignore unknown attrs error when strictTemplates is not enabled (#4785)
- **language-core:** prevent append globalTypes to virtual file (#4806) - Thanks to @zhiyuanzmj!
- **language-core:** prevent type error when use defineSlots and non-template (#4809) - Thanks to @zhiyuanzmj!
- **typescript-plugin:** disconnect socket on error (#4672)

### Performance

- **language-core:** don't emit event lnlayhint when content is none (#4776) - Thanks to @Gehbt!

### Other Changes

- **language-core:** split `__VLS_templateResult` (#4781) - Thanks to @KazariEX!
- **language-core:** wrap template virtual code into a function (#4784)
- **language-core:** move `templateRef` into `composables` (#4791) - Thanks to @KazariEX!
- **language-core:** generate global types for the first parsed Vue component if cannot write global types file

### Tests

- **language-server:** add renaming case for template `ref()` (#4794) - Thanks to @KazariEX!
- **tsc:** update to Vue 3.5 (#4725)
- **tsc:** unknown props on non-strict generic component (#4792)

## 2.1.4 <sup>official</sup>, 2.1.5 <sup>insiders</sup> (2024-09-01)

### Features

- **typescript-plugin, language-server:** generate global types file into `node_modules/.vue-global-types` (#4752) - Thanks to @KazariEX!
- **language-core:** navigation support for template-ref (#4726) - Thanks to @KazariEX!

### Bug Fixes

- **language-core, typescript-plugin, language-server:** apply snake case on globalTypes filename (#4749) - Thanks to @KazariEX!
- **language-core:** hoist `$refs` type (#4763)
- **language-core:** disable lib check on global types file (#4767) - Thanks to @KazariEX!
- **language-core:** prevent circular reference of templateRef (#4768) - Thanks to @zhiyuanzmj!
- **language-core:** using interface merging for `GlobalComponents`
- **language-core:** `fallthroughAttributes` causes global components to be self-referential (#4761)
- **language-core:** auto-completion for the last line of template block (#4771) - Thanks to @zhiyuanzmj!
- **language-core:** update ast correctly on repeated `v-for` modifications (#4772) - Thanks to @KazariEX!
- **language-server:** leaking named pipes (#4672)
- **typescript-plugin:** compatible with Yarn PnP (#4751)
- **vscode:** whitelist `ms-dynamics-smb.al` extension for Vue Hybrid Mode. (#4765) - Thanks to @kyleweishaupt!

### Other Changes

- Add optional "dependencies" textarea to issue template (#4758) - Thanks to @davidmatter!

## 2.1.2 <sup>official</sup>, 2.1.3 <sup>insiders</sup> (2024-08-29)

### Bug Fixes

- **language-core, typescript-plugin, language-server:** write globalTypes into dist for correct export (#4740) (#4737) (#4738) (#4739) - Thanks to @KazariEX!
- **language-core:** don't default `vueCompilerOptions.lib` to `@vue/runtime-dom` for Vue 2

## 2.1.0 <sup>official</sup>, 2.1.1 <sup>insiders</sup> (2024-08-29)

### Features

- **language-core:** inlay hints for destructured props (#4634) - Thanks to @KazariEX!
- **language-core:** typed fallthrough attributes (#4103) - Thanks to @A5rocks, @so1ve!
- **language-core:** document links for classname within `:class` (#4642) - Thanks to @KazariEX!
- **language-core:** auto infer type for $refs & useTemplateRef (#4644) - Thanks to @zhiyuanzmj!
- **language-core:** type support for CSS Modules API (#4674) - Thanks to @KazariEX!
- **language-service:** better completion for directives (#4640) - Thanks to @KazariEX!
- **language-service:** better sorting & filtering of completion (#4671) - Thanks to @KazariEX!
- **language-service:** add style scoped and module completion (#4705) - Thanks to @runyasak!

### Bug Fixes

- **vscode:** type of `vue.server.hybridMode` config (#4703) - Thanks to @KermanX!
- **language-core:** dependency on vulnerable version of `vue-template-compiler` (#4613) - Thanks to @yyx990803!
- **language-core:** support parse method to access ctx var in object (#4609) - Thanks to @linghaoSu!
- **language-core:** escape \ and ' in className avoid type error (#4619) - Thanks to @linghaoSu!
- **language-core:** semantic highlight of the end tag of namespaced elements (#4623) - Thanks to @KermanX!
- **language-core:** nullable modelvalues (#4648) - Thanks to @davidmatter!
- **language-core:** should try casting dynamic slot name into constant (#4669) - Thanks to @KermanX!
- **language-core:** local name support for prop using runtime api (#4650) - Thanks to @KazariEX!
- **language-core:** optimize matching of scoped class and `v-bind()` (#4679) - Thanks to @KazariEX!
- **language-core:** should preserve generic info in directive (#4686) - Thanks to @KermanX!
- **language-core:** generate `ref` as identifier instead of interpolation (#4688) - Thanks to @KazariEX!
- **language-core:** correct type narrowing from script to template (#4689) - Thanks to @KazariEX!
- **language-core:** should camelize prop name in `experimentalModelPropName` (#4691) - Thanks to @KermanX!
- **language-core:** drop duplicate hints on incomplete tag (#4696) - Thanks to @KazariEX!
- **language-core:** correct inlay hints for v-bind with modifier (#4721) - Thanks to @KazariEX!
- **language-core:** transform range of `file-md` correctly (#4735) - Thanks to @KazariEX!
- **language-plugin-pug:** should cache proxyed object (#4626) - Thanks to @KermanX!
- **language-plugin-pug:** compute offset correctly of pug class (#4652) - Thanks to @KazariEX!
- **language-service:** completion documentations for binding attributes (#4667) - Thanks to @KazariEX!
- **language-service:** avoid converting internal id of special tags (#4643) - Thanks to @KazariEX!
- **language-service:** reinstate the completion for modifiers (#4639) - Thanks to @KazariEX!
- **language-service:** consistent data from provider for sfc completion (#4645) - Thanks to @KazariEX!
- **typescript-plugin:** unknown request type warning (#4715) - Thanks to @davidmatter!

### Refactors

- **language-core:** extract SFC root tags to separate virtual code
- **language-core:** removed `__hint` trick from codegen
- **language-core:** rewrite a part of confusing codegen code
- **language-core:** reduce virtual code generated by component tags (#4714)
- **language-core:** do not wrap template virtual code with function (#4731)
- **language-core**: write real files to FS for shared global types (#4736)
- **component-meta:** remove deprecated `createComponentMetaCheckerByJsonConfig`, `createComponentMetaChecker` api

### Other Changes

- Upgraded Volar from `v2.4.0-alpha.18` to `v2.4.1`:
  - Ensure unopened files are synced to project (#4711) (#4632) - Thanks to @davidmatter!
- **ci:** integrated [pkg.pr.new](https://github.com/stackblitz-labs/pkg.pr.new)
- **tsc:** test all typecheck cases in one tsconfig (#4723)
- **tsc:** add test for TS-next (#4724)
- **tsc:** add tests for for #3779, #3820 (#3838) - Thanks to @so1ve!
- **vscode:** add grammar test (#3861) - Thanks to @so1ve!
- **language-service:** migrate tests to `@volar/test-utils` (#4719)
- **language-core:** add scoped classes renaming case (#4727) - Thanks to @KazariEX!

## 2.0.28 <sup>official</sup>, 2.0.29 <sup>insiders</sup> (2024-07-22)

### Features

- **vscode:** focus mode <sup>Insiders</sup> (https://github.com/volarjs/insiders/pull/24)
- **language-core:** Plugin API 2.1
  - Added plugin hooks: `getLanguageId`, `isValidFile`, `parseSFC2`
  - Improve backward compatibility (#4585) - Thanks @zhiyuanzmj
- **language-core:** support default prop when using __typeProps (#4602) - Thanks @zhiyuanzmj
- **language-core:** improve nested plugins (#4581) - Thanks @zhiyuanzmj
- **language-service:** remove `v-bind` code action (#4601)
- **vscode:** add empty pattern to codeblock attributes scope (#4590) - Thanks @KermanX

### Bug Fixes

- **tsc:** errors should be thrown instead of being console.log printed
- **language-server:** observe named pipes changes when server startup (#4292)
- **language-core:** infer define model type from options type (#4545) - Thanks @davidmatter
- **language-core:** type-checking not working with hyphen in slot name with JS (#4478) - Thanks @KermanX
- **language-core:** add type check for v-model without argument (#4598) - Thanks @zhiyuanzmj
- **language-service:** filter special tags (#4596) - Thanks @so1ve
- **typescript-plugin:** improve named pipes reliability (#4603)
- **language-core:** property access is incorrectly identified as compound expression (#4600)
- **language-core:** fix compatibility of generic component virtual code with TS 5.5 (#4577)
- **tsc:** TS4082 not reported for functional component (#4569)

### Other Changes

- Upgraded Volar from `v2.4.0-alpha.15` to `v2.4.0-alpha.18`:
  - Fix VS Code IntelliSense will be lost in new created files (#4424)
  - Add workspace symbols support in Hybrid Mode (#4595)
  - Add workspace `addMissingImports` action support in Hybrid Mode (#4586)
- Fix yarn 4 compatibility (#4587)
- Add vue vine to hybrid mode compatible list (#4543) - Thanks @so1ve
- Add global components prop validation test (#4542) - Thanks @davidmatter

## 2.0.26 <sup>official</sup>, 2.0.27 <sup>insiders</sup> (2024-07-04)

### Features

- **language-service:** Support auto-complete for more preprocessing languages.
- **language-core:** Improve type compatibility with Vue 3.5. (#4474) - Thanks, @zhiyuanzmj.

### Bug Fixes

- **vscode:** Fix insider version display condition. <sup>Insiders</sup>
- **language-service:** Fix `vue-twoslash-queries` not working in LSP mode.
- **language-service:** Add null handling for script tag completion items. (#4520)
- **language-core:** Fix `any` in templates if the first checked file was not root. (#4526) - Thanks, @daniluk4000.

### Other Changes

- Upgraded Volar from `v2.4.0-alpha.2` to `v2.4.0-alpha.15`:
	- Fixed an issue where, when Hybrid Mode is disabled, TS support for Vue files not included in tsconfig may be missing.
	- Improved the consistency of `vue-tsc` and `tsc` behavior. (#3526)
	- Fixed the `--clean` flag support for `vue-tsc`.
- Updated the high-level overview mermaid diagram.
- Added 'expected' and 'actually happening' sections to the bug report template. (#4515) - Thanks, @davidmatter.

## 2.0.24 <sup>official</sup>, 2.0.25 <sup>insiders</sup> (2024-06-30)

### Features

- **vscode:** pop message box if new insiders version available <sup>insiders</sup>
- **vscode:** if insiders versions information failed to fetch from GitHub, try to fetch from CDN <sup>insiders</sup>
- **language-service:** better sfc-level tag name completion (#4506) - Thanks @KermanX

### Bug Fixes

- **tsc:** update required volar version (#4498) - Thanks @davidmatter
- **tsc:** bump peer typescript version (#4513) - Thanks @so1ve

### Refactors

- **language-server:** reorganize the code structure (#4507)

### Other Changes

- Upgrade Volar from `v2.3.1` to `v2.4.0-alpha.2`.
  - Hybrid Mode compatibility improvements with other TS plugins (https://github.com/volarjs/volar.js/issues/216)
- **docs:** add nvim-cmp integration (#4463) - Thanks @RayGuo-ergou
- **docs:** update mermaid
- The following extensions have been added to Hybrid Mode’s compatibility whitelist (#4206):
  - `p42ai.refactor`
  - `nrwl.angular-console`
  - `styled-components.vscode-styled-components`
  - `Divlo.vscode-styled-jsx-languageserver`

## 2.1.0-insiders.14 (2024-06-22)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.14), [爱发电电圈](https://afdian.net/p/e05e95a8309d11efbebf52540025c377)

### Other Changes

- Merged [v2.0.22](https://github.com/vuejs/language-tools/releases/tag/v2.0.22).

## 2.0.22 (2024-06-22)

### Bug Fixes

- **vscode:** directive syntax highlighting (#4482) - Thanks @KermanX
- **language-core:** move declare defineProp out of function scope (#4454) - Thanks @zhiyuanzmj
- **language-core:** compatible with TS 5.5 (#4492)

### Other Changes

- Upgrade Volar from `v2.3.0-alpha.14` to `v2.3.1`.
  - Error tolerant to `contentChanges` length (#4457)
- Add feature request template (#4490) - Thanks @so1ve
- **docs:** fix wrong links in CHANGELOG.md (#4475) - Thanks @KermanX

## 2.1.0-insiders.13 (2024-06-08)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.13), [爱发电电圈](https://afdian.net/p/8f915cf625a711ef860252540025c377)

### Other Changes

- Merged [v2.0.21](https://github.com/vuejs/language-tools/releases/tag/v2.0.21).

## 2.0.21 (2024-06-08)

### Bug Fixes

- fix(typescript-plugin): TS plugin cause type checking broken in .ts files (#4453)

## 2.1.0-insiders.12 (2024-06-08)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.12), [爱发电电圈](https://afdian.net/p/596ab3c0256b11ef8a9c52540025c377)

### Other Changes

- Merged [v2.0.20](https://github.com/vuejs/language-tools/releases/tag/v2.0.20).

## 2.0.20 (2024-06-08)

### Features

- feat(language-service): add localization support for zh-hk/zh-tw
- feat(vscode): enable syntax highlighting of cue code blocks in MDX (#4425) - Thanks @remcohaszing

### Bug Fixes

- fix(vscode): fix "as"/"instanceof" expressions syntax highlight (#4412)
- fix(language-core): `ForIteratorExpression`'s `returns` property may be undefined (#4418) - Thanks @so1ve
- fix(language-core): use defineEmits calls instead of type infer (#4430) - Thanks @zhiyuanzmj
- fix(tsc): log catched errors to console (#4451) - Thanks @mik3ybark3r
- fix(typescript-plugin): TS not working in template when tsconfig missing (#4452)
- fix(language-core): use type infer instead of await import (#4436) - Thanks @zhiyuanzmj
- feat(language-core): ignore type error for new functional component (#4445) - Thanks @zhiyuanzmj
- fix(language-core): ignore type error for possible component name (#4446) - Thanks @zhiyuanzmj
- fix(language-service): filter internal props in template completion
- fix(language-service): sort component props in template completion
- fix(language-core): duplicate completion appears at the beginning of script setup block

### Other Changes

- Upgrade Volar from `v2.2.4` to `v2.3.0-alpha.14`.
  - LSP server performance improved
  - Language server now responds with the exact server capabilities for initialization requests
  - Auto insertion requests can now exit early in the language client
- The following extensions have been added to Hybrid Mode’s compatibility whitelist:
  - `kimuson.ts-type-expand` - Thanks @zcf0508

## 2.1.0-insiders.11 (2024-05-16)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.11), [爱发电电圈](https://afdian.net/p/c69dc31e134211ef823d5254001e7c00)

### Other Changes

- Merged [v2.0.19](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2019-2024-05-16).

## 2.0.19 (2024-05-16)

### Bug Fixes

- **language-core:** property 'xyz' does not exist on type 'abc' when using v-for (#4386)
- **language-core:** avoid report error when events do not accept parameters (#4387)
- **language-core:** inline dynamic event handlers should not expect commas (#4387)

## 2.1.0-insiders.10 (2024-05-15)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.10), [爱发电电圈](https://afdian.net/p/6c4eaf90134211efb38652540025c377)

### Other Changes

- Merged [v2.0.18](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2018-2024-05-15).

## 2.0.18 (2024-05-15)

### Features

- **language-core:** report unknown events when strictTemplates is enabled (#3718)
- **language-core:** add `compileSFCScript` plugin hook (#3200)
- **vscode:** add coffeescript syntax highlight support

### Bug Fixes

- **language-core:** fix event handler type for hyphen-case event names
- **language-core:** allow binding multiple events with the same name (#4369)
- **language-core:** variable used in `key` appears as unused in v-for template tag (#329) (#3421)
- **language-core:** generics with slots don't work with Vue 2.7 (#3241)
- **language-core:** template language of .md files should be markdown (#4299)
- **language-core:** no template class links when `experimentalResolveStyleCssClasses` is set to `always` (#4379)

### Other Changes

- Upgrade Volar from `v2.2.2` to `v2.2.4`.
  - Fixed a few URI conversion issues
  - fix(typescript): empty items list should be valid completion result (#4368)
  - fix(typescript): path completion not working for meta files
- Upgrade Volar services from `v0.0.44` to `v0.0.45`.
  - fix(typescript-twoslash-queries): inlay hints not working
  - fix(css, html, json, yaml): failed to resolve relative path
  - feat(emmet): port VSCode emmet extension client logic (https://github.com/volarjs/services/issues/95)
- The following extensions have been added to Hybrid Mode’s compatibility whitelist:
  - `miaonster.vscode-tsx-arrow-definition`
  - `runem.lit-plugin`

## 2.1.0-insiders.9 (2024-05-10)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.9), [爱发电电圈](https://afdian.net/p/6d7547a60ead11efbc8352540025c377)

### Other Changes

- Merged [v2.0.17](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2017-2024-05-10).

## 2.0.17 (2024-05-10)

### Features

- **language-core:** add JSDoc support for component (#2377)
- **language-core:** add JSDoc support for script setup binding variables (#3409)
- **language-core:** add class component support (#4354)
- **language-service:** re-support scoped class links in template (#4357)
- **typescript-plugin:** create script setup block when auto import if needed
- **typescript-plugin:** add JSDoc support for events in template (#4365)
- **component-meta:** add JSDoc tags support for events
- **language-core:** support defineOptions (#4362) - Thanks @zhiyuanzmj

### Bug Fixes

- **language-core:** hover not working for intrinsic element event name
- **language-core:** showing false _declared but not used_ errors for functions used in `v-on="{}"` (#4333)
- **language-core:** fix nameless event expression formatting
- **language-core:** types imported in the `<script setup>` should not be used as a variable in template (#4353)
- **language-core:** renaming classname within `scoped` not working (#4355)
- **language-core:** `<style>` completions and html custom data completions not provided in some cases (#4092)
- **language-core:** improve code action edits mapping fault tolerance
- **language-core:** support defineModel for generic component (#4345) - Thanks @zhiyuanzmj
- **language-service:** completion cannot trigger in SFC root
- **component-meta:** `forceUseTs` options not working

### Other Changes

- Upgrade Volar from `v2.2.0` to `v2.2.2`.
  - fix(language-server): pass correct languageId when creating virtual code (https://github.com/volarjs/volar.js/issues/173)
  - fix(typescript): additional completion not working in plugin (#4323)
- Upgrade Volar services from `v0.0.42` to `v0.0.44`.
  - feat(typescript): code action edits respect editor formatting settings (https://github.com/volarjs/services/issues/30)
  - fix(typescript): not being able to jump to shims module definition
  - fix(typescript): `allowTextChangesInNewFiles` never true for embedded documents
  - perf(typescript): check `command` resolve capability only for specific refactors (https://github.com/volarjs/services/issues/94)
- The following extensions have been added to Hybrid Mode’s compatibility whitelist:
  - `mxsdev.typescript-explorer`
- Deprecated `vueCompilerOptions.experimentalUseElementAccessInTemplate`
- Specify `packageManager` (#4358) - Thanks @so1ve
- **docs:** emoved possibly redundant duplicate reference (#4348) - Thanks @artshade
- **language-service:** temporarily remove references codeLens (#4364)

## 2.1.0-insiders.8 (2024/5/1)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.8), [爱发电电圈](https://afdian.net/p/f45436ca076d11ef9b7352540025c377)

### Other Changes

- Merged [v2.0.16](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2016-202451).

## 2.0.16 (2024/5/1)

### Bug Fixes

- **language-core:** virtual document language ID is not updated when changing SFC style block lang
- **language-core:** correct logic for `defineSlots` destructuring (#4326) - Thanks @zhiyuanzmj
- **language-core:** ObjectDirective does not work with `defineSlots` (#4327)
- **language-service:** emmet not working in postcss style block (https://github.com/volarjs/volar.js/issues/169)

### Other Changes

- Upgrade to [Volar 2.2](https://github.com/volarjs/volar.js/releases/tag/v2.2.0)
- **language-core:** export `VueEmbeddedCode` (#4265) - Thanks @zhiyuanzmj
- **typescript-plugin:** expose `FileRegistry` to `project.program` (#3963) - Thanks @zcf0508
- **vscode:** remove outdated formatters section (#4243) - Thanks @BBboy01

## 2.1.0-insiders.7 (2024/4/30)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.7), [爱发电电圈](https://afdian.net/p/84db515c069b11ef9eaf52540025c377)

### Other Changes

- Merged [v2.0.15](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2015-2024430).

## 2.0.15 (2024/4/30)

### Features

- Redesign additional extensions, VitePress, PetiteVue support (#4321)
  - Fix custom file extensions not working in Hybrid Mode (#4251)
- **vscode:** prompt when Hybrid Mode is explicitly enabled but known incompatible extensions are installed
- **language-core:** use internal options for directly exposing user props/emits types ([vuejs/core#10801](https://github.com/vuejs/core/pull/10801))
- **language-core:** support defineSlots destructuring (#4312) - Thanks @zhiyuanzmj

### Bug Fixes

- **vscode:** when enabled VitePress support, extension not activated when opening markdown files
- **language-core:** auto-complete not working in v-bind

### Performance

- **language-service:** emmet completion should not be blocked by TS type evaluation (#4298)
- **language-core:** simplify virtual code for intrinsic elements

### Other Changes

- Upgrade Volar from `v2.2.0-alpha.10` to `v2.2.0-alpha.12`:
  - Avoid extension crash when workspace TSDK does not exist
  - Fix template variables cannot be renamed at the first character in Hybrid Mode (#4297)
  - Fix template virtual code mapping is misaligned in Windows in Hybrid Mode (#4297)
- Add `svelte.svelte-vscode` (>=108.4.0) to Hybrid Mode compatibility whitelist ([sveltejs/language-tools#2317](https://github.com/sveltejs/language-tools/pull/2317))
- **component-meta:** convert source code to TS
- **language-core:** export `allCodeFeatures` (#4320) - Thanks @zhiyuanzmj

## 2.1.0-insiders.6 (2024/4/25)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.6), [爱发电电圈](https://afdian.net/p/f73a772602ab11efa33652540025c377)

### Features

- Check for Insiders version updates on startup
- Support reactions visualization for TS document

### Bug Fixes

- Fixed some incorrect situations in reactions analysis

### Other Changes

- Merged [v2.0.14...a69909e81](https://github.com/vuejs/language-tools/compare/v2.0.14...a69909e81).

## 2.1.0-insiders.5 (2024/4/22)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.5), [爱发电电圈](https://afdian.net/p/25aca47c004e11ef8b445254001e7c00)

### Other Changes

- Merged [v2.0.14](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2014-2024422).

## 2.0.14 (2024/4/22)

### Features

- **language-core:** added search html tag (#4280) - Thanks @audunhov
- **language-service:** added Russian, Czech localization support

### Bug Fixes

- **language-core:** `@ts-ignore` not working for slots (#4263)
- **language-core:** reduce unnecessary props mapping (#4284)
- **tsc:** improve regexp performance for global type removal (#4260) - Thanks @blake-newman

### Other Changes

- Upgrade Volar from `v2.2.0-alpha.8` to `v2.2.0-alpha.10` to fix some issues:
  - Parameter Hints not working in Hybrid Mode (#3948)
  - TS server to crash repeatedly when include large js file (#4278)
  - Randomly causing errors when renaming / find definitions in Hybrid Mode (#4257, #4281, #4282)
  - Unable to resolve Nuxt UI component type
  - Incomplete results for find refernces in Hybrid Mode
- The following extensions have been added to Hybrid Mode’s compatibility whitelist:
  - `bierner.lit-html`
  - `denoland.vscode-deno` (When `deno.enable` is `false`)
  - `jenkey2011.string-highlight`
- **language-core:** improve maintainability of codegen (#4276)
  - Deprecated `vueCompilerOptions.nativeTags`, now respects the `nodeType` property of template AST node.
  - Dynamic component types without `v-bind:is` are no longer supported.

## 2.0.13 (2024/4/12)

### Performance

- **tsc:** re-introduce global types removal check (#4245)

### Other Changes

- Upgrade Volar from `v2.2.0-alpha.7` to `v2.2.0-alpha.8` for a vue-tsc performance issue fixes (#4238)

## 2.1.0-insiders.4 (2024/4/10)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.4), [爱发电电圈](https://afdian.net/p/46a5f4a8f72011ee97fe52540025c377)

### Other Changes

- Merged [v2.0.12](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2012-2024410).

## 2.0.12 (2024/4/10)

### Bug Fixes

- **vscode:** restart tsserver before restart vue language server (#4242)
- **tsc:** remove exit early condition
- **typescript-plugin:** handle named pipe server timeout
- **language-core:** `@vue-ignore` not working for fragment v-if/v-for nodes (#4232)

### Other Changes

- Upgrade Volar from `v2.2.0-alpha.6` to `v2.2.0-alpha.7` for a typescript plugin bug fixes

## 2.1.0-insiders.3 (2024/4/7)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.3), [爱发电电圈](https://afdian.net/p/5bf99cfaf4ec11ee9e1f5254001e7c00)

### Features

- **vscode:** add `vue.editor.reactionsVisualization` setting ([#8](https://github.com/volarjs/insiders/pull/8))

### Other Changes

- Merged [v2.0.11](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2011-202447).

## 2.0.11 (2024/4/7)

### Features

- **vscode:** support for enabling/disabling typescript plugin (#4226)
  - Added `typeScriptPluginOnly` option for `vue.server.hybridMode` setting.
  - When Hybrid Mode is disabled, the Vue TypeScript Plugin will be disabled by default.
- **vscode:** support for `vue.format.wrapAttributes` setting (#4212)
- **vscode:** add `vue.codeActions.askNewComponentName` setting (#4217)

### Bug Fixes

- **vscode:** `Find File References` not working when hybrid mode is disabled (#4221)
- **language-core:** type narrowing not working for inline event handlers (#4209)
- **language-core:** `@vue-ignore`, `@vue-expect-error` not working for interpolations
- **language-core:** improve reliability for `@vue-ignore`, `@vue-expect-error` (#4203)
- **language-core:** duplicated items in suggestion list for prop values (#3922)
- **language-server:** `vueCompilerOptions` not working with hybrid mode (#4211) (#3959)

### Other Changes

- Upgrade Volar from `v2.2.0-alpha.5` to `v2.2.0-alpha.6` for a `vue-tsc` bug fixes
  - [volarjs/volar.js#162](https://github.com/volarjs/volar.js/pull/162) - Thanks @wangshunnn
- **test:** add test for #4203 (#4207) - Thanks @tinco

## 2.1.0-insiders.2 (2024/4/4)

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.2), [爱发电电圈](https://afdian.net/p/d59d0dd8f29611ee88945254001e7c00)

### Features

- **language-server:** improve reactions analyze ([volarjs/insiders#8](https://github.com/volarjs/insiders/pull/8))

### Other Changes

- Merged [v2.0.10](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md#2010-202444).

## 2.0.10 (2024/4/4)

### Features

- **vscode:** enable `vue.updateImportsOnFileMove.enabled` by default (#3646)
- **vscode:** re-add restart server command (#4174)
- **vscode:** automatically enable Hybrid Mode if possible (#4206)
- **component-meta:** add typing resolution for defineModel modifiers (#4175) - Thanks @stafyniaksacha
- **language-service:** drag and drop import respects tsconfig path aliases (#4184)
- **language-service:** supports auto insertion of multiple cursors (#4140)

### Bug Fixes

- **language-server:** `additionalExtensions` option not working for inferred project
- **language-core:** avoid interpolation indentation affecting each other
- **language-core:** generate each interpolation into separate virtual code (#4165)
- **language-service:** ignore html `wrapAttributes` format settings for vue document (#3987)
- **vscode:** remove duplicate ts version status (#4167)
- **language-server:** `.html`, `.md` file language id incorrect
- **typescript-plugin:** formatting settings not working for ts completion
- **tsc:** remove fake global types holder for composite projects compatibility (#4196) - Thanks @blake-newman

### Performance

- **language-core:** cache canonical root file names with string Set

### Other Changes

- Upgrade Volar from `v2.1.3` to `v2.2.0-alpha.5` for a few bug fixes and performance improves, please refer to [CHANGELOG.md](https://github.com/volarjs/volar.js/blob/master/CHANGELOG.md) for details.
- **vscode:** update required VSCode version to `^1.88.0`
- **docs:** update readme with neovim lspconfig setup (#4134) - Thanks @RayGuo-ergou
- **language-core:** split inline css codegen into separate plugin
- **language-core:** move global types codegen into separate script
- **language-core:** resolve virtual code features before push code
- **test:** added simple tests for vue-tsc and custom SFC extensions. (#4181) - Thanks @cabal95

## 2.1.0-insiders.1

Download Pages: [GitHub Releases](https://github.com/volarjs/insiders/releases/tag/v2.1.0-insiders.1), [爱发电电圈](https://afdian.net/p/ba0901a2edce11ee8f2e52540025c377)

### Features

#### Reactions visualization (PR: https://github.com/volarjs/insiders/pull/5)

![](https://github.com/vuejs/language-tools/assets/16279759/b90d3d05-f98c-42a0-b011-448af00a0c06)

#### Template interpolation decorators (PR: https://github.com/volarjs/insiders/pull/4)

> To disable this feature, uncheck `vue.editor.templateInterpolationDecorators` in VSCode settings.

![](https://github.com/vuejs/language-tools/assets/16279759/fc591552-834e-4fbb-ab47-1740f6f8a151)

### Other Changes

- Merged https://github.com/vuejs/language-tools/commit/1b9946c02ee3f5bb8c2de17c430985756115e51c

## 2.0.7 (2024/3/20)

> [!NOTE] 
> Hybrid Mode is now disabled by default, you need to enable `vue.server.hybridMode` in settings to enable it explicitly.

### Features

- **language-server:** reintroducing full TS support and disable Hybrid Mode by default (#4119)
- **vscode:** check outdated `@vue/language-plugin-pug` in doctor
- **vscode:** significantly reduces the status bar space occupied

### Bug Fixes

- **vscode:** vueCompilerOptions no longer prompts for deprecated options
- **component-meta:** `defineSlots` allows empty params (#4093) - thanks @Evertvdw
- **typescript-plugin:** fault tolerance for named pipe servers json file (#4075) - thanks @Simon-He95
- **language-core:** generate `defineModel` emits type on-demand (#4052) - thanks @so1ve
- **language-core:** special treatment for number elements inside `v-for` (#3859) - thanks @so1ve
- **language-plugin-pug:** semantic tokens mapping failed (#4070)

### Other Changes

- **language-service** update neovim lsp set up info (#4085) - thanks @CofCat456
- **lint:** add `tsl` linter and auto fix workflow (#4100)
- **vscode:** remove embedded language IDs (#4081) - thanks @remcohaszing

## 2.0.6 (2024/3/7)

> [!IMPORTANT] 
> If the TypeScript language server crashes since 2.0, please try using VSCode Insiders and install [JavaScript and TypeScript Nightly](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-next), or temporarily downgrade to 1.8.27.\
> Issue: https://github.com/vuejs/language-tools/issues/3962
>
> If false positive errors occur, please try disabling unrelated extensions in the Vue workspace.\
> Issue: https://github.com/vuejs/language-tools/issues/3942

### Fixes

- **language-core:** use local variables in v-bind shorthand (#4017) - thanks @so1ve
- **language-core:** sfc folding end position failed to mapping (#4038) - thanks @so1ve
- **language-service:** remove `extraLiners` option for formatting (#3943)
- **language-service:** bump `volar-service-typescript` for fix jsx formatting (#3949)
- **language-service:** bump `@volar/typescript` for fix 2.0.5 auto-complete performance regression (#4024)

### Other Changes

- **vscode:** rename `vue.inlayHints.vbindShorthand` setting to `vue.inlayHints.vBindShorthand` (#3995) - thanks @l4dybird

## 2.0.5 (2024/3/5)

### Features

- **language-core:** support `v-bind` shorthand (#3990) - thanks @so1ve
- **language-service:** support inlay hints for `v-bind` shorthand (#3990) - thanks @so1ve
- **vscode:** prompt to disable Svelte extension in Vue workspace to avoid conflicts

### Fixes

- **typescript-plugin:** fault tolerance for named pipe server data
- **language-core:** avoid `globalTypesHolder` being specified from a `node_modules` file (#3990)
- **language-core:** fault tolerance for plugin creation
- **language-plugin-pug:** failed to load due to an invalid require path (#3930)
- **typescript-plugin:** custom extensions do not work (#3977)
- **language-service:** html custom data not working (#3975)

### Other Changes

- **typescript-plugin** add README (#3974) - thanks @WhyNotHugo
- **component-meta** update demo (#3994) - thanks @zzfn

## 2.0.4 (2024/3/4)

### Features

- **vscode:** report requires TSDK version in doctor

### Fixes

- **typescript-plugin:** JSON parsing error when server data length > 8192 (#3961)

## 2.0.3 (2024/3/3)

### Features

- **vscode:** identify #3942 in doctor

### Fixes

- **vscode:** compatible with VSCode 1.87.0
- **vscode:** search "TypeScript and JavaScript Language Features" with id (#3932)
- **typescript-plugin:** more reliable connection to named pipe server (#3941)

### Refactors

- **language-service:** dependency injection typescript plugin (#3994)

## 2.0.2 (2024/3/2)

### Fixes

- **vscode:** fix random `Cannot access 'i' before initialization` errors
- **typescript-plugin:** `vue-tsp-table.json` path is invalid in windows

## 2.0.1 (2024/3/2)

### Fixes

- npm release does not include files (#3919)

## 2.0.0 (2024/3/2)

### Features

- Hybrid Mode
	- Takeover Mode has been deprecated. The extension now has the same performance as Takeover Mode by default.
	- TypeScript language support has been moved from Vue language server to TypeScript plugin (#3788)
	- Integrated all TypeScript editor features
	- Warn when internal TypeScript extension is disabled or "TypeScript Vue Plugin" extension is installed
	- Migrated to named pipe server using TypeScript LanguageService (#3908, #3916)
	- `typescript.tsdk` duplicate registration errors are no longer reported
	- **language-service:** reimplemented component tag semantic tokens in TypeScript plugin (#3915)
	- **language-service:** reimplemented auto-import patching in TypeScript plugin (#3917)
	- **language-service:** ensured tsserver readiness when requesting auto insert `.value` (#3914)
- Upgraded to Volar 2.0 and 2.1 (#3736, #3906)
	- **vscode:** extension now compatible with [Volar Labs](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs) v2
	- **vscode:** removed `volar.format.initialIndent` option, replaced with 3 new options:
		- `vue.format.template.initialIndent`
		- `vue.format.script.initialIndent`
		- `vue.format.style.initialIndent`
	- **language-server:** `ignoreTriggerCharacters`, `reverseConfigFilePriority` and `fullCompletionList` options are no longer supported
- Supported Component Drag and Drop Import (#3692)
- **tsc:** supported `vueCompilerOptions.extensions` option (#3800)
- **language-core:** achieved compatibility with Vue 3.4 type changes (#3860)

### Fixes

- **vscode:** prevented reading undefined properties in non-VS Code editors (#3836)
- **vscode:** prevented extension activation with TS files
- **vscode:** corrected trace server ID
- **language-core:** implemented emit codegen for defineModel (#3895)
- **language-core:** addressed transition type incompatibility with Vue 2.7.16 (#3882)
- **language-core:** excluded vue directive syntax injection in Angular bindings (#3891)
- **component-type-helpers:** resolved inference issue for Vue 3.4.20 functional component

### Refactors

- Renamed "Volar Language Features (Volar)" extension to "Vue - Official"
- "TypeScript Vue Plugin" extension has been deprecated
- Relocated source scripts from `src` to `lib` (#3913)
- Replaced `typescript/lib/tsserverlibrary` imports with `typescript`
- **language-core:** implemented codegen based on Generator (#3778)
- **language-core:** generated global types in a single virtual file (#3803)
- **language-core:** implemented plugin API v2 (#3918)
- **language-core:** ignored nested codeblocks in markdown file (#3839)
- **language-core:** removed `experimentalAdditionalLanguageModules` and deprecated APIs (#3907)
- **language-service:** made service plugins independent of project context
- **language-server:** `volar.config.js` is no longer supported
- **component-meta:** renamed APIs
- **typescript-plugin:** renamed package to `@vue/typescript-plugin` (#3910)
- **tsc:** rewritten based on first-party TS API and no longer relies on TypeScript module (#3795)
- **tsc:** deprecated hooks API (#3793)
