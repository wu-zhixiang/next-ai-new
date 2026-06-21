"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const node_https_1 = __importDefault(require("node:https"));
const ai_account_1 = require("./shared/ai-account");
const constants_1 = require("./shared/constants");
const db_1 = require("./shared/db");
const orders_1 = require("./shared/orders");
const utils_1 = require("./shared/utils");
const appstore_product_scope_1 = require("./shared/appstore-product-scope");
const DEFAULT_NEWS_REMINDER_TEMPLATE_ID = 'm7Cb5rMgtJtFdyVn3YvR671tWZwyK87qe6qKr7KPZrQ';
const APPSTORE_EMAIL_DOMAIN = 'mraclpivot.com';
const DEFAULT_APPSTORE_MOBILE = '15810901111';
const DEFAULT_APPSTORE_COUNTRY_CODE = 'PH';
const DEFAULT_APPSTORE_COUNTRY_NAME = '菲律宾';
const DEFAULT_APPSTORE_DIALING_CODE = '+63';
const SUPER_OPERATOR_MOBILE = '15501130351';
const APPSTORE_PASSWORD_SPECIALS = '!@#$%^&*';
let cachedWechatAccessToken = '';
let cachedWechatAccessTokenExpireAt = 0;
const CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'content-type': 'application/json; charset=utf-8',
};
function jsonResponse(statusCode, payload) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(payload),
    };
}
function ok(data) {
    return jsonResponse(200, {
        code: 0,
        message: 'ok',
        data,
    });
}
function fail(statusCode, message) {
    return jsonResponse(statusCode, {
        code: statusCode,
        message,
        data: null,
    });
}
function getHeader(event, name) {
    var _a, _b;
    const headers = (_a = event.headers) !== null && _a !== void 0 ? _a : {};
    const target = name.toLowerCase();
    const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
    return (_b = matched === null || matched === void 0 ? void 0 : matched[1]) !== null && _b !== void 0 ? _b : '';
}
function getMethod(event) {
    var _a, _b;
    return ((_b = (_a = event.httpMethod) !== null && _a !== void 0 ? _a : event.method) !== null && _b !== void 0 ? _b : 'POST').toUpperCase();
}
function getPath(event) {
    var _a, _b;
    return (_b = (_a = event.rawPath) !== null && _a !== void 0 ? _a : event.path) !== null && _b !== void 0 ? _b : '';
}
function parseBody(event) {
    if (!event.body) {
        return {};
    }
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch (_a) {
        return {};
    }
}
function assertOperatorToken(event) {
    const expected = process.env.OPERATOR_API_TOKEN;
    if (!expected || expected.length < 16) {
        throw new Error('缺少运营接口密钥配置：OPERATOR_API_TOKEN');
    }
    const authorization = getHeader(event, 'authorization');
    const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (token !== expected) {
        const error = new Error('运营密钥不正确');
        error.statusCode = 401;
        throw error;
    }
}
function normalizeStatus(status) {
    if (status === 'processing' || status === 'fulfilled' || status === 'failed') {
        return status;
    }
    return 'opening';
}
function matchTaskRoute(event) {
    if (event.action === 'listTasks') {
        return { action: 'listTasks' };
    }
    if (event.action === 'updateTask' && event.orderNo) {
        return { action: 'updateTask', orderNo: event.orderNo };
    }
    if (event.action === 'getVerificationCode' && event.orderNo) {
        return { action: 'getVerificationCode', orderNo: event.orderNo };
    }
    if (event.action === 'getAppStoreVerificationCode') {
        return { action: 'getAppStoreVerificationCode' };
    }
    if (event.action === 'clearAppStoreVerificationCode') {
        return { action: 'clearAppStoreVerificationCode' };
    }
    if (event.action === 'listAppStoreCountries') {
        return { action: 'listAppStoreCountries' };
    }
    if (event.action === 'listProductTypes') {
        return { action: 'listProductTypes' };
    }
    if (event.action === 'getAvailableAppStoreAccount' && event.orderNo) {
        return { action: 'getAvailableAppStoreAccount', orderNo: event.orderNo };
    }
    if (event.action === 'generateAppStoreAccount') {
        return { action: 'generateAppStoreAccount' };
    }
    if (event.action === 'saveAppStoreAccount') {
        return { action: 'saveAppStoreAccount' };
    }
    if (event.action === 'createNews') {
        return { action: 'createNews' };
    }
    if (event.action === 'uploadNewsCover') {
        return { action: 'uploadNewsCover' };
    }
    const method = getMethod(event);
    const path = getPath(event).replace(/\/$/, '');
    if (method === 'GET' && /(?:^|\/)(?:operator\/)?tasks$/.test(path)) {
        return { action: 'listTasks' };
    }
    if (method === 'POST' && /(?:^|\/)(?:operator\/)?news$/.test(path)) {
        return { action: 'createNews' };
    }
    if (method === 'POST' && /(?:^|\/)(?:operator\/)?news\/cover$/.test(path)) {
        return { action: 'uploadNewsCover' };
    }
    if (method === 'POST' && /(?:^|\/)(?:operator\/)?appstore-accounts\/generate$/.test(path)) {
        return { action: 'generateAppStoreAccount' };
    }
    if (method === 'POST' && /(?:^|\/)(?:operator\/)?appstore-accounts$/.test(path)) {
        return { action: 'saveAppStoreAccount' };
    }
    if (method === 'GET' && /(?:^|\/)(?:operator\/)?appstore-countries$/.test(path)) {
        return { action: 'listAppStoreCountries' };
    }
    if (method === 'GET' && /(?:^|\/)(?:operator\/)?product-types$/.test(path)) {
        return { action: 'listProductTypes' };
    }
    if (method === 'GET' && /(?:^|\/)(?:operator\/)?appstore-accounts\/email-code$/.test(path)) {
        return { action: 'getAppStoreVerificationCode' };
    }
    if (method === 'POST' && /(?:^|\/)(?:operator\/)?appstore-accounts\/email-code\/clear$/.test(path)) {
        return { action: 'clearAppStoreVerificationCode' };
    }
    const codeMatched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)\/verification-code$/);
    if (method === 'GET' && (codeMatched === null || codeMatched === void 0 ? void 0 : codeMatched[1])) {
        return { action: 'getVerificationCode', orderNo: decodeURIComponent(codeMatched[1]) };
    }
    const appstoreMatched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)\/appstore-account$/);
    if (method === 'GET' && (appstoreMatched === null || appstoreMatched === void 0 ? void 0 : appstoreMatched[1])) {
        return { action: 'getAvailableAppStoreAccount', orderNo: decodeURIComponent(appstoreMatched[1]) };
    }
    const matched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)$/);
    if (method === 'POST' && (matched === null || matched === void 0 ? void 0 : matched[1])) {
        return { action: 'updateTask', orderNo: decodeURIComponent(matched[1]) };
    }
    return null;
}
function isOrderVisibleForStatus(order, status) {
    var _a;
    if (order.payStatus !== 'paid') {
        return false;
    }
    const fulfillmentStatus = (_a = order.fulfillmentStatus) !== null && _a !== void 0 ? _a : 'opening';
    if (status === 'processing') {
        return fulfillmentStatus === 'opening' && Boolean(order.operatorProcessingAt);
    }
    if (status === 'opening') {
        return fulfillmentStatus === 'opening';
    }
    return fulfillmentStatus === status;
}
function sanitizeNote(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, 200);
}
function sanitizeText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function normalizeAppStoreMobile(value) {
    const mobile = (0, utils_1.normalizeMobile)(sanitizeText(value, 20));
    if (!mobile) {
        return DEFAULT_APPSTORE_MOBILE;
    }
    if (!(0, utils_1.isValidMainlandMobile)(mobile)) {
        throw new Error('Apple Store 手机号格式不正确');
    }
    return mobile;
}
function getAppStoreMobileTail(value) {
    const mobile = normalizeAppStoreMobile(value);
    return mobile.slice(-4);
}
function isSuperOperatorMobile(value) {
    return (0, utils_1.normalizeMobile)(sanitizeText(value, 20)) === SUPER_OPERATOR_MOBILE;
}
function sanitizeNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}
function normalizeAppStoreEmail(value) {
    return sanitizeText(value, 80).toLowerCase();
}
function isValidAppStoreEmail(email) {
    return new RegExp(`^[a-z0-9._%+-]+@${APPSTORE_EMAIL_DOMAIN.replace('.', '\\.')}$`).test(email);
}
function isValidAppStorePassword(password) {
    return (password.length >= 8
        && /[0-9]/.test(password)
        && /[A-Z]/.test(password)
        && /[a-z]/.test(password)
        && /[!@#$%^&*]/.test(password));
}
function randomInt(max) {
    return Math.floor(Math.random() * max);
}
function randomFrom(characters) {
    var _a;
    return (_a = characters[randomInt(characters.length)]) !== null && _a !== void 0 ? _a : characters[0];
}
function shuffleText(value) {
    const chars = value.split('');
    for (let index = chars.length - 1; index > 0; index -= 1) {
        const target = randomInt(index + 1);
        [chars[index], chars[target]] = [chars[target], chars[index]];
    }
    return chars.join('');
}
function generateAppStorePassword() {
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const pool = `${lower}${upper}${digits}${APPSTORE_PASSWORD_SPECIALS}`;
    const required = [
        randomFrom(upper),
        randomFrom(lower),
        randomFrom(digits),
        randomFrom(APPSTORE_PASSWORD_SPECIALS),
    ];
    while (required.length < 12) {
        required.push(randomFrom(pool));
    }
    return shuffleText(required.join(''));
}
function serializeAppStoreAccount(account) {
    var _a, _b, _c, _d, _e, _f;
    return {
        id: account._id,
        email: account.email,
        mobile: account.mobile,
        password: account.password,
        countryCode: (_a = account.countryCode) !== null && _a !== void 0 ? _a : DEFAULT_APPSTORE_COUNTRY_CODE,
        countryName: (_b = account.countryName) !== null && _b !== void 0 ? _b : DEFAULT_APPSTORE_COUNTRY_NAME,
        productCode: (_c = account.productCode) !== null && _c !== void 0 ? _c : constants_1.DEFAULT_PRODUCT_CODE,
        productName: (_d = account.productName) !== null && _d !== void 0 ? _d : constants_1.DEFAULT_PRODUCT_NAME,
        status: account.status,
        chatgptAccountEmail: (_e = account.chatgptAccountEmail) !== null && _e !== void 0 ? _e : '',
        orderNo: (_f = account.orderNo) !== null && _f !== void 0 ? _f : '',
    };
}
function toAppStoreCountryView(record) {
    return {
        countryCode: record.countryCode,
        countryName: record.countryName,
        dialingCode: record.dialingCode,
        available: record.available,
    };
}
function toProductTypeView(record) {
    var _a;
    return {
        productCode: record.productCode,
        productName: record.productName,
        label: record.label,
        tag: record.tag,
        avatarUrl: record.avatarUrl,
        available: record.available,
        description: record.description,
        introHighlights: (_a = record.introHighlights) !== null && _a !== void 0 ? _a : [],
        complianceDisplay: record.complianceDisplay,
    };
}
async function listProductTypeRecords() {
    await (0, db_1.ensureCollection)('productTypes');
    const result = await (0, db_1.collection)('productTypes')
        .where({ status: 'on' })
        .orderBy('sort', 'asc')
        .get();
    return result.data;
}
async function listProductTypes() {
    const productTypes = [
        {
            productCode: appstore_product_scope_1.APPSTORE_ALL_PRODUCT_CODE,
            productName: appstore_product_scope_1.APPSTORE_ALL_PRODUCT_NAME,
            label: '全部商品（不区分）',
            tag: '',
            available: true,
            description: '该 Apple Store 账号可用于任意商品类型。',
            introHighlights: [],
        },
        ...(await listProductTypeRecords()).map(toProductTypeView),
    ];
    return ok({ productTypes });
}
async function resolveProductType(value) {
    const productCode = normalizeProductCode(value);
    if (productCode === appstore_product_scope_1.APPSTORE_ALL_PRODUCT_CODE) {
        return {
            productCode: appstore_product_scope_1.APPSTORE_ALL_PRODUCT_CODE,
            productName: appstore_product_scope_1.APPSTORE_ALL_PRODUCT_NAME,
            label: '全部商品（不区分）',
            tag: '',
            available: true,
            description: '该 Apple Store 账号可用于任意商品类型。',
            introHighlights: [],
        };
    }
    const productTypes = await listProductTypeRecords();
    const matched = productTypes.find((product) => product.productCode === productCode && product.available);
    if (!matched) {
        throw new Error('请选择支持的商品类型');
    }
    return toProductTypeView(matched);
}
async function listAppStoreCountryRecords() {
    await (0, db_1.ensureCollection)('appstoreCountries');
    const result = await (0, db_1.collection)('appstoreCountries')
        .where({ status: 'on' })
        .orderBy('sort', 'asc')
        .get();
    return result.data;
}
async function listAppStoreCountries() {
    const countries = (await listAppStoreCountryRecords()).map(toAppStoreCountryView);
    return ok({ countries });
}
async function resolveAppStoreCountry(value) {
    const countryCode = normalizeAppStoreCountryCode(value);
    const countries = await listAppStoreCountryRecords();
    const matched = countries.find((country) => country.countryCode === countryCode && country.available);
    if (!matched) {
        throw new Error('请选择支持的 Apple Store 国家');
    }
    return toAppStoreCountryView(matched);
}
function normalizeAppStoreCountryCode(value) {
    const code = sanitizeText(value, 10).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : DEFAULT_APPSTORE_COUNTRY_CODE;
}
function normalizeAppStoreCountryName(value, countryCode) {
    return sanitizeText(value, 40) || (countryCode === DEFAULT_APPSTORE_COUNTRY_CODE ? DEFAULT_APPSTORE_COUNTRY_NAME : countryCode);
}
function normalizeProductCode(value) {
    return sanitizeText(value, 64) || constants_1.DEFAULT_PRODUCT_CODE;
}
function normalizeProductName(value, productCode) {
    return sanitizeText(value, 80) || (productCode === constants_1.DEFAULT_PRODUCT_CODE ? constants_1.DEFAULT_PRODUCT_NAME : productCode);
}
function getOrderProductCode(order) {
    return normalizeProductCode(order.productCode);
}
function getOrderProductName(order) {
    return normalizeProductName(order.productName, getOrderProductCode(order));
}
function isAppStoreAccountForOrder(account, order) {
    const accountProductCode = normalizeProductCode(account.productCode);
    return (0, appstore_product_scope_1.appStoreAccountMatchesProduct)(accountProductCode, getOrderProductCode(order));
}
function assertAppStoreAccountForOrder(account, order) {
    if (!isAppStoreAccountForOrder(account, order)) {
        throw new Error(`Apple Store 账号商品类型与订单不匹配，请使用 ${getOrderProductName(order)} 的账号`);
    }
}
async function findAppStoreAccountByEmail(email) {
    var _a;
    await (0, db_1.ensureCollection)('appstoreAccounts');
    const result = await (0, db_1.collection)('appstoreAccounts').where({ email }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getAppStoreAccountById(accountId) {
    var _a;
    if (!accountId) {
        return null;
    }
    await (0, db_1.ensureCollection)('appstoreAccounts');
    try {
        const result = await (0, db_1.collection)('appstoreAccounts').doc(accountId).get();
        return (_a = result.data) !== null && _a !== void 0 ? _a : null;
    }
    catch (_b) {
        return null;
    }
}
async function getAppStoreAccountByOrderNo(orderNo) {
    var _a;
    await (0, db_1.ensureCollection)('appstoreAccounts');
    const result = await (0, db_1.collection)('appstoreAccounts').where({ orderNo }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getAppStoreAccountByChatgptEmail(chatgptAccountEmail) {
    var _a;
    if (!chatgptAccountEmail) {
        return null;
    }
    await (0, db_1.ensureCollection)('appstoreAccounts');
    const result = await (0, db_1.collection)('appstoreAccounts').where({ chatgptAccountEmail }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function resolveSubmittedAppStoreAccount(body, operatorMobile, order) {
    var _a, _b, _c, _d, _e, _f;
    const accountId = sanitizeText(body.appleStoreAccountId, 80);
    if (accountId) {
        const account = await getAppStoreAccountById(accountId);
        if (account) {
            assertAppStoreAccountForOrder(account, order);
        }
        return account;
    }
    const now = Date.now();
    const email = normalizeAppStoreEmail(body.appleStoreEmail);
    const password = sanitizeText(body.appleStorePassword, 80);
    if (!email && !password) {
        return null;
    }
    if (!isValidAppStoreEmail(email)) {
        throw new Error(`Apple Store 邮箱必须以 @${APPSTORE_EMAIL_DOMAIN} 结尾`);
    }
    if (!isValidAppStorePassword(password)) {
        throw new Error('Apple Store 密码需至少 8 位，并包含数字、大写、小写和特殊符号');
    }
    await (0, db_1.ensureCollection)('appstoreAccounts');
    const existing = await findAppStoreAccountByEmail(email);
    const productCode = getOrderProductCode(order);
    const productName = getOrderProductName(order);
    const country = await resolveAppStoreCountry(body.appleStoreCountryCode);
    if (existing) {
        assertAppStoreAccountForOrder(existing, order);
        await (0, db_1.collection)('appstoreAccounts').doc(existing._id).update({
            data: {
                mobile: normalizeAppStoreMobile(operatorMobile),
                password,
                productCode,
                productName,
                countryCode: (_a = existing.countryCode) !== null && _a !== void 0 ? _a : country.countryCode,
                countryName: (_b = existing.countryName) !== null && _b !== void 0 ? _b : country.countryName,
                updatedAt: now,
            },
        });
        return {
            ...existing,
            mobile: normalizeAppStoreMobile(operatorMobile),
            password,
            productCode,
            productName,
            countryCode: (_c = existing.countryCode) !== null && _c !== void 0 ? _c : country.countryCode,
            countryName: (_d = existing.countryName) !== null && _d !== void 0 ? _d : country.countryName,
            updatedAt: now,
        };
    }
    const record = {
        email,
        mobile: normalizeAppStoreMobile(operatorMobile),
        password,
        countryCode: country.countryCode,
        countryName: country.countryName,
        productCode,
        productName,
        status: 'available',
        createdAt: now,
        updatedAt: now,
    };
    const result = await (0, db_1.collection)('appstoreAccounts').add({ data: record });
    return {
        ...record,
        _id: (_f = (_e = result._id) !== null && _e !== void 0 ? _e : result.id) !== null && _f !== void 0 ? _f : '',
    };
}
async function resolveOrderAppStoreAccount(order, user) {
    var _a;
    const byOrderNo = await getAppStoreAccountByOrderNo(order.orderNo);
    if (byOrderNo) {
        return byOrderNo;
    }
    const email = (_a = user === null || user === void 0 ? void 0 : user.aiAccountEmail) !== null && _a !== void 0 ? _a : '';
    if (!email) {
        return null;
    }
    const byAccountEmail = await getAppStoreAccountByChatgptEmail(email);
    if (!byAccountEmail || !isAppStoreAccountForOrder(byAccountEmail, order)) {
        return null;
    }
    return byAccountEmail;
}
async function generateUniqueAppStoreEmail() {
    await (0, db_1.ensureCollection)('appstoreAccounts');
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const random = Math.random().toString(36).slice(2, 8);
        const suffix = Date.now().toString(36).slice(-5);
        const email = `as${suffix}${random}@${APPSTORE_EMAIL_DOMAIN}`;
        const existing = await findAppStoreAccountByEmail(email);
        if (!existing) {
            return email;
        }
    }
    throw new Error('随机账号生成失败，请重试');
}
function normalizeSourcePlatform(value) {
    if (value === 'x' || value === 'blog' || value === 'official' || value === 'manual') {
        return value;
    }
    return 'manual';
}
function normalizeTagKey(value) {
    return value.toLowerCase().replace(/[\s_-]+/g, '');
}
function resolveParentTags(tag) {
    const key = normalizeTagKey(tag);
    const parentTags = [];
    const aiGiantKeys = [
        'openai',
        'googleai',
        'google',
        'deepmind',
        'googledeepmind',
        'claudeai',
        'claude',
        'anthropic',
        'metaai',
        'microsoftai',
        'xai',
        'grok',
    ];
    if (aiGiantKeys.includes(key)) {
        parentTags.push('AI巨头');
    }
    const toolKeys = [
        'ai工具',
        '工具',
        '开发者工具',
        'agent',
        '图片生成',
        '视频生成',
        '办公提效',
        '编程助手',
        '提示词',
        'github',
        'huggingface',
    ];
    if (toolKeys.includes(key)) {
        parentTags.push('工具');
    }
    const tutorialKeys = [
        '教程',
        '使用教程',
        '实战教程',
        '入门指南',
        '案例拆解',
        '开发实践',
        '指南',
        '教学',
        'howto',
        'tutorial',
    ];
    if (tutorialKeys.includes(key)) {
        parentTags.push('教程');
    }
    return parentTags;
}
function normalizeTags(value) {
    const rawTags = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/[,，]+/)
            : [];
    const tags = rawTags
        .map((item) => sanitizeText(item, 20))
        .filter(Boolean);
    const expandedTags = tags.flatMap((tag) => [tag, ...resolveParentTags(tag)]);
    return Array.from(new Set(expandedTags)).slice(0, 12);
}
function normalizeMarkdown(value) {
    return typeof value === 'string' ? value.trim().slice(0, 20000) : '';
}
function stripMarkdown(markdown) {
    return markdown
        .replace(/!\[[^\]]*]\([^)]+\)/g, '')
        .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
        .replace(/[`*_>#-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function fallbackNewsMeta(markdown) {
    const lines = markdown
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const heading = lines.find((line) => /^#{1,3}\s+/.test(line));
    const plain = stripMarkdown(markdown);
    const title = sanitizeText((heading === null || heading === void 0 ? void 0 : heading.replace(/^#{1,3}\s+/, '')) || plain.slice(0, 36), 80) || 'AI 技术新动态';
    const summary = sanitizeText(plain.slice(0, 150), 260) || '这是一篇关于 AI 最新动态和实际应用价值的整理文章。';
    return { title, summary };
}
function parseJsonObject(text) {
    const matched = text.match(/\{[\s\S]*}/);
    if (!matched) {
        return null;
    }
    try {
        const parsed = JSON.parse(matched[0]);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    }
    catch (_a) {
        return null;
    }
}
function postJson(url, headers, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const request = node_https_1.default.request(url, {
            method: 'POST',
            headers: {
                ...headers,
                'content-length': Buffer.byteLength(payload),
            },
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                var _a;
                const text = Buffer.concat(chunks).toString('utf8');
                if (((_a = response.statusCode) !== null && _a !== void 0 ? _a : 500) >= 400) {
                    reject(new Error(`云开发 AI 调用失败：${response.statusCode} ${text.slice(0, 200)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(text));
                }
                catch (_b) {
                    reject(new Error('云开发 AI 返回非 JSON'));
                }
            });
        });
        request.on('error', reject);
        request.write(payload);
        request.end();
    });
}
function getJson(url) {
    return new Promise((resolve, reject) => {
        node_https_1.default.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                var _a;
                const text = Buffer.concat(chunks).toString('utf8');
                if (((_a = response.statusCode) !== null && _a !== void 0 ? _a : 500) >= 400) {
                    reject(new Error(`HTTP 请求失败：${response.statusCode} ${text.slice(0, 200)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(text));
                }
                catch (_b) {
                    reject(new Error('HTTP 返回非 JSON'));
                }
            });
        }).on('error', reject);
    });
}
function getWechatOpenApiConfig() {
    return {
        appid: process.env.WX_APPID || process.env.WX_PAY_APPID || '',
        secret: process.env.WX_APP_SECRET || '',
    };
}
async function getWechatAccessToken() {
    var _a, _b, _c;
    const now = Date.now();
    if (cachedWechatAccessToken && cachedWechatAccessTokenExpireAt - now > 5 * 60 * 1000) {
        return cachedWechatAccessToken;
    }
    const config = getWechatOpenApiConfig();
    if (!config.appid || !config.secret) {
        throw new Error('缺少微信 OpenAPI 配置：WX_APPID/WX_APP_SECRET');
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.appid)}&secret=${encodeURIComponent(config.secret)}`;
    const result = await getJson(url);
    if (!result.access_token) {
        throw new Error(`微信 access_token 获取失败：${(_a = result.errcode) !== null && _a !== void 0 ? _a : 'unknown'} ${(_b = result.errmsg) !== null && _b !== void 0 ? _b : ''}`.trim());
    }
    cachedWechatAccessToken = result.access_token;
    cachedWechatAccessTokenExpireAt = now + Math.max(60, (_c = result.expires_in) !== null && _c !== void 0 ? _c : 7200) * 1000;
    return cachedWechatAccessToken;
}
async function sendWechatSubscribeMessage(payload) {
    var _a;
    const accessToken = await getWechatAccessToken();
    const result = await postJson(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`, { 'content-type': 'application/json' }, payload);
    if (typeof result.errcode === 'number' && result.errcode !== 0) {
        if (result.errcode === 40001 || result.errcode === 42001) {
            cachedWechatAccessToken = '';
            cachedWechatAccessTokenExpireAt = 0;
        }
        throw new Error(`subscribeMessage.send ${result.errcode}: ${(_a = result.errmsg) !== null && _a !== void 0 ? _a : ''}`.trim());
    }
}
async function generateNewsMetaByTencentAi(markdown) {
    var _a, _b, _c, _d;
    const apiKey = process.env.TCB_AI_API_KEY;
    const baseUrl = process.env.TCB_AI_BASE_URL;
    if (process.env.TCB_AI_NEWS_META_ENABLED !== 'true' || !apiKey || !baseUrl) {
        return null;
    }
    try {
        const modelName = process.env.TCB_AI_MODEL || 'hy3-preview';
        const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const result = await postJson(endpoint, {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        }, {
            model: modelName,
            temperature: 0.35,
            messages: [
                {
                    role: 'system',
                    content: '你是 AI 科技资讯编辑。请只输出 JSON，不要输出 Markdown。',
                },
                {
                    role: 'user',
                    content: `请根据下面这篇文章生成适合小程序 AI 资讯卡片的标题和摘要。标题不超过 32 个汉字，摘要 80-120 个汉字，客观克制，不夸大，不使用“震惊”等营销词。\n\n文章：\n${markdown.slice(0, 8000)}\n\n输出格式：{"title":"...","summary":"..."}`,
                },
            ],
        });
        const text = (_d = (_c = (_b = (_a = result.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) !== null && _d !== void 0 ? _d : '';
        const parsed = parseJsonObject(text);
        const title = sanitizeText(parsed === null || parsed === void 0 ? void 0 : parsed.title, 80);
        const summary = sanitizeText(parsed === null || parsed === void 0 ? void 0 : parsed.summary, 260);
        return title && summary ? { title, summary } : null;
    }
    catch (error) {
        console.warn('ai.news.meta.generate.failed', error instanceof Error ? error.message : String(error));
        return null;
    }
}
function parseDataUrl(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const matched = value.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!matched) {
        return null;
    }
    const mimeType = matched[1];
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const bytes = Buffer.from(matched[2], 'base64');
    if (bytes.length > 3 * 1024 * 1024) {
        throw new Error('头图不能超过 3MB');
    }
    return { mimeType, extension, bytes };
}
function getImageExtension(mimeType) {
    return mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
}
async function uploadNewsCoverFile(file, now) {
    if (file.bytes.length > 3 * 1024 * 1024) {
        throw new Error('头图不能超过 3MB');
    }
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const result = await db_1.app.uploadFile({
        cloudPath: `ai-news/covers/${now}-${random}.${file.extension}`,
        fileContent: file.bytes,
    });
    return result.fileID;
}
async function uploadNewsCover(dataUrl, now) {
    const file = parseDataUrl(dataUrl);
    return file ? uploadNewsCoverFile(file, now) : '';
}
function parseImageEventBody(event) {
    const contentType = getHeader(event, 'content-type').split(';')[0].trim().toLowerCase();
    if (!/^image\/(?:png|jpe?g|webp)$/.test(contentType)) {
        throw new Error('头图仅支持 PNG/JPG/WebP');
    }
    if (!event.body) {
        throw new Error('缺少头图文件');
    }
    const bytes = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body, 'binary');
    if (bytes.length === 0) {
        throw new Error('缺少头图文件');
    }
    return {
        mimeType: contentType,
        extension: getImageExtension(contentType),
        bytes,
    };
}
async function uploadNewsCoverFromEvent(event) {
    const now = Date.now();
    const file = parseImageEventBody(event);
    const coverFileId = await uploadNewsCoverFile(file, now);
    return ok({ coverFileId });
}
function calcNewsScore(input) {
    const ageHours = Math.max(0, (Date.now() - input.publishedAt) / (60 * 60 * 1000));
    const freshness = Math.max(0.42, 1 - ageHours / 96);
    return Math.round((input.viewCount +
        input.likeCount * 20 +
        input.repostCount * 50 +
        input.commentCount * 30) * freshness);
}
function formatTemplateTime(timestamp) {
    const date = new Date(timestamp + 8 * 60 * 60 * 1000);
    return date.toISOString().replace('T', ' ').slice(0, 16);
}
function truncateTemplateText(value, maxLength) {
    const text = value.replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
async function sendNewsReminderToSubscribers(newsId, record) {
    const templateId = process.env.WX_NEWS_REMINDER_TEMPLATE_ID || DEFAULT_NEWS_REMINDER_TEMPLATE_ID;
    const wechatConfig = getWechatOpenApiConfig();
    if (!templateId || !wechatConfig.appid || !wechatConfig.secret) {
        const skippedReason = !templateId ? 'missingTemplateId' : 'missingWechatOpenApiConfig';
        console.warn(JSON.stringify({
            tag: 'aiNews.reminder.skipped',
            reason: skippedReason,
            newsId,
        }));
        return { sent: 0, failed: 0, eligible: 0, skippedReason };
    }
    const result = await (0, db_1.collection)('users')
        .where({
        newsSubscribeMsgAuth: true,
    })
        .limit(50)
        .get();
    const subscribedUsers = result.data;
    const users = subscribedUsers.filter((user) => { var _a; return Number((_a = user.newsSubscribeMsgQuota) !== null && _a !== void 0 ? _a : 0) > 0; });
    console.info(JSON.stringify({
        tag: 'aiNews.reminder.subscribers.loaded',
        newsId,
        subscribed: subscribedUsers.length,
        eligible: users.length,
    }));
    let sent = 0;
    let failed = 0;
    let lastError = '';
    for (const user of users) {
        if (!user.openid)
            continue;
        try {
            await sendWechatSubscribeMessage({
                touser: user.openid,
                template_id: templateId,
                page: `pages/news-detail/index?id=${encodeURIComponent(newsId)}&from=newsReminder`,
                data: {
                    thing1: { value: truncateTemplateText(record.title, 20) },
                    time2: { value: formatTemplateTime(record.publishedAt) },
                    thing3: { value: truncateTemplateText(record.summary || record.title, 20) },
                },
            });
            await (0, db_1.collection)('users').doc(user._id).update({
                data: {
                    newsSubscribeMsgQuota: db_1._.inc(-1),
                    updatedAt: Date.now(),
                },
            });
            sent += 1;
        }
        catch (error) {
            failed += 1;
            lastError = error instanceof Error ? error.message : String(error);
            console.error(JSON.stringify({
                tag: 'aiNews.reminder.send.failed',
                newsId,
                userId: user._id,
                message: lastError,
            }));
        }
    }
    return { sent, failed, eligible: users.length, lastError: lastError || undefined };
}
async function buildTask(order) {
    var _a, _b, _c, _d, _e;
    const user = await (0, db_1.getUserById)(order.userId);
    const appStoreAccount = await resolveOrderAppStoreAccount(order, user);
    let password = '';
    if (user === null || user === void 0 ? void 0 : user.aiAccountPasswordEncrypted) {
        try {
            password = (0, ai_account_1.decryptAiAccountPassword)(user.aiAccountPasswordEncrypted);
        }
        catch (error) {
            console.error(JSON.stringify({
                tag: 'operator.task.passwordDecryptFailed',
                orderNo: order.orderNo,
                userId: order.userId,
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
    return {
        orderNo: order.orderNo,
        productCode: getOrderProductCode(order),
        productName: order.productName,
        planCode: order.planCode,
        planName: order.planName,
        amount: order.amount,
        paidAt: order.paidAt,
        fulfillmentStatus: (_a = order.fulfillmentStatus) !== null && _a !== void 0 ? _a : 'opening',
        operatorProcessingAt: order.operatorProcessingAt,
        operatorNote: (_b = order.operatorNote) !== null && _b !== void 0 ? _b : '',
        userId: order.userId,
        mobile: (_c = user === null || user === void 0 ? void 0 : user.mobile) !== null && _c !== void 0 ? _c : '',
        nickname: (_d = user === null || user === void 0 ? void 0 : user.nickname) !== null && _d !== void 0 ? _d : '',
        email: (_e = user === null || user === void 0 ? void 0 : user.aiAccountEmail) !== null && _e !== void 0 ? _e : '',
        password,
        appleStoreAccount: appStoreAccount ? serializeAppStoreAccount(appStoreAccount) : null,
    };
}
async function listTasks(event) {
    var _a, _b, _c, _d;
    const status = normalizeStatus((_b = (_a = event.queryStringParameters) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : event.status);
    const operatorMobile = normalizeAppStoreMobile((_d = (_c = event.queryStringParameters) === null || _c === void 0 ? void 0 : _c.mobile) !== null && _d !== void 0 ? _d : DEFAULT_APPSTORE_MOBILE);
    const result = await (0, db_1.collection)('orders')
        .where({
        payStatus: 'paid',
    })
        .get();
    const orderRecords = result.data;
    const visibleOrders = [];
    for (const order of orderRecords) {
        if (!isOrderVisibleForStatus(order, status)) {
            continue;
        }
        if (isSuperOperatorMobile(operatorMobile)) {
            visibleOrders.push(order);
            continue;
        }
        const user = await (0, db_1.getUserById)(order.userId);
        const linkedAccount = await resolveOrderAppStoreAccount(order, user);
        if (!linkedAccount) {
            visibleOrders.push(order);
            continue;
        }
        if ((0, utils_1.normalizeMobile)(linkedAccount.mobile).endsWith(getAppStoreMobileTail(operatorMobile))) {
            visibleOrders.push(order);
        }
    }
    const orders = visibleOrders
        .sort((left, right) => { var _a, _b; return ((_a = right.paidAt) !== null && _a !== void 0 ? _a : right.createdAt) - ((_b = left.paidAt) !== null && _b !== void 0 ? _b : left.createdAt); })
        .slice(0, 50);
    const tasks = await Promise.all(orders.map(buildTask));
    return ok({ tasks });
}
async function updateTask(orderNo, body, event) {
    var _a, _b, _c, _d, _e, _f;
    const status = normalizeStatus(String((_b = (_a = body.status) !== null && _a !== void 0 ? _a : event.status) !== null && _b !== void 0 ? _b : ''));
    const note = sanitizeNote((_c = body.note) !== null && _c !== void 0 ? _c : event.note);
    const operatorMobile = normalizeAppStoreMobile((_f = (_d = body.mobile) !== null && _d !== void 0 ? _d : (_e = event.queryStringParameters) === null || _e === void 0 ? void 0 : _e.mobile) !== null && _f !== void 0 ? _f : DEFAULT_APPSTORE_MOBILE);
    const operatorTail = getAppStoreMobileTail(operatorMobile);
    const privileged = isSuperOperatorMobile(operatorMobile);
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        return fail(404, '订单不存在');
    }
    if (order.payStatus !== 'paid') {
        return fail(400, '订单未支付，不能处理开通');
    }
    const now = Date.now();
    if (status === 'fulfilled') {
        const user = await (0, db_1.getUserById)(order.userId);
        if (!(user === null || user === void 0 ? void 0 : user.aiAccountEmail)) {
            return fail(400, '该订单用户暂未填写 ChatGPT 注册邮箱');
        }
        let appStoreAccount;
        try {
            appStoreAccount = await resolveSubmittedAppStoreAccount(body, operatorMobile, order);
        }
        catch (error) {
            return fail(400, error instanceof Error ? error.message : 'Apple Store 账号信息不正确');
        }
        if (!appStoreAccount) {
            return fail(400, '请先获取或输入 Apple Store 账号和密码');
        }
        if (!privileged && !(0, utils_1.normalizeMobile)(appStoreAccount.mobile).endsWith(operatorTail)) {
            return fail(403, '只能使用本手机号注册的 Apple Store 账号');
        }
        if (appStoreAccount.status === 'disabled') {
            return fail(400, 'Apple Store 账号已停用');
        }
        if (appStoreAccount.status === 'bound' && appStoreAccount.orderNo !== order.orderNo && appStoreAccount.chatgptAccountEmail !== user.aiAccountEmail) {
            return fail(400, 'Apple Store 账号已绑定其他订单');
        }
        await (0, db_1.collection)('appstoreAccounts').doc(appStoreAccount._id).update({
            data: {
                status: 'bound',
                chatgptAccountEmail: user.aiAccountEmail,
                orderNo: order.orderNo,
                userId: order.userId,
                boundAt: now,
                updatedAt: now,
            },
        });
        await (0, orders_1.fulfillPaidOrderMembership)(order, { fulfilledAt: now });
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                appleStoreAccountId: appStoreAccount._id,
                appleStoreEmail: appStoreAccount.email,
                operatorNote: note,
                updatedAt: now,
            },
        });
        return ok({
            success: true,
            orderNo: order.orderNo,
            status: 'fulfilled',
            appleStoreAccount: serializeAppStoreAccount({
                ...appStoreAccount,
                status: 'bound',
                chatgptAccountEmail: user.aiAccountEmail,
                orderNo: order.orderNo,
                userId: order.userId,
                boundAt: now,
                updatedAt: now,
            }),
        });
    }
    if (status === 'failed') {
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                fulfillmentStatus: 'failed',
                operatorFailedAt: now,
                operatorNote: note,
                updatedAt: now,
            },
        });
        return ok({ success: true, orderNo: order.orderNo, status: 'failed' });
    }
    await (0, db_1.collection)('orders').doc(order._id).update({
        data: {
            fulfillmentStatus: 'opening',
            operatorProcessingAt: now,
            operatorNote: note,
            updatedAt: now,
        },
    });
    return ok({ success: true, orderNo: order.orderNo, status: 'processing' });
}
async function getVerificationCode(orderNo) {
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        return fail(404, '订单不存在');
    }
    const user = await (0, db_1.getUserById)(order.userId);
    if (!(user === null || user === void 0 ? void 0 : user.aiAccountEmail)) {
        return fail(404, '该订单用户暂未填写注册邮箱');
    }
    const codeRecord = await (0, db_1.getLatestUnusedEmailVerificationCode)(user.aiAccountEmail);
    if (!codeRecord) {
        return fail(404, '暂无可用验证码');
    }
    return ok({
        orderNo: order.orderNo,
        email: user.aiAccountEmail,
        code: codeRecord.code,
        provider: codeRecord.provider,
        subject: codeRecord.subject,
        receivedAt: codeRecord.receivedAt,
        expiresAt: codeRecord.expiresAt,
    });
}
async function getAppStoreVerificationCode(event) {
    var _a, _b, _c;
    const email = normalizeAppStoreEmail((_b = (_a = event.queryStringParameters) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : '');
    if (!email || !isValidAppStoreEmail(email)) {
        return fail(400, '缺少或错误的 Apple 邮箱');
    }
    await (0, db_1.ensureCollection)('appstoreEmailVerificationCodes');
    let result;
    try {
        result = await (0, db_1.collection)('appstoreEmailVerificationCodes').where({ email }).get();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Table not exist')) {
            return ok({ hasCode: false, email });
        }
        throw error;
    }
    const latestCode = (_c = result.data
        .filter((item) => !item.usedAt)
        .sort((left, right) => (right.receivedAt || right.createdAt || 0) - (left.receivedAt || left.createdAt || 0))[0]) !== null && _c !== void 0 ? _c : null;
    const expiredCodes = result.data.filter((item) => !item.usedAt && item.expiresAt <= Date.now());
    await Promise.all(expiredCodes.map((item) => (0, db_1.collection)('appstoreEmailVerificationCodes').doc(item._id).update({
        data: {
            usedAt: Date.now(),
        },
    })));
    if (!latestCode) {
        return ok({
            hasCode: false,
            email,
        });
    }
    if (latestCode.expiresAt <= Date.now()) {
        return ok({
            hasCode: false,
            email,
            expired: true,
        });
    }
    return ok({
        hasCode: true,
        codeId: latestCode._id,
        email: latestCode.email,
        code: latestCode.code,
        provider: latestCode.provider,
        receivedAt: latestCode.receivedAt,
        expiresAt: latestCode.expiresAt,
        expired: latestCode.expiresAt <= Date.now(),
    });
}
async function clearAppStoreVerificationCode(body) {
    var _a, _b;
    const codeId = sanitizeText(body.codeId, 80);
    const email = normalizeAppStoreEmail((_a = body.email) !== null && _a !== void 0 ? _a : '');
    if (!codeId) {
        return fail(400, '缺少验证码记录');
    }
    if (!email || !isValidAppStoreEmail(email)) {
        return fail(400, '缺少或错误的 Apple 邮箱');
    }
    const result = await (0, db_1.collection)('appstoreEmailVerificationCodes').doc(codeId).get();
    const codeRecord = result.data;
    if (!codeRecord || normalizeAppStoreEmail((_b = codeRecord.email) !== null && _b !== void 0 ? _b : '') !== email) {
        return fail(404, '验证码记录不存在');
    }
    await (0, db_1.collection)('appstoreEmailVerificationCodes').doc(codeId).update({
        data: {
            usedAt: Date.now(),
        },
    });
    return ok({ success: true });
}
async function generateAppStoreAccount(body) {
    const mobile = normalizeAppStoreMobile(body.mobile);
    const country = await resolveAppStoreCountry(body.countryCode);
    const product = await resolveProductType(body.productCode);
    const email = await generateUniqueAppStoreEmail();
    return ok({
        email,
        mobile,
        countryCode: country.countryCode,
        countryName: country.countryName,
        dialingCode: country.dialingCode,
        productCode: product.productCode,
        productName: product.productName,
        password: generateAppStorePassword(),
    });
}
async function saveAppStoreAccount(body) {
    var _a, _b;
    const now = Date.now();
    const email = normalizeAppStoreEmail(body.email);
    const mobile = normalizeAppStoreMobile(body.mobile);
    const password = sanitizeText(body.password, 80);
    let country;
    try {
        country = await resolveAppStoreCountry(body.countryCode);
    }
    catch (error) {
        return fail(400, error instanceof Error ? error.message : '请选择支持的 Apple Store 国家');
    }
    let product;
    try {
        product = await resolveProductType(body.productCode);
    }
    catch (error) {
        return fail(400, error instanceof Error ? error.message : '请选择支持的商品类型');
    }
    if (!isValidAppStoreEmail(email)) {
        return fail(400, `Apple Store 邮箱必须以 @${APPSTORE_EMAIL_DOMAIN} 结尾`);
    }
    if (!isValidAppStorePassword(password)) {
        return fail(400, '密码需至少 8 位，并包含数字、大写、小写和特殊符号');
    }
    const existing = await findAppStoreAccountByEmail(email);
    if (existing) {
        return fail(409, '该 Apple Store 邮箱已存在');
    }
    const record = {
        email,
        mobile,
        password,
        countryCode: country.countryCode,
        countryName: country.countryName,
        productCode: product.productCode,
        productName: product.productName,
        status: 'available',
        createdAt: now,
        updatedAt: now,
    };
    const result = await (0, db_1.collection)('appstoreAccounts').add({ data: record });
    const id = (_b = (_a = result._id) !== null && _a !== void 0 ? _a : result.id) !== null && _b !== void 0 ? _b : '';
    return ok({
        success: true,
        account: serializeAppStoreAccount({ ...record, _id: id }),
    });
}
async function getAvailableAppStoreAccount(orderNo, mobile) {
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        return fail(404, '订单不存在');
    }
    if (order.payStatus !== 'paid') {
        return fail(400, '订单未支付，不能获取 Apple Store 账号');
    }
    const operatorMobile = normalizeAppStoreMobile(mobile);
    const operatorTail = getAppStoreMobileTail(operatorMobile);
    const privileged = isSuperOperatorMobile(operatorMobile);
    const user = await (0, db_1.getUserById)(order.userId);
    const bound = await resolveOrderAppStoreAccount(order, user);
    if (bound) {
        if (!privileged && !(0, utils_1.normalizeMobile)(bound.mobile).endsWith(operatorTail)) {
            return fail(403, '该订单已关联其他 Apple Store 账号');
        }
        return ok({ account: serializeAppStoreAccount(bound), reused: true });
    }
    const targetTail = operatorTail;
    await (0, db_1.ensureCollection)('appstoreAccounts');
    const result = await (0, db_1.collection)('appstoreAccounts')
        .where({
        status: 'available',
    })
        .get();
    const account = result.data
        .filter((item) => !item.orderNo && !item.chatgptAccountEmail && (0, utils_1.normalizeMobile)(item.mobile).endsWith(targetTail) && isAppStoreAccountForOrder(item, order))
        .sort((left, right) => {
        var _a, _b;
        const orderProductCode = getOrderProductCode(order);
        const priorityDiff = (0, appstore_product_scope_1.getAppStoreProductMatchPriority)(normalizeProductCode(left.productCode), orderProductCode) - (0, appstore_product_scope_1.getAppStoreProductMatchPriority)(normalizeProductCode(right.productCode), orderProductCode);
        return priorityDiff || ((_a = left.createdAt) !== null && _a !== void 0 ? _a : 0) - ((_b = right.createdAt) !== null && _b !== void 0 ? _b : 0);
    })[0];
    if (!account) {
        return fail(404, `暂无尾号为 ${targetTail} 且匹配 ${getOrderProductName(order)} 的可用 Apple Store 账号，请先到注册页保存账号`);
    }
    return ok({ account: serializeAppStoreAccount(account), reused: false });
}
async function createNews(body) {
    var _a, _b;
    const now = Date.now();
    const sourceUrl = sanitizeText(body.sourceUrl, 500);
    const contentMarkdown = normalizeMarkdown(body.contentMarkdown);
    if (!contentMarkdown) {
        return fail(400, '缺少文章正文 Markdown');
    }
    if (sourceUrl && !/^https?:\/\//.test(sourceUrl)) {
        return fail(400, '原文链接必须是 http/https 地址');
    }
    const publishedAt = sanitizeNumber(body.publishedAt) || now;
    const coverFileId = sanitizeText(body.coverFileId, 500) || await uploadNewsCover(body.coverDataUrl, now);
    const aiMeta = await generateNewsMetaByTencentAi(contentMarkdown);
    const meta = aiMeta !== null && aiMeta !== void 0 ? aiMeta : fallbackNewsMeta(contentMarkdown);
    const record = {
        title: meta.title,
        summary: meta.summary,
        coverFileId,
        contentMarkdown,
        sourceName: sanitizeText(body.sourceName, 30) || 'X',
        sourceUrl,
        authorName: sanitizeText(body.authorName, 40),
        sourcePlatform: normalizeSourcePlatform(body.sourcePlatform),
        tags: normalizeTags(body.tags),
        viewCount: sanitizeNumber(body.viewCount),
        likeCount: sanitizeNumber(body.likeCount),
        repostCount: sanitizeNumber(body.repostCount),
        commentCount: sanitizeNumber(body.commentCount),
        score: 0,
        status: body.status === 'draft' ? 'draft' : 'published',
        publishedAt,
        createdAt: now,
        updatedAt: now,
    };
    record.score = calcNewsScore(record);
    let result;
    try {
        result = await (0, db_1.collection)('aiNews').add({ data: record });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('collection not exists') && !message.includes('DATABASE_COLLECTION_NOT_EXIST') && !message.includes('Table not exist')) {
            throw error;
        }
        await (0, db_1.ensureCollection)('aiNews');
        result = await (0, db_1.collection)('aiNews').add({ data: record });
    }
    const newsId = (_b = (_a = result._id) !== null && _a !== void 0 ? _a : result.id) !== null && _b !== void 0 ? _b : '';
    const reminderResult = record.status === 'published' && newsId
        ? await sendNewsReminderToSubscribers(newsId, record)
        : { sent: 0, failed: 0, eligible: 0 };
    return ok({
        success: true,
        id: newsId,
        score: record.score,
        reminderSent: reminderResult.sent,
        reminderFailed: reminderResult.failed,
        reminderEligible: reminderResult.eligible,
        reminderSkippedReason: reminderResult.skippedReason,
        reminderLastError: reminderResult.lastError,
    });
}
async function main(event) {
    var _a, _b;
    if (getMethod(event) === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: '',
        };
    }
    try {
        assertOperatorToken(event);
        const route = matchTaskRoute(event);
        if (!route) {
            return fail(404, '接口不存在');
        }
        if (route.action === 'listTasks') {
            return listTasks(event);
        }
        if (route.action === 'getVerificationCode') {
            return getVerificationCode(route.orderNo);
        }
        if (route.action === 'getAppStoreVerificationCode') {
            return getAppStoreVerificationCode(event);
        }
        if (route.action === 'clearAppStoreVerificationCode') {
            return clearAppStoreVerificationCode(parseBody(event));
        }
        if (route.action === 'listAppStoreCountries') {
            return listAppStoreCountries();
        }
        if (route.action === 'listProductTypes') {
            return listProductTypes();
        }
        if (route.action === 'getAvailableAppStoreAccount') {
            return getAvailableAppStoreAccount(route.orderNo, (_a = event.queryStringParameters) === null || _a === void 0 ? void 0 : _a.mobile);
        }
        if (route.action === 'generateAppStoreAccount') {
            return generateAppStoreAccount(parseBody(event));
        }
        if (route.action === 'saveAppStoreAccount') {
            return saveAppStoreAccount(parseBody(event));
        }
        if (route.action === 'createNews') {
            return createNews(parseBody(event));
        }
        if (route.action === 'uploadNewsCover') {
            return uploadNewsCoverFromEvent(event);
        }
        return updateTask(route.orderNo, parseBody(event), event);
    }
    catch (error) {
        const statusCode = (_b = error.statusCode) !== null && _b !== void 0 ? _b : 500;
        console.error(JSON.stringify({
            tag: 'operator.api.error',
            statusCode,
            message: error instanceof Error ? error.message : String(error),
        }));
        return fail(statusCode, error instanceof Error ? error.message : '运营接口异常');
    }
}
