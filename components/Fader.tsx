
import React, { useState, useEffect, useRef } from 'react';

interface FaderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  displayValue?: number;
  displayString?: string;
  displayPrecision?: number;
  isVertical?: boolean;
  hideInfo?: boolean;
  hideValue?: boolean;
  verticalText?: boolean; // New prop for rotating text
}

const Fader: React.FC<FaderProps> = ({ 
  label, value, onChange, min, max, step, defaultValue, 
  displayValue, displayString, displayPrecision = 2, isVertical = false, 
  hideInfo = false, hideValue = false, verticalText = false
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const frameId = useRef<number | null>(null);
  const tapTimeout = useRef<number | null>(null);
  const lastTap = useRef<number>(0);
  
  // Sync internal state if the external value prop changes (e.g., from loading a project)
  useEffect(() => {
    // This effect syncs the internal state to the external `value` prop.
    // It runs only when the `value` prop changes.
    if (isFinite(value)) {
      setInternalValue(value);
    }
  }, [value]);

  const handleReset = () => {
    setInternalValue(defaultValue);
    onChange(defaultValue);
  };

  // Combined handler for both mobile double-tap and desktop double-click
  const handleDoubleClick = (event: React.MouseEvent) => {
    // This handles the desktop case.
    event.preventDefault();
    handleReset();
  };
  
  const handleTouchStart = (event: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms
    
    if (tapTimeout.current) {
        // This indicates a second tap within the delay period.
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
        lastTap.current = 0;
        handleReset();
        event.preventDefault(); // Prevent zoom or other default browser actions.
    } else {
        // This is the first tap.
        lastTap.current = now;
        tapTimeout.current = window.setTimeout(() => {
            // If the timeout completes, it was just a single tap.
            tapTimeout.current = null;
        }, DOUBLE_TAP_DELAY);
    }
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    
    // FIX: Add a guard to prevent non-finite numbers (NaN, Infinity) from propagating.
    // This is the root cause of the "non-finite value" error in the audio engine.
    if (!isFinite(newValue)) {
        return;
    }

    setInternalValue(newValue); // Update visual state immediately for smoothness

    if (frameId.current) {
        cancelAnimationFrame(frameId.current);
    }

    frameId.current = requestAnimationFrame(() => {
        onChange(newValue);
    });
  };

  const valueToDisplay = displayValue !== undefined ? displayValue : internalValue;

  const containerClasses = isVertical ? 'h-full w-auto' : 'w-full h-auto py-1';
  const inputContainerClasses = isVertical 
    ? 'relative h-full w-5' 
    : `relative h-5 w-full`;
  
  const labelContainerClasses = `absolute inset-0 flex items-center pointer-events-none text-white font-bold text-xs drop-shadow-sm select-none`;
  const horizontalLabelClasses = `justify-between px-2`; // Adjust padding
  // Adjusted vertical alignment for rotated text
  const verticalLabelClasses = verticalText 
    ? 'flex-col justify-center items-center py-2 space-y-2' 
    : 'flex-col justify-between items-center py-2';

  const labelTextClass = verticalText ? '[writing-mode:vertical-rl] rotate-180 whitespace-nowrap' : 'truncate';
  const valueTextClass = verticalText ? '[writing-mode:vertical-rl] rotate-180 font-mono text-[10px]' : 'truncate';

  return (
    <div className={containerClasses}>
      <div className={inputContainerClasses}>
         <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={internalValue}
            onChange={handleChange}
            onDoubleClick={handleDoubleClick} // For desktop
            onTouchStart={handleTouchStart} // For mobile
            className={`${isVertical ? 'vertical-fader' : 'horizontal-fader'}`}
          />
          {!hideInfo && (
            <div className={`${labelContainerClasses} ${isVertical ? verticalLabelClasses : horizontalLabelClasses}`}>
                {label && <span className={labelTextClass}>{label}</span>}
                {!hideValue && (
                  <span className={valueTextClass}>
                    {displayString !== undefined
                      ? displayString
                      : isFinite(valueToDisplay) ? valueToDisplay.toFixed(displayPrecision) : '...'}
                  </span>
                )}
            </div>
          )}
      </div>
    </div>
  );
};

export default React.memo(Fader);
