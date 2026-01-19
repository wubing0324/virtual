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
  }
})
