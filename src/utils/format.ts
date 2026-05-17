import dayjs from 'dayjs';

export function formatDate(value?: number): string {
  if (!value) {
    return '-';
  }
  return dayjs(value).format('YYYY-MM-DD');
}

export function formatDateTime(value?: number): string {
  if (!value) {
    return '-';
  }
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

export function formatPrice(value?: number): string {
  if (typeof value !== 'number') {
    return '--';
  }
  return `¥${value.toFixed(2)}`;
}
