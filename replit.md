# AI Studio - Google Gemini Multi-Modal Interface

## Project Overview

A React + Vite application that provides a multi-modal interface for interacting with Google Gemini AI models. Features chat, voice interaction, search grounding, maps integration, audio transcription, code generation, and more.

## Tech Stack

- **Frontend:** React 19, TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS 4
- **AI SDK:** @google/genai (Google Generative AI)
- **Editor:** Monaco Editor (for Coder mode)
- **Markdown:** react-markdown + remark-gfm
- **Animation:** Motion (Framer Motion)
- **Icons:** Lucide React
- **Package Manager:** npm

## Project Structure

```
src/
  App.tsx          - Main app component with mode routing
  main.tsx         - Application entry point
  types.ts         - Global TypeScript types
  index.css        - Global styles
  components/      - Reusable UI components (Sidebar, ChatInput, etc.)
  contexts/        - React Context providers (ThemeContext, SettingsContext)
  hooks/           - Custom hooks (useWakeWord for voice activation)
  modes/           - Distinct AI modes (Jarvis, Coder, Voice, SearchMaps, etc.)
  services/        - External API integrations (gemini.ts)
  utils/           - Utility functions (logger.ts)
```

## AI Modes

- `jarvis` - Main conversational AI mode
- `omni-chat` - Clean, minimal chat page to talk with Omni AI
- `liquid-chat` - Animated themed chat UI
- `chat-pro` / `chat-fast` - Chat variants with conversation history
- `voice-live` - Live voice interaction
- `search-maps` - Search and maps grounding
- `transcription` - Audio transcription
- `tts` - Text-to-speech
- `coder` - Code generation with Monaco editor

## Environment Variables

- `GEMINI_API_KEY` - Required for all Gemini AI API calls
- `APP_URL` - URL where the app is hosted (optional)
- `OPENROUTER_API_KEY` - For OpenRouter API calls (optional)

## Development

```bash
npm install
npm run dev       # Starts dev server on port 5000
npm run build     # Production build to dist/
npm run lint      # TypeScript type checking
```

## Configuration

- **Dev server:** Port 5000, host 0.0.0.0, all hosts allowed (Replit proxy)
- **Deployment:** Static site, build output in `dist/`
- **Workflow:** "Start application" runs `npm run dev`
