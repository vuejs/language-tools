import {
	isSemanticTokensEnabled,
	type Language,
	names,
	type SourceScript,
	type VueVirtualCode,
} from '@vue/language-core';
import type * as ts from 'typescript';

interface ExtractPropsInfo {
	name: string;
	type: string;
	model: boolean;
}

export function collectExtractProps(
	ts: typeof import('typescript'),
	language: Language,
	program: ts.Program,
	sourceScript: SourceScript,
	virtualCode: VueVirtualCode,
	templateCodeRange: [number, number],
	leadingOffset: number = 0,
): ExtractPropsInfo[] {
	const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return [];
	}

	const result = new Map<string, ExtractPropsInfo>();
	const sourceFile = program.getSourceFile(virtualCode.fileName)!;
	const checker = program.getTypeChecker();
	const map = language.maps.get(serviceScript.code, sourceScript);
	const { ir } = virtualCode;

	sourceFile.forEachChild(function visit(node) {
		if (
			ts.isPropertyAccessExpression(node)
			&& ts.isIdentifier(node.expression)
			&& node.expression.text === names.ctx
			&& ts.isIdentifier(node.name)
		) {
			const { name } = node;
			for (const [offset] of map.toSourceLocation(name.getEnd() - leadingOffset, isSemanticTokensEnabled)) {
				if (
					offset >= ir.template!.startTagEnd + templateCodeRange[0]
					&& offset <= ir.template!.startTagEnd + templateCodeRange[1]
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
