// class Heap {
//     constructor(compare) {
//         this.data = [];
//         this.compare = compare
//     }
//     parent(index) {
//         return (index - 1) >> 1
//     }
//     left(index) {
//         return index * 2 + 1
//     }
//     right(index) {
//         return index * 2 + 2
//     }
//     size() {
//         return this.data.length
//     }
//     swap(index1, index2) {
//         [this.data[index1], this.data[index2]] = [this.data[index2], this.data[index1]]
//     }
//     up(index) {
//         while (index > 0) {
//             let parent = this.parent(index)
//             if (this.compare(this.data[parent], this.data[index]) > 0) {
//                 this.swap(parent, index)
//                 index = parent
//             } else {
//                 break
//             }
//         }
//     }
//     down(index) {
//         let lastIndex = this.size() - 1
//         while (index < this.size() - 1) {
//             let left = this.left(index)
//             let right = this.right(index)
//             let ma = index
//             if (left <= lastIndex && this.compare(this.data[left], this.data[ma]) > 0) {
//                 ma = left
//             }
//             if (right <= lastIndex && this.compare(this.data[right], this.data[ma]) > 0) {
//                 ma = right
//             }
//             if (ma == index) {
//                 break
//             }
//             this.swap(ma, index)
//             index = ma
//         }
//     }
//     pop1() {
//         let size = this.size()
//         if (size === 0) return null
//         let last = this.data.pop()
//         let top = this.data[0]
//         if (this.size() > 0) {
//             this.data[0] = last
//             this.down(0)
//         }
//         return top
//     }
//     push1(val) {
//         this.data.push(val)
//         let index = this.size() - 1
//         this.up(index)
//     }
//     peek() {
//         return this.data[0]
//     }
// }

// /* 广度优先遍历 */
// // 使用邻接表来表示图，以便获取指定顶点的所有邻接顶点
// function graphBFS(graph, startVet) {
//     // 顶点遍历序列
//     const res = [];
//     // 哈希集合，用于记录已被访问过的顶点
//     const visited = new Set();
//     visited.add(startVet);
//     // 队列用于实现 BFS
//     const que = [startVet];
//     // 以顶点 vet 为起点，循环直至访问完所有顶点
//     while (que.length) {
//         const vet = que.shift(); // 队首顶点出队
//         res.push(vet); // 记录访问顶点
//         // 遍历该顶点的所有邻接顶点
//         for (const adjVet of graph.adjList.get(vet) ?? []) {
//             if (visited.has(adjVet)) {
//                 continue; // 跳过已被访问的顶点
//             }
//             que.push(adjVet); // 只入队未访问的顶点
//             visited.add(adjVet); // 标记该顶点已被访问
//         }
//     }
//     // 返回顶点遍历序列
//     return res;
// }

// /* 深度优先遍历 */
// // 使用邻接表来表示图，以便获取指定顶点的所有邻接顶点
// function dfs(graph, visited, res, vet) {
//     res.push(vet); // 记录访问顶点
//     visited.add(vet); // 标记该顶点已被访问
//     // 遍历该顶点的所有邻接顶点
//     for (const adjVet of graph.adjList.get(vet)) {
//         if (visited.has(adjVet)) {
//             continue; // 跳过已被访问的顶点
//         }
//         // 递归访问邻接顶点
//         dfs(graph, visited, res, adjVet);
//     }
// }

// /* 深度优先遍历 */
// // 使用邻接表来表示图，以便获取指定顶点的所有邻接顶点
// function graphDFS(graph, startVet) {
//     // 顶点遍历序列
//     const res = [];
//     // 哈希集合，用于记录已被访问过的顶点
//     const visited = new Set();
//     dfs(graph, visited, res, startVet);
//     return res;
// }

// var arr = [1, 2, 3]

// function backtree(path) {
//     if (path.length == arr.length) {
//         result.push([...path])
//         return
//     }
//     for (let i = 0; i < arr.length; i++) {
//         if (visited[i]) continue
//         path.push(arr[i])
//         visited[i] = true

//         backtree(path)

//         path.pop()
//         visited[i] = false
//     }
// }

// let result = []
// const visited = new Array(arr.length).fill(false)
// backtree([])

// console.log(result)


// /**
//  * @param {number[]} nums
//  * @return {number[][]}
//  */
// var permuteUnique = function(nums) {
//     // 回溯中，for循环中都是同一层，每次递归，就是下一层
// // 用于标记数是否被填入
//   const vis = new Array(nums.length).fill(false)
//   const backTree = (result) => {
//     if (result.length === nums.length) {
//       results.push([...result])
//     } else {
//       for (let i = 0; i < nums.length; i++) {
//         // 在上一层，vis[i - 1]设置为true，所以下一层可以继续使用1，但是在同一个for循环，也就是同一层，重复的1只有一个会被使用。
//         if (vis[i] || (i > 0 && nums[i] === nums[i - 1] && !vis[i - 1])) {
//           continue;
//         }
//         // 将数填入排列中同时标记这个数为已使用
//         vis[i] = true
//         result.push(nums[i])
//         backTree(result)
//         // 将数移除排列中同时标记这个数为未使用
//         vis[i] = false
//         result.pop()
//       }
//     }
//   }
//   let results = []
//   nums.sort((a, b) => a - b)
//   backTree([])
//   return results
// };
// var arr = [1, 1, 2]