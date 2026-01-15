<template>
  <div class="edit-panel">
    <div v-if="selectedObject" class="edit-content">
      <div class="section-title">编辑属性</div>
      <div class="edit-form">
        <div v-if="selectedObject.parkingNumber" class="form-group">
          <label>车位号:</label>
          <input
            type="text"
            :value="selectedObject.parkingNumber"
            disabled
            class="disabled-input"
          />
        </div>
        <div class="form-group">
          <label>X坐标:</label>
          <input
            type="number"
            :value="selectedObject.left"
            @input="updateProperty('left', $event.target.value)"
          />
        </div>
        <div class="form-group">
          <label>Y坐标:</label>
          <input
            type="number"
            :value="selectedObject.top"
            @input="updateProperty('top', $event.target.value)"
          />
        </div>
        <div class="form-group">
          <label>宽度:</label>
          <input
            type="number"
            :value="selectedObject.width"
            @input="updateProperty('width', $event.target.value)"
          />
        </div>
        <div class="form-group">
          <label>高度:</label>
          <input
            type="number"
            :value="selectedObject.height"
            @input="updateProperty('height', $event.target.value)"
          />
        </div>
        <div class="form-group">
          <label>旋转角度:</label>
          <input
            type="number"
            :value="selectedObject.angle"
            @input="updateProperty('angle', $event.target.value)"
            min="0"
            max="360"
          />
        </div>
        <div class="form-group">
          <label>颜色:</label>
          <input
            type="color"
            :value="selectedObject.fill || '#000000'"
            @input="updateProperty('fill', $event.target.value)"
          />
        </div>
        <button class="delete-btn" @click="handleDelete">删除选中对象</button>
      </div>
    </div>
    <div v-else class="edit-panel-placeholder">
      <p>点击画布中的元素进行编辑</p>
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
  methods: {
    updateProperty(property, value) {
      this.$emit('update-property', property, value);
    },
    handleDelete() {
      this.$emit('delete-object');
    },
  },
};
</script>

<style scoped>
.edit-panel {
  padding: 15px;
  flex: 1;
  overflow-y: auto;
}

.edit-content {
  display: flex;
  flex-direction: column;
}

.section-title {
  font-weight: bold;
  margin-bottom: 15px;
  color: #333;
  font-size: 14px;
}

.edit-panel-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.form-group input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input[type="color"] {
  height: 40px;
  cursor: pointer;
}

.disabled-input {
  background: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}

.delete-btn {
  margin-top: 10px;
  padding: 10px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.delete-btn:hover {
  background: #d32f2f;
}
</style>