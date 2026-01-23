<template>
  <div class="shape-library">
    <div class="section-title">可用图形</div>
    <div class="shapes-list">
      <div
        v-for="shape in availableShapes"
        :key="shape.type"
        class="shape-item"
        draggable="true"
        @dragstart="handleDragStart($event, shape)"
        @dragend="handleDragEnd"
      >
        <div class="shape-preview" :class="`shape-${shape.type}`">
          <span class="shape-icon">{{ shape.icon }}</span>
        </div>
        <div class="shape-name">{{ shape.name }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ShapeLibrary',
  data() {
    return {
      availableShapes: [
        { type: 'rect', name: '矩形', icon: '▭' },
        { type: 'circle', name: '圆形', icon: '○' },
        { type: 'triangle', name: '三角形', icon: '△' },
        // { type: 'line', name: '直线', icon: '─' },
        // { type: 'text', name: '文本', icon: 'T' },
      ],
    };
  },
  methods: {
    handleDragStart(event, shape) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(shape));
    },
    handleDragEnd() {
      // 拖拽结束处理
    },
  },
};
</script>

<style scoped>
.shape-library {
  padding: 15px;
  /* 移除底部边框和固定高度 */
  /* border-bottom: 1px solid #eee; */
  /* max-height: 300px; */
  height: 100%; /* 撑满父容器 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 禁止整体滚动 */
}

.section-title {
  font-weight: bold;
  margin-bottom: 15px;
  color: #333;
  font-size: 14px;
  flex-shrink: 0; /* 标题不收缩 */
}

.shapes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  /* 添加滚动支持 */
  flex: 1;
  overflow-y: auto; 
  padding-bottom: 10px; /* 底部留点空隙 */
  align-content: flex-start; /* 内容从上对齐，防止稀疏拉伸 */
}

.shape-item {
  /* 使用 flex 布局实现 2 列：(100% - gap) / 2 */
  width: calc(50% - 5px);
  height: 110px; /* 固定高度，保持整齐 */
  box-sizing: border-box;
  
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* 垂直居中 */
  
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s;
  background: white;
}

.shape-item:hover {
  border-color: #4CAF50;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.shape-item:active {
  cursor: grabbing;
}

.shape-preview {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 4px;
  margin-bottom: 8px;
}

.shape-icon {
  font-size: 32px;
  color: #333;
}

.shape-name {
  font-size: 12px;
  color: #666;
  text-align: center;
}
</style>