
import React from 'react';
import { useCpuLoad } from '../hooks/useCpuLoad';

const CpuMeter: React.FC = () => {
    const cpuLoad = useCpuLoad();

    const loadPercent = Math.min(100, cpuLoad).toFixed(0);
    const barColor = cpuLoad > 80 ? 'bg-rose-500' : cpuLoad > 50 ? 'bg-yellow-400' : 'bg-emerald-400';

    return (
        <div className="flex items-center space-x-2 w-full justify-center">
            <span className="text-xs font-bold text-slate-500">CPU</span>
            <div className="w-12 h-4 bg-emerald-100 rounded-sm overflow-hidden border border-emerald-200">
                <div className={`h-full ${barColor} transition-all duration-100`} style={{ width: `${loadPercent}%` }} />
            </div>
            <span className="text-xs font-mono text-slate-500 w-8 text-right">{loadPercent}%</span>
        </div>
    );
};

export default CpuMeter;
