"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_ACCOUNT_PASSWORD_HINT = void 0;
exports.validateAiAccountPassword = validateAiAccountPassword;
exports.AI_ACCOUNT_PASSWORD_HINT = '12-64位，含大小写字母、数字和特殊符号';
function validateAiAccountPassword(password) {
    if (password.length < 12 || password.length > 64) {
        return '密码需为12-64位';
    }
    if (/\s/.test(password)) {
        return '密码不能包含空格';
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return '密码需包含大小写字母、数字和特殊符号';
    }
    return undefined;
}
