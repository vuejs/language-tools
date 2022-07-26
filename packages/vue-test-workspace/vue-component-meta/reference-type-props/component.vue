<script setup lang="ts">
import { MyProps } from './my-props';

withDefaults(defineProps<MyProps>(), {
	foo:'sample',
	bar:1,
});
</script>
