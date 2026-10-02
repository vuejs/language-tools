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

Contributors: @serkodev, @KazariEX, @00200200, @camonunez, @Cherry, @hungateJoseph, @KazariAI, @lazerg, @uturnr, @ValentinYoushkevich, @xia-chao

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

Contributors: @serkodev, @pierreedbrg, @KazariAI, @KazariEX

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

Contributors: @serkodev, @KazariEX, @KazariAI, @lazerg

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

Contributors: @KazariEX, @lazerg, @seanogdev, @so1ve, @valentinpalkovic

## 3.3.8 (2026-07-22)

### language-core

- **feat:** support vapor directives ([6a5334c](https://github.com/vuejs/language-tools/commit/6a5334ce63163009bbaede9fe8ddac627041da89))
- **refactor:** pass end offsets to `Boundary.start` and drop the unmapped string literal key generation branch ([894a2aa](https://github.com/vuejs/language-tools/commit/894a2aa9b9e52b8cfb387da8dbbb0333045817b8)) ([4e343d4](https://github.com/vuejs/language-tools/commit/4e343d44a5c10245365219736d55993994d9c8ce))

### workspace

- **chore:** upgrade to TypeScript 7 and support `@typescript/typescript6` ([1ef7ecb](https://github.com/vuejs/language-tools/commit/1ef7ecbd0ab9b475e8e3aed791a1606be8bfa8d1))

Contributors: @KazariEX, @liangmiQwQ, @WaldemarEnns

## 3.3.7 (2026-07-08)

### language-core

- **fix:** wrap single expression event handlers to avoid ASI after `return` ([b1a8452](https://github.com/vuejs/language-tools/commit/b1a845257e474f1199eb6372a7189b2b9766d9cf))
- **refactor:** add `__VLS_StyleScopedClasses` to generated types ([8023ac4](https://github.com/vuejs/language-tools/commit/8023ac462f51e3b213e119439fe713ecc7af5e51))

### typescript-plugin

- **fix:** filter const globals from template completions ([a618ad5](https://github.com/vuejs/language-tools/commit/a618ad524f5c8c50f81be2482e10f0ca248b54ef))

Contributors: @KazariEX

## 3.3.6 (2026-06-30)

### language-core

- **fix:** treat event handler expressions as compound more accurately, preserving return types ([1fdd511](https://github.com/vuejs/language-tools/commit/1fdd51124720bac42fb90a1b1cbe2cf099c077cf)) ([8440da6](https://github.com/vuejs/language-tools/commit/8440da62e14814dd5e610add5a038ef35b4cec47)) ([9b6fb7f](https://github.com/vuejs/language-tools/commit/9b6fb7fc787f8c5fafa7a315e79431eb8d466a45))
- **fix:** make generic component internal context inference type-safe across the `.d.ts` boundary ([bff182a](https://github.com/vuejs/language-tools/commit/bff182a752f5c79fbd475513ad584cfe7ea9d423))
- **fix:** match upstream CSS `v-bind` parsing behavior ([5b450ce](https://github.com/vuejs/language-tools/commit/5b450ceb39d3e4c3af532ce84d8735317982c705))
- **fix:** include setup bindings as potential component names ([c0e42fd](https://github.com/vuejs/language-tools/commit/c0e42fdc5529d6dcbe972de6a7a5e4d2b293a79f))
- **perf:** reduce boundary code feature allocations and cache inline TS ASTs in a `WeakMap` ([f69712f](https://github.com/vuejs/language-tools/commit/f69712f8d1f7e705d3ae8a2ee4ef7e91eea9eb62)) ([c82592d](https://github.com/vuejs/language-tools/commit/c82592d40969484cc25f4ad90144d37662821c15))
- **refactor:** centralize code features and deprecate `allCodeFeatures` ([5cdf4da](https://github.com/vuejs/language-tools/commit/5cdf4dae33f7503a7f934dc73fd61278bcc4506d))

Contributors: @KazariEX, @Holiden

## 3.3.5 (2026-06-13)

### language-core

- **fix:** include event modifiers and raw event parts in duplicate listener checks ([13b9eae](https://github.com/vuejs/language-tools/commit/13b9eae1ad4dc0cd5b638e5cd95f1a3717e55acb)) ([59ebc40](https://github.com/vuejs/language-tools/commit/59ebc402c208426a96e599d98a1bbd6a385fb292))

Contributors: @KazariEX

## 3.3.4 (2026-06-08)

### language-core

- **fix:** detect duplicate event listeners across name formats ([e70cb29](https://github.com/vuejs/language-tools/commit/e70cb29379a93591d63a4e3d6c5c630d483c6d81))
- **fix:** camelize slot props regardless of the `htmlAttributes` option ([3adbe2c](https://github.com/vuejs/language-tools/commit/3adbe2cc5e65397edc55d103ba430a00b5941c93))
- **fix:** only exclude already-set props from inherited attrs when `checkRequiredFallthroughAttributes` is enabled ([9bc36fc](https://github.com/vuejs/language-tools/commit/9bc36fc6a34622d672a02423f2b847d6bbe0932d))

### language-service

- **fix:** respect var hoisting for destructured props hints ([cbd4ea0](https://github.com/vuejs/language-tools/commit/cbd4ea00db12ab6b6800987e9d22f54639aff38b))

### typescript-plugin

- **fix:** do not treat `class` and `style` as a boolean property ([f80e063](https://github.com/vuejs/language-tools/commit/f80e0633db7fbab3c584cb65d0cd8c2f8632f8a6))

Contributors: @KazariEX, @whysopaul

## 3.3.3 (2026-05-30)

### vscode

- **fix:** preserve TS auto imports behavior in Vue files ([1d672b6](https://github.com/vuejs/language-tools/commit/1d672b6df8863fb45810e5480ec8ad6665b2e5da))
- **fix:** prevent grammar scopes leakage in capitalized tags ([cd7a6e5](https://github.com/vuejs/language-tools/commit/cd7a6e53d58111640f116d1e19f1c1cf06c7157d))

### ci

- **fix:** read PR title from env in the `auto-version` workflow to prevent injection ([b51c92d](https://github.com/vuejs/language-tools/commit/b51c92dcfbf9e015531d1fbf3a6ca3c45760fb20))

Contributors: @KazariEX, @arpitjain099

## 3.3.2 (2026-05-25)

### language-core

- **feat:** preserve literal types for inline `v-for` sources ([11b390c](https://github.com/vuejs/language-tools/commit/11b390ce4e7ddf6ce3d5d01c8985280e5a57d753))
- **fix:** align `v-bind` shorthand identifier skipping with interpolation ([4f50ebe](https://github.com/vuejs/language-tools/commit/4f50ebe3de53bf3c1cc2fae0475dfdd3655ca913))

### vscode

- **feat:** transform tsserver content ([168c7fa](https://github.com/vuejs/language-tools/commit/168c7fa952d6e3d229ba076dcc097c4cf16cd109))
- **fix:** do not mark the trailing slash in capitalized self-closing tags as invalid ([6f49ca0](https://github.com/vuejs/language-tools/commit/6f49ca02d41efa3b7b27918e204bc4c671a6be1a))
- **fix:** fall back to the original tsserver path when the proxy write fails ([7aeb5f3](https://github.com/vuejs/language-tools/commit/7aeb5f3af0ed7144d14d2ed7c53a2c7e450a356b))

Contributors: @KazariEX, @kkesidis, @suisanka

## 3.3.1 (2026-05-19)

### language-core

- **fix:** avoid extraneous children error for conditional slots ([846157a](https://github.com/vuejs/language-tools/commit/846157a4965e7e4f314fa3f3ae0cc21283b5bc60))

### language-service

- **refactor:** replace scanner-based missing props hints detection with AST traversal ([ded171f](https://github.com/vuejs/language-tools/commit/ded171f37631f25bb790747eab30422e3cb44ba8))

### typescript-plugin

- **fix:** get component prop details from symbols and skip unchecked JS identifiers ([a6476f2](https://github.com/vuejs/language-tools/commit/a6476f24caba810c5f2789194d05638721b3c640)) ([77f1849](https://github.com/vuejs/language-tools/commit/77f184943a9e1529c2ba01f94eeb30275da54104))

### vscode

- **fix:** resolve the typescript plugin path from the resolved server path ([1e25954](https://github.com/vuejs/language-tools/commit/1e25954bec92d5952666003803d7eb99093054d4))

Contributors: @KazariEX

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

Contributors: @KazariEX, @Bomberus

## 3.2.9 (2026-05-14)

### language-core

- **perf:** rewrite a subset of template node transforms ([680aae5](https://github.com/vuejs/language-tools/commit/680aae5dee1e533e03151ef70a77319ec5aeb566))
- **fix:** do not process inline markdown syntax in semantic-aware segments ([e857bfa](https://github.com/vuejs/language-tools/commit/e857bfaaa07991ddf5f09a251ec4279e13b3a6d9))

### vscode

- **fix:** trigger file rename edits when moving folders with Vue files ([3fb3329](https://github.com/vuejs/language-tools/commit/3fb3329dfb959ad84fb3a692acbcf0a6684fa410))

### workspace

- **chore:** bump volar services to 0.0.71 ([58ee658](https://github.com/vuejs/language-tools/commit/58ee6583213394a47361c3922423157c2791288f))

Contributors: @KazariEX, @TRIS-H

## 3.2.8 (2026-05-04)

### language-core

- **fix:** replace inline code blocks after SFC block processing ([de8c2af](https://github.com/vuejs/language-tools/commit/de8c2af04c3b413de7754fb29599fca3e58aebb2))
- **fix:** support navigation for kebab-case declarations in `GlobalComponents` ([e3298b6](https://github.com/vuejs/language-tools/commit/e3298b6de90c616776660112bbc6c2d063e51e2f))
- **refactor:** generate template helper names ([5a8cfa9](https://github.com/vuejs/language-tools/commit/5a8cfa9021d7b39e791bafabec3fdf3a6515972e))

### language-service

- **feat:** support TS module resolution for SCSS `@import` navigation ([d1b01ec](https://github.com/vuejs/language-tools/commit/d1b01ecd11d73d690ee95924f5d4bf5f5703bc1a))
- **refactor:** get void elements from the default html provider ([dc7fc80](https://github.com/vuejs/language-tools/commit/dc7fc8087e52e0cd310eb6af9989be208b9ac36c))

### typescript-plugin

- **fix:** replace language service per-method overrides with a proxy ([d03866c](https://github.com/vuejs/language-tools/commit/d03866c3b7cb0e073b60d28c7be45af29f23d87e))

Contributors: @KazariEX, @Gehbt, @kermanx

## 3.2.7 (2026-04-19)

### component-meta

- **fix:** preserve non-ASCII characters in prop default values ([a954b9c](https://github.com/vuejs/language-tools/commit/a954b9c563ebcff9233ddf63a05e5de4485f3a8c))

### workspace

- **chore:** bump typescript to 6.0.3 ([1e54c84](https://github.com/vuejs/language-tools/commit/1e54c84b33f7733feb54e7667ca161da6c548b85))

Contributors: @KazariEX, @ef81sp

## 3.2.6 (2026-03-17)

### language-core

- **fix:** generate `$slots` type in template correctly with `defineSlots` ([b04ff1a](https://github.com/vuejs/language-tools/commit/b04ff1a7e5ef2d51e6fbe2996cc5cfeeafaceb74))
- **fix:** infer only the readonly component of arrays in `v-for` ([ada2857](https://github.com/vuejs/language-tools/commit/ada28571aa6a0dad141c0d4e7b0ba1d595cce7d2))

### language-service

- **fix:** avoid false positives for destructured props detection on binding property names ([c8dc720](https://github.com/vuejs/language-tools/commit/c8dc720b38ddec16e87d0ac58522c1ad49134f57))

### vscode

- **fix:** use regex for TS extension patching to support VS Code 1.110+ ([9991d43](https://github.com/vuejs/language-tools/commit/9991d432b2fb25ee4078df5a82bb3154b37fdfd8))

Contributors: @KazariEX, @ascott18, @ebiryu, @serkodev

## 3.2.5 (2026-02-21)

### language-core

- **fix:** re-parse the template when interpolation syntax breaks ([83ddb4b](https://github.com/vuejs/language-tools/commit/83ddb4babb0a0f3f9bcad9e7cdd040a99cb119be))

### language-service

- **fix:** use the default html data provider for document symbols ([1932c1c](https://github.com/vuejs/language-tools/commit/1932c1c4968b2dae6d6a9eace9e53a8a68fe40dd))

### language-plugin-pug

- **fix:** handle backtick attributes containing both quote types ([dbaa710](https://github.com/vuejs/language-tools/commit/dbaa710eaa7330abdaf432101e5b52bfdcacda22))

### docs

- **docs:** document all packages with a consistent README structure, and update the tsconfig schema of the `plugins` option ([0c4c509](https://github.com/vuejs/language-tools/commit/0c4c50993563cbbea3f98bc3338cdfb5f86566a7)) ([3ffeab3](https://github.com/vuejs/language-tools/commit/3ffeab31db946d677ba23c1e7ebd853487e80a1b))

Contributors: @KazariEX, @baptistejamin, @Dsaquel, @liangmiQwQ

## 3.2.4 (2026-01-26)

### language-core

- **feat:** place plugin configs under `ctx.config` and support type annotation via generics ([b2d5e31](https://github.com/vuejs/language-tools/commit/b2d5e318811d7c63073ccb13908ce252f8d23364))

### workspace

- **chore:** publish to npm with OIDC ([b826171](https://github.com/vuejs/language-tools/commit/b8261717b6a1c2bb7072259cbd096ae4a0b33a43))

Contributors: @KazariEX, @ghiscoding

## 3.2.3 (2026-01-23)

### language-core

- **feat:** support configuration for language plugins ([afc069e](https://github.com/vuejs/language-tools/commit/afc069eeb3a4d299f7276830dbbf45cf74ccef80))
- **fix:** infer object keys as string if they do not extend string ([4ca24b6](https://github.com/vuejs/language-tools/commit/4ca24b66a2f91cf4742bac89c40cf771bd89fbb3))
- **fix:** avoid `defineModel` breaking the AST in `lang="js"` ([a522afa](https://github.com/vuejs/language-tools/commit/a522afaecc5328b12d59dee01731e6e3d5c90e10))
- **fix:** avoid `yield*` on strings, and use the builtin method from `@vue/shared` to check builtin directives ([0aa74d1](https://github.com/vuejs/language-tools/commit/0aa74d11c2be5e0863f992e8533ea1fe3a5b6316)) ([e40f116](https://github.com/vuejs/language-tools/commit/e40f1165da9b228db0c5f831ce519ffe39ff8b92))

### typescript-plugin

- **feat:** correct rename behavior on same name shorthands in template ([506e5ab](https://github.com/vuejs/language-tools/commit/506e5ab84e113fed726ae530d68d4dcb7b61b112))
- **fix:** only forward quick info for original results without tags ([601176e](https://github.com/vuejs/language-tools/commit/601176ef99616d916f4805ead04de22ceb12d6c3))

### vscode

- **fix:** correct indent for `<style>` and `<script>` tags ([e76cf2e](https://github.com/vuejs/language-tools/commit/e76cf2e05246ff9e65bc974ed5021f028e922f83))

Contributors: @KazariEX, @serkodev

## 3.2.2 (2026-01-06)

### language-core

- **fix:** correct code features on `v-bind` shorthands of special attributes ([a5b6635](https://github.com/vuejs/language-tools/commit/a5b66358d09e457f06e7ec1b2382d5b67f0fed8c))

### language-service

- **feat:** strip `=""` for boolean props completion edits ([f1314ef](https://github.com/vuejs/language-tools/commit/f1314eff7ccaccfc6ff92b7fcdae01ac947a7cff))
- **fix:** avoid duplicate directive modifiers in completion ([b7244e1](https://github.com/vuejs/language-tools/commit/b7244e1c68daa0761c0ea0e901c4b8e8f19aae2c))

### typescript-plugin

- **fix:** only forward quick info and suggestion diagnostics for setup bindings ([5f2d2db](https://github.com/vuejs/language-tools/commit/5f2d2dbf75e1caccd13bd9f42c6803f6aff866a7))

### language-plugin-pug

- **feat:** accurate Pug shorthand mapping ([c97cf7d](https://github.com/vuejs/language-tools/commit/c97cf7d9a5482a79355a530727c4e3c84d3bd1b4))
- **fix:** pre-map HTML to Pug offset attribute ([8fdfe99](https://github.com/vuejs/language-tools/commit/8fdfe99deb9869284fbcd45fc61de0e3aedb6c0a))

Contributors: @KazariEX

## 3.2.1 (2025-12-22)

### language-core

- **fix:** infer array type in `v-for` ([ad127fc](https://github.com/vuejs/language-tools/commit/ad127fc3299f31890b56402098c9fe7acdb2105f))
- **refactor:** remove `__VLS_InternalProps` ([2e0e5e0](https://github.com/vuejs/language-tools/commit/2e0e5e0384085b48f36d9eb85a0d82154b6346ee))

### language-service

- **feat:** only show shorthand props when no prefix is typed ([5f326e2](https://github.com/vuejs/language-tools/commit/5f326e2363084f0d00f8c3323125eccbd436ab5d))

### component-meta

- **fix:** skip schema resolution correctly when `option` is `false` ([719f1bc](https://github.com/vuejs/language-tools/commit/719f1bc4c112889cbcc40baa419e870807524ec6))

### component-type-helpers

- **fix:** add the missing tsconfig reference so the package is built and published ([e36fcbd](https://github.com/vuejs/language-tools/commit/e36fcbdd0aef916f6d43a68677086c115edc719b))

Contributors: @serkodev, @KazariEX

## 3.2.0 (2025-12-20)

### vscode

- **fix:** Vue TS highlighting when trailing type alias is missing semicolon ([bb388d1](https://github.com/vuejs/language-tools/commit/bb388d1b025146f2ef25ba38072b03897af8b37d))
- **perf:** replace `fast-diff` with custom character-by-character alignment algorithm ([704b30a](https://github.com/vuejs/language-tools/commit/704b30a1db9b37acddc801f59717264adc5fd107))
- **refactor:** update Vue grammar scope name to "text.html.vue" ([784dd56](https://github.com/vuejs/language-tools/commit/784dd56026e07f1dadb9ef2498418eccbb3dee29))
- **test:** add test for embedded grammars ([3586b07](https://github.com/vuejs/language-tools/commit/3586b07cd5debb78debfb330ecb8831fbfe54ef8))

### language-service

- **feat:** rich hover message ([a202bc7](https://github.com/vuejs/language-tools/commit/a202bc7e73025fd44f01ae7e820dc015d2040feb))
- **feat:** support markdown JSDoc for rich hover message description ([3417c37](https://github.com/vuejs/language-tools/commit/3417c375c057ea126e61ef3cb081499cf2ca54ff))
- **chore:** adjust rich hover message title layout ([21616fe](https://github.com/vuejs/language-tools/commit/21616fe5eb22effed411e45a4594c35b650368d1))

### component-meta

- **feat:** add `tags` to slots and exposed ([a144b6b](https://github.com/vuejs/language-tools/commit/a144b6b710e8b90c085de3bbfc2e9d6fd1a02ac9))
- **feat:** filter out irrelevant properties from `exposed` ([232665d](https://github.com/vuejs/language-tools/commit/232665dfc0f8efda7b8a46997e953d80afe9a031))
- **refactor:** redundant logic between deduplication and language-core ([3af4903](https://github.com/vuejs/language-tools/commit/3af49035dbb9c229ba54a0c5a8bfa7be42de1111))
- **refactor:** de-dependency from component-type-helpers ([09fce04](https://github.com/vuejs/language-tools/commit/09fce0432283917418e4b2e7e47d36068d29e386))
- **refactor:** search prop defaults with symbol declarations ([bb235b6](https://github.com/vuejs/language-tools/commit/bb235b68f395daba38af7c4c6c8d7b70bdab0707))
- **refactor:** deprecate "noDeclarations" and "forceUseTs" options ([f4979cd](https://github.com/vuejs/language-tools/commit/f4979cde31da84b3a0d4234cf66c0bfe15a04186))

### typescript-plugin

- **feat:** include leading dot when finding references to CSS classes ([660439d](https://github.com/vuejs/language-tools/commit/660439db88b20e9363f08447dc747bda8b2aee74))
- **fix:** missing module error after file rename ([0f16db8](https://github.com/vuejs/language-tools/commit/0f16db8e2a169c666d650cdd8922397f362aa9ff))
- **fix:** prioritize non-warning completion entries over warning ones (#5847) ([7928a2d](https://github.com/vuejs/language-tools/commit/7928a2d66a975d0c8f7329b105b5efca771ac18f))
- **fix:** always pass rest parameters for future compatibility ([6d941b4](https://github.com/vuejs/language-tools/commit/6d941b4f64416b4e07fbb35ef014f53cd4233c31))
- **fix:** add nullish guards before accessing `ts.CompletionEntryData` ([e768518](https://github.com/vuejs/language-tools/commit/e76851828659137e47f303a086620023d3151fc8))
- **fix:** handle import type nodes in definition proxy ([01c1426](https://github.com/vuejs/language-tools/commit/01c1426974d92853b0dfb94bc6b15a66d9a7677a))
- **fix:** handle type imports in component auto-import ([45e994f](https://github.com/vuejs/language-tools/commit/45e994f1f18e8aa62f8dd735bb2d3123d5e9f274))

### language-core

- **feat:** revert overcorrection of `v-for` type inference ([e0fb9e8](https://github.com/vuejs/language-tools/commit/e0fb9e88449344568e5f3c779990ec6ae2ca4f7f))
- **feat:** align `v-for` key type with `Object.keys` ([1159f1e](https://github.com/vuejs/language-tools/commit/1159f1e61ed8a00b61ac9da83fe6ff2c15173d27))
- **feat:** narrow component and directive types ([40dd226](https://github.com/vuejs/language-tools/commit/40dd226e0937ebce2bcc64b8a1f60fe862a9a15a))
- **feat:** support `<!-- @strictTemplates -->` magic comment ([4277ab6](https://github.com/vuejs/language-tools/commit/4277ab6168adaf5bc55dfbffce3cbb176475bb4d))
- **fix:** correctly resolve `<script src="">` ([145ee73](https://github.com/vuejs/language-tools/commit/145ee73bf672570ecf840b486a778e1a41fefb29))
- **fix:** preserve template slot wrappers during `createIfBranch` ([35e2c5a](https://github.com/vuejs/language-tools/commit/35e2c5a16aea4a1393ffd231735013577835fe58))
- **fix:** include end tag locations when renaming global components ([d1e7568](https://github.com/vuejs/language-tools/commit/d1e756804b824cd211fac823bf237df4340dc851))
- **refactor:** replace dynamic types generation with static files ([f498667](https://github.com/vuejs/language-tools/commit/f49866762bb54c46ac3d7319d3f996341c6bc888))
- **refactor:** improve Vue version detection and plugin resolution ([0722817](https://github.com/vuejs/language-tools/commit/07228170cccade8fe3fd9eb205559c87e7b5248a))

### component-type-helpers

- **refactor:** remove `ComponentType` helper ([19a81d4](https://github.com/vuejs/language-tools/commit/19a81d4667b3dbd09b74fdd1d6dc1523bb02f36e))

### workspace

- **chore:** update testing infrastructure ([4fbd087](https://github.com/vuejs/language-tools/commit/4fbd08748f70feb3c4a41fb908c66c88d277fc4e))
- **chore:** use tsgo in development ([0b0dd73](https://github.com/vuejs/language-tools/commit/0b0dd73404f142d75ef3255a22424099ecf46cf6))
- **chore:** reduce local dependencies and update workflows ([47498d1](https://github.com/vuejs/language-tools/commit/47498d1b89786ad9d3111029fd2ee37183d64ddb))
- **chore:** upgrade tsslint and vite to pre-release versions ([78f0ce8](https://github.com/vuejs/language-tools/commit/78f0ce8831716ead60de9551b3f655cb05e0f53f))
- **chore:** delete tests for Vue 3.4 ([27772e5](https://github.com/vuejs/language-tools/commit/27772e52b747e4400b13b885677999c2976b2326))

Contributors: @serkodev, @KazariEX, @aj-dev

## 3.1.8 (2025-12-09)

### language-core

- **fix:** restore default import bindings for template scope ([7d642d1](https://github.com/vuejs/language-tools/commit/7d642d193442d77050edfda6408a37330e36b302))
- **fix:** limit the range of parseDiagnostics checks ([4688357](https://github.com/vuejs/language-tools/commit/4688357a98101d5af148d2822275301f3e623d12))
- **fix:** avoid generating component options within the setup scope ([85c5cf0](https://github.com/vuejs/language-tools/commit/85c5cf092ad9cc3ec1ef3b3f8466ee824632754a))
- **fix:** fault-tolerant complex export expressions ([fe687a6](https://github.com/vuejs/language-tools/commit/fe687a63639a013d7776b2f0922f87a0a012923d))
- **perf:** dedupe component options generation ([b071638](https://github.com/vuejs/language-tools/commit/b0716386da76786c637f36b8391cec3491255ae0))

### language-service

- **feat:** add tsconfig-based document link support for Pug ([283e4f1](https://github.com/vuejs/language-tools/commit/283e4f10137439bd03df289bf1f20067cf969960))

### typescript-plugin

- **fix:** get `preferences` and `formatOptions` in tsserver ([8b9d74c](https://github.com/vuejs/language-tools/commit/8b9d74cab507a4781d3e61459f5f44b701eebf32))

### vscode

- **feat:** support formatting with a selected range ([f1a6b52](https://github.com/vuejs/language-tools/commit/f1a6b52b99a654eb3783bf137ac2205e42ec0f62))
- **feat:** support multiline attribute for `<script>` and `<style>` tags ([3a84ff6](https://github.com/vuejs/language-tools/commit/3a84ff602e336316e11f4e83abfaa9d7ef909ff6))

Contributors: @serkodev

## 3.1.7 (2025-12-08)

### language-core

- **feat:** cache virtual code by `scriptId` ([b05c012](https://github.com/vuejs/language-tools/commit/b05c0123fb3525622103db826bad5ca3177b2a9a))
- **fix:** avoid invalid `__VLS_Slots` generation and generate the script separator on demand ([9608709](https://github.com/vuejs/language-tools/commit/9608709b12e5a67b8c2457d75705b0eaddd03fb4)) ([c65e5a5](https://github.com/vuejs/language-tools/commit/c65e5a5bf3b47a401b2129ad5451998d691b4a66))
- **fix:** avoid using the `Identifier.text` property ([4a947ef](https://github.com/vuejs/language-tools/commit/4a947ef450df169287142364f85727177ed242e6))

### lint

- **feat:** add typescript services types lint rule ([d245142](https://github.com/vuejs/language-tools/commit/d245142725c97a13d49fd4435ed56ab1d3e48245))

Contributors: @serkodev

## 3.1.6 (2025-12-06)

### language-core

- **fix:** `Prettify<T>` caused generic props to be inferred as `unknown` ([adeba0a](https://github.com/vuejs/language-tools/commit/adeba0a746f3fa5a058733388a563dff754394b4))
- **fix:** infer the `$el` type for generic components using `inferComponentDollarEl` ([54a19d4](https://github.com/vuejs/language-tools/commit/54a19d46f12e93bf1fc55b6c2a98a9ce5794dd15))
- **fix:** ensure `<script>` content generates before `<script setup>`, and generate `__VLS_TypePropsToOption` on demand ([15c3005](https://github.com/vuejs/language-tools/commit/15c30055f14736f7e664dff9d59a2f6f1a26e823)) ([2f2352d](https://github.com/vuejs/language-tools/commit/2f2352db84effb998b26636c7010e20342efa117))
- **fix:** support `v-bind="$attrs"` navigation when `inferTemplateDollarAttrs` is disabled ([d747456](https://github.com/vuejs/language-tools/commit/d7474566e8f1c4edd49023c634e638c280b57433))
- **fix:** generate `{}` instead of its string value for `style="..."` ([97c239d](https://github.com/vuejs/language-tools/commit/97c239dd757289b5481f35d5aecd4179d311ca7b))
- **fix:** completion for the second scoped class name ([9fc27c5](https://github.com/vuejs/language-tools/commit/9fc27c5b56d9cf3e6abf4d74030564c7bd9c98ff))
- **fix:** remove the `bypassDefineComponent` hack for better JS support ([14f63fd](https://github.com/vuejs/language-tools/commit/14f63fda91b176ee855f2be3e3b7df73f4689e0d))
- **fix:** add compatibility for the `vapor` attr ([b2ebfe0](https://github.com/vuejs/language-tools/commit/b2ebfe0834631603792fa797c02da3ccd18d1929))
- **fix:** ensure type consistency for optional boolean props ([b2ca816](https://github.com/vuejs/language-tools/commit/b2ca816fb9442daa795ab9dd37fe0322b54e5bba))
- **fix:** AST fault tolerance for key binding on template, and correct inheritance of combine tokens ([9f3d8cc](https://github.com/vuejs/language-tools/commit/9f3d8cc0cf2c795782eb0ea4a28742a12d4f1151)) ([97e5d01](https://github.com/vuejs/language-tools/commit/97e5d01507606071937b884110bf0e39d345574b))
- **refactor:** normalize the template AST, split style codegen and trim codegen options ([147c69a](https://github.com/vuejs/language-tools/commit/147c69accba237e26950d0c94d14be90e09a4253)) ([343743f](https://github.com/vuejs/language-tools/commit/343743f475a44e0cba88abdd3412d9a74a866690)) ([f4a9c50](https://github.com/vuejs/language-tools/commit/f4a9c507b317c9fc4b710b28ba152a5029851235))
- **refactor:** remove legacy template ref navigation support and the `__VLS_unref` helper ([748a658](https://github.com/vuejs/language-tools/commit/748a658e68ed0cb20ffa525f8df13adcc8984d9f)) ([05dd36a](https://github.com/vuejs/language-tools/commit/05dd36a617fbe1699d58371018aefb7d915878d1))

### component-meta

- **feat:** add component name and description fields ([a1b8b71](https://github.com/vuejs/language-tools/commit/a1b8b71e49befbb928ea340f9e20a2eee349fbc6))
- **refactor:** deprecate the `rawType` and `__internal__.tsLs` fields ([487dc29](https://github.com/vuejs/language-tools/commit/487dc29ec82923676bb028f933e8e5f919fa5e2a))

### language-service

- **feat:** enhanced component auto import ([15cc24e](https://github.com/vuejs/language-tools/commit/15cc24e74a70f11897605633320edfd48223e1ae))
- **fix:** format components with HTML void-element names ([52e3d5e](https://github.com/vuejs/language-tools/commit/52e3d5ecc1c71ce790d357466da52ba7315b5bf4))
- **fix:** properly handle the promise when resolving CSS links ([07db66a](https://github.com/vuejs/language-tools/commit/07db66a23f57842622c21b55972cacfeb071d0c3))
- **fix:** skip `const props =` completion in StringLiteral ([4a16e57](https://github.com/vuejs/language-tools/commit/4a16e575015446f7ba67f82266827771d417ec24))

### typescript-plugin

- **feat:** map JSDoc information from `<script setup>` ([732cb86](https://github.com/vuejs/language-tools/commit/732cb8673acb3d9c487ef74b20f77b6e9e26c67a))
- **feat:** add support for the template "Add Import" quick fix ([b8503cd](https://github.com/vuejs/language-tools/commit/b8503cdb0b922427caf7e0ff874d6e956f57a12e))
- **fix:** add nullish guards before accessing `ts.CompletionEntryData` ([e768518](https://github.com/vuejs/language-tools/commit/e76851828659137e47f303a086620023d3151fc8))
- **fix:** resolve the component type without `__VLS_components` ([b6254ec](https://github.com/vuejs/language-tools/commit/b6254ec47c617b498e4033b6d372c7081f04dfaa))

### vscode

- **feat:** add settings to enable per-block formatting ([56ae259](https://github.com/vuejs/language-tools/commit/56ae259dbf4c3d1dd07cf73097b06363114d50bb))
- **feat:** support the tsdk path for Eclipse Theia ([5bf90db](https://github.com/vuejs/language-tools/commit/5bf90db643405c942042d3c03ec3db97d443c6b3))
- **fix:** patch `isTypeScriptDocument` for VSCode ([0c80460](https://github.com/vuejs/language-tools/commit/0c804608fbf264db9f09ef8d60d188a91bd1b78c))
- **fix:** handle a leading `<` as an operator in SFC scripts ([1ab9928](https://github.com/vuejs/language-tools/commit/1ab99281bd1057e96cb5134971aa76341f44f362))

Contributors: @serkodev, @KazariEX, @AlexVagrant, @so1ve

## 3.1.5 (2025-11-23)

### language-core

- **fix:** `defineModel` for generic component types ([5d841f4](https://github.com/vuejs/language-tools/commit/5d841f4209fef36314f77e2cd057fafd57cce02a))
- **fix:** avoid a `vue-tsc` crash during single file checks ([11a448c](https://github.com/vuejs/language-tools/commit/11a448c419e4dcacf7d7263c78d72029202eb190))
- **fix:** dispose virtual code correctly ([060e8fa](https://github.com/vuejs/language-tools/commit/060e8fa89d378fc90fa731ff61be3b820fac4be5))
- **fix:** get updated template content from the correct source, and dedupe single root element types ([b38301d](https://github.com/vuejs/language-tools/commit/b38301d6250a4dfa114d52747b0c80129f03ed0d)) ([45557c9](https://github.com/vuejs/language-tools/commit/45557c9b63cf9d6184025fa8b63da1fc70527797))
- **fix:** do not generate variable accesses for template refs used in `v-bind` shorthand, and remove special codegen logic for the `style` attribute ([26b464f](https://github.com/vuejs/language-tools/commit/26b464f1c0e3439b367246d3ec9c793cb59cda0e)) ([41f1ffc](https://github.com/vuejs/language-tools/commit/41f1ffcd2f090aef6addd0c4955d629f0b9514ac))
- **perf:** skip unnecessary runtime codegen steps ([4a9932c](https://github.com/vuejs/language-tools/commit/4a9932c531cec8c23b7d5d1e6f24bbb113b838b5))

### language-server

- **feat:** add `serverInfo` to the initialized result ([0b8a880](https://github.com/vuejs/language-tools/commit/0b8a8803d56a5c18f224590efa15e8319b5f3ea2))

### language-service

- **feat:** support tsconfig path alias resolution for document links ([d007a9c](https://github.com/vuejs/language-tools/commit/d007a9c98826348ff8b7d45fd4a40d3505b1e3de))

### vscode

- **fix:** correct highlighting of tags starting with `template` ([d937a84](https://github.com/vuejs/language-tools/commit/d937a84e41bdf3b64b6f0330dc2ddf1e3240c09d))

Contributors: @KazariEX, @serkodev, @kada49

## 3.1.4 (2025-11-16)

### language-core

- **fix:** report the unused `@vue-expect-error` directive on components with loose props checks, including in `v-else` branches ([6646704](https://github.com/vuejs/language-tools/commit/66467047ab3fe652140e24200e20cdbc9659b7b4)) ([f66d3d1](https://github.com/vuejs/language-tools/commit/f66d3d18f5d2fd7feab8ec0338254c146c17ee93))
- **fix:** respect directive comments before `v-else` ([2abec30](https://github.com/vuejs/language-tools/commit/2abec30f3a0d75a6ddda10537320f9f9d5bd1898))
- **refactor:** re-implement component references by codegen ([6ccf06c](https://github.com/vuejs/language-tools/commit/6ccf06c58bae28cf94d7ba77c484e1ed8160d90c))

### language-service

- **fix:** prevent auto-insertion of html snippets in template interpolation, and correct the HTMLDocument structure ([4a89b6e](https://github.com/vuejs/language-tools/commit/4a89b6e8e9ad0951e18fa083a3de3f0fb31f3236)) ([66b6332](https://github.com/vuejs/language-tools/commit/66b633206c3314e235a39c8819f7418c86362372))

Contributors: @serkodev, @KazariEX

## 3.1.3 (2025-11-03)

### language-core

- **refactor:** generate `__VLS_elements` into global types and rename it to `__VLS_intrinsics` ([9a2857e](https://github.com/vuejs/language-tools/commit/9a2857e63430f2f50c0744fd2efc5ab715701f2f)) ([50a00f6](https://github.com/vuejs/language-tools/commit/50a00f678cfd69af2c03d5d9361013b9e28aeebb))

### typescript-plugin

- **feat:** allow triggering file references on `<template>` ([1e7fe05](https://github.com/vuejs/language-tools/commit/1e7fe05f6bdce74740b916a47975e8cce519cc75))
- **refactor:** remove the go to definition trick for auto imported components ([71115fb](https://github.com/vuejs/language-tools/commit/71115fbed08db8b294295733ffdf7549ee2cc0aa))

### vscode

- **fix:** correct syntax highlight in templates with `lang="html"` ([84f0aa5](https://github.com/vuejs/language-tools/commit/84f0aa558d6f45995fd00a47d45632fac84a3a2e))

Contributors: @KazariEX, @serkodev, @so1ve

## 3.1.2 (2025-10-25)

### language-core

- **fix:** fix a syntax error when `propTypes` has no elements ([426f8d5](https://github.com/vuejs/language-tools/commit/426f8d54c9aa36c4397f6cbe0c89f2077bd4a4ff))
- **fix:** omit defined emit props only ([d45228a](https://github.com/vuejs/language-tools/commit/d45228a288341bf2d7174e93c84955626a1c9850))

### component-meta

- **fix:** import type helpers by relative path ([8697068](https://github.com/vuejs/language-tools/commit/86970687ba78e8ac78325810640bc33a23687680))

### docs

- **docs:** fix the `vue-tsc` broken link to the example boilerplate in `README.md` ([fd05a1c](https://github.com/vuejs/language-tools/commit/fd05a1c92c9af63e6af1eab926084efddf7c46c3))

Contributors: @KazariEX, @so1ve, @heyakyra

## 3.1.1 (2025-10-07)

### language-core

- **fix:** use component instance props as fallthrough attributes ([dbe8b53](https://github.com/vuejs/language-tools/commit/dbe8b537c55a17ed5e44ce04a255791eff89ea73))
- **fix:** tolerate non-literal export default ([5080fd9](https://github.com/vuejs/language-tools/commit/5080fd9d425f0e6f6145cac7eb690e5bec6169ca))
- **fix:** exclude the effect of comments on the root node ([a7e820a](https://github.com/vuejs/language-tools/commit/a7e820ab4eac1c3d069215688114511ec9813359))
- **fix:** do not report the unused error on `__VLS_export`, and replace markdown links after SFC block processing ([52a6fc4](https://github.com/vuejs/language-tools/commit/52a6fc466b8057cab0c223431b5ec0ca036dfee7)) ([9835ea7](https://github.com/vuejs/language-tools/commit/9835ea78a7418c58229bc8dc011f2ace0c4209e0))
- **refactor:** reimplement `writeGlobalTypes` without side effects ([335eca3](https://github.com/vuejs/language-tools/commit/335eca3911c5ca1c76803cf5a2380c06ef71389a)) ([c99b0ab](https://github.com/vuejs/language-tools/commit/c99b0ab2f540b60d5a1027466a09d43699ad0ee2))

### language-server

- **feat:** support the `--tsdk` command line arg ([77430b1](https://github.com/vuejs/language-tools/commit/77430b1795f9e49e7d66a11acdb58be2eb5cd993))

### typescript-plugin

- **fix:** determine if a variable is `Ref` by the `RefSymbol` property ([49aa565](https://github.com/vuejs/language-tools/commit/49aa565410cc46df4721b14daa152be53741c7be))
- **fix:** place `__vue__` in the project instead of the program ([7a75463](https://github.com/vuejs/language-tools/commit/7a75463eb78ade79580b83bf82015c79364ac887))

### component-type-helpers

- **fix:** remove deprecated `$scopedSlots` support for Vue 2 ([7f65ebb](https://github.com/vuejs/language-tools/commit/7f65ebb9aac07196e4845652612dd035513afe94))

Contributors: @KazariEX

## 3.1.0 (2025-09-28)

### workspace

- **refactor:** drop Vue 2 support ([aaa1c68](https://github.com/vuejs/language-tools/commit/aaa1c68eab41b53a62a11767c7a290ac84e61626))

### language-core

- **perf:** drop internal components ([39eb65c](https://github.com/vuejs/language-tools/commit/39eb65cedde0d6170df8e8e27093074454614e5a))

### typescript-plugin

- **refactor:** move reactivity analysis logic to a separate typescript plugin ([9066601](https://github.com/vuejs/language-tools/commit/9066601e9ff166796389f1624ce44410f1df7ea9))

### vscode

- **feat:** update the welcome page ([e20d0c5](https://github.com/vuejs/language-tools/commit/e20d0c5fa1f25bfa6a2da21fa7f60d6d9bc0be65))
- **feat:** enhance custom Vue server path handling with user feedback ([507377c](https://github.com/vuejs/language-tools/commit/507377cee8ee2fa19982d321402d697ba74b5088))

Contributors: @KazariEX, @so1ve

## 3.0.10 (2025-10-25)

### Bug Fixes

- fix(typescript-plugin): place `__vue__` in project instead of program ([7a75463](https://github.com/vuejs/language-tools/commit/7a75463eb78ade79580b83bf82015c79364ac887))

## 3.0.9 (2025-10-07)

### Features

- feat(language-server): support `--tsdk` command line arg ([77430b1](https://github.com/vuejs/language-tools/commit/77430b1795f9e49e7d66a11acdb58be2eb5cd993))

## 3.0.8 (2025-09-23)

### language-core

- **fix:** initialize the properties of `VueVirtualCode` in the constructor ([9bfbfcc](https://github.com/vuejs/language-tools/commit/9bfbfcc650f1150bb238a9c2eeb9348f33b021b3))

### language-service

- **fix:** do not provide semantic tokens and document highlights for non-`file` scheme files ([f7bdeaa](https://github.com/vuejs/language-tools/commit/f7bdeaa7bb476df1fc8ff46c504d75c1869b0be9))

### typescript-plugin

- **perf:** redo the single-file language service for Reactivity Visualization ([3bfd059](https://github.com/vuejs/language-tools/commit/3bfd059f5c3dadb2b25e1a82f52480e9d74f97bb))
- **fix:** ensure the TS node corresponds to the mapping range ([7051894](https://github.com/vuejs/language-tools/commit/7051894571ccbe6430d67c6f16c4ce2377f4cd67))
- **refactor:** externalize the reactivity analysis logic ([cb6eef1](https://github.com/vuejs/language-tools/commit/cb6eef1e66e85b4b4c99a3d44d152bc1b2bba5b1))

### vscode

- **feat:** introduce the `vue.server.path` setting ([b274db2](https://github.com/vuejs/language-tools/commit/b274db264c1083275c5c04958292f406838a71eb))
- **fix:** patch `typescriptServerPlugin` languages without an FS hack ([a40c6d8](https://github.com/vuejs/language-tools/commit/a40c6d8c0ba7b2ae5fcf774098eda11242a49995))
- **fix:** normalize Reactivity Visualization ranges and flatten its decorators ([bd201b2](https://github.com/vuejs/language-tools/commit/bd201b2b98affb45ee0dac4f7864d586b59855ab)) ([ce82fac](https://github.com/vuejs/language-tools/commit/ce82facfcea64e0eb538f1276bdd6bc7a9fd5dcc))
- **feat:** adjust the reactivity visualization update interval ([743785b](https://github.com/vuejs/language-tools/commit/743785b55dd33e7a070d0aa9fe725c497bb867c6))

Contributors: @KazariEX

## 3.0.7 (2025-09-12)

### language-core

- **fix:** do not generate variables for builtin directives ([dfa4128](https://github.com/vuejs/language-tools/commit/dfa4128731a28009cee25f179ee3b991569e2c0a))
- **fix:** generate slot parameters in the same way as interpolation ([15f6feb](https://github.com/vuejs/language-tools/commit/15f6feb408ab01b23518d9dcfa891a1c1be2b5fb))
- **refactor:** transform template code features internally ([740fd20](https://github.com/vuejs/language-tools/commit/740fd20b2c90403f2aab133ca52aed532c8c0867))

### language-server

- **refactor:** reimplement Reactivity Visualization in the typescript plugin, and parse interpolations in the extension client ([b8cb0ac](https://github.com/vuejs/language-tools/commit/b8cb0ac472a17ce144cd22b6350a471b3061b764)) ([e6cf377](https://github.com/vuejs/language-tools/commit/e6cf37796e5b6add79e26e2c3c6b897061676a26))

### typescript-plugin

- **fix:** improve session handling and type safety in protocol handlers ([b96aa7c](https://github.com/vuejs/language-tools/commit/b96aa7c2c4653551bad198ba058fdd2b541434b2))
- **fix:** enable `responseRequired` in custom requests ([72a400e](https://github.com/vuejs/language-tools/commit/72a400ea3482519b5af98605a3d51d80eb7dfbb8))

### vscode

- **fix:** show the welcome page only when opening a Vue file ([3bcdd35](https://github.com/vuejs/language-tools/commit/3bcdd35d35fa91476483d258c5b7c0dfabc7d098))
- **refactor:** reimplement Focus Mode based on folding ranges ([541e112](https://github.com/vuejs/language-tools/commit/541e11204dc3058694bd82b6dc657a6177d4ecc7))
- **refactor:** set the delay of reactivity visualization updates to 250ms ([d56d7d6](https://github.com/vuejs/language-tools/commit/d56d7d6e3e29cb256fcb0bbdc57c3bc62abbd9f5))

Contributors: @KazariEX

## 3.0.6 (2025-08-20)

### language-core

- **fix:** wrap the `:class` expression with parens ([bfdbaf0](https://github.com/vuejs/language-tools/commit/bfdbaf0cd62b87298292408a2f8f45b5e780366b))
- **fix:** do not look for input files during evaluation of `vueCompilerOptions` ([b3a39de](https://github.com/vuejs/language-tools/commit/b3a39de86d46d96dc35e8b0e6f2049724b041c7a))
- **fix:** remove the non-strict `configFileName` default value ([56f1267](https://github.com/vuejs/language-tools/commit/56f12671bf617f6994218d5c9165efbf9610f11f))
- **refactor:** generate setup returns on demand ([882abc0](https://github.com/vuejs/language-tools/commit/882abc0726192574bf45f5b088820782b4d09206))

### language-service

- **fix:** skip document highlight from tsserver within element tags ([0154301](https://github.com/vuejs/language-tools/commit/015430124044c9667aa851ac30d10a213254f74b))

### component-meta

- **fix:** re-export `vue-component-type-helpers` to `lib/helpers` ([c211f3e](https://github.com/vuejs/language-tools/commit/c211f3e5da2fb8ffcca1d48de282d34810b31d0a))

### vscode

- **fix:** improve reliability of handling extension activation contention ([c742a1c](https://github.com/vuejs/language-tools/commit/c742a1c8d29365c7b103ba22716aa8c4a5980537))
- **fix:** revert Vue 2 versions in the `target` option ([b6aad73](https://github.com/vuejs/language-tools/commit/b6aad733315b4d86f6c6378dbc49448fe8e2a44d))
- **refactor:** remove the custom LanguageClient implementation ([abf45c4](https://github.com/vuejs/language-tools/commit/abf45c47c3b76ca37ce3468e567c384f57932d36))

### lint

- **feat:** enable the `eqeqeq` rule ([4488f64](https://github.com/vuejs/language-tools/commit/4488f64f1e5ffc3858fe216677161b3adb26361c))

Contributors: @KazariEX, @gxres042, @kingyue737, @unsplusmn

## 3.0.5 (2025-08-01)

### language-core

- **feat:** introduce `compileSFCStyle` to provide style related information ([4718cc2](https://github.com/vuejs/language-tools/commit/4718cc2ff30410bd7267850047fbdd3eeebc8626))
- **fix:** generate `modelModifiers` for an explicitly declared default model name ([0e0ffd9](https://github.com/vuejs/language-tools/commit/0e0ffd974b6642fe74e6ac634999941b9757031c))
- **fix:** remove local variable addition for the model `$event`, and simplify event codegen ([eea37a7](https://github.com/vuejs/language-tools/commit/eea37a7099c7b11e9fc7208d23d6e9863448df99)) ([12b863e](https://github.com/vuejs/language-tools/commit/12b863eee366db8e1f72db8c0af985d481e2cbf1))
- **fix:** enable the navigation code feature on directive modifiers ([0ceba6e](https://github.com/vuejs/language-tools/commit/0ceba6ec40aee6581f6c828513d388d5970ebf0b))
- **fix:** tolerance for an incomplete root template tag ([aa3531f](https://github.com/vuejs/language-tools/commit/aa3531f6e619e253b17592694b0ef5b9f765f229))
- **fix:** avoid references highlight of unrelated native element tags ([64f5da2](https://github.com/vuejs/language-tools/commit/64f5da224ca4681330ae0af40edfa8e7aa9aa54a))

### language-service

- **feat:** completion snippet for `v-for` ([5084123](https://github.com/vuejs/language-tools/commit/50841239eb0e2e44d35df43c363f4f8f1c467062))
- **fix:** more responsive `.value` insertion ([3e6393b](https://github.com/vuejs/language-tools/commit/3e6393b7ecce6f3307b1872e6a6aad5ec555017d))
- **fix:** only check `globalTypesPath` for FS files ([d407159](https://github.com/vuejs/language-tools/commit/d407159442b42bc3021b58834f829a83de3c571a))

### typescript-plugin

- **fix:** ensure all requests do not return void ([a2b2bb3](https://github.com/vuejs/language-tools/commit/a2b2bb36cd892c6db215234ade856195fd8f736b))

### vscode

- **fix:** handle fail tsserver requests to avoid a memory leak ([e3aa6d1](https://github.com/vuejs/language-tools/commit/e3aa6d1dd50bf8fa22fc765aa2a7ffe841254934))
- **fix:** make sure the extension is loaded immediately ([d80cfee](https://github.com/vuejs/language-tools/commit/d80cfee142fda34772286c1e4b7c35d92e9e7b38))
- **fix:** do not delay the execution of `restartExtensionHost` ([fba08b3](https://github.com/vuejs/language-tools/commit/fba08b394c33295699b0ac01cd4d45d344824a6c))
- **fix:** add `class` scope fallback for `component` semantic tokens ([dff519a](https://github.com/vuejs/language-tools/commit/dff519af4505d9935cbba80fe3ba5234571e23fa))

Contributors: @KazariEX, @unsplusmn

## 3.0.4 (2025-07-25)

### language-core

- **fix:** avoid clearing the global types path when local compiler options are present ([78fcfdd](https://github.com/vuejs/language-tools/commit/78fcfdd42827f95ccfb8e32e2a340a855c3843c6))
- **fix:** do not evaluate `skipTemplateCodegen` when exposing `$slots` ([7953154](https://github.com/vuejs/language-tools/commit/7953154cbd48624fd9cb2a6420e7c4b053d57da7))

### language-service

- **feat:** native completion experience for slot names ([2435873](https://github.com/vuejs/language-tools/commit/2435873dc4c09fbf5394d96c083b2c2d18ecd8b6))
- **feat:** check casing when dropping a component into the template ([2d41b9d](https://github.com/vuejs/language-tools/commit/2d41b9d5c1ec20955fbb8384cc689e6c6edefd56))
- **fix:** correct kind and order of component completion items ([7b55e64](https://github.com/vuejs/language-tools/commit/7b55e644815ed9a0a97377b7b3b58cd74f43fb03))

### component-meta

- **fix:** filter events out of props ([c964b32](https://github.com/vuejs/language-tools/commit/c964b327c4215ead6f18e4dfaddc5e12ab90e91e))

Contributors: @KazariEX, @Akryum

## 3.0.3 (2025-07-18)

### language-core

- **fix:** do not spread the exposed object ([945a6cd](https://github.com/vuejs/language-tools/commit/945a6cd90266499d924f81cfa8826299a4ff7905))
- **fix:** find `node_modules` based on the file's directory ([4df0f6a](https://github.com/vuejs/language-tools/commit/4df0f6aa57981d224a4ebd4d26bc97fb00a47a01))

### vscode

- **fix:** prompt manual reload in remote envs ([5023ecf](https://github.com/vuejs/language-tools/commit/5023ecf6547fa9cbb692170dfc48c0c32103ea4d))

### tsc

- **refactor:** return the result of `runTsc` ([e1095ed](https://github.com/vuejs/language-tools/commit/e1095ed38b8a67f2b58229f16f48ebf4c99b1eee))

Contributors: @KazariEX, @escaton

## 3.0.2 (2025-07-18)

### language-core

- **feat:** introduce the `globalTypesPath` option for non-npm like environments ([9ad6714](https://github.com/vuejs/language-tools/commit/9ad6714a8be8fca0040947ffb970fffe3dba482f))
- **fix:** walk identifiers correctly within type nodes in interpolation ([ae5f778](https://github.com/vuejs/language-tools/commit/ae5f7784c09544b6b00d0198927374e0ec44746d))
- **fix:** infer the parameter type of union slots to be a union instead of an intersection ([abb5f2b](https://github.com/vuejs/language-tools/commit/abb5f2b6c4be384d1fef0e874a128500d2024d8e))
- **fix:** treat `<component>` without an `is` prop as a normal component ([028f573](https://github.com/vuejs/language-tools/commit/028f5731fe0c6ae74f50d3eab42a50718f8f0148))
- **fix:** avoid early access to local types to skip unnecessary type generation ([c022037](https://github.com/vuejs/language-tools/commit/c02203757beb808b860418de1ac96ae6a6e7bacc))
- **fix:** only keep the navigation code feature on a static `name` value of `<slot>` ([ed487f6](https://github.com/vuejs/language-tools/commit/ed487f67e233eaa354f7c22ec43dffb0f035d745))
- **fix:** generate a placeholder comment instead of a fake reference, and avoid a redundant increment of block variable depth ([9f0aaee](https://github.com/vuejs/language-tools/commit/9f0aaee3ae06790e195e6e919f089c97b813b396)) ([08269b1](https://github.com/vuejs/language-tools/commit/08269b17dd3df78b2ed5ebf2979c6e98793ca63b))
- **fix:** do not set the template lang to `md` for markdown ([0d5c7eb](https://github.com/vuejs/language-tools/commit/0d5c7eb3d62c437fa84f44aeaa5bc49f8e26b7bd))
- **revert:** type support of slot children ([259eea1](https://github.com/vuejs/language-tools/commit/259eea169839ab6cf7bb0895d276f5151f04343d))

### language-server

- **feat:** forward tsserver's semantic tokens via the language server ([0e917c6](https://github.com/vuejs/language-tools/commit/0e917c601bddfa748be072f409a4c37cbe6985ab))
- **fix:** find the closest dependency handler as effect ([559c51e](https://github.com/vuejs/language-tools/commit/559c51e43acfeb277b53d92cf68b0fb0b4a9e87b))
- **fix:** add `allowJs` to the reactivity analyze host ([5ee3ef6](https://github.com/vuejs/language-tools/commit/5ee3ef66ad6e9b3bea4049eedf755291da4522ea))

### language-service

- **fix:** re-implement twoslash queries in script, and correct their position calculation ([0ee2d15](https://github.com/vuejs/language-tools/commit/0ee2d1552243174fade1b8af04fb33d1332386d0)) ([9ab8556](https://github.com/vuejs/language-tools/commit/9ab855601f6ab12150f39d3459a938c330fe1015))

### typescript-plugin

- **fix:** exclude items of kind `module` from template completion ([7462fa9](https://github.com/vuejs/language-tools/commit/7462fa9b582d25845ccb9ce17a048d2711e9165a))

### vscode

- **fix:** correct syntax highlight of control directives ending with `/` or `)` ([68d98dc](https://github.com/vuejs/language-tools/commit/68d98dc57f8486c2946ae28dc86bf8e91d45da4d))
- **fix:** remove the `colorizedBracketPairs` config for plaintext ([3000a93](https://github.com/vuejs/language-tools/commit/3000a931f204fc392def6ecd520ecf93c52a5cf8))
- **fix:** make sure tsserver loads `@vue/typescript-plugin` last ([34b5dd2](https://github.com/vuejs/language-tools/commit/34b5dd24c42cc269af81a0ce0a61cda9d43f7bfe))
- **fix:** use the original webview panel api instead of `useWebviewPanel` ([5b47f4f](https://github.com/vuejs/language-tools/commit/5b47f4f57332eade40e575e4ba537855a757f3fb))
- **refactor:** make welcome page code public and add premium feature settings ([32f91d4](https://github.com/vuejs/language-tools/commit/32f91d4fe712a042bed7d6f9aa1e41badf8db0c4)) ([d91bc24](https://github.com/vuejs/language-tools/commit/d91bc24b910f01be3d96e9255939033516116e66))

Contributors: @KazariEX

## 3.0.1 (2025-07-02)

### Bug Fixes

- fix(language-core): remove the calculation logic of element inner loc ([74c9c85](https://github.com/vuejs/language-tools/commit/74c9c850cc864daaf79635382ff3c07c04855c89))
- fix(vscode): correct syntax highlight of `v-else` ([2536006](https://github.com/vuejs/language-tools/commit/25360064e2ff29a41824c7d0d233f5e3ea805695))

### Other Changes

- docs(vscode): update Russian translation for the VS Code extension ([b809045](https://github.com/vuejs/language-tools/commit/b809045c97869d5e3d60ed323b3fa4020224acb4))
- chore: update volar to 2.4.17 ([8540bef](https://github.com/vuejs/language-tools/commit/8540bef1cf8b8ad16dc94c02e2142b9e520a1633))

Contributors: @KazariEX, @AndreyYolkin

## 3.0.0 (2025-07-01)

### Features

- feat(vscode, language-server, typescript-plugin): communicate with tsserver based on request forwarding ([691715f](https://github.com/vuejs/language-tools/commit/691715f2eb820092d799c1f923200692e5c2e36d))
- feat(language-core): introduce the `strictVModel`, `strictCssModules` and `globalTypesPath` options ([1b74d13](https://github.com/vuejs/language-tools/commit/1b74d13a99be77da2cc9ca7027328ac9ab20a4cb)) ([48b7d52](https://github.com/vuejs/language-tools/commit/48b7d52726910f865ca8cb7680e850af592412b8))
- feat(language-core): resolve external stylesheets ([0f2e0b8](https://github.com/vuejs/language-tools/commit/0f2e0b82fca2d6fff95f8f57b81d9cd49109d040))
- feat(language-core): support navigation of events with `v-on` syntax, and document links for template refs ([638b949](https://github.com/vuejs/language-tools/commit/638b9495a4a1e0f6cbc8daf2ef0862689cde99e0)) ([7c2618e](https://github.com/vuejs/language-tools/commit/7c2618eaba6372956da06dc80502030c440c4dc5))
- feat(language-core): type support of slot children ([4bde3e1](https://github.com/vuejs/language-tools/commit/4bde3e1c074e8df5b856aa34d55bf62a20136dcf))
- feat(language-service): autocomplete for props with union type ([9df70b9](https://github.com/vuejs/language-tools/commit/9df70b9fcf67736bc5c530f45a97428fc10ae986))
- feat(component-type-helpers): add the `ComponentAttrs` type for attribute extraction ([221c641](https://github.com/vuejs/language-tools/commit/221c641f61ae09a8bb18ab7c595872045f6f4dc0))
- feat(vscode): add support for the `typescript.sortImports` and `typescript.removeUnusedImports` commands ([59f8126](https://github.com/vuejs/language-tools/commit/59f812654d3c921356179006c6027aefe99596da))
- feat(vscode): i18n support of configurations and commands with `zh-CN`, `zh-TW`, `ru` and `ja` ([cecf83c](https://github.com/vuejs/language-tools/commit/cecf83c70b9e37f66fa623c8e34b53e716abecfb))
- feat(typescript-plugin): skip declaration files in goto component definition ([a7ac323](https://github.com/vuejs/language-tools/commit/a7ac3237d8efddf8a7de1f661eef107e594a7cc0))

### Bug Fixes

- fix(language-core): correct type inference and codegen for template expressions, refs, slots, models and props ([d782f70](https://github.com/vuejs/language-tools/commit/d782f7099f58a1368c2918c4383be2a939982ab0)) ([3055a38](https://github.com/vuejs/language-tools/commit/3055a38828b398533342faec6edcf1e71704dfc8)) ([f568869](https://github.com/vuejs/language-tools/commit/f5688693ef529d75a2c80bf8330b3e7c77593f5e)) ([ca80050](https://github.com/vuejs/language-tools/commit/ca800506da46360c8c16fae219e4079172fcd398)) ([a7b5649](https://github.com/vuejs/language-tools/commit/a7b5649ab4957cd2228f4bbc9205b2008bff58a2))
- fix(language-core): correct codegen for auto imports, `src` paths and `useCssModule`/`useTemplateRef` code features ([59be4fd](https://github.com/vuejs/language-tools/commit/59be4fd2a801b8130bfb8b4a5e0496ba88b6fd3f)) ([32c3f28](https://github.com/vuejs/language-tools/commit/32c3f28bfac3ae8604a7bcebabb33eab40d2a5b6)) ([28308b4](https://github.com/vuejs/language-tools/commit/28308b4f76cc80c7632f39ae7e0944f1889661a2)) ([9b750ed](https://github.com/vuejs/language-tools/commit/9b750ed477a5d946cfdb43fe602d7e5ecb71f726))
- fix(language-core): avoid unrelated virtual code recomputes on style and template change, and cache inline TS ASTs during full updates ([882928a](https://github.com/vuejs/language-tools/commit/882928a2f026303c11164aa09d41fa239101347b)) ([073a7cb](https://github.com/vuejs/language-tools/commit/073a7cb3bb823479ae5e9bff52850f529714571d)) ([a1580f6](https://github.com/vuejs/language-tools/commit/a1580f64dc171251d9789315526d2945500d0e9f))
- fix(language-core): prevent global types generation in declaration files and eager inference of slot props from generics ([03a6d52](https://github.com/vuejs/language-tools/commit/03a6d52eefe0846b65a1b050d4425a0e229daa6d)) ([860ffca](https://github.com/vuejs/language-tools/commit/860ffca1ba0d049b79d2d3ee9732b4b9d30aef37))
- fix(language-core): improve fault tolerance for unsupported script languages and flatten plugins ([58f1cda](https://github.com/vuejs/language-tools/commit/58f1cdaeff34d4e40d19aa8440c86ee24fca6dc5)) ([67532b1](https://github.com/vuejs/language-tools/commit/67532b14460b7d67de1815e2e6a58891a3d71012))
- fix(language-core): hoist export declarations from generic script blocks, and use `var` for the hoisted `attrsVar` ([1d5883e](https://github.com/vuejs/language-tools/commit/1d5883e012b27c2e527e8743964fef5f903f33de)) ([9602589](https://github.com/vuejs/language-tools/commit/960258902156e6cdac885143ef61e5ceffdae481))
- fix(language-core): drop `undefined` from optional prop types with default in templates and `Prettify<T>` generic inferencing ([7c53715](https://github.com/vuejs/language-tools/commit/7c5371548279b126a5d003cd0b6bc7bb296367c5))
- fix(language-service): do not provide required props inlay hints for intrinsic elements, and exclude `data-` attribute completion from SFC level nodes ([1b25cb6](https://github.com/vuejs/language-tools/commit/1b25cb6047ff113916486907ea446de44639aa40)) ([c23b332](https://github.com/vuejs/language-tools/commit/c23b332136807060260e5db45b054c8363a2755b))
- fix(typescript-plugin): filter completion items of macros and global variables in templates and styles ([f64cbba](https://github.com/vuejs/language-tools/commit/f64cbba4b8a25a61a6dd074b3e267257570ff72c))
- fix(component-meta): only exclude vnode events from props and attach namespace prefix correctly ([27499c7](https://github.com/vuejs/language-tools/commit/27499c7ff8c1a7872ebe2a09ed55da87bbd37769)) ([2a1a9b2](https://github.com/vuejs/language-tools/commit/2a1a9b29e4b4a68ed7feec3a8d2f9d522c607d2a))
- fix(component-meta): update event type representation to include array notation ([0e4b411](https://github.com/vuejs/language-tools/commit/0e4b4116742ab1fa0fcd6babf27e83c765e2c06f))
- fix(vscode): handle the `typescript-language-features` module loading race condition ([32c9336](https://github.com/vuejs/language-tools/commit/32c93365929193efdf40671667189d34b940eb72))

### Other Changes

- refactor(vscode): remove hybrid mode configuration, the doctor, and the split editor and virtual files features ([dac1089](https://github.com/vuejs/language-tools/commit/dac10895ef58fbc429ca74b06acc8cf81d38f935)) ([505a669](https://github.com/vuejs/language-tools/commit/505a669292eb04609680829bdc37223dbf30fbc8)) ([96b621a](https://github.com/vuejs/language-tools/commit/96b621af419b39723ca4d39bbfdffda5b0e0429b)) ([61fc3ca](https://github.com/vuejs/language-tools/commit/61fc3cad64af3fd55594a947eef8d131039ce0f9))
- refactor(language-core): drop `defineProp` support ([14ec3d8](https://github.com/vuejs/language-tools/commit/14ec3d8eef6102f6044ccea9e355fa52172268ed))
- refactor(component-meta): use type-helpers as a peer dependency ([4b8a4a2](https://github.com/vuejs/language-tools/commit/4b8a4a22c6e598bb05cccc64c5a4384a6224e56d))
- refactor(vscode): rename configuration keys from `complete` to `suggest` for clarity ([d494495](https://github.com/vuejs/language-tools/commit/d49449538788826cefa81e15266e7635b415d382))
- chore(vscode): change the display name to "Vue (Official)" ([8fbef72](https://github.com/vuejs/language-tools/commit/8fbef726719c71965ade61d2f5ab3b1d6873c6e8))

Contributors: @KazariEX, @Akryum, @alex-snezhko, @brc-dd, @Dylancyclone, @Eazash, @kshksdrt, @lukashass, @marktlinn, @menuRivera, @RayGuo-ergou, @so1ve, @tomblachut, @violet-miku, @zhiyuanzmj, @zyoshoka
