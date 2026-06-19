import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCompliantOrderDisplay,
  toCompliantPlan,
  toCompliantProductType,
} from '../src/utils/productCompliance.ts';
import type { PlanView, ProductTypeView } from '../src/types/index.ts';

const product: ProductTypeView = {
  productCode: 'internal_product',
  productName: 'Internal Product Name',
  label: 'Internal Label',
  tag: 'Internal Tag',
  enabled: true,
  sort: 1,
  avatarUrl: 'https://example.com/internal.png',
  description: 'Internal description',
  introHighlights: [],
  complianceDisplay: {
    productName: 'AI效率会员',
    label: '效率会员',
    tag: '效率提升',
    description: '合规展示说明',
  },
};

const plan: PlanView = {
  pid: 'internal_plan',
  productCode: 'internal_product',
  productName: 'Internal Product Name',
  planCode: 'monthly',
  planName: 'Internal Monthly Plan',
  price: 100,
  durationDays: 30,
  description: 'Internal plan description',
  complianceDisplay: {
    productName: 'AI效率会员',
    planName: 'AI效率会员月度套餐',
    description: '合规套餐说明',
  },
};

test('compliance display replaces visible fields without changing internal identifiers', () => {
  const compliantProduct = toCompliantProductType(product);
  const compliantPlan = toCompliantPlan(plan);

  assert.equal(compliantProduct?.productCode, 'internal_product');
  assert.equal(compliantProduct?.productName, 'AI效率会员');
  assert.equal(compliantProduct?.avatarUrl, undefined);
  assert.equal(compliantPlan?.pid, 'internal_plan');
  assert.equal(compliantPlan?.planCode, 'monthly');
  assert.equal(compliantPlan?.planName, 'AI效率会员月度套餐');
});

test('products and plans without compliance display fields are hidden', () => {
  assert.equal(toCompliantProductType({ ...product, complianceDisplay: undefined }), null);
  assert.equal(toCompliantPlan({ ...plan, complianceDisplay: undefined }), null);
});

test('historical orders use generic names when compliance metadata is unavailable', () => {
  assert.deepEqual(
    getCompliantOrderDisplay('legacy_product', 'legacy_plan', [product], [plan]),
    {
      productName: 'AI会员',
      planName: 'AI会员套餐',
    },
  );
});
