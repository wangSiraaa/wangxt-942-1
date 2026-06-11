# Trae Preflight

This folder is prepared for `wangxt-942-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18242
- API_PORT: 19242
- WEB_PORT: 20242
- DB_PORT: 21242
- REDIS_PORT: 22242

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
