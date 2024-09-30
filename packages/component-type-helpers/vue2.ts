export {
	ComponentType,
	ComponentProps,
	ComponentEmit,
	ComponentExposed,
} from './index';

export type ComponentSlots<T> =
	T extends new (...args: any) => { $scopedSlots: infer S; } ? NonNullable<S> :
	T extends (props: any, ctx: { slots: infer S; attrs: any; emit: any; }, ...args: any) => any ? NonNullable<S> :
	{};

import { code as _code } from './index';

export const code = _code.replace('$slots', '$scopedSlots');

export default code;
