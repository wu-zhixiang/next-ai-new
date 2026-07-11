import { useEffect, useMemo, useState } from 'react';
import { Button, Image, Text, Textarea, View } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { PaymentLockOverlay } from '@/components/PaymentLockOverlay';
import { PopLayout } from '@/components/PopLayout';
import { callCloudFunction, CloudFunctionResponseError } from '@/services/api';
import type { MembershipView, PlanView } from '@/types';
import { TOOLS, getToolById, getToolByIdFromList, type OutputType, type ToolDefinition } from '@/pages/tools/definitions';
import { loadConfiguredTools } from '@/pages/tools/runtime';
import { useResetPageScroll } from '@/hooks/useResetPageScroll';
import { ensurePrivacyAuthorization } from '@/utils/privacyAuthorization';
import { createPayOrderPayload, MiniProgramPaymentError, requestMiniProgramPayment, type PayOrderResult } from '@/utils/payment';
import { setPromotedProductCode } from '@/utils/productNavigation';

const TOOL_ADD_FILE_ICON = require('../../assets/icons/tool-add-file.svg') as string;
const TOOL_PASTE_ICON = require('../../assets/icons/tool-paste.svg') as string;
const PHOTO_REPAIR_UPLOAD_ICON = 'cloud://cloud1-d3gbrpive8611514c.636c-cloud1-d3gbrpive8611514c-1348953433/cloud-admin/uploads/1783759515882-58219-upload_icon_content_only.webp';

interface MemberHomeResult {
    membership: MembershipView;
    userInfo?: {
        aiToolPointsBalance?: number;
    };
}

interface SummaryResult {
    title: string;
    summary: string;
    points: string[];
    outputText: string;
}

interface RunAiToolResult {
    runId: string;
    status: 'succeeded' | 'failed' | 'processing';
    toolId: string;
    title: string;
    summary?: string;
    points?: string[];
    outputText?: string;
    usage: {
        charged: boolean;
        freeUsed: boolean;
        rewardAdUsed: boolean;
        memberUsed: boolean;
        dailyFreeLimit: number;
        dailyFreeRemaining: number;
        chargeMode?: 'trial' | 'points' | 'single';
        pointCost?: number;
        aiToolPointsBalance?: number;
        singlePurchaseAmount?: number;
        model?: string;
    };
    createdAt: number;
}

interface QuotaExceededData {
    code: 'QUOTA_EXCEEDED';
    toolId: string;
    pointCost: number;
    aiToolPointsBalance: number;
    singlePurchaseAmount: number;
}

interface PlanListResult {
    plans: PlanView[];
}

interface CreateToolSingleOrderResult {
    orderNo: string;
    amount: number;
    toolId: string;
    toolName: string;
    pointCost: number;
}

interface PayResultSnapshot {
    payStatus: 'pending' | 'paid' | 'failed' | 'closed';
    fulfillmentStatus?: 'pending' | 'opening' | 'fulfilled' | 'failed';
}

interface ReferenceAsset {
    kind: 'file';
    name: string;
    fileText?: string;
    fileBase64?: string;
    imageDataUrl?: string;
    imagePreviewUrl?: string;
    fileType?: string;
    fileKind: 'text' | 'document' | 'image';
}

const OUTPUT_OPTIONS: Array<{ value: OutputType; label: string }> = [
    { value: 'summary', label: '摘要' },
    { value: 'bullets', label: '要点' },
    { value: 'xiaohongshu', label: '小红书' },
    { value: 'moments', label: '朋友圈' },
];

const COPYWRITING_OUTPUT_OPTIONS: Array<{ value: OutputType; label: string }> = [
    { value: 'xiaohongshu', label: '小红书' },
    { value: 'moments', label: '朋友圈' },
];

const PROMPT_PRESETS: Array<{ label: string; outputType: OutputType }> = [
    {
        label: '资讯速读',
        outputType: 'summary',
    },
    {
        label: '行动清单',
        outputType: 'bullets',
    },
    {
        label: '小红书',
        outputType: 'xiaohongshu',
    },
    {
        label: '朋友圈',
        outputType: 'moments',
    },
];

const DAILY_USAGE_KEY = 'ai_tool_daily_usage';
const MAX_REFERENCE_FILE_SIZE = 5 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_REFERENCE_FILE_TEXT_LENGTH = 6000;
const TEXT_FILE_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml', 'log'];
const DOCUMENT_FILE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'pptx', 'pdf'];
const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const SUPPORTED_FILE_EXTENSIONS = [...TEXT_FILE_EXTENSIONS, ...DOCUMENT_FILE_EXTENSIONS, ...IMAGE_FILE_EXTENSIONS];
const LEGACY_PROMPT_PREFIXES = [
    '请帮我总结这篇 AI 资讯，突出核心变化、影响范围和普通用户应该关注的点：',
    '请把下面内容整理成行动清单，按优先级输出，避免空泛建议：',
    '请把下面内容改写成克制可信的小红书风格文案，包含标题、正文和标签：',
    '请把下面内容改写成适合朋友圈发布的短文案，语气自然、有信息密度：',
];

function getTodayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isMember(status: MembershipView['status']): boolean {
    return status === 'active' || status === 'opening';
}

function stripLegacyPromptPrefixes(value: string): string {
    return LEGACY_PROMPT_PREFIXES.reduce(
        (next, prefix) => next.split(prefix).join(''),
        value,
    ).trim();
}

function getFileExtension(fileName: string): string {
    const normalized = fileName.split('?')[0].split('#')[0];
    const matched = normalized.match(/\.([a-z0-9]+)$/i);
    return matched ? matched[1].toLowerCase() : '';
}

function isTextFile(fileName: string): boolean {
    return TEXT_FILE_EXTENSIONS.includes(getFileExtension(fileName));
}

function isImageFile(fileName: string): boolean {
    return IMAGE_FILE_EXTENSIONS.includes(getFileExtension(fileName));
}

function isSupportedFile(fileName: string): boolean {
    return SUPPORTED_FILE_EXTENSIONS.includes(getFileExtension(fileName));
}

function getFileKind(fileName: string): 'text' | 'document' | 'image' {
    if (isTextFile(fileName)) {
        return 'text';
    }
    if (isImageFile(fileName)) {
        return 'image';
    }
    return 'document';
}

function getFileTypeLabel(fileName: string): string {
    const extension = getFileExtension(fileName);
    const labels: Record<string, string> = {
        csv: 'CSV',
        doc: 'Word',
        docx: 'Word',
        htm: 'HTML',
        html: 'HTML',
        json: 'JSON',
        log: '日志',
        markdown: 'Markdown',
        md: 'Markdown',
        pdf: 'PDF',
        pptx: 'PPT',
        txt: 'Text',
        xls: 'Excel',
        xlsx: 'Excel',
        jpg: 'JPG',
        jpeg: 'JPEG',
        xml: 'XML',
        png: 'PNG',
        webp: 'WebP',
    };
    return labels[extension] || extension.toUpperCase() || '文件';
}

function getImageMimeType(fileName: string): string {
    const extension = getFileExtension(fileName);
    if (extension === 'jpg' || extension === 'jpeg') {
        return 'image/jpeg';
    }
    if (extension === 'png') {
        return 'image/png';
    }
    return 'image/webp';
}

function buildResultMarkdown(result: SummaryResult): string {
    const points = result.points.length
        ? ['', '## 要点', ...result.points.map((point, index) => `${index + 1}. ${point}`)]
        : [];
    return [
        `# ${result.title}`,
        '',
        '## 摘要',
        result.summary,
        ...points,
        '',
        '## 正文',
        result.outputText,
    ].join('\n');
}

function toSummaryResult(runResult: RunAiToolResult): SummaryResult {
    return {
        title: runResult.title,
        summary: runResult.summary || '',
        points: runResult.points || [],
        outputText: runResult.outputText || '',
    };
}

function isImageTool(toolId: string): boolean {
    return toolId === 'imageGenerate' || toolId === 'imageRepair';
}

function getToolInputPlaceholder(toolId: string): string {
    if (toolId === 'imageGenerate') {
        return '描述你想生成的画面，例如主体、场景、风格、比例和用途';
    }
    if (toolId === 'imageRepair') {
        return '可补充修复要求，例如去除划痕、增强清晰度、自然上色';
    }
    return '粘贴文章、帖子、会议记录或一段长文本';
}

function isQuotaExceededData(value: unknown): value is QuotaExceededData {
    const data = value as Partial<QuotaExceededData> | null;
    return Boolean(
        data
        && data.code === 'QUOTA_EXCEEDED'
        && typeof data.toolId === 'string'
        && typeof data.pointCost === 'number'
        && typeof data.aiToolPointsBalance === 'number'
        && typeof data.singlePurchaseAmount === 'number',
    );
}

