<script lang="ts">
import { exactType } from 'vue-tsc/shared';
import { defineComponent, PropType } from 'vue';
import ScriptSetup from './script-setup.vue';

const ScriptSetupExact = defineComponent({
	props: {} as {
		modelValue: PropType<string>;
		c: { type: PropType<number>, required: true };
		d: PropType<number>;
		e: PropType<string>;
		f: { type: PropType<string>, required: true };
		g: PropType<string>;
	},
	setup() {
		return {};
	},
});

exactType(ScriptSetup, ScriptSetupExact);
</script>
