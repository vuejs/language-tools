import { VueVirtualCode, isSemanticTokensEnabled } from '@vue/language-core';
import type * as ts from 'typescript';
import type { RequestContext } from './types';

export function collectExtractProps(
	this: RequestContext,
	fileName: string,
	templateCodeRange: [number, number],
) {
	const { typescript: ts, languageService, language, isTsPlugin, getFileId } = this;

	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}

	const result = new Map<string, {
		name: string;
		type: string;
		model: boolean;
	}>();
	const program: ts.Program = (languageService as any).getCurrentProgram();
	if (!program) {
		return;
	}

	const sourceFile = program.getSourceFile(fileName)!;
	const checker = program.getTypeChecker();
	const script = volarFile.generated?.languagePlugin.typescript?.getServiceScript(volarFile.generated.root);
	const maps = script ? [...language.maps.forEach(script.code).values()] : [];
	const sfc = volarFile.generated.root.sfc;

	sourceFile.forEachChild(function visit(node) {
		if (
			ts.isPropertyAccessExpression(node)
			&& ts.isIdentifier(node.expression)
			&& node.expression.text === '__VLS_ctx'
			&& ts.isIdentifier(node.name)
		) {
			const { name } = node;
			for (const [_, map] of maps) {
				const source = map.getSourceOffset(name.getEnd() - (isTsPlugin ? volarFile.snapshot.getLength() : 0));
				if (
					source
					&& source[0] >= sfc.template!.startTagEnd + templateCodeRange[0]
					&& source[0] <= sfc.template!.startTagEnd + templateCodeRange[1]
					&& isSemanticTokensEnabled(source[1].data)
				) {
					if (!result.has(name.text)) {
						const type = checker.getTypeAtLocation(node);
						const typeString = checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation);
						result.set(name.text, {
							name: name.text,
							type: typeString.includes('__VLS_') ? 'any' : typeString,
							model: false,
						});
					}
					const isModel = ts.isPostfixUnaryExpression(node.parent) || ts.isBinaryExpression(node.parent);
					if (isModel) {
						result.get(name.text)!.model = true;
					}
					break;
				}
			}
		}
		node.forEachChild(visit);
	});

	return [...result.values()];
}
