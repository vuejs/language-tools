import * as CompilerDOM from '@vue/compiler-dom';
import { describe, expect, it } from 'vitest';
import { baseParse } from '../lib/baseParse';

describe('baseParse', () => {
	describe('multiline class binding with backticks', () => {
		it('should parse multiline :class attribute with backtick template string', () => {
			const pugCode = `span(
  v-tooltip="{ text: 'Hello' }"
  @click="onClick('item')"
  :class=\`[
    "my-component__element",
    "my-component__modifier",
    {
      "my-component__element--active my-component__element--highlighted": (isActive === 'yes')
    }
  ]\`
  data-testid="my-element"
)`;

			const result = baseParse(pugCode);

			expect(result.error).toBeUndefined();
			expect(result.htmlCode).toContain('<span');
			expect(result.htmlCode).toContain(':class=');
		});

		it('should correctly convert backtick to double quotes when no double quotes inside', () => {
			const pugCode = `div(:class=\`['foo', 'bar']\`)`;

			const result = baseParse(pugCode);

			expect(result.error).toBeUndefined();
			expect(result.htmlCode).toContain(":class=\"['foo', 'bar']\"");
		});

		it('should correctly convert backtick to single quotes when double quotes inside', () => {
			const pugCode = `div(:class=\`["foo", "bar"]\`)`;

			const result = baseParse(pugCode);

			expect(result.error).toBeUndefined();
			expect(result.htmlCode).toContain(':class=\'["foo", "bar"]\'');
		});

		it('should handle multiline backtick values with newlines', () => {
			const pugCode = `div(
  :class=\`[
    "foo",
    "bar"
  ]\`
)`;

			const result = baseParse(pugCode);

			expect(result.error).toBeUndefined();
		});

		it('should produce valid HTML that Vue compiler can parse when both quote types present', () => {
			const pugCode = `span(
  v-tooltip="{ text: 'Hello' }"
  @click="onClick('item')"
  :class=\`[
    "my-component__element",
    "my-component__modifier",
    {
      "my-component__element--active my-component__element--highlighted": (state.type === 'active')
    }
  ]\`
  data-testid="my-element"
)`;

			const result = baseParse(pugCode);
			expect(result.error).toBeUndefined();

			const errors: any[] = [];
			CompilerDOM.parse(result.htmlCode, {
				onError(error) {
					errors.push(error);
				},
			});

			expect(errors).toHaveLength(0);
		});

		it('should convert inner single quotes to double quotes when both quote types present', () => {
			const pugCode = `div(:class=\`["foo", 'bar']\`)`;
			const result = baseParse(pugCode);

			expect(result.error).toBeUndefined();
			// Inner single quotes are converted to double quotes, outer delimiter becomes single quote
			expect(result.htmlCode).toContain(':class=\'["foo", "bar"]\'');
		});

		it('should produce valid JavaScript expression when both quote types present', () => {
			const pugCode = `div(:class=\`["foo", 'bar']\`)`;
			const result = baseParse(pugCode);

			const errors: any[] = [];
			const ast = CompilerDOM.parse(result.htmlCode, {
				onError(error) {
					errors.push(error);
				},
			});

			expect(errors).toHaveLength(0);

			const div = ast.children[0] as CompilerDOM.ElementNode;
			const classDir = div.props.find((p): p is CompilerDOM.DirectiveNode =>
				p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'bind'
			);

			// Single quotes in the original are converted to double quotes
			expect((classDir?.exp as CompilerDOM.SimpleExpressionNode)?.content).toBe('["foo", "bar"]');
		});
	});

	describe('indented template', () => {
		const indented = '\n  div(:class="x")\n\n    span {{ a }}\n  p\n';
		const dedented = indented.replace(/^ {2}/gm, '');

		it('parses as the template written without the indent', () => {
			const result = baseParse(indented);

			expect(result.error).toBeUndefined();
			expect(result.htmlCode.trim()).toBe(baseParse(dedented).htmlCode);
		});

		it('keeps the HTML at the offsets of a template tag around it', () => {
			const result = baseParse(indented);

			expect(result.htmlCode.startsWith(' '.repeat('<template>'.length) + '<div')).toBe(true);
			expect(result.htmlCode.endsWith('<p />' + ' '.repeat('</template>'.length))).toBe(true);
		});

		it('maps the HTML to the written template', () => {
			const result = baseParse(indented);

			expect(result.pugTextDocument.getText()).toBe(indented);
			expect(result.mappings.length).toBeGreaterThan(0);
			for (const [generatedStart, generatedLength, sourceStart, sourceLength] of result.mappings) {
				expect(result.htmlCode.slice(generatedStart, generatedStart + generatedLength))
					.toBe(indented.slice(sourceStart, sourceStart + sourceLength));
			}
		});

		it('reports the lines of the written template', () => {
			expect(collectLines(baseParse(indented).ast)).toEqual(collectLines(baseParse(dedented).ast));
		});

		it('reports the empty line ends of the written template', () => {
			const pugCode = '\n  div\n\n  p\n';
			const result = baseParse(pugCode);

			expect(result.emptyLineEnds).toEqual([pugCode.indexOf('\n\n') + 1]);
		});

		it('reports an error at the line of the written template', () => {
			const broken = '\n  div\n    span(title="x"\n  p\n';
			const result = baseParse(broken);

			expect(result.error?.code).toBe('PUG:NO_END_BRACKET');
			expect(result.error?.line).toBe(baseParse(broken.replace(/^ {2}/gm, '')).error?.line);
		});
	});
});

function collectLines(node: unknown, lines: number[] = []) {
	if (node && typeof node === 'object') {
		if ('line' in node && typeof node.line === 'number') {
			lines.push(node.line);
		}
		for (const value of Object.values(node)) {
			collectLines(value, lines);
		}
	}
	return lines;
}
