
import React from 'react';
import { PAD_SIZE } from '../constants';

interface PadProps {
  id: number;
  label: string;
  onClick: (id: number) => void;
  isActive?: boolean;
  isPlaying?: boolean;
  isRecording?: boolean;
  isArmed?: boolean;
  hasContent?: boolean;
  padType?: 'sample' | 'pattern' | 'groove' | 'snapshot';
}

const Pad: React.FC<PadProps> = ({
  id,
  label,
  onClick,
  isActive = false,
  isPlaying = false,
  isRecording = false,
  isArmed = false,
  hasContent = false,
  padType = 'sample',
}) => {
  const baseClasses = `${PAD_SIZE} flex items-center justify-center rounded-md text-xs font-bold transition-all duration-100 focus:outline-none border-2`;
  
  let colorClasses = 'bg-emerald-200 border-emerald-300 text-emerald-800';
  if (hasContent) colorClasses = 'bg-emerald-500 border-emerald-600 text-white';
  
  if (isActive) {
    switch (padType) {
        case 'sample':
            colorClasses = 'bg-sky-400 border-sky-500 text-white ring-2 ring-sky-300 ring-offset-2 ring-offset-emerald-50';
            break;
        case 'snapshot':
            colorClasses = 'bg-cyan-400 border-cyan-500 text-white ring-2 ring-cyan-300 ring-offset-2 ring-offset-emerald-50';
            break;
        case 'pattern':
        case 'groove':
        default:
             colorClasses = 'bg-pink-400 border-pink-500 text-white ring-2 ring-pink-300 ring-offset-2 ring-offset-emerald-50';
            break;
    }
  }

  if (isArmed) colorClasses = 'bg-yellow-400 border-yellow-500 text-slate-800 animate-pulse';
  if (isPlaying) colorClasses = 'bg-lime-300 border-lime-400 text-slate-800 scale-105';
  if (isRecording) colorClasses = 'bg-rose-500 border-rose-600 text-white scale-105 animate-pulse';


  return (
    <button
      className={`${baseClasses} ${colorClasses}`}
      onClick={() => onClick(id)}
    >
      {label}
    </button>
  );
};

export default Pad;
