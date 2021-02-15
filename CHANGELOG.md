### 0.21.5

- fix: tsconfig parsing for ts plugin incorrect

### 0.21.4

- feat: `vue.d.ts` emit support
- fix: events type-checking not working for array emits define

### 0.21.3

- fix: slot name expression types incorrect

### 0.21.2

- feat: support slot name expression

### 0.21.1

- feat: show reload button on switch ts plugin
- fix: ts plugin status not sync on dropdown menu

### 0.21.0

- feat: props `@update` event support
- feat: `v-model="..."` support
- feat: ts plugin status bar item
- fix: improve events type-checking
- fix: tsconfig update not working for ts plugin
- fix: ref sugar variables hover info incorrect
- fix: services not working for hyphenate events
- fix: don't show confirm box if no import will change on move file
- fix: props rename references should keep with hyphenate

### 0.20.9

- feat: emit event type not matching warning
- feat: ts plugin support (default is disabled, run `Volar: Switch TS Plugin` to enable)
- fix: typescript auto-complete should not replace suffix
- chore: emit overloads infer nums 2 -> 4
- chore: switch auto `.value` feature to default disabled

### 0.20.8

- fix: `.value` auto-complete should not occur at definition
- fix: multi-line pug attribute not working
- fix: pug-html convert tool should not convert to pug class literal if exist illegal characters

### 0.20.7

- fix: inline css service broke in pug

### 0.20.6

