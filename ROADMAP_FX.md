




# Roadmap: Performance FX Implementation

## Phase 1: Data Structures & State Management (Complete)
*   [x] Define TypeScript interfaces for FX modules, parameters, and snapshots.
*   [x] Define constants for Odd Time Divisions and default parameter values.
*   [x] Update `AppState` to include the new `performanceFx` slice.
*   [x] Create Reducer actions for updating params, reordering routing, and handling snapshots.

## Phase 2: Audio Engine Core & Routing (Complete)
*   [x] Create the `useFxChain` hook (or integrate into `useAudioEngine`).
*   [x] Implement the dynamic routing graph (Node A -> Node B -> Node C -> Node D).
*   [x] Implement a glitch-free re-routing mechanism.
*   [x] Implement the "Hard Bypass" logic for CPU saving.

## Phase 3: Effect Algorithms (Part 1) (Complete)
*   [x] **Filter:** Implement standard Biquad wrapper with LFO.
*   [x] **Glitch:** Implement Bitcrusher (WaveShaper/ScriptProcessor fallback if needed) and Sample Rate Reducer.
*   [x] **Stutter:** Implement a circular buffer recording/playback mechanism for real-time audio looping.

## Phase 4: Effect Algorithms (Part 2 - Reverb) (Complete)
*   [x] **Deep Reverb:** Design and implement a low-CPU reverb algorithm using a network of Delay and Allpass nodes (Schroeder/Moorer derivative) or a Feedback Delay Network (FDN).
*   [x] Tune reverb parameters for "infinite" wash capabilities without CPU spikes.

## Phase 5: UI Implementation (Complete)
*   [x] Create the `XYPad` component.
*   [x] Implement `UPDATE_FX_XY` action and reducer logic.
*   [x] Update `MixerView` with tabs for PERF FX.
*   [x] Implement Slot Selection and Effect Type switching UI.
*   [x] Implement the Routing UI (Simple up/down movers).
*   [x] Implement the "Instant Snapshot" grid UI (Slot & Global).
