# HypeOn Copilot Frontend

AI-powered e-commerce intelligence platform frontend built with Next.js.

## Quick Start

### Installation

```bash
npm install
```

### Environment Variables

Create `.env.local` for development:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.copilot.hypeon.ai

# Development only (DO NOT USE IN PRODUCTION)
NEXT_PUBLIC_DISABLE_AUTH=true
NEXT_PUBLIC_JWT_TOKEN=your-dev-token
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Production Deployment

### Required Environment Variables

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.hypeon.ai
```

### Optional Configuration

```bash
# Enable production logging
NEXT_PUBLIC_ENABLE_LOGS=true

# Performance monitoring
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=true

# Error tracking
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true

# Analytics (if needed)
NEXT_PUBLIC_ENABLE_ANALYTICS=true

# Rate limiting (enabled by default)
NEXT_PUBLIC_ENABLE_RATE_LIMITING=true

# API configuration
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_API_RETRY_ATTEMPTS=3
NEXT_PUBLIC_API_RETRY_DELAY=1000

# Performance settings
NEXT_PUBLIC_DEBOUNCE_MS=300
NEXT_PUBLIC_THROTTLE_MS=1000
NEXT_PUBLIC_MAX_CONCURRENT_REQUESTS=5

# Cache TTLs
NEXT_PUBLIC_SESSION_CACHE_TTL=300000
NEXT_PUBLIC_USER_INFO_CACHE_TTL=600000
```

## Production Features

### ✅ Authentication
- **Always required in production**
- Token validation and expiration checking
- Automatic redirect to parent app if unauthenticated
- Development mode can bypass with `NEXT_PUBLIC_DISABLE_AUTH=true`

### ✅ Security
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Content Security Policy configured
- Rate limiting enabled
- Error boundaries prevent information leakage

### ✅ Performance
- Request compression enabled
- Package optimization configured
- Rate limiting: Chat (5/min), Sessions (20/min), General (30/min)
- Debouncing/throttling utilities
- Performance monitoring built-in

### ✅ Error Handling
- Global error boundary catches React errors
- Structured error logging
- User-friendly error messages
- Ready for error tracking integration (Sentry, LogRocket)

### ✅ Logging & Monitoring
- Structured logging with different levels
- API request/response timing
- Production logging configurable
- Ready for APM integration

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["npm", "start"]
```

## Monitoring Integration

### Error Tracking (Sentry)

```typescript
// In src/lib/logger.ts, uncomment and configure:
if (window.sentry && logEntry.level === 'error') {
  window.sentry.captureException(new Error(logEntry.message), {
    extra: logEntry
  });
}
```

### LogRocket

```typescript
// Add in src/app/layout.tsx
import LogRocket from 'logrocket';
if (process.env.NODE_ENV === 'production') {
  LogRocket.init('your-app-id');
}
```

## Scaling for Large User Base

1. **Caching**: Session data (5 min TTL), User info (10 min TTL)
2. **Rate Limiting**: Client-side limits prevent abuse
3. **CDN**: Serve static assets via CDN
4. **Request Batching**: Use debouncing for search/autocomplete
5. **Database**: Backend should implement connection pooling and read replicas

## Troubleshooting

### Authentication Issues
- Check token expiration
- Verify `NEXT_PUBLIC_DISABLE_AUTH` is not set in production
- Ensure parent app integration is working

### Rate Limiting Issues
- Check rate limit settings
- Verify user isn't hitting limits too quickly

### Performance Issues
- Check API response times in logs
- Monitor error rates
- Review browser console for client-side issues

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## License

Private - HypeOn Copilot
