// Some logic reused from facebook/create-react-app (MIT licensed)
// https://github.com/facebook/create-react-app/blob/428ddb683193e548043a4a7edac73d2857386a4c/packages/react-scripts/config/env.js

const { Logger } = require("./logger");
const path = require("path");
const fs = require("fs");

const logger = Logger("dotenv");

const appDirectory = fs.realpathSync(process.cwd());
const dotenvPath = path.resolve(appDirectory, ".env");

const NODE_ENV = process.env.NODE_ENV || "development";

const dotenvFiles = [
  `${dotenvPath}.${NODE_ENV}.local`,
  `${dotenvPath}.${NODE_ENV}`,
  NODE_ENV !== "test" && `${dotenvPath}.local`,
  dotenvPath,
].filter(Boolean);

(function () {
  logger.info(`Current environment: ${NODE_ENV}`);
  return dotenvFiles.forEach((dotenvFile) => {
    if (fs.existsSync(dotenvFile)) {
      const configOutput = require("dotenv").config({
        path: dotenvFile,
      });
      if (configOutput.error) {
        logger.error(
          `Failed to load env from ${dotenvFile}`,
          configOutput.error
        );
      }
      const keys = Object.keys(configOutput.parsed);
      logger.info(`Loaded env from ${dotenvFile} (${keys.join(", ")})`);
    }
  });
})();
