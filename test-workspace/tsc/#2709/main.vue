<script lang="ts">
import { defineComponent } from 'vue';
import Child from './child.vue';

export default defineComponent({
	components: {
		Child, // <-- error: No overload matches this call
	},
});
</script>
