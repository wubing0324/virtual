const { defineConfig } = require('@vue/cli-service')
const { codeInspectorPlugin } = require("code-inspector-plugin")
module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    resolve: {
      fallback: {
        "path": require.resolve("path-browserify")
      }
    },
    plugins: [
      codeInspectorPlugin({
        bundler: "webpack",
        hideConsole: true,
      })
    ],
  },
  // 接口反向代理
  devServer: {
    // 设置代理
    historyApiFallback: true,
    proxy: require('./vue.proxy.config'),
    client: {
      overlay: false
    },
    // 禁用压缩，确保 SSE 流式传输正常工作
    compress: false
  }
})
