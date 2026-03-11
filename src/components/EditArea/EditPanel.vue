<template>
  <div 
    v-if="selectedObject" 
    class="edit-panel" 
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <!-- 拖拽把手/标题栏 -->
    <div class="panel-header" @mousedown="startDrag">
      <span class="title">编辑属性</span>
      <span class="close-btn" @mousedown.stop @click="handleClose">×</span>
    </div>
    
    <div class="edit-content">
      <div class="edit-form">
        <div v-if="selectedObject.parkingNumber !== undefined" class="form-group">
          <label>车位号:</label>
          <input
            type="text"
            :value="selectedObject.parkingNumber || ''"
            @input="updateProperty('parkingNumber', $event.target.value)"
            @mousedown.stop
            placeholder="输入车位号"
          />
        </div>
        
        <div class="row-group">
          <div class="form-group half">
            <label>X坐标:</label>
            <input
              type="number"
              :value="selectedObject.left"
              @input="updateProperty('left', $event.target.value)"
              @mousedown.stop
            />
          </div>
          <div class="form-group half">
            <label>Y坐标:</label>
            <input
              type="number"
              :value="selectedObject.top"
              @input="updateProperty('top', $event.target.value)"
              @mousedown.stop
            />
          </div>
        </div>

        <div class="row-group">
          <div class="form-group half">
            <label>宽度:</label>
            <input
              type="number"
              :value="selectedObject.width"
              @input="updateProperty('width', $event.target.value)"
              @mousedown.stop
            />
          </div>
          <div class="form-group half">
            <label>高度:</label>
            <input
              type="number"
              :value="selectedObject.height"
              @input="updateProperty('height', $event.target.value)"
              @mousedown.stop
            />
          </div>
        </div>

        <div class="form-group">
          <label>旋转角度:</label>
          <input
            type="number"
            :value="selectedObject.angle"
            @input="updateProperty('angle', $event.target.value)"
            @mousedown.stop
            min="0"
            max="360"
          />
        </div>
        <div class="form-group">
          <label>颜色:</label>
          <div class="color-picker-wrapper">
             <input
              type="color"
              :value="selectedObject.fill || '#000000'"
              @input="updateProperty('fill', $event.target.value)"
              @mousedown.stop
            />
            <span>{{ selectedObject.fill || '#000000' }}</span>
          </div>
        </div>

        <!-- 附加标签（附属于矩形的额外位置信息） -->
        <div v-if="selectedObject.label !== undefined" class="label-section">
          <div class="label-section-header" @mousedown.stop>
            <span class="label-section-title">附加标签</span>
          </div>
          <div class="label-form">
            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="selectedObject.label.visible"
                  @change="updateLabelProperty('visible', $event.target.checked)"
                  @mousedown.stop
                />
                <span>显示标签</span>
              </label>
            </div>
            <template v-if="selectedObject.label.visible">
              <div class="form-group">
                <label>位置（相对矩形）:</label>
                <select
                  :value="selectedObject.label.position"
                  @input="updateLabelProperty('position', $event.target.value)"
                  @mousedown.stop
                >
                  <option value="top">上</option>
                  <option value="bottom">下</option>
                  <option value="left">左</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div class="form-group">
                <label>边距 (px):</label>
                <input
                  type="number"
                  :value="selectedObject.label.margin"
                  @input="updateLabelProperty('margin', $event.target.value)"
                  @mousedown.stop
                  min="0"
                />
              </div>
              <div class="row-group">
                <div class="form-group half">
                  <label>左右平移 (px):</label>
                  <input
                    type="number"
                    :value="selectedObject.label.offsetX"
                    @input="updateLabelProperty('offsetX', $event.target.value)"
                    @mousedown.stop
                  />
                </div>
                <div class="form-group half">
                  <label>上下平移 (px):</label>
                  <input
                    type="number"
                    :value="selectedObject.label.offsetY"
                    @input="updateLabelProperty('offsetY', $event.target.value)"
                    @mousedown.stop
                  />
                </div>
              </div>
              <div class="form-group">
                <label>名称（默认车位号）:</label>
                <input
                  type="text"
                  :value="selectedObject.label.name || ''"
                  @input="updateLabelProperty('name', $event.target.value)"
                  @mousedown.stop
                  placeholder="留空则显示车位号"
                />
              </div>
              <div class="form-group">
                <label>标签旋转角度:</label>
                <input
                  type="number"
                  :value="selectedObject.label.angle"
                  @input="updateLabelProperty('angle', $event.target.value)"
                  @mousedown.stop
                  min="0"
                  max="360"
                />
              </div>
              <div class="form-group">
                <label>字体大小:</label>
                <input
                  type="number"
                  :value="selectedObject.label.fontSize"
                  @input="updateLabelProperty('fontSize', $event.target.value)"
                  @mousedown.stop
                  min="8"
                />
              </div>
              <div class="form-group">
                <label>标签颜色:</label>
                <div class="color-picker-wrapper">
                  <input
                    type="color"
                    :value="selectedObject.label.fill || '#000000'"
                    @input="updateLabelProperty('fill', $event.target.value)"
                    @mousedown.stop
                  />
                  <span>{{ selectedObject.label.fill || '#000000' }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <button class="delete-btn" @click="handleDelete" @mousedown.stop>删除选中对象</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EditPanel',
  props: {
    selectedObject: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      dragging: false,
      dragStartX: 0,
      dragStartY: 0,
      // 初始位置
      x: window.innerWidth - 670, 
      y: 70,
    };
  },
  mounted() {
    // 确保初始位置在屏幕内
    if (this.x < 0) this.x = 20;
  },
  methods: {
    startDrag(e) {
      if (e.target.closest('input') || e.target.closest('button')) return;
      
      this.dragging = true;
      this.dragStartX = e.clientX - this.x;
      this.dragStartY = e.clientY - this.y;
      
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.stopDrag);
    },
    onDrag(e) {
      if (!this.dragging) return;
      this.x = e.clientX - this.dragStartX;
      this.y = e.clientY - this.dragStartY;
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    updateProperty(property, value) {
      this.$emit('update-property', property, value);
    },
    updateLabelProperty(subKey, value) {
      const numProps = ['margin', 'offsetX', 'offsetY', 'angle', 'fontSize'];
      if (numProps.includes(subKey) && value !== '' && !isNaN(Number(value))) {
        value = Number(value);
      }
      this.$emit('update-property', `label.${subKey}`, value);
    },
    handleDelete() {
      this.$emit('delete-object');
    },
    handleClose() {
      // 通过让父组件清除 selection 来关闭
      this.$emit('close');
    }
  },
};
</script>

