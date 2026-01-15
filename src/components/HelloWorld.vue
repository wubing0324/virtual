<template>
  <div class="scroll-container">
    <virtual-list
      ref="virtualList"
      class="list"
      :data-key="'id'"
      :data-sources="virtualData"
      :data-component="ListItem"
      :estimate-size="50"
      @scroll="handleScroll"
    />
  </div>
</template>

<script>
import VirtualList from "vue-virtual-scroll-list";
import ListItem from "./ListItem.vue";

export default {
  components: {
    VirtualList,
  },
  data() {
    return {
      ListItem: ListItem,
      originalData: Array.from({ length: 20 }, (_, i) => ({
        id: i,
        text: `Item ${i}`,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      })),
      scrollSpeed: 2, // 控制滚动速度
      animationFrameId: null, // 记录 requestAnimationFrame ID
      isResetting: false, // 是否正在重置滚动位置
      lastScrollTop: 0, // 记录上次滚动位置
    };
  },
  computed: {
    virtualData() {
      // 复制三份数据，确保滚动时的连续性
      return [...this.originalData, ...this.originalData];
    },
  },
  mounted() {
    this.startAutoScroll();
  },
  methods: {
    handleScroll(event) {
      const list = event.target;
      const scrollHeight = list.scrollHeight / 2; // 获取一组数据的高度
      console.log('ooooo')
      // 检测是否是向下滚动
      const isScrollingDown = list.scrollTop > this.lastScrollTop;
      this.lastScrollTop = list.scrollTop;
      console.log(isScrollingDown, list.scrollTop, scrollHeight)
      if (isScrollingDown && list.scrollTop >= scrollHeight) {
        // 当滚动到第二组数据时，立即重置到第一组相同位置
        list.scrollTop = list.scrollTop % scrollHeight;
        console.log(list.scrollTop, scrollHeight)
      }
    },
    startAutoScroll() {
      const list = this.$refs.virtualList.$el;
      const smoothScroll = () => {
        if (!list) return;
        list.scrollTop += this.scrollSpeed;
        this.animationFrameId = requestAnimationFrame(smoothScroll);
      };
      this.animationFrameId = requestAnimationFrame(smoothScroll);
    },
    stopAutoScroll() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
    },
  },
  beforeDestroy() {
    this.stopAutoScroll();
  },
};
</script>

<style scoped>
.scroll-container {
  height: 300px;
  border: 1px solid #ddd;
}
.list {
  height: 100%;
  overflow-y: auto;
  /* scroll-behavior: smooth; */
}
</style>
