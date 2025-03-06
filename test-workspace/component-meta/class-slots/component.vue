<script lang="ts">
import type { VNode } from 'vue';

export default {} as new () => {
	$slots: {
		default: (props: { num: number; }) => VNode[];
		foo: (props: { str: string; }) => VNode[];
	};
};
</script>
