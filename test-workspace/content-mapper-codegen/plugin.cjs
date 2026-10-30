// The codegen plugin of the content-mapper-codegen fixture. The fixture lists it more than once; the later entries
// have `"order": "second"` or `"order": "third"` and contribute what an earlier one already decides.
const path = require('node:path');

exports.codegen = ({ config }) => ({ second, third })[config.order] ?? first;

const first = {
	rewrite({ ts, fileName, ir }, writers) {
		const name = path.basename(fileName, '.vue');
		for (const [block, writer] of [[ir.script, writers.script], [ir.scriptSetup, writers.scriptSetup]]) {
			if (block) {
				// `useFoo()` → `useFoo<number>()`
				block.ast.forEachChild(function visit(node) {
					if (
						ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useFoo'
						&& !node.typeArguments
					) {
						writer.insertAfter(node.expression.end, '<number>');
					}
					node.forEachChild(visit);
				});
			}
		}
		if (name === 'WrapDefault') {
			// `export default { … }` → `export default withWrapped({ … })`
			const { expression } = ir.script.ast.statements.find(ts.isExportAssignment);
			writers.script.insertBefore(expression.getStart(ir.script.ast), 'withWrapped(');
			writers.script.insertAfter(expression.end, ')');
		}
		if (name === 'EndInsert') {
			writers.script.insertBefore(ir.script.content.length, '\nexport const tail = 1;');
		}
		if (name === 'SlotsAlias') {
			// `defineSlots<T>()` → `defineSlots<WithExtra<T>>()`
			const [{ expression: call }] = ir.scriptSetup.ast.statements;
			const [type] = call.typeArguments;
			writers.scriptSetup.insertBefore(type.getStart(ir.scriptSetup.ast), 'WithExtra<');
			writers.scriptSetup.insertAfter(type.end, '>');
		}
		if (name === 'EmptySetup') {
			// the same name as the `<script>` binding, which only the scope of the `<script setup>` body can declare
			writers.scriptSetup.insertBefore(0, "const s = 'setup';");
		}
	},
	generate({ ts, fileName, ir }) {
		const name = path.basename(fileName, '.vue');
		const declarations = [];
		if (name === 'WrapDefault') {
			declarations.push(['declare function withWrapped(options: object): { props: { wrapped: NumberConstructor } };']);
		}
		if (name === 'SlotsAlias') {
			declarations.push(['type WithExtra<T> = T & { extra(props: { n: number }): any };']);
		}
		if (name === 'Declarations') {
			declarations.push(["declare const $l: (key: 'a') => string;"]);
		}
		const isChild = name.startsWith('Props') && name !== 'PropsParent';
		return {
			templateContext: name.startsWith('TemplateContext') ? [['{ $foo: number }']] : [],
			props: isChild ? [['{ contributed?: number }']] : [],
			emits: isChild ? [['{ contributed: [value: number] }']] : [],
			// `exposedValue` is a binding of `<script setup>`
			expose: isChild ? [['{ contributedExposed: typeof exposedValue }']] : [],
			elements: name.startsWith('Elements') ? ['{ div: HTMLDivElement & { readonly contributed: true } }'] : undefined,
			declarations,
			exports: {
				names: ['NamedExport', 'NoDefault', 'ExportsScript', 'DocComment'].includes(name) ? [name] : [],
				// `ExportsScript` keeps its own `export default`
				default: name === 'NoDefault' || name === 'ExportsScript' ? false : undefined,
				// not one block comment, so a later plugin's comment is used
				docComment: name === 'DocComment' ? getDocComment(ts, ir.scriptSetup, 0, 'const'.length) : undefined,
			},
		};
	},
};

const second = {
	generate({ ts, fileName, ir }) {
		const name = path.basename(fileName, '.vue');
		return {
			elements: name.startsWith('Elements') ? ['{ div: HTMLSpanElement }'] : undefined,
			exports: {
				// `NamedExport` again, and a name that is not an identifier
				names: name === 'NamedExport'
					? ['NamedExport', 'SecondExport', 'not-an-identifier']
					: name === 'DocComment'
					? ['DocComment']
					: [],
				default: name === 'NoDefault' ? true : undefined,
				docComment: name === 'DocComment' ? getDocComment(ts, ir.scriptSetup, 0) : undefined,
			},
		};
	},
};

const third = {
	generate({ ts, fileName, ir }) {
		return {
			exports: {
				docComment: path.basename(fileName, '.vue') === 'DocComment' ? getDocComment(ts, ir.scriptSetup, 1) : undefined,
			},
		};
	},
};

// the JSDoc of the `index`th statement of `block`, and `extra` chars after it
function getDocComment(ts, block, index, extra = 0) {
	const statement = block?.ast.statements[index];
	const [doc] = statement ? ts.getJSDocCommentsAndTags(statement) : [];
	return doc && { block, start: doc.getStart(block.ast), end: doc.end + extra };
}
