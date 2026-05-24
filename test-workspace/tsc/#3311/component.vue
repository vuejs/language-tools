<script lang="ts">
type SwitchByBoolean<T extends boolean, V> = false extends T ? V : V[];
</script>

<script lang="ts" setup generic="T extends boolean, V extends SwitchByBoolean<T, string>">
defineProps<{
	modelValue?: V;
	multiple?: T;
}>();
</script>
