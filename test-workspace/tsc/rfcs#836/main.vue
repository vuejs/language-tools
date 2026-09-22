<script lang="ts" setup>
import { exactType } from '../shared';

	defineProps<{
		foo: string;
	}>();

	defineModel("bar", {
		default(props) {
			exactType(props.foo, {} as string);
		}
	});
</script>
