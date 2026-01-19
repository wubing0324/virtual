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

      <!-- B区：工具面板和编辑面板 -->
      <div class="area-b">
        <div class="area-header">工具面板 (B区)</div>
        
        <!-- Tab 切换 -->
        <div class="tab-container">
          <div class="tabs">
            <button
              :class="['tab-btn', { active: activeTab === 'recognize' }]"
              @click="activeTab = 'recognize'"
            >
              车位识别
            </button>
            <button
              :class="['tab-btn', { active: activeTab === 'shapes' }]"
              @click="activeTab = 'shapes'"
            >
              图形库
            </button>
          </div>
          
          <!-- Tab 内容 -->
          <div class="tab-content">
            <!-- 车位识别 Tab -->
            <div v-show="activeTab === 'recognize'" class="tab-panel recognize-panel">
              <ParkingSpaceRecognizer
                ref="recognizer"
                @spaces-recognized="handleSpacesRecognized"
              />
              
              <!-- 识别结果列表 -->
              <div v-if="recognizedSpaces.length > 0" class="spaces-list">
                <div class="list-header">
                  <span>识别结果 ({{ recognizedSpaces.length }} 个)</span>
                  <button class="sort-btn" @click="sortSpaces" title="重新排序">
                    <span class="icon">⇅</span> 排序
                  </button>
                </div>
                <div class="list-items">
                  <div
                    v-for="(space, index) in recognizedSpaces"
                    :key="index"
                    class="space-item"
                    :class="{ active: selectedSpaceIndex === index }"
                    @click="focusOnSpace(space, index)"
                  >
                    <div class="space-item-content">
                      <div class="space-number">
                        {{ space.number || `车位 ${index + 1}` }}
                      </div>
                      <div class="space-info">
                        <span>尺寸: {{ space.width.toFixed(2) }} × {{ space.height.toFixed(2) }}</span>
                        <span v-if="space.angle">角度: {{ space.angle }}°</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 图形库 Tab -->
            <div v-show="activeTab === 'shapes'" class="tab-panel shapes-panel">
              <ShapeLibrary />
            </div>
          </div>
        </div>

        <!-- 编辑面板（固定在下方） -->
        <!-- EditPanel 移出，变为独立悬浮组件 -->
      </div>
    </div>
    
    <!-- 悬浮编辑面板 -->
    <EditPanel
      :selected-object="selectedObject"
      @update-property="handleUpdateProperty"
      @delete-object="handleDeleteObject"
      @close="handleSelectionCleared"
    />
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
      activeTab: 'recognize', // 'recognize' 或 'shapes'
      selectedSpaceIndex: null, // 当前选中的车位索引
      spaceFabricObjects: new Map(), // 存储车位对应的 Fabric 对象
    };
  },
  computed: {
    imageUrl() {
      return this.$store.state.uploadedImage;
    },
  },
  mounted() {
    // 如果没有图片，重定向到上传页面
    if (!this.imageUrl) {
      this.$router.push('/');
    }
  },
  methods: {
    handleCanvasReady(canvas) {
      this.canvas = canvas;
    },
    handleObjectSelected(selectedData) {
      this.selectedObject = selectedData;
      
      // 如果选中的是车位对象，更新列表中的选中状态
      if (selectedData.fabricObject && selectedData.fabricObject.parkingIndex !== undefined) {
        this.selectedSpaceIndex = selectedData.fabricObject.parkingIndex;
      } else {
        this.selectedSpaceIndex = null;
      }
    },
    handleSelectionCleared() {
      this.selectedObject = null;
      this.selectedSpaceIndex = null;
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

      // 处理车位号更新
      if (property === 'parkingNumber') {
        obj.set('parkingNumber', value || null);
        
        // 更新或创建文本标签
        if (value && value.trim()) {
          // 如果文本对象不存在，创建它
          if (!obj.parkingText) {
            const { Text } = require('fabric');
            const text = new Text(value, {
              left: obj.left + 25,
              top: obj.top + 10,
              fontSize: 14,
              fill: '#000000',
              fontFamily: 'Arial',
              selectable: false,
              evented: false,
              parkingSpaceId: obj.id,
            });
            this.canvas.add(text);
            obj.parkingText = text;
            
            // 监听矩形移动和旋转，同步更新文本位置
            const updateTextPosition = () => {
              if (obj.parkingText) {
                obj.parkingText.set({
                  left: obj.left + 25,
                  top: obj.top + 10,
                  angle: obj.angle || 0,
                });
                this.canvas.renderAll();
              }
            };
            
            // 如果还没有绑定事件，则绑定
            if (!obj._parkingTextEventsBound) {
              obj.on('moving', updateTextPosition);
              obj.on('rotating', updateTextPosition);
              obj._parkingTextEventsBound = true;
            }
          } else {
            // 更新现有文本内容
            obj.parkingText.set('text', value);
          }
        } else {
          // 如果车位号为空，删除文本标签
          if (obj.parkingText) {
            this.canvas.remove(obj.parkingText);
            obj.parkingText = null;
          }
        }
        
        this.canvas.renderAll();
        // 确保 selectedObject 响应式更新
        this.$set(this.selectedObject, 'parkingNumber', value || null);
        
        // 同步更新 recognizedSpaces 数据 (使用 ID 查找)
        if (obj.id) {
            const targetSpace = this.recognizedSpaces.find(s => s.id === obj.id);
            if (targetSpace) {
                this.$set(targetSpace, 'number', value);
                // 强制更新视图（如果是简单属性可能不需要，但 number 涉及列表渲染）
            }
        }
        return;
      }

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

      // 同步更新 recognizedSpaces 数据 (通用属性)
      // 使用 ID 查找，不再依赖 index
      if (this.selectedObject.fabricObject && this.selectedObject.fabricObject.id) {
        const id = this.selectedObject.fabricObject.id;
        const targetSpace = this.recognizedSpaces.find(s => s.id === id);
        
        if (targetSpace) {
          if (property === 'left') {
            targetSpace.x = numValue;
          } else if (property === 'top') {
            targetSpace.y = numValue;
          }
          // width/height sync is complex due to scale, ignored for now
        }
      }
    },
    handleDeleteObject() {
      if (this.selectedObject && this.selectedObject.fabricObject) {
        // 如果是车位对象，也从 recognizedSpaces 中移除
        if (this.selectedObject.fabricObject.id) {
             const id = this.selectedObject.fabricObject.id;
             const idx = this.recognizedSpaces.findIndex(s => s.id === id);
             if (idx !== -1) {
                 this.recognizedSpaces.splice(idx, 1);
             }
        }
        
        this.canvas.remove(this.selectedObject.fabricObject);
        this.canvas.renderAll();
        this.selectedObject = null;
      }
    },
    handleSpacesRecognized(spaces) {
      // 1. 确保每个车位都有 ID
      spaces.forEach((space, i) => {
          if (!space.id) {
              space.id = `space_${Date.now()}_${i}`;
          }
      });

      // 对车位进行排序
      const sortedSpaces = [...spaces].sort(this.compareSpaces);

      this.recognizedSpaces = sortedSpaces;
      this.spaceFabricObjects.clear(); // 清空之前的映射
      console.log('识别到的车位数据(已排序):', sortedSpaces);
      
      // 将识别到的车位添加到画布上
      if (this.canvas && sortedSpaces.length > 0) {
        // 在画布上创建车位矩形
        sortedSpaces.forEach((space, index) => {
          const fabricObj = this.createParkingSpace(space, index);
          if (fabricObj) {
            this.spaceFabricObjects.set(index, fabricObj);
          }
        });
      }
    },
    // 车位排序比较函数
    compareSpaces(a, b) {
      // 1. 如果都有车位号，按车位号排序（自然顺序，如 A1, A2, A10）
      if (a.number && b.number) {
        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
      }
      
      // 2. 有车位号的排在前面
      if (a.number && !b.number) return -1;
      if (!a.number && b.number) return 1;
      
      // 3. 如果都没有车位号，按空间位置排序（从上到下，从左到右）
      // 允许一定的 Y 轴误差（高度的一半），视为同一行
      const rowThreshold = Math.min(a.height, b.height) * 0.5;
      if (Math.abs(a.y - b.y) < rowThreshold) {
        // 同一行，按 X 排序
        return a.x - b.x;
      }
      // 不同行，按 Y 排序
      return a.y - b.y;
    },
    // 手动排序车位
    sortSpaces() {
      if (!this.recognizedSpaces || this.recognizedSpaces.length === 0) return;
      
      console.log('排序前:', this.recognizedSpaces.map(s => `${s.number || 'null'}(${Math.round(s.y)})`));

      // 1. 排序数据
      this.recognizedSpaces.sort(this.compareSpaces);
      
      console.log('排序后:', this.recognizedSpaces.map(s => `${s.number || 'null'}(${Math.round(s.y)})`));

      // 2. 更新 Fabric 对象的 parkingIndex 映射
      if (this.canvas) {
        const objects = this.canvas.getObjects();
        this.spaceFabricObjects.clear();
        
        this.recognizedSpaces.forEach((space, index) => {
          // 通过 ID 找到对应的 Fabric 对象
          const fabricObj = objects.find(obj => obj.id === space.id);
          if (fabricObj) {
            fabricObj.parkingIndex = index;
            this.spaceFabricObjects.set(index, fabricObj);
          }
        });
        
        // 3. 如果当前有选中的车位，更新选中索引
        if (this.selectedObject && this.selectedObject.fabricObject) {
           // 重新查找索引
           const currentId = this.selectedObject.fabricObject.id;
           const newIndex = this.recognizedSpaces.findIndex(s => s.id === currentId);
           if (newIndex !== -1) {
               this.selectedSpaceIndex = newIndex;
               this.selectedObject.fabricObject.parkingIndex = newIndex;
           }
        }
      }
    },
    createParkingSpace(space, index) {
      if (!this.canvas) return null;

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
        // 增强选中框可见性
        borderColor: '#FF5722', // 醒目的橙红色边框
        cornerColor: '#FF5722', // 控制点颜色
        cornerSize: 12, // 增大控制点尺寸
        borderScaleFactor: 2, // 边框宽度缩放因子
        cornerStyle: 'circle', // 圆形控制点
        transparentCorners: false, // 控制点不透明
        borderDashArray: [5, 5], // 虚线边框，更醒目
      });

      // 添加车位信息
      // ID 应该已经存在于 space 对象中
      const spaceId = space.id; 
      rect.set({
        id: spaceId,
        parkingNumber: space.number || null,
        parkingIndex: index, // 保存索引，用于定位
        originX: 'left',
        originY: 'top',
      });
      console.log(`创建车位对象: ID=${spaceId}, Number=${space.number}`);

      // 如果有车位号，添加文本标签（作为矩形的一部分，跟随移动）
      let text = null;
      if (space.number) {
        text = new Text(space.number, {
          left: space.x + 25,
          top: space.y + 10,
          fontSize: 14,
          fill: '#000000',
          fontFamily: 'Arial',
          selectable: false,
          evented: false,
          parkingSpaceId: spaceId, // 关联到车位矩形
        });
        
        // 将文本添加到画布
        this.canvas.add(text);
        
        // 保存文本对象引用到矩形对象上，方便后续更新
        rect.parkingText = text;
        
        // 监听矩形移动，同步更新文本位置
        rect.on('moving', () => {
          if (text) {
            text.set({
              left: rect.left + 25,
              top: rect.top + 10,
            });
            this.canvas.renderAll();
          }
        });
        
        // 监听矩形旋转，同步更新文本
        rect.on('rotating', () => {
          if (text) {
            text.set({
              left: rect.left + 25,
              top: rect.top + 10,
              angle: rect.angle,
            });
            this.canvas.renderAll();
          }
        });
      }

      this.canvas.add(rect);
      this.canvas.renderAll();
      
      return rect;
    },
    // 定位到指定的车位
    focusOnSpace(space, index) {
      if (!this.canvas) return;
      
      // 优先通过 ID 查找对象（更可靠）
      const objects = this.canvas.getObjects();
      let fabricObj = null;
      
      if (space.id) {
        fabricObj = objects.find(obj => obj.id === space.id);
      }
      
      // 如果通过 ID 找不到，尝试通过索引查找
      if (!fabricObj) {
        fabricObj = this.spaceFabricObjects.get(index);
        if (!fabricObj) {
          fabricObj = objects.find(obj => obj.parkingIndex === index);
        }
      }
      
      if (fabricObj) {
        this.selectAndFocusObject(fabricObj);
        this.selectedSpaceIndex = index;
      }
    },
    // 选中并聚焦到对象
    selectAndFocusObject(fabricObj) {
      if (!this.canvas || !fabricObj) return;
      
      // 增强选中框样式，使其更明显
      fabricObj.set({
        borderColor: '#FF5722', // 醒目的橙红色边框
        cornerColor: '#FF5722', // 控制点颜色
        cornerSize: 12, // 增大控制点尺寸
        borderScaleFactor: 2, // 边框宽度缩放因子
        cornerStyle: 'circle', // 圆形控制点
        transparentCorners: false, // 控制点不透明
        borderDashArray: [5, 5], // 虚线边框，更醒目
      });
      
      // 选中对象
      this.canvas.setActiveObject(fabricObj);
      this.canvas.renderAll();
      
      // 触发选择事件，更新编辑面板
      const selectedData = {
        id: fabricObj.id,
        left: Math.round(fabricObj.left),
        top: Math.round(fabricObj.top),
        width: Math.round((fabricObj.width || 0) * (fabricObj.scaleX || 1)),
        height: Math.round((fabricObj.height || 0) * (fabricObj.scaleY || 1)),
        angle: Math.round(fabricObj.angle || 0),
        fill: fabricObj.fill || '#000000',
        parkingNumber: fabricObj.parkingNumber || null,
        fabricObject: fabricObj,
      };
      this.handleObjectSelected(selectedData);
      
      // 滚动到对象位置（如果对象在可视区域外）
      this.$nextTick(() => {
        const canvasArea = this.$refs.canvasArea;
        if (!canvasArea) return;
        
        const container = canvasArea.$refs?.canvasContainer;
        if (!container) return;
        
        // 获取对象在画布上的坐标（考虑旋转和缩放）
        const objBounds = fabricObj.getBoundingRect();
        
        // 获取容器的可视区域大小
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // 对象在画布上的位置（相对于画布左上角）
        const objLeft = objBounds.left;
        const objTop = objBounds.top;
        const objWidth = objBounds.width;
        const objHeight = objBounds.height;
        
        // 对象中心点在画布上的位置
        const objCenterX = objLeft + objWidth / 2;
        const objCenterY = objTop + objHeight / 2;
        
        // 计算容器中心点位置
        const containerCenterX = containerWidth / 2;
        const containerCenterY = containerHeight / 2;
        
        // 计算需要滚动的距离，使对象中心点对齐到容器中心点
        let targetScrollLeft = objCenterX - containerCenterX;
        let targetScrollTop = objCenterY - containerCenterY;
        
        // 确保滚动位置不超出边界
        const maxScrollLeft = Math.max(0, this.canvas.width - containerWidth);
        const maxScrollTop = Math.max(0, this.canvas.height - containerHeight);
        targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
        targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
        
        // 平滑滚动到目标位置
        container.scrollTo({
          left: targetScrollLeft,
          top: targetScrollTop,
          behavior: 'smooth',
        });
      });
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

.tab-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  background: #f8f9fa;
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.tab-btn.active {
  color: #4CAF50;
  border-bottom-color: #4CAF50;
  background: white;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.tab-panel {
  padding: 15px;
  height: 100%;
  overflow-y: auto;
}

/* 专门针对识别面板的布局优化 */
.tab-panel.recognize-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 禁止整体滚动，交给内部列表 */
}

/* 图形库面板优化 */
.tab-panel.shapes-panel {
  padding: 0; /* 移除内边距，由组件自己控制 */
  overflow: hidden; /* 禁止整体滚动 */
  display: flex;
  flex-direction: column;
}

.spaces-list {
  margin-top: 20px;
  border-top: 1px solid #eee;
  padding-top: 15px;
  /* Flex布局撑开剩余空间 */
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.list-header {
  font-weight: bold;
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0; /* 防止表头被压缩 */
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sort-btn {
  padding: 4px 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.sort-btn:hover {
  background: #f5f5f5;
  color: #333;
  border-color: #ccc;
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 移除固定高度，改为撑满 */
  max-height: none;
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

/* 自定义滚动条样式 */
.list-items::-webkit-scrollbar {
  width: 6px; /* 滚动条宽度 */
}

.list-items::-webkit-scrollbar-track {
  background: transparent; /* 轨道背景 */
}

.list-items::-webkit-scrollbar-thumb {
  background-color: #e0e0e0; /* 滑块颜色 */
  border-radius: 3px; /* 滑块圆角 */
}

.list-items::-webkit-scrollbar-thumb:hover {
  background-color: #bdbdbd; /* 悬停时滑块颜色 */
}

.space-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.space-item:hover {
  border-color: #4CAF50;
  background: #f0f8f0;
  transform: translateX(1px);
}

.space-item.active {
  border-color: #4CAF50;
  background: #e8f5e9;
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.2);
}

.space-item-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.space-number {
  font-weight: bold;
  font-size: 14px;
  color: #333;
}

.space-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.space-info span {
  display: block;
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