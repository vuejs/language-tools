import { DocumentCapabilities, EmbeddedFileKind, LanguageModule, SourceFile } from '@volar/language-core';
import type { TmplAstNode, TmplAstTemplate, ParsedTemplate, ParseSourceSpan } from '@angular/compiler';
import { Codegen } from './ts';
import type * as ts from 'typescript/lib/tsserverlibrary';

const { parseTemplate }: typeof import('@angular/compiler') = require('@angular-eslint/bundled-angular-compiler');

export class HTMLTemplateFile implements SourceFile {

	public text: string;
	public capabilities: DocumentCapabilities = {
		diagnostic: true,
	};
	public kind = EmbeddedFileKind.TextFile;
	public mappings: SourceFile['mappings'] = [];
	public embeddeds: SourceFile['embeddeds'] = [];
	public parsed: ParsedTemplate;

	constructor(
		private ts: typeof import('typescript/lib/tsserverlibrary'),
		public fileName: string,
		public snapshot: ts.IScriptSnapshot,
	) {

		console.log('createSourceFile', fileName);
		const generated = generate(ts, fileName, snapshot.getText(0, snapshot.getLength()));

		this.text = snapshot.getText(0, snapshot.getLength()); // TODO: use empty string with snapshot
		this.mappings = [
			{
				data: {
					diagnostic: true,
				},
				generatedRange: [0, this.text.length],
				sourceRange: [0, this.text.length],
			},
		];
		this.embeddeds = [
			{
				fileName: fileName + '.__template.ts',
				text: generated.codegen.text,
				capabilities: {
					diagnostic: true,
					foldingRange: false,
					documentFormatting: false,
					documentSymbol: false,
					codeAction: false,
					inlayHint: true,
				},
				kind: EmbeddedFileKind.TypeScriptHostFile,
				mappings: generated.codegen.mappings,
				embeddeds: [],
			},
		];
		this.parsed = generated.parsed;
	}

	update(snapshot: ts.IScriptSnapshot) {
		console.log('updateSourceFile', this.fileName);
		const generated = generate(this.ts, this.fileName, snapshot.getText(0, snapshot.getLength()));
		this.text = snapshot.getText(0, snapshot.getLength());
		this.mappings = [
			{
				data: {
					diagnostic: true,
				},
				generatedRange: [0, this.text.length],
				sourceRange: [0, this.text.length],
			},
		];
		this.embeddeds[0].text = generated.codegen.text;
		this.embeddeds[0].mappings = generated.codegen.mappings;
		this.parsed = generated.parsed;
	}
}

