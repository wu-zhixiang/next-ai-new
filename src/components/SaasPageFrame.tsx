import type { ReactNode } from 'react';
import { View } from '@tarojs/components';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';

interface Props {
  title: string;
  className?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  children: ReactNode;
}

export function SaasPageFrame({ title, className = '', showBack = true, onBack, rightAction, children }: Props): JSX.Element {
  return (
    <View className={`page saas-page ${className}`}>
      <AppTransparentHeader title={title} showBack={showBack} onBack={onBack} rightAction={rightAction} />
      {children}
    </View>
  );
}
