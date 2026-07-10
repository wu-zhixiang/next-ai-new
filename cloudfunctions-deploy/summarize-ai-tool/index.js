"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const ai_tool_service_1 = require("./shared/ai-tool-service");
const context_1 = require("./_lib/context");
function ok(data) {
    return { code: constants_1.SUCCESS_CODE, message: 'ok', data };
}
function fail(message) {
    return { code: 400, message, data: null };
}
async function main(event = {}) {
    const { OPENID } = (0, context_1.getWxContext)();
    const input = {
        toolId: event.outputType === 'xiaohongshu' || event.outputType === 'moments' ? 'copywriting' : 'articleSummary',
        outputType: event.outputType,
        text: event.content,
        fileText: event.fileText,
        fileName: event.fileName,
        fileType: event.fileType,
        imageDataUrl: event.imageDataUrl,
        adUnlocked: event.adUnlocked,
        source: 'miniapp',
    };
    const result = await (0, ai_tool_service_1.executeAiTool)(input, OPENID);
    if (result.ok === false) {
        return fail(result.message);
    }
    return ok(result.data.textResult);
}
