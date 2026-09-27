import * as core from '@vue/language-core';
import type * as ts from 'typescript';

export function getDefaultsFromScriptSetup(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceScript: core.SourceScript | undefined,
	isFunctionProp: (name: string) => boolean,
) {
	const virtualCode = sourceScript?.generated?.root as core.VueVirtualCode | undefined;
	if (!virtualCode) {
		return;
	}
	const sourceFile = virtualCode.ir.scriptSetup?.ast;
	if (!sourceFile) {
		return;
	}
	const scriptSetupRanges = core.parseScriptSetupRanges(ts, sourceFile, virtualCode.vueCompilerOptions);
	if (scriptSetupRanges) {
		return collectPropDefaultsFromScriptSetup(
			ts,
			printer,
			sourceFile,
			scriptSetupRanges,
			isFunctionProp,
		);
	}
}

function collectPropDefaultsFromScriptSetup(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	scriptSetupRanges: core.ScriptSetupRanges,
	isFunctionProp: (name: string) => boolean,
) {
	const result = new Map<string, string>();

	if (scriptSetupRanges.withDefaults?.arg) {
		const obj = findObjectLiteralExpression(ts, scriptSetupRanges.withDefaults.arg.node);
		if (obj) {
			for (const prop of obj.properties) {
				if (ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) {
					const name = prop.name.getText(sourceFile);
					result.set(name, printDefaultOption(ts, printer, sourceFile, prop, isFunctionProp(name)));
				}
			}
		}
	}
	else if (scriptSetupRanges.defineProps?.destructured) {
		for (const [name, initializer] of scriptSetupRanges.defineProps.destructured) {
			if (initializer) {
				const expText = printer.printNode(ts.EmitHint.Expression, initializer, sourceFile);
				result.set(name, expText);
			}
		}
	}

	if (scriptSetupRanges.defineModel) {
		for (const defineModel of scriptSetupRanges.defineModel) {
			const obj = defineModel.arg ? findObjectLiteralExpression(ts, defineModel.arg.node) : undefined;
			if (obj) {
				const name = defineModel.name
					? sourceFile.text.slice(defineModel.name.start, defineModel.name.end).slice(1, -1)
					: 'modelValue';
				const _default = resolveModelOption(ts, printer, sourceFile, obj, isFunctionProp(name));
				if (_default) {
					result.set(name, _default);
				}
			}
		}
	}

	return result;
}

function findObjectLiteralExpression(
	ts: typeof import('typescript'),
	node: ts.Node,
) {
	if (ts.isObjectLiteralExpression(node)) {
		return node;
	}
	let result: ts.ObjectLiteralExpression | undefined;
	node.forEachChild(child => {
		if (!result) {
			result = findObjectLiteralExpression(ts, child);
		}
	});
	return result;
}

function resolveModelOption(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	options: ts.ObjectLiteralExpression,
	isFunctionType: boolean,
) {
	let _default: string | undefined;

	for (const prop of options.properties) {
		if (ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) {
			const name = prop.name.getText(sourceFile);
			if (name === 'default') {
				_default = printDefaultOption(ts, printer, sourceFile, prop, isFunctionType);
			}
		}
	}

	return _default;
}

/**
 * Vue calls a function default as a factory, unless the runtime type of the prop is `Function`,
 * in which case the function itself is the default value.
 */
export function printDefaultOption(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	option: ts.PropertyAssignment | ts.MethodDeclaration,
	isFunctionType: boolean,
) {
	if (ts.isPropertyAssignment(option)) {
		const expNode = isFunctionType ? option.initializer : resolveDefaultOptionExpression(ts, option.initializer);
		return printer.printNode(ts.EmitHint.Expression, expNode, sourceFile);
	}
	const isAsync = !!ts.getModifiers(option)?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword);
	if (!isFunctionType && !isAsync && !option.asteriskToken && option.body?.statements.length === 1) {
		const statement = option.body.statements[0]!;
		if (ts.isReturnStatement(statement) && statement.expression) {
			return printer.printNode(ts.EmitHint.Expression, statement.expression, sourceFile);
		}
	}
	// `default() { ... }` -> `function () { ... }`
	// (node arrays are copied, as the ones from typescript-native-bridge have a read-only `pos`)
	const functionExp = ts.factory.createFunctionExpression(
		// create new tokens, as the original ones would carry leading comments of the method
		isAsync ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)] : undefined,
		option.asteriskToken && ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
		undefined,
		option.typeParameters && [...option.typeParameters],
		[...option.parameters],
		option.type,
		option.body ?? ts.factory.createBlock([]),
	);
	return printer.printNode(ts.EmitHint.Expression, functionExp, sourceFile);
}

export function resolveDefaultOptionExpression(
	ts: typeof import('typescript'),
	_default: ts.Expression,
) {
	if (ts.isArrowFunction(_default)) {
		if (ts.isBlock(_default.body)) {
			return _default; // TODO
		}
		else if (ts.isParenthesizedExpression(_default.body)) {
			return _default.body.expression;
		}
		else {
			return _default.body;
		}
	}
	return _default;
}
