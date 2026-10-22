import type { CodeAction, LanguageServicePlugin } from '@volar/language-service';
import { getComponentTagAt, resolveEmbeddedCode } from '../utils';

export function create(
	{ getImportFixes }: import('../requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-template-import-fix',
		capabilities: {
			codeActionProvider: {
				codeActionKinds: ['quickfix'],
			},
		},
		create(context) {
			return {
				async provideCodeActions(document, range, ctx) {
					if (ctx.only && !ctx.only.some(kind => kind === 'quickfix' || kind.startsWith('quickfix.'))) {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					const template = info?.root.ir.template;
					if (info?.code.id !== 'template' || !template) {
						return;
					}
					const offset = document.offsetAt(range.start);
					const tag = getComponentTagAt(template, offset);
					// The generated reference of an unresolved tag maps from its start tag only.
					const fixes = await getImportFixes(
						info.root.fileName,
						template.startTagEnd + (tag?.startTagNameOffset ?? offset),
						!!tag,
					);
					if (!fixes?.length) {
						return;
					}
					const sfcDocument = context.documents.get(info.script.id, info.script.languageId, info.script.snapshot);
					return fixes.map((fix): CodeAction => ({
						title: fix.title,
						kind: 'quickfix',
						edit: {
							changes: {
								[sfcDocument.uri]: fix.edits.map(edit => ({
									range: {
										start: sfcDocument.positionAt(edit.pos),
										end: sfcDocument.positionAt(edit.end),
									},
									newText: edit.newText,
								})),
							},
						},
					}));
				},
			};
		},
	};
}
