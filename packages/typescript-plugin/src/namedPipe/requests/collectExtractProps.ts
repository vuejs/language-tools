import { VueGeneratedCode, isSemanticTokensEnabled } from '@vue/language-core';
import { getProject } from '../utils';
import type * as ts from 'typescript';

export function collectExtractProps(fileName: string, templateCodeRange: [number, number], isTsPlugin: boolean = true) {

	const match = getProject(fileName);
	if (!match) {
		return;
	}

	const { info, files, ts } = match;
	const volarFile = files.get(fileName);
	if (!(volarFile?.generated?.code instanceof VueGeneratedCode)) {
		return;
	}

	const result = new Map<string, {
		name: string;
		type: string;
		model: boolean;
	}>();
	const languageService = info.languageService;
	const program: ts.Program = (languageService as any).getCurrentProgram();
	if (!program) {
		return;
	}

	const sourceFile = program.getSourceFile(fileName)!;
	const checker = program.getTypeChecker();
	const script = volarFile.generated?.languagePlugin.typescript?.getScript(volarFile.generated.code);
	const maps = script ? [...files.getMaps(script.code).values()] : [];
	const sfc = volarFile.generated.code.sfc;

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
