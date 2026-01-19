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
        this.selectedObject.parkingNumber = value || null;
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
    },
    handleDeleteObject() {
      if (this.selectedObject && this.selectedObject.fabricObject) {
        this.canvas.remove(this.selectedObject.fabricObject);
        this.canvas.renderAll();
        this.selectedObject = null;
      }
    },
    handleSpacesRecognized(spaces) {
      // 对车位进行排序
      const sortedSpaces = [...spaces].sort((a, b) => {
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
          return a.x - b.x;
        }
        return a.y - b.y;
      });

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
      });

      // 添加车位信息
      // 使用识别结果中的 id，如果没有则生成一个
      const spaceId = space.id || `parking_${index}_${Date.now()}`;
      rect.set({
        id: spaceId,
        parkingNumber: space.number || null,
        parkingIndex: index, // 保存索引，用于定位
        originX: 'left',
        originY: 'top',
      });

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
      
      // 查找对应的 Fabric 对象
      const fabricObj = this.spaceFabricObjects.get(index);
      if (!fabricObj) {
        // 如果映射中没有，尝试从画布中查找
        const objects = this.canvas.getObjects();
        const found = objects.find(obj => obj.parkingIndex === index);
        if (found) {
          this.selectAndFocusObject(found);
          this.selectedSpaceIndex = index;
          return;
        }
      } else {
        this.selectAndFocusObject(fabricObj);
        this.selectedSpaceIndex = index;
      }
    },
    // 选中并聚焦到对象
    selectAndFocusObject(fabricObj) {
      if (!this.canvas || !fabricObj) return;
      
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
        if (container) {
          const objBounds = fabricObj.getBoundingRect();
          const containerRect = container.getBoundingClientRect();
          
          // 计算对象中心点
          const objCenterX = objBounds.left + objBounds.width / 2;
          const objCenterY = objBounds.top + objBounds.height / 2;
          
          // 计算容器中心点
          const containerCenterX = containerRect.width / 2;
          const containerCenterY = containerRect.height / 2;
          
          // 计算需要滚动的距离
          const scrollLeft = objCenterX - containerCenterX;
          const scrollTop = objCenterY - containerCenterY;
          
          // 平滑滚动到对象位置
          container.scrollTo({
            left: container.scrollLeft + scrollLeft,
            top: container.scrollTop + scrollTop,
            behavior: 'smooth',
          });
        }
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
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 移除固定高度，改为撑满 */
  max-height: none;
  flex: 1;
  overflow-y: auto;
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