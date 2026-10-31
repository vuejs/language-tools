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
// route-plugin.js, listed as `{ "name": "./route-plugin.js" }` in `plugins`:
// `useRoute()` of `Page.vue` reads the route `/Page`, and so does `$route` of its template
const path = require('node:path');

exports.codegen = ({ ts, fileName, ir, name }) => {
	const route = JSON.stringify('/' + path.basename(fileName, '.vue'));
	const Route = name('Route');
	return {
		rewrite({ scriptSetup }) {
			ir.scriptSetup?.ast.forEachChild(function visit(node) {
				if (
					ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useRoute'
					&& !node.typeArguments
				) {
					scriptSetup.insertAfter(node.expression.end, `<${route}>`);
				}
				node.forEachChild(visit);
			});
		},
		declarations: () => [`type ${Route} = import('vue-router').RouteLocationNormalizedLoaded<${route}>;`],
		templateContext: () => [`{ $route: ${Route} }`],
	};
};
```

`codegen(file, ctx)` is a `VueCodegenPlugin`. It runs for each snapshot of each file, in `plugins`
order after the built-in plugins of the mapper (slots, fallthrough attributes, template refs, root
element, style), and gives the `VueCodegenFilePlugin` of the file: an optional `rewrite` of the
user's code, and functions that give its code in the slots of the generated code. `ctx` holds the
entry's `config`, the options of the plugin, and the resolved `vueCompilerOptions`. `file` holds the
TS 7.1 AST API that parsed the scripts (`ts`), `fileName`, the IR, its analysis (resolved options,
with SFC comment options, and script ranges), `name` and `template`. Walk ASTs with
`node.forEachChild`. A `codegen` export that is not a function is reported as an option diagnostic at
the `plugins` entry. An exception of `codegen` or of a hook, and a hook that is not a function or not
one of `VueCodegenFilePlugin`, fail the transform of the file.

`codegen` and its hooks must be pure functions of `file` and `ctx`: no file system, no environment,
no cache shared across projects. The mapper hashes the plugin's entry file, its package's
`name@version` and the entry config into the project identity, so nothing else is tracked. Data from
elsewhere reaches TypeScript through type imports (`import('…')`), which TypeScript resolves and
watches. The mapper runs each hook at most once for a snapshot: `rewrite` first, and a slot when it
needs it, so what the hooks share belongs in the closure of `codegen`, and a slot can place what
`rewrite` cut.

`file.name(hint)` gives the name of an identifier that the plugin declares: `__VLS_<hint>`, or that
with `$<n>` when the generated code or a plugin before took it; the same hint gives the same name.
It names only while `codegen` runs, so that each snapshot gives the plugins the same names. Plugins
never see the names of the generated code: `file.template` gives, as type code that reads in the
scope of the template, what the template declares — `instanceType(node)` of a component with a
template ref or a root element whose `$el` is inferred, `elementType(tag)`, `slotOutletTypes(node)`
and `fallthroughAttrsType()`. The template is open as this data only; its walk, scopes and
interpolation stay in the mapper.

The code of a slot is a `VueCodegenPiece` or pieces in order: plain strings, which map nowhere and
report no diagnostics, and ranges `{ source, start, end, data: { features }, text? }` of a block
`source`, mapped there with the given features (e.g. `scriptFeatures`). A range without `text` copies
the text of the block; with `text`, the text maps to the range char by char when it is as long as the
range, and as a whole otherwise (e.g. to report a diagnostic there). The code of a slot can also
hold slices that the writers of the plugin cut; the mapper places the code of each slot once, so a
slice there moves its chars, with the edits of all plugins in them, into the slot. A piece that is
not text or a range of a block of the file, and a slice that the writers of the plugin did not cut,
throw.

```js
// define-prop.js: `defineProp<number>('count')` in `<script setup>` declares the prop `count`, which
// the template reads; the type argument moves into the props, and the rest of the call goes
const { scriptFeatures } = require('@vue/language-core');

