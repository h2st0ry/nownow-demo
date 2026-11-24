const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// node_modules가 다른 폴더를 가리키는 링크(junction)여도 번들이 그 실제 위치를 찾게 한다.
const nodeModules = path.join(__dirname, 'node_modules');
const realNodeModules = fs.realpathSync(nodeModules);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: realNodeModules !== nodeModules ? [realNodeModules] : [],
  resolver: {
    nodeModulesPaths: [nodeModules, realNodeModules],
    // Android 빌드 중 생겼다 사라지는 폴더를 감시하다 Metro가 죽지 않도록 제외한다.
    blockList: [
      /android[\/]app[\/]\.cxx[\/].*/,
      /android[\/]app[\/]build[\/].*/,
      /android[\/]build[\/].*/,
      /android[\/]\.gradle[\/].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
