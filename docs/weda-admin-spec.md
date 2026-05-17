# WeDa 后台页面定义草案

## 套餐管理

- 列表字段：`productCode`、`productName`、`planCode`、`planName`、`price`、`durationDays`、`status`、`sort`
- 操作：新增、上下架、排序、编辑价格和文案

## 订单查看

- 列表字段：`orderNo`、`userId`、`productCode`、`planCode`、`amount`、`payStatus`、`transactionId`、`paidAt`
- 操作：筛选、查看详情、导出

## 会员查看

- 列表字段：`userId`、`productCode`、`productName`、`planName`、`status`、`startAt`、`endAt`、`remainDays`
- 操作：筛选、人工续时、失效处理

## 交付信息维护

- 列表字段：`userId`、`mobile`、`emailAccount`、`chatgptAccount`、`expireAt`、`expireTag`
- 操作：录入、修改、批量导入、临期筛选
