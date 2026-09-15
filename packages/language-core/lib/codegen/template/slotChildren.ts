import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';

/** Each entry is a tuple member (possibly a spread) in the current render scope. */
export function* generateSlotChildrenCheck(
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotType: string,
	children: string[],
): Generator<Code> {
	yield `((): ${ctx.localTypes.SlotChildrenCheck}<[${children.join(', ')}], ${slotType}> => (`;
	const token = yield* startBoundary('template', node.loc.start.offset, codeFeatures.verification);
	yield `[]`;
	yield endBoundary(token, node.loc.end.offset);
	yield `))${endOfLine}`;
}

/** Capture block-local types in a function-scoped variable without moving code. */
export function* generateSlotChildrenVar(ctx: TemplateCodegenContext): Generator<Code, string> {
	const name = ctx.getInternalVariable();
	yield `var ${name} = {} as [${ctx.slotChildren!.join(', ')}]${endOfLine}`;
	return `typeof ${ctx.getHoistVariable(name)}`;
}

export function* generateMissingSlotChildrenCheck(
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	contextType: string,
	providers: string[],
): Generator<Code> {
	yield `((): ${ctx.localTypes.MissingSlotChildren}<${contextType}, ${providers.join(' & ') || '{}'}> => (`;
	const token = yield* startBoundary('template', node.loc.start.offset, codeFeatures.verification);
	yield `[]`;
	yield endBoundary(token, node.loc.end.offset);
	yield `))${endOfLine}`;
}
