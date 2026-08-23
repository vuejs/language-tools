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
});
