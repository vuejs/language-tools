# Vue TypeScript content mapper

`@vue/content-mapper` transforms Vue single-file components into the
TypeScript or JavaScript code that TypeScript checks. It parses Vue files with
`@vue/language-core` and generates that code itself. It implements the TypeScript
7.1 Content Mapper protocol.

## Configuration

The mapper needs TypeScript 7.1 or later and Node.js 20.19 or 22.12 and later. It parses scripts
through a TypeScript API process that the mapper starts.

Install the mapper beside TypeScript 7.1 (`typescript@latest` is still 7.0, which has no content mappers):

```sh
npm i -D typescript@beta @vue/content-mapper
```

Then add it to `tsconfig.json`:

```jsonc
{
	"contentMappers": [
		{
			"package": "@vue/content-mapper",
			"extensions": [".vue"]
		}
	]
}
```

Run TypeScript with external plugins enabled:

```sh
tsc --runExternalCode --noEmit
```

The TypeScript language server (`tsc --lsp --stdio`) has no `--runExternalCode` flag; editor clients
enable the mapper with `initializationOptions: { runExternalCode: true }` in its `initialize` request.
In VS Code, the TypeScript (Native Preview) extension does this through its `js/ts.contentMappers.enabled`
setting.

An entry's `format` option decides how its files are parsed, whatever their extension: `"sfc"`
(the default) for single-file components, or `"vitepress"` for VitePress markdown — frontmatter,
fenced code blocks and `<<<` snippet imports blanked, `<script>` / `<style>` blocks lifted out, the
remaining markdown as the template — or `"petite-vue"` for petite-vue HTML pages, where the page
outside `<script>` / `<style>` is the template and its expressions can also read globals. A plugin
can provide more formats, which `format` selects by name. Register the same package once per format:

```jsonc
{
	"contentMappers": [
		{ "package": "@vue/content-mapper", "extensions": [".vue"] },
		{ "package": "@vue/content-mapper", "extensions": [".vue.md"], "options": { "format": "vitepress" } }
	]
}
```

Both entries share one mapper process; each keeps its own options.

For CLI-only projects, `"options": { "languageFeatures": false }` skips
language-feature flags while preserving source spans used for diagnostics.
Vue compiler options (e.g. `target`, `plugins`) go directly in the same options object:

```jsonc
{
	"contentMappers": [
		{
			"package": "@vue/content-mapper",
			"extensions": [".vue"],
			"options": { "target": 3.5, "plugins": ["@vue/language-plugin-pug"] }
		}
	]
}
```

The tsconfig's top-level `vueCompilerOptions` field is not read by the mapper; move its
contents into the entry's `options`. A tsconfig that declares its own `contentMappers`
replaces the inherited entries, options included. The Vue VS Code extension contributes a
conditional JSON schema for these options when the mapper package is `@vue/content-mapper`.

The mapper uses dynamic project configuration so Vue compiler options, the installed Vue
version, and the plugins participate in cache invalidation: the content of each plugin's entry file
and the `name@version` of its package, whose `package.json` is watched too.

