# Changelog

<table>
	<tbody>
		<tr>
			<td align="center" colspan="6">
				<br><a href="https://stackblitz.com/"><img
						src="https://raw.githubusercontent.com/vuejs/language-tools/HEAD/.github/sponsors/StackBlitz.png"
						height="80" /></a>
				<br><a href="https://blog.stackblitz.com/posts/webcontainer-api-is-here/">WebContainer API is here.</a>
				<br>In 2021 <a href="https://blog.stackblitz.com/posts/introducing-webcontainers/">we announced
					WebContainers</a>, a novel WebAssembly-based operating system which enables Node.js to run entirely
				inside the browser. Over the last two years, millions of developers have used WebContainers each month
				as it powers, among others, the StackBlitz editor.
			</td>
		</tr>
		<tr>
			<td align="center" colspan="6"><b>Sponsors</b></td>
		</tr>
		<tr>
			<td align="center"><a href="https://www.prefect.io/"><img
						src="https://raw.githubusercontent.com/vuejs/language-tools/HEAD/.github/sponsors/prefect.svg"
						height="40" /></a></td>
			<td align="center" colspan="5">
				<a href="https://nuxt.com/"><img
						src="https://raw.githubusercontent.com/vuejs/language-tools/HEAD/.github/sponsors/nuxt.svg"
						height="60" /></a>
				<br>The Intuitive Vue Framework
			</td>
		</tr>
		<tr>
			<td align="center" colspan="5">
				<a href="https://vuejs.org/"><img
						src="https://raw.githubusercontent.com/vuejs/language-tools/HEAD/.github/sponsors/vue.png"
						height="80" /></a>
				<br>The Progressive JavaScript Framework
			</td>
			<td align="center"><a href="https://www.programmier.bar/"><img src="https://github.com/programmierbar.png"
						height="60" /></a></td>
		</tr>
		<tr>
			<td align="center"><a href="https://www.leniolabs.com/"><img src="https://github.com/leniolabs.png"
						height="60" /></a></td>
			<td align="center" colspan="5">
				Support us via
				<a href="https://github.com/sponsors/johnsoncodehk">GitHub Sponsors</a>
				or
				<a href="https://opencollective.com/volarjs">Open Collective</a>
			</td>
		</tr>
		<tr>
			<td></td>
			<td></td>
			<td></td>
			<td></td>
			<td></td>
			<td></td>
		</tr>
	</tbody>
</table>

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

