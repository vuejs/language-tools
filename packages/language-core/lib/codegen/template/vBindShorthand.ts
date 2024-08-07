import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from "../../types";

export function generateVBindShorthandInlayHint(loc: CompilerDOM.SourceLocation, variableName: string): Code {
	return [
		'',
		'template',
		loc.end.offset,
		{
			__hint: {
				setting: 'vue.inlayHints.vBindShorthand',
				label: `="${variableName}"`,
				tooltip: [
					`This is a shorthand for \`${loc.source}="${variableName}"\`.`,
					'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
					'[More info](https://github.com/vuejs/core/pull/9451)',
				].join('\n\n'),
			},
		},
	];
};