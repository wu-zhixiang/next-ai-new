import type { ReactNode } from 'react';
import { View } from '@tarojs/components';

interface Props {
  visible: boolean;
  children: ReactNode;
  onClose: () => void;
  panelClassName?: string;
}

export function PopLayout({ visible, children, onClose, panelClassName = '' }: Props): JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <View className='pop-layout'>
      <View className='pop-layout__mask' onClick={onClose} />
      <View className={`pop-layout__panel ${panelClassName}`}>
        {children}
      </View>
    </View>
  );
}
