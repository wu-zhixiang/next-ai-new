# reset-database 使用说明

`reset-database` 用于清理测试数据，并重新初始化会员套餐。这个云函数包含删除操作，只建议在测试环境或明确要清理测试数据时使用。

## 上传云函数

需要先上传：

```text
reset-database
```

如果套餐初始化逻辑也有变更，建议同时上传：

```text
seed-database
```

## 安全确认

所有执行都必须携带确认字段：

```json
{
  "confirm": "RESET_TEST_DATABASE"
}
```

不传或传错会直接报错，不会清理数据。

## 查看影响范围

正式清理前，先执行 dry run：

```json
{
  "confirm": "RESET_TEST_DATABASE",
  "dryRun": true
}
```

返回结果会包含即将清理的集合和当前数量。

## 默认清理

执行：

```json
{
  "confirm": "RESET_TEST_DATABASE"
}
```

默认清理以下集合：

```text
memberships
orders
deliveries
invite_relations
points_ledger
email_verification_codes
reminder_logs
audit_logs
```

同时会：

- 把所有用户的 `pointsBalance` 重置为 `0`
- 重新初始化 `member_plans` 的 GO / PLUS 套餐
- 保留 `users` 用户数据

## 连用户一起清理

如果测试用户也要删除：

```json
{
  "confirm": "RESET_TEST_DATABASE",
  "includeUsers": true
}
```

注意：传 `includeUsers: true` 后会删除 `users` 集合里的用户记录，因此不会再单独重置用户积分。

## 清空套餐表后重建

如果想先清空 `member_plans` 再重建 GO / PLUS：

```json
{
  "confirm": "RESET_TEST_DATABASE",
  "includeMemberPlans": true
}
```

## 同时清用户和套餐

```json
{
  "confirm": "RESET_TEST_DATABASE",
  "includeUsers": true,
  "includeMemberPlans": true
}
```

## 返回字段

成功时返回类似：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "removed": {
      "memberships": 0,
      "orders": 3,
      "deliveries": 0,
      "invite_relations": 1,
      "points_ledger": 2,
      "email_verification_codes": 0,
      "reminder_logs": 0,
      "audit_logs": 0
    },
    "resetUserPointsCount": 2,
    "seededPlans": 2,
    "includeUsers": false,
    "includeMemberPlans": false
  }
}
```

字段说明：

- `removed`：每个集合删除的记录数。
- `resetUserPointsCount`：被重置积分余额的用户数。
- `seededPlans`：重新初始化的套餐数量。
- `includeUsers`：本次是否删除用户。
- `includeMemberPlans`：本次是否先清空套餐表。
