# CORS Configuration Fix Guide

## Current Issue

**Frontend:** `https://copilot.hypeon.ai`  
**Backend:** `https://api.copilot.hypeon.ai`  
**Error:** "Failed to fetch" - CORS policy blocking requests

## Backend CORS Configuration Required

The backend at `https://api.copilot.hypeon.ai` needs to allow requests from `https://copilot.hypeon.ai`.

### Required CORS Headers

The backend must include these headers in responses:

```
Access-Control-Allow-Origin: https://copilot.hypeon.ai
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-ID
Access-Control-Allow-Credentials: true
```

### Example Backend Configuration

#### Python (FastAPI)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://copilot.hypeon.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Node.js (Express)
```javascript
const cors = require('cors');

app.use(cors({
  origin: 'https://copilot.hypeon.ai',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
}));
```

#### Python (Flask)
```python
from flask_cors import CORS

CORS(app, 
     origins=["https://copilot.hypeon.ai"],
     supports_credentials=True,
     methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
     allow_headers=["Authorization", "Content-Type", "X-Request-ID"])
```

### For Development (Multiple Origins)

If you need to support multiple origins (dev + production):

```python
# FastAPI example
allowed_origins = [
    "https://copilot.hypeon.ai",
    "http://localhost:3000",  # Local dev
    "http://localhost:8080",  # Local backend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Testing CORS

After configuring CORS, test with:

```bash
# Test OPTIONS preflight
curl -X OPTIONS https://api.copilot.hypeon.ai/health \
  -H "Origin: https://copilot.hypeon.ai" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Should return:
# Access-Control-Allow-Origin: https://copilot.hypeon.ai
# Access-Control-Allow-Methods: GET, POST, ...
```

## Quick Fix Checklist

- [ ] Backend CORS middleware configured
- [ ] `Access-Control-Allow-Origin` includes `https://copilot.hypeon.ai`
- [ ] `Access-Control-Allow-Methods` includes all needed methods
- [ ] `Access-Control-Allow-Headers` includes `Authorization`
- [ ] `Access-Control-Allow-Credentials: true` set (if using cookies)
- [ ] OPTIONS requests handled (preflight)
- [ ] Test with curl/browser dev tools

## Verification

After fixing CORS, the frontend should be able to:
1. ✅ Make GET requests to `/api/v1/sessions`
2. ✅ Make POST requests to `/api/v1/chat`
3. ✅ Make PATCH requests to `/api/v1/sessions/{id}`
4. ✅ Make DELETE requests to `/api/v1/sessions/{id}`

## Common Issues

1. **Wildcard origin with credentials**: Cannot use `*` with `credentials: true`
2. **Missing OPTIONS handler**: Preflight requests must return 200 OK
3. **Header case sensitivity**: Headers are case-insensitive but check spelling
4. **Multiple origins**: Use array/list, not wildcard

## Need Help?

If CORS is still not working after configuration:
1. Check browser console for specific CORS error
2. Check Network tab for preflight (OPTIONS) request
3. Verify backend logs show the requests
4. Test with curl to isolate frontend vs backend issue

