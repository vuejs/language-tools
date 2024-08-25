<script setup lang="ts" generic="T">
interface Props {
    foo: T;
}
defineProps<Props>();
</script>
