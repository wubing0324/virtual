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
        { type: 'line', name: '直线', icon: '─' },
        { type: 'text', name: '文本', icon: 'T' },
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
  border-bottom: 1px solid #eee;
  max-height: 300px;
  overflow-y: auto;
}

.section-title {
  font-weight: bold;
  margin-bottom: 15px;
  color: #333;
  font-size: 14px;
}

.shapes-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.shape-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
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