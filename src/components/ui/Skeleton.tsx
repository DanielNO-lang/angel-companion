import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-slate-800/40 backdrop-blur-md ${className}`}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="rounded-3xl p-5 bg-[#070b20]/40 backdrop-blur-xl flex flex-col justify-between min-h-[135px] space-y-3 animate-pulse">
      <div className="flex justify-between items-center">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
      <div className="space-y-2 mt-2">
        <Skeleton className="w-2/3 h-4" />
        <Skeleton className="w-1/2 h-3" />
      </div>
    </div>
  );
};

export const PanelSkeleton: React.FC = () => {
  return (
    <div className="rounded-3xl p-5 bg-[#070b20]/40 backdrop-blur-xl min-h-[220px] space-y-4 animate-pulse flex flex-col justify-between">
      <Skeleton className="w-1/3 h-5" />
      <div className="space-y-3 my-auto">
        <Skeleton className="w-full h-8 rounded-xl" />
        <Skeleton className="w-5/6 h-8 rounded-xl" />
        <Skeleton className="w-4/6 h-8 rounded-xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="w-24 h-7 rounded-full" />
      </div>
    </div>
  );
};
