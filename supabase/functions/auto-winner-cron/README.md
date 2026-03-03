## auto-winner-cron

Edge function that selects a winner for challenges once the vote period is over.

### Usage
POST to:
`/functions/v1/auto-winner-cron`

Optional JSON body:
```json
{ "hours": 24, "max_challenges": 30 }
```

If you set `CRON_SECRET` in function env vars, include header:
`x-cron-secret: <your-secret>`

### Suggested scheduling
Run every 10-30 minutes using Supabase Scheduled Functions or an external cron.
