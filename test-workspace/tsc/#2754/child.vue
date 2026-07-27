<script lang="ts" setup generic="Row extends unknown">
defineProps({
    selectAll: {
        type: Boolean,
        required: false,
        default: false as unknown as Row,
    },
});
</script>
