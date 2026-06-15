// Vue Single-File Components — a markup language built by REUSING html.ts. A .vue file
// is a set of top-level blocks (<template>, <script>, <style>, custom) whose bodies embed
// a sub-language. That is exactly HTML's raw-text-element mechanism, with a per-block
// `embed` map: <template> embeds Monogram's OWN HTML grammar, <script> embeds Monogram's
// OWN proven JS/TS grammar (the headline — more correct than VS Code's TS), <style>
// embeds CSS (delegated, like the official grammar does). The tokens + rules are html.ts's;
// only the markup config (block tags + embeds) and the scope name differ.
//
// Increment 1: the SFC block skeleton + block-level embeds. Vue template directives
// (v-if / :bind / @event / #slot) and {{ }} interpolation are the next increment.
// Oracle: vuejs/language-tools' hand-written vue.tmLanguage.json (scopeName text.html.vue).
//
// Vue is a DIALECT of html.ts: it reuses html's tokens/rules/scopes verbatim (a .vue file
// is HTML's raw-text mechanism with a per-block embed map) and only swaps the markup config
// + scope name. We import those reusable pieces and build through `defineGrammar` — the same
// API every other grammar uses — instead of spreading html's already-built grammar object.
import { markup as htmlMarkup, rules, scopes, tokens } from './monogram/html.ts';
import { altPattern, defineGrammar } from './monogram/src/api.ts';

