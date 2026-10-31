import * as CompilerDOM from '@vue/compiler-dom';
import { createIRPipeline, getDefaultCompilerOptions, type TypeScript } from '@vue/language-core';
import { parse } from 'muggle-pug';
import { describe, expect, it } from 'vitest';
import * as pug from '../index';

function compile(source: string, options: CompilerDOM.CompilerOptions = {}) {
	const pipeline = createIRPipeline({} as TypeScript, {
		...getDefaultCompilerOptions(),
		plugins: [{ name: 'pug', file: '/project/node_modules/pug/index.js', config: {}, module: pug }],
	});
	const errors: CompilerDOM.CompilerError[] = [];
	const warnings: CompilerDOM.CompilerError[] = [];
	const ast = pipeline.compileTemplate('pug', source, {
		...options,
		onError: error => errors.push(error),
		onWarn: warning => warnings.push(warning),
	})?.result.ast;
	return { ast: ast!, errors, warnings };
}

function element(node: CompilerDOM.ParentNode, tag: string): CompilerDOM.ElementNode {
	for (const child of node.children) {
		if (child.type === CompilerDOM.NodeTypes.ELEMENT) {
			if (child.tag === tag) {
				return child;
			}
			const found = element(child, tag);
			if (found) {
				return found;
			}
		}
		else if (child.type === CompilerDOM.NodeTypes.IF) {
			for (const branch of child.branches) {
				const found = element(branch, tag);
				if (found) {
					return found;
				}
			}
		}
	}
	return undefined!;
}

