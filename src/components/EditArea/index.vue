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
              
              <!-- 识别通过控制面板 -->
              <div class="recognition-controls">
                <div class="panel-header" @click="recognitionControlsCollapsed = !recognitionControlsCollapsed">
                  <span class="panel-title">识别设置</span>
                  <span class="panel-toggle">
                    {{ recognitionControlsCollapsed ? '▼' : '▲' }}
                  </span>
                </div>
                <transition name="slide">
                  <div v-show="!recognitionControlsCollapsed" class="panel-content">
                <div class="control-group">
                  <label>边框颜色（图片中边框的颜色）</label>
                  <select v-model="recognitionConfig.borderColor" class="config-select">
                    <option value="blue">蓝色 (Blue)</option>
                    <option value="red">红色 (Red)</option>
                    <option value="green">绿色 (Green)</option>
                    <option value="white">白色 (White)</option>
                  </select>
                </div>
                
                <div class="control-group">
                  <label>车位号识别</label>
                  <select v-model="recognitionConfig.ocrEngine" class="config-select">
                    <option value="">关闭</option>
                    <option value="easy">EasyOCR</option>
                    <option value="paddle">PaddleOCR</option>
                  </select>
                </div>
                
                <div class="control-group">
                  <label>文字颜色（图片中车位号的颜色）</label>
                  <select v-model="recognitionConfig.textColor" class="config-select">
                    <option value="yellow">黄色</option>
                    <option value="black">黑色</option>
                    <option value="red">红色</option>
                    <option value="white">白色</option>
                    <option value="green">绿色</option>
                  </select>
                </div>
                
                
                <button 
                  class="action-btn recognize-btn" 
                  :disabled="isRecognizing"
                  @click="startRecognition"
                >
                  {{ isRecognizing ? '识别中...' : '开始识别' }}
                </button>
                
                <div v-if="recognitionStatus" :class="['status-text', recognitionStatusType]">
                  {{ recognitionStatus }}
                </div>
                  </div>
                </transition>
              </div>

              <!-- 如果没有任何数据，显示加载模拟数据按钮 (作为备用) -->
              <div v-if="recognizedSpaces.length === 0 && !isRecognizing" class="empty-state">
                <div class="empty-text">暂无数据，请点击上方识别或加载模拟数据</div>
                <button class="text-btn" @click="loadSimulationData">
                  加载模拟数据
                </button>
              </div>
              
              <!-- 识别结果列表 -->
              <div v-if="recognizedSpaces.length > 0" class="spaces-list">
                <div class="filter-group">
                  <div class="panel-header" @click="filterGroupCollapsed = !filterGroupCollapsed">
                    <span class="panel-title">过滤与样式</span>
                    <span class="panel-toggle">
                      {{ filterGroupCollapsed ? '▼' : '▲' }}
                    </span>
                  </div>
                  <transition name="slide">
                    <div v-show="!filterGroupCollapsed" class="panel-content">
                  <div class="filter-item">
                    <label>最小面积: {{ filter.currentMin }}</label>
                    <input 
                      type="range" 
                      :min="filter.minArea" 
                      :max="filter.maxArea" 
                      v-model.number="filter.currentMin"
                      @input="onFilterChange"
                    >
                  </div>
                  <div class="filter-item">
                    <label>最大面积: {{ filter.currentMax }}</label>
                    <input 
                      type="range" 
                      :min="filter.minArea" 
                      :max="filter.maxArea" 
                      v-model.number="filter.currentMax"
                      @input="onFilterChange"
                    >
                  </div>
                  <div class="filter-item">
                   <label>车位号颜色</label>
                   <input 
                     type="color" 
                     v-model="recognitionConfig.textNumberColor"
                     @input="onTextStyleChange"
                     class="color-picker"
                   >
                </div>
                  <div class="filter-item">
                   <label>透明度: {{ Math.round(recognitionConfig.textNumberOpacity * 100) }}%</label>
                   <input 
                     type="range" 
                     min="0" 
                     max="1" 
                     step="0.01"
                     v-model.number="recognitionConfig.textNumberOpacity"
                     @input="onTextStyleChange"
                     class="opacity-slider"
                   >
                </div>
                  <div class="filter-item">
                   <label>字体大小: {{ recognitionConfig.textNumberFontSize }}px</label>
                   <input 
                     type="range" 
                     min="8" 
                     max="48" 
                     step="1"
                     v-model.number="recognitionConfig.textNumberFontSize"
                     @input="onTextStyleChange"
                     class="font-size-slider"
                   >
                </div>
                  <div class="filter-item">
                   <label>X偏移: {{ recognitionConfig.textNumberOffsetX }}px</label>
                   <input 
                     type="range" 
                     min="-100" 
                     max="100" 
                     step="1"
                     v-model.number="recognitionConfig.textNumberOffsetX"
                     @input="onTextStyleChange"
                     class="offset-slider"
                   >
                </div>
                  <div class="filter-item">
                   <label>Y偏移: {{ recognitionConfig.textNumberOffsetY }}px</label>
                   <input 
                     type="range" 
                     min="-100" 
                     max="100" 
                     step="1"
                     v-model.number="recognitionConfig.textNumberOffsetY"
                     @input="onTextStyleChange"
                     class="offset-slider"
                   >
                </div>
                  </div>
                </transition>
                </div>
                
                <div class="list-header">
                  <span>识别结果 ({{ recognizedSpaces.length }} / {{ allRecognizedSpaces.length }})</span>
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
                        <span v-if="space.angle">角度: {{ space.angle.toFixed(2) }}°</span>
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

