<script setup lang="ts">
import { MyProps } from './my-props';

withDefaults(defineProps<MyProps>(), {
	bar: 1,
	baz: () => ['foo', 'bar'],
});
</script>
