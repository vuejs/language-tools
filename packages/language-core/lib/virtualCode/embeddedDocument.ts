import type { Code } from '../types';

/** An embedded document of the language service, and the documents nested in it. */
export interface EmbeddedDocument {
	id: string;
	lang: string;
	content: Code[];
	children?: EmbeddedDocument[];
}

/** The ids of the embedded documents, which the language service plugins select their documents by. */
export const embeddedCodeIds = {
	rootTags: 'root_tags',
	template: 'template',
	templateInlineCss: 'template_inline_css',
	/** Followed by the index of the expression in the template. */
	templateInlineTsPrefix: 'template_inline_ts_',
	scriptRaw: 'script_raw',
	scriptSetupRaw: 'scriptsetup_raw',
	/** Followed by the index of the style block. */
	stylePrefix: 'style_',
	/** Follows the id of the style block whose bindings it holds. */
	styleInlineTsSuffix: '_inline_ts',
	/** Followed by the index of the custom block. */
	customBlockPrefix: 'custom_block_',
} as const;

/** The language id of the `root_tags` document. */
export const rootTagsLanguageId = 'vue-root-tags';
