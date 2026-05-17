"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWxContext = getWxContext;
const db_1 = require("../shared/db");
function getWxContext() {
    return db_1.app.getWXContext();
}
