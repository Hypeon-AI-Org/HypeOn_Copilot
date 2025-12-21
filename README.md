# HypeOn Copilot Frontend

Frontend application for HypeOn Copilot - AI-powered e-commerce intelligence platform.

## Features

- 🤖 **AI Chat Interface** - Interactive chat with multi-stage LLM pipeline
- 💬 **Session Management** - Persistent conversation history
- 🔐 **Authentication** - JWT token-based authentication
- 📊 **Structured Responses** - Product and keyword analysis with tables
- 🎨 **Modern UI** - Clean, responsive design

## Tech Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React 19** - UI library

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your backend URL
```

### Environment Variables

Create `.env.local`:

```env
# Backend API Base URL (required)
NEXT_PUBLIC_API_BASE_URL=https://api.copilot.hypeon.ai

# JWT Token (optional - for session management)
# NEXT_PUBLIC_JWT_TOKEN=your_jwt_token_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/              # Next.js app router pages
│   ├── chat/         # Chat interface
│   └── api/          # API routes
├── components/       # React components
│   └── chatbot/      # Chat UI components
├── hooks/            # React hooks
│   └── useHypeonChat.ts
├── lib/              # Utilities
│   ├── chatService.ts # Backend API client
│   └── auth.ts       # Authentication utilities
└── styles/           # CSS modules
```

## Backend Integration

This frontend integrates with the HypeOn Copilot Backend API. The app automatically detects authentication tokens from the parent app (app.hypeon.ai) via cookies or localStorage.

### Key Endpoints

- `POST /api/v1/chat` - Send chat messages
- `GET /api/v1/sessions` - List user sessions (requires auth)
- `GET /api/v1/sessions/{id}/messages` - Get session history (requires auth)

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

```bash
# Build the application
npm run build

# The output will be in .next/ directory
# Deploy according to your platform's Next.js instructions
```

### Environment Variables for Production

Make sure to set these in your deployment platform:

- `NEXT_PUBLIC_API_BASE_URL` - Your backend API URL
- `NEXT_PUBLIC_JWT_TOKEN` (optional) - For authenticated features

## Features

### Chat Interface

- Real-time chat with AI assistant
- Multi-stage LLM responses
- Structured data display (tables)
- Session persistence

### Session Management

- Create new conversations
- Load previous sessions
- Search chat history
- Rename/delete sessions

### Authentication

- JWT token support
- Optional authentication (chat works without token)
- Automatic token validation
- Graceful fallback for unauthenticated users

## Development

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting

### Testing

```bash
# Run linter
npm run lint
```

## Support

For issues or questions, check:
- Browser console for errors
- Network tab for API requests
- Backend logs for server-side issues
- See `FRONTEND_INTEGRATION.md` for detailed API documentation

## License

Private - HypeOn Copilot
