# Notion API Rollup Functions Reference

## Function Parameter Format (Critical)

The `function` field MUST be a **plain string**, NOT a nested object.

```json
// CORRECT
"function": "sum"

// INCORRECT - causes 400 validation error
"function": {"function": "sum"}
```

## Complete Function List

| Function | Description | Compatible Property Types |
|----------|-------------|---------------------------|
| `count` | Count of related pages | Any |
| `count_values` | Count of non-empty values | Any |
| `sum` | Sum of numbers | Number |
| `average` | Average of numbers | Number |
| `median` | Median of numbers | Number |
| `min` | Minimum value | Number, Date |
| `max` | Maximum value | Number, Date |
| `range` | Max - min | Number, Date |
| `percent_empty` | Percentage of empty values | Any |
| `percent_not_empty` | Percentage of non-empty values | Any |
| `unique` | List of unique values | Select, Multi-select, Status, People |
| `show_unique` | Concatenated unique values | Select, Multi-select, Status, People |
| `earliest_date` | Earliest date | Date |
| `latest_date` | Latest date | Date |
| `empty` | Returns true if all empty | Any |
| `not_empty` | Returns true if any non-empty | Any |

## Common Use Cases for Study Abroad

| Rollup | Function | Source Relation | Target Property |
|--------|----------|-----------------|-----------------|
| Doc Progress | `percent_not_empty` | Documents | Status |
| Task Count | `count` | Tasks | Task (title) |
| Scholarship Total | `sum` | Scholarships | Amount |
| Next Deadline | `earliest_date` | Tasks | Due Date |
| Latest Activity | `latest_date` | Tasks | Due Date |

## Endpoint
```
PATCH https://api.notion.com/v1/databases/{SOURCE_DATABASE_ID}
Headers:
  Authorization: Bearer {NOTION_TOKEN}
  Notion-Version: 2022-06-28
  Content-Type: application/json
```

## Full Rollup Property Example

```json
{
  "properties": {
    "Scholarship Total": {
      "rollup": {
        "relation_property_name": "Scholarships",
        "rollup_property_name": "Amount",
        "function": "sum"
      }
    }
  }
}
```

**Required fields:**
- `relation_property_name` - Exact name of the relation property on THIS database
- `rollup_property_name` - Exact name of the property on the RELATED database
- `function` - Plain string from the list above