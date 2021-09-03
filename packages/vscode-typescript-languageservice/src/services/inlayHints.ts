import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from '..';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	return async (uri: string, range: vscode.Range) => {

		const document = getTextDocument(uri);
		if (!document) return;

		const preferences = await host.getPreferences?.(document) ?? {};
		const fileName = shared.uriToFsPath(document.uri);
		const start = document.offsetAt(range.start);
		const end = document.offsetAt(range.end);
		const inlayHints = languageService.provideInlayHints(fileName, { start, length: end - start }, preferences);

		return inlayHints.map(inlayHint => {
			const result: shared.InlayHint = {
				text: inlayHint.text,
				kind: inlayHint.kind === ts.InlayHintKind.Type ? shared.InlayHintKind.Type
					: inlayHint.kind === ts.InlayHintKind.Parameter ? shared.InlayHintKind.Parameter
						: inlayHint.kind === ts.InlayHintKind.Enum ? shared.InlayHintKind.Other
							: undefined,
				whitespaceAfter: inlayHint.whitespaceAfter,
				whitespaceBefore: inlayHint.whitespaceBefore,
				position: document.positionAt(inlayHint.position),
			}
			return result;
		});
	};
}