- feat: support for twoslash queries (https://github.com/vuejs/language-tools-plugins/issues/9)
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

## 0.40.13 (2022/9/8)

- fix: cycle reactive reference lead to memory leak

## 0.40.12 (2022/9/8)

- perf: fix incremental template compile not working
- perf: cache path resolve result on `getScriptVersion`
- perf: faster code mapping range transform

## 0.40.11 (2022/9/8)

- feat: support for typescript class/object literal method completions ([#1835](https://github.com/vuejs/language-tools/issues/1835))
- fix: language server crash if client did not support `onDidChangeWorkspaceFolders` ([#1834](https://github.com/vuejs/language-tools/issues/1834))
- fix: "Format Selection" embedded range incorrect with initialIndentBracket
- fix: formatting break document with `editor.formatOnPaste` enabled ([#1840](https://github.com/vuejs/language-tools/issues/1840)) ([#1841](https://github.com/vuejs/language-tools/issues/1841)) ([#1842](https://github.com/vuejs/language-tools/issues/1842)) ([#1843](https://github.com/vuejs/language-tools/issues/1843)) ([#1835](https://github.com/vuejs/language-tools/issues/1835))

## 0.40.10 (2022/9/7)

- feat: improve "Format Selection" for html content
- feat: uniquely scope attribute shorthands ([#1812](https://github.com/vuejs/language-tools/issues/1812))
- feat: add server name, version infos to LSP initialize response
- fix: "Format Selection" should not format whole language block ([#1833](https://github.com/vuejs/language-tools/issues/1833))
- fix: formatting break document content randomly ([#1827](https://github.com/vuejs/language-tools/issues/1827)) ([#1832](https://github.com/vuejs/language-tools/issues/1832))
- fix: pug syntax highlighting confuses element id with interpolation ([#1826](https://github.com/vuejs/language-tools/issues/1826))
- fix: don't cache IDE settings if IDE do not support config change notification

## 0.40.9 (2022/9/6)

- feat: improve vue document formatting
- fix: script format loss indent ([#1823](https://github.com/vuejs/language-tools/issues/1823))

## 0.40.8 (2022/9/6)

- feat: add `volar.format.initialIndent` option for format `<style>`, `<script>` with initial indent ([#1806](https://github.com/vuejs/language-tools/issues/1806))
- perf: cache `ts.ScriptSnapshot.fromString` result on formatting
- fix: volar.config.js not working since v0.40.7 ([#1819](https://github.com/vuejs/language-tools/issues/1819))
- fix: should not incremental update if SFC parse failed (https://github.com/vuejs/language-tools/issues/1807#issuecomment-1236857296)

## 0.40.7 (2022/9/5)

- feat: support multiple workspaces for document features
- feat: add `initializationOptions.completion.ignoreTriggerCharacters` for LSP-Volar (https://github.com/sublimelsp/LSP-volar/issues/114)
- feat: add `vueCompilerOptions.experimentalComponentOptionsWrapper` option for custom component options warpper ([#1517](https://github.com/vuejs/language-tools/issues/1517))
- fix: add missing surrounding pair "`" ([#1659](https://github.com/vuejs/language-tools/issues/1659))
- fix: formatting edit range incorrect edge case ([#1814](https://github.com/vuejs/language-tools/issues/1814))
- fix: typescript onType format do not respect `typescript.format.enable`
- fix: document features stop working for script block ([#1813](https://github.com/vuejs/language-tools/issues/1813))
- fix: pug formatter extra spaces in `{{ }}` ([#1784](https://github.com/vuejs/language-tools/issues/1784))
- fix: template incremental parser broken when typing slot name

**Breaking changes**

- vueCompilerOptions properties `experimentalImplicitWrapComponentOptionsWithDefineComponent`, `experimentalImplicitWrapComponentOptionsWithVue2Extend` replaced by `experimentalComponentOptionsWrapper`.

## 0.40.6 (2022/9/4)

- feat: support language features for Web IDE ([#612](https://github.com/vuejs/language-tools/issues/612))
- feat: update vite problemMatcher ([#1801](https://github.com/vuejs/language-tools/issues/1801))
- feat: add `volar.vueserver.textDocumentSync` option to disable incremental update ([#1807](https://github.com/vuejs/language-tools/issues/1807))
- fix: `v-for`, `v-if` textmate scopes incorrect ([#1810](https://github.com/vuejs/language-tools/issues/1810))

## 0.40.5 (2022/8/31)

- feat: suppor add or switch workspaces without restart server ([#1574](https://github.com/vuejs/language-tools/issues/1574))
- fix: sfc offset incremental update broken when input at block start
- fix: document incremental update break document content on Sublime LSP (https://github.com/sublimelsp/LSP-volar/issues/120)
- fix: unexpected prop types behavior with `compilerOptions.exactOptionalPropertyTypes` (https://github.com/vuejs/core/issues/6532)
- fix: false positive error on `<input typeof="radio" value="...">` ([#1775](https://github.com/vuejs/language-tools/issues/1775))
- fix: false positive style attribute inconsistent string type error ([#1781](https://github.com/vuejs/language-tools/issues/1781))
- fix: language server broken with `outDir` + `rootDir` + `composite/incremental` tsconfig options ([#1782](https://github.com/vuejs/language-tools/issues/1782))
- fix: json format should not trim first / end new line
- fix: interpolation format adding redundant spaces ([#1784](https://github.com/vuejs/language-tools/issues/1784))

## 0.40.4 (2022/8/29)

- feat: respect VSCode `*.format.enable` settings
- fix: template should not compile if content no change
- fix: component preview not working on windows ([#1737](https://github.com/vuejs/language-tools/issues/1737))

## 0.40.3 (2022/8/29)

- perf: incremental update SFC blocks without full parse SFC and mitigate memory leak
- perf: incremental update html template interpolation without recompile template
- perf: cache `ts.createSourceFile` for tsx code gen
- fix(vue-component-meta): cannot create checker with TS 4.8.2
- fix: document features not working on Web IDE ([#1479](https://github.com/vuejs/language-tools/issues/1479))
- fix: avoid auto complete triggers too aggressive in Sublime (https://github.com/sublimelsp/LSP-volar/issues/114)

## 0.40.2 (2022/8/28)

- feat(vue-component-meta): add `createComponentMetaCheckerByJsonConfig` API to support create checker without tsconfig
- feat: move `highlight dom elements ☑` codeLens to status bar ([#1535](https://github.com/vuejs/language-tools/issues/1535))
- feat: incremental update diagnostics cache range and avoid flicker ([#1718](https://github.com/vuejs/language-tools/issues/1718))
- perf: incremental update TS script snapshot ([#1718](https://github.com/vuejs/language-tools/issues/1718))
- perf: faster source map code mapping
- fix: pug template tag mapping range incorrect ([#1723](https://github.com/vuejs/language-tools/issues/1723))
- fix: vite plugin import path incorrect on windows ([#1772](https://github.com/vuejs/language-tools/issues/1772))
- fix: false positive error on style attr when enabled `compilerOptions.exactOptionalPropertyTypes` ([#1560](https://github.com/vuejs/language-tools/issues/1560))
- fix: .html intellisense of petite-vue not working
- fix: .html intellisense of alpie not working
- fix: intellisense not working for node_modules files with takeover mode on windows ([#1641](https://github.com/vuejs/language-tools/issues/1641))
- fix: avoid vue-tsc type check .html, .md files ([#1661](https://github.com/vuejs/language-tools/issues/1661))
- fix: `compilerOptions.types` resolve path incorrect on multiple workspaces ([#1679](https://github.com/vuejs/language-tools/issues/1679))
- fix: cannot count script setup variable usage in template if disalbe jsx ([#1729](https://github.com/vuejs/language-tools/issues/1729))
- fix: cannot resolve indirect circular reference components types ([#1708](https://github.com/vuejs/language-tools/issues/1708))
- fix: cannot recognize namespace component ([#1726](https://github.com/vuejs/language-tools/issues/1726))
- fix: template components types break by regular SFC `components` option ([#1731](https://github.com/vuejs/language-tools/issues/1731))
- fix: indentation behavior incorrect ([#1762](https://github.com/vuejs/language-tools/issues/1762))
- fix: TS1308 'async' error missing when use script setup ([#1753](https://github.com/vuejs/language-tools/issues/1753))

## 0.40.1 (2022/8/11)

- fix: component context types missing in template if no script block ([#1688](https://github.com/vuejs/language-tools/issues/1688))
- fix: organize imports added invalid code ([#1692](https://github.com/vuejs/language-tools/issues/1692))
- fix: v-else template interpolation missing in virtual code ([#1694](https://github.com/vuejs/language-tools/issues/1694))
- fix: template interpolation formatting broken ([#1697](https://github.com/vuejs/language-tools/issues/1697))
- fix: inline css intellisense not working

## 0.40.0 (2022/8/10)

- feat: support document highlights cross `<script>`, `<template>` ([#462](https://github.com/vuejs/language-tools/issues/462))
- feat: support reference types from script setup in template ([#891](https://github.com/vuejs/language-tools/issues/891))
- feat: support auto import in template ([#823](https://github.com/vuejs/language-tools/issues/823))
- feat: support plugin api ([#185](https://github.com/vuejs/language-tools/issues/185)) ([#1687](https://github.com/vuejs/language-tools/issues/1687))
- fix: template scope variables completion missing ([#1284](https://github.com/vuejs/language-tools/issues/1284))
- fix: prefer `defineComponent` instead of `Vue.extend` to wrap component options by default ([#1584](https://github.com/vuejs/language-tools/issues/1584))
- fix: bracket pair colorization in VSCode v1.70 ([#1677](https://github.com/vuejs/language-tools/issues/1677))

## 0.39.5 (2022/8/6)

- feat(vue-component-meta): add option to expose raw type ([#1674](https://github.com/vuejs/language-tools/issues/1674))
- fix(vue-component-meta): recursive schema parsing ([#1660](https://github.com/vuejs/language-tools/issues/1660))
- fix(vue-component-meta): parse defineProps in script setup with option ([#1665](https://github.com/vuejs/language-tools/issues/1665))
- fix: SFC syntax broken in vscode v1.70.0 ([#1566](https://github.com/vuejs/language-tools/issues/1566)) ([#1675](https://github.com/vuejs/language-tools/issues/1675))
- fix: vite app preview not working ([#1668](https://github.com/vuejs/language-tools/issues/1668))
- fix: diagnosis is slow on windows after v0.39.2 ([#1663](https://github.com/vuejs/language-tools/issues/1663))
- fix: `compilerOptions.types` not working since v0.39.2 ([#1650](https://github.com/vuejs/language-tools/issues/1650))
- fix: avoid auto-import path append `.js` ([#1667](https://github.com/vuejs/language-tools/issues/1667))
- fix: avoid variables defined after export default report TS_2454
- perf: cache semver result on auto-complete

## 0.39.4 (2022/7/31)

- feat: support ESM project ([#1543](https://github.com/vuejs/language-tools/issues/1543))
- fix: "Volar: Reload Project" command cannot detect node_modules change
- fix: webview buttons show to unrelated extensions ([#1611](https://github.com/vuejs/language-tools/issues/1611))

## 0.39.3 (2022/7/31)

- feat(vue-component-meta): component schema improves ([#1656](https://github.com/vuejs/language-tools/issues/1656))
- feat(vue-component-meta): support options api props default ([#1649](https://github.com/vuejs/language-tools/issues/1649))
- feat: add "Volar: Reload Project" command ([#1605](https://github.com/vuejs/language-tools/issues/1605))
- fix: vue-tsc watch not working ([#1647](https://github.com/vuejs/language-tools/issues/1647))

## 0.39.2 (2022/7/28)

- feat: vue-component-meta ([#1627](https://github.com/vuejs/language-tools/issues/1627))
- feat: support for "JavaScript and TypeScript Nightly" ([#1332](https://github.com/vuejs/language-tools/issues/1332))
- fix: tsx, jsx syntax break by vue directives syntax inject ([#1617](https://github.com/vuejs/language-tools/issues/1617))
- fix: any type components missing in template when use script setup ([#1608](https://github.com/vuejs/language-tools/issues/1608))
- fix: ignore X_V_IF_SAME_KEY error in vue 2 ([#1638](https://github.com/vuejs/language-tools/issues/1638))
- perf: fix `fileExists` is always calculate for .ts on each time update (https://github.com/vuejs/language-tools/commit/07f3bd55b6bdf3875a60796f7c9eb9a838eed463)
- perf: cache `fileExists`, `directoryExists` result in language server (https://github.com/vuejs/language-tools/commit/34a4435284311c88248a44222f49c017a6b408a9)

## 0.39.1 (2022/7/23)

- fix: typescript-vue-plugin break TS server ([#1624](https://github.com/vuejs/language-tools/issues/1624))
- fix: make `takeOverMode.enabled: true` behavior same with `takeOverMode.enabled: 'auto'`

## 0.39.0 (2022/7/23)

- feat: updated vite problemMatcher ([#1606](https://github.com/vuejs/language-tools/issues/1606))
- feat: support Vite app preview for Vite v3 ([#1616](https://github.com/vuejs/language-tools/issues/1616))
- feat: support organizeImports in vue-typescript for prettier-plugin-organize-imports ([#1480](https://github.com/vuejs/language-tools/issues/1480)) ([#1577](https://github.com/vuejs/language-tools/issues/1577))
- feat: avoid takeover enabled with built-in TS extension do not disabled ([#1622](https://github.com/vuejs/language-tools/issues/1622))
- feat: expose vue-tsconfig.schema.json from `@volar/vue-language-core`
- fix: fix workspaceTrust description ([#1610](https://github.com/vuejs/language-tools/issues/1610))

**Breaking changes**

- `@volar/vue-typescript`, `@volar/vue-language-service` apis refactored

## 0.38.9 (2022/7/20)

- fix: path resolution incorrect in multi root workspaces on windows ([#1585](https://github.com/vuejs/language-tools/issues/1585))
- fix: goto definition not working for import path on windows ([#1591](https://github.com/vuejs/language-tools/issues/1591)) ([#1593](https://github.com/vuejs/language-tools/issues/1593))
- fix: update imports on file move not working ([#1599](https://github.com/vuejs/language-tools/issues/1599))
- fix: wrong check for whether jsx option is set ([#1595](https://github.com/vuejs/language-tools/issues/1595))
- fix: renaming .vue files breaks resolving import paths ([#1125](https://github.com/vuejs/language-tools/issues/1125))

## 0.38.8 (2022/7/17)

- feat: support for TS 4.8 ([#1507](https://github.com/vuejs/language-tools/issues/1507))
- feat: support `--incremental` flag for vue-tsc ([#787](https://github.com/vuejs/language-tools/issues/787))
- fix: vue-tsc watch memory leak ([#1106](https://github.com/vuejs/language-tools/issues/1106))
- fix: re-fix template directives syntax highlight incorrect edge cases ([#1423](https://github.com/vuejs/language-tools/issues/1423))

## 0.38.7 (2022/7/17)

- feat: add `volar.updateImportsOnFileMove.enabled` option to disable file move refactoring ([#1181](https://github.com/vuejs/language-tools/issues/1181))
- feat: add `volar.diagnostics.delay` option for reduce CPU usage ([#1295](https://github.com/vuejs/language-tools/issues/1295))
- feat: add `vueCompilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend` to support wrap component options by `Vue.extend` ([#1337](https://github.com/vuejs/language-tools/issues/1337))
- feat: support takeover mode for .cjs and .mjs ([#1578](https://github.com/vuejs/language-tools/issues/1578))
- fix: template syntax highlight broken if quotes missing ([#761](https://github.com/vuejs/language-tools/issues/761))
- fix: self closing tag syntax highlight incorrect ([#948](https://github.com/vuejs/language-tools/issues/948))
- fix: re-fix vue file import path auto-complete not working on windows ([#1304](https://github.com/vuejs/language-tools/issues/1304))
- fix: ts plugin stuck on empty project ([#1146](https://github.com/vuejs/language-tools/issues/1146))
- fix: tsconfig picking inaccurate ([#1193](https://github.com/vuejs/language-tools/issues/1193))
- fix: cannot resolve modules from extend tsconfg `types` option ([#1262](https://github.com/vuejs/language-tools/issues/1262))
- fix: file move refactoring unpredictable ([#1273](https://github.com/vuejs/language-tools/issues/1273))
- fix: avoid duplicate class attribute in pug ([#1525](https://github.com/vuejs/language-tools/issues/1525))
- fix: intellisense incorrect in new file ([#1548](https://github.com/vuejs/language-tools/issues/1548))
- fix: `insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis` break v-for format ([#1398](https://github.com/vuejs/language-tools/issues/1398))
- fix: document features not working in *.ts on takeover mode ([#1563](https://github.com/vuejs/language-tools/issues/1563))

## 0.38.6 (2022/7/16)

- fix: template syntax highlight broken (#1553, #1567, #1569, #1564, #1491)

## 0.38.5 (2022/7/11)

- fix: file path resolve incorrect on windows (#1554, #1555, #1556, #1557, #1558, #1559)

## 0.38.4 (2022/7/11)

- feat: add `vueCompilerOptions.strictTemplates` ([#1418](https://github.com/vuejs/language-tools/issues/1418))
- fix: don't auto close ``` ([#1428](https://github.com/vuejs/language-tools/issues/1428))
- fix: change unknown slot type from `unknown` to `any` ([#1541](https://github.com/vuejs/language-tools/issues/1541))
- fix: SFC templates outline incorrect ([#1531](https://github.com/vuejs/language-tools/issues/1531))
- fix: slot shorthand highlighting incorrect if have not `=` ([#1423](https://github.com/vuejs/language-tools/issues/1423))
- fix: vue file import path auto-complete not working on windows ([#1304](https://github.com/vuejs/language-tools/issues/1304))
- fix: avoid duplicate result in html ([#1552](https://github.com/vuejs/language-tools/issues/1552)) ([#1530](https://github.com/vuejs/language-tools/issues/1530))
- fix: code action document edit version incorrect ([#1490](https://github.com/vuejs/language-tools/issues/1490))

**Breaking changes**

- `experimentalSuppressUnknownJsxPropertyErrors`, `experimentalSuppressInvalidJsxElementTypeErrors` is replaced by `strictTemplates`.

	```diff
	{
		"vueCompilerOptions": {
	-		"experimentalSuppressUnknownJsxPropertyErrors": false,
	-		"experimentalSuppressInvalidJsxElementTypeErrors": false,
	+		"strictTemplates": true
		},
	}
	```

## 0.38.3 (2022/7/7)

- feat: support html, css intellisense for petite-vue ([#1471](https://github.com/vuejs/language-tools/issues/1471))
- fix: avoid unknown jsx property error for vue 2.7 ([#1533](https://github.com/vuejs/language-tools/issues/1533))
- fix: fixed `GlobalComponents` interface not working edge case ([#1489](https://github.com/vuejs/language-tools/issues/1489))
- fix: stricter slots type extracting ([#1522](https://github.com/vuejs/language-tools/issues/1522))
- fix: nuxt app preview not working

## 0.38.2 (2022/6/26)

- feat: update support for vite-plugin-vue-component-preview v0.2
- feat: improve component preview UX
- feat: add --version flag for vue-language-server ([#1510](https://github.com/vuejs/language-tools/issues/1510))
- fix: css class name codeLens range inaccurate ([#1485](https://github.com/vuejs/language-tools/issues/1485))

## 0.38.1 (2022/6/19)

- fix: fixed isIntrinsicElement is not a function error ([#1478](https://github.com/vuejs/language-tools/issues/1478))

## 0.38.0 (2022/6/19)

- feat: support component preview for Vite + Vue 3 ([#1476](https://github.com/vuejs/language-tools/issues/1476)) \
you need to install [vite-plugin-vue-component-preview](https://github.com/johnsoncodehk/vite-plugin-vue-component-preview)  manually to support this feature
- feat: support auto insert `.value` for vue 2 ([#1466](https://github.com/vuejs/language-tools/issues/1466))
- fix: cannot define global components types with `@vue/runtime-core` in Vue 2 ([#1469](https://github.com/vuejs/language-tools/issues/1469))
- fix: cannot emit declaration with script setup on vue-tsc ([#1459](https://github.com/vuejs/language-tools/issues/1459))
- fix: component auto import unreliable ([#1470](https://github.com/vuejs/language-tools/issues/1470))
- fix: camel case scope css class name intellisense not working ([#1447](https://github.com/vuejs/language-tools/issues/1447))
- fix(petite-vue): cannot access script tag local variables ([#1471](https://github.com/vuejs/language-tools/issues/1471))

## 0.37.9 (2022/6/16)

- perf: only support VitePress, petite-vue when `*.md`, `*.html` explicitly added in tsconfig include property ([#1463](https://github.com/vuejs/language-tools/issues/1463))
- fix: respect `codeAction.disabledSupport` capability ([#1454](https://github.com/vuejs/language-tools/issues/1454))
- fix: auto import component tag name including "Vue" on import ([#1461](https://github.com/vuejs/language-tools/issues/1461))
- fix: don't recognize components without script blocks as js languages ([#1452](https://github.com/vuejs/language-tools/issues/1452)) ([#1455](https://github.com/vuejs/language-tools/issues/1455))
- fix: scope class name doesn't show underline ([#1447](https://github.com/vuejs/language-tools/issues/1447))
- fix: withDefaults syntax break in `lang="tsx"` ([#1458](https://github.com/vuejs/language-tools/issues/1458))
- fix: alpine-language-server bin script name incorrect ([#1460](https://github.com/vuejs/language-tools/issues/1460))

## 0.37.8 (2022/6/14)

- feat: create [alpine-language-features](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.alpine-language-features) extension for support Alpine.js via reuse petite-vue language support works
- fix: petite-vue createApp arg range inaccurate
- fix: vue component context properties missing in petite-vue template

## 0.37.7 (2022/6/13)

- fix: cannot resolve external vue file path ([#1445](https://github.com/vuejs/language-tools/issues/1445))
- fix: petite-vue v-scope data type loss in inline handlers ([#1442](https://github.com/vuejs/language-tools/issues/1442))
- fix: petite-vue createApp() initialData type missing in template ([#1444](https://github.com/vuejs/language-tools/issues/1444))

## 0.37.6 (2022/6/13)

- fix: SFC syntax highlight broken if directives missing `=` sign

## 0.37.5 (2022/6/13)

- feat: support petite-vue
- fix: don't active VitePress intellisense for `.md` if file path in not include by tsconfig ([#1430](https://github.com/vuejs/language-tools/issues/1430))
- fix: cannot direct execution of fileReferences command ([#1419](https://github.com/vuejs/language-tools/issues/1419))
- fix: avoid "`" auto close break markdown code block input ([#1428](https://github.com/vuejs/language-tools/issues/1428))
- fix: component props completion info box missing in template
- fix: false positive props type error when JS component usage in TS component ([#1426](https://github.com/vuejs/language-tools/issues/1426))
- fix: cannot recognize component properties in type reference in template ([#1422](https://github.com/vuejs/language-tools/issues/1422))
- fix: slot binding type annotation not working if parent component is `<component :is>` ([#1425](https://github.com/vuejs/language-tools/issues/1425))
- fix: patch invalid `:` character in tag name ([#1435](https://github.com/vuejs/language-tools/issues/1435))
- fix: auto closing pairs not working in template expressions ([#1437](https://github.com/vuejs/language-tools/issues/1437))
- perf: faster markdown content parsing for vitepress

## 0.37.3 (2022/6/8)

- feat: support find file references
- feat: improve vitepress markdown parse reliability ([#1410](https://github.com/vuejs/language-tools/issues/1410))
- feat: `vueCompilerOptions.experimentalSuppressInvalidJsxElementTypeErrors` default true ([#1405](https://github.com/vuejs/language-tools/issues/1405))
- fix: fixed TS error with props beginning with data* ([#1413](https://github.com/vuejs/language-tools/issues/1413))

## 0.37.2 (2022/6/7)

- feat: show deprecation message for `experimentalCompatMode`
- fix: kebab case component type broken in vue 2 ([#1405](https://github.com/vuejs/language-tools/issues/1405))

## 0.37.1 (2022/6/7)

- feat: add `experimentalSuppressInvalidJsxElementTypeErrors` option to ignore missing component import error ([#1404](https://github.com/vuejs/language-tools/issues/1404))
- perf: support auto-import cache even TS version \< 4.7 ([#1406](https://github.com/vuejs/language-tools/issues/1406))
- perf: simplify template generated tsx code

## 0.37.0 (2022/6/6)

- feat: VitePress support ([#1399](https://github.com/vuejs/language-tools/issues/1399))
- feat: support `html.autoCreateQuotes` for pug
- feat: enabled references codeLens for slots when use script setup
- feat: detect missing component import ([#1203](https://github.com/vuejs/language-tools/issues/1203))
- feat: support `--generateTrace` for vue-tsc ([#1375](https://github.com/vuejs/language-tools/issues/1375))
- fix: dynamic slot name breaks template type checking ([#1392](https://github.com/vuejs/language-tools/issues/1392))
- fix: don't report property does not exist error for `data-*` and `aria-*`
- fix: html selection highlight ranges incorrect ([#1393](https://github.com/vuejs/language-tools/issues/1393))
- fix: avoid `DefineComponent` type loss when use script setup ([#1391](https://github.com/vuejs/language-tools/issues/1391))
- fix: css module `$style` inconsistent between vue-tsc and vscode ([#1089](https://github.com/vuejs/language-tools/issues/1089))
- fix: css class name and v-bind should not active in style comments
- fix: unused `console.log` to adapt vim-lsp ([#1391](https://github.com/vuejs/language-tools/issues/1391))
- fix: language server stuck on incomplete style variable injection expression ([#1359](https://github.com/vuejs/language-tools/issues/1359))
- fix: remove `__VLS_` result from code actions

**Breaking changes**

- `vueCompilerOptions.experimentalCompatMode` is renamed to `vueCompilerOptions.target`.

	```diff
	{
		"vueCompilerOptions": {
	-		"experimentalCompatMode": 2
	+		"target": 2
		},
	}
	```

## 0.36.1 (2022/6/4)

- feat: add `vueCompilerOptions.experimentalSuppressUnknownJsxPropertyErrors` option for unkonwn props reporting
- fix: template slots types missing when use export default in `<script>` with `<script setup>` ([#1389](https://github.com/vuejs/language-tools/issues/1389))
- fix: fixed false positive `__VLS_radioBinding` on radio input tag. ([#1390](https://github.com/vuejs/language-tools/issues/1390))

## 0.36.0 (2022/6/3)

- feat: support format selection (range formatting) ([#1370](https://github.com/vuejs/language-tools/issues/1370))
- feat: support format on type
- feat: support `@ts-check`, `@ts-nocheck` for template ([#1369](https://github.com/vuejs/language-tools/issues/1369))
- feat: improve slots auto-complete ([#1251](https://github.com/vuejs/language-tools/issues/1251))
- feat: support jsdoc for jsx IntrinsicElement ([#1212](https://github.com/vuejs/language-tools/issues/1212))
- feat: experimental support for vue 2.7 with `"experimentalCompatMode": 2.7`
- feat: support typed template slots for script setup ([#1253](https://github.com/vuejs/language-tools/issues/1253))
- fix: `--extendedDiagnostics` not working on vue-tsc ([#1375](https://github.com/vuejs/language-tools/issues/1375))
- fix: template diagnostics incomplete on vue-tsc ([#1372](https://github.com/vuejs/language-tools/issues/1372))
- fix: respected `textDocument.completion.completionItem.insertReplaceSupport` ([#1373](https://github.com/vuejs/language-tools/issues/1373))

**Breaking changes**

- ~~feat: report error for unkonwn props ([#1077](https://github.com/vuejs/language-tools/issues/1077))~~ (Disabled by default in v0.36.1) 

## 0.35.2 (2022/5/30)

- feat: add tsc problemMatchers settings ([#1277](https://github.com/vuejs/language-tools/issues/1277))
- fix: cannot watch external .d.ts file changes ([#1343](https://github.com/vuejs/language-tools/issues/1343))
- fix: incorrect typescript error report with hgroup in template ([#1340](https://github.com/vuejs/language-tools/issues/1340))
- fix: style variable injection syntax highlight not working for style languages other then `css` ([#1365](https://github.com/vuejs/language-tools/issues/1365))
- fix: false positive type check for method arguments with `defineExpose` ([#1364](https://github.com/vuejs/language-tools/issues/1364))
- fix: avoid html emmet active in style block ([#1358](https://github.com/vuejs/language-tools/issues/1358))
- fix: unable to recognize the type of parameters as alongside `<script setup>` ([#1324](https://github.com/vuejs/language-tools/issues/1324))
- fix: component export default jsdoc loss when use `<script setup>` ([#1327](https://github.com/vuejs/language-tools/issues/1327))
- fix: false positive `@ts-expect-error` error in `withDefaults()` ([#1336](https://github.com/vuejs/language-tools/issues/1336))

## 0.35.0 (2022/5/28)

- perf: support TS auto-import cache for TS 4.7 ([#1360](https://github.com/vuejs/language-tools/issues/1360))
  - Please use 0.34.17 for TS 4.6.4 or lower

## 0.34.17 (2022/5/28)

- feat: do not show unknown tag as red ([#1247](https://github.com/vuejs/language-tools/issues/1247))
- feat: do not default enable `editor.semanticHighlighting.enabled`
- feat: support syntax highlight for style variable injection
- fix: auto import creates wrong identifier when dot in file name ([#1335](https://github.com/vuejs/language-tools/issues/1335))
- fix: avoid language server crash on TS 4.7 ([#1300](https://github.com/vuejs/language-tools/issues/1300))
- fix: namespaced component type-check not working

## 0.34.16 (2022/5/23)

- feat: add experimental option `vueCompilerOptions.experimentalRuntimeMode` for adapt uni-app ([#1308](https://github.com/vuejs/language-tools/issues/1308))
- fix: type narrowing broken by local variable declare in template ([#1312](https://github.com/vuejs/language-tools/issues/1312))
- fix: cannot recognize component context on arg typeof of arrow function in template ([#1326](https://github.com/vuejs/language-tools/issues/1326))
- fix: emmet suggestion interrupt when input symbol ([#1322](https://github.com/vuejs/language-tools/issues/1322))
- fix: split editors layout not following settings `volar.splitEditors.layout.*` ([#1330](https://github.com/vuejs/language-tools/issues/1330))

## 0.34.15 (2022/5/16)

- feat: support auto-complete for template local variables ([#1284](https://github.com/vuejs/language-tools/issues/1284))
- feat: check if vetur is active on doctor panel ([#1305](https://github.com/vuejs/language-tools/issues/1305))
- feat: enabled `experimentalImplicitWrapComponentOptionsWithDefineComponent` for `lang="js"` by default ([#1298](https://github.com/vuejs/language-tools/issues/1298))
- feat: add `vueCompilerOption.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup` option to improve intellisense on script setup for `lang="js"` ([#1192](https://github.com/vuejs/language-tools/issues/1192))

## 0.34.14 (2022/5/13)

- feat: add setting `volar.vueserver.maxOldSpaceSize` to modify language server memory limit ([#1299](https://github.com/vuejs/language-tools/issues/1299))
- feat: add settings `volar.preview.script.vite`, `volar.preview.script.nuxi` to customize preview server command
- feat: move takeover mode status to status bar ([#1294](https://github.com/vuejs/language-tools/issues/1294))
- feat: add settings to customize split editors layout ([#810](https://github.com/vuejs/language-tools/issues/810))
- fix: tsconfig status and ts version status dons't show with ts file on takeover mode

## 0.34.13 (2022/5/12)

- feat: list vue meetup events on preview loading
- feat: show basic infos by doctor command ([#1254](https://github.com/vuejs/language-tools/issues/1254))
- fix: avoid tsconfig include `.vue` files outside rootDir with typescript plugin ([#1276](https://github.com/vuejs/language-tools/issues/1276))

**Breaking changes**
- Changed `vueCompilerOptions` property `experimentalShamefullySupportOptionsApi` to `experimentalImplicitWrapComponentOptionsWithDefineComponent` and disabled by default ([#1291](https://github.com/vuejs/language-tools/issues/1291))

## 0.34.12 (2022/5/10)

- chore: change extensions publisher ([#1124](https://github.com/vuejs/language-tools/issues/1124))
- feat: add `"warning"` option to `experimentalShamefullySupportOptionsApi` and make default
- feat: allow type narrowing in inline handlers bu config `"experimentalAllowTypeNarrowingInInlineHandlers": true` in vueCompilerOptions ([#1249](https://github.com/vuejs/language-tools/issues/1249))
- fix: avoid report error with config `"module": "es2015"` in tsconfig ([#1263](https://github.com/vuejs/language-tools/issues/1263))
- fix: find references result has invalid item
- fix: property access errors loss in template ([#1264](https://github.com/vuejs/language-tools/issues/1264))
- fix: cannot rename html tag in some cases ([#1272](https://github.com/vuejs/language-tools/issues/1272))

## 0.34.11 (2022/4/29)

- fix: cannnot trigger auto-complete in import statement by input space
- fix: duplicate diagnostics in *.ts on takeover mode ([#1234](https://github.com/vuejs/language-tools/issues/1234))
- fix: style block has redundant html emmet result ([#1244](https://github.com/vuejs/language-tools/issues/1244))
- fix: language server crash with low TS version ([#1242](https://github.com/vuejs/language-tools/issues/1242))
- fix: directives type-check not working ([#1228](https://github.com/vuejs/language-tools/issues/1228))
- fix: auto-complete replace range incorrect in import statement ([#1227](https://github.com/vuejs/language-tools/issues/1227))

## 0.34.10 (2022/4/24)

- fix: template bindings error incomplete ([#1205](https://github.com/vuejs/language-tools/issues/1205))
- fix: avoid auto-import added on same line as `<script>` ([#916](https://github.com/vuejs/language-tools/issues/916))
- fix: embedded html interpolations syntax highlight not working in markdown
- fix: inlay hints not working in template
- fix: preview broken on nuxt3 rc ([#1225](https://github.com/vuejs/language-tools/issues/1225))
- fix: cannot use import equals in script setup ([#1223](https://github.com/vuejs/language-tools/issues/1223))
- fix: directives syntax highlight display incorrect in html comment inside svg tag ([#1206](https://github.com/vuejs/language-tools/issues/1206))

## 0.34.9 (2022/4/21)

- fix: vue documents diagnostics cannot update when other drive ts file changed
- fix: ts declaration diagnostics missing ([#1222](https://github.com/vuejs/language-tools/issues/1222))

## 0.34.8 (2022/4/21)

- feat: support inlay hints ([#452](https://github.com/vuejs/language-tools/pull/452))
  - if you're not using VSCode, you should config new option `languageFeatures.inlayHints = true` in initializationOptions to enable it
- feat: allow disable highlight dom elements on preview ([#1209](https://github.com/vuejs/language-tools/issues/1209))
- feat: improve dom elements highlight display refresh
- fix: `typescript.format.semicolons` should not affect text interpolation ([#1210](https://github.com/vuejs/language-tools/issues/1210))
- fix: vscode settings cannot update for document features ([#1210](https://github.com/vuejs/language-tools/issues/1210))
- fix: `{{ { foo } }}` object literal expression not working on text interpolations
- fix: cannot infer event type with prop name format `onFoo-bar` ([#1023](https://github.com/vuejs/language-tools/issues/1023))
- fix: scoped class references not accurate on long document ([#1059](https://github.com/vuejs/language-tools/issues/1059))
- fix: cannot update unediting vue document diagnostics ([#1163](https://github.com/vuejs/language-tools/issues/1163))
- fix: emmet not working in style block ([#1145](https://github.com/vuejs/language-tools/issues/1145))
- fix: nuxt preview not working on windows ([#1123](https://github.com/vuejs/language-tools/issues/1123))

## 0.34.7 (2022/4/16)

- feat: add option `experimentalShamefullySupportOptionsApi` to vueCompilerOptions ([#1202](https://github.com/vuejs/language-tools/issues/1202))
- fix: use html renaming instead of ts renaming on tags ([#1201](https://github.com/vuejs/language-tools/issues/1201))
- fix: not support lowser node version ([#1200](https://github.com/vuejs/language-tools/issues/1200))
- fix: cannot update global components props completion list ([#1196](https://github.com/vuejs/language-tools/issues/1196))
- fix: `svg` attributes report false positive void type ([#1184](https://github.com/vuejs/language-tools/issues/1184))
- fix: css module types missing on template context ([#1178](https://github.com/vuejs/language-tools/issues/1178))
- fix: false positive error with withDefaults + "strictNullChecks": false ([#1187](https://github.com/vuejs/language-tools/issues/1187))

**Breaking changes**
- sass formatter is moved to external plugin: https://github.com/vuejs/language-tools-plugins/tree/master/packages/sass-formatter

## 0.34.6 (2022/4/12)

- feat: add prompt for `"jsx": "preserve"` missing
- fix: auto-complete break language server if `"jsx": "preserve"` missing ([#1171](https://github.com/vuejs/language-tools/issues/1171))
- fix: typescript plugin extension not working ([#1173](https://github.com/vuejs/language-tools/issues/1173))
- fix: code action not working on *.ts with take over mode ([#1169](https://github.com/vuejs/language-tools/issues/1169))
- fix: object computed property name report false positive error in template ([#1176](https://github.com/vuejs/language-tools/issues/1176))
- fix: should count variable uses with ref attribute ([#1168](https://github.com/vuejs/language-tools/issues/1168))

## 0.34.5 (2022/4/11)

- feat: preset `"jsx": "preserve"` for non-tsconfig project
- fix: avoid template report errors if `"jsx": "preserve"` missing ([#1161](https://github.com/vuejs/language-tools/issues/1161))
- fix: attrs auto-complete and tag highlight incorrect on js project ([#1158](https://github.com/vuejs/language-tools/issues/1158))
- fix: script setup report false positive error with defineExpose type arg ([#1165](https://github.com/vuejs/language-tools/issues/1165))

**Breaking changes**

- `@volar/pug-language-service` now is a optional depend on vue-tsc, you need to install it additionally to support pug template type-checking on vue-tsc ([#1092](https://github.com/vuejs/language-tools/issues/1092))

## 0.34.4 (2022/4/12)

- fix: script setup report false positive error with multi-line interpolation
- fix: object spread assignment not working in template
- fix: html formatting result incorrect

## 0.34.3 (...)

- feat: release `@volar/preview` for support vite, nuxt 3 app preview features other then vscode IDEs ([#1115](https://github.com/vuejs/language-tools/issues/1115))
- fix: `require()` should not report error in template ([#1161](https://github.com/vuejs/language-tools/issues/1161))
- fix: template interpolations syntax broken with inline block comments ([#1143](https://github.com/vuejs/language-tools/issues/1143))
- fix: vue-tsc emit declaration diagnostics incomplete ([#1127](https://github.com/vuejs/language-tools/issues/1127))
- fix: ts plugin should not affect to non-vue project ([#1144](https://github.com/vuejs/language-tools/issues/1144))
- fix: object literal santax not working in directive and v-for expressions ([#1160](https://github.com/vuejs/language-tools/issues/1160))
- fix: shorthand property assignment santax not working in template ([#1156](https://github.com/vuejs/language-tools/issues/1156))
- fix: should not emit `__VLS_` files file with `vue-tsc --declaration --emitDeclarationOnly`
- fix: `experimentalDisableTemplateSupport` not working
- fix: formatting crashes with inline v-bind on scoped v-slot ([#1151](https://github.com/vuejs/language-tools/issues/1151))
- fix: language server broken in js project without allowJs

**Breaking changes**

- Changed `experimentalResolveNonScopedCssClasses` to `experimentalResolveStyleCssClasses` ([#1121](https://github.com/vuejs/language-tools/issues/1121))

## 0.34.2 (2022/4/10)

- fix: add missing depend for vue-tsc ([#1154](https://github.com/vuejs/language-tools/issues/1154))
- fix: css format should not trimmed new lines ([#1155](https://github.com/vuejs/language-tools/issues/1155))

## 0.34.1 (2022/4/10)

- fix: fixed vue-tsc broken regression

## 0.34.0 (2022/4/10)

- feat: expose `useConfigurationHost` for external language feature plugins
- perf: faster language server initialization
- perf: simplify template script generation ([#455](https://github.com/vuejs/language-tools/issues/455))
- perf: reduce TS language service instances ([#1108](https://github.com/vuejs/language-tools/issues/1108))
- fix: web bundle lead to package size greatly increased ([#1084](https://github.com/vuejs/language-tools/issues/1084))
- fix: undefined sortText break vim ([#1118](https://github.com/vuejs/language-tools/issues/1118))
- fix: template context do not update by external .ts scripts ([#565](https://github.com/vuejs/language-tools/issues/565))
- fix: not respect HTML completion settings ([#1139](https://github.com/vuejs/language-tools/issues/1139))
- chore: default disabled `volar.autoCompleteRefs` for reduce CPU usage

**Breaking changes**

- Not support typed template slots for now ([#1108](https://github.com/vuejs/language-tools/issues/1108))
- Not support emits renaming
- Not support props renaming for `Vue.extends` or `lang="js"`
- Changed built-in HTML formatter from `prettyhtml` to `vscode-html-languageservice` ([#1078](https://github.com/vuejs/language-tools/issues/1078))
  - If you would like to use `prettyhtml`, see `prettyhtml` section in https://github.com/vuejs/language-tools/discussions/1027
- Changed built-in CSS formatter from `prettier` to `vscode-css-languageservice` ([#1131](https://github.com/vuejs/language-tools/issues/1131))
  - If you would like to use `Prettier`, see `Prettier` section in https://github.com/vuejs/language-tools/discussions/1027
- Changed setting `volar.lowPowerMode` to `volar.vueserver.useSecondServer` and disabled by default
  - When disabled, language service instance reduce a half of memory usage, but auto-complete should be slower in expected
- `"jsx": "preserve"` now is required for template type-checking ([#1153](https://github.com/vuejs/language-tools/issues/1153))

## 0.33.10 (2022/3/27)

- feat: support preview features on external browser
  - press `Alt` key to activating go to code feature
- fix: can't open multiple preview windows

## 0.33.9 (2022/3/25)

- perf: faster vue-tsc watch response
- fix: memory leak on vue-tsc watch ([#1106](https://github.com/vuejs/language-tools/issues/1106))
- fix: emmet block html src path completion ([#1105](https://github.com/vuejs/language-tools/issues/1106))

## 0.33.8 (2022/3/24)

- feat: highlight selections code on preview
- feat: add setting to disable preview icons ([#1101](https://github.com/vuejs/language-tools/issues/1101))

## 0.33.7 (2022/3/23)

- feat: support nuxt 3 app preview and goto code
- fix: avoid click event on element when use goto code
- fix: style codeLens references always show 0 references ([#1095](https://github.com/vuejs/language-tools/issues/1095))

## 0.33.6 (2022/3/22)

- fix: TS completion not working in interpolations ([#1088](https://github.com/vuejs/language-tools/issues/1088))
- fix: not respected `html.autoCreateQuotes`, `html.autoClosingTags` settings ([#840](https://github.com/vuejs/language-tools/issues/840))
- fix: organize imports code action edge range incorrect ([#1091](https://github.com/vuejs/language-tools/issues/1091))
- fix: don't report css module `$style` types error on vue-tsc ([#1089](https://github.com/vuejs/language-tools/issues/1089))
- fix: css vars no effect on vue-tsc ([#1093](https://github.com/vuejs/language-tools/issues/1093))

## 0.33.5 (2022/3/21)

- fix: diagnostics not update ([#1076](https://github.com/vuejs/language-tools/issues/1076))

## 0.33.4 (2022/3/21)

- fix: expand selection broken since 0.33.0 ([#1085](https://github.com/vuejs/language-tools/issues/1085))
- fix: vueCompilerOptions typo `experimentalRsolveNonScopedCssClasses` -> `experimentalResolveNonScopedCssClasses`
- fix: 0.33.3 release packages missing `/out` directory ([#1086](https://github.com/vuejs/language-tools/issues/1086))

## 0.33.3 (2022/3/21)

- feat: support attribute binding syntax `:<name>.attr` ([#1047](https://github.com/vuejs/language-tools/pull/1047))
- feat: supoprt document features for Web IDE ([#612](https://github.com/vuejs/language-tools/issues/612))
- feat: add option to support intellisense for non-scoped css ([#1038](https://github.com/vuejs/language-tools/issues/1038))
- feat: reduce vue-tsc depends
- fix: json schema request service not available since 0.33.0 ([#243](https://github.com/vuejs/language-tools/issues/243))
- fix: remove `console.log` avoid vim-lsp crash ([#1046](https://github.com/vuejs/language-tools/pull/1046))
- fix: emmet suggestions messed up embedded language suggestions ([#1039](https://github.com/vuejs/language-tools/issues/1039))
- fix: missing proposals for HTML attribute value ([#1072](https://github.com/vuejs/language-tools/issues/1072))
- fix: vue-tsc watch not always catch vue file changes ([#1082](https://github.com/vuejs/language-tools/issues/1082))
- fix: previewer not working with pnpm ([#1074](https://github.com/vuejs/language-tools/issues/1074))
- fix: global components type not working with `vue-class-component` ([#1061](https://github.com/vuejs/language-tools/issues/1061))
- fix: goto component definition not working with some syntax ([#435](https://github.com/vuejs/language-tools/issues/435)) ([#1048](https://github.com/vuejs/language-tools/issues/1048))
- fix: directives argument should be optional if argument could be undefined ([#1040](https://github.com/vuejs/language-tools/issues/1040))

## 0.33.2 (2022/3/15)

- feat: add option `vueCompilerOptions.experimentalDisableTemplateSupport` to disable template type-check and intellisense ([#577](https://github.com/vuejs/language-tools/issues/577))
- fix: avoid props jsdoc erase by `withDefaults`
- fix: sponsors svg never update

## 0.33.1 (2022/3/14)

- feat: improve formatting error tolerance ([#1033](https://github.com/vuejs/language-tools/issues/1033))
- fix: template report unexpected errors ([#1036](https://github.com/vuejs/language-tools/issues/1036)) ([#1037](https://github.com/vuejs/language-tools/issues/1037))
- fix: can't extract template context in js ([#1035](https://github.com/vuejs/language-tools/issues/1035))

## 0.33.0 (2022/3/13)

- feat: reduce vue-tsc depends
- feat: support more language features for `lang="json"` custom block
- feat: support for goto implementations
  - if you're not using VSCode, you should config new option `languageFeatures.implementation = true` in initializationOptions to enable it
- feat: support custom language service plugins for ([#1028](https://github.com/vuejs/language-tools/pull/1028)):
  - change built-in formatters
  - add language support for custom block with any other language yourself
- feat: support vue-tsc watch ([#1030](https://github.com/vuejs/language-tools/pull/1030))
- feat: preview features not longer needed authentication
- fix: pug formatting broken ([#1002](https://github.com/vuejs/language-tools/issues/1002))
- fix: vite app preview not working on windows ([#1013](https://github.com/vuejs/language-tools/issues/1013))
- fix: fallback event type behavior for invalid type components ([#1001](https://github.com/vuejs/language-tools/issues/1001)) ([#1026](https://github.com/vuejs/language-tools/issues/1026))

**Breaking changes**

- `@volar/server` renamed to `@volar/vue-language-server`
  - cli command `vue-server` changed to `vue-language-server`
- `vscode-vue-languageservice` renamed to `@volar/vue-language-service`
- `vscode-typescript-languageservice` renamed to `@volar/typescript-language-service`
- `vscode-json-languageservice` renamed to `@volar/json-language-service`

## 0.32.1 (2022/3/2)

- feat: support generic events with props ([#981](https://github.com/vuejs/language-tools/issues/981))
- fix: slots references always 0 ([#932](https://github.com/vuejs/language-tools/issues/932))
- fix: `source.organizeImports` not working in `editor.codeActionsOnSave` ([#906](https://github.com/vuejs/language-tools/issues/906))
- fix: component type incorrect if duplicate name with current `<script setup>` file name ([#944](https://github.com/vuejs/language-tools/issues/944))
- fix: language server broken if TS version \< 4.4 ([#962](https://github.com/vuejs/language-tools/issues/962))
- fix: pug outline element level incorrect ([#969](https://github.com/vuejs/language-tools/issues/969))
- fix: document symbols confusion between `<script>` and `<script setup>` ([#994](https://github.com/vuejs/language-tools/issues/994))
- fix: vite icon do not show with first editor

## 0.32.0 (2022/2/25)

- feat: experimental webview features for vite ([#208](https://github.com/vuejs/language-tools/issues/208))
- perf: bundle extension to speed up startup

## 0.31.4 (2022/2/14)

- perf: faster auto-import completion ([#808](https://github.com/vuejs/language-tools/issues/808))

## 0.31.3 (2022/2/13)

- feat: trigger event auto-complete when input `@` ([#949](https://github.com/vuejs/language-tools/issues/949))
- feat: add `v-bind:*`, `v-on:*` to auto-complete ([#949](https://github.com/vuejs/language-tools/issues/949))
- feat: avoid auto import added in script block first line ([#916](https://github.com/vuejs/language-tools/issues/916))
- fix: language features not working in symbolic link project ([#914](https://github.com/vuejs/language-tools/issues/914))
- fix: language server throw in `process.env.NODE_ENV === 'production'` env ([#915](https://github.com/vuejs/language-tools/issues/915))
- fix: component type broken by union event key type ([#926](https://github.com/vuejs/language-tools/issues/926))
- fix: document symbol not working for `<script setup>` ([#938](https://github.com/vuejs/language-tools/issues/938))

## 0.31.2 (2022/2/6)

- feat: improve scoped css class name references codeLens, auto-complete ([#907](https://github.com/vuejs/language-tools/issues/907))

## 0.31.1 (2022/1/22)

- fix: support type export statements on the top in `<script setup>` ([#886](https://github.com/vuejs/language-tools/issues/886))

## 0.31.0 (2022/1/22)

- feat: support generic emits ([#877](https://github.com/vuejs/language-tools/issues/877))
- feat: support top level await in `<script setup>` without extra tsconfig setting ([#538](https://github.com/vuejs/language-tools/issues/538))
- feat: fully support formatting for v-for expression
- fix: can't ignore variable unused report by `_` prefixes in v-for ([#878](https://github.com/vuejs/language-tools/issues/878))
- fix: no error when definitions from `<script setup>` used in `<script>` ([#766](https://github.com/vuejs/language-tools/issues/766))

## 0.30.6 (2022/1/19)

- fix: re-support `withDefaults` for props type in template ([#868](https://github.com/vuejs/language-tools/issues/868))
- fix: tsconfig report `schemas/tsconfig.schema.json` missing ([#869](https://github.com/vuejs/language-tools/issues/869))
- fix: enabled `editor.semanticHighlighting.enabled` by default to avoid component tag show invalid color when installed some themes
- fix: export default expression semicolon breaks component type in script setup ([#874](https://github.com/vuejs/language-tools/issues/874))
- fix: don't wrap options with defineComponent when convert to setup sugar

**Breaking changes**

- When use `<script setup>`, ignore extra component options wrapper function (`defineComponent` / `Vue.extends` ...)

## 0.30.5 (2022/1/17)

- fix: `vueCompilerOptions` intellisense not working on jsconfig
- fix: vue-tsc broken on windows in 0.30.3

## 0.30.4 (2022/1/16)

- fix: component tag semantic highlisht token incorrect with folding ([#801](https://github.com/vuejs/language-tools/issues/801))
- fix: component type broken by `withDefaults` in 0.30.3

**Breaking changes**

- Unsupported `withDefaults` for component props type

## 0.30.3 (2022/1/16)

- feat: auto wrap `()` to as expression (`v-bind="foo as string"` -> `v-bind="(foo as string)"` ([#859](https://github.com/vuejs/language-tools/issues/859))
- feat: support tsconfig properties intellisense on take over mode ([#833](https://github.com/vuejs/language-tools/issues/833))
- feat: support `vueCompilerOptions` intellisense in tsconfig ([#833](https://github.com/vuejs/language-tools/issues/833))
- fix: vue-tsc and typescript could't guaranteed found each other ([#851](https://github.com/vuejs/language-tools/pull/851))
- fix: avoid vue-tsc stripped props jsdoc comments for script setup components ([#799](https://github.com/vuejs/language-tools/issues/799))
- fix: string source type incorrect in v-for ([#839](https://github.com/vuejs/language-tools/pull/839))

**Known regressions**

- component type broken by `withDefaults`
- vue-tsc broken on windows

## 0.30.2 (2022/1/4)

- feat: jsdoc comment suggestion ([#827](https://github.com/vuejs/language-tools/issues/827))
- feat: TS directive comment suggestion
- feat: auto insert attribute quotes
- fix: css error range not reliable ([#826](https://github.com/vuejs/language-tools/issues/826))
- fix: html, css completion trigger characters
- fix: allow loose vue language id for markdown ([#831](https://github.com/vuejs/language-tools/issues/831))
- fix: avoid auto close tag with undo ([#837](https://github.com/vuejs/language-tools/issues/837))

## 0.30.1 (2021/12/27)

- feat: support vue 2 component slots type ([#819](https://github.com/vuejs/language-tools/pull/819))
- feat: expose component public instance type by `defineExpose`
- feat: support scoped class name auto-complete ([#752](https://github.com/vuejs/language-tools/issues/752))
- feat: alway show commands after extension activated ([#795](https://github.com/vuejs/language-tools/issues/795))

**Breaking changes**

- Unsupported `vueCompilerOptions.experimentalExposeScriptSetupContext` option

## 0.30.0 (2021/12/21)

- feat: support components type-check by `static components` for class-base component ([#753](https://github.com/vuejs/language-tools/issues/753))
- feat: support `vueCompilerOptions.experimentalExposeScriptSetupContext` option for jest ([#805](https://github.com/vuejs/language-tools/issues/805))
- feat: support `typescript.suggest.autoImports` setting ([#746](https://github.com/vuejs/language-tools/issues/746))
- fix: `@vue/composition-api` defineComponent types incorrect in template ([#780](https://github.com/vuejs/language-tools/issues/780))
- fix: directives syntax highlight incorrect in svg tag ([#776](https://github.com/vuejs/language-tools/issues/776))
- fix: project references ignored jsconfig ([#756](https://github.com/vuejs/language-tools/issues/756))
- fix: html semantic tokens range incorrect in long template code ([#801](https://github.com/vuejs/language-tools/issues/801))
- fix: `typescript.preferences.importModuleSpecifier` setting not working for component auto import ([#793](https://github.com/vuejs/language-tools/issues/793))
- fix: `Organize Imports` commmand not always working ([#798](https://github.com/vuejs/language-tools/issues/798))
- fix: css variable injection virtual code cannot update ([#777](https://github.com/vuejs/language-tools/issues/777))
- fix: should not initializes new language service when create a new file ([#802](https://github.com/vuejs/language-tools/issues/802))
- fix: new file first diagnostics incorrect 

**Breaking changes**

- Do not support component context types in template for `export default { ... }` without `Vue.extend` or `defineComponent` ([#750](https://github.com/vuejs/language-tools/pull/750))

## 0.29.8 (2021/11/30)

- perf: cache `URI.file`, `URI.parse` results
- fix: pug template type-check broken with omit tag name
- fix: language server broken with tsconfig extends a non-relative path ([#747](https://github.com/vuejs/language-tools/issues/747)) ([#749](https://github.com/vuejs/language-tools/issues/749))

## 0.29.7 (2021/11/29)

- feat: support html, css custom data ([#707](https://github.com/vuejs/language-tools/issues/707))
- feat: support extends tsconfig `vueCompilerOptions` ([#731](https://github.com/vuejs/language-tools/issues/731))
- fix: cannot config project reference by directory path ([#712](https://github.com/vuejs/language-tools/issues/712))
- fix: pug attrs type-check borken by nested tags ([#721](https://github.com/vuejs/language-tools/issues/721))
- fix: import path rename result incorrect ([#723](https://github.com/vuejs/language-tools/issues/723))
- fix: `editor.codeActionsOnSave: ["source.organizeImports"]` not working ([#726](https://github.com/vuejs/language-tools/issues/726))
- fix: goto definition not working with some component import statement ([#728](https://github.com/vuejs/language-tools/issues/728))
- fix: don't show volar commands in non-vue document ([#733](https://github.com/vuejs/language-tools/issues/733))
- fix: vue-tsc not working with symlink ([#738](https://github.com/vuejs/language-tools/issues/738))

## 0.29.6 (2021/11/21)

- fix: attrs show unexpected "not exist" error ([#710](https://github.com/vuejs/language-tools/issues/710))
- fix: verify all scripts not working if no jsconfig / tsconfig
- fix: organize import edit text range incorrect ([#714](https://github.com/vuejs/language-tools/issues/714))
- fix: class component props type-check not working with multiple props ([#705](https://github.com/vuejs/language-tools/issues/705))
- fix: emmet should not active in template interpolations
- fix: TS semantic highlight not working

## 0.29.5 (2021/11/15)

- feat: open tsconfig when click in status bar
- feat: add `experimentalTemplateCompilerOptionsRequirePath` option to allow import compiler options from js file ([#698](https://github.com/vuejs/language-tools/issues/698))
- fix: pug folding ranges break by empty line ([#688](https://github.com/vuejs/language-tools/issues/688))
- fix: reduce the intrusiveness of template type-check hacks ([#689](https://github.com/vuejs/language-tools/issues/689))
- fix: `@volar/server` entry files missing in npm publish ([#695](https://github.com/vuejs/language-tools/issues/695))
- fix: language server immediately crashes when trigger request at incomplete TS code ([#699](https://github.com/vuejs/language-tools/issues/699))
- fix: html / css path resolve incorrect on windows edge cases ([#694](https://github.com/vuejs/language-tools/issues/694))
- doc: fix incorrect `experimentalTemplateCompilerOptions` example: `"compatConfig": { "Mode": 2 }` -> `"compatConfig": { "MODE": 2 }`

## 0.29.4 (2021/11/12)

- feat: syntax highlight support for Web IDE ([#612](https://github.com/vuejs/language-tools/issues/612))
- fix: semantic highlight can't update if project have no tsconfig or jsconfig ([#685](https://github.com/vuejs/language-tools/issues/685))

## 0.29.3 (2021/11/27)

- feat: support syntax highlighting for `lang="toml"` ([#684](https://github.com/vuejs/language-tools/pull/684))
- fix: subfolder path resolve logic cause to TS crash edge case ([#679](https://github.com/vuejs/language-tools/issues/679))

## 0.29.2 (2021/11/9)

- fix: document server created multi time
- fix: html hover not working in some non-VSCode clients ([#678](https://github.com/vuejs/language-tools/issues/678))

## 0.29.1 (2021/11/9)

- fix: template AST broken by empty line in pug ([#676](https://github.com/vuejs/language-tools/issues/676))
- fix: intellisense not working if project have no jsconfig / tsconfig ([#680](https://github.com/vuejs/language-tools/issues/680)) ([#681](https://github.com/vuejs/language-tools/issues/681))

## 0.29.0 (2021/11/7)

- feat: support namespaced component ([#372](https://github.com/vuejs/language-tools/issues/372))
- feat: more strict `.value` auto-complete condition
- feat: show current tsconfig on status bar
- feat: provide public api to generate script setup type-check code ([#650](https://github.com/vuejs/language-tools/issues/650))
- feat: add sass formatter
- fix: can't exit split editors by click icon edge cases
- fix: semantic tokens not working in pug template
- fix: script setup component name not recognized edge cases
- fix: ignore template language support if not `html` or `pug` ([#659](https://github.com/vuejs/language-tools/pull/659))
- fix: tsconfig `types` paths resolve incorrect in monorepo ([#661](https://github.com/vuejs/language-tools/issues/661))
- fix: can't update diagnostics on windows + atom
- fix: project finding logic incorrect with tsconfig `referencecs` option ([#649](https://github.com/vuejs/language-tools/issues/649))
- fix: `{{ }}` colorized bracket pairs not working
- fix: documentSymbol, foldingRanges not working to some *.ts files on take over mode

**Breaking changes**

- experimentalCompatMode behavior changed ([#576](https://github.com/vuejs/language-tools/issues/576))\
do not force config `compatConfig: { Mode: 2 }` to template compiler with `"experimentalCompatMode": 2`

## 0.28.10 (2021/10/28)

- feat: improve pug folding range ([#636](https://github.com/vuejs/language-tools/issues/636))
- feat: improve pug tag, attr auto-complete ([#638](https://github.com/vuejs/language-tools/issues/638))
- fix: if trigger component auto-import multiple times, import edit text accumulate ([#639](https://github.com/vuejs/language-tools/issues/639))
- fix: filter current component from component auto-import list
- fix: normalize request uri for Sublime / Atom ([#637](https://github.com/vuejs/language-tools/issues/637))

**Known regressions**

- semantic tokens not working in pug template

## 0.28.9 (2021/10/26)

- feat: use VSCode 1.61 `Split Editor In Group` instead of create new editor ([#608](https://github.com/vuejs/language-tools/issues/608))
- feat: split editors layout change from `script | template | style` to `script + style | template`
- feat: tag name conversion work done progress
- fix: language server broken by circular tsconfig project references ([#525](https://github.com/vuejs/language-tools/issues/525)) ([#631](https://github.com/vuejs/language-tools/issues/631)) ([#632](https://github.com/vuejs/language-tools/issues/632))
- fix: vue-tsc can't show "incremental mode / watch mode not support" error message ([#630](https://github.com/vuejs/language-tools/issues/630))
- fix: tag name kebab case -> pascal case conversion not working
- fix: LSP workspace configuration option not supported ([#626](https://github.com/vuejs/language-tools/issues/626))
- fix: no edit to `components` option when component auto-import ([#634](https://github.com/vuejs/language-tools/issues/634))

## 0.28.8 (2021/10/24)

- feat: support html hover settings ([#627](https://github.com/vuejs/language-tools/issues/627)) ([#615](https://github.com/vuejs/language-tools/pull/628))
- fix: `withDefaults` can't narrowing props undefined ([#611](https://github.com/vuejs/language-tools/issues/611)) ([#614](https://github.com/vuejs/language-tools/issues/614))
- fix: vueCompilerOptions not working with vue-tsc --project flag ([#613](https://github.com/vuejs/language-tools/issues/613)) ([#615](https://github.com/vuejs/language-tools/pull/615))
- fix: tsconfig project references are not respected ([#525](https://github.com/vuejs/language-tools/issues/525))

## 0.28.7 (2021/10/18)

- fix: can't access `$slots`, `$props`... in template if no script block ([#601](https://github.com/vuejs/language-tools/issues/601))
- fix: defineEmit not working with type alias ([#607](https://github.com/vuejs/language-tools/issues/607))
- fix: `GlobalComponents` working for vue2 ([#609](https://github.com/vuejs/language-tools/issues/609))

## 0.28.6 (2021/10/16)

- feat: support for emit SFC dts by vue-tsc (See https://github.com/vuejs/language-tools/tree/master/packages/tsc#using)

## 0.28.5 (2021/10/16)

- feat: support search workspace symbols (command / ctrl + T) ([#549](https://github.com/vuejs/language-tools/issues/549))
- fix: alias path completion not working in root segment ([#589](https://github.com/vuejs/language-tools/issues/589))
- fix: can't convert invalid component type to `any` ([#594](https://github.com/vuejs/language-tools/issues/594))
- fix: `<script>` document symbols result inconsistent to TS

## 0.28.4 (2021/10/15)

- feat: support for open `*.ts` to enable take over mode
- fix: `any` type component should not show red color
- fix: auto-import should not from virtual file `__VLS_vue` ([#584](https://github.com/vuejs/language-tools/issues/584))
- fix: path auto-complete not working in template ([#589](https://github.com/vuejs/language-tools/issues/589))

## 0.28.3 (2021/10/12)

- feat: add option to disable component auto import ([#440](https://github.com/vuejs/language-tools/issues/440))
- feat: add `volar.takeOverMode.enabled` setting to allow enable take over mode even TS extension active
- fix: only the last typed event of defineEmits gets recognized ([#578](https://github.com/vuejs/language-tools/issues/578))
- fix: syntax highlight incorrect if event name has number
- fix: dynamic slot syntax highlight incorrect
- fix: interpolations syntax highlight should not active in html comment block
- fix: multi-line event expression formatting indent incorrect ([#579](https://github.com/vuejs/language-tools/issues/579))

## 0.28.2 (2021/10/11)

- fix: args-less events type incorrect ([#575](https://github.com/vuejs/language-tools/issues/575))
- fix: `@vue/composition-api` events type incorrect ([#576](https://github.com/vuejs/language-tools/issues/576))

## 0.28.1 (2021/10/9)

- fix: don't report error `Its return type 'xxx' is not a valid JSX element.` to invalid functional component type ([#574](https://github.com/vuejs/language-tools/issues/574))
- fix: improve `$emit` types extract for events type-checking ([#567](https://github.com/vuejs/language-tools/issues/567))
- fix: css class references not working for pug ([#569](https://github.com/vuejs/language-tools/issues/569))
- fix: completion broken in Sublime ([#573](https://github.com/vuejs/language-tools/issues/573))

## 0.28.0 (2021/10/8)

- feat: make vue-tsc version consistency to volar ([vue-tsc#72](https://github.com/johnsoncodehk/vue-tsc/issues/72))
- feat: remove tsPlugin prompt
- feat: remove vue-tsc version checking
- fix: avoid `noPropertyAccessFromIndexSignature` effect to slots ([#561](https://github.com/vuejs/language-tools/issues/561))
- fix: interpolations syntax highlight not working in html ([#562](https://github.com/vuejs/language-tools/issues/562))
- fix: style attr can't end with `'` ([#563](https://github.com/vuejs/language-tools/issues/563))
- refactor: rewrite vue-tsc by TS

## 0.27.30 (2021/10/6)

- feat: support syntax highlight for vue blocks in markdown
- feat: support vue directives, interpolations syntax highlight for html / pug code outside vue script
- fix: template type-checking incorrectly reports error when using pnpm
- fix: template slots type-check broken
- fix: allow component type that missing `$props` property
- fix: slots type broken by expression-less attributes

## 0.27.29 (2021/10/6)

- fix: don't pass unsupport component type to JSX ([#553](https://github.com/vuejs/language-tools/issues/553))
- fix: dynamic props borken ([#555](https://github.com/vuejs/language-tools/issues/555))
- fix: don't show virtual files in find references result
- fix: directives type-check broken

**Breaking changes since 0.27.27**

- If your project includes Storybook or `@types/react`, you need to config tsconfig `types` option to avoid `@types/react` affect to template type-checking. See [#552](https://github.com/vuejs/language-tools/issues/552).

## 0.27.28 (2021/10/3)

- feat: support generic `$slots` types
- feat: improve `v-for` typing ([#546](https://github.com/vuejs/language-tools/pull/546))
- feat: support vue project isn't root folder ([#541](https://github.com/vuejs/language-tools/issues/541))
- fix: slots type of any type component incorrect ([#547](https://github.com/vuejs/language-tools/issues/547))
- fix: optional `$slots` type incorrect
- fix: ignore union type component to avoid error in template ([vue-tsc#80](https://github.com/johnsoncodehk/vue-tsc/issues/80))

## 0.27.27 (2021/10/2)

- feat: support slots type-checking by `$slots` property ([#539](https://github.com/vuejs/language-tools/issues/539))
- fix: generic props type-check not working
- fix: `Map` index type incorrect in v-for ([#544](https://github.com/vuejs/language-tools/issues/544))

## 0.27.26 (2021/9/28)

- fix: variables unused report can't update in *.ts in take over mode
- fix: when save file, next document changes diagnostics, semantic tokens incorrect

## 0.27.25 (2021/9/26)

- feat: add open VSCode settings json button in takeover mode prompt
- feat: disable code convert codeLens by default
- perf: use VSCode's file watcher instead of TS file watcher to reduce cpu usage ([#523](https://github.com/vuejs/language-tools/issues/523))
- perf: remove redundant fileExists logic
- fix: fixed zero length TS diagnostics missing ([#527](https://github.com/vuejs/language-tools/pull/527))
- fix: import statements auto-complete not working in latest VSCode

## 0.27.24 (2021/9/23)

- feat: support TS annotation on v-model ([#518](https://github.com/vuejs/language-tools/issues/518))
- fix: events type-check don't report errors ([#516](https://github.com/vuejs/language-tools/issues/516)) ([#517](https://github.com/vuejs/language-tools/issues/517))
- fix: hyphen events types incorrect ([#515](https://github.com/vuejs/language-tools/issues/515))
- fix: find references, renaming not working to template in takeover mode ([#519](https://github.com/vuejs/language-tools/issues/519))
- fix: exclude files should fallback to inferred project ([#511](https://github.com/vuejs/language-tools/issues/511)) ([#445](https://github.com/vuejs/language-tools/issues/445))

## 0.27.23 (2021/9/20)

- feat: support `<script setup>` types in template expressions
- feat: support TS syntax highlighting in template expressions
- perf: cpu keep high usages if node_modules contains lot of d.ts files ([#507](https://github.com/vuejs/language-tools/issues/507))
- perf: lazy calculation TS plugin proxy, TS program proxy to reduce initialization time ([#507](https://github.com/vuejs/language-tools/issues/507))
- fix: SFC validation broken with `lang="postcss"` ([#508](https://github.com/vuejs/language-tools/issues/508))

## 0.27.22 (2021/9/19)

- feat: remove TS plugin to single extension ([#501](https://github.com/vuejs/language-tools/issues/501))
- fix: `v-for` item type report circular reference edge case
- fix: external file snapshot cannot update in TS plugin ([#506](https://github.com/vuejs/language-tools/issues/506))
- fix: cannot extract superset `DefineComponent` emit option type ([#495](https://github.com/vuejs/language-tools/issues/495))
- fix: sometime component props auto-complete not working in template
- fix: should not ignore `.vitepress` folder ([#506](https://github.com/vuejs/language-tools/issues/506))
- fix: fixed a few drive file update event logic

## 0.27.21 (2021/9/16)

- feat: support css settings ([#492](https://github.com/vuejs/language-tools/issues/492))
- perf: cache vscode configuration
- fix: props auto-complete not working for hyphenate components ([#487](https://github.com/vuejs/language-tools/issues/487))
- fix: inline style with line break is broken ([#489](https://github.com/vuejs/language-tools/issues/489))
- fix: cannot find module 'upath' in vscode-pug-languageservice ([#493](https://github.com/vuejs/language-tools/issues/493))

## 0.27.20 (2021/9/14)

- perf: improve template type-checking performance
- fix: template component tags coloring range incorrect
- fix: improve vue-tsc version checking accuracy
- fix: language server broken when typed `\` ([#468](https://github.com/vuejs/language-tools/issues/468))
- fix: remove old status bar items when restart servers ([#486](https://github.com/vuejs/language-tools/issues/486))
- fix: fixed emits type extract failed edge cases

## 0.27.19 (2021/9/13)

- feat: support dynamic prop
- perf: much faster template type-checking for vue-tsc

## 0.27.18 (2021/9/11)

- feat: support renaming for `ref="xxx"` ([#472](https://github.com/vuejs/language-tools/issues/472))
- feat: support bracket pair colorization
- fix: request failed when typing `import |` if TS version \< 4.3 ([#468](https://github.com/vuejs/language-tools/issues/468))
- fix: `ref` attribute type incorrect ([#473](https://github.com/vuejs/language-tools/issues/473))
- fix: `v-bind` + single quote parse failed ([#474](https://github.com/vuejs/language-tools/issues/474))
- fix: tag name conversion not working ([#475](https://github.com/vuejs/language-tools/issues/475))
- fix: auto import path preview not working

## 0.27.17 (2021/9/9)

- 🎉 feat: take over mode ([#471](https://github.com/vuejs/language-tools/discussions/471))
- feat: ts plugin status bar default hide
- feat: improve accurate style variables support ([#463](https://github.com/vuejs/language-tools/issues/463))
- fix: javascript format settings not working ([#466](https://github.com/vuejs/language-tools/issues/466))
- fix: semantics token not working in *.ts ([#469](https://github.com/vuejs/language-tools/issues/469))
- fix: fixed formatting result broken extreme case ([#470](https://github.com/vuejs/language-tools/issues/470))

## 0.27.16 (2021/9/7)

- feat: reuse `volar.tsPlugin`
- fix: can't override events type by props
- fix: don't report error on unknown events
- fix: `any` type comoponent should not show red ([#461](https://github.com/vuejs/language-tools/issues/461))
- fix: html element attrs type-check broken

## 0.27.15 (2021/9/6)

- fix: template slot type-checking broken ([vue-tsc#70](https://github.com/johnsoncodehk/vue-tsc/issues/70))
- fix: more accurate component props extract ([#459](https://github.com/vuejs/language-tools/issues/459))

## 0.27.14 (2021/9/6)

- feat: expose `@volar/server/out/index.js` to `volar-server` command ([#458](https://github.com/vuejs/language-tools/issues/458))
- fix: component type incorrect if duplicate name in props ([#453](https://github.com/vuejs/language-tools/issues/453))
- fix: fixed `typescript.serverPath` relative path finding

## 0.27.13 (2021/9/4)

- feat: support TS 4.4 ([#428](https://github.com/vuejs/language-tools/issues/428))

## 0.27.12 (2021/9/3)

- feat: support vue2 nameless event ([vue-tsc#67](https://github.com/johnsoncodehk/vue-tsc/issues/67))
- feat: support lsp client which unsupported workspaceFolders
- fix: `/** */` auto close not working ([#446](https://github.com/vuejs/language-tools/issues/446))

## 0.27.11 (2021/9/1)

- feat: unused dynamic registration to adapt nvim LSP [#441#issuecomment-895019036](https://github.com/vuejs/language-tools/discussions/441#discussioncomment-1258701)
- fix: can't not find template context properties if `<script>` block missing ([#437](https://github.com/vuejs/language-tools/issues/437))
- fix: import completion incorrectly append `$1` ([#371](https://github.com/vuejs/language-tools/issues/371))
- fix: completion should retrigger by space
- fix: json types cannot update in *.vue on editing

## 0.27.10 (2021/8/31)

- fix: `<script src>` unprocessed since v0.27.8 ([vue-tsc#65](https://github.com/johnsoncodehk/vue-tsc/issues/65))
- fix: TS plugin not working since v0.27.8 ([#435](https://github.com/vuejs/language-tools/issues/435))
- fix: de-ref-sugar conversion can't add missing imports
- fix: more acurrate code action result

## 0.27.9 (2021/8/29)

- feat: low power mode ([#390](https://github.com/vuejs/language-tools/issues/390))
- feat: improve setup sugar conversion
- fix: setup sugar convert failed since v0.27.8
- fix: incorrect indentation after generic argument ([#429](https://github.com/vuejs/language-tools/issues/429))

## 0.27.8 (2021/8/29)

- feat: consistent folding range with typescript-language-features ([#414](https://github.com/vuejs/language-tools/issues/414))
- feat: support custom directives type-checking with `<script setup>` ([#422](https://github.com/vuejs/language-tools/issues/422))
- feat: check directives used for `<script setup>` ([#327](https://github.com/vuejs/language-tools/issues/327))
- feat: improve SFC parser ([#420](https://github.com/vuejs/language-tools/issues/420))
- feat: .vscodeignore whitelist ([#423](https://github.com/vuejs/language-tools/issues/423))
- feat: more loose template type-check with `<script lang="js">`
- fix: specific language syntax highlighting not working with single quotes ([#409](https://github.com/vuejs/language-tools/issues/409))
- fix: component should be `any` is no script block ([#412](https://github.com/vuejs/language-tools/issues/412))
- fix: add `@volar/server` missing deps ([LSP-volar#9](https://github.com/sublimelsp/LSP-volar/issues/9))
- fix: add `@volar/transforms` missing deps ([#430](https://github.com/vuejs/language-tools/issues/430))
- fix: jsx / tsx syntax highlighting broken by html syntax injection ([#426](https://github.com/vuejs/language-tools/issues/426))
- perf: fixed high CPU usage after switched branch ([#432](https://github.com/vuejs/language-tools/issues/432))

**Breaking changes**

- remove tsPlugin required / unrequired prompt and `volar.tsPlugin` setting 

## 0.27.7 (2021/8/22)

- feat: check vue-tsc version on start extension ([#381](https://github.com/vuejs/language-tools/issues/381))
- feat: support for non-tsconfig project ([#349](https://github.com/vuejs/language-tools/issues/349))
- fix: tsconfig priority should be higher than jsconfig ([#400](https://github.com/vuejs/language-tools/issues/400))
- fix: fixed hover info broken in *.ts when TS plugin enabled

## 0.27.6 (2021/8/21)

- feat: support multiple `v-bind(...)` in single css expression
- feat: support `v-bind(...)` expression syntax with quotes
- fix: unhandled language client option: `showReferencesNotification`
- fix: codeLens resolve request broken in template

## 0.27.5 (2021/8/21)

- fix: language server borken when execute sugar convert commands ([#397](https://github.com/vuejs/language-tools/issues/397))

## 0.27.4 (2021/8/21)

- feat: support css variable injection ([#335](https://github.com/vuejs/language-tools/issues/335))
- feat: make `<script setup>` below `<script>` when convert to setup sugar ([#378](https://github.com/vuejs/language-tools/issues/378))
- feat: support sfc named css modules ([#379](https://github.com/vuejs/language-tools/issues/379))
- fix: `export default { ... }` syntax broken with setup sugar ([#383](https://github.com/vuejs/language-tools/issues/383))
- fix: attr name case option "pascalCase" -> "camelCase" ([#384](https://github.com/vuejs/language-tools/issues/384))
- fix: html completion edit range incorrect if typing before old completion request finish ([#385](https://github.com/vuejs/language-tools/issues/385))
- perf: faster intellisense and diagnostic in `<template>`

## 0.27.3 (2021/8/17)

- fix: go to component props definition broken in template
- perf: reduce virtual files for TS project (against 0.27.2)

## 0.27.2 (2021/8/17)

- feat: support template type-checking with jsdoc in `<script lang="js">`
- fix: `setup()` return properties unused check not working for component
- fix: radio v-model should not bind to checked
- fix: clear registered commands when restart servers ([#374](https://github.com/vuejs/language-tools/issues/374))

## 0.27.1 (2021/8/15)

- fix: remove `vscode-emmet-helper` rename warning for vue-tsc
- fix: components option should be remove when convert to setup sugar
- fix: fixed sometime throw error when convert setup sugar
- fix: prevent top level await error in `<script>` block

## 0.27.0 (2021/8/15)

- feat: support ref sugar (take 2) convert codeLens
- feat: support setup sugar convert codeLens
- feat: support more TS refactor code actions
- perf: faster code action and validation
- fix: setup returns unused check not working

**Breaking changes**

- unsupported ref sugar (take 1) syntax and convert codeLens

## 0.26.16 (2021/8/12)

- feat: improve pug conversion result ([#363](https://github.com/vuejs/language-tools/issues/363))
- feat: improve `DocumentSymbolRequest` support
- feat: support `SelectionRangeRequest`
- fix: diagnostics do not report with open second vue document
- fix: add missing `vscode-uri` dep ([#365](https://github.com/vuejs/language-tools/issues/365))
- fix: "Delete all unused imports" code action not working
- perf: faster split editors
- perf: faster document update for html server
- perf: move codeAction to api server to prevent codeAction request blocking by diagnostics when save + auto-formatting

**`@volar/server` Breaking changes**

- ServerInitializationOptions: features -> languageFeatures
- ServerInitializationOptions: htmlFeatures -> documentFeatures
- ServerInitializationOptions: move `selectionRange`, `documentSymbol`, `documentColor` to documentFeatures
- remove `RestartServerNotification` (restart by client now)

## 0.26.15 (2021/8/11)

- feat: support GraphQL custom block
- feat: support inline GraphQL syntax highlighting ([#358](https://github.com/vuejs/language-tools/issues/358))
- fix: checkbox, radio input tag v-model prop name should be "checked" ([#356](https://github.com/vuejs/language-tools/issues/356)) ([vue-tsc#55](https://github.com/johnsoncodehk/vue-tsc/issues/55))
- fix: ignore `"checkJs": true` for template interpolations ([#353](https://github.com/vuejs/language-tools/issues/353))
- perf: reuse `ts.createSourceFile` result to reduce script contents update cost

## 0.26.14 (2021/8/9)

- fix: prevent `vue-tsc --noEmit` warnings with `"experimentalCompatMode": 2` [#351#issuecomment-895019036](https://github.com/vuejs/language-tools/pull/351#issuecomment-895019036)
- fix: vue-tsc build failed with `<xxx v-for v-slot>` due to code gen side effects ([vue-tsc#53](https://github.com/johnsoncodehk/vue-tsc/issues/53))

## 0.26.13 (2021/8/9)

- fix: republish to replace incorrect script name: `vue2templateCompiler.js` -> `vue2TemplateCompiler.js` ([#352](https://github.com/vuejs/language-tools/issues/352))

## 0.26.12 (2021/8/9)

- 🎉 feat: support for vue 2 template ([#351](https://github.com/vuejs/language-tools/issues/351))
- fix: support for `"noPropertyAccessFromIndexSignature": true` ([#350](https://github.com/vuejs/language-tools/issues/350))
- fix: `.value` should not append in function parameter name
- fix: `.value` should not append in object property assignment name
- perf: reuse template compile result

## 0.26.11 (2021/8/5)

- feat: support for workspace trust
- feat: support config for HTML formatting print width by `volar.formatting.printWidth` option ([#321](https://github.com/vuejs/language-tools/issues/321))
- feat: support for typescript `updateImportsOnFileMove` setting to disable prompt ([#332](https://github.com/vuejs/language-tools/issues/332))
- feat: add "Show in Browser" button to component preview
- fix: `<input>`, `<textarea>`, `<select>` v-model prop name shoud be `value`
- fix: component preview not working on windows
- fix: delete file can't trigger related scripts diagnostics update
- fix: disable component tag type-checking to avoid some unable fix edge cases ([#333](https://github.com/vuejs/language-tools/issues/333))

## 0.26.10 (2021/7/31)

- chore: refactor `@volar/server` API and released `@volar/server`
- perf: remove `vscode.css-language-features` and `vscode.html-language-features` rely ([vscode#98621](https://github.com/microsoft/vscode/issues/98621))
- fix: `.value` should not append in function declaration name and literal type
- fix: update extra virtual files before check virtual file exist ([#326](https://github.com/vuejs/language-tools/issues/326))
- fix: convert tag name case command not working

## 0.26.9 (2021/7/25)

- feat: improve for slot name type-check
- feat: experimental component preview
- feat: improve template code finder ([#208](https://github.com/vuejs/language-tools/issues/208))
- feat: add refresh webview button
- fix: hover request failed with jsdoc `@link`
- fix: prevent null emmet configs ([#247](https://github.com/vuejs/language-tools/issues/247))

## 0.26.8 (2021/7/24)

- feat: remove import type checking for `<script setup>` ([#325](https://github.com/vuejs/language-tools/issues/325))
- feat: add ref sugar deprecated message
- fix: goto definition not working for `lang="js"` target without allowJs

## 0.26.7 (2021/7/23)

- feat: support formatting in v-for expressions
- feat: change interpolation braces syntax token
- fix: fixed a few problems when goto definition to import file path
- fix: `<script lang="x">` change should update template verification
- perf: faster diagnostics

## 0.26.6 (2021/7/21)

- feat: support component auto-import with empty script block ([#232](https://github.com/vuejs/language-tools/issues/232))
- feat: disable template type-checking with `<script lang="js">` ([#46](https://github.com/vuejs/language-tools/issues/46))
- fix: remove missing deps ([vue-tsc#45#issuecomment-882319471](https://github.com/johnsoncodehk/vue-tsc/issues/45#issuecomment-882319471))
- fix: change TS library file rely from tsserver.js to tsserverlibrary.js
- fix: css references codeLens broken
- fix: TS completion resolve failed with jsdoc link
- fix: convert tag name case failed edge case

## 0.26.5 (2021/7/19)

- feat: add remove all ref sugar command
- feat: improve ref sugar remove tool
- fix: fixed find references never finish edge cases
- fix: template type-checking not working with `<script lang="js">` ([#319](https://github.com/vuejs/language-tools/issues/319))
- fix: definition selection range incorrect
- fix: fixed monorepo project alway pop warning
- fix: preset empty object if can't get TS settings ([#316](https://github.com/vuejs/language-tools/issues/316))

## 0.26.4 (2021/7/18)

- feat: update supports for vscode 1.58
- refactor: remove formatters deps for `vue-tsc`
- fix: script block virtual script language incorrect (should not force to `ts`)
- fix: goto definition broken with ref sugar

## 0.26.3 (2021/7/17)

- feat: support FunctionalComponent events type-check
- feat: support for TS setttings (for TS preferences, formatOptions)
- fix: withDefaults props type incorrect in template
- fix: downgrade `@vue/compiler-sfc` to fix template range for formatting, codeLens
- fix: handle SFC parse failed for component auto-import
- fix: semanticTokens search range incorrect


## 0.26.2 (2021/7/16)

- fix: fixed a few TS semanticTokens problems
- fix: namespace imports should expose to template ([#311](https://github.com/vuejs/language-tools/issues/311))
- fix: events auto-complete names incorrect with `attr: pascalCase` config ([#312](https://github.com/vuejs/language-tools/issues/312))
- fix: validation for "virtual script exist" not working
- fix: TS completion documentation incomplete
- perf: fix can't reuse old TS program if `<script lang="js">` exist since 0.26.0

## 0.26.1 (2021/7/15)

- fix: fixed a few TS renaming, find referenecs problems
- fix: first time *.vue file change can't effect *.ts diagnostics

## 0.26.0 (2021/7/15)

- feat: split TS language service to script TS language service and template TS language service ([#94](https://github.com/vuejs/language-tools/issues/94)) ([#253](https://github.com/vuejs/language-tools/issues/253))
- fix: optional props type incorrect in `<script setup>` ([#302](https://github.com/vuejs/language-tools/issues/302))
- fix: formatting make double spacing in empty pug template block ([#304](https://github.com/vuejs/language-tools/issues/304))
- fix: fixed callHierarchy request failed if skip prepare request

## 0.25.28 (2021/7/6)

- feat: improve `volar.autoCompleteRefs` and make it out of experimental ([#201](https://github.com/vuejs/language-tools/issues/201))
- fix: ref sugar not working with nullish coalescing operator ([#291](https://github.com/vuejs/language-tools/issues/291))

## 0.25.27 (2021/7/5)

- fix: hover broken with jsdoc @link tag ([#289](https://github.com/vuejs/language-tools/issues/289))
- fix: prop type incorrect in template with `withDefaults()` ([#290](https://github.com/vuejs/language-tools/issues/290))

## 0.25.26 (2021/7/3)

- feat: support `withDefaults()` in `<script setup>`
- feat: expose `<script>` variables to template in `<script setup>`
- feat: change defineEmit to defineEmits in `<script setup>` (defineEmit still support a period of time)
- fix: improve event type infer ([#286](https://github.com/vuejs/language-tools/issues/286)) ([#287](https://github.com/vuejs/language-tools/issues/287))
- fix: improve empty attribute type infer ([#288](https://github.com/vuejs/language-tools/issues/288))

## 0.25.25 (2021/7/1)

- fix: can't assign expression to no args event ([#270](https://github.com/vuejs/language-tools/issues/270))
- fix: empty attr type incorrect ([#261](https://github.com/vuejs/language-tools/issues/261))
- fix: completion resolve broken in TS 3.4

## 0.25.24 (2021/6/30)

- fix: prevent throw error with unknown tag's properties ([#284](https://github.com/vuejs/language-tools/issues/284))
- fix: add patch for `<script src>` TS file path ([vue-tsc#30](https://github.com/johnsoncodehk/vue-tsc/issues/30))

## 0.25.23 (2021/6/30)

- feat: expose ClassDeclaration, EnumDeclaration from `<script setup>` ([#274](https://github.com/vuejs/language-tools/issues/274))
- fix: template context broken with `<script lang="tsx">` ([#275](https://github.com/vuejs/language-tools/issues/275))
- fix: don't convert source code to unicode with component auto-import ([#272](https://github.com/vuejs/language-tools/issues/272))
- fix: don't infer `update:xxx` event type by props ([#266](https://github.com/vuejs/language-tools/issues/266))
- fix: functional component type-check behavior inconsistent with JSX ([#268](https://github.com/vuejs/language-tools/issues/268))

## 0.25.22 (2021/6/12)

- feat: improve TS diagnostic message ([#259](https://github.com/vuejs/language-tools/issues/259))
- fix: incorrect unescaping of literal strings ([#262](https://github.com/vuejs/language-tools/issues/262))
- fix: dynamic slot name do not consume variable ([#263](https://github.com/vuejs/language-tools/issues/263))
- fix: temporary html completion info leak to hover info
- fix: TS definition result duplicate

## 0.25.21 (2021/6/8)

- feat: support for typescript pnp ([#248](https://github.com/vuejs/language-tools/issues/248))
- feat: improve component auto-import path calculate
- fix: `Write Virtual Files` command not working

## 0.25.20 (2021/6/7)

- fix: remove `fs-extra` to fix `at-least-node` module missing

## 0.25.19 (...)

- feat: support json schema request service ([#243](https://github.com/vuejs/language-tools/issues/243))
- feat: support shortest component auto-import path ([#233](https://github.com/vuejs/language-tools/issues/233))
- fix: component auto-import not working with dash ([#249](https://github.com/vuejs/language-tools/issues/249))
- fix: fix some `Cannot read property ...` errors ([#247](https://github.com/vuejs/language-tools/issues/247)) ([#251](https://github.com/vuejs/language-tools/issues/251))
- fix: syntax highlighting not working for `lang="jsx"`
- fix: folding not working for jsx ([#234](https://github.com/vuejs/language-tools/issues/234))

## 0.25.18 (...)

- fix: fix vue-tsc build failed

## 0.25.17 (2021/6/1)

- feat: support for change TS version by `typescript.tsdk` option ([#224](https://github.com/vuejs/language-tools/issues/224))
- feat: support for TS 4.3
- fix: auto import component should prior choice `<script setup>`
- fix: disable component auto import if no any `<script>` block

## 0.25.16 (2021/5/31)

- fix: language server broken with incorrect module importing

## 0.25.15 (2021/5/31)

- feat: auto import component in template ([#194](https://github.com/vuejs/language-tools/issues/194))
- feat: filter duplicate event modifiers completion
- fix: path completion not working for `<script src>` without `lang="ts"` ([#223](https://github.com/vuejs/language-tools/issues/223))

## 0.25.14 (2021/5/28)

- feat: add option to hide the split icon at the top right corner ([#195](https://github.com/vuejs/language-tools/issues/195))
- feat: add ts plugin description link in ts plugin menu
- fix: file icons are emptied when importing ([#198](https://github.com/vuejs/language-tools/issues/198))
- fix: css prepareRename range incorrect if no `<template>` ([#212](https://github.com/vuejs/language-tools/issues/212))
- fix: don't report `lang="ts"` missing if script content is empty ([#215](https://github.com/vuejs/language-tools/issues/215))
- fix: ts plugin features broken with json script kind [0386094](https://github.com/vuejs/language-tools/commit/038609477093911674cf842e3650bc8daf4d733d)
- fix: component rename breaks the component source file ([#206](https://github.com/vuejs/language-tools/issues/206))
- fix: emmet should not working in template expression interpolations

## 0.25.13 (2021/5/26)

- fix: add patching for a serious TS freeze bug ([#205](https://github.com/vuejs/language-tools/issues/205)) ([vscode#124561](https://github.com/microsoft/vscode/issues/124561))

## 0.25.12 (2021/5/24)

- feat: support props type override ([#202](https://github.com/vuejs/language-tools/issues/202#issuecomment-846670594))
- fix: support `<component :is>` type-checking with VNode ([vue-tsc#34](https://github.com/johnsoncodehk/vue-tsc/issues/34))
- fix: cannot find module 'upath' with pnpm ([#204](https://github.com/vuejs/language-tools/issues/204))

## 0.25.11 (2021/5/24)

- feat: support find definition in `*.ts` even ts plugin disabled
- feat: new experimental preview feature
- fix: `<script setup>` component name incorrect
- fix: inline style breaks SFC syntax highlighting ([#199](https://github.com/vuejs/language-tools/issues/199))

## 0.25.10 (2021/5/21)

- fix: `<template>` tag child nodes syntax highlighting broken

## 0.25.9 (2021/5/21)

- feat: support recursive components for `<script setup>`
- fix: improve type-checking for `<component :is>` ([#196](https://github.com/vuejs/language-tools/issues/196))
- fix: fix `<template>` block syntax highlighting broken edge cases ([#192](https://github.com/vuejs/language-tools/issues/192#issuecomment-845089387))

## 0.25.8 (2021/5/19)

- feat: support for `<component :is>` type-checking

## 0.25.7 (2021/5/19)

- 🎉 feat: support for named recursive components ([#190](https://github.com/vuejs/language-tools/issues/190))

## 0.25.6 (2021/5/18)

- fix: custom events type-checking broken
- perf: optimize get script version ([#186](https://github.com/vuejs/language-tools/issues/186))

## 0.25.5 (2021/5/18)

- feat: improve UX for TS plugin status bar
- feat: support syntax highlighting for `lang="json"`, `lang="jsonc"`, `lang="yaml"`, `lang="md"` ([#127](https://github.com/vuejs/language-tools/issues/127))
- feat: support validation for `lang="json"`, `lang="jsonc"`
- feat: support emmet for JSX, TSX ([#184](https://github.com/vuejs/language-tools/issues/184))
- fix: fix template syntax highlighting broken edge cases
- fix: fix auto-import not working edge cases
- fix: should not have auto-import from virtual files
- fix: native events types incorrect if component do not have emits option ([#180](https://github.com/vuejs/language-tools/issues/180))

## 0.25.4 (2021/5/12)

- feat: improve embedded languages syntax highlight
- feat: support html snippets in template
- feat: add create workspace snippets command
- fix: pug autocomplete broken with class attribute ([#177](https://github.com/vuejs/language-tools/issues/177))

## 0.25.3 (2021/5/10)

- perf: fix pug semantic tokens performance loophole ([#162](https://github.com/vuejs/language-tools/issues/162))
- feat: released `typescript-vue-plugin` ([#169](https://github.com/vuejs/language-tools/issues/169))
- fix: split editors icon size incorrect ([#170](https://github.com/vuejs/language-tools/issues/170))

## 0.25.2 (2021/5/7)

- feat: improve component tag hover info
- feat: improve component types for `export default { ... }`
- feat: support for generic functional component

## 0.25.1 (2021/5/4)

- feat: move "Start Split Editing Mode" to command
- fix: props auto-complete not working
- fix: fix released npm package size

## 0.25.0 (2021/5/3)

- feat: split status bar item `<TagName attr-name>` to `Tag: xxx`, `Attr: xxx`
- fix: tag name case status bar item not working on start
- fix: `<style module>` class name renaming result incorrect
- fix: hyphenat component renaming not working
- fix: ref sugar renaming result incorrect with destructure
- fix: ref sugar renaming not working on right expression

## 0.24.6 (2021/5/2)

- 🎉 feat: support find references in `*.ts` even ts plugin disabled
- fix: `Set<any>` item type incorrect in `v-for`
- fix: server initializing progress not working
- fix: add patching for `@vue/composition-api` event types for now

## 0.24.5 (2021/4/27)

- fix: css hover quick info not working
- perf: don't send source map to lsp protocol to avoid json parse

## 0.24.4 (2021/4/27)

- feat: support path completion for template languages (html, pug)
- feat: support path completion for style languages (css, less, scss, postcss)
- feat: support css code action
- feat: dynamic resolve url links in css
- fix: filter invalid component names [#159](https://github.com/vuejs/language-tools/issues/159)
- fix: css completion broken
- fix: don't increase indent on `<script>`, `<style>`

## 0.24.3 (2021/4/26)

- feat: new IDE option `volar.preferredAttrNameCase`
- feat: support change props completion name case in status bar
- fix: component tag name case conversion not working edge case
- perf: fix html completion should not calculate every times typing

## 0.24.2 (2021/4/26)

- feat: new IDE option `volar.preferredTagNameCase` [#156](https://github.com/vuejs/language-tools/issues/156)
- feat: new status bar item for support change completion tag name case
- feat: component tag name case conversion
- feat: support adding breakpoints [#107](https://github.com/vuejs/language-tools/issues/107)
- fix: don't report error if class name does not exist in `$style` [#157](https://github.com/vuejs/language-tools/issues/157)
- fix: don't complete attribute value for `v-else`, `scoped`, `module`, `setup`
- revoke: remove `Volar: Format All Scripts` command (use [Format All Files in Workspace](https://marketplace.visualstudio.com/items?itemName=alexr00.formatallfilesinworkspace) extension for replacement)

## 0.24.1 (2021/4/20)

- fix: ref sugar report incorrect errors on `vue-tsc` [vue-tsc#18](https://github.com/johnsoncodehk/vue-tsc/issues/18)
- fix: `<slot>` should not report error with `defineComponent(function () { ... })` [vue-tsc#21](https://github.com/johnsoncodehk/vue-tsc/issues/21)

## 0.24.0 (2021/4/14)

- feat: new option `Don't care` for TS plugin by default to reduce reload vscode
- feat: check variables is valid returns for `<script setup>`
- fix: pug template checking broken with vue-tsc [vue-tsc#14](https://github.com/johnsoncodehk/vue-tsc/issues/14)
- fix: emmet completion working incorrectly [#135](https://github.com/vuejs/language-tools/issues/135)
- fix: import path completion replace range incorrect
- fix: define slot props as const
- perf: faster typescript diagnosis response

**Breaking changes**

See: https://github.com/vuejs/language-tools/discussions/134

- feat: unsupport `volar.style.defaultLanguage` option
- feat: unsupport `@vue-ignore`

## 0.23.7 (2021/4/10)

- feat: improve type-checking of dynamic slot
- chore: simplify `v-on` modifiers completion label

## 0.23.6 (2021/4/9)

- feat: event modifiers auto-complete [#126](https://github.com/vuejs/language-tools/issues/126)
- fix: `v-else-if` type narrowing not works in last branch [#130](https://github.com/vuejs/language-tools/issues/130)

## 0.23.5 (2021/4/7)

- feat: improve types infer without defineComponent [#59](https://github.com/vuejs/language-tools/issues/59)
- fix: handle readonly array in `v-for`
- fix: template context not update on completion
- perf: don't update project version if document content no changes

## 0.23.4 (2021/4/6)

- fix: vnode hooks typing broken in template
- fix: global components typing broken if no `<script>` block
- fix: local components typing broken with pnpm [#123](https://github.com/vuejs/language-tools/issues/123)
- fix: init progress broken
- perf: reuse import suggestions cache

## 0.23.3 (2021/4/5)

- fix: `<script setup>` components unused report incorrect [#122](https://github.com/vuejs/language-tools/issues/122)
- fix: unused cache to fix completion resolve crash edge cases

## 0.23.2 (2021/4/5)

- fix: `v-if` intellisense not working
- fix: type-only `defineProps` declarations broke template intellisense [#121](https://github.com/vuejs/language-tools/issues/121)

## 0.23.1 (2021/4/5)

- perf: faster intellisense for `<script setup>`
- fix: ref sugar variables types incorrect edge case

## 0.23.0 (2021/4/5)

- 🎉 feat: new split editing mode
- feat: auto import path preview
- fix: remove typescript hover info from `<style scoped>` classes
- perf: faster auto-complete and completion resolve

**Breaking changes**

- feat: unsupported global component by `app.component(...)` calls, see: https://github.com/vuejs/language-tools#using

## 0.22.29 (2021/4/3)

- fix: fix diagnostics shaking
- fix: events hover info not working if no expression
- fix: template diagnosis response delay

## 0.22.28 (2021/4/3)

- fix: reduce diagnostics shaking
- fix: only diagnosis import variables in `<script setup>` return

## 0.22.27 (2021/4/3)

- feat: report error if import type in `<script setup>` incorrectly
- perf: `<script setup>` performance small improvement
- fix: allow `ref:` declarations without initialized
- fix: export assignment intellisense not working if `<script setup>` exist

## 0.22.26 (2021/4/1)

- feat: improve events hover info
- feat: support pug new line syntax `\` [#118](https://github.com/vuejs/language-tools/issues/118)
- fix: `v-for` not working with `v-slot` [#110](https://github.com/vuejs/language-tools/issues/110)
- fix: completion detail not working when keep typing

## 0.22.25 (2021/3/31)

- feat: support pass props as `v-bind="..."` syntax [vue-tsc#9](https://github.com/johnsoncodehk/vue-tsc/issues/9)
- feat: support use not compiled `@vue/runtime-dom` library
- fix: `defineEmit()` types incorrect in template if use pure type define
- perf: improve virtual documents update performance

## 0.22.24 (2021/3/29)

- feat: improve `v-for` type-checking [#117](https://github.com/vuejs/language-tools/issues/117)
- feat: improve events type-checking [#116](https://github.com/vuejs/language-tools/issues/116)
- feat: support `"noUncheckedIndexedAccess": true` [vue-tsc#8](https://github.com/johnsoncodehk/vue-tsc/issues/8)
- fix: auto-complete duplicate in `v-model="..."`

## 0.22.23 (2021/3/28)

- feat: sfc parse diagnostics
- feat: improve v-slot support
- fix: `vue-tsc` throw on `component()` call without string literal
- fix: kebab case slots not working
- chore: update vue to 3.0.9 to fix a few bugs

## 0.22.22 (2021/3/26)

- feat: improve props js doc hover info
- feat: improve component recognition
- fix: don't patch diagnostics without postcss
- fix: handle `documents.onDidChangeContent` send incorrect file name
- fix: html hover info not working

## 0.22.21 (2021/3/24)

- fix: diagnostics should update if tsconfig.json update
- fix: fix style attributes duplicate error [#109](https://github.com/vuejs/language-tools/issues/109)
- fix: patch postcss diagnostics [#103](https://github.com/vuejs/language-tools/issues/103)

## 0.22.20 (2021/3/23)

- fix: handle file name is `Foo.vue` but LSP send `file:///.../foo.vue`
- fix: fix lsp not working on monorepo edge case

## 0.22.19 (2021/3/19)

- fix: pug tag less element mapping incorrect
- fix: extra hover info duplicate
- fix: error when hovering the slot bindings

## 0.22.18 (2021/3/19)

- feat: props jsdoc support
- fix: emmet not working for inline css

## 0.22.17 (2021/3/18)

- fix: use `for...in` instead of `for...of` to v-for

## 0.22.16 (2021/3/16)

- fix: extra files watcher not working on windows
- fix: vue-tsc not working on windows

## 0.22.15 (2021/3/16)

- feat: improve v-for type-checking
- chore: disabled declaration diagnostics for now to avoid monorepo performance issue

## 0.22.14 (2021/3/16)

- fix: emit declaration diagnostics with declaration option
- chore: improve extra files watcher

## 0.22.13 (2021/3/15)

- feat: watch extra files update
- fix: cannot find global properties if no `<script>` block
- fix: project verification not working

## 0.22.12 (2021/3/15)

- fix: cannot find name for text attribute

## 0.22.11 (2021/3/14)

- feat: script refactors, source actions, organize imports support
- perf: improve monorepo memory using
- fix: text attribute auto-complete not working
- fix: declaration diagnostics missing
- fix: typescript diagnostic related Information unhandled

## 0.22.10 (2021/3/12)

- perf: improve monorepo memory using
- feat: remove emit dts feature

## 0.22.9 (2021/3/10)

- fix: props auto-complete not working for vue 2 and nuxt
- fix: `@vue/runtime-dom` missing checking not working

## 0.22.8 (2021/3/8)

- revert: "fix: ignore script content if script src is exist"

## 0.22.7 (2021/3/8)

- fix: script src mapping incorrect if script content is empty
- fix: ignore script content if script src is exist

## 0.22.6 (2021/3/7)

- fix: semantic token incorrect if tag name in component context

## 0.22.5 (2021/3/7)

- fix: quick fix not working in `<script setup>` if no import statement
- fix: typescript code fixes throw if import path not exist

## 0.22.4 (2021/3/6)

- fix: diagnosis not working for windows vscode 1.54.1

## 0.22.3 (2021/3/6)

- fix: ts plugin vue files missing edge case
- fix: go to definition for 'vue' import not working

## 0.22.2 (2021/3/6)

- fix: vue language service broke by vscode 1.54.1
- fix: 'vue' module auto-import broke by vscode 1.54.1 (ts 4.2.2)
- chore: improve vue 2 warning message (Thanks to @posva !)

## 0.22.1 (2021/3/5)

- fix: code fix affect by virtual code
- fix: don't always ask refactoring when move vue file
- fix: ts auto-complete replace range incorrect

## 0.22.0 (2021/3/5)

- feat: new apis for command line type-checking support (https://github.com/johnsoncodehk/vue-tsc)
- feat: support for event handlers in kebab-case
- feat: improve ts plugin status color
- feat: typescript quick fix
- fix: remove incorrect location from component options definition result
- fix: language server crash with `ref: in`
- chore: update display name

## 0.21.20 (2021/2/28)

- feat: added default `<style>` tag language config

## 0.21.19 (2021/2/28)

- fix: textDocumet/formatting fails with stylus and sass

## 0.21.18 (2021/2/27)

- feat: sass language support
- feat: stylus language support

## 0.21.17 (2021/2/27)

- feat: auto-indent in template section support
- feat: multi-root workspaces support
- fix: should not throw when edit untitled vue documents
- fix: type checking doesn't work for components written in .ts files

## 0.21.16 (2021/2/25)

- fix: can't reference .vue file out of rootDir

## 0.21.15 (2021/2/24)

- fix: v-on type-checking not working with function assign

## 0.21.14 (2021/2/23)

- feat: rename fail message
- fix: revert narrowed type patch for v-on
- fix: event type incorrect if given `null` (for example: `emits: { foo: null }`)

## 0.21.13 (2021/2/22)

- fix: ignore `postcss(unknownAtRules)`
- fix: postcss completion word range
- fix: v-on expression should not affect variables types in template

## 0.21.12 (2021/2/21)

- feat: postcss language support (required [language-postcss](https://marketplace.visualstudio.com/items?itemName=cpylua.language-postcss) for syntax highlighting)
- fix: `lang="ts"` missing should not throw error

## 0.21.11 (2021/2/21)

- fix: nameless slot not working

## 0.21.10 (2021/2/21)

- fix: definition selection range not working for global components
- fix: auto-complete word range incorrect

## 0.21.9 (2021/2/20)

- feat: component tag auto-complete info in template
- feat: ts definition selection range
- fix: script block should not have emmet auto-complete
- perf: fix some performance issues

## 0.21.8 (2021/2/19)

- fix: sometime emmet completion missing
- fix: auto-complete throw error [#65](https://github.com/vuejs/language-tools/issues/65)

## 0.21.7 (2021/2/18)

- fix: auto import `*.vue` not working

## 0.21.6 (2021/2/17)

- fix: `<script setup>` unused report not working if no any `import` statement
- fix: narrowed type by v-if should not be widened in v-on
- fix: `:style` type check not working
- fix: scoped class name references should not have hover info

## 0.21.5 (2021/2/16)

- fix: tsconfig parsing for ts plugin incorrect

## 0.21.4 (2021/2/15)

- feat: `vue.d.ts` emit support
- fix: events type-checking not working for array emits define

## 0.21.3 (2021/2/14)

- fix: slot name expression types incorrect

## 0.21.2 (2021/2/14)

- feat: support slot name expression

## 0.21.1 (2021/2/14)

- feat: show reload button on switch ts plugin
- fix: ts plugin status not sync on dropdown menu

## 0.21.0 (2021/2/14)

- feat: props `@update` event support
- feat: `v-model="..."` support
- feat: ts plugin status bar item
- fix: improve events type-checking
- fix: tsconfig update not working for ts plugin
- fix: ref sugar variables hover info incorrect
- fix: services not working for hyphenate events
- fix: don't show confirm box if no import will change on move file
- fix: props rename references should keep with hyphenate

## 0.20.9 (2021/2/12)

- feat: emit event type not matching warning
- feat: ts plugin support (default is disabled, run `Volar: Switch TS Plugin` to enable)
- fix: typescript auto-complete should not replace suffix
- chore: emit overloads infer nums 2 -> 4
- chore: switch auto `.value` feature to default disabled

## 0.20.8 (2021/2/10)

- fix: `.value` auto-complete should not occur at definition
- fix: multi-line pug attribute not working
- fix: pug-html convert tool should not convert to pug class literal if exist illegal characters

## 0.20.7 (2021/2/10)

- fix: inline css service broke in pug

## 0.20.6 (2021/2/10)

- 🎉 feat: better pug support (https://github.com/vuejs/language-tools/projects/1#card-50201163)
- feat: improve html -> pug convert
- fix: `.value` auto-complete not working if typing inside `()`

## 0.20.5 (2021/2/8)

- fix: `.value` auto-complete corner case
- feat: enabled `.value` auto-complete in .ts

## 0.20.4 (2021/2/8)

- feat: auto close tag delay 0ms -> 100ms
- feat: auto-complete ref value with `.value` (Experimental)

## 0.20.3 (2021/2/8)

- feat: localized typescript diagnostics
- feat: report errors count with `Verify All Scripts` command
- feat: show warning notification if project invalid (Thanks to @IWANABETHATGUY !)

## 0.20.2 (2021/2/5)

- fix: `<script setup>` props rename broke
- fix: inline css service broke

## 0.20.1 (2021/2/2)

- fix: ref sugar broke in 0.20.0

## 0.20.0 (2021/2/2)

- feat: import path renaming
- feat: refactor import path on rename file
- feat: options to disable codeLens
- feat: verification before renaming
- perf: incremental update server documents (Thanks to @IWANABETHATGUY !)
- fix: accurate ref sugar renaming
- fix: ref sugar should convert with type args

## 0.19.16 (2021/1/22)

- fix: remove incorrect props hover info
- fix: file name parsing incorrect with `[]` characters

## 0.19.15 (2021/1/21)

- feat: support global component with `component(..., defineAsyncComponent(...))`
- feat: preview client improve
- fix: js files should handle in language server

## 0.19.14 (2021/1/17)

- feat: `@vue-ignore` support
- fix: don't diagnose `lang="sass"`, `lang="stylus"` with css language

## 0.19.13 (2021/1/17)

- feat: preview client (experimental)

## 0.19.12 (2021/1/17)

- fix: ref sugar unused report incorrect with `noUnusedLocals` enabled

## 0.19.11 (2021/1/15)

- fix: should not support old `<script setup>` declare props, emit, slots
- fix: should not allow export keywords in `<script setup>`
- fix: ref sugar right side expression services duplicate
- fix: ref sugar references semantic token incorrect

## 0.19.10 (2021/1/15)

- feat: ref sugar hover info add dollar variable
- fix: ref sugar autocomplete not working for `ref: { | } = foo()`
- fix: ref sugar goto definition not working for `ref: { | } = foo()`
- fix: ref sugar semantic token not working

## 0.19.9 (2021/1/15)

- fix: language server broke with monorepo tsconfig.json (outDir + rootDir + composite/incremental)

## 0.19.8 (2021/1/15)

- feat: show underscore with css scoped classes
- fix: css scoped classes definition goto wrong place if define in import file
- fix: FunctionalComponent services not working with `setup()` return

## 0.19.7 (2021/1/13)

- feat: `<script src>` support

## 0.19.6 (2021/1/11)

- fix: prop types incorrect if duplicate name with HTMLAttributes
- fix: symbols outline incorrect

## 0.19.5 (2021/1/11)

- feat: add split editors button
- feat: improve split editors
- fix: `<template lang="pug">` block folding not working with `>` character

## 0.19.4 (2021/1/10)

- feat: split editors

## 0.19.3 (2021/1/9)

- fix: component props auto complete broke
- fix: interpolation formatting incorrect edge case
- chore: remove unneeded files to reduce extension size

## 0.19.2 (2021/1/6)

- fix: ref sugar variables unused report incorrect
- fix: `@click` type check not working for non native elements

## 0.19.1 (2021/1/4)

- fix: css class references codeLens broke

## 0.19.0 (2021/1/4)

- feat: unsupported workspaceExtensions formatter
- feat: unsupported old `<script setup>`
- fix: references codeLens should not counting itself
- fix: hyphenate format slot name have duplicate references codeLens
- fix: `<script setup>` unused checking not working for `"noUnusedLocals": true`

## 0.18.17 (2021/1/1)

- feat: server init progress
- feat: vue block completion
- fix: tsconfig.json update not working
- fix: __VLS_GlobalComponents not working if no `<script>` block
- fix: element tag mapping incorrect corner case

## 0.18.16 (2020/12/30)

- feat: codeLens for `app.component(...)`
- feat: codeLens for slots
- fix: css codeLens location incorrect corner case

## 0.18.15 (2020/12/26)

- fix: `<script setup>` unused variables report broke with html

## 0.18.14 (2020/12/26)

- fix: `<script setup>` variables should report unused when use as component

## 0.18.13 (2020/12/26)

- feat: unused variables report for `<script setup>`
- fix: `<script setup>` imports should not have global completion

## 0.18.12 (2020/12/23)

- feat: pnpm support
- feat: unlimited emits overloads support
- fix: formatting remove `export default {}` if exist two `<script>` block

## 0.18.11 (2020/12/21)

- fix: ref sugar variable define diagnostic not working
- fix: `ref: foo = false` should be `boolean` not `false` type in template
- fix: ref sugar convert tool fail with `()`

## 0.18.10 (2020/12/21)

- fix: props services fail for `DefineComponent<...>` declare component

## 0.18.9 (2020/12/20)

- fix: folding ranges not working in `<script setup>` block

## 0.18.8 (2020/12/18)

- feat: improve pug diagnosis
- fix: find emits references not working with hyphenate
- fix: hover info not working for hyphenate component tag tail
- pert: faster script setup gen
- perf: faster pug mapper

## 0.18.7 (2020/12/18)

- chore: change component tag hover info
- fix: filter same html tag in completion
- fix: ctx properties types incorrect corner cases
- fix: should not detect all ctx properties as component
- fix: `@click` event type check broke

## 0.18.6 (2020/12/18)

- feat: rollback typescript diagnostic modes
- perf: faster diagnostics

## 0.18.5 (2020/12/17)

- feat(experiment): added a new typescript diagnostic mode and default enabled (not prompt for unused variables)
- fix: `foo=""` attribute should not detect as `true` type

## 0.18.4 (2020/12/15)

- fix: script formatting broke
- fix: when return `foo: foo as true` in setup(), template context should get `foo: true` not `foo: boolean`

## 0.18.3 (2020/12/15)

- fix: interpolations formatting indent broke

## 0.18.2 (2020/12/14)

- fix: interpolations formatting broke
- fix: props missing checking not working for non hyphenate component
- perf: emit overloads support nums 16 -> 4 (faster template diagnostics when using v-on)

## 0.18.1 (2020/12/14)

- perf: faster template diagnostics

## 0.18.0 (2020/12/13)

- feat: [Linked Editing](https://code.visualstudio.com/updates/v1_44#_synced-regions)
- fix: script not found error not working for `<script setup>`

## 0.17.7 (2020/12/13)

- chore: rename extension in marketplace [#35](https://github.com/vuejs/language-tools/discussions/35)

## 0.17.6 (2020/12/12)

- fix: ref sugar variable renaming no effect to template
- fix: `v-else-if` semantic token
- perf: split `<script>` and `<template>` to speed up current editing block diagnostics

  > when editing `<script>`, `<template>` block delay 1000ms make diagnosis

  > when editing `<template>`, `<script>` block delay 1000ms make diagnosis

## 0.17.5 (2020/12/12)

- perf: faster default formatter
- perf: faster diagnostics

## 0.17.4 (2020/12/12)

- fix: can't disable html mirror cursor
- feat: improve folding range

## 0.17.3 (2020/12/12)

- feat: improve html mirror cursor
- feat: improve default formatter

## 0.17.2 (2020/12/12)

- fix: `<script setup>` crash corner cases
- fix: diagnostic feature was accidentally disabled in v0.17.1

## 0.17.1 (2020/12/11)

- perf: prevent auto close tag blocked by autocomplete
- perf: faster semantic tokens

## 0.17.0 (2020/12/11)

- feat: ts semantic tokens
- feat: faster auto close tag
- chore: remove icon avoid it like a virus in marketplace

## 0.16.15 (2020/12/11)

- perf: prevent semantic tokens request block autocomplete request (occurred in 0.16.4)
- feat: improve ts autocomplete

## 0.16.14 (2020/12/9)

- feat: pure type defineEmit() syntax support
- feat: increase support emits overloads nums to 16
- fix: pure type defineProps properties required incorrect
- fix: monorepo services can't update cross root scripts
- fix: `<script setup>` formatting broke in 0.16.13

## 0.16.13 (2020/12/9)

- fix: crash if allowJs not set and working on js script block
- fix: crash with user action when server not ready

## 0.16.12 (2020/12/9)

- feat: html mirror cursor

## 0.16.11 (2020/12/8)

- feat: support directives syntax `:=`, `@=`, `#=`
- fix: v-slot bind properties missing attribute values
- fix: template validation broke with v-slot bind properties
- fix: slot services disturbed slot element hover info

## 0.16.10 (2020/12/8)

- feat: reference, rename, definition support to js

## 0.16.9 (2020/12/8)

- feat: template validation support to js
- fix: should not error when css class not exist
- fix: inline style hover info wrong mapping

## 0.16.8 (2020/12/8)

- feat: slot name services (find references, goto definition, diagnostic, completion, hover info)

## 0.16.7 (2020/12/7)

- fix: call graph links incomplete

## 0.16.6 (2020/12/7)

- fix: find references crash in node_modules files

## 0.16.5 (2020/12/6)

- feat: restart server command
- fix: auto import not working for .vue files

## 0.16.4 (2020/12/4)

- fix: can't use export default with `<script>` when `<script setup>` exist
- fix: auto import items should not show virtual files
- fix: style attr services broke
- fix: v-for elements types incorrect
- refactor: sensitive semantic tokens update

## 0.16.3 (2020/12/2)

- feat: inline css service within `<template>`

## 0.16.2 (2020/12/1)

- fix: `<script setup>` formatting wrongly replace `ref:` to `ref`

## 0.16.1 (2020/12/1)

- fix: fix some Call Hierarchy failed cases
- perf: faster typescript language service for new `<script setup>`

## 0.16.0 (2020/11/30)

- feat: [Call Hierarchy](https://code.visualstudio.com/updates/v1_33#_call-hierarchy) support
- feat: auto declare `__VLS_GlobalComponents` by `app.component()` calls

## 0.15.16 (2020/11/29)

## 0.15.15 (2020/11/27)

## 0.15.14 (2020/11/27)

## 0.15.13 (2020/11/26)

## 0.15.12 (2020/11/24)

## 0.15.11 (2020/11/20)

## 0.15.10 (2020/11/20)

## 0.15.9 (2020/11/19)

## 0.15.8 (2020/11/18)

## 0.15.7 (2020/11/17)

## 0.15.6 (2020/11/16)

## 0.15.5 (2020/11/14)

## 0.15.4 (2020/11/14)

## 0.15.3 (2020/11/12)

## 0.15.2 (2020/11/10)

## 0.15.1 (2020/11/3)

## 0.15.0 (2020/11/2)

## 0.14.12 (2020/11/2)

## 0.14.11 (2020/11/2)

## 0.14.10 (2020/11/1)

## 0.14.9 (2020/11/1)

## 0.14.8 (2020/10/30)

## 0.14.7 (2020/10/30)

## 0.14.6 (2020/10/29)

## 0.14.5 (2020/10/29)

## 0.14.4 (2020/10/27)

## 0.14.3 (2020/10/24)

## 0.14.2 (2020/10/22)

## 0.14.1 (2020/10/21)

## 0.14.0 (2020/10/20)

## 0.13.14 (2020/10/20)

## 0.13.13 (2020/10/19)

## 0.13.12 (2020/10/17)

## 0.13.11 (2020/10/15)

## 0.13.10 (2020/10/14)

## 0.13.9 (2020/10/13)

## 0.13.8 (2020/10/13)

## 0.13.7 (2020/10/13)

## 0.13.6 (2020/10/13)

## 0.13.5 (2020/10/12)

## 0.13.4 (2020/10/12)

## 0.13.3 (2020/10/12)

## 0.13.2 (2020/10/12)

## 0.13.1 (2020/10/11)

## 0.13.0 (2020/10/11)

## 0.12.8 (2020/10/10)

## 0.12.7 (2020/10/9)

## 0.12.6 (2020/10/9)

## 0.12.5 (2020/10/9)

## 0.12.4 (2020/10/9)

## 0.12.3 (2020/10/9)

## 0.12.2 (2020/10/9)

## 0.12.1 (2020/10/9)

## 0.12.0 (2020/10/8)

## 0.11.8 (2020/10/8)

## 0.11.7 (2020/10/8)

## 0.11.6 (2020/10/7)

## 0.11.5 (2020/10/6)

## 0.11.4 (2020/10/6)

## 0.11.3 (2020/10/5)

## 0.11.2 (2020/10/5)

## 0.11.1 (2020/10/4)

## 0.11.0 (2020/10/3)

## 0.10.13 (2020/10/2)

## 0.10.12 (2020/10/2)

## 0.10.11 (2020/10/2)

## 0.10.10 (2020/10/2)

## 0.10.9 (2020/10/2)

## 0.10.8 (2020/9/28)

## 0.10.7 (2020/9/28)

## 0.10.6 (2020/9/28)

## 0.10.5 (2020/9/27)

## 0.10.4 (2020/9/26)

## 0.10.3 (2020/9/26)

## 0.10.2 (2020/9/26)

## 0.10.1 (2020/9/21)

## 0.10.0 (2020/9/21)

## 0.9.6 (2020/9/21)

## 0.9.5 (2020/9/18)

## 0.9.4 (2020/9/17)

## 0.9.3 (2020/9/10)

## 0.9.2 (2020/9/9)

## 0.9.1 (2020/9/7)

## 0.9.0 (2020/9/7)

## 0.8.1 (2020/9/2)

## 0.8.0 (2020/9/2)

## 0.7.3 (2020/9/1)

## 0.7.2 (2020/9/1)

## 0.7.1 (2020/8/31)

## 0.7.0 (2020/8/31)

## 0.6.0 (2020/8/31)

## 0.5.2 (2020/8/30)

## 0.5.1 (2020/8/30)

## 0.5.0 (2020/8/29)

## 0.4.15 (2020/8/28)

## 0.4.14 (2020/8/27)

## 0.4.13 (2020/8/24)

## 0.4.12 (2020/8/24)

## 0.4.11 (2020/8/23)

## 0.4.10 (2020/8/23)

## 0.4.9 (2020/8/21)

## 0.4.8 (2020/8/21)

## 0.4.7 (2020/8/21)

## 0.4.6 (2020/8/21)

## 0.4.5 (2020/8/21)

## 0.4.4 (2020/8/21)

## 0.4.3 (2020/8/21)

## 0.4.2 (2020/8/20)

## 0.4.1 (2020/8/20)

## 0.4.0 (2020/8/20)

## 0.3.2 (2020/8/18)

## 0.3.1 (2020/8/18)

## 0.2.16 (2020/8/15)

## 0.2.15 (2020/8/14)

## 0.2.14 (2020/8/12)

## 0.2.13 (2020/8/9)

## 0.2.12 (2020/8/9)

## 0.2.11 (2020/8/8)

## 0.2.10 (2020/8/7)

## 0.2.9 (2020/8/7)

## 0.2.8 (2020/8/7)

## 0.2.7 (2020/8/7)

## 0.2.6 (2020/8/5)

## 0.2.5 (2020/8/5)

## 0.2.4 (2020/8/4)

## 0.2.3 (2020/8/4)

## 0.2.2 (2020/8/4)

## 0.2.1 (2020/8/4)

## 0.2.0 (2020/8/3)

## 0.1.9 (2020/8/2)

## 0.1.8 (2020/8/2)

## 0.1.7 (2020/8/2)

## 0.1.6 (2020/8/1)

## 0.1.5 (2020/8/1)

## 0.1.4 (2020/8/1)

## 0.1.3 (2020/8/1)

## 0.1.2 (2020/7/31)

## 0.1.1 (2020/7/31)

## 0.1.0 (2020/7/31)

## 0.0.18 (2020/7/27)

## 0.0.17 (2020/7/27)

## 0.0.16 (2020/5/22)

## 0.0.15 (2020/5/11)

## 0.0.14 (2020/5/11)

## 0.0.13 (2020/5/11)

## 0.0.12 (2020/5/4)

## 0.0.11 (2020/5/4)

## 0.0.10 (2020/5/4)

## 0.0.9 (2020/5/4)

## 0.0.8 (2020/5/4)

## 0.0.7 (2020/5/4)

## 0.0.6 (2020/5/3)

## 0.0.5 (2020/5/2)
