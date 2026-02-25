module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Enables React Native Reanimated 2
      'react-native-reanimated/plugin',
      
      // Optional: You can add other plugins if needed
      // For example, decorators:
      // ["@babel/plugin-proposal-decorators", { "legacy": true }]
    ],
  };
};