function getQuotaExceededData(error: unknown): QuotaExceededData | null {
    if (error instanceof CloudFunctionResponseError && isQuotaExceededData(error.data)) {
        return error.data;
    }
    const data = (error as { data?: unknown })?.data;
    return isQuotaExceededData(data) ? data : null;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getPlanAiPoints(plan: PlanView): number {
    return Math.max(0, Math.floor(plan.totalAiPoints ?? 0));
}

function getPlanDurationLabel(plan: PlanView): string {
    return plan.durationDays > 0 ? `${plan.durationDays} 天有效` : '立即到账';
}

function getGenerateButtonText(params: {
    enabled: boolean;
    submitting: boolean;
    imageTool: boolean;
}): string {
    if (!params.enabled) return '接入中';
    if (params.submitting) return '生成中';
    return params.imageTool ? '开始处理' : '生成结果';
}

export default function ToolDetailPage(): JSX.Element {
    useResetPageScroll();

    const [toolId, setToolId] = useState('');
    const [tools, setTools] = useState<ToolDefinition[]>(TOOLS);
    const [membershipStatus, setMembershipStatus] = useState<MembershipView['status']>('none');
    const [aiToolPointsBalance, setAiToolPointsBalance] = useState(0);
    const [content, setContent] = useState('');
    const [outputType, setOutputType] = useState<OutputType>('summary');
    const [result, setResult] = useState<SummaryResult | null>(null);
    const [referenceAsset, setReferenceAsset] = useState<ReferenceAsset | null>(null);
    const [inputMode, setInputMode] = useState<'idle' | 'paste'>('idle');
    const [submitting, setSubmitting] = useState(false);
    const [todayUsed, setTodayUsed] = useState(false);
    const [adUnlocked, setAdUnlocked] = useState(false);
    const [pointPlans, setPointPlans] = useState<PlanView[]>([]);
    const [plansLoading, setPlansLoading] = useState(false);
    const [quotaSheetVisible, setQuotaSheetVisible] = useState(false);
    const [quotaData, setQuotaData] = useState<QuotaExceededData | null>(null);
    const [paymentLocked, setPaymentLocked] = useState(false);

    const activeTool = useMemo(() => getToolByIdFromList(tools, toolId), [tools, toolId]);
    const imageTool = isImageTool(activeTool.id);
    const photoRepairTool = activeTool.id === 'imageRepair';
    const allowRequirementInput = !photoRepairTool;
    const textContent = stripLegacyPromptPrefixes(content);
    const visibleOutputOptions = activeTool.id === 'copywriting' ? COPYWRITING_OUTPUT_OPTIONS : OUTPUT_OPTIONS;
    const memberActive = isMember(membershipStatus);
    const hasGenerationInput = photoRepairTool
        ? Boolean(referenceAsset)
        : textContent.length > 0 || Boolean(referenceAsset);
    const generateDisabled = submitting || !hasGenerationInput;
    const generateButtonMuted = generateDisabled || !activeTool.enabled;
    const toolPointCost = quotaData?.pointCost ?? activeTool.pointCost ?? 0;
    const singlePurchaseAmount = quotaData?.singlePurchaseAmount ?? Number((toolPointCost / 10).toFixed(2));
    const displayedAiToolPointsBalance = quotaData?.aiToolPointsBalance ?? aiToolPointsBalance;
    const showInitialSourceActions = inputMode === 'idle' && !referenceAsset && (photoRepairTool || !textContent);
    const showRequirementInput = allowRequirementInput && (inputMode === 'paste' || Boolean(textContent));
    const showActionRow = photoRepairTool
        ? Boolean(referenceAsset)
        : inputMode !== 'idle' || Boolean(referenceAsset) || Boolean(textContent);
    const availablePointPlans = useMemo(
        () => pointPlans.filter((plan) => getPlanAiPoints(plan) > 0),
        [pointPlans],
    );

    useLoad((options) => {
        enableShareMenu();
        const nextTool = getToolById(typeof options.tool === 'string' ? options.tool : '');
        setToolId(nextTool.id);
        setOutputType(nextTool.outputType);
        void loadMemberStatus();
        loadDailyUsage();
        if (typeof options.runId === 'string' && options.runId) {
            void loadRunResult(options.runId);
        }
    });

    useShareAppMessage(() => ({
        title: result?.title || `${activeTool.name} - AIO AI工具`,
        path: `/pages/tool-detail/index?tool=${encodeURIComponent(activeTool.id)}`,
    }));

    useShareTimeline(() => ({
        title: result?.title || `${activeTool.name} - AIO AI工具`,
        query: `tool=${encodeURIComponent(activeTool.id)}`,
    }));

    useEffect(() => {
        void loadConfiguredTools('tool-detail').then(setTools);
    }, []);

    function enableShareMenu(): void {
        try {
            Taro.showShareMenu({
                withShareTicket: true,
                menus: ['shareAppMessage', 'shareTimeline'],
            } as unknown as Parameters<typeof Taro.showShareMenu>[0]);
        } catch {
            // 部分基础库不支持 shareTimeline 菜单参数，忽略即可。
        }
    }

    async function loadMemberStatus(): Promise<void> {
        try {
            const memberResult = await callCloudFunction<MemberHomeResult>('get-member-home');
            setMembershipStatus(memberResult.membership.status);
            setAiToolPointsBalance(Math.max(0, Math.floor(memberResult.userInfo?.aiToolPointsBalance ?? 0)));
        } catch {
            setMembershipStatus('none');
            setAiToolPointsBalance(0);
        }
    }

    async function loadPointPlans(): Promise<void> {
        setPlansLoading(true);
        try {
            const result = await callCloudFunction<PlanListResult>('list-member-plans');
            setPointPlans(result.plans.filter((plan) => getPlanAiPoints(plan) > 0));
        } catch {
            setPointPlans([]);
        } finally {
            setPlansLoading(false);
        }
    }

    function loadDailyUsage(): void {
        const record = Taro.getStorageSync(DAILY_USAGE_KEY) as { date?: string; used?: boolean };
        setTodayUsed(Boolean(record?.date === getTodayKey() && record.used));
    }

    async function loadRunResult(runId: string): Promise<void> {
        setSubmitting(true);
        try {
            const runResult = await callCloudFunction<RunAiToolResult>('get-ai-tool-run', { runId });
            setToolId(getToolById(runResult.toolId).id);
            setResult(toSummaryResult(runResult));
        } catch (error) {
            void Taro.showToast({
                title: error instanceof Error ? error.message : '结果读取失败',
                icon: 'none',
            });
        } finally {
            setSubmitting(false);
        }
    }

    function markDailyUsed(): void {
        Taro.setStorageSync(DAILY_USAGE_KEY, { date: getTodayKey(), used: true });
        setTodayUsed(true);
        setAdUnlocked(false);
    }

    async function unlockByAd(): Promise<boolean> {
        if (!AI_TOOL_REWARD_AD_UNIT_ID) {
            await Taro.showModal({
                title: '广告位待配置',
                content: '当前还没有配置激励视频广告位，暂时无法通过看广告解锁。',
                showCancel: false,
                confirmText: '知道了',
            });
            return false;
        }

        return new Promise((resolve) => {
            const videoAd = (Taro as typeof Taro & {
                createRewardedVideoAd: (options: { adUnitId: string }) => {
                    load: () => Promise<void>;
                    show: () => Promise<void>;
                    onClose: (callback: (response?: { isEnded?: boolean }) => void) => void;
                    onError: (callback: () => void) => void;
                };
            }).createRewardedVideoAd({ adUnitId: AI_TOOL_REWARD_AD_UNIT_ID });
            videoAd.onClose((response) => {
                const unlocked = Boolean(response?.isEnded);
                setAdUnlocked(unlocked);
                if (!unlocked) {
                    void Taro.showToast({ title: '完整观看后可解锁一次', icon: 'none' });
                }
                resolve(unlocked);
            });
            videoAd.onError(() => {
                void Taro.showToast({ title: '广告加载失败', icon: 'none' });
                resolve(false);
            });
            void videoAd.load().then(() => videoAd.show()).catch(() => {
                void Taro.showToast({ title: '广告暂不可用', icon: 'none' });
                resolve(false);
            });
        });
    }

    async function ensureUsagePermission(): Promise<boolean> {
        if (memberActive) {
            return true;
        }
        if (!todayUsed || adUnlocked) {
            return true;
        }
        const response = await Taro.showModal({
            title: '今日免费次数已用完',
            content: '每天可免费使用 1 次。继续使用需要观看一次激励视频。',
            confirmText: '看广告解锁',
            cancelText: '稍后再说',
        });
        if (!response.confirm) {
            return false;
        }
        return unlockByAd();
    }

    function applyPreset(preset: typeof PROMPT_PRESETS[number]): void {
        setOutputType(preset.outputType);
        setResult(null);
    }

    function changeOutputType(nextOutputType: OutputType): void {
        setOutputType(nextOutputType);
        setResult(null);
    }

    function showPasteInput(): void {
        setInputMode('paste');
        setResult(null);
    }

    async function chooseReferenceFile(): Promise<void> {
        if (submitting) return;
        try {
            const privacyAuthorized = await ensurePrivacyAuthorization();
            if (!privacyAuthorized) return;

            const chooseMessageFile = (Taro as typeof Taro & {
                chooseMessageFile?: (options: { count: number; type: 'file' }) => Promise<{
                    tempFiles: Array<{ name?: string; path?: string; size?: number }>;
                }>;
            }).chooseMessageFile;
            if (!chooseMessageFile) {
                void Taro.showToast({ title: '当前基础库不支持选择文件', icon: 'none' });
                return;
            }
            const chooseResult = await chooseMessageFile({ count: 1, type: 'file' });
            const file = chooseResult.tempFiles[0];
            const filePath = file?.path;
            const fileName = file?.name || '参考文件';
            if (!filePath) return;
            if (!isSupportedFile(fileName)) {
                void Taro.showToast({ title: '暂支持 txt/md/doc/docx/xls/xlsx/pptx/pdf/jpg/png 等常用文件', icon: 'none' });
                return;
            }
            if (photoRepairTool && !isImageFile(fileName)) {
                void Taro.showToast({ title: '请上传 jpg、png、webp 图片', icon: 'none' });
                return;
            }
            const fileSize = typeof file.size === 'number'
                ? file.size
                : (await Taro.getFileInfo({ filePath }) as unknown as { size: number }).size;
            if (isImageFile(fileName)) {
                if (fileSize > MAX_REFERENCE_IMAGE_SIZE) {
                    void Taro.showToast({ title: photoRepairTool ? '照片请控制在 10MB 内' : '图片请控制在 10MB 内', icon: 'none' });
                    return;
                }
            } else {
                if (fileSize > MAX_REFERENCE_FILE_SIZE) {
                    void Taro.showToast({ title: '文件过大，请控制在 5MB 内', icon: 'none' });
                    return;
                }
            }
            const fileManager = Taro.getFileSystemManager();
            const fileTypeLabel = getFileTypeLabel(fileName);
            if (isTextFile(fileName)) {
                const fileText = String(fileManager.readFileSync(filePath, 'utf8') || '')
                    .trim()
                    .slice(0, MAX_REFERENCE_FILE_TEXT_LENGTH);
                if (fileText.length < 10) {
                    void Taro.showToast({ title: '文件内容为空或不可读取', icon: 'none' });
                    return;
                }
                setReferenceAsset({
                    kind: 'file',
                    name: fileName,
                    fileText,
                    fileType: fileTypeLabel,
                    fileKind: getFileKind(fileName),
                });
            } else {
                const fileBase64 = String(fileManager.readFileSync(filePath, 'base64') || '').trim();
                if (fileBase64.length < 10) {
                    void Taro.showToast({ title: '文件内容为空或不可读取', icon: 'none' });
                    return;
                }
                if (isImageFile(fileName)) {
                    const imageDataUrl = `data:${getImageMimeType(fileName)};base64,${fileBase64}`;
                    setReferenceAsset({
                        kind: 'file',
                        name: fileName,
                        fileBase64,
                        imageDataUrl,
                        imagePreviewUrl: filePath,
                        fileType: fileTypeLabel,
                        fileKind: getFileKind(fileName),
                    });
                } else {
                    setReferenceAsset({
                        kind: 'file',
                        name: fileName,
                        fileBase64,
                        fileType: fileTypeLabel,
                        fileKind: getFileKind(fileName),
                    });
                }
            }
            setInputMode('idle');
            setResult(null);
        } catch (error) {
            if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) return;
            void Taro.showToast({ title: '文件读取失败', icon: 'none' });
        }
    }

    function removeReferenceAsset(): void {
        setReferenceAsset(null);
        if (photoRepairTool || !stripLegacyPromptPrefixes(content)) {
            setInputMode('idle');
        }
        setResult(null);
    }

    function buildRunPayload(text: string): Record<string, unknown> {
        return {
            toolId: activeTool.id,
            text,
            outputType,
            fileText: referenceAsset?.fileText || '',
            fileBase64: referenceAsset?.fileBase64 || '',
            imageDataUrl: referenceAsset?.imageDataUrl || '',
            fileName: referenceAsset?.name || '',
            fileType: referenceAsset?.fileType || '',
            source: 'miniapp',
        };
    }

    function handleRunSuccess(runResult: RunAiToolResult): void {
        setResult(toSummaryResult(runResult));
        if (typeof runResult.usage.aiToolPointsBalance === 'number') {
            setAiToolPointsBalance(Math.max(0, Math.floor(runResult.usage.aiToolPointsBalance)));
        }
        if (runResult.usage.freeUsed) {
            markDailyUsed();
        } else if (runResult.usage.rewardAdUsed) {
            setAdUnlocked(false);
        }
    }

    async function runCurrentGeneration(): Promise<void> {
        const text = photoRepairTool ? '' : stripLegacyPromptPrefixes(content);
        const runResult = await callCloudFunction<RunAiToolResult>('run-ai-tool', buildRunPayload(text));
        handleRunSuccess(runResult);
    }

    function openQuotaSheet(data: QuotaExceededData): void {
        setQuotaData(data);
        setAiToolPointsBalance(Math.max(0, Math.floor(data.aiToolPointsBalance)));
        setQuotaSheetVisible(true);
        if (pointPlans.length === 0 && !plansLoading) {
            void loadPointPlans();
        }
    }

    function closeQuotaSheet(): void {
        if (paymentLocked) return;
        setQuotaSheetVisible(false);
    }

    function handleGenerationError(error: unknown): boolean {
        const quota = getQuotaExceededData(error);
        if (quota) {
            openQuotaSheet(quota);
            return true;
        }
        return false;
    }

    function showErrorToast(error: unknown, fallback: string): void {
        void Taro.showToast({
            title: error instanceof Error ? error.message : fallback,
            icon: 'none',
        });
    }

    async function handleGenerate(): Promise<void> {
        if (!activeTool.enabled) {
            await Taro.showModal({
                title: activeTool.name,
                content: `${activeTool.desc}工作流正在接入中，暂时还不能生成结果。`,
                showCancel: false,
                confirmText: '知道了',
            });
            return;
        }
        const text = photoRepairTool ? '' : stripLegacyPromptPrefixes(content);
        if (!referenceAsset && text.length === 0) {
            void Taro.showToast({ title: photoRepairTool ? '请先上传照片' : '请输入内容或添加素材', icon: 'none' });
            return;
        }
        if (submitting) return;

        setSubmitting(true);
        try {
            await runCurrentGeneration();
        } catch (error) {
            if (!handleGenerationError(error)) {
                showErrorToast(error, '生成失败');
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function waitForSingleOrderPaid(orderNo: string): Promise<void> {
        for (let index = 0; index < 6; index += 1) {
            await delay(index === 0 ? 700 : 1000);
            const snapshot = await callCloudFunction<PayResultSnapshot>('get-pay-result', { orderNo });
            if (snapshot.payStatus === 'paid') {
                return;
            }
            if (snapshot.payStatus === 'closed' || snapshot.payStatus === 'failed') {
                throw new Error('订单未完成支付，请重新购买');
            }
        }
        throw new Error('支付结果同步中，请稍后再次点击生成');
    }

    async function handleSinglePurchase(): Promise<void> {
        const currentQuota = quotaData;
        if (!currentQuota || submitting || paymentLocked) return;
        setSubmitting(true);
        setPaymentLocked(true);
        try {
            const order = await callCloudFunction<CreateToolSingleOrderResult>('create-tool-single-order', {
                toolId: currentQuota.toolId,
            });
            const payment = await callCloudFunction<PayOrderResult>('pay-order', await createPayOrderPayload(order.orderNo));
            if (!payment.paid && (payment.payment || payment.virtualPayment)) {
                await requestMiniProgramPayment(payment);
            }
            await waitForSingleOrderPaid(order.orderNo);
            setQuotaSheetVisible(false);
            setQuotaData(null);
            await runCurrentGeneration();
        } catch (error) {
            if (error instanceof MiniProgramPaymentError) {
                void Taro.showToast({ title: error.message, icon: 'none' });
                return;
            }
            if (!handleGenerationError(error)) {
                showErrorToast(error, '支付失败，请稍后再试');
            }
        } finally {
            setPaymentLocked(false);
            setSubmitting(false);
        }
    }

    function openPointPlan(plan: PlanView): void {
        setPromotedProductCode(plan.productCode);
        setQuotaSheetVisible(false);
        Taro.switchTab({ url: '/pages/member/index' });
    }

    async function copyResult(): Promise<void> {
        if (!result?.outputText) return;
        if (!await ensurePrivacyAuthorization()) return;
        await Taro.setClipboardData({ data: buildResultMarkdown(result) });
    }

    async function prepareShareToFriend(): Promise<void> {
        if (!result) return;
        if (!await ensurePrivacyAuthorization()) return;
        await Taro.setClipboardData({ data: buildResultMarkdown(result) });
        void Taro.showToast({ title: '结果已复制，可粘贴给好友', icon: 'none' });
    }

    async function shareToTimeline(): Promise<void> {
        if (result) {
            if (!await ensurePrivacyAuthorization()) return;
            await Taro.setClipboardData({ data: buildResultMarkdown(result) });
        }
        enableShareMenu();
        await Taro.showModal({
            title: '朋友圈文案已复制',
            content: '微信小程序不能直接打开朋友圈编辑器并回填正文。你可以从右上角菜单分享到朋友圈，正文已复制，可手动粘贴。',
            showCancel: false,
            confirmText: '知道了',
        });
    }

    function clearContent(): void {
        setContent('');
        setReferenceAsset(null);
        setInputMode('idle');
        setResult(null);
    }

    return (
        <View className='page'>
            <AppTransparentHeader title={activeTool.name} />
            <View className='tools-page'>
                <View className='saas-shell tools-shell'>
                        <View className='tool-detail-hero'>
                        <View className='tool-detail-hero__head'>
                            <View className='tool-card__icon tool-detail-hero__icon'>
                                {activeTool.iconImageFileId
                                    ? <Image className='tool-card__icon-image' src={activeTool.iconImageFileId} mode='aspectFit' />
                                    : <Text>{activeTool.icon}</Text>}
                            </View>
                            <View className='tool-detail-hero__copy'>
                                <Text className='tool-detail-hero__title'>{activeTool.name}</Text>
                                <Text className='tool-detail-hero__desc'>{activeTool.desc}</Text>
                            </View>
                        </View>

                        <Text className='tool-workbench__quota'>
                            {!activeTool.enabled
                                ? '接入中'
                                : `${activeTool.pointCost ?? 0} 积分/次${(activeTool.trialLimit ?? 0) > 0 ? ` · 体验 ${activeTool.trialLimit} 次` : ''}`}
                        </Text>
                    </View>

                    <View className='tool-workbench tool-workbench--detail'>
                        <Text className='tool-ai-notice'>
                            {activeTool.enabled ? 'AI生成内容，仅供参考。' : `${activeTool.name}工作流接入中，当前页面用于预览流程。`}
                        </Text>

                        {/* <View className='tool-preset-row'>
              {PROMPT_PRESETS.map((preset) => (
                <Text className='tool-preset-chip' key={preset.label} onClick={() => applyPreset(preset)}>
                  {preset.label}
                </Text>
              ))}
            </View> */}

                        {!imageTool ? (
                            <View className='tool-output-tabs'>
                                {visibleOutputOptions.map((item) => (
                                    <Text
                                        key={item.value}
                                        className={`tool-output-tab ${outputType === item.value ? 'tool-output-tab--active' : ''}`}
                                        onClick={() => changeOutputType(item.value)}
                                    >
                                        {item.label}
                                    </Text>
                                ))}
                            </View>
                        ) : null}

                        {showInitialSourceActions ? (
                            <View className={`tool-source-actions ${photoRepairTool ? 'tool-source-actions--single' : ''}`}>
                                <View
                                    className={`tool-source-card ${photoRepairTool ? 'tool-source-card--photo-repair' : ''}`}
                                    onClick={() => void chooseReferenceFile()}
                                >
                                    <View className='tool-source-card__icon'>
                                        <Image
                                            className='tool-source-card__icon-image'
                                            src={photoRepairTool ? PHOTO_REPAIR_UPLOAD_ICON : TOOL_ADD_FILE_ICON}
                                            mode='aspectFit'
                                        />
                                    </View>
                                    <Text className='tool-source-card__title'>{activeTool.id === 'imageRepair' ? '上传旧照片' : '添加文件'}</Text>
                                    <Text className='tool-source-card__desc'>
                                        {photoRepairTool
                                            ? '支持 jpg、png、webp 图片，10MB 以内'
                                            : imageTool
                                                ? '支持 jpg、png、webp 图片，10MB 以内'
                                                : '支持 txt、md、doc、docx、xls、xlsx、pptx、pdf、jpg、png 等常用文件'}
                                    </Text>
                                </View>
                                {allowRequirementInput ? (
                                    <View className='tool-source-card' onClick={showPasteInput}>
                                        <View className='tool-source-card__icon'>
                                            <Image className='tool-source-card__icon-image' src={TOOL_PASTE_ICON} mode='aspectFit' />
                                        </View>
                                        <Text className='tool-source-card__title'>{imageTool ? '填写要求' : '粘贴内容'}</Text>
                                        <Text className='tool-source-card__desc'>
                                            {imageTool ? '补充画面描述、修复重点或希望保留的照片质感' : '直接粘贴文章、帖子、会议记录或长文本'}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}

                        {showRequirementInput ? (
                            <Textarea
                                className='tool-input'
                                maxlength={6000}
                                value={content}
                                placeholder={getToolInputPlaceholder(activeTool.id)}
                                onInput={(event) => setContent(event.detail.value)}
                            />
                        ) : null}

                        {referenceAsset ? (
                            photoRepairTool && referenceAsset.fileKind === 'image' && (referenceAsset.imagePreviewUrl || referenceAsset.imageDataUrl) ? (
                                <View className='tool-reference-preview tool-reference-preview--photo-repair'>
                                    <Image
                                        className='tool-reference-preview__photo'
                                        src={referenceAsset.imagePreviewUrl || referenceAsset.imageDataUrl || ''}
                                        mode='widthFix'
                                    />
                                    <View className='tool-reference-preview__photo-meta'>
                                        <Text className='tool-reference-preview__title'>{referenceAsset.name}</Text>
                                        <Text className='tool-reference-preview__remove' onClick={removeReferenceAsset}>移除</Text>
                                    </View>
                                </View>
                            ) : (
                                <View className='tool-reference-preview'>
                                    <View className='tool-reference-preview__file-icon'>
                                        {referenceAsset.fileKind === 'text' ? '文' : referenceAsset.fileKind === 'image' ? '图' : '档'}
                                    </View>
                                    <View className='tool-reference-preview__meta'>
                                        <Text className='tool-reference-preview__title'>{referenceAsset.name}</Text>
                                        <Text className='tool-reference-preview__desc'>
                                            {referenceAsset.fileKind === 'text'
                                                ? '将结合文件内容生成结果'
                                                : referenceAsset.fileKind === 'image'
                                                    ? '将结合图片内容生成结果'
                                                    : `${referenceAsset.fileType || '文档'} 已加入，解析后生成结果`}
                                        </Text>
                                    </View>
                                    <Text className='tool-reference-preview__remove' onClick={removeReferenceAsset}>移除</Text>
                                </View>
                            )
                        ) : null}

                        {showActionRow ? (
                            <View className='tool-action-row'>
                                <Text className='tool-add-asset-button' onClick={() => void chooseReferenceFile()}>+</Text>
                                <Button
                                    className={`saas-button tool-generate-button ${generateButtonMuted ? 'saas-button--disabled' : ''}`}
                                    loading={submitting}
                                    disabled={generateDisabled}
                                    onClick={() => void handleGenerate()}
                                >
                                    {getGenerateButtonText({
                                        enabled: activeTool.enabled,
                                        submitting,
                                        imageTool,
                                    })}
                                </Button>
                                <Text className='tool-clear-button' onClick={clearContent}>清空</Text>
                            </View>
                        ) : null}

                        {result ? (
                            <View className='tool-result'>
                                <Text className='tool-result__ai-badge'>AI生成内容</Text>
                                <View className='tool-result__head'>
                                    <Text className='tool-result__title'>{result.title}</Text>
                                    <Text className='tool-result__copy' onClick={() => void copyResult()}>复制</Text>
                                </View>
                                <Text className='tool-result__summary'>{result.summary}</Text>
                                {result.points.length > 0 ? (
                                    <View className='tool-result__points'>
                                        {result.points.map((point) => (
                                            <Text className='tool-result__point' key={point}>{point}</Text>
                                        ))}
                                    </View>
                                ) : null}
                                <Text className='tool-result__output'>{result.outputText}</Text>
                                <View className='tool-result__actions'>
                                    <Button className='tool-result__share-button' openType='share' onClick={() => void prepareShareToFriend()}>
                                        分享好友
                                    </Button>
                                    <Text className='tool-result__timeline-button' onClick={() => void shareToTimeline()}>分享到朋友圈</Text>
                                </View>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
            <PopLayout visible={quotaSheetVisible} onClose={closeQuotaSheet} panelClassName='plan-sheet tool-quota-sheet'>
                <View className='plan-sheet__head'>
                    <View>
                        <Text className='plan-sheet__label'>AI 工具积分</Text>
                        <Text className='plan-sheet__title'>补充积分后继续使用</Text>
                    </View>
                    <Text className='plan-sheet__close' onClick={closeQuotaSheet}>×</Text>
                </View>
                <Text className='plan-sheet__desc'>
                    当前剩余 {displayedAiToolPointsBalance} 积分，{activeTool.name} 每次消耗 {toolPointCost} 积分。
                </Text>
                <View className='plan-sheet__plans'>
                    {plansLoading ? (
                        <View className='plan-option plan-option--disabled'>
                            <View>
                                <Text className='plan-option__name'>套餐加载中</Text>
                                <Text className='plan-option__duration'>正在同步可购买积分套餐</Text>
                            </View>
                            <View className='plan-option__price-row'>
                                <Text className='plan-option__price'>--</Text>
                            </View>
                        </View>
                    ) : availablePointPlans.length === 0 ? (
                        <View className='plan-option plan-option--disabled'>
                            <View>
                                <Text className='plan-option__name'>暂无可购买套餐</Text>
                                <Text className='plan-option__duration'>请联系管理员配置套餐总积分</Text>
                            </View>
                            <View className='plan-option__price-row'>
                                <Text className='plan-option__price'>--</Text>
                            </View>
                        </View>
                    ) : availablePointPlans.map((plan) => (
                        <View key={`${plan.productCode}-${plan.planCode}`} className='plan-option' onClick={() => openPointPlan(plan)}>
                            <View className='plan-option__copy'>
                                <Text className='plan-option__name'>{plan.planName}</Text>
                                <Text className='plan-option__duration'>
                                    {getPlanAiPoints(plan).toLocaleString('zh-CN')} 积分 · {getPlanDurationLabel(plan)}
                                </Text>
                            </View>
                            <View className='plan-option__price-row'>
                                <Text className='plan-option__price'>¥{plan.price.toFixed(2)}</Text>
                            </View>
                        </View>
                    ))}
                </View>
                <View className='plan-sheet__points tool-quota-sheet__single'>
                    <View>
                        <Text className='plan-sheet__points-title'>单次购买当前工具</Text>
                        <Text className='plan-sheet__points-desc'>
                            本次生成消耗 {toolPointCost} 积分，按 10 积分抵 1 元计费。
                        </Text>
                        <Text className='plan-sheet__points-pay'>应付 ¥{singlePurchaseAmount.toFixed(2)}</Text>
                    </View>
                </View>
                <Button className='saas-button plan-sheet__button' loading={submitting} onClick={() => void handleSinglePurchase()}>
                    ¥{singlePurchaseAmount.toFixed(2)} 单次使用
                </Button>
            </PopLayout>
            <PaymentLockOverlay visible={paymentLocked} />
        </View>
    );
}
