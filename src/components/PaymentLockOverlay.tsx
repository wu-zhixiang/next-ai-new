import { Text, View } from '@tarojs/components';

interface Props {
  visible: boolean;
  text?: string;
}

export function PaymentLockOverlay({ visible, text = '支付处理中，请勿退出或返回' }: Props): JSX.Element | null {
  if (!visible) return null;

  return (
    <View className='payment-lock'>
      <View className='payment-lock__card'>
        <View className='payment-lock__spinner' />
        <Text className='payment-lock__title'>正在处理订单</Text>
        <Text className='payment-lock__desc'>{text}</Text>
      </View>
    </View>
  );
}
