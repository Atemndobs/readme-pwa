# ReadMe - Text to Speech PWA

A Progressive Web App that converts text to speech with advanced audio management capabilities.

## Features

- Text-to-Speech Conversion
  - Smart Text Segmentation
  - Bulk Text Processing
  - Web Page Content Extraction
  - Multiple Voice Options

- Audio Management
  - Mini Player with Playback Controls
  - Audio Queue System
  - Voice Model Selection
  - Platform-Specific Optimizations (iOS Support)

- User Interface
  - Dark/Light Mode Support
  - Responsive Design
  - Accessible Components
  - Progress Indicators
  - Error Handling

- Data Management
  - Offline Audio Storage
  - State Persistence
  - Queue Management
  - Settings Retention

## Tech Stack

- **Frontend Framework**
  - Next.js (React)
  - TypeScript
  - ShadCN UI (Radix UI primitives)
  - Tailwind CSS

- **State Management**
  - Zustand with Persistence
  - Audio Queue Management
  - Settings Store

- **Storage**
  - IndexedDB for Audio Data
  - Local Storage for Preferences

- **Monitoring**
  - Sentry Error Tracking
  - Performance Monitoring
  - Session Replay

- **Core Libraries**
  - Mozilla Readability
  - Web Audio API
  - IndexedDB API

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/              # Next.js App Router and API Routes
│   ├── api/         # API endpoints including TTS
│   └── page.tsx     # Main application page
├── components/       # React Components
│   ├── ui/          # Base UI components
│   └── audio-player/ # Audio playback components
├── lib/             # Core Logic
│   ├── api/         # API integrations
│   ├── store/       # Zustand stores
│   └── utils/       # Utility functions
└── types/           # TypeScript definitions
```

## Key Features

### Text Processing
- Smart text segmentation for optimal TTS processing
- Web page content extraction
- Support for various text inputs

### Audio System
- Efficient audio queue management
- Platform-specific optimizations
- Seamless playback experience
- Progress tracking

### Storage
- Efficient audio data storage using IndexedDB
- State persistence with Zustand
- Offline capability

### User Experience
- Responsive design for all devices
- Dark/Light mode support
- Accessible interface
- Error handling and recovery

## Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Sentry.io account (for error monitoring)

### Environment Setup
1. Copy `.env.example` to `.env.local`
2. Configure the following environment variables:
   ```
   NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
   SENTRY_AUTH_TOKEN=your-sentry-auth-token
   SENTRY_ORG=your-sentry-org
   SENTRY_PROJECT=your-sentry-project
   ```

### Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Type checking
npm run typecheck
```

### Error Monitoring
The application uses Sentry for error tracking and monitoring:
- Automatic error capturing
- Performance monitoring
- Session replay for debugging
- Custom error context and breadcrumbs

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
