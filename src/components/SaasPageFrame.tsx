import type { CSSProperties, ReactNode } from 'react';
import { View } from '@tarojs/components';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';

export interface PageTheme {
  headerColor: string;
  headerFadeColor: string;
  pageBackground: string;
  accentColor?: string;
  accentDeepColor?: string;
  accentSoftColor?: string;
}

interface Props {
  title: string;
  className?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  theme?: PageTheme;
  children: ReactNode;
}

type ThemeStyle = CSSProperties & Record<`--page-${string}`, string>;

function buildThemeStyle(theme?: PageTheme): ThemeStyle | undefined {
  if (!theme) return undefined;
  return {
    '--page-header-color': theme.headerColor,
    '--page-header-fade': theme.headerFadeColor,
    '--page-background': theme.pageBackground,
    '--page-accent': theme.accentColor ?? theme.headerColor,
    '--page-accent-deep': theme.accentDeepColor ?? theme.headerColor,
    '--page-accent-soft': theme.accentSoftColor ?? theme.headerFadeColor,
  };
}

export function SaasPageFrame({
  title,
  className = '',
  showBack = true,
  onBack,
  rightAction,
  theme,
  children,
}: Props): JSX.Element {
  return (
    <View className={`page saas-page ${className}`} style={buildThemeStyle(theme)}>
      <AppTransparentHeader title={title} showBack={showBack} onBack={onBack} rightAction={rightAction} />
      {children}
    </View>
  );
}
