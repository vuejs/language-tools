# Changelog

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
