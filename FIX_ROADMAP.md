
# Emergency Fix Roadmap (Post-Restore)

This roadmap focuses strictly on stabilizing the application after restoring to the "Effects Introduction" state. No new features will be added.

## Phase 1: Stability & Safety (Completed)
- [x] **Fix Non-Finite Value Errors:** Implement robust type checking and safety wrappers (`safe()` and `setTarget()`) for all Web Audio API calls. This prevents the "Failed to execute 'setTargetAtTime'" crash.
- [x] **Secure Calculations:** Ensure frequency, delay time, and gain calculations never result in `NaN` or `Infinity`.

## Phase 2: Synth Audio Restoration (Completed)
- [x] **Verify Signal Flow:** Ensure the Synth VCA connects correctly through the new Bank Gain -> FX Chain -> Master path.
- [x] **Fix Envelope Triggers:** Ensure the VCA and Filter Envelopes are receiving valid start times and values.
- [x] **Verify Mute/Solo Logic:** Ensure the synth bank isn't accidentally muted by the new mixer logic.
- [x] **Fix Metallic Resonance:** Ensure standard filters apply cutoff/Q correctly and Comb feedback is killed when unused.

## Phase 3: Effector Functionality (Completed)
- [x] **Fix Parameter Mapping:** Ensure UI sliders in the Mixer view correctly map to the underlying audio nodes without error.
- [x] **Verify Bypass Logic:** Ensure effects pass audio cleanly when bypassed or when "Dry" mix is 100%.

## Phase 4: Synth Logic Restoration (Completed)
- [x] **Initialize Mod Sources:** Ensure Mod Wheel and Filter Env Amount have dedicated audio nodes in the graph.
- [x] **Reactive Parameter Updates:** Implement `useEffect` to listen to `state.synth` changes and update:
    - Oscillator Mix (Crossfade)
    - LFO 1 & 2 (Frequency calculation with BPM sync, Waveform type)
    - Filter Envelope Amount (Direct routing)
    - Mod Wheel Position
- [x] **Matrix Application:** Implement logic to traverse `synthModMatrix` and apply values to the corresponding `GainNodes`.

## Phase 5: Effector & Mastering (Next Step)
- [ ] **Restore Effect Algorithms:** Re-implement the DSP logic for Stutter, Glitch, Filter, and Reverb inside `useFxChain`. (Currently using basic placeholders or possibly broken logic).
- [ ] **Master Recorder:** Verify the master recording functionality captures the post-FX signal.
