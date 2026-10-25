import type { TsCode } from '../../boundary';
import { newLine } from './index';

export function* generateIntersectMerge(...codes: TsCode[]): Generator<TsCode> {
	yield codes[0]!;
	for (let i = 1; i < codes.length; i++) {
		yield ` & `;
		yield codes[i]!;
	}
}

/** Spreads the expressions, each a string or the codes it generates. */
export function* generateSpreadMerge(...exps: (string | TsCode[])[]): Generator<TsCode> {
	if (exps.length <= 1) {
		yield* exps.flat();
	}
	else {
		yield `{${newLine}`;
		for (const exp of exps) {
			yield `...`;
			yield* typeof exp === 'string' ? [exp] : exp;
			yield `,${newLine}`;
		}
		yield `}`;
	}
}
