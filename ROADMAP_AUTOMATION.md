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
*   [✔] **Recording Mode:** Implemented a switch to select between `FROM START` (quantized to bar start) and `PUNCH IN` (record from current position) modes.

## Phase 3: Automation Playback (Completed)
This phase makes the recorded data drive the effect parameters.

*   [✔] **Playback Logic:** The automation engine (`useAutomationEngine`) continuously reads from the automation data array based on its current playback position. It smoothly interpolates between recorded points for fluid playback.
*   [✔] **Parameter Modulation:** The engine dispatches `UPDATE_FX_XY` actions with the interpolated automation data, driving the puck on the XY Pad and modulating the mapped effect parameters. Playback occurs only when the user is *not* touching the pad.
*   [✔] **Visual Feedback (Playback):**
    *   [✔] The puck on the XY Pad now moves according to the automation data during playback.
    *   [✔] The Bar Pads now light up sequentially to indicate the current playback bar.

## Phase 4: Bar Pad Interactivity (Completed)
This phase implements the advanced, performance-focused controls using the Bar Pads.

*   [✔] **Instant Cueing (Tap):** Implemented logic for tapping a Bar Pad to instantly jump the automation sequencer's playback head to the start of that bar.
*   [✔] **Swipe Detection:** Added a dedicated `BarPad` component with swipe gesture (up/down) detection.
*   [✔] **Single-Bar Looping (Swipe Up):** On a swipe-up gesture, the `loopBar` property is set in the state, and the automation engine now loops playback within that bar.
*   [✔] **Loop Cancellation (Swipe Down):** On a swipe-down gesture, `loopBar` is set to `null`, causing the sequencer to resume its normal 8-bar loop.
*   [✔] **Visual Feedback (Looping):** The currently looping Bar Pad now has a distinct, pulsing pink style to indicate that a loop is active.
*   [✔] **Visual Feedback (Automation Data):** The Bar Pads now use a distinct style to indicate which bars contain recorded automation data.

## Phase 5: Snapshot Integration (In Progress)
This final phase ensures that all the new automation data is correctly saved and loaded with the snapshot system.

*   [✔] **Slot Snapshots:** Ensure that saving a Slot Snapshot (`SAVE_FX_SNAPSHOT`) correctly captures the entire `automation` object (including the `data` array and `loopBar` state) for both XY Pads.
*   [✔] **Global Snapshots:** Verify that Global Snapshots correctly save and restore the state of all automation across all four slots.
*   [✔] **Loading Logic:** Ensure that loading a snapshot correctly restores the automation data and that the playback engine immediately reflects the newly loaded state.

## Phase 6: Future Enhancements
*   [ ] **Fader Automation:** Extend the automation system to allow recording and playback of Fader/Knob movements, not just XY Pads. This will require a more generalized data structure for automation lanes.
*   [ ] **Automation Editing:** Introduce a UI to visually edit recorded automation data (e.g., drawing curves, moving points).
