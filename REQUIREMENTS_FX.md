
# Performance FX System - Requirements Definition

## Overview
A low-CPU, high-impact multi-effect system designed specifically for live performance. It sits at the end of the signal chain (before the Master Compressor) and consists of 4 **Generic Modular Slots**. The system prioritizes "maniacal" real-time manipulation, instant snapshot recall, and rhythmic complexity using odd time divisions.

## Core Architecture

### 1. Modular Slots & Modules
*   **Structure:** The system is comprised of **4 Generic Slots** (Slot 1, Slot 2, Slot 3, Slot 4).
*   **Modularity:** Any effect module can be loaded into any slot.
    *   *Example:* You can load 4 "Stutter" modules in a row.
    *   *Example:* You can have Filter -> Reverb -> Filter -> Reverb.
*   **Swappable:** The effect algorithm within a slot can be swapped in real-time (e.g., changing Slot 1 from "Stutter" to "Glitch"). This resets the parameters for that slot but maintains the routing.
*   **Available Modules:**
    1.  **Stutter / Loop:** Buffer manipulation for repeats and rhythmic freezes.
    2.  **Glitch:** Bitcrushing, sample rate reduction, and randomization.
    3.  **Filter:** Performance-oriented resonant filter (LP/HP/BP) with LFOs.
    4.  **Reverb:** A deep, atmospheric reverb (optimized for low CPU usage).

### 2. Routing
*   **Dynamic Order:** The processing order of the 4 slots is fully customizable.
    *   *Default:* Slot 0 -> Slot 1 -> Slot 2 -> Slot 3
    *   *Custom:* Slot 2 -> Slot 0 -> Slot 3 -> Slot 1
*   **Bypass:** Each slot has a hard bypass switch to ensure 0% CPU usage when not in use.

### 3. Parameter Control & Time Divisions
*   **Focus:** Parameters should allow for drastic sonic changes ("maniac parameters").
*   **Time Divisions:** Unlike standard sequencers (1/4, 1/8, 1/16), this system emphasizes **Odd & Tuplet Divisions** to create complex, shifting rhythms against the straight grid.
    *   Standard: 1/4, 1/8, 1/16, 1/32
    *   Odd/Tuplets: 1/3, 1/5, 1/6, 1/7, 1/9, 1/11, 1/13, 1/15... (Extended Set)
    *   Dotted: 1/8D, 1/16D

### 4. Performance Interface (XY Pads & Automation)
*   **XY Pads:** Each effect slot features multiple XY Pads for intuitive multi-parameter control.
*   **Touch Automation:**
    *   **Recording:** Touching a pad records the movement. Releasing stops recording (or keeps the last value depending on latch mode).
    *   **Duration:** Up to 8 bars of automation data per pad, independent of the main sequencer.
    *   **Speed:** Playback speed of automation can be scaled (1/1, 1/2, 1/4, 1/8) for slowly evolving textures.
    *   **Edit Points:** Users can easily adjust the **Start Point** and **End Point** of the recorded automation loop.
    *   **Loop Mode:** Toggle between **Loop** (repeats the recorded gesture) and **One-Shot** (plays once and holds/resets).

### 5. Snapshot System (Instant Recall)
*   **Concept:** "No Naming, Just Saving."
*   **Per-Slot Snapshots:** Each of the 4 slots has **16 instant snapshot slots**.
    *   Saves all parameters, XY Pad positions, and Automation data for that specific slot.
*   **Global Snapshots:** A separate bank of **16 Global Snapshots**.
    *   Saves the state of **all 4 slots** (including which Effect Module is loaded in each).
    *   Saves the **routing order** of the chain.
    *   Allows for complete, drastic transformation of the entire output processing with a single tap.

### 6. Gapless Switching & Tails
*   **Glitch-Free Switching:** Changing effect modules or snapshots should not cause audio clicks or dropouts. Use crossfading where necessary.
*   **Effect Tails (Soft Bypass):** When bypassing effects like Reverb or Delay, the input should be muted while the output continues to ring out ("Tails"). Users can toggle between "Hard Bypass" (CPU save) and "Soft Bypass" (Musical).

## Detailed Module Specifications (Initial Set)

### Stutter / Loop
*   **Role:** Catches audio into a buffer and re-triggers it.
*   **Parameters:** `Division` (Odd/Weird), `Speed` (Fwd/Rev/Stop), `Feedback`, `Mix`.
*   **XY Pad 1:** Division (X) / Feedback (Y)

### Glitch
*   **Role:** Digital artifacts and degradation.
*   **Parameters:** `Crush` (Bit Depth), `Rate` (Sample Rate), `Shuffle` (Jitter), `Mix`.
*   **XY Pad 1:** Crush (X) / Rate (Y)

### Filter
*   **Role:** DJ-style isolator and sweeping.
*   **Parameters:** `Cutoff`, `Resonance`, `Type`, `LFO Amount`, `LFO Rate` (Odd).
*   **XY Pad 1:** Cutoff (X) / Resonance (Y)

### Deep Reverb
*   **Role:** Space and wash.
*   **Requirements:** Must sound "expensive" but use minimal CPU.
*   **Parameters:** `Size`, `Damping`, `Mod` (Chorus), `Mix`.
*   **XY Pad 1:** Size (X) / Mix (Y)

## Modularity & Extensibility
*   The architecture is designed to allow new effect algorithms (e.g., "Delay", "Phaser", "Comb Filter") to be added in the future and loaded into any slot without breaking existing functionality.
