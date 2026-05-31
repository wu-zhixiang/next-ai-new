import type { ReactNode } from 'react';
import { View } from '@tarojs/components';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';

interface Props {
  title: string;
  className?: string;
  showBack?: boolean;
  onBack?: () => void;
  children: ReactNode;
}

export function SaasPageFrame({ title, className = '', showBack = true, onBack, children }: Props): JSX.Element {
  return (
    <View className={`page saas-page ${className}`}>
      <AppTransparentHeader title={title} showBack={showBack} onBack={onBack} />
      {children}
    </View>
  );
}
