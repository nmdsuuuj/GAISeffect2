
import React from 'react';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => {

  const baseClasses = "w-full py-1.5 text-xs md:text-sm font-bold rounded-lg transition-colors duration-200 focus:outline-none";
  const activeClasses = "bg-pink-400 text-white";
  const inactiveClasses = "bg-emerald-200 text-emerald-800 hover:bg-emerald-300";

  return (
    <button
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

export default TabButton;
