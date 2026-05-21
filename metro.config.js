const fs = require('fs')
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { resolve: metroResolve } = require('metro-resolver')
const { resolvePulseWebRoot } = require('./scripts/resolvePulseWebRoot')

const pulseWebRoot = resolvePulseWebRoot(__dirname)

/** @param {string} subpath - path under pulse web repo root */
function resolvePulseWebFile(subpath) {
  const filePath = path.normalize(path.join(pulseWebRoot, subpath))
  if (!filePath.startsWith(path.normalize(pulseWebRoot + path.sep))) {
    throw new Error(`Refusing path outside pulse web root: ${subpath}`)
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing pulse web file: ${filePath}`)
  }
  return filePath
}

module.exports = (() => {
  const config = getDefaultConfig(__dirname)
  const { transformer, resolver } = config

  config.watchFolders = [...(config.watchFolders || []), pulseWebRoot]

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
  }

  const pulseNodeModules = path.resolve(pulseWebRoot, 'node_modules')
  const defaultResolveRequest = resolver.resolveRequest

  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      ...(fs.existsSync(pulseNodeModules) ? [pulseNodeModules] : []),
    ],
    resolveRequest(context, moduleName, platform) {
      if (moduleName.startsWith('@pulse-web/')) {
        const subpath = moduleName.slice('@pulse-web/'.length)
        return {
          type: 'sourceFile',
          filePath: resolvePulseWebFile(subpath),
        }
      }

      if (typeof defaultResolveRequest === 'function') {
        return defaultResolveRequest(context, moduleName, platform)
      }

      return metroResolve(context, moduleName, platform)
    },
  }

  return config
})()
