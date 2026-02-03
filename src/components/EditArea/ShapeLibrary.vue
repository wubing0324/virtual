<template>
  <div class="shape-library">
    <!-- <div class="section-title">可用图形</div>
    <div class="shapes-list">
      <div
        v-for="shape in availableShapes"
        :key="shape.type"
        class="shape-item"
        draggable="true"
        @dragstart="handleDragStart($event, shape)"
      >
        <div class="shape-preview" :class="`shape-${shape.type}`">
          <span class="shape-icon">{{ shape.icon }}</span>
        </div>
        <div class="shape-name">{{ shape.name }}</div>
      </div>
    </div> -->

    <!-- 批量创建区域 -->
    <div class="batch-create-section">
      <div class="section-title">批量创建矩形</div>
      <div class="batch-form">
        <div class="form-row">
          <label>宽度:</label>
          <input 
            type="number" 
            v-model.number="batchConfig.width" 
            min="10" 
            max="1000"
            placeholder="宽度"
          />
        </div>
        <div class="form-row">
          <label>高度:</label>
          <input 
            type="number" 
            v-model.number="batchConfig.height" 
            min="10" 
            max="1000"
            placeholder="高度"
          />
        </div>
        <div class="form-row">
          <label>角度:</label>
          <input 
            type="number" 
            v-model.number="batchConfig.angle" 
            min="0" 
            max="360"
            placeholder="角度"
          />
        </div>
        <div class="form-row">
          <label>个数:</label>
          <input 
            type="number" 
            v-model.number="batchConfig.count" 
            min="1" 
            max="50"
            placeholder="个数"
          />
        </div>
        <button 
          class="create-btn" 
          @click="createBatchShapes"
          :disabled="!canCreate"
        >
          创建
        </button>
      </div>

      <!-- 创建的图形列表 -->
      <div v-if="createdShapes.length > 0" class="created-shapes-section">
        <div class="section-title">已创建图形 ({{ createdShapes.length }})</div>
        <div class="created-shapes-list">
          <div
            v-for="(shape, index) in createdShapes"
            :key="shape.id"
            class="created-shape-item"
            draggable="true"
            @dragstart="handleCreatedShapeDragStart($event, shape, index)"
            @dragend="handleDragEnd"
            :title="`${shape.width}×${shape.height} @ ${shape.angle}°`"
          >
            <div 
              class="shape-rect-preview"
              :style="getShapePreviewStyle(shape)"
            ></div>
            <button 
              class="delete-shape-btn" 
              @click.stop="deleteCreatedShape(index)"
              title="删除"
            >
              ×
            </button>
          </div>
        </div>
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
      batchConfig: {
        width: 100,
        height: 100,
        angle: 180,
        count: 1,
      },
      createdShapes: [], // 存储批量创建的图形
      draggingShapeIndex: null, // 当前正在拖拽的图形索引
    };
  },
  computed: {
    canCreate() {
      return this.batchConfig.width > 0 && 
             this.batchConfig.height > 0 && 
             this.batchConfig.count > 0 && 
             this.batchConfig.count <= 50;
    },
  },
  methods: {
    handleDragStart(event, shape) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(shape));
    },
    createBatchShapes() {
      if (!this.canCreate) return;
      
      const newShapes = [];
      for (let i = 0; i < this.batchConfig.count; i++) {
        const shape = {
          id: `batch_rect_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'rect',
          width: this.batchConfig.width,
          height: this.batchConfig.height,
          angle: this.batchConfig.angle || 0,
          isBatchCreated: true, // 标记为批量创建
        };
        newShapes.push(shape);
      }
      
      this.createdShapes.push(...newShapes);
    },
    deleteCreatedShape(index) {
      this.createdShapes.splice(index, 1);
    },
    deleteShapeById(shapeId) {
      const index = this.createdShapes.findIndex(shape => shape.id === shapeId);
      if (index !== -1) {
        this.createdShapes.splice(index, 1);
      }
    },
    handleCreatedShapeDragStart(event, shape, index) {
      event.dataTransfer.effectAllowed = 'copy';
      // 保存当前拖拽的图形索引，用于拖拽成功后删除
      this.draggingShapeIndex = index;
      // 传递完整的图形信息，包括自定义尺寸和角度
      event.dataTransfer.setData('application/json', JSON.stringify({
        type: shape.type,
        width: shape.width,
        height: shape.height,
        angle: shape.angle,
        isBatchCreated: true,
        shapeId: shape.id, // 添加 shapeId 用于追踪
      }));
    },
    handleDragEnd() {
      // 重置拖拽索引（实际删除由 shape-dropped 事件触发）
      this.draggingShapeIndex = null;
    },
    getShapePreviewStyle(shape) {
      // 直接显示真实尺寸，不做任何缩放
      // 计算旋转后的边界框大小，确保容器能容纳旋转后的图形
      const angle = (shape.angle || 0) * Math.PI / 180;
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      const rotatedWidth = shape.width * cos + shape.height * sin;
      const rotatedHeight = shape.width * sin + shape.height * cos;
      
      return {
        width: `${shape.width}px`,
        height: `${shape.height}px`,
        transform: `rotate(${shape.angle}deg)`,
        transformOrigin: 'center center',
        // 为旋转后的图形预留空间
        margin: `${Math.max(0, (rotatedHeight - shape.height) / 2)}px ${Math.max(0, (rotatedWidth - shape.width) / 2)}px`,
      };
    },
  },
};
</script>

<style scoped>
.shape-library {
  padding: 15px;
  height: 100%; /* 撑满父容器 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 禁止整体滚动 */
}

.section-title {
  font-weight: bold;
  margin-bottom: 12px;
  color: #333;
  font-size: 13px;
  flex-shrink: 0; /* 标题不收缩 */
}

.shapes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  overflow-y: auto;
  padding-bottom: 10px;
  align-content: flex-start;
  min-height: 0;
  flex-shrink: 0;
  max-height: 250px; /* 限制可用图形区域的高度 */
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

/* 批量创建区域 */
.batch-create-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.batch-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-row label {
  font-size: 12px;
  color: #666;
  min-width: 50px;
  flex-shrink: 0;
}

.form-row input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.form-row input:focus {
  outline: none;
  border-color: #4CAF50;
}

.create-btn {
  padding: 8px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;
}

.create-btn:hover:not(:disabled) {
  background: #45a049;
}

.create-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 已创建图形列表 */
.created-shapes-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.created-shapes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 10px;
  align-content: flex-start;
  min-height: 0;
  align-items: flex-start;
  justify-content: center;
}

.created-shape-item {
  position: relative;
  width: auto;
  height: auto;
  min-width: 60px;
  box-sizing: border-box;
  padding: 8px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.created-shape-item:hover {
  border-color: #4CAF50;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.created-shape-item:active {
  cursor: grabbing;
}

.custom-shape {
  min-width: 50px;
  min-height: 50px;
  width: auto;
  height: auto;
  max-width: 80px;
  max-height: 80px;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  overflow: visible;
}

.shape-rect-preview {
  background: rgba(76, 175, 80, 0.3);
  border: 2px solid #4CAF50;
  box-sizing: border-box;
  flex-shrink: 0;
}

.shape-info {
  font-size: 10px;
  color: #666;
  text-align: center;
  line-height: 1.3;
}

.shape-size {
  font-weight: 500;
}

.shape-angle {
  color: #999;
}

.delete-shape-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border: none;
  background: #ff4d4f;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.created-shape-item:hover .delete-shape-btn {
  opacity: 1;
}

.delete-shape-btn:hover {
  background: #ff7875;
}
</style>