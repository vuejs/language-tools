import { VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import type { RequestContext } from './types';

export function getElementAttrs(
	this: RequestContext,
	fileName: string,
	tagName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}
	const program = languageService.getProgram()!;

	const tsSourceFile = program.getSourceFile(fileName);
	if (tsSourceFile) {
		const checker = program.getTypeChecker();
		const typeNode = tsSourceFile.statements
			.filter(ts.isTypeAliasDeclaration)
			.find(node => node.name.getText() === '__VLS_IntrinsicElementsCompletion');

		if (typeNode) {
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

export function _getElementNames(
	ts: typeof import('typescript'),
	tsLs: ts.LanguageService,
	vueCode: VueVirtualCode
) {
	const program = tsLs.getProgram()!;

	const tsSourceFile = program.getSourceFile(vueCode.fileName);
	if (tsSourceFile) {
		const checker = program.getTypeChecker();
		const typeNode = tsSourceFile.statements
			.filter(ts.isTypeAliasDeclaration)
			.find(node => node.name.getText() === '__VLS_IntrinsicElementsCompletion');

		if (typeNode) {
			const type = checker.getTypeFromTypeNode(typeNode.type);
			return type.getProperties().map(c => c.name);
		}
	}
	return [];
}
