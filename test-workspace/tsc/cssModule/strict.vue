<!-- @strictCssModules true -->

<script lang="ts" setup>
import { useCssModule } from 'vue';
import { exactType } from '../shared';

const style = useCssModule();
exactType(style, {} as {
    foo: string;
});
</script>

<style module>
.foo {}
</style>