exports.codegen = ({ ts, ir }) => {
	const block = ir.scriptSetup;
	const props = [];
	return {
		rewrite({ scriptSetup }) {
			for (const statement of block?.ast.statements ?? []) {
				const call = ts.isExpressionStatement(statement) ? statement.expression : undefined;
				if (
					call && ts.isCallExpression(call) && ts.isIdentifier(call.expression)
					&& call.expression.text === 'defineProp' && call.typeArguments?.length === 1
					&& call.arguments.length === 1 && ts.isStringLiteral(call.arguments[0])
				) {
					const [type] = call.typeArguments;
					const start = type.getStart(block.ast);
					scriptSetup.replace(statement.getStart(block.ast), start, '');
					scriptSetup.replace(type.end, statement.end, '');
					props.push({
						key: call.arguments[0].text,
						type: scriptSetup.cut(start, type.end, { data: { features: scriptFeatures } }),
					});
				}
			}
		},
		props: () => props.map(({ key, type }) => [`{ ${JSON.stringify(key)}: `, type, ' }']),
	};
};
```

| Slot | Where the mapper places it | What its code can reference |
|---|---|---|
| `templateContext` | Object types spread into the template context, after the component instance and before its props and emits | the setup scope of a script setup component, else the module scope |
| `templateBody` | Statements in the template function, before the code of the template | the setup scope of a script setup component, else the module scope |
| `templateTypes` | `{ name, code }`: type aliases at the end of the template, each by a name that `file.name()` gave the plugin, which the setup scope and the module scope read too | the scope of the template |
| `templateDollars` | Object types intersected into the `$` names that the template reads (`$slots`, `$attrs`, `$refs`, `$el`) | the scope of the template |
| `elementEnd` | A map of elements of the template to code after their props, before their children | the scope of the template at the element |
| `props`, `emits`, `expose` | `<script setup>` only: object types intersected into the props (`defineProps<…>` form), which the template reads too, the emits (`defineEmits<…>` form) and what the component exposes | the setup scope |
| `generic` | `<script setup>` only: type parameters of the component, after those of its `generic` attribute; with one, the component is generic | the module scope |
| `declaredSlots` | Text only: an expression of the slots that the component declares (e.g. what `defineSlots` returns), which each slot outlet of the template is checked against instead of giving types to infer the slots from | the setup scope |
| `componentSlots` | `<script setup>` only, text only: object types intersected into the slots of the component (`defineSlots` form) | where the mapper declares the component |
| `exposedInstanceTypes`, `componentOptions`, `fallthroughProps` | Text only: object types intersected into what a generic component exposes, options of the component after its props, and object types of the props that the component takes besides its own | where the mapper declares the component |
| `elements` | The tag → element type map of native elements, which replaces the DOM one in the file | the module scope |
| `declarations` | Statements at module scope, after the user's code | the module scope |
| `exports` | `names`: named exports of the component. `default: false`: no synthetic default export (a user `export default` in `<script>` stays). `docComment`: the range of a doc comment (one block comment) of a script block, copied onto the exports of the component | — |

Slots combine in `plugins` order, after the code of the built-in plugins. Arrays, the codes of an
element in `elementEnd` and `exports.names` are concatenated, and names are de-duplicated. For
`elements`, `exports.default` and `exports.docComment`, the first plugin that sets one wins; one
plugin at most gives `declaredSlots`. Slots
that are not valid, such as a doc comment out of its block or a template type that `file.name()` did
not name, throw.

`rewrite(writers)` runs after the `rewrite` of the plugins before it. `writers.script` and
`writers.scriptSetup` are the writers of the plugin for the file's script blocks (`undefined` without
the block), at offsets of the block's content: muggle-string writers, `RewriteWriter<IRBlock,
VueCodegenData>`. Inserted code is `VueCodegenCode`: `VueCodegenPiece`s, slices, or arrays of them.
Inserts and replacements never conflict. `insertBefore(offset, code)` attaches code to the char at
`offset` (at the end of the block, to the end of the block), `insertAfter(offset, code)` to the char
before `offset` (at the start of the block, to the start of the block), and the code goes wherever
the mapper copies that char. `replace(start, end, code)` drops the chars of `start..end` and puts
`code` in the place of the first; the code attached to them stays. Removals of several plugins are
united. `cut(start, end, { data, placeholder })` returns a slice of the chars of `start..end` with all
the edits in them, which renders where it is inserted or placed in a slot, exactly once, and nowhere
if it is not (a plugin renders no slice: its `render` throws, as a render would freeze the edits of
the plugins after it, and a writer takes only the slices that the writers of its plugin cut); the
cuts of all plugins and
the mapper nest or are disjoint, and a cut that partly overlaps another one throws, since no output
can render the shared chars once in both slices. Its chars map with `data.features` (e.g.
`scriptFeatures`), and `placeholder` takes their place where they are cut from. When the mapper
moves a range of the user's code (e.g. the type argument of `defineProps` into a type alias), the
inserts attached to its chars move with it. At one char, the code nests: a later plugin sits outside
an earlier one, and the mapper outside all. So inserts before the char come outermost first, and
inserts after the char come innermost first. The edits of one plugin at one place keep their order.
An edit out of the range of its block, a replacement of no char, a cut without integer features, and
code that is not valid throw. The start of each script block always maps one empty position, so that
an edit of the generated code there (e.g. an auto import) maps back even when all its chars are
removed.

Unsupported, since they would need generated structure that a contribution cannot reach without
depending on generated names: wrapping the template (e.g. checking its root as the default slot of
a layout component), template expressions in custom blocks, and intersecting a type into the default
export.

Each transform selects its virtual extension through the Content Mapper
protocol, following the `lang` of the file's script blocks: `.ts` for `lang="ts"`,
`.tsx` for `lang="tsx"`, `.js` for plain JavaScript and `.jsx` for `lang="jsx"`.
JavaScript components are generated as JavaScript with JSDoc types, so they are
checked like other JavaScript files (`checkJs` / `@ts-check`).

Vue template `@vue-ignore` and `@vue-expect-error` comments are emitted through
TypeScript content-mapper diagnostic directive mappings.
