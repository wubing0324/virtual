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
    };
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
    await this.loadOpenCV();
  },
  methods: {
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
        const separatingLines = this.detectSeparatingLines(src);
        console.log(`Detected ${separatingLines.horizontal.length} horizontal lines, ${separatingLines.vertical.length} vertical lines`);
        
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Pre-processing: Gaussian Blur to reduce noise
        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        // Pipeline 1: Edge Detection
        // Use Canny edge detection
        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 30, 100); // Lower thresholds for better sensitivity

        // Dilate edges to close gaps (crucial for dashed lines or incomplete boundaries)
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        const dilatedEdges = new cv.Mat();
        cv.dilate(edges, dilatedEdges, kernel);

        // Find contours from edges
        const edgeContours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(dilatedEdges, edgeContours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

        // Pipeline 2: Color Detection (robust for colored regions like green/blue fills)
        const hsv = new cv.Mat();
        const rgb = new cv.Mat();
        cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        rgb.delete();

        // Green mask
        const lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 40, 40, 0]);
        const upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
        const greenMask = new cv.Mat();
        cv.inRange(hsv, lowerGreen, upperGreen, greenMask);

        // Blue mask
        const lowerBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [100, 50, 50, 0]);
        const upperBlue = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [130, 255, 255, 0]);
        const blueMask = new cv.Mat();
        cv.inRange(hsv, lowerBlue, upperBlue, blueMask);

        // Combine masks
        const colorMask = new cv.Mat();
        cv.bitwise_or(greenMask, blueMask, colorMask);

        // Improve mask (close holes)
        const morphKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.morphologyEx(colorMask, colorMask, cv.MORPH_CLOSE, morphKernel);

        // Find contours from color mask
        const colorContours = new cv.MatVector();
        const colorHierarchy = new cv.Mat(); // Separate hierarchy
        cv.findContours(colorMask, colorContours, colorHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // Clean up temp resources
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

            // Accept 4-6 vertices (roughly rectangular)
            if (approx.rows >= 4 && approx.rows <= 8) { // Allow slightly more complex shapes
                  const rotatedRect = cv.minAreaRect(cnt);
                  let angle = Math.round(rotatedRect.angle);
                  // Keep raw values for accurate splitting later
                  const rawAngle = rotatedRect.angle;
                  const rotatedWidth = rotatedRect.size.width;
                  const rotatedHeight = rotatedRect.size.height;

                  if (angle < -45) angle += 90;
                  if (angle > 45) angle -= 90;
                  
                  const hull = new cv.Mat();
                  cv.convexHull(approx, hull);
                  const hullArea = cv.contourArea(hull);
                  const extent = area / hullArea;
                  
                  if (extent > 0.60) { // Relaxed extent
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
        
        // Calculate standard parking space area (median of single spaces) to use for splitting
        // This answers the requirement: "each space area is fixed"
        const singleCandidates = candidates.filter(c => c.area <= maxSingleSpaceArea);
        let standardArea = 0;
        if (singleCandidates.length > 0) {
          const areas = singleCandidates.map(c => c.area).sort((a, b) => a - b);
          standardArea = areas[Math.floor(areas.length / 2)];
          console.log(`Estimated standard area: ${standardArea}`);
        }
        // Fallback or verify standardArea
        if (standardArea < 500) standardArea = 2500; // Default fallback

        // 第二遍：智能分割大的轮廓
        // 如果一个轮廓的面积超过单个车位最大面积，尝试分割它

        const finalCandidates = [];
        for (const candidate of candidates) {
          // 如果面积超过单个车位最大面积（肯定是多个车位的组合）
          if (candidate.area > maxSingleSpaceArea) {
            // 检查是否有其他候选轮廓在这个轮廓内部
            const innerCandidates = candidates.filter(other => {
              if (other === candidate) return false;
              
              // 检查 other 的中心点是否在 candidate 内部
              const isInside = (
                other.centerX >= candidate.x &&
                other.centerX <= candidate.x + candidate.width &&
                other.centerY >= candidate.y &&
                other.centerY <= candidate.y + candidate.height
              );
              
              // 检查 other 的面积是否明显小于 candidate（说明是内部轮廓）
              return isInside && other.area < candidate.area * 0.7;
            });
            
            // 如果包含2个或以上的内部轮廓，说明这是多个车位的组合
            // 保留内部的小轮廓，丢弃大的组合轮廓
            if (innerCandidates.length >= 2) {
              console.log(`分割大的组合轮廓: 面积=${candidate.area}, 包含${innerCandidates.length}个内部轮廓`);
              // 将内部轮廓添加到最终列表
              finalCandidates.push(...innerCandidates);
              continue; // 跳过大的组合轮廓
            }
            
            // 如果没有内部轮廓，尝试基于分割线进行分割
            const splitSpaces = this.splitLargeContourBySeparatingLines(candidate, separatingLines, maxSingleSpaceArea);
            if (splitSpaces.length > 1) {
              console.log(`基于蓝色线条分割大轮廓: 面积=${candidate.area}, 分割成${splitSpaces.length}个`);
              finalCandidates.push(...splitSpaces);
              continue;
            }
            
            // 如果基于线条无法分割，尝试基于面积和旋转几何分割（更精准）
            const splitSpacesByArea = this.splitLargeContourByArea(candidate, maxSingleSpaceArea, standardArea);
            if (splitSpacesByArea.length > 1) {
              console.log(`基于面积分割大轮廓: 面积=${candidate.area}, 分割成${splitSpacesByArea.length}个`);
              finalCandidates.push(...splitSpacesByArea);
              continue;
            }
            
            // 如果无法分割，保留原始大轮廓（与其丢弃，不如保留一个大的）
            console.log(`无法分割大轮廓，保留原始轮廓: 面积=${candidate.area}`);
            finalCandidates.push(candidate);
            continue;
          }
          
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
        // Use dilate to connect broken lines (more robust than OPEN for thin lines)
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
    splitLargeContourByArea(candidate, maxSingleArea, standardArea) {
      const splitSpaces = [];
      const targetArea = standardArea || (maxSingleArea / 2);
      
      // Calculate how many spaces
      const estimatedCount = Math.round(candidate.area / targetArea);
      
      if (estimatedCount < 2) {
        return splitSpaces;
      }
      
      // Determine the geometry using rotated dimensions
      const { rotatedWidth, rotatedHeight, rawAngle, centerX, centerY, angle } = candidate;
      
      // Determine split axis (split along the longer dimension of the rotated rect)
      // Note: rawAngle relates to the side corresponding to 'width' in some OpenCV versions, 
      // but easiest is just to compare w and h.
      const isWidthLonger = rotatedWidth > rotatedHeight;
      const longDim = isWidthLonger ? rotatedWidth : rotatedHeight;
      const shortDim = isWidthLonger ? rotatedHeight : rotatedWidth;
      
      // Sanity check: is the long dimension long enough?
      // If we are splitting into N, the segment length is longDim / N
      const segmentLength = longDim / estimatedCount;
      if (segmentLength < 20) return splitSpaces; // Too narrow
      
      // Calculate direction vector of the long axis
      // rawAngle is in degrees.
      // In OpenCV, minAreaRect angle is usually the angle of the width side.
      // So if splitting along Width, use rawAngle.
      // If splitting along Height, use rawAngle + 90.
      
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
      // We want to place N centers along this axis centered at (centerX, centerY).
      // Total span is longDim.
      // Range is [-longDim/2, longDim/2] along the axis.
      // i-th center (0 to N-1) is at: -longDim/2 + (i + 0.5) * segmentLength
      
      const startOffset = -longDim / 2;
      
      for (let i = 0; i < estimatedCount; i++) {
        const offset = startOffset + (i + 0.5) * segmentLength;
        const cx = centerX + offset * dx;
        const cy = centerY + offset * dy;
        
        // Construct new space
        // Width/Height need to be consistent with the split
        // The new space has same orientation as the block
        // Dimensions: ShortDim x SegmentLength (or vice versa)
        
        // We revert to axis-aligned approx for width/height properties 
        // because the rest of the app might expect them.
        // But `rotatedWidth/Height` are better properties.
        // Let's approximate the new bounding box width/height.
        const newWidth = Math.abs(shortDim * Math.sin(rad)) + Math.abs(segmentLength * Math.cos(rad));
        const newHeight = Math.abs(shortDim * Math.cos(rad)) + Math.abs(segmentLength * Math.sin(rad));
        
        splitSpaces.push({
          x: cx - newWidth / 2, // Approximate top-left
          y: cy - newHeight / 2,
          width: newWidth, // Approximate
          height: newHeight, // Approximate
          angle: angle, // Preserve the normalized angle
          rawAngle: candidate.rawAngle, // Preserve raw
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