<script lang="ts">
import { exactType } from '../shared';
import { defineComponent, PropType, ref } from 'vue';
import ScriptSetup from './script-setup.vue';
import ScriptSetupExpose from './script-setup-expose.vue';
import ScriptSetupTypeOnly from './script-setup-type-only.vue';
import ScriptSetupDefaultProps from './script-setup-default-props.vue';
import ScriptSetupGeneric from './script-setup-generic.vue';
import ShortDefineSlots from './short-define-slots.vue';

// https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits
const ScriptSetupExact = defineComponent({
	props: {
		foo: String,
	},
	emits: ['change', 'delete'],
	setup() {
		return {};
	},
});
// https://vuejs.org/api/sfc-script-setup.html#defineexpose
const ScriptSetupExposeExact = defineComponent({
	setup() {
		const a = 1
		const b = ref(2)
		return {
			a,
			b
		};
	},
});
// https://vuejs.org/api/sfc-script-setup.html#typescript-only-features
const ScriptSetupTypeOnlyExact = defineComponent({
	props: {
		foo: {
			type: String,
			required: true
		},
		bar: Number
	},
	emits: {
		change(_id: number) { },
		update(_value: string) { },
	},
	setup() {
		return {};
	},
});
// https://vuejs.org/api/sfc-script-setup.html#default-props-values-when-using-type-declaration
const ScriptSetupDefaultPropsExact = defineComponent({
	props: {
		msg: {
			type: String,
			default: 'hello'
		},
		labels: {
			type: Array as PropType<string[]>,
			default: () => ['one', 'two']
		},
	},
	setup() {
		return {};
	},
});
// vue 3.3 generic
declare const ScriptSetupGenericExact: <T, >(
	_props: import('vue').VNodeProps & NonNullable<typeof _setup>['props'],
	_ctx: Pick<NonNullable<typeof _setup>, 'expose' | 'attrs' | 'emit' | 'slots'>,
	_setup?: {
		props: { foo: T } & { [K in keyof JSX.ElementChildrenAttribute]?: { default(data: T): any } },
		attrs: any,
		slots: { default(data: T): any },
		emit: { (e: 'bar', data: T): void },
		expose(_exposed: { baz: T }): void,
	}
) => any;

exactType(ScriptSetup, ScriptSetupExact);
exactType(ScriptSetupExpose, ScriptSetupExposeExact);
exactType(ScriptSetupTypeOnly, ScriptSetupTypeOnlyExact);
exactType(ScriptSetupDefaultProps, ScriptSetupDefaultPropsExact);
exactType(ScriptSetupGeneric, ScriptSetupGenericExact);
exactType((new ShortDefineSlots()).$slots.foo, {} as ((props: {
	id: string;
} | undefined) => any) | undefined);
exactType((new ShortDefineSlots()).$slots.bar, {} as (props: {
	id: number;
}) => any);
</script>