- 🎉 feat: better pug support (https://github.com/johnsoncodehk/volar/projects/1#card-50201163)
- feat: improve html -> pug convert
- fix: `.value` auto-complete not working if typing inside `()`

### 0.20.5

- fix: `.value` auto-complete corner case
- feat: enabled `.value` auto-complete in .ts

### 0.20.4

- feat: auto close tag delay 0ms -> 100ms
- feat: auto-complete ref value with `.value` (Experimental)

### 0.20.3

- feat: localized typescript diagnostics
- feat: report errors count with `Verify All Scripts` command
- feat: show warning notification if project invalid (Thanks to @IWANABETHATGUY !)

### 0.20.2

- fix: `<script setup>` props rename broke
- fix: inline css service broke

### 0.20.1

- fix: ref sugar broke in 0.20.0

### 0.20.0

- feat: import path renaming
- feat: refactor import path on rename file
- feat: options to disable codeLens
- feat: verification before renaming
- perf: incremental update server documents (Thanks to @IWANABETHATGUY !)
- fix: accurate ref sugar renaming
- fix: ref sugar should convert with type args

### 0.19.16

- fix: remove incorrect props hover info
- fix: file name parsing incorrect with `[]` characters

### 0.19.15

- feat: support global component with `component(..., defineAsyncComponent(...))`
- feat: preview client improve
- fix: js files should handle in language server

### 0.19.14

- feat: `@vue-ignore` support
- fix: don't diagnose `lang="sass"`, `lang="stylus"` with css language

### 0.19.13

- feat: preview client (experimental)

### 0.19.12

- fix: ref sugar unused report incorrect with `noUnusedLocals` enabled

### 0.19.11

- fix: should not support old `<script setup>` declare props, emit, slots
- fix: should not allow export keywords in `<script setup>`
- fix: ref sugar right side expression services duplicate
- fix: ref sugar references semantic token incorrect

### 0.19.10

- feat: ref sugar hover info add dollar variable
- fix: ref sugar autocomplete not working for `ref: { | } = foo()`
- fix: ref sugar goto definition not working for `ref: { | } = foo()`
- fix: ref sugar semantic token not working

### 0.19.9

- fix: language server broke with monorepo tsconfig.json (outDir + rootDir + composite/incremental)

### 0.19.8

- feat: show underscore with css scoped classes
- fix: css scoped classes definition goto wrong place if define in import file
- fix: FunctionalComponent services not working with `setup()` return

### 0.19.7

- feat: `<script src>` support

### 0.19.6

- fix: prop types incorrect if duplicate name with HTMLAttributes
- fix: symbols outline incorrect

### 0.19.5

- feat: add split editors button
- feat: improve split editors
- fix: `<template lang="pug">` block folding not working with `>` character

### 0.19.4

- feat: split editors

### 0.19.3

- fix: component props auto complete broke
- fix: interpolation formatting incorrect edge case
- chore: remove unneeded files to reduce extension size

### 0.19.2

- fix: ref sugar variables unused report incorrect
- fix: `@click` type check not working for non native elements

### 0.19.1

- fix: css class references codeLens broke

### 0.19.0

- feat: unsupported workspaceExtensions formatter
- feat: unsupported old `<script setup>`
- fix: references codeLens should not counting itself
- fix: hyphenate format slot name have duplicate references codeLens
- fix: `<script setup>` unused checking not working for `"noUnusedLocals": true`

### 0.18.17

- feat: server init progress
- feat: vue block completion
- fix: tsconfig.json update not working
- fix: __VLS_GlobalComponents not working if no `<script>` block
- fix: element tag mapping incorrect corner case

### 0.18.16

- feat: codeLens for `app.component(...)`
- feat: codeLens for slots
- fix: css codeLens location incorrect corner case

### 0.18.15

- fix: `<script setup>` unused variables report broke with html

### 0.18.14

- fix: `<script setup>` variables should report unused when use as component

### 0.18.13

- feat: unused variables report for `<script setup>`
- fix: `<script setup>` imports should not have global completion

### 0.18.12

- feat: pnpm support
- feat: unlimited emits overloads support
- fix: formatting remove `export default {}` if exist two `<script>` block

### 0.18.11

- fix: ref sugar variable define diagnostic not working
- fix: `ref: foo = false` should be `boolean` not `false` type in template
- fix: ref sugar convert tool fail with `()`

### 0.18.10

- fix: props services fail for `DefineComponent<...>` declare component

### 0.18.9

- fix: folding ranges not working in `<script setup>` block

### 0.18.8

- feat: improve pug diagnosis
- fix: find emits references not working with hyphenate
- fix: hover info not working for hyphenate component tag tail
- pert: faster script setup gen
- perf: faster pug mapper

### 0.18.7

- chore: change component tag hover info
- fix: filter same html tag in completion
- fix: ctx properties types incorrect corner cases
- fix: should not detect all ctx properties as component
- fix: `@click` event type check broke

### 0.18.6

- revoke: rollback typescript diagnostic modes
- perf: faster diagnostics

### 0.18.5

- feat(experiment): added a new typescript diagnostic mode and default enabled (not prompt for unused variables)
- fix: `foo=""` attribute should not detect as `true` type

### 0.18.4

- fix: script formatting broke
- fix: when return `foo: foo as true` in setup(), template context should get `foo: true` not `foo: boolean`

### 0.18.3

- fix: interpolations formatting indent broke

### 0.18.2

- fix: interpolations formatting broke
- fix: props missing checking not working for non hyphenate component
- perf: emit overloads support nums 16 -> 4 (faster template diagnostics when using v-on)

### 0.18.1

- perf: faster template diagnostics

### 0.18.0

- feat: [Linked Editing](https://code.visualstudio.com/updates/v1_44#_synced-regions)
- fix: script not found error not working for `<script setup>`

### 0.17.7

- chore: rename extension in marketplace [#35](https://github.com/johnsoncodehk/volar/discussions/35)

### 0.17.6

- fix: ref sugar variable renaming no effect to template
- fix: `v-else-if` semantic token
- perf: split `<script>` and `<template>` to speed up current editing block diagnostics

  > when editing `<script>`, `<template>` block delay 1000ms make diagnosis

  > when editing `<template>`, `<script>` block delay 1000ms make diagnosis

### 0.17.5

- perf: faster default formatter
- perf: faster diagnostics

### 0.17.4

- fix: can't disable html mirror cursor
- feat: improve folding range

### 0.17.3

- feat: improve html mirror cursor
- feat: improve default formatter

### 0.17.2

- fix: `<script setup>` crash corner cases
- fix: diagnostic feature was accidentally disabled in v0.17.1

### 0.17.1

- perf: prevent auto close tag blocked by autocomplete
- perf: faster semantic tokens

### 0.17.0

- feat: ts semantic tokens
- feat: faster auto close tag
- chore: remove icon avoid it like a virus in marketplace

### 0.16.15

- perf: prevent semantic tokens request block autocomplete request (occurred in 0.16.4)
- feat: improve ts autocomplete

### 0.16.14

- feat: pure type defineEmit() syntax support
- feat: increase support emits overloads nums to 16
- fix: pure type defineProps properties required incorrect
- fix: monorepo services can't update cross root scripts
- fix: `<script setup>` formatting broke in 0.16.13

### 0.16.13

- fix: crash if allowJs not set and working on js script block
- fix: crash with user action when server not ready

### 0.16.12

- feat: html mirror cursor

### 0.16.11

- feat: support directives syntax `:=`, `@=`, `#=`
- fix: v-slot bind properties missing attribute values
- fix: template validation broke with v-slot bind properties
- fix: slot services disturbed slot element hover info

### 0.16.10

- feat: reference, rename, definition support to js

### 0.16.9

- feat: template validation support to js
- fix: should not error when css class not exist
- fix: inline style hover info wrong mapping

### 0.16.8

- feat: slot name services (find references, goto definition, diagnostic, completion, hover info)

### 0.16.7

- fix: call graph links incomplete

### 0.16.6

- fix: find references crash in node_modules files

### 0.16.5

- feat: restart server command
- fix: auto import not working for .vue files

### 0.16.4

- fix: can't use export default with `<script>` when `<script setup>` exist
- fix: auto import items should not show virtual files
- fix: style attr services broke
- fix: v-for elements types incorrect
- refactor: sensitive semantic tokens update

### 0.16.3

- feat: inline css service within `<template>`

### 0.16.2

- fix: `<script setup>` formatting wrongly replace `ref:` to `ref`

### 0.16.1

- fix: fix some Call Hierarchy failed cases
- perf: faster typescript language service for new `<script setup>`


### 0.16.0

- feat: [Call Hierarchy](https://code.visualstudio.com/updates/v1_33#_call-hierarchy) support
- feat: auto declare `__VLS_GlobalComponents` by `app.component()` calls

### 0.15.x

TODO