describe('pug template compiler', () => {
	it('gives the offsets of the pug source', () => {
		const source = [
			`div(class="a" :title="msg" @click="go")`,
			`  span {{ count }}`,
			`  p(v-if="ok") x`,
		].join('\n');
		const { ast, errors } = compile(source);
		expect(errors).toEqual([]);

		const div = element(ast, 'div');
		expect(div.loc.start.offset).toBe(0);
		const [attr, title, click] = div.props as [
			CompilerDOM.AttributeNode,
			CompilerDOM.DirectiveNode,
			CompilerDOM.DirectiveNode,
		];
		expect(attr.loc.start.offset).toBe(source.indexOf('class'));
		expect(attr.nameLoc.start.offset).toBe(source.indexOf('class'));
		expect(attr.value!.loc.start.offset).toBe(source.indexOf('"a"'));
		expect((title.arg as CompilerDOM.SimpleExpressionNode).loc.start.offset).toBe(source.indexOf('title'));
		expect(title.exp!.loc.start.offset).toBe(source.indexOf('msg'));
		expect(title.exp!.loc.end.offset).toBe(source.indexOf('msg') + 3);
		expect(click.exp!.loc.start.offset).toBe(source.indexOf('go'));

		const span = element(ast, 'span');
		expect(span.loc.start.offset).toBe(source.indexOf('span'));
		const interpolation = span.children[0] as CompilerDOM.InterpolationNode;
		expect(interpolation.content.loc.start.offset).toBe(source.indexOf('count'));

		const p = element(ast, 'p');
		expect(p.loc.start.offset).toBe(source.indexOf('p('));
		const ifNode = ast.children[0]!.type === CompilerDOM.NodeTypes.ELEMENT
			? (ast.children[0] as CompilerDOM.ElementNode).children.find(child => child.type === CompilerDOM.NodeTypes.IF)
			: undefined;
		expect((ifNode as CompilerDOM.IfNode).branches[0]!.condition!.loc.start.offset).toBe(source.indexOf('ok'));
	});

	it('gives errors at the offsets of the pug source', () => {
		const source = `div\n  p(v-if)`;
		expect(compile(source).errors.map(errorLoc)).toEqual([
			[CompilerDOM.ErrorCodes.X_V_IF_NO_EXPRESSION, source.indexOf('v-if'), source.indexOf('v-if') + 4],
		]);
	});

	it('gives warnings at the offsets of the pug source', () => {
		// the compiler only warns of deprecations in compat mode
		const warned = `div\n  em(v-if="a" v-for="n in b")`;
		const { warnings } = compile(warned, { compatConfig: { MODE: 2 } });
		expect(warnings.map(warning => [warning.loc?.start.offset, warning.loc?.end.offset])).toEqual([
			[warned.indexOf('em'), warned.length],
		]);
	});

	// #5099
	it('does not report a class attribute that duplicates a class literal', () => {
		const source = `div.foo(class="bar")`;
		const htmlErrors: (number | string)[] = [];
		CompilerDOM.parse(toString(parse(source).pieces, source), { onError: error => htmlErrors.push(error.code) });
		expect(htmlErrors).toEqual([CompilerDOM.ErrorCodes.DUPLICATE_ATTRIBUTE]);

		expect(compile(source).errors).toEqual([]);
	});

	// #118 with CRLF line ends
	it('keeps the name of a multiline attribute with CRLF line ends', () => {
		const source = ['div(', `  :class="[ \\`, `    'a', \\`, `  ]"`, ') Foo'].join('\r\n');
		const div = element(compile(source).ast, 'div');
		expect(div.props.map(prop => prop.name)).toEqual(['bind']);
	});

	// #13
	it('does not report a v-else without a value', () => {
		expect(compile(`div(v-if="a")\ndiv(v-else)`).errors).toEqual([]);
	});

	// #721
	it('does not report a v-model of an element of a block expansion', () => {
		expect(compile(`table: tr: td: input(v-model="name")`).errors).toEqual([]);
	});

	// #1767: the value of a class literal is `.foo`, its `.` in place of the opening quote
	it('gives a class literal the range of its name', () => {
		const source = `.foo\ndiv.bar`;
		const ranges = compile(source).ast.children.map(child => {
			const { loc } = ((child as CompilerDOM.ElementNode).props[0] as CompilerDOM.AttributeNode).value!;
			return [loc.start.offset, loc.end.offset];
		});
		expect(ranges).toEqual([[0, 4], [8, 12]]);
	});

	it('gives an offset of several sources the greatest', () => {
		// the generated `</div>` maps to the start of the element and to the end of its children
		const source = `div\n  p x`;
		const div = element(compile(source).ast, 'div');
		expect(div.loc.end.offset).toBe(source.length);
	});

	it.each([
		`div(class="a" :title="msg" @click="go")\n  span {{ count }}\n  p(v-if="ok") x`,
		`div.foo(class="bar")`,
		`div\n  p(v-if)`,
		`div(disabled)`,
		`div #[span x] y`,
		`ul\n  li(v-for="item in items" :key="item") {{ item }}`,
		`template(#default="{ a }")\n  | {{ a }}`,
	])('gives the locations of %j', source => {
		const { ast, errors, warnings } = compile(source);
		expect({ locations: locations(ast), errors: errors.map(errorLoc), warnings: warnings.map(errorLoc) })
			.toMatchSnapshot();
	});
});

function toString(pieces: ReturnType<typeof parse>['pieces'], pug: string) {
	return pieces.map(piece => typeof piece === 'string' ? piece : piece.text ?? pug.slice(piece.start, piece.end)).join(
		'',
	);
}

function errorLoc(error: CompilerDOM.CompilerError) {
	return [error.code, error.loc?.start.offset, error.loc?.end.offset];
}

/** Every location of the AST as `[path, start, end]`. */
function locations(ast: CompilerDOM.RootNode) {
	const result: [string, number, number][] = [];
	const visited = new Set<object>();
	visit(ast, 'root');
	return result;

	function visit(obj: any, path: string) {
		if (!obj || typeof obj !== 'object' || visited.has(obj)) {
			return;
		}
		visited.add(obj);
		if (typeof obj.start?.offset === 'number' && typeof obj.end?.offset === 'number') {
			result.push([path, obj.start.offset, obj.end.offset]);
			return;
		}
		for (const key in obj) {
			if (key !== 'parent' && key !== 'helpers' && key !== 'components') {
				visit(obj[key], `${path}.${key}`);
			}
		}
	}
}
