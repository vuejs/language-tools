<script setup lang="ts" generic="T extends string | number">
type InputProps = {
	type?: 'input';
	value: (k: T) => void;
	typeDefinition: T;
}

type SelectProps = {
	type: 'select';
	value: (k: T[]) => void;
	typeDefinition: T;
}

defineProps<InputProps | SelectProps>()
</script>
