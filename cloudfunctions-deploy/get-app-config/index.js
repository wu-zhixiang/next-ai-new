"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const client_config_1 = require("./shared/client-config");
const utils_1 = require("./shared/utils");
async function main() {
    return (0, utils_1.ok)(await (0, client_config_1.getClientAppConfig)());
}
