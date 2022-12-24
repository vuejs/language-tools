import { LanguageModule, VirtualFile, EmbeddedFileKind, PositionCapabilities } from '@volar/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import type { Mapping } from '@volar/source-map';

export function createTsLanguageModule(
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {

	const languageModule: LanguageModule<VirtualFile & { ast: ts.SourceFile, snapshot: ts.IScriptSnapshot; }> = {
		createFile(fileName, snapshot) {
			if (fileName.endsWith('.ts')) {
				const text = snapshot.getText(0, snapshot.getLength());
				const ast = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest);
				const virtualFile = createVirtualFile(ast);
				return {
					ast,
					snapshot,
					fileName,
					text: virtualFile.text,
					capabilities: {
						diagnostic: true,
						foldingRange: true,
						documentFormatting: true,
						documentSymbol: true,
						codeAction: true,
						inlayHint: true,
					},
					kind: EmbeddedFileKind.TypeScriptHostFile,
					mappings: virtualFile.mappings,
					embeddedFiles: [],
				};
			}
		},
		updateFile(sourceFile, snapshot) {
			const text = snapshot.getText(0, snapshot.getLength());
			const change = snapshot.getChangeRange(sourceFile.snapshot);

			// incremental update for better performance
			sourceFile.ast = change
				? sourceFile.ast.update(text, change)
				: ts.createSourceFile(sourceFile.fileName, text, ts.ScriptTarget.Latest);
			sourceFile.snapshot = snapshot;

			const gen = createVirtualFile(sourceFile.ast);
			sourceFile.snapshot = ts.ScriptSnapshot.fromString(gen.text);
			sourceFile.mappings = gen.mappings;
		},
	};
	return languageModule;

	function createVirtualFile(ast: ts.SourceFile) {

		const classComponents: {
			templateUrl?: string,
			selectorNode?: ts.StringLiteral,
			urlNodes: ts.Node[],
			decoratorName: string,
			className: string,
		}[] = [];

		ast.forEachChild(node => {
			if (ts.isClassDeclaration(node)) {
				if (node.modifiers?.find(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
					const decorator = node.modifiers.find((mod) => ts.isDecorator(mod)) as ts.Decorator | undefined;
					if (
						decorator
						&& ts.isCallExpression(decorator.expression)
						&& decorator.expression.arguments.length
						&& ts.isObjectLiteralExpression(decorator.expression.arguments[0])
					) {
						const decoratorName = decorator.expression.expression.getText(ast);
						const className = node.name?.getText(ast) || '';
						const classComponent: typeof classComponents[number] = {
							className,
							decoratorName,
							urlNodes: [],
						};
						const selectorProp = decorator.expression.arguments[0].properties.find((prop) => prop.name?.getText(ast) === 'selector');
						if (selectorProp && ts.isPropertyAssignment(selectorProp) && ts.isStringLiteral(selectorProp.initializer)) {
							classComponent.selectorNode = selectorProp.initializer;
						}
						const templateUrlProp = decorator.expression.arguments[0].properties.find((prop) => prop.name?.getText(ast) === 'templateUrl');
						if (templateUrlProp && ts.isPropertyAssignment(templateUrlProp) && ts.isStringLiteral(templateUrlProp.initializer)) {
							const templateUrl = path.resolve(path.dirname(ast.fileName), templateUrlProp.initializer.text);
							classComponent.templateUrl = templateUrl;
							classComponent.urlNodes.push(templateUrlProp.initializer);
						}
						const styleUrlsProp = decorator.expression.arguments[0].properties.find((prop) => prop.name?.getText(ast) === 'styleUrls');
						if (styleUrlsProp && ts.isPropertyAssignment(styleUrlsProp) && ts.isArrayLiteralExpression(styleUrlsProp.initializer)) {
							for (const url of styleUrlsProp.initializer.elements) {
								if (ts.isStringLiteral(url)) {
									classComponent.urlNodes.push(url);
								}
							}
						}
						classComponents.push(classComponent);
					}
				}
			}
		});

		const codegen = new Codegen(ast.getText());

		codegen.addSourceText(0, ast.end);

		if (classComponents.length) {
			codegen.text += `\n/* Volar: Virtual Code */\n`;
			for (const classComponent of classComponents) {
				for (const urlNode of classComponent.urlNodes) {
					codegen.text += `import `;
					codegen.addSourceText(urlNode.getStart(ast), urlNode.getEnd());
					codegen.text += `;\n`;
				}
			}
			const classComponentsWithTemplateUrl = classComponents.filter(component => !!component.templateUrl);
			codegen.text += `declare global {\n`;
			if (classComponentsWithTemplateUrl.length) {
				codegen.text += `type __WithComponent<P extends string, C1, C2> = C1 extends import('@angular/core').Component ? { [k in P]: C2 } : {};\n`;
				codegen.text += `interface __Templates2Components extends\n`;
				codegen.text += classComponentsWithTemplateUrl.map((component) => {
					return `__WithComponent<'${component.templateUrl}', ${component.decoratorName}, ${component.className}>`;
				}).join(',\n');
				codegen.text += `\n{ }\n`;
			}
			const classComponentsWithSelector = classComponents.filter(component => !!component.selectorNode);
			if (classComponentsWithSelector.length) {
				codegen.text += `type __WithComponent2<P extends {}, C1> = C1 extends import('@angular/core').Component ? P : {};\n`;
				for (const classComponentWithSelector of classComponentsWithSelector) {
					codegen.text += `interface __Selectors2Components extends __WithComponent2<{ `;
					codegen.addSourceText(classComponentWithSelector.selectorNode!.getStart(ast), classComponentWithSelector.selectorNode!.getEnd());
					codegen.text += `: ${classComponentWithSelector.className} }, ${classComponentWithSelector.decoratorName}> { }\n`;
				}
			}
			codegen.text += `}\n`;
		}

		return codegen;
	}
}

const fullCap: PositionCapabilities = {
	hover: true,
	references: true,
	definition: true,
	rename: true,
	completion: true,
	diagnostic: true,
	semanticTokens: true,
};

export class Codegen {

	static validTsVar = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

	constructor(public sourceCode: string) { }

	public text = '';
	public mappings: Mapping<PositionCapabilities>[] = [];

	public addSourceText(start: number, end: number, data: PositionCapabilities = fullCap) {
		this.mappings.push({
			sourceRange: [start, end],
			generatedRange: [this.text.length, this.text.length + end - start],
			data,
		});
		const addText = this.sourceCode.substring(start, end);
		this.text += addText;
		return addText;
	}

	public addPropertyAccess(start: number, end: number, data: PositionCapabilities = fullCap) {
		if (Codegen.validTsVar.test(this.sourceCode.substring(start, end))) {
			this.text += `.`;
			this.addSourceText(start, end, data);
		}
		else {
			this.text += `[`;
			this.addSourceTextWithQuotes(start, end, data);
			this.text += `]`;
		}
	}

	public addObjectKey(start: number, end: number, data: PositionCapabilities = fullCap) {
		if (Codegen.validTsVar.test(this.sourceCode.substring(start, end))) {
			this.addSourceText(start, end, data);
		}
		else {
			this.addSourceTextWithQuotes(start, end, data);
		}
	}

	public addSourceTextWithQuotes(start: number, end: number, data: PositionCapabilities = fullCap) {
		this.addSourceText(start, start, data);
		this.text += `'`;
		this.addSourceText(start, end, data);
		this.text += `'`;
		this.addSourceText(end, end, data);
	}
}
