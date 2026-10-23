# Brevo templates

## AlgoRecall Weekly Recap

- Template id: **1** (transactional/SMTP, active, tag `weekly-recap`)
- Sender: id 1, `prasath1196@gmail.com` (display name set in Brevo account: "Multiple"; change to "AlgoRecall" in Brevo Senders if desired). Set `RECAP_SENDER_EMAIL=prasath1196@gmail.com`.
- Subject: `Your week in AlgoRecall: {{ params.reviews_week }} reviews, {{ params.current_streak }}-day streak 🔥`
- Endpoint: `POST https://api.brevo.com/v3/smtp/email` with header `api-key: $BREVO_API_KEY`
- Note: the template has no `{{ unsubscribe }}` link; opt-out is via AlgoRecall Settings -> Weekly recap. The focus box is wrapped in `{% if params.weakest_pattern %}` and hidden when empty.
- Note: Brevo free plan limit is 300 emails/day.

## Params

| Param | Type | Example | Notes |
|---|---|---|---|
| name | string | "Prasath" | display name, fall back to "there" |
| reviews_week | number | 23 | reviews in last 7 days |
| current_streak | number | 5 | days |
| retention_pct | number | 82 | 0..100 integer (retention_rate * 100); use 0 or "--" if null |
| reviews_delta_text | string | "+6 vs last week (17)" | pre-formatted |
| weakest_pattern | string | "Dynamic Programming" | empty string/omit hides focus box |
| weakest_retention_pct | number | 54 | 0..100 |
| due_count | number | 9 | due_today |
| day_counts | string | "Mon 3 · Tue 4 · Wed 0 · Thu 5 · Fri 2 · Sat 6 · Sun 3" | pre-formatted text |
| cta_url | string (URL) | "https://leetcode.com" | link for the button |

## Example request body

```json
{
  "templateId": 1,
  "to": [{ "email": "user@example.com", "name": "Prasath" }],
  "params": {
    "name": "Prasath",
    "reviews_week": 23,
    "current_streak": 5,
    "retention_pct": 82,
    "reviews_delta_text": "+6 vs last week (17)",
    "weakest_pattern": "Dynamic Programming",
    "weakest_retention_pct": 54,
    "due_count": 9,
    "day_counts": "Mon 3 · Tue 4 · Wed 0 · Thu 5 · Fri 2 · Sat 6 · Sun 3",
    "cta_url": "https://leetcode.com"
  }
}
```
