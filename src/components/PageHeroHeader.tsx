import { Text, View } from '@tarojs/components';

interface Props {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone?: 'forest' | 'gold' | 'clay' | 'ink';
}

export function PageHeroHeader({ eyebrow, title, subtitle, tone = 'forest' }: Props): JSX.Element {
  return (
    <View className={`hero-header hero-header--${tone}`}>
      <View className='hero-header__inner'>
        <Text className='hero-header__eyebrow'>{eyebrow}</Text>
        <Text className='hero-header__title'>{title}</Text>
        <Text className='hero-header__subtitle'>{subtitle}</Text>
      </View>
      <View className='hero-header__fade' />
    </View>
  );
}