export function createHtmlLanguageModule(ts: typeof import('typescript/lib/tsserverlibrary')): LanguageModule<HTMLTemplateFile> {
	return {
		createSourceFile(fileName, snapshot) {
			if (fileName.endsWith('.html')) {
				return new HTMLTemplateFile(ts, fileName, snapshot);
			}
		},
		updateSourceFile(sourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
	};
}

function generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	fileName: string,
	fileText: string,
) {

	const parsed = parseTemplate(fileText, fileName, {
		preserveWhitespaces: true,
	});
	const codegen = new Codegen(fileText);
	const localVars: Record<string, number> = {};
	const templateBlocksConditions: Record<string, string[][]> = {};
	const conditions: string[] = [];
	const ngTemplates: TmplAstTemplate[] = [];

	codegen.text += 'export { };\n';
	codegen.text += `declare const __ctx: __Components['${fileName}'];\n`;

	const visitor: Parameters<TmplAstNode['visit']>[0] = {
		visit(node) {
			console.log('visit');
			node.visit(visitor);
		},
		visitElement(element) {
			console.log('visitElement');
			codegen.text += `{\n`;
			for (const input of element.inputs) {
				codegen.text += '(';
				// console.log(input.sourceSpan.start.offset, input.sourceSpan.end.offset);
				addInterpolationFragment(input.value.sourceSpan.start, input.value.sourceSpan.end);
				codegen.text += `);\n`;
			}
			for (const child of element.children) {
				child.visit(visitor);
			}
			codegen.text += `}\n`;
		},
		visitTemplate(template) {
			console.log('visitTemplate', template.tagName);

			if (template.tagName === 'ng-template') {
				ngTemplates.push(template);
			}

			let conditionText = 'true';
			let forOfSource: ParseSourceSpan | undefined;
			let forOfBinding: ParseSourceSpan | undefined;

			for (const attr of template.templateAttrs) {
				if (attr.name === 'ngIf' && attr.valueSpan) {
					codegen.text += `if (`;
					conditionText = addInterpolationFragment(attr.valueSpan.start.offset, attr.valueSpan.end.offset);
					codegen.text += `) {\n`;
					conditions.push(conditionText);
					for (const child of template.children) {
						child.visit(visitor);
					}
					conditions.pop();
					codegen.text += `}\n`;
				}
				if (attr.name === 'ngIfElse' && attr.valueSpan) {
					codegen.text += '(__templates).';
					const templateBlock = codegen.addSourceText(attr.valueSpan.start.offset, attr.valueSpan.end.offset);
					codegen.text += ';\n';
					templateBlocksConditions[templateBlock] ??= [];
					templateBlocksConditions[templateBlock].push([
						...conditions,
						`!(${conditionText})`,
					]);
				}
				if (attr.name === 'ngForOf' && attr.valueSpan) {
					forOfSource = attr.valueSpan;
				}
			}

			for (const v of template.variables) {
				if (v.value === '$implicit') {
					forOfBinding = v.keySpan;
				}
			}

			if (forOfSource && forOfBinding) {
				codegen.text += `for (const `;
				const binding = codegen.addSourceText(forOfBinding.start.offset, forOfBinding.end.offset);
				codegen.text += ` of `;
				addInterpolationFragment(forOfSource.start.offset, forOfSource.end.offset);
				codegen.text += `) {\n`;
				localVars[binding] = localVars[binding] ? localVars[binding] + 1 : 1;
				for (const child of template.children) {
					child.visit(visitor);
				}
				localVars[binding]--;
				codegen.text += `}\n`;

				// console.log(JSON.stringify(template));
			}
		},
		visitContent(content) {
			console.log('visitContent');
			content.visit(visitor);
		},
		visitVariable(variable) {
			console.log('visitVariable');
			variable.visit(visitor);
		},
		visitReference(reference) {
			console.log('visitReference');
			reference.visit(visitor);
		},
		visitTextAttribute(attribute) {
			console.log('visitTextAttribute');
			attribute.visit(visitor);
		},
		visitBoundAttribute(attribute) {
			console.log('visitBoundAttribute');
			attribute.visit(visitor);
		},
		visitBoundEvent(event) {
			console.log('visitBoundEvent');
			event.visit(visitor);
		},
		visitText(_text) {
			console.log('visitText');
			// text.visit(visitor);
		},
		visitBoundText(text) {
			const content = fileText.substring(text.value.sourceSpan.start, text.value.sourceSpan.end);
			console.log('visitBoundText');
			const interpolations = content.matchAll(/{{[\s\S]*?}}/g);
			for (const interpolation of interpolations) {
				const start = text.value.sourceSpan.start + interpolation.index! + '{{'.length;
				const length = interpolation[0].length - '{{'.length - '}}'.length;
				addInterpolationFragment(start, start + length);
				codegen.text += ';\n';
			}
		},
		visitIcu(icu) {
			console.log('visitIcu');
			icu.visit(visitor);
		},
	};

	for (const node of parsed.nodes) {
		node.visit(visitor);
	}

	codegen.text += 'var __templates = {\n';
	for (const template of ngTemplates) {
		for (const reference of template.references) {
			const templateBlock = codegen.addSourceText(reference.keySpan.start.offset, reference.keySpan.end.offset);
			codegen.text += ': (() => {\n';
			let ifBlockOpen = false;
			if (templateBlocksConditions[templateBlock]) {
				ifBlockOpen = true;
				codegen.text += `if (`;
				codegen.text += templateBlocksConditions[templateBlock].map(conditions => conditions.join(' && ')).join(' || ');
				codegen.text += `) {\n`;
			}
			for (const child of template.children) {
				child.visit(visitor);
			}
			if (ifBlockOpen) {
				ifBlockOpen = false;
				codegen.text += `}\n`;
			}
			codegen.text += `}) as unknown as typeof import('@angular/core').TemplateRef,\n`;
		}
	}
	codegen.text += '};\n';

	return {
		codegen,
		parsed,
	};

	function addInterpolationFragment(start: number, end: number) {
		const code = fileText.substring(start, end);
		const ast = ts.createSourceFile(fileName + '.ts', code, ts.ScriptTarget.Latest);
		let full = '';
		walkInterpolationFragment(ts, code, ast, (fragment, offset, isJustForErrorMapping) => {
			full += fragment;
			if (offset !== undefined) {
				codegen.addSourceText(
					start + offset,
					start + offset + fragment.length,
					isJustForErrorMapping ? { diagnostic: true } : undefined,
				);
			}
			else {
				codegen.text += fragment;
			}
		}, localVars,);
		return full;
	}
}