`plugins` take part in building the IR through their `ir` export (see
[Plugins](../language-core#plugins)). A plugin that fails to load — a missing module, a module that
throws, a v3 `VueLanguagePlugin` export, or a format or template language that is built in or
already provided — is reported as an option diagnostic at its `plugins` entry, and a `format` that
neither the mapper nor a plugin provides is reported at `format`.

## Codegen plugins

A plugin module may also export `codegen`, which contributes to the code that this mapper
generates. It is defined and read by `@vue/content-mapper` alone: the language server and
vue-component-meta never load it, and other Content Mappers may ignore it.

```js
// my-plugin.js, listed as `{ "name": "./my-plugin.js", ...config }` in `plugins`
exports.codegen = ctx => ({
	rewrite({ ts, fileName, ir, analysis }, { script, scriptSetup }) {
		scriptSetup?.insertBefore(0, '/* rewritten */');
	},
	generate({ ts, fileName, ir, analysis }) {
		return {
			templateContext: [['{ $foo: number }']],
		};
	},
});
```

`codegen` is a `VueCodegenExport`: a `VueCodegenPlugin`, or a function of the entry's `config` and
the resolved `vueCompilerOptions` that returns one. Options of the plugin come from its entry's
`config`. A `codegen` that is neither an object nor a function, a factory that throws, a plugin with
neither `rewrite` nor `generate`, and a hook that is not a function are reported as option
diagnostics at the `plugins` entry.

A plugin has two optional hooks, which run for each file: first the `rewrite` of every plugin, in
`plugins` order, then the `generate` of every plugin. `rewrite(file, writers)` edits the user's code
of the script blocks; `generate(file)` returns `VueCodegenSlots`, the code that the plugin adds to
the slots of the generated code. Both see the same `file`, not the result of another hook. `file`
holds the TS 7.1 AST API that parsed the scripts (`ts`), the IR, and its analysis (resolved options,
with SFC comment options, and script ranges). Walk ASTs with `node.forEachChild`. An exception of a
hook fails the transform of the file.

Hooks must be pure functions of `file` and the plugin's context: no file system, no
environment, no cache shared across projects. The mapper hashes the plugin's entry file, its package's
`name@version` and the entry config into the project identity, so nothing else is tracked. Data from
elsewhere reaches TypeScript through type imports (`import('…')`), which TypeScript resolves and
watches.

Code is written as `VueCodegenCode`, an array of `VueCodegenPiece`s: plain strings, which map nowhere
and report no diagnostics, and ranges `{ source, start, end, data: { features }, text? }` of a block
`source`, mapped there with the given features (e.g. `scriptFeatures`). A range without `text` copies
the text of the block; with `text`, the text maps to the range as a whole (e.g. to report a diagnostic
there). A range of a block that is not the file's or out of its block keeps only its `text`, unmapped.
Plugins never see generated names or offsets.

| Slot | Where the mapper places it | What its code can reference |
|---|---|---|
| `templateContext` | Object types spread last into the template context | the setup scope of a script setup component, else the module scope |
| `props`, `emits`, `expose` | `<script setup>` only: object types intersected into the public props (`defineProps<…>` form), the emits (`defineEmits<…>` form) and what the component exposes | the setup scope |
| `elements` | The tag → element type map of native elements, which replaces the DOM one in the file | the module scope |
| `declarations` | Statements at module scope, after the user's code | the module scope |
| `exports` | `names`: named exports of the component. `default: false`: no synthetic default export (a user `export default` in `<script>` stays). `docComment`: the range of a doc comment (one block comment) of a script block, copied onto the exports of the component | — |

Slots combine in `plugins` order. Arrays and `exports.names` are concatenated, and names are
de-duplicated. For `elements`, `exports.default` and `exports.docComment`, the first plugin that sets
one wins. Invalid entries, such as a block that is not the file's or a range out of its block, are
dropped.

`writers.script` and `writers.scriptSetup` are the writers of the plugin for the file's script
blocks (`undefined` without the block), at offsets of the block's content. Inserted code is a plain
string, which maps nowhere. Edits never conflict. `insertBefore(offset, code)` attaches code to the
char at `offset` (at the end of the block, to the end of the block), `insertAfter(offset, code)` to
the char before `offset` (at the start of the block, to the start of the block), and the code goes
wherever the mapper copies that char. `remove(start, end)` drops the chars of `start..end`; the code
attached to them stays. Removals of several plugins are united. When the mapper moves a range of the
user's code (e.g. the type argument of `defineProps` into a type alias), the inserts attached to its
chars move with it. At one char, the code nests: a later plugin sits outside an earlier one, and the
mapper outside all. So inserts before the char come outermost first, and inserts after the char come
innermost first. The edits of one plugin at one place keep their order. An edit out of the range of
its block, a removal of no char, and code that is not a string are ignored. The start of each script block always maps one empty
position, so that an edit of the generated code there (e.g. an auto import) maps back even when all
its chars are removed.

Unsupported, since they would need generated structure that a contribution cannot reach without
depending on generated names: wrapping the template (e.g. checking its root as the default slot of
a layout component), changing the shape of the component (e.g. a `defineGeneric` macro; use `generic="…"`), template
expressions in custom blocks, and intersecting a type into the default export.

Each transform selects its virtual extension through the Content Mapper
protocol, following the `lang` of the file's script blocks: `.ts` for `lang="ts"`,
`.tsx` for `lang="tsx"`, `.js` for plain JavaScript and `.jsx` for `lang="jsx"`.
JavaScript components are generated as JavaScript with JSDoc types, so they are
checked like other JavaScript files (`checkJs` / `@ts-check`).

Vue template `@vue-ignore` and `@vue-expect-error` comments are emitted through
TypeScript content-mapper diagnostic directive mappings.
