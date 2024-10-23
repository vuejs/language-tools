import type * as CompilerDOM from '@vue/compiler-dom';

export interface InlayHintInfo {
	blockName: string;
	offset: number;
	setting: string;
	label: string;
	tooltip?: string;
	paddingRight?: boolean;
	paddingLeft?: boolean;
}

export function createVBindShorthandInlayHintInfo(loc: CompilerDOM.SourceLocation, variableName: string): InlayHintInfo {
	return {
		blockName: 'template',
		offset: loc.end.offset,
		setting: 'vue.inlayHints.vBindShorthand',
		label: `="${variableName}"`,
		tooltip: [
			`This is a shorthand for \`${loc.source}="${variableName}"\`.`,
			'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
			'[More info](https://github.com/vuejs/core/pull/9451)',
		].join('\n\n'),
	};
}
