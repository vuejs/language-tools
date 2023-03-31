<script lang="ts">
import { looserExactType } from '../shared';
import { defineComponent, PropType, ref } from 'vue';
import ScriptSetup from './script-setup.vue';
import ScriptSetupExpose from './script-setup-expose.vue';
import ScriptSetupTypeOnly from './script-setup-type-only.vue';
import ScriptSetupDefaultProps from './script-setup-default-props.vue';

// https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits
looserExactType(ScriptSetup, defineComponent({
	props: {
		foo: String,
	},
	emits: ['change', 'delete'],
	setup() {
		return {};
	},
}));
// https://vuejs.org/api/sfc-script-setup.html#defineexpose
looserExactType(ScriptSetupExpose, defineComponent({
	setup() {
		const a = 1
		const b = ref(2)
		return {
			a,
			b
		};
	},
}));
// https://vuejs.org/api/sfc-script-setup.html#typescript-only-features
looserExactType(ScriptSetupTypeOnly, defineComponent({
	props: {
		foo: {
			type: String,
			required: true
		},
		bar: Number
	},
	emits: {
		change(_id: number) {},
		update(_value: string) {},
	},
	setup() {
		return {};
	},
}));
// https://vuejs.org/api/sfc-script-setup.html#default-props-values-when-using-type-declaration
looserExactType(ScriptSetupDefaultProps, defineComponent({
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
}));
</script>
