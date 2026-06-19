import { collection } from '../shared/db';
import { ok } from '../shared/utils';
import type { ProductTypeRecord, ProductTypeView } from '../shared/types';

function toProductTypeView(record: ProductTypeRecord): ProductTypeView {
  return {
    productCode: record.productCode,
    productName: record.productName,
    label: record.label,
    tag: record.tag,
    avatarUrl: record.avatarUrl,
    available: record.available,
    description: record.description,
    introHighlights: record.introHighlights ?? [],
    complianceDisplay: record.complianceDisplay,
  };
}

export async function main() {
  const result = await collection('productTypes')
    .where({ status: 'on' })
    .orderBy('sort', 'asc')
    .get();
  const productTypes = (result.data as ProductTypeRecord[]).map(toProductTypeView);
  return ok({ productTypes });
}
