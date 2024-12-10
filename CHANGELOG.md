# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
