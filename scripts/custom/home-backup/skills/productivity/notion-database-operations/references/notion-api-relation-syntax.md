# Notion API Relation Syntax Reference

## Single Property Relation (One-Way)
Creates a relation from source DB to target DB without automatic back-link.

```json
{
  "properties": {
    "Property Name": {
      "relation": {
        "database_id": "TARGET_DATABASE_ID",
        "type": "single_property",
        "single_property": {}
      }
    }
  }
}
```

**Required fields:**
- `database_id` - Target database ID
- `type` - Must be `"single_property"`
- `single_property` - Empty object `{}` (REQUIRED, not optional)

## Dual Property Relation (Bidirectional)
Creates a relation from source DB to target DB AND automatically creates the inverse relation on the target DB.

```json
{
  "properties": {
    "Property Name": {
      "relation": {
        "database_id": "TARGET_DATABASE_ID",
        "type": "dual_property",
        "dual_property": {}
      }
    }
  }
}
```

**Required fields:**
- `database_id` - Target database ID
- `type` - Must be `"dual_property"`
- `dual_property` - Empty object `{}` (REQUIRED, not optional)

**Result:** Target DB gets a new relation property named `"Related to [Source DB Name] (Property Name)"` with `type: "dual_property"` pointing back.

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `single_property should be defined, instead was undefined` | Missing `single_property: {}` | Add empty object |
| `dual_property should be defined, instead was undefined` | Missing `dual_property: {}` | Add empty object |
| `invalid_request_url` (MCP wrapper) | MCP tool bug | Use direct REST API `PATCH /v1/databases/{id}` |

## Endpoint
```
PATCH https://api.notion.com/v1/databases/{SOURCE_DATABASE_ID}
Headers:
  Authorization: Bearer {NOTION_TOKEN}
  Notion-Version: 2022-06-28
  Content-Type: application/json
```