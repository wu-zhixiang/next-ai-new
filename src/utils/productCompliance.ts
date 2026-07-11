import type { MembershipView, PlanView, ProductTypeView } from '@/types';

export function toCompliantProductType(product: ProductTypeView): ProductTypeView {
  const display = product.complianceDisplay;
  if (!display) return product;
  return {
    ...product,
    productName: display.productName || product.productName,
    label: display.label || product.label,
    tag: display.tag || product.tag,
    avatarUrl: display.avatarUrl || product.avatarUrl,
    detailPageUrl: display.detailPageUrl || product.detailPageUrl,
    description: display.description || product.description,
    introHighlights: display.introHighlights ?? product.introHighlights,
  };
}

export function toCompliantPlan(plan: PlanView): PlanView {
  const display = plan.complianceDisplay;
  if (!display) return plan;
  return {
    ...plan,
    productName: display.productName || plan.productName,
    planName: display.planName || plan.planName,
    description: display.description || plan.description,
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
    productName: product?.complianceDisplay?.productName
      || membership.productName
      || product?.productName,
    planName: plan?.complianceDisplay?.planName
      || membership.planName
      || plan?.planName
      || product?.complianceDisplay?.label
      || product?.label,
  };
}

export function getCompliantOrderDisplay(
  productCode: string | undefined,
  planCode: string | undefined,
  productTypes: ProductTypeView[],
  plans: PlanView[],
  fallback: { productName?: string; planName?: string } = {},
): { productName: string; planName: string } {
  const product = productTypes.find((item) => item.productCode === productCode);
  const plan = plans.find((item) => (
    item.productCode === productCode
    && item.planCode === planCode
  ));
  return {
    productName: product?.complianceDisplay?.productName
      || fallback.productName
      || product?.productName
      || 'AI会员',
    planName: plan?.complianceDisplay?.planName
      || fallback.planName
      || plan?.planName
      || 'AI会员套餐',
  };
}
