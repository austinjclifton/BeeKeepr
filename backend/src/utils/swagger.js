const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const yaml = require("yaml");

const swaggerDocument = yaml.parse(
  fs.readFileSync("./docs/apidoc.yaml", "utf8"),
);

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

module.exports = { setupSwagger };
