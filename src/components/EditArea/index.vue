<template>
  <div class="edit-area">
    <!-- 编辑模式 -->
    <div class="edit-area-container">
      <!-- A区：画布区域 -->
      <CanvasArea
        ref="canvasArea"
        @canvas-ready="handleCanvasReady"
        @object-selected="handleObjectSelected"
        @selection-cleared="handleSelectionCleared"
        @object-modified="handleObjectModified"
      />

      <!-- B区：图形库、识别和编辑面板 -->
      <div class="area-b">
        <div class="area-header">工具面板 (B区)</div>
        
        <!-- 车位识别工具 -->
        <div class="recognizer-section">
          <div class="section-title">车位识别</div>
          <ParkingSpaceRecognizer
            ref="recognizer"
            @spaces-recognized="handleSpacesRecognized"
          />
        </div>

        <!-- 图形库 -->
        <div class="shapes-section">
          <div class="section-title">图形库</div>
          <ShapeLibrary />
        </div>

        <!-- 编辑面板 -->
        <EditPanel
          :selected-object="selectedObject"
          @update-property="handleUpdateProperty"
          @delete-object="handleDeleteObject"
        />
      </div>
    </div>
  </div>
</template>

<script>
import CanvasArea from './CanvasArea.vue';
import ShapeLibrary from './ShapeLibrary.vue';
import EditPanel from './EditPanel.vue';
import ParkingSpaceRecognizer from './ParkingSpaceRecognizer.vue';

export default {
  name: 'EditArea',
  components: {
    CanvasArea,
    ShapeLibrary,
    EditPanel,
    ParkingSpaceRecognizer,
  },
  data() {
    return {
      canvas: null,
      selectedObject: null,
      recognizedSpaces: [],
    };
  },
  methods: {
    handleCanvasReady(canvas) {
      this.canvas = canvas;
    },
    handleObjectSelected(selectedData) {
      this.selectedObject = selectedData;
    },
    handleSelectionCleared() {
      this.selectedObject = null;
    },
    handleObjectModified(updatedData) {
      if (this.selectedObject) {
        Object.assign(this.selectedObject, updatedData);
      }
    },
    handleUpdateProperty(property, value) {
      if (!this.selectedObject || !this.selectedObject.fabricObject || !this.canvas) return;

      const obj = this.selectedObject.fabricObject;
      const numValue = parseFloat(value);

      if (property === 'width' || property === 'height') {
        const scale = property === 'width' 
          ? numValue / (obj.width || 1)
          : numValue / (obj.height || 1);
        obj.set({
          scaleX: property === 'width' ? scale : (obj.scaleX || 1),
          scaleY: property === 'height' ? scale : (obj.scaleY || 1),
        });
      } else {
        obj.set(property, isNaN(numValue) ? value : numValue);
      }

      this.canvas.renderAll();
      
      // 更新选中对象的数据
      if (property !== 'fill') {
        this.selectedObject[property] = isNaN(numValue) ? value : numValue;
      } else {
        this.selectedObject.fill = value;
      }
    },
    handleDeleteObject() {
      if (this.selectedObject && this.selectedObject.fabricObject) {
        this.canvas.remove(this.selectedObject.fabricObject);
        this.canvas.renderAll();
        this.selectedObject = null;
      }
    },
    handleSpacesRecognized(spaces) {
      this.recognizedSpaces = spaces;
      console.log('识别到的车位数据:', spaces);
      
      // 将识别到的车位添加到画布上
      if (this.canvas && spaces.length > 0) {
        // 在画布上创建车位矩形
        spaces.forEach((space) => {
          this.createParkingSpace(space);
        });
      }
    },
    createParkingSpace(space) {
      if (!this.canvas) return;

      const { Rect, Text } = require('fabric');
      
      // 创建车位矩形
      const rect = new Rect({
        left: space.x,
        top: space.y,
        width: space.width,
        height: space.height,
        angle: space.angle || 0,
        fill: 'rgba(0, 255, 0, 0.2)', // 半透明绿色
        stroke: '#00ff00',
        strokeWidth: 2,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      // 添加车位信息
      const spaceId = `parking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      rect.set({
        id: spaceId,
        parkingNumber: space.number || null,
        originX: 'left',
        originY: 'top',
      });

      // 如果有车位号，添加文本标签（作为矩形的一部分，跟随移动）
      if (space.number) {
        const text = new Text(space.number, {
          left: space.x + 5,
          top: space.y + 5,
          fontSize: 14,
          fill: '#00ff00',
          fontFamily: 'Arial',
          selectable: false,
          evented: false,
          parkingSpaceId: spaceId, // 关联到车位矩形
        });
        
        // 将文本添加到画布
        this.canvas.add(text);
        
        // 监听矩形移动，同步更新文本位置
        rect.on('moving', () => {
          text.set({
            left: rect.left + 5,
            top: rect.top + 5,
          });
          this.canvas.renderAll();
        });
        
        // 监听矩形旋转，同步更新文本
        rect.on('rotating', () => {
          text.set({
            left: rect.left + 5,
            top: rect.top + 5,
            angle: rect.angle,
          });
          this.canvas.renderAll();
        });
      }

      this.canvas.add(rect);
      this.canvas.renderAll();
    },
  },
};
</script>

<style scoped>
.edit-area {
  width: 100%;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.edit-area-container {
  display: flex;
  flex: 1;
  gap: 20px;
  overflow: hidden;
}

.area-b {
  width: 350px;
  display: flex;
  flex-direction: column;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.area-header {
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
  font-size: 16px;
}

.recognizer-section {
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.shapes-section {
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.section-title {
  font-weight: bold;
  margin-bottom: 10px;
  color: #333;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .edit-area-container {
    flex-direction: column;
  }
  
  .area-b {
    width: 100%;
    max-height: 400px;
  }
}
</style>