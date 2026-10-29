<script setup>
import { exactType } from '../shared';

const props = defineProps({ n: Number });
defineModel({
	default: (props) => {
		exactType(props.n, /** @type {number | undefined} */ (undefined));
		return 0;
	},
});
exactType(props.n, /** @type {number | undefined} */ (undefined));
</script>
