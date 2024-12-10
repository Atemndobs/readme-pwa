# Architecture Decision Document (ADD)

## Version
Current Version: 0.1.1 (Released: 2024-01-09)

## Purpose and Scope

ReadMe-TTS is a Progressive Web Application (PWA) designed to transform written content into high-quality, natural-sounding speech. The application serves users who prefer consuming content through audio, whether for accessibility needs, multitasking capabilities, or personal preference.

### Core Purpose
- Convert text content (articles, documents, web pages) into natural-sounding speech
- Provide an accessible, user-friendly interface for content consumption
- Enable offline capabilities for uninterrupted listening experience
- Support multiple voice options and playback customization

### Target Users
1. **Accessibility Users**
   - Individuals with visual impairments
   - Users with reading difficulties
   - People with learning preferences for audio content

2. **Multitaskers**
   - Professionals consuming content while performing other tasks
   - Commuters and travelers
   - Users engaging in physical activities

3. **Content Creators**
   - Writers checking content flow through audio
   - Content publishers providing audio alternatives
   - Educational content providers

### Key Features
1. **Content Processing**
   - Text input support
   - URL content extraction
   - Smart text segmentation

2. **Audio Generation**
   - High-quality text-to-speech conversion
   - Multiple voice options
   - Customizable speech parameters

3. **Playback Experience**
   - Seamless audio streaming
   - Offline playback support
   - Progress tracking and navigation

4. **Progressive Web App**
   - Cross-platform compatibility
   - Offline functionality
   - Installation capabilities

### Success Criteria
1. **Performance**
   - Fast initial content processing
   - Minimal latency in audio generation
   - Smooth playback experience

2. **Accessibility**
   - WCAG 2.1 compliance
   - Screen reader compatibility
   - Keyboard navigation support

3. **User Experience**
   - Intuitive interface
   - Reliable offline functionality
   - Consistent cross-platform behavior

## Overview
This document outlines the architectural decisions and design patterns implemented in the ReadMe PWA application. The application is built as a Progressive Web App using modern web technologies and follows best practices for performance, accessibility, and user experience.

### Core Features
1. **Text-to-Speech Conversion**
   - Smart Text Selection
   - Bulk Text Processing
   - Web Page Parsing

2. **Audio Management**
   - Mini Player with playback controls
   - Audio Queue Management
   - Voice Customization

3. **User Interface**
   - Dark Mode Support
   - Floating Window
   - Responsive Design

4. **Data Persistence**
   - IndexedDB for audio data storage
   - Local storage for user preferences
   - State management via Zustand

## Tech Stack

### Core Technologies
- **Next.js**: Server-side rendering and routing framework
- **TypeScript**: Static typing and enhanced developer experience
- **React**: UI component library
- **Tailwind CSS**: Utility-first CSS framework
- **ShadCN UI**: Component library built on Radix UI primitives
- **Zustand**: State management with persistence
- **Readability.js**: Content parsing

### Storage and State Management
- **IndexedDB**: Client-side audio data storage
  - Audio blob storage
  - Efficient data retrieval
  - Storage optimization
- **Zustand Store**:
  - Audio queue management
  - Playback state control
  - Settings persistence
  - Error handling

### Key Dependencies
- **@mozilla/readability**: Content parsing and readability enhancement
- **IndexedDB**: Client-side storage for audio data
- **next-themes**: Theme management
- **Radix UI**: Accessible component primitives

## Application Architecture

### 1. Directory Structure
```
src/
├── app/           # Next.js app router and page components
├── components/    # Reusable React components
├── hooks/         # Custom React hooks
├── lib/          # Core business logic and utilities
├── types/        # TypeScript type definitions
└── utils/        # Helper functions and utilities
```

### 2. Key Components

#### Text Processing and TTS
- **URL Content Fetching**: Implemented through `/api/fetch-url` endpoint
- **Text Segmentation**: Custom implementation in `lib/utils/text-segmentation`
- **TTS Service**: Integrated through `/api/tts` endpoint with retry mechanism
- **Error Handling**: Dedicated error classes for TTS and URL fetching

#### Audio System
The application implements a robust audio system with the following components:
- **Queue Management**: State management via `lib/store/audio-queue`
- **Platform Optimization**: iOS-specific audio handling in `lib/utils/ios-audio`
- **User Interface**: Mini player component with playback controls
- **Audio Processing**: 
  - Segment-based audio processing
  - Retry mechanism for failed TTS requests
  - Custom audio queue implementation

