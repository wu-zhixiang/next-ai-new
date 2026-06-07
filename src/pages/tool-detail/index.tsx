import { useMemo, useState } from 'react';
import { Button, Image, Text, Textarea, View } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { callCloudFunction } from '@/services/api';
import type { MembershipView } from '@/types';
import { getToolById, type OutputType } from '@/pages/tools/definitions';

const TOOL_ADD_FILE_ICON = require('../../assets/icons/tool-add-file.svg') as string;
const TOOL_PASTE_ICON = require('../../assets/icons/tool-paste.svg') as string;

interface MemberHomeResult {
    membership: MembershipView;
}

interface SummaryResult {
    title: string;
    summary: string;
    points: string[];
    outputText: string;
}

interface ReferenceAsset {
    kind: 'file';
    name: string;
    fileText?: string;
    fileBase64?: string;
    imageDataUrl?: string;
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
const MAX_REFERENCE_IMAGE_SIZE = 900 * 1024;
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

export default function ToolDetailPage(): JSX.Element {
    const [toolId, setToolId] = useState('');
    const [membershipStatus, setMembershipStatus] = useState<MembershipView['status']>('none');
    const [content, setContent] = useState('');
    const [outputType, setOutputType] = useState<OutputType>('summary');
    const [result, setResult] = useState<SummaryResult | null>(null);
    const [referenceAsset, setReferenceAsset] = useState<ReferenceAsset | null>(null);
    const [inputMode, setInputMode] = useState<'idle' | 'paste'>('idle');
    const [submitting, setSubmitting] = useState(false);
    const [todayUsed, setTodayUsed] = useState(false);
    const [adUnlocked, setAdUnlocked] = useState(false);

    const activeTool = useMemo(() => getToolById(toolId), [toolId]);
    const visibleOutputOptions = activeTool.id === 'copywriting' ? COPYWRITING_OUTPUT_OPTIONS : OUTPUT_OPTIONS;
    const memberActive = isMember(membershipStatus);
    const hasGenerationInput = stripLegacyPromptPrefixes(content).length > 0 || Boolean(referenceAsset);
    const generateDisabled = submitting || !hasGenerationInput;

    useLoad((options) => {
        enableShareMenu();
        const nextTool = getToolById(typeof options.tool === 'string' ? options.tool : '');
        setToolId(nextTool.id);
        setOutputType(nextTool.outputType);
        void loadMemberStatus();
        loadDailyUsage();
    });

    useShareAppMessage(() => ({
        title: result?.title || `${activeTool.name} - AIO AI工具`,
        path: `/pages/tool-detail/index?tool=${encodeURIComponent(activeTool.id)}`,
    }));

    useShareTimeline(() => ({
        title: result?.title || `${activeTool.name} - AIO AI工具`,
        query: `tool=${encodeURIComponent(activeTool.id)}`,
    }));

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
        } catch {
            setMembershipStatus('none');
        }
    }

    function loadDailyUsage(): void {
        const record = Taro.getStorageSync(DAILY_USAGE_KEY) as { date?: string; used?: boolean };
        setTodayUsed(Boolean(record?.date === getTodayKey() && record.used));
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
            const fileSize = typeof file.size === 'number'
                ? file.size
                : (await Taro.getFileInfo({ filePath }) as unknown as { size: number }).size;
            if (isImageFile(fileName) && fileSize > MAX_REFERENCE_IMAGE_SIZE) {
                void Taro.showToast({ title: '图片请控制在 900KB 内', icon: 'none' });
                return;
            }
            if (!isImageFile(fileName) && fileSize > MAX_REFERENCE_FILE_SIZE) {
                void Taro.showToast({ title: '文件过大，请控制在 5MB 内', icon: 'none' });
                return;
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
        if (!stripLegacyPromptPrefixes(content)) {
            setInputMode('idle');
        }
        setResult(null);
    }

    async function handleGenerate(): Promise<void> {
        const text = stripLegacyPromptPrefixes(content);
        if (!referenceAsset && text.length === 0) {
            void Taro.showToast({ title: '请输入内容或添加素材', icon: 'none' });
            return;
        }
        if (submitting) return;
        const allowed = await ensureUsagePermission();
        if (!allowed) return;

        setSubmitting(true);
        try {
            const summary = await callCloudFunction<SummaryResult>('summarize-ai-tool', {
                content: text,
                outputType,
                imageDataUrl: '',
                fileText: referenceAsset?.fileText || '',
                fileBase64: referenceAsset?.fileBase64 || '',
                imageDataUrl: referenceAsset?.imageDataUrl || '',
                fileName: referenceAsset?.name || '',
                fileType: referenceAsset?.fileType || '',
            });
            setResult(summary);
            if (!memberActive) {
                markDailyUsed();
            }
        } catch (error) {
            void Taro.showToast({
                title: error instanceof Error ? error.message : '生成失败',
                icon: 'none',
            });
        } finally {
            setSubmitting(false);
        }
    }

    async function copyResult(): Promise<void> {
        if (!result?.outputText) return;
        await Taro.setClipboardData({ data: buildResultMarkdown(result) });
    }

    async function prepareShareToFriend(): Promise<void> {
        if (!result) return;
        await Taro.setClipboardData({ data: buildResultMarkdown(result) });
        void Taro.showToast({ title: '结果已复制，可粘贴给好友', icon: 'none' });
    }

    async function shareToTimeline(): Promise<void> {
        if (result) {
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
                            <View className='tool-card__icon tool-detail-hero__icon'>{activeTool.icon}</View>
                            <View>
                                <Text className='tool-detail-hero__title'>{activeTool.name}</Text>
                                <Text className='tool-detail-hero__desc'>{activeTool.desc}</Text>
                            </View>
                        </View>

                        <Text className='tool-workbench__quota'>
                            {memberActive ? '会员免广告' : todayUsed && !adUnlocked ? '需看广告' : '今日可免费'}
                        </Text>
                    </View>

                    <View className='tool-workbench tool-workbench--detail'>
                        <Text className='tool-ai-notice'>AI生成内容，仅供参考。</Text>

                        {/* <View className='tool-preset-row'>
              {PROMPT_PRESETS.map((preset) => (
                <Text className='tool-preset-chip' key={preset.label} onClick={() => applyPreset(preset)}>
                  {preset.label}
                </Text>
              ))}
            </View> */}

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

                        {inputMode === 'idle' && !referenceAsset && !content ? (
                            <View className='tool-source-actions'>
                                <View className='tool-source-card' onClick={() => void chooseReferenceFile()}>
                                    <View className='tool-source-card__icon'>
                                        <Image className='tool-source-card__icon-image' src={TOOL_ADD_FILE_ICON} mode='aspectFit' />
                                    </View>
                                    <Text className='tool-source-card__title'>添加文件</Text>
                                    <Text className='tool-source-card__desc'>支持 txt、md、doc、docx、xls、xlsx、pptx、pdf、jpg、png 等常用文件</Text>
                                </View>
                                <View className='tool-source-card' onClick={showPasteInput}>
                                    <View className='tool-source-card__icon'>
                                        <Image className='tool-source-card__icon-image' src={TOOL_PASTE_ICON} mode='aspectFit' />
                                    </View>
                                    <Text className='tool-source-card__title'>粘贴内容</Text>
                                    <Text className='tool-source-card__desc'>直接粘贴文章、帖子、会议记录或长文本</Text>
                                </View>
                            </View>
                        ) : null}

                        {inputMode === 'paste' || content ? (
                            <Textarea
                                className='tool-input'
                                maxlength={6000}
                                value={content}
                                placeholder='粘贴文章、帖子、会议记录或一段长文本'
                                onInput={(event) => setContent(event.detail.value)}
                            />
                        ) : null}

                        {referenceAsset ? (
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
                        ) : null}

                        {(inputMode !== 'idle' || referenceAsset || content) ? (
                            <View className='tool-action-row'>
                                <Text className='tool-add-asset-button' onClick={() => void chooseReferenceFile()}>+</Text>
                                <Button
                                    className={`saas-button tool-generate-button ${generateDisabled ? 'saas-button--disabled' : ''}`}
                                    loading={submitting}
                                    disabled={generateDisabled}
                                    onClick={() => void handleGenerate()}
                                >
                                    {submitting ? '生成中' : '生成结果'}
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
        </View>
    );
}