<style scoped>
.edit-panel {
  position: fixed; /* 悬浮定位 */
  width: 280px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  z-index: 1000; /* 确保在最上层 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 10px 15px;
  background: #d9eeff;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab; /* 抓手光标 */
  user-select: none;
}

.panel-header:active {
  cursor: grabbing;
}

.title {
  font-weight: bold;
  font-size: 14px;
  color: #333;
}

.close-btn {
  cursor: pointer;
  font-size: 20px;
  color: #999;
  line-height: 1;
}

.close-btn:hover {
  color: #666;
}

.edit-content {
  padding: 15px;
  max-height: 80vh;
  overflow-y: auto;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row-group {
  display: flex;
  gap: 10px;
}

.form-group.half {
  flex: 1;
}

.form-group label {
  font-size: 12px;
  color: #666;
}

.form-group input {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 15px;
  width: 100%;
  box-sizing: border-box;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker-wrapper input[type="color"] {
  width: 40px;
  height: 30px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.color-picker-wrapper span {
  font-size: 12px;
  color: #666;
  font-family: monospace;
}

.delete-btn {
  margin-top: 5px;
  padding: 8px;
  background: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.delete-btn:hover {
  background: #ff7875;
}

.label-section {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.label-section-header {
  margin-bottom: 8px;
}

.label-section-title {
  font-weight: bold;
  font-size: 13px;
  color: #333;
}

.label-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkbox-group {
  margin-bottom: 0;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.label-form select {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}
</style>