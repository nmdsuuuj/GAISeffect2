# Performance FX System - Requirements Definition

## Overview
A low-CPU, high-impact multi-effect system designed specifically for live performance. It sits at the end of the signal chain (before the Master Compressor) and consists of 4 **Generic Modular Slots**. The system prioritizes "maniacal" real-time manipulation, instant snapshot recall, and rhythmic complexity using odd time divisions.

## Core Architecture

### 1. Modular Slots & Modules
*   **Structure:** The system is comprised of **4 Generic Slots** (Slot 1, Slot 2, Slot 3, Slot 4).
*   **Modularity:** Any effect module can be loaded into any slot.
*   **Swappable:** The effect algorithm within a slot can be swapped in real-time.
*   **Available Modules:**
    1.  **Stutter / Loop:** Buffer manipulation for repeats and rhythmic freezes.
    2.  **Glitch:** Bitcrushing, sample rate reduction, and randomization.
    3.  **Filter:** Performance-oriented resonant filter (LP/HP/BP) with LFOs.
    4.  **Reverb:** A deep, atmospheric reverb (optimized for low CPU usage).
    5.  **DJ Looper:** Rhythmic, DJ-style beat-repeater and looper.

### 2. Routing
*   **Dynamic Order:** The processing order of the 4 slots is fully customizable.
*   **Bypass:** Each slot has a hard bypass switch for CPU saving and a soft bypass for effect tails.

### 3. Parameter Control & Time Divisions
*   **Focus:** Parameters should allow for drastic sonic changes ("maniac parameters").
*   **Time Divisions:** Emphasizes **Odd & Tuplet Divisions** for complex rhythms.
*   **Immediate Parameter Response:** All parameter changes from UI controls (XY Pads, faders) must affect the audio output **immediately** (i.e., on the next available audio processing block, with imperceptible latency). There shall be no musical quantization or delayed updates unless explicitly designed as a feature. This is critical for rhythmic effects like Stutter Division and LFO rates to feel "playable" and responsive.

### 4. Performance Interface (XY Pads & Automation) - DETAILED
*   **XY Pads:** Each effect module is equipped with **two XY Pads** for multi-parameter control.

*   **Automation Core Logic:**
    *   **Independent & Synced:** Each XY Pad's automation is independent but its timeline is synced to the main sequencer's BPM.
    *   **Always-Running Timeline:** Automation for each pad runs on a continuous **8-bar loop**. The playback "head" is always moving along this timeline, even if no data is recorded.
    *   **Touch-to-Record:** Touching an XY Pad **instantly activates recording** for that pad. The user's finger movements are recorded as automation data onto the timeline.
    *   **Release-to-Hold (Latch):** When the finger is released, recording stops immediately. The last recorded parameter value is **held indefinitely** until the pad is touched again.
    *   **Record Mode:** A switch will allow the user to select the recording behavior:
        *   **`FROM START`:** When the XY pad is touched, recording begins from the start of the current bar (quantized).
        *   **`PUNCH IN`:** Recording begins immediately at the current playback position.
    *   **Visual Feedback:** The path of recorded automation will be visualized on the timeline (e.g., as a colored line).

*   **Automatic Engagement (FX Triggering):**
    *   Touching an XY Pad or any of the 8 Bar Pads will automatically engage (turn ON) the corresponding effect slot if it is currently bypassed.
    *   This allows the pads to function not only as controllers but also as performance triggers for bringing effects in and out of the mix instantaneously.

*   **Bar Pad Control Interface:**
    *   **Structure:** Below the XY Pads, a set of **8 "Bar Pads"** (labeled 1-8) will be displayed.
    *   **Instant Cueing (Head Jump):** Tapping any Bar Pad instantly moves the automation playback head to the beginning of that corresponding bar. This allows for rhythmic "re-triggering" of automation phrases.
    *   **Single-Bar Looping (Swipe Up):** Swiping **up** on a Bar Pad engages a loop for that specific bar. The automation will repeat that single bar indefinitely. The active loop bar will be visually highlighted.
    *   **Loop Cancel (Swipe Down):** Swiping **down** on a looping Bar Pad (or any Bar Pad) cancels the loop, returning the playback head to its normal position within the global 8-bar loop.
    *   **Visual Feedback:** Bar Pads will be visually distinct to indicate their state:
        *   **Current Bar:** Brightly lit to show the current playback head position.
        *   **Looping Bar:** Pulsing color to indicate an active loop.
        *   **Contains Automation:** A subtle background color change to show that automation data exists within that bar.


### 5. Snapshot System (Instant Recall)
*   **Per-Slot Snapshots:** Each slot has **16 instant snapshots** saving all parameters, XY Pad positions, and automation data.
*   **Global Snapshots:** A separate bank of **16 Global Snapshots** saves the state of all 4 slots and the routing order.

### 6. Gapless Switching & Tails
*   **Glitch-Free Switching:** Changing modules or snapshots is seamless.
*   **Effect Tails (Soft Bypass):** When bypassing effects, tails ring out naturally.

## Detailed Module Specifications (Initial Set)

### Stutter / Loop
*   **Role:** Catches audio into a buffer and re-triggers it.
*   **XY Pad 1:** Division (X) / Feedback (Y)
*   **XY Pad 2:** Speed (X) / Mix (Y)

### Glitch
*   **Role:** Digital artifacts and degradation.
*   **XY Pad 1:** Crush (X) / Rate (Y)
*   **XY Pad 2:** Shuffle (X) / Mix (Y)

### Filter
*   **Role:** DJ-style isolator and sweeping.
*   **XY Pad 1:** Cutoff (X) / Resonance (Y)
*   **XY Pad 2:** LFO Amount (X) / LFO Rate (Y)

### Deep Reverb
*   **Role:** Space and wash.
*   **XY Pad 1:** Size (X) / Mix (Y)
*   **XY Pad 2:** Damping (X) / Mod (Y)

### DJ Looper
*   **Role:** A musical, DJ-style beat repeater.
*   **XY Pad 1:** Loop Division (X) / Mix (Y)
*   **XY Pad 2:** Length Multiplier (X) / Fade Time (Y)