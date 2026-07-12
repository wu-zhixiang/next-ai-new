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

const TOOL_ADD_FILE_ICON = require('../../assets/icons/tool-add-file.svg') as string;
const TOOL_PASTE_ICON = require('../../assets/icons/tool-paste.svg') as string;
const PHOTO_REPAIR_UPLOAD_ICON = 'cloud://cloud1-d3gbrpive8611514c.636c-cloud1-d3gbrpive8611514c-1348953433/cloud-admin/uploads/1783759515882-58219-upload_icon_content_only.webp';

interface MemberHomeResult {
    membership: MembershipView;
    userInfo?: {
        pointsBalance?: number;
        aiToolPointsBalance?: number;
    };
    pointsConfig?: {
        pointsPerYuan?: number;
    };
}

interface SummaryResult {
    runId?: string;
    title: string;
    summary: string;
    points: string[];
    outputText: string;
    status: RunAiToolResult['status'];
    toolId: string;
    outputImages?: Array<{
        fileId: string;
        url?: string;
        width?: number;
        height?: number;
    }>;
}

interface RunAiToolResult {
    runId: string;
    status: 'succeeded' | 'failed' | 'processing';
    toolId: string;
    title: string;
    summary?: string;
    points?: string[];
    outputText?: string;
    outputImages?: Array<{
        fileId: string;
        url?: string;
        width?: number;
        height?: number;
    }>;
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
    originalAmount?: number;
    pointsDeducted?: number;
    pointsDeductAmount?: number;
    toolId: string;
    toolName: string;
    pointCost: number;
}