export default defineGrammar({
	name: 'vue',
	scopeName: 'text.html.vue',
	tokens,
	rules,
	entry: rules.Document,
	scopes,
	// VS Code `contributes` packaging → vue.contributes.json. The injections load into the same
	// host set the official extension uses (the SFC itself + the languages a Vue template can be
	// embedded in: HTML fragment / markdown / pug), so dropping these files into a Vue extension
	// wires up exactly as Volar's do. The embeddedLanguages map tells the editor each block's
	// language (template → html, <script> → js/ts/…, <style> → css/…) — Monogram embeds its OWN
	// source.ts, so source.ts → typescript here.
	manifest: {
		extensions: ['.vue'],
		injectTo: ['text.html.vue', 'text.html.markdown', 'text.html.derivative', 'text.pug'],
		embeddedLanguages: {
			'text.html.derivative': 'html',
			'source.js': 'javascript',
			'source.ts': 'typescript',
			'source.tsx': 'typescriptreact',
			'source.js.jsx': 'javascriptreact',
			'source.css': 'css',
			'source.css.scss': 'scss',
			'source.css.less': 'less',
			'source.stylus': 'stylus',
			'source.postcss': 'postcss',
			'source.ts.embedded.html.vue': 'typescript',
		},
	},
	markup: {
		...htmlMarkup,
		// Vue `<script setup generic="T, U extends V">`: the value is a TS TYPE-PARAMETER list, not a
		// string. We tokenize it EXACTLY as Volar's hand-written `vue-directives-generic-attr` rule does
		// — through source.ts's PUBLIC repository keys (`#comment`, `#type`, `#punctuation-comma`) plus
		// the two literal matches it inlines (the variance keyword `extends|in|out`, and a default-`=`
		// that isn't `=>`). This is a true drop-in: those official key names now resolve in Monogram's
		// own source.ts NATIVELY (typescript.ts's `canonicalRepoNames` 限制器 makes gen-tm emit `#comment`/
		// `#type`/`#punctuation-comma` as the actual key names) AND in VS Code's official source.ts, so the
		// SAME vue grammar runs on either host (proven by test/vue-dropin.ts). Vue-only, so it extends
		// html.ts's `on*`/`style` embeds rather than polluting the HTML grammar.
		attributeEmbed: [...(htmlMarkup.attributeEmbed ?? []), {
			namePattern: 'generic',
			embed: 'source.ts',
			valuePatterns: [
				{ include: 'source.ts#comment' },
				{
					name: 'storage.modifier.ts',
					match:
						'(?<![_$[:alnum:]])(?:(?<=\\.\\.\\.)|(?<!\\.))(extends|in|out)(?![_$[:alnum:]])(?:(?=\\.\\.\\.)|(?!\\.))',
				},
				{ include: 'source.ts#type' },
				{ include: 'source.ts#punctuation-comma' },
				{ name: 'keyword.operator.assignment.ts', match: '(=)(?!>)' },
			],
		}],
		rawText: {
			tags: ['template', 'script', 'style'],
			token: 'RawText',
			embed: {
				// <template> embeds text.html.derivative — the embedded-HTML-FRAGMENT scope (HTML's
				// rules, no document prologue), which is exactly what the interpolation injection
				// targets. html.ts emits it (aliasScopes) as a thin re-export of text.html.basic, and
				// VS Code ships the same scope — so this ONE Vue grammar runs on Monogram's OR VS Code's
				// HTML interchangeably. (Was text.html.basic; the retarget is REQUIRED, not cosmetic:
				// the interpolation injection now fires on text.html.derivative, not basic.)
				// <template lang="pug"> embeds text.pug (delegated to the Pug grammar the editor provides,
				// exactly as <style> delegates to source.css — Monogram needn't implement pug); a plain
				// <template> keeps the embedded-HTML-fragment scope text.html.derivative.
				template: { default: 'text.html.derivative', lang: { pug: 'text.pug' } },
				// <script lang="ts"> embeds Monogram's OWN proven TS grammar (more correct than VS Code's).
				// forceClose: JS can swallow `</script>` mid-line (a `//` line comment, a string) and an
				// unterminated `type T =` must unwind at the close — so the body needs the `begin/while`
				// force-close (tmbundle#85, #5538/#2060). Style omits it: CSS is well-behaved, so it uses the
				// lookahead-end region that keeps a non-first DIALECT's close-line content in its dialect (#43).
				script: {
					default: 'source.js',
					lang: { ts: 'source.ts', tsx: 'source.tsx', jsx: 'source.js.jsx', coffee: 'source.coffee' },
					forceClose: true,
				},
				style: {
					default: 'source.css',
					lang: {
						scss: 'source.css.scss',
						less: 'source.css.less',
						stylus: 'source.stylus',
						postcss: 'source.postcss',
						sass: 'source.sass',
					},
				},
			},
		},
		// Custom-block embeds: ANY top-level block tag with `lang="<x>"` embeds the mapped scope — the
		// Vue SFC custom-block convention (`<i18n lang="yaml">`, `<docs lang="md">`, `<gql lang="graphql">`).
		// Matches the hand-written grammar's generic `<anytag lang=…>` catch-all. The common script/style/
		// template langs stay on the named rawText blocks above; these data langs (which have no named
		// block) are caught here on whatever tag carries them.
		customBlockEmbed: {
			md: 'text.html.markdown',
			json: 'source.json',
			jsonc: 'source.json.comments',
			json5: 'source.json5',
			yaml: 'source.yaml',
			toml: 'source.toml',
			gql: 'source.graphql',
			graphql: 'source.graphql',
		},
		// Directives + {{ }} interpolation, INJECTED onto the embedded HTML's scopes (Vue syntax
		// can't be baked into the reused HTML grammar — it injects on top). Emitted as TWO thin-stub
		// files (vue-directives.json / vue-interpolations.json) whose rules live in this grammar's
		// repository — the exact official topology, so they're byte-diffable against Volar's. The
		// selectors are the official ones (directives on the tag scope, interpolation on the
		// embedded-HTML/markdown/pug scopes); the generator appends `-source.ts.embedded.html.vue`
		// to each (the #5722 re-fire guard). Values + interpolation embed Monogram's OWN TS.
		inject: {
			exprEmbed: 'source.ts.embedded.html.vue',
			// `{{ }}` and directive values are EXPRESSIONS, not programs — embed the derived
			// expression-only sub-grammar so `{{ const x }}`/`{{ for(…) }}` don't mis-highlight
			// statement keywords (a nested block still re-enters the full grammar via $self).
			exprInclude: 'source.ts#expression',
			interpolation: {
				scopeName: 'vue.interpolations',
				repoKey: 'vue-interpolations',
				// Interpolation lives in TEXT content → inject onto the embedded-HTML-fragment scope
				// (+ markdown / pug hosts, like the official, so `{{ }}` lights in Vue-in-md/pug too).
				selector: [
					{ scope: 'text.html.derivative', excludes: ['comment.block'] },
					{ scope: 'text.html.markdown', excludes: ['comment.block'] },
					{ scope: 'text.pug', excludes: ['comment', 'string.comment'] },
				],
				open: '{{',
				close: '}}',
				beginScope: 'punctuation.definition.interpolation.begin.html.vue',
				endScope: 'punctuation.definition.interpolation.end.html.vue',
			},
			directives: {
				scopeName: 'vue.directives',
				repoKey: 'vue-directives',
				// Directives live in TAG-ATTRIBUTE position → inject onto the tag scope. The official's
				// per-clause excludes keep them from re-firing inside an attribute value / JSX / pug name.
				selector: [
					{
						scope: 'meta.tag',
						excludes: [
							'meta.attribute',
							'meta.ng-binding',
							'entity.name.tag.pug',
							'attribute_value',
							'source.tsx',
							'source.js.jsx',
						],
					},
					{ scope: 'meta.element', excludes: ['meta.attribute'] },
				],
				control: [
					{ match: 'v-for', scope: 'keyword.control.loop.vue' },
					{ match: altPattern('v-if', 'v-else-if', 'v-else'), scope: 'keyword.control.conditional.vue' },
				],
				shorthand: [
					{ char: ':', scope: 'punctuation.attribute-shorthand.bind.html.vue' },
					// `.prop` is Vue's shorthand for `v-bind:prop.prop` — a bind shorthand, same scope as
					// `:` (vuejs/language-tools#3727). The directive arg (`prop`) is then parsed by the
					// shared arg-capture, so its value embeds like any other bind directive.
					{ char: '.', scope: 'punctuation.attribute-shorthand.bind.html.vue' },
					{ char: '@', scope: 'punctuation.attribute-shorthand.event.html.vue' },
					{ char: '#', scope: 'punctuation.attribute-shorthand.slot.html.vue' },
				],
				prefix: 'v-',
				nameScope: 'entity.other.attribute-name.html.vue',
				eqScope: 'punctuation.separator.key-value.html.vue',
				// The quotes around a directive value — string punctuation, matching the official.
				valueString: {
					begin: 'punctuation.definition.string.begin.html.vue',
					end: 'punctuation.definition.string.end.html.vue',
				},
			},
		},
	},
});
