import { View } from '@tarojs/components';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  radius?: string;
}

interface SkeletonGroupProps {
  count?: number;
  className?: string;
}

export function Skeleton({ className = '', width = '100%', height = '24rpx', radius = '999rpx' }: SkeletonProps): JSX.Element {
  return (
    <View
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

export function SkeletonOrderCard(): JSX.Element {
  return (
    <View className='record-card skeleton-card'>
      <View className='record-card__head'>
        <View>
          <Skeleton width='132rpx' height='44rpx' />
          <Skeleton className='skeleton-card__title' width='260rpx' height='42rpx' radius='14rpx' />
        </View>
        <Skeleton width='116rpx' height='48rpx' />
      </View>
      <View className='record-card__rows'>
        <Skeleton width='100%' height='32rpx' radius='12rpx' />
        <Skeleton width='88%' height='32rpx' radius='12rpx' />
        <Skeleton width='72%' height='32rpx' radius='12rpx' />
      </View>
      <View className='record-card__action'>
        <Skeleton width='180rpx' height='34rpx' radius='12rpx' />
        <Skeleton width='42rpx' height='42rpx' />
      </View>
    </View>
  );
}

export function SkeletonOrderList({ count = 3, className = '' }: SkeletonGroupProps): JSX.Element {
  return (
    <View className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonOrderCard key={index} />
      ))}
    </View>
  );
}

export function SkeletonInvitePage(): JSX.Element {
  return (
    <View>
      <Skeleton className='invite-hero skeleton-invite-hero' height='530rpx' radius='64rpx' />
      <View className='section-head'>
        <Skeleton width='150rpx' height='34rpx' radius='12rpx' />
        <Skeleton width='96rpx' height='28rpx' radius='12rpx' />
      </View>
      <View className='invite-list'>
        {Array.from({ length: 2 }).map((_, index) => (
          <View key={index} className='invite-record'>
            <Skeleton width='96rpx' height='96rpx' />
            <View className='invite-record__body'>
              <View className='invite-record__top'>
                <Skeleton width='140rpx' height='30rpx' radius='12rpx' />
                <Skeleton width='96rpx' height='34rpx' radius='12rpx' />
              </View>
              <View className='invite-record__bottom'>
                <Skeleton width='210rpx' height='26rpx' radius='12rpx' />
                <Skeleton width='110rpx' height='26rpx' radius='12rpx' />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonPayResult(): JSX.Element {
  return (
    <View className='pay-detail-skeleton'>
      <View className='pay-success pay-detail-skeleton__hero'>
        <Skeleton className='pay-detail-skeleton__icon' width='192rpx' height='192rpx' />
        <Skeleton className='pay-detail-skeleton__title' width='260rpx' height='48rpx' radius='16rpx' />
        <Skeleton className='pay-detail-skeleton__desc' width='440rpx' height='30rpx' radius='12rpx' />
      </View>
      <View className='pay-info-card glass-card pay-detail-skeleton__card'>
        <Skeleton className='pay-detail-skeleton__section-title' width='150rpx' height='34rpx' radius='12rpx' />
        <View className='pay-info-card__rows'>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} className='pay-detail-skeleton__row'>
              <Skeleton width={index === 0 ? '128rpx' : '112rpx'} height='28rpx' radius='10rpx' />
              <Skeleton width={index === 0 ? '260rpx' : index === 2 ? '132rpx' : '190rpx'} height='30rpx' radius='10rpx' />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
