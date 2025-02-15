import * as vue from '@vue/language-core';
import type * as ts from 'typescript';
import type { RequestContext } from './types';

export function getElementAttrs(
	this: RequestContext,
	fileName: string,
	tagName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof vue.VueVirtualCode)) {
		return;
	}
	const program = languageService.getProgram()!;

	let tsSourceFile: ts.SourceFile | undefined;
	if (tsSourceFile = program.getSourceFile(fileName)) {
		const checker = program.getTypeChecker();
		const typeNode = tsSourceFile.statements
			.filter(ts.isTypeAliasDeclaration)
			.find(node => node.name.getText() === '__VLS_IntrinsicElementsCompletion');

		if (checker && typeNode) {
			const type = checker.getTypeFromTypeNode(typeNode.type);
			const el = type.getProperty(tagName);

			if (el) {
				const attrs = checker.getTypeOfSymbolAtLocation(el, typeNode).getProperties();
				return attrs.map(c => c.name);
			}
		}
	}
	return [];
}