interface CreateOrderResult {
    orderNo: string;
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
    uploadedFileId?: string;
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
const DEFAULT_POINTS_PER_YUAN = 1;
const MAX_REFERENCE_FILE_SIZE = 5 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_REFERENCE_FILE_TEXT_LENGTH = 6000;
const AI_IMAGE_RUN_MAX_POLLS = 120;
const AI_IMAGE_RUN_FIRST_POLL_DELAY_MS = 1200;
const AI_IMAGE_RUN_POLL_INTERVAL_MS = 2500;
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

function buildCloudImagePath(fileName: string): string {
    const extension = getFileExtension(fileName) || 'jpg';
    const random = Math.random().toString(16).slice(2, 10);
    return `ai-tools/source/miniapp-${Date.now()}-${random}.${extension}`;
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
        runId: runResult.runId,
        title: runResult.title,
        summary: runResult.summary || '',
        points: runResult.points || [],
        outputText: runResult.outputText || '',
        status: runResult.status,
        toolId: runResult.toolId,
        outputImages: runResult.outputImages,
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
    const [pointsBalance, setPointsBalance] = useState(0);
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
    const [usePointsDeduction, setUsePointsDeduction] = useState(false);
    const [quotaPurchaseMode, setQuotaPurchaseMode] = useState<'single' | 'plan'>('single');
    const [selectedQuotaPlanCode, setSelectedQuotaPlanCode] = useState('');
    const [pointsPerYuan, setPointsPerYuan] = useState(DEFAULT_POINTS_PER_YUAN);
    const [paymentLocked, setPaymentLocked] = useState(false);
    const [sharePanelVisible, setSharePanelVisible] = useState(false);

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
    const singleDeductiblePoints = Math.min(pointsBalance, Math.floor(singlePurchaseAmount * pointsPerYuan));
    const singleDeductAmount = Number((singleDeductiblePoints / pointsPerYuan).toFixed(2));
    const singlePayAmount = Math.max(0, Number((singlePurchaseAmount - (quotaPurchaseMode === 'single' && usePointsDeduction ? singleDeductAmount : 0)).toFixed(2)));
    const resultIsMedia = Boolean(result && isImageTool(result.toolId));
    const resultProcessing = result?.status === 'processing';
    const resultFailed = result?.status === 'failed';
    const resultShareImageUrl = result?.outputImages?.find((image) => Boolean(image.url))?.url;
    const resultShareReady = Boolean(result && result.status === 'succeeded' && (
        resultIsMedia
            ? resultShareImageUrl
            : result.outputText || result.summary || result.points.length > 0
    ));
    const showInitialSourceActions = inputMode === 'idle' && !referenceAsset && (photoRepairTool || !textContent);
    const showRequirementInput = allowRequirementInput && (inputMode === 'paste' || Boolean(textContent));
    const showActionRow = photoRepairTool
        ? Boolean(referenceAsset)
        : inputMode !== 'idle' || Boolean(referenceAsset) || Boolean(textContent);
    const availablePointPlans = useMemo(
        () => pointPlans.filter((plan) => getPlanAiPoints(plan) > 0),
        [pointPlans],
    );
    const selectedQuotaPlan = availablePointPlans.find((plan) => plan.planCode === selectedQuotaPlanCode) ?? null;
    const quotaBaseAmount = quotaPurchaseMode === 'plan' && selectedQuotaPlan ? selectedQuotaPlan.price : singlePurchaseAmount;
    const quotaDeductiblePoints = Math.min(pointsBalance, Math.floor(quotaBaseAmount * pointsPerYuan));
    const quotaDeductAmount = Number((quotaDeductiblePoints / pointsPerYuan).toFixed(2));
    const quotaPayAmount = Math.max(0, Number((quotaBaseAmount - (usePointsDeduction ? quotaDeductAmount : 0)).toFixed(2)));
    const pointsDeductionAvailable = quotaDeductiblePoints > 0;
    const quotaPayButtonText = quotaPurchaseMode === 'plan' && selectedQuotaPlan
        ? `¥${quotaPayAmount.toFixed(2)} 购买套餐`
        : `¥${quotaPayAmount.toFixed(2)} 单次使用`;

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
        path: result?.runId
            ? `/pages/tool-detail/index?tool=${encodeURIComponent(activeTool.id)}&runId=${encodeURIComponent(result.runId)}`
            : `/pages/tool-detail/index?tool=${encodeURIComponent(activeTool.id)}`,
        imageUrl: resultShareImageUrl,
    }));

    useShareTimeline(() => ({
        title: result?.title || `${activeTool.name} - AIO AI工具`,
        query: result?.runId
            ? `tool=${encodeURIComponent(activeTool.id)}&runId=${encodeURIComponent(result.runId)}`
            : `tool=${encodeURIComponent(activeTool.id)}`,
        imageUrl: resultShareImageUrl,
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

    function openResultSharePanel(): void {
        if (!resultShareReady || !result) {
            void Taro.showToast({ title: '生成完成后可分享', icon: 'none' });
            return;
        }
        setSharePanelVisible(true);
        enableShareMenu();
    }

    function closeResultSharePanel(): void {
        setSharePanelVisible(false);
    }

    function showResultTimelineGuide(): void {
        setSharePanelVisible(false);
        enableShareMenu();
        void Taro.showToast({
            title: '请点击右上角分享到朋友圈',
            icon: 'none',
        });
    }

    async function loadMemberStatus(): Promise<void> {
        try {
            const memberResult = await callCloudFunction<MemberHomeResult>('get-member-home');
            setMembershipStatus(memberResult.membership.status);
            setPointsBalance(Math.max(0, Math.floor(memberResult.userInfo?.pointsBalance ?? 0)));
            setAiToolPointsBalance(Math.max(0, Math.floor(memberResult.userInfo?.aiToolPointsBalance ?? 0)));
            setPointsPerYuan(Math.max(1, Math.floor(memberResult.pointsConfig?.pointsPerYuan ?? DEFAULT_POINTS_PER_YUAN)));
        } catch {
            setMembershipStatus('none');
            setPointsBalance(0);
            setAiToolPointsBalance(0);
            setPointsPerYuan(DEFAULT_POINTS_PER_YUAN);
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
            handleRunSuccess(runResult);
            if (runResult.status === 'processing') {
                const completedResult = await waitForRunCompleted(runResult.runId);
                handleRunSuccess(completedResult);
            }
        } catch (error) {
            void Taro.showToast({
                title: error instanceof Error ? error.message : '结果读取失败',
                icon: 'none',
            });
        } finally {
            setSubmitting(false);
        }
    }

    async function waitForRunCompleted(runId: string): Promise<RunAiToolResult> {
        let latest: RunAiToolResult | null = null;
        for (let index = 0; index < AI_IMAGE_RUN_MAX_POLLS; index += 1) {
            await delay(index === 0 ? AI_IMAGE_RUN_FIRST_POLL_DELAY_MS : AI_IMAGE_RUN_POLL_INTERVAL_MS);
            latest = await callCloudFunction<RunAiToolResult>('get-ai-tool-run', { runId });
            handleRunSuccess(latest);
            if (latest.status === 'succeeded') {
                return latest;
            }
            if (latest.status === 'failed') {
                throw new Error(latest.summary || latest.outputText || '修复失败，请稍后再试');
            }
        }
        void Taro.showToast({ title: '仍在处理中，可稍后查看历史', icon: 'none' });
        return latest ?? await callCloudFunction<RunAiToolResult>('get-ai-tool-run', { runId });
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
                if (photoRepairTool && isImageFile(fileName)) {
                    setReferenceAsset({
                        kind: 'file',
                        name: fileName,
                        imagePreviewUrl: filePath,
                        fileType: fileTypeLabel,
                        fileKind: 'image',
                    });
                    setInputMode('idle');
                    setResult(null);
                    return;
                }
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

    async function uploadPhotoRepairSourceImage(asset: ReferenceAsset): Promise<string> {
        if (asset.uploadedFileId) {
            return asset.uploadedFileId;
        }
        if (!asset.imagePreviewUrl) {
            throw new Error('请先上传需要修复的旧照片');
        }
        const upload = await Taro.cloud.uploadFile({
            cloudPath: buildCloudImagePath(asset.name),
            filePath: asset.imagePreviewUrl,
        });
        const fileId = upload.fileID;
        if (!fileId) {
            throw new Error('照片上传失败');
        }
        setReferenceAsset((current) => (
            current === asset ? { ...current, uploadedFileId: fileId } : current
        ));
        return fileId;
    }

    async function buildRunPayload(text: string): Promise<Record<string, unknown>> {
        if (photoRepairTool) {
            if (!referenceAsset || referenceAsset.fileKind !== 'image') {
                throw new Error('请先上传需要修复的旧照片');
            }
            const sourceFileId = await uploadPhotoRepairSourceImage(referenceAsset);
            return {
                toolId: activeTool.id,
                text,
                outputType,
                assetIds: [sourceFileId],
                fileName: referenceAsset.name,
                fileType: referenceAsset.fileType || '',
                source: 'miniapp',
            };
        }
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
        setTools((currentTools) => currentTools.map((tool) => (
            tool.id === runResult.toolId
                ? { ...tool, trialRemaining: Math.max(0, Math.floor(runResult.usage.dailyFreeRemaining ?? 0)) }
                : tool
        )));
        if (runResult.usage.freeUsed) {
            markDailyUsed();
        } else if (runResult.usage.rewardAdUsed) {
            setAdUnlocked(false);
        }
    }

    async function runCurrentGeneration(): Promise<void> {
        const text = photoRepairTool ? '' : stripLegacyPromptPrefixes(content);
        const payload = await buildRunPayload(text);
        const initialResult = await callCloudFunction<RunAiToolResult>('run-ai-tool', payload);
        handleRunSuccess(initialResult);
        if (photoRepairTool && initialResult.status === 'processing') {
            const completedResult = await waitForRunCompleted(initialResult.runId);
            handleRunSuccess(completedResult);
        }
    }

    function openQuotaSheet(data: QuotaExceededData): void {
        setQuotaData(data);
        setAiToolPointsBalance(Math.max(0, Math.floor(data.aiToolPointsBalance)));
        setUsePointsDeduction(false);
        setQuotaPurchaseMode('single');
        setSelectedQuotaPlanCode('');
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

    async function waitForQuotaOrderFulfilled(orderNo: string): Promise<void> {
        for (let index = 0; index < 45; index += 1) {
            await delay(index === 0 ? 700 : 1000);
            const snapshot = await callCloudFunction<PayResultSnapshot>('get-pay-result', { orderNo });
            const fulfilled = snapshot.payStatus === 'paid'
                && (snapshot.fulfillmentStatus === 'fulfilled' || !snapshot.fulfillmentStatus);
            if (fulfilled) {
                return;
            }
            if (snapshot.payStatus === 'closed' || snapshot.payStatus === 'failed' || snapshot.fulfillmentStatus === 'failed') {
                throw new Error('订单未完成开通，请重新购买');
            }
        }
        throw new Error('支付回调同步中，请稍后再次点击生成');
    }

    async function continueGenerationAfterQuotaPayment(): Promise<void> {
        setQuotaSheetVisible(false);
        setQuotaData(null);
        setPaymentLocked(false);
        await delay(120);
        await runCurrentGeneration();
    }

    async function handleSinglePurchase(): Promise<void> {
        const currentQuota = quotaData;
        if (!currentQuota || submitting || paymentLocked) return;
        setSubmitting(true);
        setPaymentLocked(true);
        try {
            const order = await callCloudFunction<CreateToolSingleOrderResult>('create-tool-single-order', {
                toolId: currentQuota.toolId,
                usePointsDeduction,
            });
            const payment = await callCloudFunction<PayOrderResult>('pay-order', await createPayOrderPayload(order.orderNo));
            if (!payment.paid && (payment.payment || payment.virtualPayment)) {
                await requestMiniProgramPayment(payment);
            }
            await waitForQuotaOrderFulfilled(order.orderNo);
            await continueGenerationAfterQuotaPayment();
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

    async function handlePlanPurchase(plan: PlanView): Promise<void> {
        if (!plan.pid) {
            void Taro.showToast({ title: '套餐缺少 pid，请联系管理员', icon: 'none' });
            return;
        }
        setSubmitting(true);
        setPaymentLocked(true);
        try {
            const order = await callCloudFunction<CreateOrderResult>('create-order', {
                pid: plan.pid,
                usePointsDeduction,
            });
            const payment = await callCloudFunction<PayOrderResult>('pay-order', await createPayOrderPayload(order.orderNo));
            if (!payment.paid && (payment.payment || payment.virtualPayment)) {
                await requestMiniProgramPayment(payment);
            }
            await waitForQuotaOrderFulfilled(order.orderNo);
            await loadMemberStatus();
            await continueGenerationAfterQuotaPayment();
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

    async function handleQuotaPayment(): Promise<void> {
        if (quotaPurchaseMode === 'plan') {
            if (!selectedQuotaPlan) {
                void Taro.showToast({ title: '请选择套餐', icon: 'none' });
                return;
            }
            await handlePlanPurchase(selectedQuotaPlan);
            return;
        }
        await handleSinglePurchase();
    }

    function previewResultImage(url: string): void {
        const urls = result?.outputImages?.map((image) => image.url).filter((item): item is string => Boolean(item)) ?? [];
        if (!url || urls.length === 0) return;
        void Taro.previewImage({
            current: url,
            urls,
        });
    }

    async function copyResult(): Promise<void> {
        if (!result?.outputText) return;
        if (!await ensurePrivacyAuthorization()) return;
        await Taro.setClipboardData({ data: buildResultMarkdown(result) });
    }

    async function prepareShareToFriend(): Promise<void> {
        if (!resultShareReady || !result) {
            void Taro.showToast({ title: '生成完成后可分享', icon: 'none' });
            return;
        }
        if (!await ensurePrivacyAuthorization()) return;
        await Taro.setClipboardData({ data: buildResultMarkdown(result) });
        void Taro.showToast({ title: '结果已复制，可粘贴给好友', icon: 'none' });
    }

    async function shareToTimeline(): Promise<void> {
        if (!resultShareReady) {
            void Taro.showToast({ title: '生成完成后可分享', icon: 'none' });
            return;
        }
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

    function openToolHistory(): void {
        void Taro.navigateTo({
            url: `/pages/tool-history/index?tool=${encodeURIComponent(activeTool.id)}`,
        });
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

                        <View className='tool-workbench__meta-actions'>
                            <Text className='tool-workbench__quota tool-workbench__quota--cost'>
                                {!activeTool.enabled
                                    ? '接入中'
                                    : `${activeTool.pointCost ?? 0} 积分/次`}
                            </Text>
                            <Text className='tool-workbench__quota tool-workbench__quota--trial'>
                                {(activeTool.trialLimit ?? 0) > 0
                                    ? `免费体验 ${activeTool.trialRemaining ?? activeTool.trialLimit ?? 0} 次`
                                    : '暂无体验次数'}
                            </Text>
                        </View>
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
                                        onClick={() => void chooseReferenceFile()}
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
                                {!photoRepairTool ? (
                                    <Text className='tool-add-asset-button' onClick={() => void chooseReferenceFile()}>+</Text>
                                ) : null}
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
                            <View className={`tool-result ${resultIsMedia ? 'tool-result--media' : ''}`}>
                                {/* <Text className='tool-result__ai-badge'>AI生成内容</Text> */}
                                {resultIsMedia ? (
                                    <View className='tool-result__media-body'>
                                        {resultProcessing ? (
                                            <View className='tool-result__media-loading'>
                                                <View className='tool-result__media-skeleton' />
                                            </View>
                                        ) : result.outputImages?.some((image) => Boolean(image.url)) ? (
                                            <View className='tool-result__images'>
                                                {result.outputImages.map((image) => (
                                                    image.url ? (
                                                        <Image
                                                            key={image.fileId}
                                                            className='tool-result__image'
                                                            src={image.url}
                                                            mode='widthFix'
                                                            showMenuByLongpress
                                                            onClick={() => previewResultImage(image.url || '')}
                                                        />
                                                    ) : null
                                                ))}
                                            </View>
                                        ) : (
                                            <View className={`tool-result__media-empty ${resultFailed ? 'tool-result__media-empty--failed' : ''}`}>
                                                <Text className='tool-result__media-empty-title'>{result.title || (resultFailed ? '生成失败' : '暂无结果')}</Text>
                                                <Text className='tool-result__media-empty-desc'>{result.summary || result.outputText || '请稍后重试'}</Text>
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <View>
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
                                        {result.outputText ? (
                                            <Text className='tool-result__output'>{result.outputText}</Text>
                                        ) : null}
                                    </View>
                                )}
                                {resultIsMedia ? (
                                    <View className={`tool-result__share-entry ${resultShareReady ? '' : 'tool-result__share-entry--disabled'}`}>
                                        <Text className='tool-result__share-entry-text'>快分享给你的好友，回忆童年吧</Text>
                                        <Button className='tool-result__share-entry-button' onClick={openResultSharePanel}>
                                            <View className='wechat-share-icon wechat-share-icon--small' />
                                        </Button>
                                    </View>
                                ) : (
                                    <View className='tool-result__actions'>
                                        <Button
                                            className={`tool-result__share-button ${resultShareReady ? '' : 'tool-result__share-button--disabled'}`}
                                            openType={resultShareReady ? 'share' : undefined}
                                            disabled={!resultShareReady}
                                            onClick={() => void prepareShareToFriend()}
                                        >
                                            分享好友
                                        </Button>
                                        <Text
                                            className={`tool-result__timeline-button ${resultShareReady ? '' : 'tool-result__timeline-button--disabled'}`}
                                            onClick={() => void shareToTimeline()}
                                        >
                                            分享朋友圈
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
            <View className='tool-detail-historybar'>
                <Button className='saas-button tool-detail-historybar__button' onClick={openToolHistory}>
                    查看历史
                </Button>
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
                    ) : availablePointPlans.map((plan) => {
                        const selected = quotaPurchaseMode === 'plan' && selectedQuotaPlanCode === plan.planCode;
                        return (
                        <View
                            key={`${plan.productCode}-${plan.planCode}`}
                            className={`plan-option ${selected ? 'plan-option--selected' : ''}`}
                            onClick={() => {
                                setQuotaPurchaseMode('plan');
                                setSelectedQuotaPlanCode(plan.planCode);
                            }}
                        >
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
                        );
                    })}
                </View>
                <View
                    className={`plan-sheet__points tool-quota-sheet__single ${quotaPurchaseMode === 'single' ? 'plan-sheet__points--active' : ''}`}
                    onClick={() => {
                        setQuotaPurchaseMode('single');
                        setSelectedQuotaPlanCode('');
                    }}
                >
                    <View>
                        <Text className='plan-sheet__points-title'>单次购买当前工具</Text>
                        <Text className='plan-sheet__points-desc'>
                            本次生成消耗 {toolPointCost} AI 工具积分，{pointsPerYuan} T币可抵 ¥1。
                        </Text>
                        <Text className='plan-sheet__points-pay'>应付 ¥{singlePayAmount.toFixed(2)}</Text>
                    </View>
                </View>
                <View className={`plan-sheet__points ${usePointsDeduction ? 'plan-sheet__points--active' : ''} ${pointsDeductionAvailable ? '' : 'plan-sheet__points--disabled'}`}>
                    <View>
                        <Text className='plan-sheet__points-title'>使用 T币 抵扣</Text>
                        <Text className='plan-sheet__points-desc'>
                            {pointsDeductionAvailable
                                ? `可用 ${pointsBalance} T币，本次抵扣 ¥${quotaDeductAmount.toFixed(2)}`
                                : `可用 ${pointsBalance} T币，${pointsPerYuan} T币可抵 ¥1`}
                        </Text>
                        <Text className='plan-sheet__points-pay'>预计支付 ¥{quotaPayAmount.toFixed(2)}</Text>
                    </View>
                    <View
                        className={`ios-switch ${usePointsDeduction ? 'ios-switch--on' : ''}`}
                        onClick={() => {
                            if (!pointsDeductionAvailable) {
                                Taro.showToast({ title: '暂无可抵扣 T币', icon: 'none' });
                                return;
                            }
                            setUsePointsDeduction((enabled) => !enabled);
                        }}
                    >
                        <Text className='ios-switch__thumb' />
                    </View>
                </View>
                <Button className='saas-button plan-sheet__button' loading={submitting} onClick={() => void handleQuotaPayment()}>
                    {quotaPayButtonText}
                </Button>
            </PopLayout>
            {sharePanelVisible ? (
                <View className='news-share-sheet' onClick={closeResultSharePanel}>
                    <View className='news-share-sheet__panel' onClick={(event) => event.stopPropagation()}>
                        <Text className='news-share-sheet__title'>分享结果</Text>
                        <Text className='news-share-sheet__desc'>{result?.title || `${activeTool.name}生成结果`}</Text>
                        <View className='news-share-sheet__actions'>
                            <Button className='news-share-sheet__action' openType='share' onClick={closeResultSharePanel}>
                                <Text className='news-share-sheet__action-icon'>友</Text>
                                <Text className='news-share-sheet__action-text'>微信好友</Text>
                            </Button>
                            <View className='news-share-sheet__action' onClick={showResultTimelineGuide}>
                                <Text className='news-share-sheet__action-icon'>圈</Text>
                                <Text className='news-share-sheet__action-text'>朋友圈</Text>
                            </View>
                        </View>
                    </View>
                </View>
            ) : null}
            <PaymentLockOverlay visible={paymentLocked} />
        </View>
    );
}
