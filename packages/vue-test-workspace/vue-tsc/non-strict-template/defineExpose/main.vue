<script setup lang="ts">
import { exactType } from '../../shared';
import Comp from './Comp.vue';

exactType(new Comp().foo, {} as number);
</script>
