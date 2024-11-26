# ReadMe - Text to Speech PWA

A Progressive Web App that converts text to speech with advanced audio management capabilities.

## Features

- Text-to-Speech Conversion
  - Smart Text Selection
  - Bulk Text Processing
  - Web Page Parsing
- Audio Features
  - Mini Player with playback controls
  - Audio Queue Management
  - Voice Customization
- User Interface
  - Dark Mode Support
  - Floating Window
  - Responsive Design
- Settings Persistence
  - User preferences stored in PocketBase

## Tech Stack

- Frontend: Next.js (React)
- UI Components: ShadCN UI (Radix UI primitives)
- Styling: Tailwind CSS
- Database: PocketBase
- State Management: Zustand
- Text Processing: Readability.js
- TTS API: voice.cloud.atemkeng.de

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

## Development

The project structure follows Next.js 13+ conventions with the App Router:

```
src/
├── app/                 # App router pages and layouts
├── components/          # Reusable UI components
├── lib/                 # Utility functions and configurations
└── styles/             # Global styles and Tailwind config
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
