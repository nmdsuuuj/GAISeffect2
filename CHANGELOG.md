# Groove Sampler - Changelog

This document tracks the major changes, feature implementations, and requirement adjustments throughout the development of the Groove Sampler application.

## Version 0.6.0 - The Live Performance Update

This update focuses on improving the workflow for live performance and continuous music creation by enabling seamless project loading without interrupting playback.

### Implemented Features
- **Seamless Project Loading**:
  - **Core Change**: Projects can now be loaded from the `PROJECT` tab while the sequencer is playing. The application will no longer stop playback.
  - **Functionality**: When a new project is loaded during playback, the sequencer immediately syncs to the new project's state and continues playing, providing a seamless transition.
  - **Use Case**: This is critical for live performance, allowing for smooth transitions between different songs or sections stored as separate projects.
- **Clean Audio Transitions**:
  - A new audio "flush" function has been implemented. When a project is loaded during playback, all currently playing and scheduled sounds from the old project are instantly silenced to prevent audio clashes and ensure a clean switch.
- **Bug Fixes**:
  - **Project/Kit Data Handling**: Resolved critical type errors related to saving and loading audio data (Samples, Kits, Presets) to and from the database. This improves the reliability of all project management features.

## Known Issues

- **Preset Drum Kits (`Load Kit`)**: This feature has been removed due to persistent and critical errors with audio data decoding (`atob` and `Unable to decode audio data`). The feature will be re-evaluated for a future release with a more robust implementation.
- **MIDI Learn Feature**: The MIDI Learn functionality is currently non-functional due to persistent issues with state management and component re-rendering, preventing reliable MIDI mapping. The feature has been removed from the current build and will be re-evaluated and re-engineered in a future update.
- **Pattern Copy/Paste**: The functionality to copy and paste a pattern between different banks (e.g., from Bank A to Bank B) is currently unreliable. While pattern parameters like length and division may be copied, the core step sequence data (note triggers, pitch, velocity) is often lost in the process. This is a high-priority bug that will be addressed in a future refactoring of the state management for patterns.

## Version 0.5.0 - The Microtonal & World Scale Update

This major update transforms the Groove Sampler from a standard 12-tone sequencer into a unique and powerful tool for exploring and composing with world music scales.

### Implemented Features
- **Microtonal Engine Implementation**:
  - **Core Change**: Re-engineered the core audio and sequencer engine to use a **cents-based `detune` system** instead of MIDI note numbers. This allows for the authentic reproduction of scales that do not conform to 12-tone equal temperament.
- **Massively Expanded Scale Database**:
  - Added over 40 authentic world music scales to the database, defined with their proper microtonal intervals in cents.
  - Includes a wide variety of scales from Arabic (Maqamat), Indian (Ragas), Indonesian (Pelog/Slendro), Japanese, African, and ancient Greek traditions.
- **New "Dynamic Keyboard" UI**:
  - Replaced the static piano keyboard in `REC` mode with a dynamic UI that **only displays the notes of the selected scale**. This eliminates "unused" keys and provides a highly intuitive way to compose within a specific scale.
- **Non-Destructive Playback Scale Remapping**:
  - Introduced a powerful new **"Playback Scale"** feature in `PART` mode.
  - This allows users to apply a different scale to an *entire existing pattern* during playback without altering the original recorded notes.
  - The sequencer remaps the notes to the closest tones in the selected playback scale in real-time. Setting the scale to `"Thru"` instantly reverts to the original performance.
- **Critical Bug Fixes**:
  - Resolved a persistent bug where the keyboard UI would render incorrectly (e.g., as thin lines), especially for scales with fewer or more than 12 notes. The new dynamic keyboard with a flexbox layout completely solves this issue.
  - Fixed a logic error in the sequencer that prevented microtonal parameter locks from being played back correctly.

---

## Version 0.4.0 (Current) - Mobile UX & Fader Overhaul

### Implemented Features & Fixes
- **Mobile-First Fader Interaction**:
  - **FIX**: Re-engineered the fader double-tap functionality to work reliably on both desktop (double-click) and mobile (double-tap). The previous implementation was not compatible with touch events.
  - **UX**: Further increased the size of fader tracks and thumbs to improve touch accuracy on mobile devices, addressing jerky input issues.
- **Project Documentation**:
  - Added this `CHANGELOG.md` file to track project progress and specification changes as requested.

---

## Version 0.3.0 - Advanced Features & UI Refinement

### Implemented Features
- **Master Dynamics FX**: Added a master compressor/dynamics processor on the master channel with a dedicated "FX" view in the Mixer tab for detailed parameter control.
- **Sample Filters**: Implemented per-sample High-Pass (HP) and Low-Pass (LP) filters.
- **Sample View UI Overhaul**:
  - Introduced a "Sampling Mode" and "Parameter Mode" to show context-relevant controls.
  - Redesigned the layout to be more compact, moving the sample name display and organizing buttons into a single row.
- **Recording Workflow Improvements**:
  - **FIX**: Implemented automatic normalization for recorded samples to ensure optimal volume levels.
  - **FIX**: Improved the recording threshold sensitivity by adjusting the default value and fader curve to prevent recording delays.
- **Fader Performance**:
  - **FIX**: Optimized all `Fader` components using `requestAnimationFrame` to ensure smooth UI updates and eliminate stuttering/jank.

---

## Version 0.2.0 - BPM & UI Polish

### Implemented Features
- **Advanced BPM Control**:
  - Implemented a TAP tempo button.
  - Added a long-press feature on the TAP button to switch between Fader, Ratio, and Numeric input modes.
  - Expanded the Ratio mode with more multiplier options (e.g., x1.25, x1.5, x2).
- **UI/UX Enhancements**:
  - Redesigned the Transport area to integrate the BPM display into the TAP button, saving space.
  - Color-coded the `ARM` button in Sample View to be red, and adjusted other button colors for better visual hierarchy.
  - Redesigned all faders to be thicker and display their label/value information internally for a cleaner look.
  - Color-coded UI elements to distinguish between "Sample" related controls (pastel blue) and "Sequence/Pattern" related controls (pink).
  - Changed Sequencer Part B step color to be pink-based for better consistency with Part A.

---

## Version 0.1.0 - Core Functionality

### Implemented Features
- **Sequencer & Recorder Sync**: The master recorder is now armed first, and recording starts in sync with the sequencer's play button.
- **File Naming Convention**: Recorded master audio files are now named with a timestamp and the current BPM (e.g., `GrvSmp_YYMMDD_HHMMSS_B120.wav`).
- **Core Engine**:
  - Established the base audio engine with sample playback.
  - Implemented the step sequencer with a groove engine.
  - Set up basic project saving/loading functionality.