export default {
  name: 'EditArea',
  components: {
    CanvasArea,
    ShapeLibrary,
    EditPanel,
  },
  data() {
    return {
      canvas: null,
      selectedObject: null,
      recognizedSpaces: [],
      activeTab: 'recognize', // 'recognize' 或 'shapes'
      selectedSpaceIndex: null, // 当前选中的车位索引
      spaceFabricObjects: new Map(), // 存储车位对应的 Fabric 对象
      
      // Recognition State
      isRecognizing: false,
      recognitionStatus: '',
      recognitionStatusType: 'info', // info, success, error
      recognitionConfig: {
        borderColor: 'blue',
        imgsz: 640,
        conf: 0.25,
        ocrEngine: 'paddle', // 车位号 OCR 引擎：空字符串表示关闭，'easy' 或 'paddle'
        textColor: 'yellow', // 文字颜色：yellow/black/red/white/green（用于后端识别）
        textNumberColor: '#000000', // 车位号文字颜色（用于前端显示）
        textNumberOpacity: 1.0, // 车位号文字透明度（0-1）
        textNumberFontSize: 18, // 车位号文字大小（px）
        textNumberOffsetX: 0, // 车位号文字X偏移（px）
        textNumberOffsetY: 0, // 车位号文字Y偏移（px）
      },
      
      // Filter State
      allRecognizedSpaces: [], // Store all spaces for filtering
      filter: {
          minArea: 0, 
          maxArea: 10000, // Default max
          currentMin: 0,
          currentMax: 10000
      },
      filterTimer: null,
      textStyleTimer: null, // 用于文字样式变化的防抖
      
      // 面板收起状态
      recognitionControlsCollapsed: false,
      filterGroupCollapsed: false,
    };
  },
  computed: {
    imageUrl() {
      return this.$store.state.uploadedImage;
    },
  },
  watch: {
    // 注意：颜色和透明度的实时更新已改为通过 onTextStyleChange 防抖处理
  },
  mounted() {
    // 如果没有图片，重定向到上传页面
    if (!this.imageUrl) {
      this.$router.push('/');
      return;
    }
    
    // Check for API results from Vuex
    const apiResults = this.$store.state.recognitionResults;
    if (apiResults && apiResults.length > 0) {
        // API results structure: User snippet said 'results = data.results'. 
        // We need to know if 'results' is [ { boxes: [] } ] (batch) or [ box, box ] (single image flatten).
        // Based on typical YOLO API for single image, it might be the list of boxes directly OR an object with .boxes.
        // Let's assume it matches the JSON structure we used: [ { boxes: [...] } ] or just [...]
        // We will try to find the array of boxes.
        let boxes = [];
        if (apiResults[0] && apiResults[0].boxes) {
            boxes = apiResults[0].boxes;
        } else if (Array.isArray(apiResults)) {
             // Maybe the results IS the list of boxes?
             // Or maybe it's a list of result objects for batch 1.
             // Let's check a property of the first item to guess.
             if (apiResults[0].xywhr || apiResults[0].xyxyxyxy) {
                 boxes = apiResults;
             } else if (apiResults[0].boxes) {
                 boxes = apiResults[0].boxes;
             }
        }
        
        if (boxes.length > 0) {
            console.log('Loaded recognition results from API store');
            this.processBoxes(boxes);
        }
    }
  },
  methods: {
    async startRecognition() {
        if (!this.imageUrl) {
            alert("没有图片可识别");
            return;
        }
        
        // 清空之前的结果
        this.clearPreviousResults();
        
        this.isRecognizing = true;
        this.recognitionStatus = "正在请求检测接口...";
        this.recognitionStatusType = "info";
        
        try {
            const fd = new FormData();
            fd.append("mode", "obb");
            fd.append("imgsz", this.recognitionConfig.imgsz);
            fd.append("conf", this.recognitionConfig.conf);
            fd.append("border_color", this.recognitionConfig.borderColor);
            fd.append("ocr_engine", this.recognitionConfig.ocrEngine);
            fd.append("text_color", this.recognitionConfig.textColor);
            
            // Convert Base64/URL to Blob
            const res = await fetch(this.imageUrl);
            const blob = await res.blob();
            fd.append("file", blob, "image.png");
            
            const apiUrl = "/api/detect";
            const response = await fetch(apiUrl, {
                method: "POST",
                body: fd
            });
            
            const data = await response.json().catch(() => ({}));
            
            if (!response.ok) {
                throw new Error(data.error || `请求失败 ${response.status}`);
            }
            
            const results = data.results || [];
            if (results.length > 0 && results[0].boxes) {
                this.processBoxes(results[0].boxes);
                this.recognitionStatus = `识别完成，找到 ${results[0].boxes.length} 个目标`;
                this.recognitionStatusType = "success";
                
                // Save to store just in case
                this.$store.dispatch('saveRecognitionResults', results);
            } else {
                 this.recognitionStatus = "未检测到目标";
                 this.recognitionStatusType = "info";
            }
            
        } catch (error) {
            console.error("Recognition Error:", error);
            this.recognitionStatus = "识别失败: " + error.message;
            this.recognitionStatusType = "error";
        } finally {
            this.isRecognizing = false;
        }
    },
    
    clearPreviousResults() {
        // 清空画布上的车位对象
        if (this.canvas) {
            this.spaceFabricObjects.forEach(obj => {
                this.canvas.remove(obj);
                // 移除关联的文本对象
                if (obj.parkingText) {
                    this.canvas.remove(obj.parkingText);
                }
            });
            this.spaceFabricObjects.clear();
            this.canvas.renderAll();
        }
        
        // 清空数据
        this.recognizedSpaces = [];
        this.allRecognizedSpaces = [];
        this.selectedSpaceIndex = null;
        this.selectedObject = null;
    },

    processBoxes(boxes) {
        const spaces = boxes.map((box, index) => {
            // Use vertices to calculate robust geometry for Fabric.js
            // JSON xywhr can be ambiguous about which side is width vs height relative to angle
            const points = box.xyxyxyxy; // xyxyxyxy is most robust
            
            let width, height, angle, centerX, centerY;
            
            if (points && points.length === 4) {
                 // 1. Calculate Center
                let sumX = 0, sumY = 0;
                points.forEach(p => { 
                    // Handle if points are arrays [x,y] or objects {x,y}
                    const px = Array.isArray(p) ? p[0] : p.x;
                    const py = Array.isArray(p) ? p[1] : p.y;
                    sumX += px; sumY += py; 
                });
                centerX = sumX / 4;
                centerY = sumY / 4;

                // 2. Calculate edge lengths
                const p0 = Array.isArray(points[0]) ? {x:points[0][0], y:points[0][1]} : points[0];
                const p1 = Array.isArray(points[1]) ? {x:points[1][0], y:points[1][1]} : points[1];
                const p2 = Array.isArray(points[2]) ? {x:points[2][0], y:points[2][1]} : points[2];
                // const p3 = points[3];

                const dx1 = p1.x - p0.x;
                const dy1 = p1.y - p0.y;
                const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const angle1 = Math.atan2(dy1, dx1) * 180 / Math.PI;

                const dx2 = p2.x - p1.x;
                const dy2 = p2.y - p1.y;
                const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                const angle2 = Math.atan2(dy2, dx2) * 180 / Math.PI;
                
                // 3. Determine Width/Height/Angle
                if (len1 > len2) {
                   width = len1;
                   height = len2;
                   angle = angle1;
                } else {
                   width = len2;
                   height = len1;
                   angle = angle2;
                }
                
                // Format vertices for storage (createSpace uses them too now)
            } else {
                // Fallback to xywhr if no vertices (shouldn't happen with updated OBB)
                width = box.xywhr ? box.xywhr.width : 50;
                height = box.xywhr ? box.xywhr.height : 100;
                angle = box.xywhr ? box.xywhr.angle_deg : 0;
                centerX = box.xywhr ? box.xywhr.center_x : 0;
                centerY = box.xywhr ? box.xywhr.center_y : 0;
            }
            
            return {
              id: `space_${Date.now()}_${index}`,
              x: centerX, 
              y: centerY,
              centerX: centerX,
              centerY: centerY,
              width: width,
              height: height,
              area: width * height, // Store area for filtering
              angle: angle,
              rotation: angle,
              rotatedWidth: width, 
              rotatedHeight: height,
              vertices: points ? points.map(p => Array.isArray(p) ? {x:p[0], y:p[1]} : p) : null,
              number: box.name || null, // Map class_name to number/label if available
            };
        });
        
        this.handleSpacesLoaded(spaces);
    },
    
    onFilterChange() {
        if (this.filterTimer) clearTimeout(this.filterTimer);
        this.filterTimer = setTimeout(() => {
            this.applyFilter();
        }, 300); // 300ms debounce
    },
    
    onTextStyleChange() {
        // 防抖处理文字样式变化（颜色和透明度）
        if (this.textStyleTimer) clearTimeout(this.textStyleTimer);
        this.textStyleTimer = setTimeout(() => {
            this.updateTextStyles();
        }, 300); // 300ms debounce
    },
    
    updateTextStyles() {
        if (!this.canvas) return;
        
        const color = this.recognitionConfig.textNumberColor || '#000000';
        const opacity = this.recognitionConfig.textNumberOpacity !== undefined 
            ? this.recognitionConfig.textNumberOpacity 
            : 1.0;
        const fontSize = this.recognitionConfig.textNumberFontSize || 18;
        const offsetX = this.recognitionConfig.textNumberOffsetX || 0;
        const offsetY = this.recognitionConfig.textNumberOffsetY || 0;
        
        const objects = this.canvas.getObjects();
        objects.forEach(obj => {
            // 如果对象有 parkingText 属性，更新其样式和位置
            if (obj.parkingText && obj.parkingText.set) {
                // 计算新的位置（基于车位对象的左上角 + 偏移）
                const newLeft = obj.left + offsetX;
                const newTop = obj.top + offsetY;
                
                obj.parkingText.set({
                    fill: color,
                    opacity: opacity,
                    fontSize: fontSize,
                    left: newLeft,
                    top: newTop
                });
            }
        });
        this.canvas.renderAll();
    },
    
    applyFilter() {
        const { currentMin, currentMax } = this.filter;
        
        // Filter spaces by area
        const filtered = this.allRecognizedSpaces.filter(space => {
            const area = space.area || (space.width * space.height);
            return area >= currentMin && area <= currentMax;
        });
        
        this.recognizedSpaces = filtered;
        
        // Re-render canvas
        // Clear old objects first? renderSpaces clears mapping but createParkingSpace adds new ones.
        // We should clear the canvas of old parking spaces first.
        if (this.canvas) {
            // Remove existing parking objects
            // this.canvas.getObjects(); 
            // We use spaceFabricObjects map for precise removal.
            // Actually our parking objects have 'parkingIndex' set.
            // Or better, use spaceFabricObjects map?
            // But previous renderSpaces didn't clear well.
            // Let's rely on spaceFabricObjects to remove them?
            // Or just clear all Rects? No, might remove other things.
            // Use this.spaceFabricObjects.
            
            this.spaceFabricObjects.forEach(obj => {
                this.canvas.remove(obj);
                if (obj.parkingText) this.canvas.remove(obj.parkingText);
            });
            this.spaceFabricObjects.clear();
            
            // Re-render filtered list
            this.renderSpaces(); 
        }
    },
    
    // 加载模拟数据
    loadSimulationData() {
      try {
        const obbData = require('@/assets/const/obb-result-2026-01-26-06-59-28.json');
        if (obbData && obbData.length > 0) {
           const dataItem = obbData[0];
           if (dataItem && dataItem.boxes) {
              this.processBoxes(dataItem.boxes);
           }
        }
      } catch (e) {
        console.error('Failed to load simulation data:', e);
        alert('加载模拟数据失败 (JSON格式可能不匹配)');
      }
    },
    
    // 处理加载的车位数据
    handleSpacesLoaded(spaces) {
      // 1. 确保每个车位都有 ID 并计算面积（如果还没有）
      spaces.forEach((space, i) => {
          if (!space.id) {
              space.id = `space_${Date.now()}_${i}`;
          }
          if (space.area === undefined) {
              space.area = space.width * space.height;
          }
      });
      
      // Filter out abnormally large spaces (User requested 500, but assuming 10000 for realistic pixel areas in 640x640)
      // 过滤掉面积过大的异常数据
      const MAX_ALLOWED_AREA = 10000; 
      const validSpaces = spaces.filter(s => s.area <= MAX_ALLOWED_AREA);

      // Store ALL valid spaces
      this.allRecognizedSpaces = validSpaces;

      // Calculate min/max area for slider initialization from VALID spaces
      if (validSpaces.length > 0) {
          const areas = validSpaces.map(s => s.area);
          const minArea = Math.floor(Math.min(...areas));
          const maxArea = Math.ceil(Math.max(...areas));
          
          // Set slider bounds
          this.filter.minArea = Math.max(0, minArea - 100); 
          // Set max slider to the max found area (which is already <= 10000)
          this.filter.maxArea = maxArea;
          
          // Init current values to full range
          this.filter.currentMin = this.filter.minArea;
          this.filter.currentMax = this.filter.maxArea;
      } else {
          // Fallback if no valid spaces
           this.filter.minArea = 0;
           this.filter.maxArea = 10000;
           this.filter.currentMin = 0;
           this.filter.currentMax = 10000;
      }

      // Apply initial filter
      this.applyFilter();
    },

    // 渲染车位到画布
    renderSpaces() {
      if (this.canvas) {
         // Clear previous objects if not already done in applyFilter
         // (applyFilter logic handles clearing via spaceFabricObjects map reference, but let's be safe)
         // Actually renderSpaces loop adds new ones.
         
        this.recognizedSpaces.forEach((space, index) => {
          const fabricObj = this.createParkingSpace(space, index);
          if (fabricObj) {
            this.spaceFabricObjects.set(index, fabricObj);
          }
        });
      }
    },

    handleCanvasReady(canvas) {
      this.canvas = canvas;
      if (this.recognizedSpaces.length > 0) {
        this.$nextTick(() => {
          this.renderSpaces();
        });
      }
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
            const fontSize = this.recognitionConfig.textNumberFontSize || 18;
            const offsetX = this.recognitionConfig.textNumberOffsetX || 0;
            const offsetY = this.recognitionConfig.textNumberOffsetY || 0;
            
            const text = new Text(value, {
              left: obj.left + offsetX,
              top: obj.top + offsetY,
              fontSize: fontSize,
              fill: this.recognitionConfig.textNumberColor || '#000000',
              opacity: this.recognitionConfig.textNumberOpacity !== undefined 
                ? this.recognitionConfig.textNumberOpacity 
                : 1.0,
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
                const offsetX = this.recognitionConfig.textNumberOffsetX || 0;
                const offsetY = this.recognitionConfig.textNumberOffsetY || 0;
                obj.parkingText.set({
                  left: obj.left + offsetX,
                  top: obj.top + offsetY,
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
            // 更新现有文本内容、颜色、透明度、大小和位置
            const fontSize = this.recognitionConfig.textNumberFontSize || 18;
            const offsetX = this.recognitionConfig.textNumberOffsetX || 0;
            const offsetY = this.recognitionConfig.textNumberOffsetY || 0;
            
            obj.parkingText.set({
              text: value,
              fill: this.recognitionConfig.textNumberColor || '#000000',
              opacity: this.recognitionConfig.textNumberOpacity !== undefined 
                ? this.recognitionConfig.textNumberOpacity 
                : 1.0,
              fontSize: fontSize,
              left: obj.left + offsetX,
              top: obj.top + offsetY
            });
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
      
      // Determine dimensions and position
      // Prefer rotated dimensions if available and angle is present
      // 优先使用旋转后的尺寸（如果有）和角度
      let width = space.width;
      let height = space.height;
      let left = space.x;
      let top = space.y;
      let originX = 'left';
      let originY = 'top';
      
      if (space.angle && (space.rotatedWidth || space.rotatedHeight)) {
          // If we have rotated dimensions, use them
          // 如果有旋转尺寸，使用它们
          width = space.rotatedWidth || space.width;
          height = space.rotatedHeight || space.height;
          
          // If using rotated dimensions, we MUST positions by center to be accurate
          // 如果使用旋转尺寸，必须按中心定位才准确
          if (space.centerX !== undefined && space.centerY !== undefined) {
             left = space.centerX;
             top = space.centerY;
             originX = 'center';
             originY = 'center';
          }
      }

      // 创建车位矩形
      const rect = new Rect({
        left: left,
        top: top,
        width: width,
        height: height,
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
        originX: originX,
        originY: originY,
      });
      console.log(`创建车位对象: ID=${spaceId}, Number=${space.number}`);

      // 如果有车位号，添加文本标签（作为矩形的一部分，跟随移动）
      let text = null;
      if (space.number) {
        const fontSize = this.recognitionConfig.textNumberFontSize || 18;
        const offsetX = this.recognitionConfig.textNumberOffsetX || 0;
        const offsetY = this.recognitionConfig.textNumberOffsetY || 0;
        
        text = new Text(space.number, {
          left: space.x + offsetX,
          top: space.y + offsetY,
          fontSize: fontSize,
          fill: this.recognitionConfig.textNumberColor || '#000000',
          opacity: this.recognitionConfig.textNumberOpacity !== undefined 
            ? this.recognitionConfig.textNumberOpacity 
            : 1.0,
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
            const offsetX = this.recognitionConfig.textNumberOffsetX || 0;
            const offsetY = this.recognitionConfig.textNumberOffsetY || 0;
            text.set({
              left: rect.left + offsetX,
              top: rect.top + offsetY,
            });
            this.canvas.renderAll();
          }
        });
        
        // 监听矩形旋转，同步更新文本
        rect.on('rotating', () => {
          if (text) {
            const offsetX = this.recognitionConfig.textNumberOffsetX || 0;
            const offsetY = this.recognitionConfig.textNumberOffsetY || 0;
            text.set({
              left: rect.left + offsetX,
              top: rect.top + offsetY,
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
  gap: 10px;
}

.recognition-controls {
  background: #f0f2f5;
  border-radius: 6px;
  overflow: hidden;
}

.panel-header {
  padding: 12px 15px;
  background: #e8eaed;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.panel-header:hover {
  background: #dde0e4;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.panel-toggle {
  font-size: 12px;
  color: #666;
  transition: transform 0.2s;
}

.panel-content {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.control-group label {
    font-size: 12px;
    color: #666;
    font-weight: bold;
}

.config-select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    background: white;
}

.recognize-btn {
    width: 100%;
    background-color: #2196F3; /* Blue */
}
.recognize-btn:hover {
    background-color: #1976D2;
}

.text-btn {
    background: none;
    border: none;
    color: #2196F3;
    text-decoration: underline;
    cursor: pointer;
    font-size: 13px;
}

.status-text {
    font-size: 12px;
    padding: 8px;
    border-radius: 4px;
    background: #e3f2fd;
    color: #0d47a1;
}
.status-text.error {
    background: #ffebee;
    color: #c62828;
}
.status-text.success {
    background: #e8f5e9;
    color: #2e7d32;
}

/* 图形库面板优化 */
.tab-panel.shapes-panel {
  padding: 0; /* 移除内边距，由组件自己控制 */
  overflow: hidden; /* 禁止整体滚动 */
  display: flex;
  flex-direction: column;
}

.spaces-list {
  margin-top: 6px;
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
  margin-top: 6px;
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
  gap: 14px;
  font-size: 12px;
  color: #666;
}

.space-info span {
  display: block;
}

/* 响应式设计 */
/* Filter Controls */
.filter-group {
    background: #fcfcfc;
    border-bottom: 1px solid #eee;
    overflow: hidden;
}

.filter-group .panel-header {
    background: #f5f5f5;
    padding: 10px 15px;
}

.filter-group .panel-content {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.filter-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.filter-item label {
    font-size: 12px;
    color: #666;
}
.filter-item input[type=range] {
    width: 100%;
}

.color-picker {
    width: 100%;
    height: 40px;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
}

.opacity-slider {
    width: 100%;
}

.font-size-slider {
    width: 100%;
}

.offset-slider {
    width: 100%;
}

/* 收起/展开过渡动画 */
.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter, .slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to, .slide-leave {
  max-height: 1000px;
  opacity: 1;
}

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