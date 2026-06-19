import type { MembershipView, PlanView, ProductTypeView } from '@/types';

export function toCompliantProductType(product: ProductTypeView): ProductTypeView | null {
  const display = product.complianceDisplay;
  if (!display) return null;
  return {
    ...product,
    productName: display.productName,
    label: display.label,
    tag: display.tag,
    avatarUrl: display.avatarUrl,
    description: display.description,
    introHighlights: display.introHighlights ?? [],
  };
}

export function toCompliantPlan(plan: PlanView): PlanView | null {
  const display = plan.complianceDisplay;
  if (!display) return null;
  return {
    ...plan,
    productName: display.productName,
    planName: display.planName,
    description: display.description,
  };
}

export function toCompliantMembership(
  membership: MembershipView,
  productTypes: ProductTypeView[],
  plans: PlanView[],
): MembershipView {
  const product = productTypes.find((item) => item.productCode === membership.productCode);
  const plan = plans.find((item) => (
    item.productCode === membership.productCode
    && item.planCode === membership.planCode
  ));
  return {
    ...membership,
    productName: product?.complianceDisplay?.productName ?? 'AI会员',
    planName: plan?.complianceDisplay?.planName
      ?? product?.complianceDisplay?.label
      ?? 'AI会员套餐',
  };
}

export function getCompliantOrderDisplay(
  productCode: string | undefined,
  planCode: string | undefined,
  productTypes: ProductTypeView[],
  plans: PlanView[],
): { productName: string; planName: string } {
  const product = productTypes.find((item) => item.productCode === productCode);
  const plan = plans.find((item) => (
    item.productCode === productCode
    && item.planCode === planCode
  ));
  return {
    productName: product?.complianceDisplay?.productName ?? 'AI会员',
    planName: plan?.complianceDisplay?.planName ?? 'AI会员套餐',
  };
}
