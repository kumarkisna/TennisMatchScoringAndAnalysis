const path = require("node:path");
const workletsRoot = path.dirname(
  require.resolve("react-native-worklets/package.json", { paths: [__dirname] }),
);

module.exports = {
  dependencies: {
    "react-native-worklets": {
      root: workletsRoot,
    },
  },
};
