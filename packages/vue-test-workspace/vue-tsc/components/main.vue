<script lang="ts">
import { exactType } from '../shared';
import { defineComponent, ref } from 'vue';
import ScriptSetup from './script-setup.vue';
import ScriptSetupExpose from './script-setup-expose.vue';
import ScriptSetupTypeOnly from './script-setup-type-only.vue';

// https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits
exactType(ScriptSetup, defineComponent({
	props: {
		foo: String,
	},
	emits: ['change', 'delete'],
	setup() {
		return {};
	},
}));
// https://vuejs.org/api/sfc-script-setup.html#defineexpose
exactType(ScriptSetupExpose, defineComponent({
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
exactType(ScriptSetupTypeOnly, defineComponent({
	props: {
		foo: {
			type: String,
			required: true
		},
		bar: {
			type: Number,
			required: false
		},
	},
	emits: {
		change(_id: number) {},
		update(_value: string) {},
	},
	setup() {
		return {};
	},
}));
</script>
