# Roadmap: Performance FX Automation System

This document outlines the specific implementation plan for the advanced, performance-oriented automation system for the FX slots.

## Phase 1: Foundation & Core Logic (Completed)
This phase established the essential groundwork based on initial requirements.

*   [✔] **Detailed Specification:** All core concepts (Touch-to-Record, Release-to-Hold, 8-Bar Loop, Bar Pad Controls) have been documented in `REQUIREMENTS_FX.md`.
*   [✔] **Immediate Parameter Response:** The underlying audio engine (`useFxChain.ts`) has been refactored to ensure all parameter changes are reflected in the audio instantly, making effects feel responsive and "playable".
*   [✔] **Automatic Effect Engagement:** The UI logic has been implemented so that touching any XY Pad or Bar Pad automatically activates the corresponding effect slot if it's currently bypassed.
*   [✔] **UI Layout:** The main FX view (`MixerView.tsx`) has been updated to display two XY Pads per effect and has a dedicated area for the 8 Bar Pads.

## Phase 2: Automation Data Recording (Completed)
This phase focuses on capturing user input from the XY Pads and storing it as automation data.

*   [✔] **State Management:** Implemented actions and reducer logic to manage the `recording` flag for each XY pad's automation state.
*   [✔] **Automation Sequencer (Clock):** Created a dedicated, continuous 8-bar timer (`useAutomationEngine`) synced to the global BPM, providing the timecode for recording and playback.
*   [✔] **Data Capture:** On every XY Pad change event during recording, the `{x, y}` coordinates and the current `position` from the automation clock are captured and stored in the state.
*   [✔] **Visual Feedback (Recording):** Implemented a glowing, pulsing red border on the active XY Pad to provide clear visual feedback that recording is active.

## Phase 3: Automation Playback (Completed)
This phase makes the recorded data drive the effect parameters.

*   [✔] **Playback Logic:** The automation engine (`useAutomationEngine`) continuously reads from the automation data array based on its current playback position. It smoothly interpolates between recorded points for fluid playback.
*   [✔] **Parameter Modulation:** The engine dispatches `UPDATE_FX_XY` actions with the interpolated automation data, driving the puck on the XY Pad and modulating the mapped effect parameters. Playback occurs only when the user is *not* touching the pad.
*   [✔] **Visual Feedback (Playback):**
    *   [✔] The puck on the XY Pad now moves according to the automation data during playback.
    *   [✔] The Bar Pads now light up sequentially to indicate the current playback bar.

## Phase 4: Bar Pad Interactivity
This phase implements the advanced, performance-focused controls using the Bar Pads.

*   [ ] **Instant Cueing (Tap):** Implement the logic for tapping a Bar Pad to instantly jump the automation sequencer's playback head to the start of that bar.
*   [ ] **Swipe Detection:** Add swipe gesture (up/down) detection to the Bar Pad components.
*   [ ] **Single-Bar Looping (Swipe Up):** On a swipe-up gesture, set the `loopBar` property in the `FXAutomation` state. The automation sequencer must honor this property and loop its playback within the specified bar.
*   [ ] **Loop Cancellation (Swipe Down):** On a swipe-down gesture, set `loopBar` back to `null`, causing the sequencer to resume its normal 8-bar loop.
*   [ ] **Visual Feedback (Looping):** The currently looping Bar Pad should have a distinct, persistent visual style (e.g., a pulsing glow or a different color) to indicate that a loop is active.

## Phase 5: Snapshot Integration
This final phase ensures that all the new automation data is correctly saved and loaded with the snapshot system.

*   [ ] **Slot Snapshots:** Ensure that saving a Slot Snapshot (`SAVE_FX_SNAPSHOT`) correctly captures the entire `automation` object (including the `data` array and `loopBar` state) for both XY Pads.
*   [ ] **Global Snapshots:** Verify that Global Snapshots correctly save and restore the state of all automation across all four slots.
*   [ ] **Loading Logic:** Ensure that loading a snapshot correctly restores the automation data and that the playback engine immediately reflects the newly loaded state.