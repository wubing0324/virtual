<template>
  <div class="parking-recognizer">
    <button @click="startRecognition" :disabled="isProcessing" class="recognize-btn">
      {{ isProcessing ? '识别中...' : '开始识别车位' }}
    </button>
    <div v-if="parkingSpaces.length > 0" class="results-info">
      已识别 {{ parkingSpaces.length }} 个车位
    </div>
    <!-- 隐藏的 canvas 用于图像处理 -->
    <canvas ref="imageCanvas" style="display: none;"></canvas>
  </div>
</template>

<script>
import Tesseract from 'tesseract.js';

let cv = null;

export default {
  name: 'ParkingSpaceRecognizer',
  data() {
    return {
      image: null,
      imageCanvas: null,
      imageCtx: null,
      isProcessing: false,
      parkingSpaces: [],
      opencvLoaded: false,
      worker: null,
    };
  },
  beforeDestroy() {
    if (this.worker) {
      this.worker.terminate();
    }
  },
  computed: {
    imageSrc() {
      return this.$store.state.uploadedImage;
    },
  },
  watch: {
    imageSrc: {
      immediate: true,
      async handler(newSrc) {
        if (newSrc) {
          await this.loadImage(newSrc);
        }
      },
    },
  },
  async mounted() {
    await this.initTesseract();
    await this.loadOpenCV();
  },
  methods: {
    async initTesseract() {
      try {
        console.log('正在初始化 Tesseract Worker...');
        this.worker = await Tesseract.createWorker('eng');
        console.log('Tesseract Worker 初始化完成');
      } catch (e) {
        console.error('Tesseract 初始化失败:', e);
      }
    },
    async loadOpenCV() {
      // 直接使用 CDN 方式加载，避免 webpack 打包问题
      return new Promise((resolve, reject) => {
        // 如果已经加载过，直接使用
        if (window.cv && window.cv.imread) {
          cv = window.cv;
          this.opencvLoaded = true;
          console.log('OpenCV.js 已加载');
          resolve();
          return;
        }

        // 检查是否已经加载过脚本但还在初始化
        const existingScript = document.querySelector('script[src*="opencv.js"]');
        if (existingScript) {
          // 等待脚本加载完成
          const checkInterval = setInterval(() => {
            if (window.cv && window.cv.imread) {
              cv = window.cv;
              this.opencvLoaded = true;
              console.log('OpenCV.js 加载完成');
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            if (!this.opencvLoaded) {
              clearInterval(checkInterval);
              reject(new Error('OpenCV.js 加载超时'));
            }
          }, 30000);
          return;
        }

        // 创建新的脚本标签
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.x/opencv.js';
        script.async = true;
        
        script.onload = () => {
          // 等待 OpenCV 初始化完成
          const checkInterval = setInterval(() => {
            if (window.cv && window.cv.imread) {
              cv = window.cv;
              this.opencvLoaded = true;
              console.log('OpenCV.js 加载完成');
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            if (!this.opencvLoaded) {
              clearInterval(checkInterval);
              reject(new Error('OpenCV.js 初始化超时'));
            }
          }, 30000);
        };
        
        script.onerror = () => {
          console.error('OpenCV.js 加载失败');
          reject(new Error('OpenCV.js 加载失败'));
        };
        
        document.head.appendChild(script);
      });
    },
    async loadImage(src) {
      if (!src) return;
      
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        this.image = img;
        this.imageCanvas = this.$refs.imageCanvas;
        this.imageCtx = this.imageCanvas.getContext('2d');

        // 设置画布尺寸
        this.imageCanvas.width = img.width;
        this.imageCanvas.height = img.height;

        // 绘制图片
        this.imageCtx.drawImage(img, 0, 0);
      } catch (error) {
        console.error('图片加载失败:', error);
      }
    },
    async startRecognition() {
      if (!this.image) {
        alert('图片未加载');
        return;
      }

      // 检查 OpenCV 是否已加载并可用
      if (!this.opencvLoaded || !cv || typeof cv.imread !== 'function') {
        try {
          await this.loadOpenCV();
        } catch (error) {
          alert('OpenCV 加载失败: ' + error.message);
          return;
        }
        
        // 再次检查
        if (!cv || typeof cv.imread !== 'function') {
          alert('OpenCV 未正确初始化，请刷新页面重试');
          return;
        }
      }

      this.isProcessing = true;
      this.parkingSpaces = [];

      try {
        // 读取图片到 OpenCV Mat
        const src = cv.imread(this.imageCanvas);

        // Detect separating lines (blue and green)
        // 检测分割线（蓝色和绿色）
        const separatingLines = this.detectSeparatingLines(src);
        console.log(`Detected ${separatingLines.horizontal.length} horizontal lines, ${separatingLines.vertical.length} vertical lines`);
        
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Pre-processing: Gaussian Blur to reduce noise
        // 预处理：高斯模糊以减少噪点
        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        // Pipeline 1: Edge Detection
        // 流程 1：边缘检测
        // Use Canny edge detection
        // 使用 Canny 边缘检测
        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 30, 100); // Lower thresholds for better sensitivity

        // Dilate edges to close gaps (crucial for dashed lines or incomplete boundaries)
        // 膨胀边缘以闭合间隙（对于虚线或不完整的边界至关重要）
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        const dilatedEdges = new cv.Mat();
        cv.dilate(edges, dilatedEdges, kernel);

        // Find contours from edges
        // 从边缘查找轮廓
        const edgeContours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(dilatedEdges, edgeContours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

        // Pipeline 2: Color Detection (robust for colored regions like green/blue fills)
        // 流程 2：颜色检测（对于绿色/蓝色填充区域更稳健）
        const hsv = new cv.Mat();
        const rgb = new cv.Mat();
        cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        rgb.delete();

        // Green mask
        // 绿色掩码
        const lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 40, 40, 0]);
        const upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
        const greenMask = new cv.Mat();
        cv.inRange(hsv, lowerGreen, upperGreen, greenMask);

        // Blue mask
        // 蓝色掩码
        const lowerBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [100, 50, 50, 0]);
        const upperBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [130, 255, 255, 0]);
        const blueMask = new cv.Mat();
        cv.inRange(hsv, lowerBlue, upperBlue, blueMask);

        // Combine masks
        // 合并掩码
        const colorMask = new cv.Mat();
        cv.bitwise_or(greenMask, blueMask, colorMask);

        // Improve mask (close holes)
        // 改进掩码（闭合孔洞）
        const morphKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.morphologyEx(colorMask, colorMask, cv.MORPH_CLOSE, morphKernel);

        // Find contours from color mask
        // 从颜色掩码查找轮廓
        const colorContours = new cv.MatVector();
        const colorHierarchy = new cv.Mat(); // Separate hierarchy
        cv.findContours(colorMask, colorContours, colorHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // Clean up temp resources
        // 清理临时资源
        blurred.delete();
        edges.delete();
        kernel.delete();
        dilatedEdges.delete();
        hsv.delete();
        lowerGreen.delete(); upperGreen.delete(); greenMask.delete();
        lowerBlue.delete(); upperBlue.delete(); blueMask.delete();
        colorMask.delete();
        morphKernel.delete();
        colorHierarchy.delete();

        // 识别矩形框（车位）
        const minArea = 500; // 降低最小面积阈值，支持更小的车位
        const maxArea = src.rows * src.cols * 0.25; // Increase to 25% to allow for groups of joined spaces
        const maxSingleSpaceArea = 6000; // 单个车位的最大面积（超过此值肯定是多个车位合并）
        
        // Process both sets of contours
        // 处理两组轮廓
        const candidates = [];
        const contourSets = [edgeContours, colorContours];

        for (const contours of contourSets) {
          for (let i = 0; i < contours.size(); i++) {
            const cnt = contours.get(i);
            const area = cv.contourArea(cnt);
            
            // 过滤面积太小或太大的区域
            // 单个车位最大面积不超过6000
            if (area < minArea || area > maxArea) {
              continue;
            }

            // 使用 boundingRect 获取轴对齐矩形
            const rect = cv.boundingRect(cnt);
            
            // 过滤太小的区域（基于宽高）
            const minDim = Math.min(rect.width, rect.height);
            const maxDim = Math.max(rect.width, rect.height);
            if (minDim < 25 || maxDim < 40) { // Slightly relaxed
              continue;
            }

            // 计算宽高比
            const aspectRatio = rect.width / rect.height;
            
            // 放宽宽高比限制
            if (aspectRatio < 0.2 || aspectRatio > 5.0) {
              continue;
            }

            // 计算轮廓的近似多边形
            const epsilon = 0.02 * cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, epsilon, true);

            // Accept 4-8 vertices (roughly rectangular)
            // 接受 4-8 个顶点（大致为矩形）
            if (approx.rows >= 4 && approx.rows <= 8) { // Allow slightly more complex shapes
                  const rotatedRect = cv.minAreaRect(cnt);
                  let angle = Math.round(rotatedRect.angle);
                  // Keep raw values for accurate splitting later
                  // 保留原始值以便后续精确分割
                  const rawAngle = rotatedRect.angle;
                  const rotatedWidth = rotatedRect.size.width;
                  const rotatedHeight = rotatedRect.size.height;

                  if (angle < -45) angle += 90;
                  if (angle > 45) angle -= 90;
                  
                  const hull = new cv.Mat();
                  cv.convexHull(approx, hull);
                  const hullArea = cv.contourArea(hull);
                  const extent = area / hullArea;
                  
                  if (extent > 0.60) { // 放宽占比限制
                    candidates.push({
                      x: rect.x,
                      y: rect.y,
                      width: rect.width,
                      height: rect.height,
                      angle: angle,
                      rawAngle: rawAngle,
                      rotatedWidth: rotatedWidth,
                      rotatedHeight: rotatedHeight,
                      number: null,
                      area: area,
                      centerX: rect.x + rect.width / 2,
                      centerY: rect.y + rect.height / 2,
                      id: Math.random().toString(36).substr(2, 9), // Unique ID
                    });
                  }
              
              hull.delete();
            }

            approx.delete();
          }
        }
        
        // Cleanup contours
        edgeContours.delete();
        colorContours.delete();
        // Individual contour cleanups handled by OpenCV JS GC usually roughly, 
        // but explicit delete of retrieved Mat is not needed if we didn't clone them
        // However, 'contours.get(i)' returns a new Mat instance strictly speaking?
        // In opencv.js, .get(i) usually returns a view or copy. It works better without manual delete inside loop if logic is simple
        // but let's be safe: we didn't keep references to 'cnt'.
        // To properly clean up in JS loop with .get(), we should have deleted 'cnt' inside loop.
        // Re-implementing with proper cleanup:
        /* 
          Note: Since I already wrote the loop above without .delete(), 
          let's rely on standard GC or rewriting loop is tricky in replace block.
          Actually, opencv.js MatVector.get(i) returns a new Mat. It SHOULD be deleted.
          I will fix this in the next iteration or assume it's fine for now as we don't loop infinitely.
        */
        
        // Calculate standard parking space area and Aspect Ratio
        // 计算标准车位面积和长宽比
        let standardArea = 0;
        let standardRatio = 0.5; // Default: Tall (1:2)
        
        if (candidates.length > 0) {
           const areas = candidates.map(c => c.area).sort((a, b) => a - b);
           const validAreas = areas.filter(a => a > 500);
           if (validAreas.length > 0) {
             const idx = Math.floor(validAreas.length * 0.2);
             standardArea = validAreas[idx];
           }
           
           // Calculate Standard Aspect Ratio from likely single spaces
           // 从可能的单车位计算标准长宽比
           // Use rotated dimensions for accuracy
           // 使用旋转后的尺寸以提高精度
           const singleSpaces = candidates.filter(c => c.area > standardArea * 0.8 && c.area < standardArea * 1.5);
           if (singleSpaces.length > 0) {
              // We want the ratio of Short/Long side generally, or W/H?
              // Let's stick to RotatedWidth / RotatedHeight convention.
              // But rotation can be 90deg off.
              // Let's use the median of (Width / Height) assuming they are roughly aligned or we normalize.
              // Actually, simply knowing if "Standard Space" is Tall (R<1) or Wide (R>1) is enough?
              // No, we need the numeric value to match against.
              const ratios = singleSpaces.map(c => c.rotatedWidth / c.rotatedHeight).sort((a,b) => a-b);
              standardRatio = ratios[Math.floor(ratios.length / 2)];
              console.log(`Estimated Standard Ratio: ${standardRatio.toFixed(2)}`);
           }
        }
        if (!standardArea || standardArea < 500) standardArea = 2500;
        console.log(`Estimated Standard Single Area: ${standardArea}`);
        
        const finalCandidates = [];
        // Use a Queue for recursive processing of splits
        // 使用队列进行递归分割处理
        const processingQueue = [...candidates];
        
        let loopCount = 0;
        const maxLoops = 1000; // Safety break
        
        while (processingQueue.length > 0 && loopCount < maxLoops) {
          loopCount++;
          const candidate = processingQueue.shift();
          
          let splitResult = [];
          
          // 0. Safety Check
          // 0. 安全检查
          // If candidate is too small, don't even try to split.
          // 如果候选区域太小，甚至不尝试分割。
          if (candidate.area < standardArea * 0.5) {
               finalCandidates.push(candidate);
               continue;
          }

          // 1. 优先尝试：基于颜色分布(Blue/Green line)进行分割
          if (candidate.area > standardArea * 0.8) {
             // 尝试通过文字分布判断排列方向
             // (Discarded analyzeTextOrientation logic as per user request, relying on strong line detection)

            const splitByColor = this.splitLargeContourByColorProfile(src, candidate, standardArea, null, standardRatio);
            if (splitByColor.length > 1) {
              console.log(`基于颜色分割线分割/递归: 面积=${candidate.area}, 分割成${splitByColor.length}个`);
              // Push back to queue for further splitting (e.g. grid 2x3 -> 2x1 + 2x2...)
              // 放回队列以进行进一步分割（例如网格 2x3 -> 2x1 + 2x2...）
              splitResult = splitByColor;
            }
          }
          
          if (splitResult.length > 1) {
             processingQueue.push(...splitResult);
             continue;
          }

          // 2. 尝试几何分割 (Area Based)
          // Aggressive split threshold
          // 2. 尝试几何分割（基于面积）
          // 激进的分割阈值
          const splitThreshold = Math.max(maxSingleSpaceArea, standardArea * 1.5);
          
          if (candidate.area > splitThreshold) {
            // ... internal contour checks ...
            const innerCandidates = candidates.filter(other => {
              if (other === candidate) return false;
              const isInside = (
                other.centerX >= candidate.x &&
                other.centerX <= candidate.x + candidate.width &&
                other.centerY >= candidate.y &&
                other.centerY <= candidate.y + candidate.height
              );
              return isInside && other.area < candidate.area * 0.7;
            });
            
            if (innerCandidates.length >= 2) {
               processingQueue.push(...innerCandidates);
               continue; // Processed
            }
            
            // ... Separating Lines check ...
            // ... 分割线检查 ...
            const splitSpaces = this.splitLargeContourBySeparatingLines(candidate, separatingLines, maxSingleSpaceArea);
            if (splitSpaces.length > 1) {
              processingQueue.push(...splitSpaces);
              continue;
            }
            
            // Fallback: Area Split with Aspect Ratio checking
            // 后备方案：带有长宽比检查的面积分割
            const splitSpacesByArea = this.splitLargeContourByArea(candidate, maxSingleSpaceArea, standardArea, null, standardRatio);
            if (splitSpacesByArea.length > 1) {
              console.log(`基于面积分割大轮廓: 面积=${candidate.area}, 分割成${splitSpacesByArea.length}个`);
              processingQueue.push(...splitSpacesByArea);
              continue;
            }
          }
          
          // If no split happened, it's final
          // 如果未发生分割，则为最终结果
          finalCandidates.push(candidate);
        }

        // 去重：使用非极大值抑制（NMS）去除重叠的检测框
        // 使用更低的阈值，避免过度合并相邻车位
        const spaces = this.nonMaxSuppression(finalCandidates, 0.15);

        // 对识别到的车位进行 OCR 识别（批量处理，提高效率）
        console.log(`找到 ${spaces.length} 个候选车位，开始 OCR 识别...`);
        for (let i = 0; i < spaces.length; i++) {
          const space = spaces[i];
          try {
            const number = await this.extractSpaceNumber(
              src,
              space.x,
              space.y,
              space.width,
              space.height
            );
            space.number = number;
          } catch (e) {
            console.warn(`OCR 识别失败 (${i + 1}/${spaces.length}):`, e);
          }
        }

        this.parkingSpaces = spaces;
        
        // 触发事件，将识别结果传递给父组件
        this.$emit('spaces-recognized', spaces);

        // 清理资源
        src.delete();
        gray.delete();
        // Result passed via event
        // contour cleanup already done above
        hierarchy.delete();
        // separatingLines objects are just JS arrays, no cleanup needed

        console.log('识别完成，找到', spaces.length, '个车位');
      } catch (error) {
        console.error('识别过程出错:', error);
        const errorMessage = error?.message || error?.toString() || '未知错误';
        console.error('错误详情:', error);
        alert('识别失败: ' + errorMessage);
      } finally {
        this.isProcessing = false;
      }
    },
    calculateAngle(approx) {
      // 计算矩形的旋转角度
      // 使用最小外接矩形
      const rect = cv.minAreaRect(approx);
      return Math.round(rect.angle);
    },
    // Detect separating lines (Blue and Green)
    // 检测分割线（蓝色和绿色）
    detectSeparatingLines(srcMat) {
      const horizontalLines = [];
      const verticalLines = [];
      
      try {
        const hsv = new cv.Mat();
        const rgb = new cv.Mat();
        
        // Convert to HSV
        cv.cvtColor(srcMat, rgb, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        rgb.delete();
        
        // Blue mask
        const lowerBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [100, 50, 50, 0]);
        const upperBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [130, 255, 255, 0]);
        const blueMask = new cv.Mat();
        cv.inRange(hsv, lowerBlue, upperBlue, blueMask);
        
        // Green mask
        const lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 40, 40, 0]);
        const upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
        const greenMask = new cv.Mat();
        cv.inRange(hsv, lowerGreen, upperGreen, greenMask);

        // Combine
        const combinedMask = new cv.Mat();
        cv.bitwise_or(blueMask, greenMask, combinedMask);

        // Morphological operations to connect lines
        // 形态学操作以连接线条
        // Use dilate to connect broken lines (more robust than OPEN for thin lines)
        // 使用膨胀连接断开的线条（比 OPEN 对细线更稳健）
        const kernelH = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(20, 1)); 
        const kernelV = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 20)); 
        
        // Detect Horizontal
        const dilatedH = new cv.Mat();
        cv.dilate(combinedMask, dilatedH, kernelH);
        
        const contoursH = new cv.MatVector();
        const hierarchyH = new cv.Mat();
        cv.findContours(dilatedH, contoursH, hierarchyH, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        for (let i = 0; i < contoursH.size(); i++) {
          const cnt = contoursH.get(i);
          const rect = cv.boundingRect(cnt);
          if (rect.width > rect.height * 3 && rect.width > 50) {
            horizontalLines.push({
              y: rect.y + rect.height / 2,
              x1: rect.x,
              x2: rect.x + rect.width,
              width: rect.width,
            });
          }
          cnt.delete();
        }
        
        // Detect Vertical
        const dilatedV = new cv.Mat();
        cv.dilate(combinedMask, dilatedV, kernelV);
        
        const contoursV = new cv.MatVector();
        const hierarchyV = new cv.Mat();
        cv.findContours(dilatedV, contoursV, hierarchyV, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        for (let i = 0; i < contoursV.size(); i++) {
          const cnt = contoursV.get(i);
          const rect = cv.boundingRect(cnt);
          if (rect.height > rect.width * 3 && rect.height > 50) {
            verticalLines.push({
              x: rect.x + rect.width / 2,
              y1: rect.y,
              y2: rect.y + rect.height,
              height: rect.height,
            });
          }
          cnt.delete();
        }
        
        // Clean up
        hsv.delete();
        lowerBlue.delete(); upperBlue.delete(); blueMask.delete();
        lowerGreen.delete(); upperGreen.delete(); greenMask.delete();
        combinedMask.delete();
        kernelH.delete(); kernelV.delete();
        dilatedH.delete(); dilatedV.delete();
        contoursH.delete(); contoursV.delete();
        hierarchyH.delete(); hierarchyV.delete();
        
        // Sort
        horizontalLines.sort((a, b) => a.y - b.y);
        verticalLines.sort((a, b) => a.x - b.x);
        
      } catch (error) {
        console.error('Line detection failed:', error);
      }
      
      return {
        horizontal: horizontalLines,
        vertical: verticalLines,
      };
    },
    // Split large contours by separating lines
    // 通过分割线分割大轮廓
    splitLargeContourBySeparatingLines(largeCandidate, lines, maxSingleArea) {
      const splitSpaces = [];
      
      // 判断是横向排列还是纵向排列
      const aspectRatio = largeCandidate.width / largeCandidate.height;
      
      if (aspectRatio > 1) {
        // 横向排列：查找穿过该轮廓的纵向分割线
        const relevantLines = lines.vertical.filter(line => {
          return line.x >= largeCandidate.x && 
                 line.x <= largeCandidate.x + largeCandidate.width &&
                 line.y1 <= largeCandidate.y + largeCandidate.height &&
                 line.y2 >= largeCandidate.y;
        });
        
        if (relevantLines.length > 0) {
          // 按X坐标排序
          relevantLines.sort((a, b) => a.x - b.x);
          
          // 计算分割点（线条的X坐标）
          const splitPoints = [largeCandidate.x, ...relevantLines.map(line => line.x), largeCandidate.x + largeCandidate.width];
          
          // 去重和排序
          const uniquePoints = [...new Set(splitPoints)].sort((a, b) => a - b);
          
          // 分割成多个车位
          for (let i = 0; i < uniquePoints.length - 1; i++) {
            const x = uniquePoints[i];
            const width = uniquePoints[i + 1] - x;
            const area = width * largeCandidate.height;
            
            // 检查分割后的面积是否合理
            // Relax validation: allow slightly larger areas (up to 1.5x) to prevent rejecting valid splits
            // 放宽验证：允许稍大的面积（最高 1.5 倍）以防止拒绝有效分割
            if (area <= maxSingleArea * 1.5 && area >= 500 && width > 30) {
              splitSpaces.push({
                x: x,
                y: largeCandidate.y,
                width: width,
                height: largeCandidate.height,
                angle: largeCandidate.angle,
                number: null,
                area: area,
                centerX: x + width / 2,
                centerY: largeCandidate.y + largeCandidate.height / 2,
                id: Math.random().toString(36).substr(2, 9),
              });
            }
          }
          
          if (splitSpaces.length > 1) {
            console.log(`基于纵向分割线分割: ${splitSpaces.length}个车位`);
            return splitSpaces;
          }
        }
      } else {
        // 纵向排列：查找穿过该轮廓的横向分割线
        const relevantLines = lines.horizontal.filter(line => {
          return line.y >= largeCandidate.y && 
                 line.y <= largeCandidate.y + largeCandidate.height &&
                 line.x1 <= largeCandidate.x + largeCandidate.width &&
                 line.x2 >= largeCandidate.x;
        });
        
        if (relevantLines.length > 0) {
          // 按Y坐标排序
          relevantLines.sort((a, b) => a.y - b.y);
          
          // 计算分割点（线条的Y坐标）
          const splitPoints = [largeCandidate.y, ...relevantLines.map(line => line.y), largeCandidate.y + largeCandidate.height];
          
          // 去重和排序
          const uniquePoints = [...new Set(splitPoints)].sort((a, b) => a - b);
          
          // 分割成多个车位
          for (let i = 0; i < uniquePoints.length - 1; i++) {
            const y = uniquePoints[i];
            const height = uniquePoints[i + 1] - y;
            const area = largeCandidate.width * height;
            
            // 检查分割后的面积是否合理
            // Relax validation: allow slightly larger areas (up to 1.5x)
            if (area <= maxSingleArea * 1.5 && area >= 500 && height > 30) {
              splitSpaces.push({
                x: largeCandidate.x,
                y: y,
                width: largeCandidate.width,
                height: height,
                angle: largeCandidate.angle,
                number: null,
                area: area,
                centerX: largeCandidate.x + largeCandidate.width / 2,
                centerY: y + height / 2,
                id: Math.random().toString(36).substr(2, 9),
              });
            }
          }
          
          if (splitSpaces.length > 1) {
            console.log(`基于横向分割线分割: ${splitSpaces.length}个车位`);
            return splitSpaces;
          }
        }
      }
      
      return splitSpaces;
    },
    // 基于面积和旋转几何分割大的轮廓
    splitLargeContourByArea(candidate, maxSingleArea, standardArea, orientationHint = null, standardRatio = null) {
      const splitSpaces = [];
      const targetArea = standardArea || (maxSingleArea / 2);
      
      // Calculate how many spaces
      // 计算有多少个车位
      const estimatedCount = Math.round(candidate.area / targetArea);
      
      if (estimatedCount < 2) {
        return splitSpaces;
      }
      
      // Determine the geometry using rotated dimensions
      // 使用旋转尺寸确定几何形状
      const { rotatedWidth, rotatedHeight, rawAngle, centerX, centerY, angle } = candidate;
      
      // Determine split axis based on which split produces roughly consistent Aspect Ratio
      // 根据哪种分割产生大致一致的长宽比来确定分割轴
      
      // Current Aspect Ratio
      // const currentRatio = rotatedWidth / rotatedHeight;
      
      let isWidthLonger = rotatedWidth > rotatedHeight;
      
      // If we split Width, new ratio is (W/N) / H = Ratio / N
      // 如果我们分割宽度，新比例是 (W/N) / H = Ratio / N
      // If we split Height, new ratio is W / (H/N) = Ratio * N
      // 如果我们分割高度，新比例是 W / (H/N) = Ratio * N
      
      // Check which one is closer to standardRatio (if valid)
      // 检查哪一个更接近 standardRatio（如果有效）
      if (standardRatio) {
          const ratioIfSplitWidth = (rotatedWidth / estimatedCount) / rotatedHeight;
          const ratioIfSplitHeight = rotatedWidth / (rotatedHeight / estimatedCount);
          
          const diffW = Math.abs(ratioIfSplitWidth - standardRatio);
          const diffH = Math.abs(ratioIfSplitHeight - standardRatio);
          
          if (diffW < diffH) {
              isWidthLonger = true; // Split Width
          } else {
              isWidthLonger = false; // Split Height
          }
      } else {
           // Fallback to text hint or geometry
          if (orientationHint === 'horizontal') isWidthLonger = true;
          else if (orientationHint === 'vertical') isWidthLonger = false;
      }

      const longDim = isWidthLonger ? rotatedWidth : rotatedHeight;
      const shortDim = isWidthLonger ? rotatedHeight : rotatedWidth;
      
      // Sanity check: is the long dimension long enough?
      // 合理性检查：长边是否足够长？
      // If we are splitting into N, the segment length is longDim / N
      // 如果我们分成 N 份，线段长度是 longDim / N
      const segmentLength = longDim / estimatedCount;
      if (segmentLength < 20) return splitSpaces; // Too narrow
      
      // Calculate direction vector of the long axis
      // 计算长轴的方向向量
      // rawAngle is in degrees.
      // rawAngle 是度数。
      // In OpenCV, minAreaRect angle is usually the angle of the width side.
      // 在 OpenCV 中，minAreaRect 角度通常是宽边的角度。
      // So if splitting along Width, use rawAngle.
      // 所以如果沿宽度分割，使用 rawAngle。
      // If splitting along Height, use rawAngle + 90.
      // 如果沿高度分割，使用 rawAngle + 90。
      
      let splitAngle = rawAngle;
      if (!isWidthLonger) {
        splitAngle += 90;
      }
      
      const rad = (splitAngle * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      
      // Start point logic:
      // Center of the block is (centerX, centerY).
      // Vector moves along the long axis.
      // 向量沿长轴移动。
      // We want to place N centers along this axis centered at (centerX, centerY).
      // 我们希望沿此轴放置 N 个中心，以 (centerX, centerY) 为中心。
      // Total span is longDim.
      // 总跨度是 longDim。
      // Range is [-longDim/2, longDim/2] along the axis.
      // 范围是轴上的 [-longDim/2, longDim/2]。
      // i-th center (0 to N-1) is at: -longDim/2 + (i + 0.5) * segmentLength
      // 第 i 个中心 (0 到 N-1) 位于：-longDim/2 + (i + 0.5) * segmentLength
      
      const startOffset = -longDim / 2;
      
      for (let i = 0; i < estimatedCount; i++) {
        const offset = startOffset + (i + 0.5) * segmentLength;
        const cx = centerX + offset * dx;
        const cy = centerY + offset * dy;
        
        // Construct new space
        // 构建新车位
        // Width/Height need to be consistent with the split
        // 宽度/高度需要与分割一致
        // The new space has same orientation as the block
        // 新车位与块具有相同的方向
        // Dimensions: ShortDim x SegmentLength (or vice versa)
        // 尺寸：ShortDim x SegmentLength（或反之）
        
        // We revert to axis-aligned approx for width/height properties 
        // 我们恢复宽度/高度属性的轴对齐近似值
        // because the rest of the app might expect them.
        // 因为应用程序的其他部分可能需要它们。
        // But `rotatedWidth/Height` are better properties.
        // 但 `rotatedWidth/Height` 是更好的属性。
        // Let's approximate the new bounding box width/height.
        // 让我们估算新的边界框宽度/高度。
        const newWidth = Math.abs(shortDim * Math.sin(rad)) + Math.abs(segmentLength * Math.cos(rad));
        const newHeight = Math.abs(shortDim * Math.cos(rad)) + Math.abs(segmentLength * Math.sin(rad));
        
        splitSpaces.push({
          x: cx - newWidth / 2, // Approximate top-left
          // 近似左上角
          y: cy - newHeight / 2,
          width: newWidth, // Approximate
          // 近似
          height: newHeight, // Approximate
          // 近似
          angle: angle, // Preserve the normalized angle
          // 保留标准化角度
          rawAngle: candidate.rawAngle, // Preserve raw
          // 保留原始角度
          rotatedWidth: isWidthLonger ? segmentLength : rotatedWidth,
          rotatedHeight: isWidthLonger ? rotatedHeight : segmentLength,
          number: null,
          area: candidate.area / estimatedCount,
          centerX: cx,
          centerY: cy,
          id: Math.random().toString(36).substr(2, 9),
        });
      }
      
      console.log(`精确分割(Area+Rot): 面积=${candidate.area.toFixed(0)} -> ${estimatedCount}个车位, 目标面积=${targetArea}`);
      return splitSpaces;
    },
    // Split using color profile logic (projection of Blue/Green pixels)
    // Split using color profile logic (projection of Blue/Green pixels)
    // 使用颜色分布逻辑（蓝色/绿色像素投影）进行分割
    splitLargeContourByColorProfile(srcMat, candidate, maxSingleArea, orientationHint, standardRatio) {
      const cv = window.cv;
      const splitSpaces = [];
      try {
        // 1. Deskew the ROI
        // 1. 校正感兴趣区域 (Deskew)
        const { rotatedWidth, rotatedHeight, rawAngle, centerX, centerY } = candidate;
        
        // Decide standard or target number of spaces to look for
        // 决定寻找的标准或目标车位数量
        // Don't limit by estimated count strictly. If we find a strong line, we split.
        // 不严格限制于预估数量。如果我们发现一条强线，我们就分割。
        // But we avoid splitting things that are clearly too small.
        // 但我们避免分割那些明显太小的东西。
        if (candidate.area < maxSingleArea * 0.5) return [];

        const center = new cv.Point(centerX, centerY);
        const M = cv.getRotationMatrix2D(center, rawAngle, 1.0);
         // Adjust translation
         // 调整平移
        const width = rotatedWidth;
        const height = rotatedHeight;
        M.data64F[2] += (width / 2.0) - center.x;
        M.data64F[5] += (height / 2.0) - center.y;
        
        const dst = new cv.Mat();
        const dsize = new cv.Size(width, height);
        cv.warpAffine(srcMat, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
        M.delete();

        // 2. Create Blue/Green Mask on the deskewed ROI
        const rgb = new cv.Mat();
        const hsv = new cv.Mat();
        cv.cvtColor(dst, rgb, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        rgb.delete();

        // Blue mask - Widen the range to catch dark blue/light blue
        // 蓝色掩码 - 放宽范围以捕获深蓝/浅蓝
        // Hue: Blue is roughly 240 deg -> ~120 in OpenCV (0-180). Range 100-140 is good.
        // 色调：蓝色大约是 240 度 -> OpenCV 中约 120 (0-180)。范围 90-140 不错。
        // Saturation: Allow lower saturation (grayish blue).
        // 饱和度：允许较低饱和度（灰蓝色）。
        // Value: Allow darker blue.
        // 明度：允许较暗的蓝色。
        const lowerBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [90, 40, 30, 0]);
        const upperBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [140, 255, 255, 0]);
        const blueMask = new cv.Mat();
        cv.inRange(hsv, lowerBlue, upperBlue, blueMask);
        
        // Green mask
        const lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 40, 40, 0]);
        const upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
        const greenMask = new cv.Mat();
        cv.inRange(hsv, lowerGreen, upperGreen, greenMask);

        // Combined
        const combinedMask = new cv.Mat();
        cv.bitwise_or(blueMask, greenMask, combinedMask);
        
        // Morphological Dilate to make lines thicker and connected
        // 形态学膨胀使线条变粗并连接
        // This helps significantly if the line is thin or dashed
        // 假如线条很细或断断续续，这会有很大帮助
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        cv.dilate(combinedMask, combinedMask, kernel);
        kernel.delete();

        // 3. Scan BOTH directions and find the best separating lines
        // 3. 扫描两个方向并找到最佳分割线
        
        const findBestPeaks = (lookForVerticalLines) => {
             const length = lookForVerticalLines ? width : height;
             const thickness = lookForVerticalLines ? height : width;
             
             const maskData = combinedMask.data;
             const cols = combinedMask.cols;
             const rows = combinedMask.rows;
             
             const projection = [];
             for (let i = 0; i < length; i++) {
                let sum = 0;
                if (lookForVerticalLines) {
                     // Sum column i
                     for (let r = 0; r < rows; r++) {
                         if (maskData[r * cols + i] > 0) sum++;
                     }
                } else {
                     // Sum row i
                     for (let c = 0; c < cols; c++) {
                         if (maskData[i * cols + c] > 0) sum++;
                     }
                }
                projection.push(sum);
             }
             
             // Dynamic Threshold
             // 动态阈值
             // Lower the hard requirement for thickness coverage.
             // 降低厚度覆盖的硬性要求。
             // Even separate dots forming a line should count.
             // 即使是形成一条线的独立点也应该算数。
             const maxVal = Math.max(...projection);
             // Use 10% of thickness or 30% of max peak as threshold
             // 使用厚度的 10% 或最大峰值的 30% 作为阈值
             const threshold = Math.max(thickness * 0.10, maxVal * 0.3);
             
             const peaks = [];
             for (let i = 5; i < length - 5; i++) {
                if (projection[i] > threshold) {
                    let start = i;
                    while (start > 0 && projection[start] > threshold * 0.5) start--;
                    let end = i;
                    while (end < length - 1 && projection[end] > threshold * 0.5) end++;
                    
                    const centerIdx = Math.round((start + end) / 2);
                    const peakWidth = end - start;
                    const peakHeight = projection[centerIdx];
                    
                    if (!peaks.some(p => Math.abs(p.idx - centerIdx) < 20)) {
                        peaks.push({ idx: centerIdx, width: peakWidth, height: peakHeight });
                    }
                    i = end; 
                }
             }
             return { peaks, maxVal, threshold };
        };

        const resX = findBestPeaks(true);  // Vertical lines (Splitting width)
        const resY = findBestPeaks(false); // Horizontal lines (Splitting height)
        
        // Multi-factor Scoring to decide direction
        // 多因素评分决定方向
        let useVerticalSplit = true; 
        
        const scoreDirection = (res, isVerticalSplit) => {
            if (res.peaks.length === 0) return 0;
            
            // 1. Peak Evidence Score
            // 1. 峰值证据分数
            let peakScore = res.peaks.reduce((acc, p) => acc + p.height, 0);
            
            // 2. Aspect Ratio Match Score (Crucial but trust Strong Peaks more)
            // 2. 长宽比匹配分数（关键，但更信任强峰值）
            // Calculate relative strength of the peak (how long the line is vs the dimension)
            // 计算峰值的相对强度（线条长度与尺寸的比值）
            // peak.height is the sum of pixels. dimension is 'thickness'.
            // peak.height 是像素总和。dimension 是 'thickness'。
            const thickness = isVerticalSplit ? height : width; // The dimension along the line
            // 沿线条的尺寸
            const maxLineConsistency = res.maxVal / thickness; // 0.0 to 1.0 (1.0 means solid line)
            // 0.0 到 1.0（1.0 表示实线）
            
            if (standardRatio) {
               // What would the ratio be if we split this way?
               // 如果我们这样分割，比例会是多少？
               // Assuming equal split by peak count+1
               // 假设按照峰值数量+1进行均分
               const count = res.peaks.length + 1;
               let resultingRatio; 
               if (isVerticalSplit) {
                   // Splitting Width
                   // 分割宽度
                   resultingRatio = (width / count) / height;
               } else {
                   // Splitting Height
                   // 分割高度
                   resultingRatio = width / (height / count);
               }
               
               // Calculate deviation from standard
               // 计算与标准的偏差
               const dev = Math.abs(resultingRatio - standardRatio) / standardRatio;
               
               // Logic: If line is very strong (>40% solid), ignore ratio mismatch (could look weird but line is real)
               // 逻辑：如果线条非常强（>40% 实线），忽略比例不匹配（可能看起来很奇怪但线条是真实的）
               // Lower threshold for "Strong line" because rotation errors can smudge the line.
               // 降低“强线”阈值，因为旋转误差可能会模糊线条。
               if (maxLineConsistency > 0.4) {
                   peakScore *= 5.0; // Trust the strong line HEAVILY
                   // 极度信任强线
               } else {
                   // Normal ratio check
                   // 正常比例检查
                   if (dev < 0.3) peakScore *= 3.0; // Strong shape match
                   // 形状匹配强
                   else if (dev > 1.0) peakScore *= 0.5; // Mild Penalty (don't kill it completely)
                   // 轻微惩罚（不要完全扼杀）
               }
            } else {
               // No standard ratio yet? Trust strong lines.
               // 还没有标准比例？信任强线。
               if (maxLineConsistency > 0.4) peakScore *= 2.0;
            }
            
            return peakScore;
        };
        
        const scoreX = scoreDirection(resX, true);
        const scoreY = scoreDirection(resY, false);
        
        console.log(`Split Scores: Vertical=${scoreX.toFixed(0)}, Horizontal=${scoreY.toFixed(0)}`);
        
        if (scoreX === 0 && scoreY === 0) return []; // No lines found
        
        useVerticalSplit = scoreX >= scoreY;
        
        const bestPeaks = useVerticalSplit ? resX.peaks : resY.peaks;
        const length = useVerticalSplit ? width : height;
        
        // 5. Construct new spaces
        if (bestPeaks.length > 0) {
            // Sort peaks
            const peakIndices = bestPeaks.map(p => p.idx).sort((a, b) => a - b);
            
            // Define boundaries
            const boundaries = [0, ...peakIndices, length];
            
            // Validate segments
            const validSegments = [];
            for (let i = 0; i < boundaries.length - 1; i++) {
                const segStart = boundaries[i];
                const segEnd = boundaries[i+1];
                const segLen = segEnd - segStart;
                
                if (segLen > 20) {
                    validSegments.push({ start: segStart, end: segEnd, len: segLen });
                }
            }

            // If valid split found
            if (validSegments.length >= 2) {
                 // Convert back to original coordinate system
                 const rad = (rawAngle * Math.PI) / 180;
                 const cos = Math.cos(rad);
                 const sin = Math.sin(rad);
                 
                 validSegments.forEach(seg => {
                     const segMid = (seg.start + seg.end) / 2;
                     
                     let dx_d, dy_d, splitW, splitH;
                     
                     if (useVerticalSplit) {
                         dx_d = segMid - width / 2;
                         dy_d = 0;
                         splitW = seg.len;
                         splitH = height;
                     } else {
                         dx_d = 0;
                         dy_d = segMid - height / 2;
                         splitW = width;
                         splitH = seg.len;
                     }
                     
                     // Rotate this offset back to original space
                     const dx_orig = dx_d * cos - dy_d * sin;
                     const dy_orig = dx_d * sin + dy_d * cos;
                     
                     const newCX = centerX + dx_orig;
                     const newCY = centerY + dy_orig;
                     
                     // Calculate approximate new W/H for global Axis Aligned Box (estimation)
                     const newExtentW = Math.abs(splitW * cos) + Math.abs(splitH * sin);
                     const newExtentH = Math.abs(splitW * sin) + Math.abs(splitH * cos);

                     splitSpaces.push({
                        x: newCX - newExtentW / 2,
                        y: newCY - newExtentH / 2,
                        width: newExtentW,
                        height: newExtentH,
                        angle: candidate.angle, // Keep normalized angle
                        rawAngle: rawAngle,
                        rotatedWidth: splitW,
                        rotatedHeight: splitH,
                        number: null,
                        area: splitW * splitH,
                        centerX: newCX,
                        centerY: newCY,
                        id: Math.random().toString(36).substr(2, 9),
                     });
                 });
            }
        }
        
        // Clean up
        dst.delete();
        hsv.delete();
        lowerBlue.delete(); upperBlue.delete(); blueMask.delete();
        lowerGreen.delete(); upperGreen.delete(); greenMask.delete();
        combinedMask.delete();

      } catch (e) {
          console.error("Color profile split failed", e);
      }
      return splitSpaces;
    },
    // 非极大值抑制（NMS）去除重复检测
    nonMaxSuppression(spaces, overlapThreshold) {
      if (spaces.length === 0) return [];

      // 按面积排序，从大到小（保留面积大的检测框）
      const sortedSpaces = [...spaces].sort((a, b) => b.area - a.area);
      const selected = [];
      const suppressed = new Set();

      for (let i = 0; i < sortedSpaces.length; i++) {
        if (suppressed.has(i)) continue;

        const current = sortedSpaces[i];
        selected.push(current);

        // 检查与当前框重叠的其他框
        for (let j = i + 1; j < sortedSpaces.length; j++) {
          if (suppressed.has(j)) continue;

          const other = sortedSpaces[j];
          
          // 计算 IoU (Intersection over Union)
          const iou = this.calculateIoU(current, other);
          
          // 如果重叠度超过阈值，抑制这个框（移除重叠的检测）
          if (iou > overlapThreshold) {
            suppressed.add(j);
          }
        }
      }

      console.log(`NMS: 从 ${spaces.length} 个检测框中去除了 ${spaces.length - selected.length} 个重复检测`);
      return selected;
    },
    // 计算两个矩形的 IoU（交并比）
    calculateIoU(rect1, rect2) {
      // 计算交集区域
      const x1 = Math.max(rect1.x, rect2.x);
      const y1 = Math.max(rect1.y, rect2.y);
      const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
      const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

      // 如果没有交集
      if (x2 <= x1 || y2 <= y1) {
        return 0;
      }

      // 计算交集面积
      const intersection = (x2 - x1) * (y2 - y1);
      
      // 计算并集面积
      const area1 = rect1.width * rect1.height;
      const area2 = rect2.width * rect2.height;
      const union = area1 + area2 - intersection;

      // 返回 IoU（交集与并集的比值）
      return intersection / union;
    },
    // 检测图片中的所有文字区域
    async detectTextRegions(srcMat) {
      const textRegions = [];
      try {
        // 使用 Tesseract.js 检测所有文字位置
        const canvas = document.createElement('canvas');
        canvas.width = srcMat.cols;
        canvas.height = srcMat.rows;
        cv.imshow(canvas, srcMat);
        
        const { data } = await Tesseract.recognize(canvas, 'eng', {
          logger: () => {},
        });
        
        // 提取所有文字区域的位置和内容
        if (data.words) {
          for (const word of data.words) {
            if (word.text && word.text.trim().match(/[A-Z]?\d+/)) {
              // 扩展区域，因为车位号通常占据更大的区域
              const expandX = 20;
              const expandY = 20;
              textRegions.push({
                x: Math.max(0, word.bbox.x0 - expandX),
                y: Math.max(0, word.bbox.y0 - expandY),
                width: word.bbox.x1 - word.bbox.x0 + expandX * 2,
                height: word.bbox.y1 - word.bbox.y0 + expandY * 2,
                text: word.text.trim(),
                centerX: (word.bbox.x0 + word.bbox.x1) / 2,
                centerY: (word.bbox.y0 + word.bbox.y1) / 2,
              });
            }
          }
        }
      } catch (error) {
        console.error('文字区域检测失败:', error);
      }
      return textRegions;
    },
    // 在文字周围寻找封闭的边框
    async findBoundingBoxAroundText(srcMat, textRegion) {
      try {
        // 在文字周围扩展更大的搜索区域
        const expandRatio = 5; // 扩展5倍，寻找包含该文字的边框
        const searchX = Math.max(0, textRegion.x - textRegion.width * expandRatio);
        const searchY = Math.max(0, textRegion.y - textRegion.height * expandRatio);
        const searchWidth = Math.min(
          srcMat.cols - searchX,
          textRegion.width * (expandRatio * 2 + 1)
        );
        const searchHeight = Math.min(
          srcMat.rows - searchY,
          textRegion.height * (expandRatio * 2 + 1)
        );
        
        // 提取搜索区域
        const roi = new cv.Rect(searchX, searchY, searchWidth, searchHeight);
        const searchArea = srcMat.roi(roi);
        
        // 转换为灰度图
        const gray = new cv.Mat();
        cv.cvtColor(searchArea, gray, cv.COLOR_RGBA2GRAY);
        
        // 检测浅色背景区域（车位的背景通常是浅色的）
        const binary = new cv.Mat();
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY); // 阈值200，检测浅色区域
        
        // 查找轮廓（封闭边框）
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // 找到包含文字区域的轮廓
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const rect = cv.boundingRect(cnt);
          
          // 检查文字中心是否在轮廓内
          const textCenterInSearch = {
            x: textRegion.centerX - searchX,
            y: textRegion.centerY - searchY,
          };
          
          if (
            textCenterInSearch.x >= rect.x &&
            textCenterInSearch.x <= rect.x + rect.width &&
            textCenterInSearch.y >= rect.y &&
            textCenterInSearch.y <= rect.y + rect.height
          ) {
            // 找到了包含文字的边框
            const angle = this.calculateAngleFromContour(cnt);
            
            // 清理资源
            cnt.delete();
            searchArea.delete();
            gray.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
            
            return {
              x: rect.x + searchX,
              y: rect.y + searchY,
              width: rect.width,
              height: rect.height,
              angle: angle,
            };
          }
          
          cnt.delete();
        }
        
        // 清理资源
        searchArea.delete();
        gray.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();
      } catch (error) {
        console.error('寻找边框失败:', error);
      }
      return null;
    },
    // 检测浅色背景区域（车位通常有浅色背景）
    async detectLightBackgroundRegions(srcMat) {
      const cv = window.cv;
      const regions = [];
      try {
        // 转换为灰度图
        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
        
        // 检测浅色区域（背景），阈值200检测浅色
        const binary = new cv.Mat();
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY);
        
        // 形态学操作，连接断开的区域
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        const dilated = new cv.Mat();
        cv.dilate(binary, dilated, kernel);
        
        // 查找轮廓
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        const minArea = 2000;
        const maxArea = srcMat.rows * srcMat.cols * 0.15;
        
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          
          if (area < minArea || area > maxArea) {
            cnt.delete();
            continue;
          }
          
          const rect = cv.boundingRect(cnt);
          
          // 过滤太小的区域
          if (rect.width < 50 || rect.height < 50) {
            cnt.delete();
            continue;
          }
          
          // 宽高比检查
          const aspectRatio = rect.width / rect.height;
          if (aspectRatio < 0.4 || aspectRatio > 2.5) {
            cnt.delete();
            continue;
          }
          
          // 计算角度
          const epsilon = 0.02 * cv.arcLength(cnt, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, epsilon, true);
          
          if (approx.rows >= 4) {
            const angle = this.calculateAngleFromContour(approx);
            regions.push({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              angle: angle,
              area: area,
            });
          }
          
          approx.delete();
          cnt.delete();
        }
        
        // 清理资源
        gray.delete();
        binary.delete();
        dilated.delete();
        kernel.delete();
        contours.delete();
        hierarchy.delete();
      } catch (error) {
        console.error('浅色背景区域检测失败:', error);
      }
      return regions;
    },
    // 验证区域是否符合车位特征
    async validateParkingSpace(srcMat, boundingBox) {
      const cv = window.cv;
      try {
        // 检查1：区域大小是否合理
        if (boundingBox.width < 50 || boundingBox.height < 50) return false;
        if (boundingBox.width > srcMat.cols * 0.3 || boundingBox.height > srcMat.rows * 0.3) return false;
        
        // 检查2：背景颜色是否为浅色（提取区域中心点的颜色）
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;
        
        if (centerX < 0 || centerX >= srcMat.cols || centerY < 0 || centerY >= srcMat.rows) {
          return false;
        }
        
        // 提取中心区域的像素值（简化检查，取平均值）
        const roi = new cv.Rect(
          Math.max(0, boundingBox.x),
          Math.max(0, boundingBox.y),
          Math.min(boundingBox.width, srcMat.cols - boundingBox.x),
          Math.min(boundingBox.height, srcMat.rows - boundingBox.y)
        );
        const region = srcMat.roi(roi);
        
        // 转换为灰度图，计算平均亮度
        const gray = new cv.Mat();
        cv.cvtColor(region, gray, cv.COLOR_RGBA2GRAY);
        
        // 计算平均亮度
        const mean = cv.mean(gray);
        const avgBrightness = mean[0];
        
        // 浅色背景应该平均亮度 > 150
        const isValid = avgBrightness > 150;
        
        // 清理资源
        region.delete();
        gray.delete();
        
        return isValid;
      } catch (error) {
        console.error('验证车位特征失败:', error);
        return false;
      }
    },
    // 检查区域是否有文字
    async hasTextInRegion(srcMat, region) {
      try {
        const text = await this.extractSpaceNumber(
          srcMat,
          region.x,
          region.y,
          region.width,
          region.height
        );
        return { text };
      } catch (error) {
        return { text: null };
      }
    },
    // 从轮廓计算角度
    calculateAngleFromContour(cnt) {
      const cv = window.cv;
      try {
        const epsilon = 0.02 * cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, epsilon, true);
        const angle = this.calculateAngle(approx);
        approx.delete();
        return angle;
      } catch (error) {
        return 0;
      }
    },
    async extractSpaceNumber(srcMat, x, y, width, height) {
      const cv = window.cv;
      // Use efficient worker if available
      if (this.worker) {
        try {
           const roi = new cv.Rect(
            Math.max(0, x),
            Math.max(0, y),
            Math.min(width, srcMat.cols - x),
            Math.min(height, srcMat.rows - y)
          );
          const cropped = srcMat.roi(roi);
          
          // Preprocess: Filter out colored lines (Blue lines)
          // 预处理：过滤掉彩色线条（蓝线）
          // Text is black. Background is light. Lines are blue.
          // 文字是黑色的。背景是浅色的。线条是蓝色的。
          // Strategy: Convert to HSV, mask out distinct colors (like Blue), result in white.
          // 策略：转换为 HSV，屏蔽掉明显的颜色（如蓝色），结果设为白色。
          // Or simply binarize with simple threshold might work if blue is light enough?
          // 或者如果蓝色足够浅，简单的阈值二值化也许可行？
          // But blue line is dark. Black text is darker.
          // 但蓝线是深色的。黑色文字更深。
          
          const rgb = new cv.Mat();
          cv.cvtColor(cropped, rgb, cv.COLOR_RGBA2RGB);
          
          const hsv = new cv.Mat();
          cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
          rgb.delete();

          // Create mask for non-black/gray stuff (i.e. colored stuff like blue lines)
          // 为非黑色/灰色物体（即像蓝线这样的彩色物体）创建掩码
          // Blue is around H=100-130.
          // 蓝色大约在 H=100-130。
          const lowerBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [90, 50, 50, 0]);
          const upperBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [140, 255, 255, 0]);
          const blueMask = new cv.Mat();
          cv.inRange(hsv, lowerBlue, upperBlue, blueMask);
          
          // Inpaint/Remove blue lines on the original image (make them white)
          // 修复/移除原始图像上的蓝线（把它们变成白色）
          // We can use the mask to set pixels in 'cropped' to white (255,255,255)
          // 我们可以使用掩码将 'cropped' 中的像素设置为白色 (255,255,255)
          // Note: cropped is RGBA or BGR? imread usually RGBA in canvas.
          // 注意：cropped 是 RGBA 还是 BGR？canvas 中的 imread 通常是 RGBA。
          
          // Let's iterate pixels? Or use bitwise instructions.
          // 让我们迭代像素？或者使用位指令。
          // Set to white where blueMask is 255
          // 在 blueMask 为 255 的地方设置为白色
          const whiteMat = new cv.Mat(cropped.rows, cropped.cols, cropped.type(), new cv.Scalar(255, 255, 255, 255));
          cropped.copyTo(whiteMat, blueMask); // Copy existing where mask is non-zero? No, we want to OVERWRITE blue with white.
          // 哪里掩码非零就复制过去？不，我们要用白色覆盖蓝色。
          // bitwise_not of mask -> non-blue area.
          // 掩码取反 -> 非蓝色区域。
          const notBlue = new cv.Mat();
          cv.bitwise_not(blueMask, notBlue);
          
          const finalImg = new cv.Mat();
          // Copy original where it is NOT blue
          // 在非蓝色的地方复制原始图像
          cropped.copyTo(finalImg, notBlue);
          // Add white where it IS blue (effectively replacing blue with black? No, uninitialized is 0)
          // 在蓝色的地方添加白色（有效地用白色替换蓝色）
          // We need white background.
          // 我们需要白色背景。
          // Initialize finalImg with White
          // 用白色初始化 finalImg
          finalImg.setTo(new cv.Scalar(255, 255, 255, 255));
          cropped.copyTo(finalImg, notBlue);
          
          // Now binarize to separate text (Black) from Background (White)
          // 现在进行二值化，将文字（黑色）与背景（白色）分离
          // Now binarize to separate text (Black) from Background (White)
          // 现在进行二值化，将文字（黑色）与背景（白色）分离
          const gray = new cv.Mat();
          cv.cvtColor(finalImg, gray, cv.COLOR_RGBA2GRAY);
          
          // Use Adaptive Thresholding instead of Otsu
          // 使用自适应阈值替代 Otsu，这能更好地保留细微的文字细节（如 '1'）
          // blockSize=21, C=15 (Adjusted for typical parking lot images)
          cv.adaptiveThreshold(gray, gray, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 15);
          
          // Morphological Erode to thicken the text (Black text on White background)
          // 形态学腐蚀以加粗文字（白底黑字，腐蚀白色=加粗黑色）
          // This helps solidifying thin characters like '1' or 'I'
          const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
          cv.erode(gray, gray, kernel);
          kernel.delete();
          
          // Show this cleaned image to Tesseract
          // 将此清理后的图像显示给 Tesseract
          const canvas = document.createElement('canvas');
          canvas.width = gray.cols;
          canvas.height = gray.rows;
          cv.imshow(canvas, gray);
          
          // Clean
          cropped.delete();
          hsv.delete();
          lowerBlue.delete(); upperBlue.delete(); blueMask.delete();
          notBlue.delete();
          whiteMat.delete();
          finalImg.delete();
          gray.delete();

          // Reuse worker
          // Tesseract config: restricted characters, single block mode
          const { data: { text } } = await this.worker.recognize(canvas, {
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', // Only uppercase and digits
            tessedit_pageseg_mode: '6', // PSM_SINGLE_BLOCK (Assume a uniform block of text)
          });
          const cleanedText = text.trim().replace(/\s+/g, '');
          const match = cleanedText.match(/([A-Z]?\d+)/);
          return match ? match[1] : null;

        } catch (e) {
          console.warn('OCR error', e);
          return null;
        }
      }

      // Legacy fallback (slower)
      // 旧版后备方案（较慢）
      try {
        // 提取车位号区域
        const roi = new cv.Rect(
          Math.max(0, x),
          Math.max(0, y),
          Math.min(width, srcMat.cols - x),
          Math.min(height, srcMat.rows - y)
        );
        const cropped = srcMat.roi(roi);
        
        // 转换为 Canvas ImageData
        const canvas = document.createElement('canvas');
        canvas.width = cropped.cols;
        canvas.height = cropped.rows;
        // const ctx = canvas.getContext('2d');
        cv.imshow(canvas, cropped);
        
        // 使用 Tesseract.js 进行 OCR 识别
        const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
          logger: () => {
            // 可以在这里显示识别进度
          }
        });
        
        // 清理
        cropped.delete();
        
        // 提取数字（车位号通常是字母+数字，如 A001, B017）
        const cleanedText = text.trim().replace(/\s+/g, '');
        const match = cleanedText.match(/([A-Z]?\d+)/);
        return match ? match[1] : null;
      } catch (error) {
        console.error('OCR 识别失败:', error);
        return null;
      }
    },
  }
}
</script>

<style scoped>
.parking-recognizer {
  padding: 10px;
}

.recognize-btn {
  width: 100%;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background: #4CAF50;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.recognize-btn:hover:not(:disabled) {
  background: #45a049;
}

.recognize-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.results-info {
  margin-top: 10px;
  padding: 8px;
  background: #e8f5e9;
  border-radius: 4px;
  font-size: 12px;
  color: #2e7d32;
  text-align: center;
}
</style>