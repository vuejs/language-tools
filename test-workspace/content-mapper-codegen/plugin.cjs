// The codegen plugin of the content-mapper-codegen fixture.
const path = require('node:path');

exports.codegen = () => ({
	contribute({ ts, fileName, ir }) {
		const name = path.basename(fileName, '.vue');
		const scriptEdits = [];
		for (const block of [ir.script, ir.scriptSetup]) {
			if (block) {
				// `useFoo()` → `useFoo<number>()`
				block.ast.forEachChild(function visit(node) {
					if (
						ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useFoo'
						&& !node.typeArguments
					) {
						scriptEdits.push({ block, start: node.expression.end, end: node.expression.end, code: ['<number>'] });
					}
					node.forEachChild(visit);
				});
			}
		}
		return {
			scriptEdits,
			templateContext: name.startsWith('TemplateContext') ? [['{ $foo: number }']] : [],
		};
	},
});
