import React from 'react';
import { CheckCircle2, Layers, TrendingUp, ArrowRight } from 'lucide-react';
import { ActivityItem } from '../../types/angel';

interface ActivityPanelProps {
  activities?: ActivityItem[];
  onViewAll: () => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  onViewAll,
}) => {
  const activityList = [
    {
      id: 'act-1',
      title: 'Research Analysis',
      timestamp: '2m ago',
      type: 'completed',
    },
    {
      id: 'act-2',
      title: 'Project Planning',
      timestamp: '12m ago',
      type: 'progress-cyan',
    },
    {
      id: 'act-3',
      title: 'Marketing Strategy',
      timestamp: '1h ago',
      type: 'progress-purple',
    },
  ];

  return (
    <div className="rounded-3xl bg-[#070b20]/35 p-4 sm:p-5 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[190px] h-full shadow-[0_8px_30px_rgba(0,0,0,0.35)] select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 z-10">
        <h3 className="text-base font-bold font-heading text-white tracking-tight">Your Activity</h3>
        <button
          onClick={onViewAll}
          className="text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1 transition-colors group"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-cyan-400" />
        </button>
      </div>

      {/* Activity List - Spanning full width to eliminate right gap */}
      <div className="space-y-1.5 z-10 flex-1 my-auto w-full">
        {activityList.map((act) => (
          <div
            key={act.id}
            className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.04] transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {act.type === 'completed' && (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                </div>
              )}
              {act.type === 'progress-cyan' && (
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                  <Layers className="w-4 h-4 stroke-[2]" />
                </div>
              )}
              {act.type === 'progress-purple' && (
                <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                  <TrendingUp className="w-4 h-4 stroke-[2]" />
                </div>
              )}

              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-white group-hover:text-cyan-200 transition-colors truncate">
                  {act.title}
                </h4>
              </div>
            </div>

            <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-200 transition-colors shrink-0 ml-2">
              {act.timestamp}
            </span>
          </div>
        ))}
      </div>

      {/* Cosmic background glow */}
      <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
    </div>
  );
};
