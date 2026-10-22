import { defineRule } from '@tsslint/config';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import type { Expression } from 'typescript-7/ast';
import { type Symbol, SymbolFlags, type Type } from 'typescript-7/sync';

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

const typescriptDirs = new Map<string, string>();

/** The real directory of the `typescript` package a file resolves, which may be installed under another name. */
function getTypescriptDir(fileName: string) {
	const dir = path.dirname(fileName);
	let typescriptDir = typescriptDirs.get(dir);
	if (typescriptDir === undefined) {
		const packageJsonPath = createRequire(fileName).resolve('typescript/package.json');
		typescriptDir = normalize(fs.realpathSync(path.dirname(packageJsonPath))) + '/';
		typescriptDirs.set(dir, typescriptDir);
	}
	return typescriptDir;
}

function normalize(fileName: string) {
	return fileName.replace(/\\/g, '/').toLowerCase();
}

export default defineRule(({ typescript: ts, file, checker, report }) => {
	const typescriptDir = getTypescriptDir(file.fileName);

	file.forEachChild(function visit(node): void {
		if (ts.isPropertyAccessExpression(node)) {
			checkAccess(node.expression, node.name.text, node.name.getStart(file), node.name.getEnd());
		}
		else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLikeNode(node.argumentExpression)) {
			checkAccess(
				node.expression,
				node.argumentExpression.text,
				node.argumentExpression.getStart(file),
				node.argumentExpression.getEnd(),
			);
		}
		node.forEachChild(visit);
	});

	function isTypescriptSymbol(symbol: Symbol, typeName: string) {
		if (symbol.name !== typeName) {
			return false;
		}
		return symbol.declarations.some(declaration => normalize(declaration.path).startsWith(typescriptDir));
	}

	function isTargetType(type: Type, typeName: string): boolean {
		if (type.isUnionType() || type.isIntersectionType()) {
			return type.getTypes().some(inner => isTargetType(inner, typeName));
		}

		const symbol = type.getAliasSymbol() ?? type.getSymbol();
		if (!symbol) {
			return false;
		}

		if (symbol.flags & SymbolFlags.Alias) {
			const aliasedSymbol = checker.getAliasedSymbol(symbol);
			if (aliasedSymbol && isTypescriptSymbol(aliasedSymbol, typeName)) {
				return true;
			}
		}

		return isTypescriptSymbol(symbol, typeName);
	}

	function checkAccess(target: Expression, propertyName: string, start: number, end: number) {
		for (const [typeName, properties] of tsServicesTypes) {
			if (!properties.has(propertyName)) {
				continue;
			}
			const type = checker.getTypeAtLocation(target);
			if (isTargetType(type, typeName)) {
				report('TypeScript services types is used.', start, end);
				break;
			}
		}
	}
});
