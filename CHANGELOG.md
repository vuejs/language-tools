# Changelog

## 3.3.12 (2026-10-02)

### language-core

- **security:** improved handling of untrusted Vue files ([cea0698](https://github.com/vuejs/language-tools/commit/cea069882606d62b31199a75a3013b99d3db7144))
- **feat:** infer first parameter type of default factory for `defineModel` ([1be73b8](https://github.com/vuejs/language-tools/commit/1be73b8f944fc4b571e2122255403f1f9b8fdad2))
- **feat:** report duplicate CSS module names, including non-identifier names ([d41d919](https://github.com/vuejs/language-tools/commit/d41d919b003c541a3af26982d9509162d01b0997)) ([ffb85e5](https://github.com/vuejs/language-tools/commit/ffb85e57723d4a1a5107d43c0a09408814c4608a))
- **fix:** keep union props when using withDefaults ([084f30f](https://github.com/vuejs/language-tools/commit/084f30f6b764d4da97d4bc3be9ff3020d74e42d5))
- **fix:** keep inference-only props string single-line with block comments ([55ca36f](https://github.com/vuejs/language-tools/commit/55ca36fa864f60a6bf0d1113e1070a5469956014))
- **fix:** support calling template bindings without `.value` ([7ad4a94](https://github.com/vuejs/language-tools/commit/7ad4a94196d856d105f57ba91683c3c54a3dbe9c))
- **fix:** avoid type guards missing from the tsc bundle in template binding analysis ([e743e80](https://github.com/vuejs/language-tools/commit/e743e80e127400bbf57f829f880bd433756e4882))
- **fix:** pad directive hook signatures to check short-arity directive bindings ([94052b8](https://github.com/vuejs/language-tools/commit/94052b85199f8d1ea5458c02ce70c3ce99a871ee))
- **fix:** `vueCompilerOptions.plugins` now overrides the inherited list instead of being deduplicated on resolve ([4fa9e97](https://github.com/vuejs/language-tools/commit/4fa9e9784e4b5028c23b180839c2302d15e8a4a7)) ([c0e5d2e](https://github.com/vuejs/language-tools/commit/c0e5d2ed78a01e83af648c655381b12b405860dd))
- **fix:** eliminate synthesized ignore comments across codegen, scoped class aliases and compound event handlers ([dbcb7de](https://github.com/vuejs/language-tools/commit/dbcb7de7ad569057fe77d49f1d1b3ac8b4ec53d4)) ([eccb74a](https://github.com/vuejs/language-tools/commit/eccb74a5d9af138dd585f678456fb0590052e5f3)) ([612ae32](https://github.com/vuejs/language-tools/commit/612ae323e3cd835d32dbcfadb720e8349d073361))
- **fix:** correct template mapping boundaries and eliminate unmapped diagnostics ([04954dd](https://github.com/vuejs/language-tools/commit/04954ddb380b459be3d3cd593b092511bb6531af)) ([8c85e38](https://github.com/vuejs/language-tools/commit/8c85e38870010ee69246ff9f88e38d9973aadd15)) ([af7a194](https://github.com/vuejs/language-tools/commit/af7a1944462e5dbfce254f0102a0ee281291452c)) ([90f8207](https://github.com/vuejs/language-tools/commit/90f82073b666cce5c7480689eecb398979b973aa))
- **fix:** stop typedef JSDoc from leaking into emitted dts ([d4d4139](https://github.com/vuejs/language-tools/commit/d4d41393fa9a5e626b65633518bb5fa5647b7224))
- **perf:** precompile attribute glob matchers ([7d2e603](https://github.com/vuejs/language-tools/commit/7d2e6030c61180096ad1b8f49923fdf77d740abf))

### component-meta

- **fix:** stop checking JS Vue files as TS ([045a6a7](https://github.com/vuejs/language-tools/commit/045a6a7eb5afa987b09a85a483eef118cbdcaaf3))

### tsc

- **fix:** prevent watch mode crash on incremental build ([a59da36](https://github.com/vuejs/language-tools/commit/a59da367002ffeb530edd8371493539d5387ea33))

### typescript-plugin

- **fix:** don't abort reference span fix-up at style-less files ([e46126c](https://github.com/vuejs/language-tools/commit/e46126c95682751ed2702355794563550a270edf))

### vscode

- **perf:** reduce focus mode overhead ([b0936d1](https://github.com/vuejs/language-tools/commit/b0936d1c77b68dcc5d888dfd670fe527c5c8ce0d))

## 3.3.11 (2026-08-21)

### language-core

- **fix:** generate full fragment props for type checking ([fd6dada](https://github.com/vuejs/language-tools/commit/fd6dadab91832f60ade8020de6c6947a1115a55f))

### language-service

- **fix:** invalidate tag and prop casing detection after template changes ([879ee9a](https://github.com/vuejs/language-tools/commit/879ee9a4dd38168224a81fe688056c692b608bb6))

### component-meta

- **fix:** invalidate module resolution caches when deleting files ([8359c44](https://github.com/vuejs/language-tools/commit/8359c447a04091b07c6845b768defc4a5c637b24))

### tsc

- **fix:** make extension retry errors serializable across IPC ([05ab009](https://github.com/vuejs/language-tools/commit/05ab00944825815fb5dc5e70a468893a1476fde9))

### vscode

- **feat:** make the welcome page configurable ([3134351](https://github.com/vuejs/language-tools/commit/3134351eadbeedc28c8a05a80f343e3cf1d63048)) ([317ab6a](https://github.com/vuejs/language-tools/commit/317ab6a4056a7cc7ee5b81db27f35278bb7afd23))

## 3.3.10 (2026-08-15)

### language-core

- **fix:** ignore trailing whitespace after generic parameter commas ([6e3aea9](https://github.com/vuejs/language-tools/commit/6e3aea91617459a43849b146b85c15f5b8663a6d))
- **fix:** resolve `v-for` item type over generic sources ([8e78c5d](https://github.com/vuejs/language-tools/commit/8e78c5dc3017a9bae511123d49ec92d5719668f5))
- **fix:** do not extract SFC blocks across inline Markdown code ([055b9c7](https://github.com/vuejs/language-tools/commit/055b9c7530428a15f304c9c784dc113483faaf06))

### language-service

- **fix:** serialize template data provider access across concurrent requests ([2808dbe](https://github.com/vuejs/language-tools/commit/2808dbebe28d8b2d09723088c00f76bdb866dde4))

### tsc

- **fix:** support different extension sets across project references ([cb65247](https://github.com/vuejs/language-tools/commit/cb65247aa3c8ad2e858d13c7d60d2c0de76e3777))

### typescript-plugin

- **fix:** resolve requests against the owning project ([10c9168](https://github.com/vuejs/language-tools/commit/10c9168199db6e51c7d321492d2bdcd17c0c9fc9))

### vscode

- **feat:** patch `typescript.js` via `--require` to support read-only file systems ([0c47258](https://github.com/vuejs/language-tools/commit/0c4725821bf5f09f288cc46e67a488d2292eb77b))
- **fix:** isolate custom TypeScript plugin paths between profiles ([47216a9](https://github.com/vuejs/language-tools/commit/47216a9dedfffac526d417f4fc1b1518200671e1))
- **fix:** update output file name for production ([5616255](https://github.com/vuejs/language-tools/commit/5616255c475158e0b50d7b4c8828761a2d301bf3))

## 3.3.9 (2026-07-31)

### component-meta

- **feat:** expose runtime values of enum members in schema ([00ce7ec](https://github.com/vuejs/language-tools/commit/00ce7ec19bd62c6ed9d8e0a3c4951d4ac23e8540))
- **fix:** keep `getProgramAndFile` free of side effects ([c99eb00](https://github.com/vuejs/language-tools/commit/c99eb007cc14538bc400379539c43d31ec3caced))

### language-core

- **feat:** check unused generic type parameters ([9d08c43](https://github.com/vuejs/language-tools/commit/9d08c434df99a97083a1f08c149bb55621a57a31))

### language-service

- **fix:** preserve trailing and current directive modifiers when completing inside a directive, and when filtering duplicates ([3e362fb](https://github.com/vuejs/language-tools/commit/3e362fbd134e30b06c1cd963f84be7c1cc28f222)) ([d8afe9e](https://github.com/vuejs/language-tools/commit/d8afe9e39d43061fb2c4b6b85a484d13ac66aa47)) ([f4e584b](https://github.com/vuejs/language-tools/commit/f4e584beedad23cc1d1bdb4ce8956455efd616f3))

### workspace

- **feat:** migrate build and tests to `typescript-native-bridge` ([c4e58ea](https://github.com/vuejs/language-tools/commit/c4e58eaaa3c8eec542f161e0a3980bd9396e1c08))

## 3.3.8 (2026-07-22)

### language-core

- **feat:** support vapor directives ([6a5334c](https://github.com/vuejs/language-tools/commit/6a5334ce63163009bbaede9fe8ddac627041da89))
- **refactor:** pass end offsets to `Boundary.start` and drop the unmapped string literal key generation branch ([894a2aa](https://github.com/vuejs/language-tools/commit/894a2aa9b9e52b8cfb387da8dbbb0333045817b8)) ([4e343d4](https://github.com/vuejs/language-tools/commit/4e343d44a5c10245365219736d55993994d9c8ce))

### workspace

- **chore:** upgrade to TypeScript 7 and support `@typescript/typescript6` ([1ef7ecb](https://github.com/vuejs/language-tools/commit/1ef7ecbd0ab9b475e8e3aed791a1606be8bfa8d1))

## 3.3.7 (2026-07-08)

### language-core

- **fix:** wrap single expression event handlers to avoid ASI after `return` ([b1a8452](https://github.com/vuejs/language-tools/commit/b1a845257e474f1199eb6372a7189b2b9766d9cf))
- **refactor:** add `__VLS_StyleScopedClasses` to generated types ([8023ac4](https://github.com/vuejs/language-tools/commit/8023ac462f51e3b213e119439fe713ecc7af5e51))

### typescript-plugin

- **fix:** filter const globals from template completions ([a618ad5](https://github.com/vuejs/language-tools/commit/a618ad524f5c8c50f81be2482e10f0ca248b54ef))

## 3.3.6 (2026-06-30)

### language-core

- **fix:** treat event handler expressions as compound more accurately, preserving return types ([1fdd511](https://github.com/vuejs/language-tools/commit/1fdd51124720bac42fb90a1b1cbe2cf099c077cf)) ([8440da6](https://github.com/vuejs/language-tools/commit/8440da62e14814dd5e610add5a038ef35b4cec47)) ([9b6fb7f](https://github.com/vuejs/language-tools/commit/9b6fb7fc787f8c5fafa7a315e79431eb8d466a45))
- **fix:** make generic component internal context inference type-safe across the `.d.ts` boundary ([bff182a](https://github.com/vuejs/language-tools/commit/bff182a752f5c79fbd475513ad584cfe7ea9d423))
- **fix:** match upstream CSS `v-bind` parsing behavior ([5b450ce](https://github.com/vuejs/language-tools/commit/5b450ceb39d3e4c3af532ce84d8735317982c705))
- **fix:** include setup bindings as potential component names ([c0e42fd](https://github.com/vuejs/language-tools/commit/c0e42fdc5529d6dcbe972de6a7a5e4d2b293a79f))
- **perf:** reduce boundary code feature allocations and cache inline TS ASTs in a `WeakMap` ([f69712f](https://github.com/vuejs/language-tools/commit/f69712f8d1f7e705d3ae8a2ee4ef7e91eea9eb62)) ([c82592d](https://github.com/vuejs/language-tools/commit/c82592d40969484cc25f4ad90144d37662821c15))
- **refactor:** centralize code features and deprecate `allCodeFeatures` ([5cdf4da](https://github.com/vuejs/language-tools/commit/5cdf4dae33f7503a7f934dc73fd61278bcc4506d))

## 3.3.5 (2026-06-13)

### language-core

- **fix:** include event modifiers and raw event parts in duplicate listener checks ([13b9eae](https://github.com/vuejs/language-tools/commit/13b9eae1ad4dc0cd5b638e5cd95f1a3717e55acb)) ([59ebc40](https://github.com/vuejs/language-tools/commit/59ebc402c208426a96e599d98a1bbd6a385fb292))

## 3.3.4 (2026-06-08)

### language-core

- **fix:** detect duplicate event listeners across name formats ([e70cb29](https://github.com/vuejs/language-tools/commit/e70cb29379a93591d63a4e3d6c5c630d483c6d81))
- **fix:** camelize slot props regardless of the `htmlAttributes` option ([3adbe2c](https://github.com/vuejs/language-tools/commit/3adbe2cc5e65397edc55d103ba430a00b5941c93))
- **fix:** only exclude already-set props from inherited attrs when `checkRequiredFallthroughAttributes` is enabled ([9bc36fc](https://github.com/vuejs/language-tools/commit/9bc36fc6a34622d672a02423f2b847d6bbe0932d))

### language-service

- **fix:** respect var hoisting for destructured props hints ([cbd4ea0](https://github.com/vuejs/language-tools/commit/cbd4ea00db12ab6b6800987e9d22f54639aff38b))

### typescript-plugin

- **fix:** do not treat `class` and `style` as a boolean property ([f80e063](https://github.com/vuejs/language-tools/commit/f80e0633db7fbab3c584cb65d0cd8c2f8632f8a6))

## 3.3.3 (2026-05-30)

### vscode

- **fix:** preserve TS auto imports behavior in Vue files ([1d672b6](https://github.com/vuejs/language-tools/commit/1d672b6df8863fb45810e5480ec8ad6665b2e5da))
- **fix:** prevent grammar scopes leakage in capitalized tags ([cd7a6e5](https://github.com/vuejs/language-tools/commit/cd7a6e53d58111640f116d1e19f1c1cf06c7157d))

### ci

- **fix:** read PR title from env in the `auto-version` workflow to prevent injection ([b51c92d](https://github.com/vuejs/language-tools/commit/b51c92dcfbf9e015531d1fbf3a6ca3c45760fb20))

## 3.3.2 (2026-05-25)

### language-core

- **feat:** preserve literal types for inline `v-for` sources ([11b390c](https://github.com/vuejs/language-tools/commit/11b390ce4e7ddf6ce3d5d01c8985280e5a57d753))
- **fix:** align `v-bind` shorthand identifier skipping with interpolation ([4f50ebe](https://github.com/vuejs/language-tools/commit/4f50ebe3de53bf3c1cc2fae0475dfdd3655ca913))

### vscode

- **feat:** transform tsserver content ([168c7fa](https://github.com/vuejs/language-tools/commit/168c7fa952d6e3d229ba076dcc097c4cf16cd109))
- **fix:** do not mark the trailing slash in capitalized self-closing tags as invalid ([6f49ca0](https://github.com/vuejs/language-tools/commit/6f49ca02d41efa3b7b27918e204bc4c671a6be1a))
- **fix:** fall back to the original tsserver path when the proxy write fails ([7aeb5f3](https://github.com/vuejs/language-tools/commit/7aeb5f3af0ed7144d14d2ed7c53a2c7e450a356b))

## 3.3.1 (2026-05-19)

### language-core

- **fix:** avoid extraneous children error for conditional slots ([846157a](https://github.com/vuejs/language-tools/commit/846157a4965e7e4f314fa3f3ae0cc21283b5bc60))

### language-service

- **refactor:** replace scanner-based missing props hints detection with AST traversal ([ded171f](https://github.com/vuejs/language-tools/commit/ded171f37631f25bb790747eab30422e3cb44ba8))

### typescript-plugin

- **fix:** get component prop details from symbols and skip unchecked JS identifiers ([a6476f2](https://github.com/vuejs/language-tools/commit/a6476f24caba810c5f2789194d05638721b3c640)) ([77f1849](https://github.com/vuejs/language-tools/commit/77f184943a9e1529c2ba01f94eeb30275da54104))

### vscode

- **fix:** resolve the typescript plugin path from the resolved server path ([1e25954](https://github.com/vuejs/language-tools/commit/1e25954bec92d5952666003803d7eb99093054d4))

## 3.3.0 (2026-05-18)

### language-core

- **feat:** check required fallthrough attributes ([ee5e76a](https://github.com/vuejs/language-tools/commit/ee5e76a2098a21b9c2a5b706402780e6023a00e5))
- **fix:** penetrate `v-if` branch fragments when collecting single root nodes ([6c13831](https://github.com/vuejs/language-tools/commit/6c138315dd686f39b05aeca6fd575b9954b76c37))
- **refactor:** rename the `Sfc` APIs to `IR` ([dc941c7](https://github.com/vuejs/language-tools/commit/dc941c72d2fa64ebbaa300431d475253c80a1884))

### language-service

- **feat:** re-support `html.customData` ([94da05a](https://github.com/vuejs/language-tools/commit/94da05ae135ace74ea76999cac48e0e667991cd5))
- **fix:** strip `=""` only for plain boolean props completion edits, and reset to the default data provider after running with the Vue data provider ([c224e6a](https://github.com/vuejs/language-tools/commit/c224e6ac567877c3f35d9ce8d3031177f9155d40)) ([55af099](https://github.com/vuejs/language-tools/commit/55af099dfc40fd42e23915a8568ba95c1df674f0))
- **fix:** reuse ASTs for define assignment suggestions and avoid duplicate attrs and props requests ([34beaf3](https://github.com/vuejs/language-tools/commit/34beaf3000d2f2c582d64e08826d1d541fdd2451)) ([c8e435d](https://github.com/vuejs/language-tools/commit/c8e435dc0219d1d2a4be19f9a85b44801ef5f239))

### typescript-plugin

- **feat:** refine props completion to follow TS behavior, filtering fallback global completions and only returning props for component nodes ([cc9585a](https://github.com/vuejs/language-tools/commit/cc9585aba180a3905082648c6c7bdff49a7445b6)) ([154d94d](https://github.com/vuejs/language-tools/commit/154d94daa3de6892d5e3bf2f22afc873103d0274)) ([fd53569](https://github.com/vuejs/language-tools/commit/fd53569a9558ae8ac6098b2b89da68650364a521)) ([e2181c5](https://github.com/vuejs/language-tools/commit/e2181c58e794601c3f5ce93d8c2fb0081a9a7232))

### vscode

- **fix:** write typescript plugins at build time ([cabd9c6](https://github.com/vuejs/language-tools/commit/cabd9c69ea13cee8bef6079a0f489b3f8f14fa67))
- **fix:** avoid infinite diagnostics on Vue files when project diagnostics is enabled ([0614a53](https://github.com/vuejs/language-tools/commit/0614a53c1a0253186c5f7ec4abee6d3ca6b8d3b5))
- **fix:** include `extraFileExtensions` in the tsserver `configure` request payload ([818226a](https://github.com/vuejs/language-tools/commit/818226af9c5c81612a389ac544a158b7ef1e092f))

## 3.2.9 (2026-05-14)

### language-core

- **fix:** do not process inline markdown syntax in semantic-aware segments ([e857bfa](https://github.com/vuejs/language-tools/commit/e857bfaaa07991ddf5f09a251ec4279e13b3a6d9)) - Thanks to @KazariEX!
- **perf:** rewrite a subset of template node transforms ([680aae5](https://github.com/vuejs/language-tools/commit/680aae5dee1e533e03151ef70a77319ec5aeb566)) - Thanks to @KazariEX!

### vscode

- **fix:** trigger file rename edits when moving folders with Vue files ([3fb3329](https://github.com/vuejs/language-tools/commit/3fb3329dfb959ad84fb3a692acbcf0a6684fa410)) - Thanks to @KazariEX!

### workspace

- **chore:** bump volar services to 0.0.71 ([58ee658](https://github.com/vuejs/language-tools/commit/58ee6583213394a47361c3922423157c2791288f)) - Thanks to @TRIS-H!

## 3.2.8 (2026-05-04)

### language-core

- **fix:** replace inline code blocks after sfc blocks processing ([de8c2af](https://github.com/vuejs/language-tools/commit/de8c2af04c3b413de7754fb29599fca3e58aebb2)) - Thanks to @KazariEX!
- **fix:** support navigation for kebab-case declarations in `GlobalComponents` ([e3298b6](https://github.com/vuejs/language-tools/commit/e3298b6de90c616776660112bbc6c2d063e51e2f)) - Thanks to @Gehbt!

### language-service

- **feat:** support TS module resolution for SCSS `@import` navigation ([d1b01ec](https://github.com/vuejs/language-tools/commit/d1b01ecd11d73d690ee95924f5d4bf5f5703bc1a)) - Thanks to @KazariEX!

### typescript-plugin

- **fix:** replace language service per-method overrides with a proxy ([d03866c](https://github.com/vuejs/language-tools/commit/d03866c3b7cb0e073b60d28c7be45af29f23d87e)) - Thanks to @KazariEX!

### vscode

- **chore:** upgrade `reactive-vscode` to v1.0.1 ([453aef5](https://github.com/vuejs/language-tools/commit/453aef5ee1a8fd09db390457e240ca06933e292d)) - Thanks to @kermanx!

## 3.2.7 (2026-04-19)

### component-meta

- **fix:** preserve non-ASCII characters in prop default values ([a954b9c](https://github.com/vuejs/language-tools/commit/a954b9c563ebcff9233ddf63a05e5de4485f3a8c)) - Thanks to @ef81sp!

### workspace

- **chore:** bump typescript to 6.0.3 ([1e54c84](https://github.com/vuejs/language-tools/commit/1e54c84b33f7733feb54e7667ca161da6c548b85)) - Thanks to @KazariEX!

## 3.2.6 (2026-03-17)

### language-core

- **fix:** generate `$slots` type in template correctly with `defineSlots` ([b04ff1a](https://github.com/vuejs/language-tools/commit/b04ff1a7e5ef2d51e6fbe2996cc5cfeeafaceb74)) - Thanks to @KazariEX!
- **fix:** infer only readonly component of arrays in `v-for` ([ada2857](https://github.com/vuejs/language-tools/commit/ada28571aa6a0dad141c0d4e7b0ba1d595cce7d2)) - Thanks to @ascott18!
- **fix:** avoid false positives for destructured props detection on binding property names ([c8dc720](https://github.com/vuejs/language-tools/commit/c8dc720b38ddec16e87d0ac58522c1ad49134f57)) - Thanks to @KazariEX!

### vscode

- **fix:** use regex for TS extension patching to support VS Code 1.110+ ([9991d43](https://github.com/vuejs/language-tools/commit/9991d432b2fb25ee4078df5a82bb3154b37fdfd8)) - Thanks to @ebiryu!

## 3.2.5 (2026-02-21)

### language-core

- **fix:** re-parse template when interpolation syntax breaks ([83ddb4b](https://github.com/vuejs/language-tools/commit/83ddb4babb0a0f3f9bcad9e7cdd040a99cb119be)) - Thanks to @Dsaquel!

### language-service

- **fix:** use default html data provider for document symbols ([1932c1c](https://github.com/vuejs/language-tools/commit/1932c1c4968b2dae6d6a9eace9e53a8a68fe40dd)) - Thanks to @liangmiQwQ!

### language-plugin-pug

- **fix:** handle backtick attributes containing both quote types ([dbaa710](https://github.com/vuejs/language-tools/commit/dbaa710eaa7330abdaf432101e5b52bfdcacda22)) - Thanks to @baptistejamin!

### workspace

- **docs:** document all packages with consistent README structure ([0c4c509](https://github.com/vuejs/language-tools/commit/0c4c50993563cbbea3f98bc3338cdfb5f86566a7))
- **docs:** update tsconfig schema of `plugins` option - Thanks to @KazariEX!

## 3.2.4 (2026-01-26)

### language-core

- **feat:** place plugin configs under `ctx.config` and support type annotation via generics ([b2d5e31](https://github.com/vuejs/language-tools/commit/b2d5e318811d7c63073ccb13908ce252f8d23364)) - Thanks to @KazariEX!

### workspace

- **chore:** publish to npm with OIDC ([b826171](https://github.com/vuejs/language-tools/commit/b8261717b6a1c2bb7072259cbd096ae4a0b33a43)) - Thanks to @ghiscoding!

## 3.2.3 (2026-01-23)

### language-core

- **feat:** support configuration for language plugins ([afc069e](https://github.com/vuejs/language-tools/commit/afc069eeb3a4d299f7276830dbbf45cf74ccef80)) - Thanks to @KazariEX!
- **fix:** avoid `defineModel` breaking ast in `lang="js"` ([a522afa](https://github.com/vuejs/language-tools/commit/a522afaecc5328b12d59dee01731e6e3d5c90e10)) - Thanks to @KazariEX!
- **fix:** infer object keys as string if it does not extend string ([4ca24b6](https://github.com/vuejs/language-tools/commit/4ca24b66a2f91cf4742bac89c40cf771bd89fbb3)) - Thanks to @serkodev!

### typescript-plugin

- **feat:** correct rename behavior on same name shorthands in template ([506e5ab](https://github.com/vuejs/language-tools/commit/506e5ab84e113fed726ae530d68d4dcb7b61b112)) - Thanks to @KazariEX!
- **fix:** only forward quick info for original results without tags ([601176e](https://github.com/vuejs/language-tools/commit/601176ef99616d916f4805ead04de22ceb12d6c3)) - Thanks to @KazariEX!

### vscode

- **fix:** correct indent for `<style>` and `<script>` tags ([e76cf2e](https://github.com/vuejs/language-tools/commit/e76cf2e05246ff9e65bc974ed5021f028e922f83)) - Thanks to @serkodev!

## 3.2.2 (2026-01-06)

### language-core

- **fix:** correct code features on v-bind shorthands of special attributes - Thanks to @KazariEX!

### language-plugin-pug

- **feat:** accurate Pug shorthand mapping ([c97cf7d](https://github.com/vuejs/language-tools/commit/c97cf7d9a5482a79355a530727c4e3c84d3bd1b4))
- **fix:** pre-map HTML to Pug offset attribute ([8fdfe99](https://github.com/vuejs/language-tools/commit/8fdfe99deb9869284fbcd45fc61de0e3aedb6c0a))

### language-service

- **feat:** strip `=""` for boolean props completion edits ([f1314ef](https://github.com/vuejs/language-tools/commit/f1314eff7ccaccfc6ff92b7fcdae01ac947a7cff)) - Thanks to @KazariEX!
- **fix:** avoid duplicate directive modifiers in completion ([b7244e1](https://github.com/vuejs/language-tools/commit/b7244e1c68daa0761c0ea0e901c4b8e8f19aae2c)) - Thanks to @KazariEX!

### typescript-plugin

- **fix:** only forward quick info and suggestion diagnostics for setup bindings ([5f2d2db](https://github.com/vuejs/language-tools/commit/5f2d2dbf75e1caccd13bd9f42c6803f6aff866a7)) - Thanks to @KazariEX!

## 3.2.1 (2025-12-22)

### language-core

- **fix:** infer array type in `v-for` ([ad127fc](https://github.com/vuejs/language-tools/commit/ad127fc3299f31890b56402098c9fe7acdb2105f)) - Thanks to @serkodev!

### component-meta

- **fix:** skip schema resolution correctly when `option` is `false` ([719f1bc](https://github.com/vuejs/language-tools/commit/719f1bc4c112889cbcc40baa419e870807524ec6)) - Thanks to @KazariEX!

### component-type-helpers

- **fix:** npm package is missing build files (#5893)

### language-service

- **feat:** props completion now only suggests `:xxx` (shorthand) when no prefix is typed, instead of both `xxx` and `:xxx`

## 3.2.0 (2025-12-20)

### vscode

- **fix:** Vue TS highlighting when trailing type alias is missing semicolon ([a7fb42c](https://github.com/vuejs/language-tools/commit/a7fb42cca46e214b074c9ae93232722515b76dee)) - Thanks to @serkodev!
- **perf:** replace `fast-diff` with custom character-by-character alignment algorithm ([704b30a](https://github.com/vuejs/language-tools/commit/704b30a1db9b37acddc801f59717264adc5fd107))
- **refactor:** update Vue grammar scope name to "text.html.vue" ([4d0a979](https://github.com/vuejs/language-tools/commit/4d0a979bdfd1ae7e5f3f7f24e4911b91e86ea1f8))
- **test:** add test for embedded grammars ([ec0732d](https://github.com/vuejs/language-tools/commit/ec0732dd1007e3c16fa9ec69961c650d1b99d412)) - Thanks to @serkodev!

### language-service

- **feat:** rich hover message ([a202bc7](https://github.com/vuejs/language-tools/commit/a202bc7e73025fd44f01ae7e820dc015d2040feb))
- **feat:** support markdown JSDoc for rich hover message description ([3417c37](https://github.com/vuejs/language-tools/commit/3417c375c057ea126e61ef3cb081499cf2ca54ff)) - Thanks to @serkodev!
- **chore:** adjust rich hover message title layout ([21616fe](https://github.com/vuejs/language-tools/commit/21616fe5eb22effed411e45a4594c35b650368d1)) - Thanks to @serkodev!

### component-meta

- **feat:** add `tags` to slots and exposed ([9a29fe8](https://github.com/vuejs/language-tools/commit/9a29fe8b97398d7d1b28938f111471e5095d92fe)) - Thanks to @aj-dev!
- **feat:** filter out irrelevant properties from `exposed` ([90de325](https://github.com/vuejs/language-tools/commit/90de325ccd938df683c070dc05bfbf28a7617fd3)) - Thanks to @aj-dev!
- **refactor:** redundant logic between deduplication and language-core ([3af4903](https://github.com/vuejs/language-tools/commit/3af49035dbb9c229ba54a0c5a8bfa7be42de1111))
- **refactor:** de-dependency from component-type-helpers ([f01314b](https://github.com/vuejs/language-tools/commit/f01314bd3edbf92d23186950bc837790f94cb127))
- **refactor:** search prop defaults with symbol declarations ([bb235b6](https://github.com/vuejs/language-tools/commit/bb235b68f395daba38af7c4c6c8d7b70bdab0707))
- **refactor:** deprecate "noDeclarations" and "forceUseTs" options ([f4979cd](https://github.com/vuejs/language-tools/commit/f4979cde31da84b3a0d4234cf66c0bfe15a04186))

### typescript-plugin

- **feat:** include leading dot when finding references to CSS classes ([2cbcf21](https://github.com/vuejs/language-tools/commit/2cbcf219d1df1eae728a76aa8f14eaeccd08e042))
- **fix:** missing module error after file rename ([f6f4b8e](https://github.com/vuejs/language-tools/commit/f6f4b8e02243ec528acf4ccaf6067ae6d32a5312)) - Thanks to @serkodev!
- **fix:** prioritize non-warning completion entries over warning ones (#5847)
- **fix:** always pass rest parameters for future compatibility ([b6d775d](https://github.com/vuejs/language-tools/commit/b6d775d47ea907d3d5b68d570eec8b713ec3e0df)) - Thanks to @KazariEX!
- **fix:** add nullish guards before accessing `ts.CompletionEntryData` ([1203c2b](https://github.com/vuejs/language-tools/commit/1203c2b5e68b6bfb05a18c52987bceb32635a6f9)) - Thanks to @KazariEX!
- **fix:** handle import type nodes in definition proxy ([94b8298](https://github.com/vuejs/language-tools/commit/94b82981def04822c8e0db885baeb91b6378a8e7))
- **fix:** handle type imports in component auto-import ([f801ab3](https://github.com/vuejs/language-tools/commit/f801ab34dd98b4380a166d418a0489f2a937f7f5))

### language-core

- **feat:** revert overcorrection of `v-for` type inference ([e8bd1cc](https://github.com/vuejs/language-tools/commit/e8bd1cc82334e3b55cb98e1209252f9286f435f1))
- **feat:** align `v-for` key type with `Object.keys` ([068af0f](https://github.com/vuejs/language-tools/commit/068af0f7a3b372654ed3f73bab8ddfc892b84bcd)) - Thanks to @serkodev!
- **feat:** narrow component and directive types ([a2985f9](https://github.com/vuejs/language-tools/commit/a2985f902b2d79d26093567106242cc235df7206))
- **feat:** support `<!-- @strictTemplates -->` magic comment ([5a06882](https://github.com/vuejs/language-tools/commit/5a06882ef9c94c4d65ef2f2ab5304d15a737e2f5))
- **fix:** correctly resolve `<script src="">` ([ef85674](https://github.com/vuejs/language-tools/commit/ef85674915542703a3096ab67099565414fe6738))
- **fix:** preserve template slot wrappers during `createIfBranch` ([446c089](https://github.com/vuejs/language-tools/commit/446c089dfe4e7ecfbfa7d7b45a2b39ae271915ab)) - Thanks to @serkodev!
- **fix:** include end tag locations when renaming global components
- **refactor:** replace dynamic types generation with static files ([ef011e4](https://github.com/vuejs/language-tools/commit/ef011e4eecea7bb14f6386767946146b26d7ae73))
- **refactor:** improve Vue version detection and plugin resolution ([0722817](https://github.com/vuejs/language-tools/commit/07228170cccade8fe3fd9eb205559c87e7b5248a))

### component-type-helpers

- **refactor:** remove `ComponentType` helper ([19a81d4](https://github.com/vuejs/language-tools/commit/19a81d4667b3dbd09b74fdd1d6dc1523bb02f36e))

### workspace

- **chore:** update testing infrastructure ([88ae70a](https://github.com/vuejs/language-tools/commit/88ae70a03c15a8dab9406178536f634ab3e1a774))
- **chore:** use tsgo in development ([8f1bce8](https://github.com/vuejs/language-tools/commit/8f1bce8b39b54768cc838ac1996e2c8b0bf62252))
- **chore:** reduce local dependencies and update workflows ([2ba765e](https://github.com/vuejs/language-tools/commit/2ba765e9dcb568d8b293667369933a42cda8d74c))
- **chore:** upgrade tsslint and vite to pre-release versions ([78f0ce8](https://github.com/vuejs/language-tools/commit/78f0ce8831716ead60de9551b3f655cb05e0f53f))
- **chore:** delete tests for Vue 3.4 ([6b5bfdb](https://github.com/vuejs/language-tools/commit/6b5bfdb4f1b26f26f61e5a35d7db12fcfd9146d2))

## 3.1.8 (2025-12-09)

### Features

- feat(vscode): support multiline attribute for `<script>` and `<style>` tag ([3a84ff6](https://github.com/vuejs/language-tools/commit/3a84ff602e336316e11f4e83abfaa9d7ef909ff6)) - Thanks to @serkodev!
- feat(vscode): support format with selected range ([f1a6b52](https://github.com/vuejs/language-tools/commit/f1a6b52b99a654eb3783bf137ac2205e42ec0f62)) - Thanks to @serkodev!
- feat(language-service): add tsconfig-based document link support for Pug

### Bug Fixes

- fix(language-core): limit the range of parseDiagnostics checks (#5823)
- fix(language-core): restore default import bindings for template scope ([7d642d1](https://github.com/vuejs/language-tools/commit/7d642d193442d77050edfda6408a37330e36b302)) - Thanks to @serkodev!
- fix(typescript-plugin): get `preferences` and `formatOptions` in tsserver ([8b9d74c](https://github.com/vuejs/language-tools/commit/8b9d74cab507a4781d3e61459f5f44b701eebf32))
- fix(language-core): avoid generating component options within the setup scope ([85c5cf0](https://github.com/vuejs/language-tools/commit/85c5cf092ad9cc3ec1ef3b3f8466ee824632754a))

### Other Changes

- perf(language-core): dedupe component options generation ([b071638](https://github.com/vuejs/language-tools/commit/b0716386da76786c637f36b8391cec3491255ae0))

## 3.1.7 (2025-12-08)

### Features

- feat(language-core): cache virtual code by `scriptId` ([b05c012](https://github.com/vuejs/language-tools/commit/b05c0123fb3525622103db826bad5ca3177b2a9a)) - Thanks to @serkodev!

### Bug Fixes

- fix(language-core): avoid using `Identifier.text` property (#5810)
- fix(language-core): generate script separator on demand ([c65e5a5](https://github.com/vuejs/language-tools/commit/c65e5a5bf3b47a401b2129ad5451998d691b4a66))
- fix(language-core): avoid invalid `__VLS_Slots` generation

### Other Changes

- feat(lint): add typescript services types lint rule ([d245142](https://github.com/vuejs/language-tools/commit/d245142725c97a13d49fd4435ed56ab1d3e48245)) - Thanks to @serkodev!

## 3.1.6 (2025-12-06)

### Features

- feat(vscode): add settings to enable per-block formatting ([56ae259](https://github.com/vuejs/language-tools/commit/56ae259dbf4c3d1dd07cf73097b06363114d50bb)) - Thanks to @serkodev!
- feat(language-service): enhanced component auto import ([15cc24e](https://github.com/vuejs/language-tools/commit/15cc24e74a70f11897605633320edfd48223e1ae))
- feat(component-meta): add component name and description fields ([a1b8b71](https://github.com/vuejs/language-tools/commit/a1b8b71e49befbb928ea340f9e20a2eee349fbc6))
- feat(typescript-plugin): add support for template "Add Import" quick fix ([b8503cd](https://github.com/vuejs/language-tools/commit/b8503cdb0b922427caf7e0ff874d6e956f57a12e)) - Thanks to @serkodev!
- feat(typescript-plugin): mapping JSDoc information from `<script setup>` ([732cb86](https://github.com/vuejs/language-tools/commit/732cb8673acb3d9c487ef74b20f77b6e9e26c67a))
- feat(vscode): support tsdk path for Eclipse Theia ([5bf90db](https://github.com/vuejs/language-tools/commit/5bf90db643405c942042d3c03ec3db97d443c6b3)) - Thanks to @serkodev!

### Bug Fixes

- fix(language-service): ignore intrinsic elements when detecting tag name casing ([522f237](https://github.com/vuejs/language-tools/commit/522f237f7ac8f91873259bc3db5e14228b789e64))
- fix(language-core): `createParsedCommandLineByJson` parsed incorrect options since v3.1.5 (https://github.com/vuejs/language-tools/pull/5768#issuecomment-3569623037)
- fix(vscode): make `vue.server.path` compatible with Windows ([39ef351](https://github.com/vuejs/language-tools/commit/39ef35143863d7493f32eb009092d27da5286549))
- fix(vscode): analyze interpolation highlight ranges based on AST ([a732962](https://github.com/vuejs/language-tools/commit/a7329627e4faa03d289ef657418ca4f36319f575))
- fix(vscode): sync latest vscode html language configuration ([bab2162](https://github.com/vuejs/language-tools/commit/bab2162d845cb36c3398f7d13fda6545af244bb4))
- fix(language-core): enhance `getVIfNode` to support `v-else-if` directives ([5548db0](https://github.com/vuejs/language-tools/commit/5548db0f54bab65f311f375b313da96a565525d3)) - Thanks to @serkodev!
- fix(language-core): generate `{}` instead of its string value for `style="..."` ([97c239d](https://github.com/vuejs/language-tools/commit/97c239dd757289b5481f35d5aecd4179d311ca7b)) - Thanks to @KazariEX!
- fix(language-core): `v-bind="$attrs"` loses navigation when `inferTemplateDollarAttrs` is disabled ([d747456](https://github.com/vuejs/language-tools/commit/d7474566e8f1c4edd49023c634e638c280b57433))
- fix(language-service): skip `const props =` completion in StringLiteral ([4a16e57](https://github.com/vuejs/language-tools/commit/4a16e575015446f7ba67f82266827771d417ec24))
- fix(language-core): unable to get completion for the second scoped class name
- fix(language-service): format components with HTML void-element names ([52e3d5e](https://github.com/vuejs/language-tools/commit/52e3d5ecc1c71ce790d357466da52ba7315b5bf4)) - Thanks to @serkodev!
- fix(language-service): properly handle promise when resolving CSS links (#5785)
- fix(language-core): infer `$el` type for generic components using `inferComponentDollarEl` ([54a19d4](https://github.com/vuejs/language-tools/commit/54a19d46f12e93bf1fc55b6c2a98a9ce5794dd15))
- fix(language-core): ensure `<script>` content generates before `<script setup>` ([15c3005](https://github.com/vuejs/language-tools/commit/15c30055f14736f7e664dff9d59a2f6f1a26e823))
- fix(language-core): remove `bypassDefineComponent` hack for better JS support (#4876) (#5379)
- fix(language-core): `Prettify<T>` caused generic props to get inferred as `unknown` ([adeba0a](https://github.com/vuejs/language-tools/commit/adeba0a746f3fa5a058733388a563dff754394b4)) - Thanks to @so1ve!
- fix(vscode): handle leading `<` as operator in SFC scripts ([1ab9928](https://github.com/vuejs/language-tools/commit/1ab99281bd1057e96cb5134971aa76341f44f362)) - Thanks to @serkodev!
- fix(vscode): patch `isTypeScriptDocument` in VSCode for `typescript.preferences.autoImportSpecifierExcludeRegexes` config support (#5364)
- fix(language-core): ensure type consistency for optional boolean props ([b2ca816](https://github.com/vuejs/language-tools/commit/b2ca816fb9442daa795ab9dd37fe0322b54e5bba))
- fix(language-core): add compatibility for `vapor` attr (#5496)
- fix(language-core): AST fault tolerance for key binding on template ([9f3d8cc](https://github.com/vuejs/language-tools/commit/9f3d8cc0cf2c795782eb0ea4a28742a12d4f1151))

### Performance

- perf(language-core): reuse ts asts for `:class` - Thanks to @KazariEX!

### Other Changes

- Revert "refactor(typescript-plugin): remove go to definition trick for auto imported components ([71115fb](https://github.com/vuejs/language-tools/commit/71115fbed08db8b294295733ffdf7549ee2cc0aa))"
- docs(typescript-plugin): update Neovim configuration link ([5b0b97e](https://github.com/vuejs/language-tools/commit/5b0b97edba017e499ad66b6cd529bcc30a32854c)) - Thanks to @AlexVagrant!
- refactor(language-core): normalize template AST ([147c69a](https://github.com/vuejs/language-tools/commit/147c69accba237e26950d0c94d14be90e09a4253))
- refactor(language-core): split style codegen ([343743f](https://github.com/vuejs/language-tools/commit/343743f475a44e0cba88abdd3412d9a74a866690))
- refactor(language-core): remove `debugger` from virtual code for tsslint compatibility
- refactor(language-core): remove legacy navigation support in `ref="xxx"`
- refactor(language-core): reduce codegen options ([f4a9c50](https://github.com/vuejs/language-tools/commit/f4a9c507b317c9fc4b710b28ba152a5029851235))
- refactor(component-meta): deprecate `rawType` and `__internal__.tsLs` ([487dc29](https://github.com/vuejs/language-tools/commit/487dc29ec82923676bb028f933e8e5f919fa5e2a))
- chore: update volar to 2.4.26 ([9acb5b0](https://github.com/vuejs/language-tools/commit/9acb5b01f9f15bbfdae4d9a0971c13f3068b7347))
  - feat: fallback resolution mode for `createResolveModuleName` (https://github.com/volarjs/volar.js/pull/293) (#5644) - Thanks to @serkodev!

## 3.1.5 (2025-11-23)

### Features

- feat(language-service): support tsconfig path alias resolution for document links ([d007a9c](https://github.com/vuejs/language-tools/commit/d007a9c98826348ff8b7d45fd4a40d3505b1e3de)) - Thanks to @KazariEX!
- feat(language-server): add `serverInfo` to initialized result ([0b8a880](https://github.com/vuejs/language-tools/commit/0b8a8803d56a5c18f224590efa15e8319b5f3ea2)) - Thanks to @kada49!

### Bug Fixes

- fix(vscode): correct highlighting of tags starting with `template` ([d937a84](https://github.com/vuejs/language-tools/commit/d937a84e41bdf3b64b6f0330dc2ddf1e3240c09d)) - Thanks to @serkodev and @KazariEX!
- fix(language-core): allow loose props checks on generic components ([5d841f4](https://github.com/vuejs/language-tools/commit/5d841f4209fef36314f77e2cd057fafd57cce02a)) - Thanks to @serkodev!
- fix(language-core): avoid `vue-tsc` crash during single file checks ([11a448c](https://github.com/vuejs/language-tools/commit/11a448c419e4dcacf7d7263c78d72029202eb190)) - Thanks to @KazariEX!
- fix(language-core): dispose virtual code correctly - Thanks to @KazariEX!

### Performance

- perf(language-core): skip unnecessary runtime codegen step ([4a9932c](https://github.com/vuejs/language-tools/commit/4a9932c531cec8c23b7d5d1e6f24bbb113b838b5)) - Thanks to @KazariEX!

## 3.1.4 (2025-11-16)

### Bug Fixes

- fix(language-service): prevent auto-insertion of html snippets in template interpolation ([4a89b6e](https://github.com/vuejs/language-tools/commit/4a89b6e8e9ad0951e18fa083a3de3f0fb31f3236)) - Thanks to @serkodev!
- fix(language-service): strip interpolations from document passed to html service - Thanks to @KazariEX!
- fix(language-core): report unused `@ts-expect-error` directive on components with loose props checks ([6646704](https://github.com/vuejs/language-tools/commit/66467047ab3fe652140e24200e20cdbc9659b7b4)) - Thanks to @serkodev and @KazariEX!
- fix(language-core): respect directive comments before `v-else` ([2abec30](https://github.com/vuejs/language-tools/commit/2abec30f3a0d75a6ddda10537320f9f9d5bd1898)) - Thanks to @serkodev and @KazariEX!

### Other Changes

- refactor(language-core): re-implement component references by codegen ([6ccf06c](https://github.com/vuejs/language-tools/commit/6ccf06c58bae28cf94d7ba77c484e1ed8160d90c)) - Thanks to @KazariEX!
- refactor(language-core): simplify calculation of full interpolation content - Thanks to @KazariEX!

## 3.1.3 (2025-11-03)

### Features

- feat(typescript-plugin): allow triggering file references on `<template>` ([1e7fe05](https://github.com/vuejs/language-tools/commit/1e7fe05f6bdce74740b916a47975e8cce519cc75)) - Thanks to @KazariEX!

### Bug Fixes

- fix(vscode): correct syntax highlight in template with `lang="html"` ([84f0aa5](https://github.com/vuejs/language-tools/commit/84f0aa558d6f45995fd00a47d45632fac84a3a2e)) - Thanks to @serkodev!

### Other Changes

- refactor(language-core): generate intrinsic elements variable into global types ([9a2857e](https://github.com/vuejs/language-tools/commit/9a2857e63430f2f50c0744fd2efc5ab715701f2f)) - Thanks to @KazariEX!
- refactor(typescript-plugin): remove go to definition trick for auto imported components ([71115fb](https://github.com/vuejs/language-tools/commit/71115fbed08db8b294295733ffdf7549ee2cc0aa)) - Thanks to @KazariEX!

## 3.1.2 (2025-10-25)

### Bug Fixes

- fix(component-meta): import type helpers by relative path
- fix(language-core): fix syntax error when `propTypes` has no elements ([426f8d5](https://github.com/vuejs/language-tools/commit/426f8d54c9aa36c4397f6cbe0c89f2077bd4a4ff)) - Thanks to @so1ve!
- fix(language-core): omit defined emit props only ([d45228a](https://github.com/vuejs/language-tools/commit/d45228a288341bf2d7174e93c84955626a1c9850)) - Thanks to @so1ve!

### Other Changes

- docs: fix `vue-tsc` broken link to example boilerplate in `README.md` ([fd05a1c](https://github.com/vuejs/language-tools/commit/fd05a1c92c9af63e6af1eab926084efddf7c46c3)) - Thanks to @heyakyra!

## 3.1.1 (2025-10-07)

### Features

- feat(language-server): support `--tsdk` command line arg ([77430b1](https://github.com/vuejs/language-tools/commit/77430b1795f9e49e7d66a11acdb58be2eb5cd993))

### Bug Fixes

- fix(language-core): tolerate non-literal export default ([5080fd9](https://github.com/vuejs/language-tools/commit/5080fd9d425f0e6f6145cac7eb690e5bec6169ca)) - Thanks to @KazariEX!
- fix(language-core): use component instance props as fallthrough attributes ([dbe8b53](https://github.com/vuejs/language-tools/commit/dbe8b537c55a17ed5e44ce04a255791eff89ea73)) - Thanks to @KazariEX!
- fix(typescript-plugin): determine if variable is `Ref` by `RefSymbol` property ([49aa565](https://github.com/vuejs/language-tools/commit/49aa565410cc46df4721b14daa152be53741c7be)) - Thanks to @KazariEX!
- fix(language-core): exclude effect of comments on root node ([a7e820a](https://github.com/vuejs/language-tools/commit/a7e820ab4eac1c3d069215688114511ec9813359)) - Thanks to @KazariEX!
- fix(typescript-plugin): place `__vue__` in project instead of program ([7a75463](https://github.com/vuejs/language-tools/commit/7a75463eb78ade79580b83bf82015c79364ac887))
- fix(component-type-helpers): remove deprecated `$scopedSlots` support for Vue 2
- fix(language-core): replace markdown links after sfc blocks processing ([9835ea7](https://github.com/vuejs/language-tools/commit/9835ea78a7418c58229bc8dc011f2ace0c4209e0)) - Thanks to @KazariEX!
- fix(language-core): do not report unused error on `__VLS_export` (#5696) - Thanks to @KazariEX!

### Other Changes

- refactor(language-core): reimplement `writeGlobalTypes` without side effects

## 3.1.0 (2025-09-28)

### Performance

- perf(language-core): drop internal component ([39eb65c](https://github.com/vuejs/language-tools/commit/39eb65cedde0d6170df8e8e27093074454614e5a)) - Thanks to @KazariEX!

### Other Changes

- refactor: drop Vue 2 support ([aaa1c68](https://github.com/vuejs/language-tools/commit/aaa1c68eab41b53a62a11767c7a290ac84e61626)) - Thanks to @KazariEX!
- chore(lint): enforce use of type-only imports ([aa0d842](https://github.com/vuejs/language-tools/commit/aa0d8424c9a83989546f70ae8fbfe7801fb8ae84)) - Thanks to @so1ve!
- ci: upgrade node version ([ecf6f2f](https://github.com/vuejs/language-tools/commit/ecf6f2f0eb3d1c044372ae665a5a6c394b44ebbc)) - Thanks to @so1ve!
- refactor(typescript-plugin): move reactivity analysis logic to a seperate typescript plugin ([9066601](https://github.com/vuejs/language-tools/commit/9066601e9ff166796389f1624ce44410f1df7ea9)) - Thanks to @KazariEX!

## 3.0.10 (2025-10-25)

### Bug Fixes

- fix(typescript-plugin): place `__vue__` in project instead of program ([7a75463](https://github.com/vuejs/language-tools/commit/7a75463eb78ade79580b83bf82015c79364ac887))

## 3.0.9 (2025-10-07)

### Features

- feat(language-server): support `--tsdk` command line arg ([77430b1](https://github.com/vuejs/language-tools/commit/77430b1795f9e49e7d66a11acdb58be2eb5cd993))

## 3.0.8 (2025-09-23)

### Features

- feat(vscode): introduce `vue.server.path` setting ([b274db2](https://github.com/vuejs/language-tools/commit/b274db264c1083275c5c04958292f406838a71eb))

### Bug Fixes

- fix(language-core): initialize properties of `VueVirtualCode` in constructor ([9bfbfcc](https://github.com/vuejs/language-tools/commit/9bfbfcc650f1150bb238a9c2eeb9348f33b021b3)) - Thanks to @KazariEX!
- fix(vscode): flatten reactivity visualization decorators ([ce82fac](https://github.com/vuejs/language-tools/commit/ce82facfcea64e0eb538f1276bdd6bc7a9fd5dcc)) - Thanks to @KazariEX!
- fix(vscode): normalize reactivity visualization ranges
- fix(vscode): patch `typescriptServerPlugin` languages without FS hack
- fix(language-service): do not provide semantic tokens and document highlights for non-`file` scheme files ([f7bdeaa](https://github.com/vuejs/language-tools/commit/f7bdeaa7bb476df1fc8ff46c504d75c1869b0be9)) - Thanks to @KazariEX!

### Performance

- perf(typescript-plugin): redo single-file language service for reactivity visualization ([3bfd059](https://github.com/vuejs/language-tools/commit/3bfd059f5c3dadb2b25e1a82f52480e9d74f97bb))

### Other Changes

- refactor(typescript-plugin): externalize reactivity analysis logic ([cb6eef1](https://github.com/vuejs/language-tools/commit/cb6eef1e66e85b4b4c99a3d44d152bc1b2bba5b1)) - Thanks to @KazariEX!

## 3.0.7 (2025-09-12)

### Bug Fixes

- fix(vscode): show welcome page only when opening a Vue file
- fix(language-core): generate slot parameters in the same way as interpolation ([15f6feb](https://github.com/vuejs/language-tools/commit/15f6feb408ab01b23518d9dcfa891a1c1be2b5fb)) - Thanks to @KazariEX!
- fix(language-core): do not generate variables for builtin directives - Thanks to @KazariEX!

### Other Changes

- docs(vscode): add descriptions for premium feature configurations ([d3be337](https://github.com/vuejs/language-tools/commit/d3be3372439252632f16061c1c8fcf5e32eb041c)) - Thanks to @KazariEX!
- refactor(typescript-plugin): explicitly request parameters ([a66f233](https://github.com/vuejs/language-tools/commit/a66f2330b5aa6f811f571159245c46af0c36c534))
- chore(lint): enable `@typescript-eslint/no-unnecessary-condition` ([274d3fa](https://github.com/vuejs/language-tools/commit/274d3facbf4d505f7a828633ad816e77718e7777))
- refactor(language-server): reimplement Reactivity Visualization in typescript plugin ([b8cb0ac](https://github.com/vuejs/language-tools/commit/b8cb0ac472a17ce144cd22b6350a471b3061b764))
- refactor(language-server): parsing interpolations in extension client ([e6cf377](https://github.com/vuejs/language-tools/commit/e6cf37796e5b6add79e26e2c3c6b897061676a26))
- refactor(vscode): reimplement Focus Mode based on folding ranges ([541e112](https://github.com/vuejs/language-tools/commit/541e11204dc3058694bd82b6dc657a6177d4ecc7))
- chore(vscode): disable Focus Mode by default (#5578)
- refactor(vscode): set delay of reactivity visualization updates to 250ms - Thanks to @KazariEX!

## 3.0.6 (2025-08-20)

### Bug Fixes

- fix(language-core): wrap `:class` expression with parens - Thanks to @KazariEX!
- fix(vscode): revert Vue 2 versions in `target` option ([b6aad73](https://github.com/vuejs/language-tools/commit/b6aad733315b4d86f6c6378dbc49448fe8e2a44d)) - Thanks to @gxres042!
- fix(language-service): skip document highlight from tsserver within element tags ([0154301](https://github.com/vuejs/language-tools/commit/015430124044c9667aa851ac30d10a213254f74b)) - Thanks to @KazariEX!
- fix(component-meta): re-export `vue-component-type-helpers` to `lib/helpers` (#5600)
- fix(language-core): remove the non-strict `configFileName` default value ([56f1267](https://github.com/vuejs/language-tools/commit/56f12671bf617f6994218d5c9165efbf9610f11f))
- fix(language-core): don't look for input files during evaluation of vueCompilerOptions (#5598)
- fix(vscode): improve reliability of handling extension activation contention ([c742a1c](https://github.com/vuejs/language-tools/commit/c742a1c8d29365c7b103ba22716aa8c4a5980537))
- chore: update volar to 2.4.23 ([0ed384f](https://github.com/vuejs/language-tools/commit/0ed384f9fbe67910cbf48c28f7d9f0cf2939f76c))
  - Support `js/ts.hover.maximumLength` and `typescript.experimental.expandableHover` (#5577)

### Other Changes

- feat(lint): update tsslint config ([374bd7a](https://github.com/vuejs/language-tools/commit/374bd7a50e73c2abfaa014ad70df2660b827628c))
- refactor(language-core): generate setup returns on demand - Thanks to @KazariEX!
- chore(language-service): remove `exclude` config suggestion from global types error message ([287b0ca](https://github.com/vuejs/language-tools/commit/287b0ca8750edda9b5914a472889f1dee43880f4)) - Thanks to @Ciallo-Chiaki
- chore(vscode): update extension display name "Vue.js" ([427eea1](https://github.com/vuejs/language-tools/commit/427eea15d58b49e6e4080da8a65b75ad1c94404c))
- chore: update `vue-component-type-helpers` to current version ([1b98031](https://github.com/vuejs/language-tools/commit/1b98031bdfdf50265f073cec54d45cd001bc6827)) - Thanks to @kingyue737!

## 3.0.5 (2025-08-01)

### Features

- feat(language-core): introduce `compileSFCStyle` to provide style related infomation ([4718cc2](https://github.com/vuejs/language-tools/commit/4718cc2ff30410bd7267850047fbdd3eeebc8626)) - Thanks to @KazariEX!
- feat(language-service): completion snippet for `v-for` ([5084123](https://github.com/vuejs/language-tools/commit/50841239eb0e2e44d35df43c363f4f8f1c467062)) - Thanks to @KazariEX!

### Bug Fixes

- fix(language-core): generate `modelModifiers` for explicitly declared default model name ([0e0ffd9](https://github.com/vuejs/language-tools/commit/0e0ffd974b6642fe74e6ac634999941b9757031c)) - Thanks to @KazariEX!
- fix(language-service): more responsive `.value` insertion
- fix(vscode): add `class` scope fallback for `component` semantic tokens ([dff519a](https://github.com/vuejs/language-tools/commit/dff519af4505d9935cbba80fe3ba5234571e23fa)) - Thanks to @KazariEX!
- fix(vscode): make sure extension is loaded immediately
- fix(language-service): only check `globalTypesPath` for FS files
- fix(vscode): handle fail tsserver requests to avoid memory leak
- fix(vscode): do not delay the execution of `restartExtensionHost`
- fix(language-core): avoid references highlight of unrelated native element tags ([64f5da2](https://github.com/vuejs/language-tools/commit/64f5da224ca4681330ae0af40edfa8e7aa9aa54a)) - Thanks to @KazariEX!
- fix(language-core): tolerance for incomplete root template tag
- fix(language-core): enable navigation code feature on directive modifiers - Thanks to @KazariEX!

### Other Changes

- chore(language-service): improve global types error message for JS projects ([2d51435](https://github.com/vuejs/language-tools/commit/2d51435a8bdf79adac1e77da4d506a9ed02921dd)) - Thanks to @Ciallo-Chiaki!

## 3.0.4 (2025-07-25)

### Features

- feat(language-service): check casing when dropping component into template - Thanks to @KazariEX!
- feat(language-service): native completion experience for slot names ([2435873](https://github.com/vuejs/language-tools/commit/2435873dc4c09fbf5394d96c083b2c2d18ecd8b6)) - Thanks to @KazariEX!

### Bug Fixes

- fix(language-core): avoid clearing global types path when local compiler options is present - Thanks to @KazariEX!
- fix(language-core): do not evaluate `skipTemplateCodegen` when exposing `$slots` - Thanks to @KazariEX!
- fix(language-service): correct kind and order of component completion items - Thanks to @KazariEX!
- fix(component-meta): filter events out of props ([c964b32](https://github.com/vuejs/language-tools/commit/c964b327c4215ead6f18e4dfaddc5e12ab90e91e)) - Thanks to @Akryum!

### Other Changes

- refactor(language-core): allow configuring `checkUnknownEvents` and `checkUnknownComponents` in sfc ([26fa104](https://github.com/vuejs/language-tools/commit/26fa1044a7cf6eaad8737212954e3f06b29380fa)) - Thanks to @KazariEX!
- chore(language-service): add restart server hint to global types warning - Thanks to @KazariEX!

## 3.0.3 (2025-07-18)

### Bug Fixes

- fix(language-core): find `node_modules` based on file's directory ([4df0f6a](https://github.com/vuejs/language-tools/commit/4df0f6aa57981d224a4ebd4d26bc97fb00a47a01)) - Thanks to @KazariEX!
- fix(language-core): do not spread exposed object ([945a6cd](https://github.com/vuejs/language-tools/commit/945a6cd90266499d924f81cfa8826299a4ff7905)) - Thanks to @KazariEX!
- fix(vscode): prompt manual reload in remote envs ([5023ecf](https://github.com/vuejs/language-tools/commit/5023ecf6547fa9cbb692170dfc48c0c32103ea4d))

### Other Changes

- refactor(tsc): return the result of runTsc ([e1095ed](https://github.com/vuejs/language-tools/commit/e1095ed38b8a67f2b58229f16f48ebf4c99b1eee)) - Thanks to @escaton!

## 3.0.2 (2025-07-18)

### Features

- feat(language-core): introduce `globalTypesPath` option for non-npm like environment ([9ad6714](https://github.com/vuejs/language-tools/commit/9ad6714a8be8fca0040947ffb970fffe3dba482f)) - Thanks to @KazariEX!
- feat: forward tsserver's semantic tokens via language server ([0e917c6](https://github.com/vuejs/language-tools/commit/0e917c601bddfa748be072f409a4c37cbe6985ab)) - Thanks to @KazariEX!

### Bug Fixes

- fix(vscode): correct syntax highlight of control directives ending with `/` or `)` - Thanks to @KazariEX!
- fix(language-core): infer parameter type of union slots to be union instead of intersection ([abb5f2b](https://github.com/vuejs/language-tools/commit/abb5f2b6c4be384d1fef0e874a128500d2024d8e)) - Thanks to @KazariEX!
- fix(vscode): remove `colorizedBracketPairs` config for plaintext
- fix(language-core): avoid early access to local types to skip unnecessary type generation - Thanks to @KazariEX!
- fix(language-core): treat `<component>` without `is` prop as normal component - Thanks to @KazariEX!
- fix(vscode): make sure tsserver loads `@vue/typescript-plugin` last ([34b5dd2](https://github.com/vuejs/language-tools/commit/34b5dd24c42cc269af81a0ce0a61cda9d43f7bfe))
- fix(language-core): only keep navigation code feature on static `name` value of `<slot>` - Thanks to @KazariEX!
- fix(language-server): add `allowJs` to reactivity analyze host - Thanks to @KazariEX!
- fix(language-core): do not set template lang to `md` for markdown ([0d5c7eb](https://github.com/vuejs/language-tools/commit/0d5c7eb3d62c437fa84f44aeaa5bc49f8e26b7bd)) - Thanks to @KazariEX!
- fix(typescript-plugin): exclude items of kind `module` from template completion - Thanks to @KazariEX!
- fix(language-core): walk identifiers correctly within type nodes in interpolation ([ae5f778](https://github.com/vuejs/language-tools/commit/ae5f7784c09544b6b00d0198927374e0ec44746d)) - Thanks to @KazariEX!
- fix(language-service): correct position calculation of twoslash queries ([9ab8556](https://github.com/vuejs/language-tools/commit/9ab855601f6ab12150f39d3459a938c330fe1015)) - Thanks to @KazariEX!
- fix(language-core): avoid redundant increment of block variable depth ([08269b1](https://github.com/vuejs/language-tools/commit/08269b17dd3df78b2ed5ebf2979c6e98793ca63b)) - Thanks to @KazariEX!
- fix(language-service): re-implement twoslash queries in script - Thanks to @KazariEX!

### Other Changes

- refactor(vscode): make welcome page code public - Thanks to @KazariEX!
- refactor(vscode): add premium feature settings
- chore: migrate from `minimatch` to `picomatch` ([211b1f7](https://github.com/vuejs/language-tools/commit/211b1f79938c067c27679ccc5f5cee1b1f10d57c)) - Thanks to @KazariEX!
- chore: update volar to 2.4.19 ([7247cde](https://github.com/vuejs/language-tools/commit/7247cde6851c80cd8a1b6836087f0c18fbee69d7))
  - fix(typescript): skip source file search when `.d.${ext}.ts` file exists (volarjs/volar.js#277)
- revert: type support of slot children ([4bde3e1](https://github.com/vuejs/language-tools/commit/4bde3e1c074e8df5b856aa34d55bf62a20136dcf)) - Thanks to @KazariEX!

## 3.0.1 (2025-07-02)

### Bug Fixes

- fix(language-core): remove calculation logic of element inner loc ([74c9c85](https://github.com/vuejs/language-tools/commit/74c9c850cc864daaf79635382ff3c07c04855c89)) - Thanks to @KazariEX!
- fix(vscode): correct syntax highlight of `v-else` ([2536006](https://github.com/vuejs/language-tools/commit/25360064e2ff29a41824c7d0d233f5e3ea805695)) - Thanks to @KazariEX!

### Other Changes

- docs(vscode): update Russian translation for VS Code extension ([b809045](https://github.com/vuejs/language-tools/commit/b809045c97869d5e3d60ed323b3fa4020224acb4)) - Thanks to @AndreyYolkin!
- chore: update volar to 2.4.17 ([8540bef](https://github.com/vuejs/language-tools/commit/8540bef1cf8b8ad16dc94c02e2142b9e520a1633))
  - typescript: correctly use `getModeForUsageLocation` to calculate the resolution mode

## 3.0.0 (2025-07-01)

### Features

- feat(typescript-plugin): skip declaration files in goto components definition ([a7ac323](https://github.com/vuejs/language-tools/commit/a7ac3237d8efddf8a7de1f661eef107e594a7cc0)) - Thanks to @KazariEX!
- feat(language-core): introduce `strictVModel` option ([1b74d13](https://github.com/vuejs/language-tools/commit/1b74d13a99be77da2cc9ca7027328ac9ab20a4cb)) - Thanks to @KazariEX!
- feat(vscode, language-server, typescript-plugin): communicate with tsserver based on request forwarding (#5252, #5395, #5443)
- feat(language-core): support navigation of events with `v-on` syntax ([638b949](https://github.com/vuejs/language-tools/commit/638b9495a4a1e0f6cbc8daf2ef0862689cde99e0)) - Thanks to @KazariEX!
- feat(language-core): type support of slot children ([4bde3e1](https://github.com/vuejs/language-tools/commit/4bde3e1c074e8df5b856aa34d55bf62a20136dcf)) - Thanks to @KazariEX!
- feat(language-service): autocomplete for props with union type
- feat(language-service): document links for template refs ([7c2618e](https://github.com/vuejs/language-tools/commit/7c2618eaba6372956da06dc80502030c440c4dc5)) - Thanks to @alex-snezhko!
- feat(language-core): resolve external stylesheets ([0f2e0b8](https://github.com/vuejs/language-tools/commit/0f2e0b82fca2d6fff95f8f57b81d9cd49109d040)) - Thanks to @KazariEX!
- feat(language-core): add `strictCssModules` option ([48b7d52](https://github.com/vuejs/language-tools/commit/48b7d52726910f865ca8cb7680e850af592412b8)) - Thanks to @KazariEX!
- feat(component-type-helpers): add `ComponentAttrs` type for attribute extraction
- feat(vscode): add support for `typescript.sortImports`, `typescript.removeUnusedImports` commands ([59f8126](https://github.com/vuejs/language-tools/commit/59f812654d3c921356179006c6027aefe99596da))
- feat(vscode): i18n support of configurations and commands with `zh-CN`, `zh-TW`, `ru` and `ja` (#5330, #5340, #5404) - Thanks to @KazariEX, @PurplePlanen and @zyoshoka!

### Bug Fixes

- fix(language-core): generate condition guards for model events ([841cb3c](https://github.com/vuejs/language-tools/commit/841cb3cbc5ef1e8bdf8a0178b21097512e172a95)) - Thanks to @KazariEX!
- fix(language-core): prevent global types generation in declaration files ([d606ff5](https://github.com/vuejs/language-tools/commit/d606ff5a727634845eaa81e880710bfe075a1d82)) - Thanks to @KazariEX!
- fix(language-core): prevent eager inference of slot props from generics ([2043e6a](https://github.com/vuejs/language-tools/commit/2043e6aefd030557a11baea93a3d3e582c40209b)) - Thanks to @KazariEX!
- fix(typescript-plugin): prevent highlighting native element tags with same name as components ([d9366f1](https://github.com/vuejs/language-tools/commit/d9366f15b8d7c66fb03ab77054a0573e62418d54)) - Thanks to @KazariEX!
- fix(language-service): do not provide required props inlay hints for intrinsic elements ([1b25cb6](https://github.com/vuejs/language-tools/commit/1b25cb6047ff113916486907ea446de44639aa40)) - Thanks to @KazariEX!
- fix(vscode): handle `typescript-language-features` module loading race condition ([32c9336](https://github.com/vuejs/language-tools/commit/32c93365929193efdf40671667189d34b940eb72))
- fix(component-meta): update event type representation to include array notation
- fix(language-core): correct error mapping when prop exp is arrow function ([3055a38](https://github.com/vuejs/language-tools/commit/3055a38828b398533342faec6edcf1e71704dfc8)) - Thanks to @KazariEX!
- fix(language-service): add document highlights support ([e07b797](https://github.com/vuejs/language-tools/commit/e07b7978e9f5b5794ba101e5df28ca38d6f48602)) - Thanks to @KazariEX!
- fix(language-core): correct type inference of multiple template refs with same name ([f568869](https://github.com/vuejs/language-tools/commit/f5688693ef529d75a2c80bf8330b3e7c77593f5e)) - Thanks to @KazariEX!
- fix(language-core): skip AST parsing when the expression is an identifier ([c0910a1](https://github.com/vuejs/language-tools/commit/c0910a16968ec985bc46ff854f0b89e6853458fe)) - Thanks to @KazariEX!
- fix(language-core): do not drop leading comments of `defineModels` ([7ef0baa](https://github.com/vuejs/language-tools/commit/7ef0baa1581c3761a70cb0e2a0cae48297a1d755)) - Thanks to @KazariEX!
- fix(language-core): improve fault tolerance for unsupported script languages
- fix(language-core): avoid invalid auto import edit position when setup global types fails
- fix(language-core): transform slot parameter list into equivalent binding pattern ([ca80050](https://github.com/vuejs/language-tools/commit/ca800506da46360c8c16fae219e4079172fcd398)) - Thanks to @KazariEX!
- fix(language-core): correct codegen when src path does not match the generated length - Thanks to @KazariEX!
- fix(language-service): exclude `data-` attribute completion from sfc level nodes - Thanks to @KazariEX!
- fix(language-core): remove semantic highlight of v-bind shorthand ([5e2d2ce](https://github.com/vuejs/language-tools/commit/5e2d2ce6d72e9234bab3dfe9bf8a1983b7fa53c4)) - Thanks to @KazariEX!
- fix(vscode): inline html comment pattern in Vue syntax definition ([e862758](https://github.com/vuejs/language-tools/commit/e8627588049742764b3b26ead7a2b95fec65cb4f)) - Thanks to @zyoshoka!
- fix(language-core): avoid unrelated virtual code recomputes on style and template change - Thanks to @KazariEX!
- fix(component-meta): attach namespace prefix correctly on generated types ([2a1a9b2](https://github.com/vuejs/language-tools/commit/2a1a9b29e4b4a68ed7feec3a8d2f9d522c607d2a)) - Thanks to @KazariEX!
- fix(language-core): drop `undefined` from optional prop type with default in template ([a7b5649](https://github.com/vuejs/language-tools/commit/a7b5649ab4957cd2228f4bbc9205b2008bff58a2)) - Thanks to @Dylancyclone!
- fix: depend on exact volar version ([15e4d82](https://github.com/vuejs/language-tools/commit/15e4d82a85b1bbc3b545c62dd5a5fada8bec87c9)) - Thanks to @tomblachut!
- fix(language-core): ignore frontmatter block in markdown files ([ac7235d](https://github.com/vuejs/language-tools/commit/ac7235d0ff0986a665b3dd8954069adb3f6ab2e8)) - Thanks to @brc-dd!
- fix(component-meta): only exclude vnode events from props ([27499c7](https://github.com/vuejs/language-tools/commit/27499c7ff8c1a7872ebe2a09ed55da87bbd37769)) - Thanks to @KazariEX!
- fix(language-core): skip css references for position within virtual code with `navigation: true` ([5fc35b6](https://github.com/vuejs/language-tools/commit/5fc35b6e6e56d0781bbe5459268d1c4c990e4606)) - Thanks to @KazariEX!
- fix(language-core): hoist export declarations from generic script block ([1d5883e](https://github.com/vuejs/language-tools/commit/1d5883e012b27c2e527e8743964fef5f903f33de)) - Thanks to @KazariEX!
- fix(vscode): correct syntax highlight for directives starting with `v-for` ([d94c100](https://github.com/vuejs/language-tools/commit/d94c100f416f5dbe9adfbdb24305537ee9cc326e)) - Thanks to @KazariEX!
- fix(language-core): correct support for flatten plugins ([67532b1](https://github.com/vuejs/language-tools/commit/67532b14460b7d67de1815e2e6a58891a3d71012)) - Thanks to @zhiyuanzmj!
- fix(language-core): remove `semantic` code feature on first argument of `useCssModule` and `useTemplateRef` - Thanks to @KazariEX!
- fix(typescript-plugin): filter completion items of macros and global variables in template and styles ([f64cbba](https://github.com/vuejs/language-tools/commit/f64cbba4b8a25a61a6dd074b3e267257570ff72c)) - Thanks to @KazariEX!
- fix(language-core): do not generate redundant function scopes to affect type narrowing ([dcfe727](https://github.com/vuejs/language-tools/commit/dcfe727a90c31f63f2ff362d43a6c4b649a922f1)) - Thanks to @KazariEX!
- fix(component-meta): add new file name in `updateFile` ([8008177](https://github.com/vuejs/language-tools/commit/80081776a55b4392072d49eddeef4e95e2aa16e7)) - Thanks to @Akryum!
- fix(language-core): `Prettify<T>` breaks generics inferencing ([7c53715](https://github.com/vuejs/language-tools/commit/7c5371548279b126a5d003cd0b6bc7bb296367c5)) - Thanks to @so1ve!
- fix(language-core): use `var` instead of `let` to declare `attrsVar` that may be hoisted - Thanks to @KazariEX!

### Performance

- perf(language-core): cache and reuse inline ts asts during full updates ([073a7cb](https://github.com/vuejs/language-tools/commit/073a7cb3bb823479ae5e9bff52850f529714571d)) - Thanks to @KazariEX!

### Other Changes

- refactor(vscode, language-server): remove hybrid mode configuration ([dac1089](https://github.com/vuejs/language-tools/commit/dac10895ef58fbc429ca74b06acc8cf81d38f935))
- refactor(vscode): remove write virtual files command
- chore(vscode): correct `directory` path in package.json ([6773e89](https://github.com/vuejs/language-tools/commit/6773e89a4607beb72735f1548018be8633174acc)) - Thanks to @zyoshoka!
- chore(vscode): use rolldown for bundling ([f387371](https://github.com/vuejs/language-tools/commit/f38737163620d2d536fb3111a647eff07ccb52cf)) - Thanks to @KazariEX!
- refactor(vscode): remove doctor - Thanks to @KazariEX!
- docs: update instructions for neovim lsp configuration ([45826c7](https://github.com/vuejs/language-tools/commit/45826c76a3255c75d69583c58bbcea00a083a22b)) - Thanks to @kshksdrt!
- refactor(vscode): remove Vite problem matcher ([5f5726c](https://github.com/vuejs/language-tools/commit/5f5726cb9d57b1abaddac4ee89b0ebfc651e5681))
- chore(docs): update vue language package name ([7aa44b7](https://github.com/vuejs/language-tools/commit/7aa44b7880407e382612534ad0b72662dcac7357)) - Thanks to @marktlinn!
- chore(ci): set pre-release status when publishing to Open VSX ([8de1262](https://github.com/vuejs/language-tools/commit/8de1262a5d14b82b34ce9072a864f3ab8cf72bed)) - Thanks to @lukashass!
- docs: fallback workaround of `vue_language_server_path` in nvim setup example ([5fd492c](https://github.com/vuejs/language-tools/commit/5fd492cfcb8073e055ac7b47b77bcac5169ffe93)) - Thanks to @menuRivera!
- test(component-meta): simplify code with snapshots ([31df458](https://github.com/vuejs/language-tools/commit/31df4588078e231b3381ab9719c4b084545f7437)) - Thanks to @KazariEX!
- docs(nvim): move neovim lspconfig docs to wiki page ([0baa88c](https://github.com/vuejs/language-tools/commit/0baa88cd49bf0d17303f5d373082d3e3e4fe0336)) - Thanks to @RayGuo-ergou!
- refactor(language-server): drop `typescript.tsdk` initialization option ([235de4c](https://github.com/vuejs/language-tools/commit/235de4c9b22c5909561c70826d73dfaa5f959953))
- refactor(language-service): drop name casing convertion and its language status item ([08fb2c8](https://github.com/vuejs/language-tools/commit/08fb2c8b8f01a7fd631744ad7e51fed8347152bf)) - Thanks to @KazariEX!
- refactor(language-core): drop `defineProp` support ([14ec3d8](https://github.com/vuejs/language-tools/commit/14ec3d8eef6102f6044ccea9e355fa52172268ed)) - Thanks to @KazariEX!
- chore(vscode): change display name to "Vue (Official)"
- refactor: cleanup dependencies relationship ([7c6696a](https://github.com/vuejs/language-tools/commit/7c6696a7d3db42f0a2c314a0a8bfc199d84dcb79))
- refactor(component-meta): use type-helpers as a peer dependency
- refactor(vscode): cleanup extension client ([682bd94](https://github.com/vuejs/language-tools/commit/682bd9468991d21bc4b7882343b2061b46fd308c))
- refactor(language-server): move in server code from insiders edition ([7a2ea48](https://github.com/vuejs/language-tools/commit/7a2ea48123679387d7095a81ac49cfc667aeeabb))
- chore: introduce oxlint for faster linting ([894c5e8](https://github.com/vuejs/language-tools/commit/894c5e89a0ed6831c2c0bff3ca9e3d161f5753d5)) - Thanks to @KazariEX!
- refactor(vscode): remove split editor feature ([96b621a](https://github.com/vuejs/language-tools/commit/96b621af419b39723ca4d39bbfdffda5b0e0429b))
- refactor(vscode): rename configuration keys from `complete` to `suggest` for clarity

## Previous Changelogs

### 2.x.x (2024/3/2 - 2025-04-22)

See [changelog v2](./changelogs/CHANGELOG-v2.md)

### 1.x.x (2022/10/7 - 2023/12/26)

See [changelog v1](./changelogs/CHANGELOG-v1.md)

### 0.x.x (2020/5/2 - 2022/9/8)

See [changelog v0](./changelogs/CHANGELOG-v0.md)