#### State Management and Storage
1. **State Management**
   - Zustand (v5.0.1) for application state
   - Persistent state with Zustand middleware
   - Audio queue state management
   - Settings and preferences state

2. **Storage Implementation**
   - IndexedDB for audio data storage
   - Browser's local storage for preferences
   - Audio blob storage and management

#### UI Components
- Built on Radix UI primitives for accessibility
- Themed using Tailwind CSS for consistent styling
- Responsive design for various screen sizes

### 3. Key Features
1. **Progressive Web App**
   - Offline capabilities
   - Installable on devices
   - Service worker for caching

2. **Content Processing**
   - Mozilla Readability for content parsing
   - Article text extraction and formatting
   - Text-to-speech conversion

3. **Audio Playback**
   - Queue management
   - Platform-specific optimizations
   - Background playback support

## Target Architecture Overview
ReadMe-TTS is designed as a Progressive Web App (PWA) for converting web content and text into high-quality speech output. The system aims to provide a seamless, customizable audio experience through three core functionalities:

### Text Extraction and Processing
- User input support for raw text and URLs
- Mozilla's Readability.js for clean content extraction
- Smart text segmentation for optimized processing

### Text-to-Speech Conversion
- External TTS service (http://45.94.111.107:6080/v1/audio/speech)
- Asynchronous processing with real-time streaming
- High-quality speech synthesis

### Audio Playback and Management
- Seamless audio segment integration
- Comprehensive playback controls
- Voice customization options
- Offline support for saved content

## Gap Analysis and Implementation Plan

### 1. Text Processing
**Current State:**
- Basic URL content fetching through local API
- Custom text segmentation implementation
- Limited content cleaning capabilities

**Gaps:**
- No Mozilla Readability.js integration
- Limited content extraction capabilities
- Basic text segmentation without optimization

**Implementation Plan:**
1. Integrate Mozilla Readability.js
   - Add as dependency
   - Implement content extraction service
   - Add content cleaning pipeline

2. Enhance Text Segmentation
   - Implement smart chunking algorithm
   - Add support for different content types
   - Optimize segment sizes for TTS processing

### 2. TTS Service
**Current Architecture:**
- Next.js API route (`/api/tts`) proxying requests to external TTS API (`http://45.94.111.107:6080/v1/audio/speech`)
- Voice model support in format: `voice-[language]-[region]-[name]-low`
- Binary audio response handling
- Basic error handling and retry logic
- Audio queue management with Zustand store

**Gaps:**
- Single request-response cycle per segment
- Limited feedback during conversion process
- Basic error handling for API failures
- Sequential processing of segments

**Implementation Plan:**
1. Enhanced Frontend Processing
   - Implement progressive segment loading
   - Add parallel segment processing (within browser limits)
   - Optimize segment size based on content type
   - Add intelligent segment prioritization

2. Improved User Experience
   - Add detailed progress tracking
   - Implement predictive loading
   - Enhance error feedback and recovery
   - Add conversion status indicators

3. Queue Management Optimization
   - Add sophisticated segment state management
   - Implement intelligent retry strategies
   - Enhance error recovery mechanisms
   - Add detailed progress reporting

4. Audio Processing Enhancements
   - Implement audio buffer management
   - Add cross-fade between segments
   - Optimize memory usage
   - Add adaptive quality control

**Technical Implementation Details:**

1. Enhanced API Integration
```typescript
interface TTSRequestConfig {
  retryStrategy: {
    maxAttempts: number;
    backoffFactor: number;
  };
  timeout: number;
  errorHandling: {
    retryableErrors: string[];
    fallbackBehavior: 'skip' | 'retry' | 'fail';
  };
}
```

2. Progress Tracking
```typescript
interface ConversionProgress {
  totalSegments: number;
  convertedSegments: number;
  bufferedSegments: number;
  estimatedTimeRemaining: number;
  currentSegmentProgress: number;
}
```

3. Queue Management
```typescript
interface QueueOptimization {
  preloadStrategy: 'eager' | 'lazy' | 'adaptive';
  bufferStrategy: {
    minBuffer: number;
    maxBuffer: number;
    clearThreshold: number;
  };
}
```

**Benefits:**
1. Improved User Experience
   - Better progress feedback
   - Smoother playback transitions
   - Enhanced error handling
   - Reduced loading interruptions

2. Resource Optimization
   - Efficient API usage
   - Better error recovery
   - Improved memory management
   - Optimized network requests

3. Enhanced Reliability
   - Robust error handling
   - Consistent playback experience
   - Better failure recovery
   - Detailed user feedback

### 3. Offline Capabilities
**Current State:**
- Basic IndexedDB implementation
- Limited offline support
- No background sync

**Gaps:**
- No Dexie.js integration
- Limited offline content management
- Missing service worker features

**Implementation Plan:**
1. Enhanced Storage Layer
   - Integrate Dexie.js
   - Implement robust offline storage
   - Add content syncing mechanism

2. PWA Enhancement
   - Implement service worker
   - Add background sync
   - Enable offline-first architecture

### 4. Audio Management
**Current State:**
- Basic audio queue system
- Platform-specific handling
- Limited playback controls

**Gaps:**
- Limited seamless playback
- Basic queue management
- Missing advanced controls

**Implementation Plan:**
1. Enhanced Audio Engine
   - Implement advanced queue management
   - Add seamless segment transitions
   - Improve platform compatibility

2. Playback Features
   - Add seeking capability
   - Implement speed control
   - Add playlist management

## Recent Changes (v0.1.1)

### Improvements
- Enhanced TypeScript implementation in MobileNav component
- Streamlined voice selection interface
- Improved debug logging
- Codebase cleanup and optimization

### Technical Debt Addressed
- Fixed TypeScript errors
- Removed unused components
- Improved component architecture
- Enhanced debugging capabilities

## Implementation Priorities

### Phase 1: Core Functionality
1. Mozilla Readability.js integration
2. External TTS service setup
3. Basic offline storage with IndexedDB

### Phase 2: Enhanced Features
1. Advanced audio management
2. Voice customization options
3. Service worker implementation

### Phase 3: Polish and Optimization
1. Seamless playback improvements
2. Background sync
3. Performance optimizations

## Timeline and Resources

### Estimated Timeline
- Phase 1: 4-6 weeks
- Phase 2: 4-6 weeks
- Phase 3: 2-4 weeks

### Resource Requirements
1. Development Team
   - Frontend Developer (Next.js, TypeScript)
   - Backend Developer (TTS service integration)
   - UX Designer (audio interface)

2. Infrastructure
   - TTS service setup
   - CDN for audio delivery
   - Storage solutions for offline content

## Design Decisions

### 1. Framework Choice
- **Next.js**: Chosen for its server-side rendering capabilities, optimized performance, and excellent developer experience
- **TypeScript**: Ensures type safety and improves maintainability

### 2. Component Architecture
- Atomic design principles
- Composition over inheritance
- Reusable component patterns

### 3. Styling Approach
- Tailwind CSS for utility-first styling
- Component-level styles for specific customizations
- Theme support for dark/light modes

## Challenges and Recommendations

### Current Challenges

1. **TTS Service Integration**
   - Current implementation uses local API endpoints
   - Potential for service scaling issues
   
   *Recommendation*: Consider implementing a distributed TTS service architecture

2. **Audio Processing**
   - Complex segment management
   - Platform-specific audio handling requirements
   
   *Recommendation*: Implement a unified audio processing layer

3. **Offline Support**
   - Complex state management for offline-first functionality
   - Storage limitations
   
   *Recommendation*: Implement smart caching strategies and clear storage policies

4. **Performance Optimization**
   - Large article processing overhead
   - Audio queue management
   
   *Recommendation*: 
   - Implement web workers for heavy processing
   - Add lazy loading for non-critical components
   - Optimize audio chunk size and loading strategies

5. **State Management Complexity**
   - Multiple contexts and stores
   
   *Recommendation*: Consider implementing a more robust state management solution like Zustand or Jotai

### Future Improvements

1. **Architecture Enhancements**
   - Implement module federation for better code splitting
   - Add comprehensive error boundaries
   - Enhance testing coverage

2. **Performance Optimizations**
   - Implement streaming SSR
   - Add prefetching strategies
   - Optimize asset loading

3. **Developer Experience**
   - Add comprehensive documentation
   - Implement stricter type checking
   - Add more development tools and debugging capabilities

## Conclusion
The ReadMe PWA demonstrates a well-structured architecture that prioritizes performance, accessibility, and user experience. The challenges identified can be addressed through the suggested improvements, leading to an even more robust and maintainable application.
