<script setup lang="ts">
import { exactType } from '../shared';

const props = defineProps({ n: Number });
defineModel<number>({
	default: (props) => {
		exactType(props.n, {} as number | undefined);
		return 0;
	},
});
exactType(props.n, {} as number | undefined);
</script>
