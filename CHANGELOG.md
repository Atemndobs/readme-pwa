# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Commit: Enhance audio playback controls
- **Date**: 2024-12-10
- **Author**: Atemndobs

#### Summary of Changes:
1. **MiniPlayer Component**:
   - **Modification**: Implemented toggle play/pause functionality.
   - **Details**:
     - Updated the button to call `togglePlayPause` which checks the current playing state and toggles between play and pause.
     - Conditional rendering of play and pause icons based on the `isPlaying` state.

2. **ProgressBar Component**:
   - **Modification**: Added `onSeek` prop to enable seeking through audio segments.
   - **Details**:
     - The `onSeek` function is called in the `handleSeek` method, allowing the user to seek to different segments of audio.
     - Integrated progress calculation and display for the current audio segment.

3. **Audio Queue Management**:
   - **Modification**: Updated logic to support the new seeking functionality.
   - **Details**:
     - Adjusted how audio segments are managed, ensuring that the seeking functionality works seamlessly with the audio playback controls.

#### Files Responsible for Managing and Manipulating Audio:
- **`src/components/audio-player/mini-player.tsx`**:
  - Handles the user interface for audio playback controls, including play/pause functionality.
  
- **`src/components/audio-player/progress-bar.tsx`**:
  - Manages the display of audio progress and allows users to seek through segments of audio.

- **`src/lib/store/audio-queue.ts`**:
  - Manages the audio queue, including loading, playing, and seeking through audio segments.

## [0.1.2] - 2024-12-10

### Added
- Implemented Tone.js for audio management
- Added ToneManager singleton for centralized audio control
- Introduced autoplay functionality with state handling

### Changed
- Enhanced audio queue to ensure only one audio plays at a time
- Improved error handling and logging for audio playback
- Updated cleanup logic for audio resources when player is closed

### Fixed
- Resolved issues with audio not stopping when the player is closed

## [0.1.1] - 2024-01-09

### Fixed
- Fixed TypeScript error in MobileNav component by properly implementing hasAudioContent check
- Removed conditional rendering of VoiceSelector component
- Updated debug logging in MobileNav
- Cleaned up unused text-input.tsx component

### Changed
- Modified page.tsx and voice-selector.tsx components

## [0.1.0] - 2024-01-09

### Added
- Initial release
- Text-to-speech functionality
- Voice selection
- Audio queue management
- Storage management
- Mobile-friendly navigation
