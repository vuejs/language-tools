import { defineRule } from '@tsslint/config';
import type * as ts from 'typescript';

/*
 * services types list: https://github.com/microsoft/TypeScript/blob/38d95c8001300f525fd601dd0ce6d0ff5f12baee/src/services/types.ts
 * commit: 96acaa52902feb1320e1d8ec8936b8669cca447d (2025-09-25)
 */
const SERVICES_TYPES: Record<string, string[]> = {
	Node: [
		'getSourceFile',
		'getChildCount',
		'getChildAt',
		'getChildren',
		'getStart',
		'getFullStart',
		'getEnd',
		'getWidth',
		'getFullWidth',
		'getLeadingTriviaWidth',
		'getFullText',
		'getText',
		'getFirstToken',
		'getLastToken',
		'forEachChild',
	],
	Identifier: [
		'text',
	],
	PrivateIdentifier: [
		'text',
	],
	Symbol: [
		'name',
		'getFlags',
		'getEscapedName',
		'getName',
		'getDeclarations',
		'getDocumentationComment',
		'getContextualDocumentationComment',
		'getJsDocTags',
		'getContextualJsDocTags',
	],
	Type: [
		'getFlags',
		'getSymbol',
		'getProperties',
		'getProperty',
		'getApparentProperties',
		'getCallSignatures',
		'getConstructSignatures',
		'getStringIndexType',
		'getNumberIndexType',
		'getBaseTypes',
		'getNonNullableType',
		'getConstraint',
		'getDefault',
		'isUnion',
		'isIntersection',
		'isUnionOrIntersection',
		'isLiteral',
		'isStringLiteral',
		'isNumberLiteral',
		'isTypeParameter',
		'isClassOrInterface',
		'isClass',
		'isIndexType',
	],
	TypeReference: [
		'typeArguments',
	],
	Signature: [
		'getDeclaration',
		'getTypeParameters',
		'getParameters',
		'getTypeParameterAtPosition',
		'getReturnType',
		'getDocumentationComment',
		'getJsDocTags',
	],
	SourceFile: [
		'version',
		'scriptSnapshot',
		'nameTable',
		'getNamedDeclarations',
		'getLineAndCharacterOfPosition',
		'getLineEndOfPosition',
		'getLineStarts',
		'getPositionOfLineAndCharacter',
		'update',
		'sourceMapper',
	],
	SourceFileLike: [
		'getLineAndCharacterOfPosition',
	],
	SourceMapSource: [
		'getLineAndCharacterOfPosition',
	],
};

const tsServicesTypes: Map<string, Set<string>> = new Map();
for (const [typeName, properties] of Object.entries(SERVICES_TYPES)) {
	tsServicesTypes.set(typeName, new Set(properties));
}

const TYPESCRIPT_PACKAGE_PATH = '/node_modules/typescript/';

export default defineRule(({ typescript: ts, file, program, report }) => {
	const typeChecker = program.getTypeChecker();

	ts.forEachChild(file, function visit(node) {
		if (ts.isPropertyAccessExpression(node)) {
			checkAccess(node.expression, node.name.text, node.name.getStart(file), node.name.getEnd());
		}
		else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
			checkAccess(
				node.expression,
				node.argumentExpression.text,
				node.argumentExpression.getStart(file),
				node.argumentExpression.getEnd(),
			);
		}
		ts.forEachChild(node, visit);
	});

	function isUnionOrIntersection(type: ts.Type): type is ts.UnionOrIntersectionType {
		return (type.flags & (ts.TypeFlags.Union | ts.TypeFlags.Intersection)) !== 0;
	}

	function isTypescriptSourceFile(sourceFile: ts.SourceFile) {
		return sourceFile.fileName.replace(/\\/g, '/').includes(TYPESCRIPT_PACKAGE_PATH);
	}

	function isTypescriptSymbol(symbol: ts.Symbol, typeName: string) {
		if (symbol.getName() !== typeName) {
			return false;
		}
		return (symbol.getDeclarations() ?? []).some(declaration => isTypescriptSourceFile(declaration.getSourceFile()));
	}

	function isTargetType(type: ts.Type, typeName: string): boolean {
		if (isUnionOrIntersection(type)) {
			return type.types.some(inner => isTargetType(inner, typeName));
		}

		const symbol = type.aliasSymbol ?? type.getSymbol();
		if (!symbol) {
			return false;
		}

		if (symbol.flags & ts.SymbolFlags.Alias) {
			const aliasedSymbol = typeChecker.getAliasedSymbol(symbol);
			if (aliasedSymbol && isTypescriptSymbol(aliasedSymbol, typeName)) {
				return true;
			}
		}

		return isTypescriptSymbol(symbol, typeName);
	}

	function checkAccess(target: ts.Expression, propertyName: string, start: number, end: number) {
		for (const [typeName, properties] of tsServicesTypes) {
			if (!properties.has(propertyName)) {
				continue;
			}
			const type = typeChecker.getTypeAtLocation(target);
			if (isTargetType(type, typeName)) {
				report('TypeScript services types is used.', start, end);
				break;
			}
		}
	}
});