function walkInterpolationFragment(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	code: string,
	ast: ts.SourceFile,
	cb: (fragment: string, offset: number | undefined, isJustForErrorMapping?: boolean) => void,
	localVars: Record<string, number>,
) {

	let ctxVars: {
		text: string,
		isShorthand: boolean,
		offset: number,
	}[] = [];

	const varCb = (id: ts.Identifier, isShorthand: boolean) => {
		if (
			!!localVars[id.text] ||
			id.text.startsWith('__')
		) {
			return;
		}
		ctxVars.push({
			text: id.text,
			isShorthand: isShorthand,
			offset: id.getStart(ast),
		});
	};
	ast.forEachChild(node => walkIdentifiers(ts, node, varCb, localVars));

	ctxVars = ctxVars.sort((a, b) => a.offset - b.offset);

	if (ctxVars.length) {

		if (ctxVars[0].isShorthand) {
			cb(code.substring(0, ctxVars[0].offset + ctxVars[0].text.length), 0);
			cb(': ', undefined);
		}
		else {
			cb(code.substring(0, ctxVars[0].offset), 0);
		}

		for (let i = 0; i < ctxVars.length - 1; i++) {

			cb('(__ctx).', undefined);
			if (ctxVars[i + 1].isShorthand) {
				cb(code.substring(ctxVars[i].offset, ctxVars[i + 1].offset + ctxVars[i + 1].text.length), ctxVars[i].offset);
				cb(': ', undefined);
			}
			else {
				cb(code.substring(ctxVars[i].offset, ctxVars[i + 1].offset), ctxVars[i].offset);
			}
		}

		cb('', ctxVars[ctxVars.length - 1].offset, true);
		cb('(__ctx).', undefined);
		cb(code.substring(ctxVars[ctxVars.length - 1].offset), ctxVars[ctxVars.length - 1].offset);
	}
	else {
		cb(code, 0);
	}

	return ctxVars;
}

function walkIdentifiers(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	node: ts.Node,
	cb: (varNode: ts.Identifier, isShorthand: boolean) => void,
	localVars: Record<string, number>,
) {

	const blockVars: string[] = [];

	if (ts.isIdentifier(node)) {
		cb(node, false);
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		cb(node.name, true);
	}
	else if (ts.isPropertyAccessExpression(node)) {
		walkIdentifiers(ts, node.expression, cb, localVars);
	}
	else if (ts.isVariableDeclaration(node)) {

		colletVars(ts, node.name, blockVars);

		for (const varName of blockVars)
			localVars[varName] = (localVars[varName] ?? 0) + 1;

		if (node.initializer)
			walkIdentifiers(ts, node.initializer, cb, localVars);
	}
	else if (ts.isArrowFunction(node)) {

		const functionArgs: string[] = [];

		for (const param of node.parameters) {
			colletVars(ts, param.name, functionArgs);
			if (param.type) {
				walkIdentifiers(ts, param.type, cb, localVars);
			}
		}

		for (const varName of functionArgs)
			localVars[varName] = (localVars[varName] ?? 0) + 1;

		walkIdentifiers(ts, node.body, cb, localVars);

		for (const varName of functionArgs)
			localVars[varName]--;
	}
	else if (ts.isObjectLiteralExpression(node)) {
		for (const prop of node.properties) {
			if (ts.isPropertyAssignment(prop)) {
				// fix https://github.com/johnsoncodehk/volar/issues/1176
				if (ts.isComputedPropertyName(prop.name)) {
					walkIdentifiers(ts, prop.name.expression, cb, localVars);
				}
				walkIdentifiers(ts, prop.initializer, cb, localVars);
			}
			// fix https://github.com/johnsoncodehk/volar/issues/1156
			else if (ts.isShorthandPropertyAssignment(prop)) {
				walkIdentifiers(ts, prop, cb, localVars);
			}
			// fix https://github.com/johnsoncodehk/volar/issues/1148#issuecomment-1094378126
			else if (ts.isSpreadAssignment(prop)) {
				// TODO: cannot report "Spread types may only be created from object types.ts(2698)"
				walkIdentifiers(ts, prop.expression, cb, localVars);
			}
		}
	}
	else if (ts.isTypeReferenceNode(node)) {
		// fix https://github.com/johnsoncodehk/volar/issues/1422
		node.forEachChild(node => walkIdentifiersInTypeReference(ts, node, cb));
	}
	else {
		node.forEachChild(node => walkIdentifiers(ts, node, cb, localVars));
	}

	for (const varName of blockVars) {
		localVars[varName]--;
	}
}

function walkIdentifiersInTypeReference(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	node: ts.Node,
	cb: (varNode: ts.Identifier, isShorthand: boolean) => void,
) {
	if (ts.isTypeQueryNode(node) && ts.isIdentifier(node.exprName)) {
		cb(node.exprName, false);
	}
	else {
		node.forEachChild(node => walkIdentifiersInTypeReference(ts, node, cb));
	}
}

function colletVars(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	node: ts.Node,
	result: string[],
) {
	if (ts.isIdentifier(node)) {
		result.push(node.text);
	}
	else if (ts.isObjectBindingPattern(node)) {
		for (const el of node.elements) {
			colletVars(ts, el.name, result);
		}
	}
	else if (ts.isArrayBindingPattern(node)) {
		for (const el of node.elements) {
			if (ts.isBindingElement(el)) {
				colletVars(ts, el.name, result);
			}
		}
	}
	else {
		node.forEachChild(node => colletVars(ts, node, result));
	}
}
