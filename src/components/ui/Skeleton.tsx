import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-2xl backdrop-blur-md ${className}`}
    />
  );
};

export const EmblemSkeleton: React.FC<{ size?: number; className?: string }> = ({
  size,
  className = '',
}) => {
  const dimensionStyle = size ? { width: size, height: size } : undefined;
  return (
    <div
      aria-hidden="true"
      style={dimensionStyle}
      className={`relative inline-flex items-center justify-center shrink-0 ${
        size ? '' : 'w-[150px] h-[150px] sm:w-[210px] sm:h-[210px]'
      } ${className}`}
    >
      <div className="absolute inset-4 rounded-full bg-cyan-500/10 blur-2xl animate-pulse" />
      <div className="w-[74%] h-[74%] rounded-full border border-indigo-400/20 bg-[#0b102c]/45 backdrop-blur-xl flex items-center justify-center shadow-[0_0_30px_rgba(56,189,248,0.12)]">
        <div className="w-[62%] h-[62%] rounded-full border border-cyan-400/25 skeleton-shimmer" />
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl sm:rounded-3xl p-3 sm:p-5 bg-[#070b20]/35 backdrop-blur-2xl flex flex-col justify-between min-h-[105px] sm:min-h-[135px] shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="flex justify-between items-center">
        <Skeleton className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl" />
      </div>
      <div className="flex items-end justify-between mt-2 sm:mt-3 gap-2">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="w-2/3 h-4 rounded-lg" />
          <Skeleton className="w-4/5 h-3 rounded-lg" />
        </div>
        <Skeleton className="w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0" />
      </div>
    </div>
  );
};

export const PanelSkeleton: React.FC<{ variant?: 'activity' | 'quick-access' | 'status' }> = ({
  variant = 'activity',
}) => {
  if (variant === 'quick-access') {
    return (
      <div
        aria-hidden="true"
        className="rounded-3xl bg-[#070b20]/35 p-4 sm:p-5 backdrop-blur-2xl flex flex-col justify-between min-h-[190px] h-full shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      >
        <Skeleton className="w-28 h-5 rounded-lg mb-2" />
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 my-auto flex-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-2 p-2.5 rounded-2xl">
              <Skeleton className="w-8 h-8 rounded-xl" />
              <Skeleton className="w-12 h-3 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'status') {
    return (
      <div
        aria-hidden="true"
        className="rounded-3xl bg-[#070b20]/35 p-4 sm:p-5 backdrop-blur-2xl flex flex-col justify-between min-h-[190px] h-full shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      >
        <div className="space-y-2">
          <Skeleton className="w-28 h-5 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-3.5 h-3.5 rounded-full" />
            <Skeleton className="w-36 h-3.5 rounded-md" />
          </div>
          <Skeleton className="w-24 h-2.5 rounded-md" />
        </div>
        <Skeleton className="w-full h-14 rounded-2xl my-2" />
        <div className="flex justify-end">
          <Skeleton className="w-28 h-7 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="rounded-3xl bg-[#070b20]/35 p-4 sm:p-5 backdrop-blur-2xl flex flex-col justify-between min-h-[190px] h-full shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="w-28 h-5 rounded-lg" />
        <Skeleton className="w-14 h-3.5 rounded-md" />
      </div>
      <div className="space-y-2.5 my-auto w-full">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between p-1.5">
            <div className="flex items-center gap-2.5 flex-1">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <Skeleton className="w-2/3 h-3.5 rounded-md" />
            </div>
            <Skeleton className="w-10 h-3 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const SidebarSkeleton: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  return (
    <aside
      aria-hidden="true"
      className={`hidden md:flex flex-col shrink-0 h-screen bg-[#070918]/55 backdrop-blur-2xl border-r border-indigo-500/10 p-4 justify-between ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="space-y-6">
        {/* Brand Row */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-7 h-7 rounded-xl" />
            {!collapsed && <Skeleton className="w-20 h-5 rounded-lg" />}
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-7 h-7 rounded-lg" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
          )}
        </div>

        {/* Primary Nav */}
        <div className="space-y-2">
          <Skeleton className="w-full h-10 rounded-2xl" />
          <Skeleton className="w-full h-10 rounded-2xl" />
          <Skeleton className="w-full h-10 rounded-2xl" />
        </div>

        {/* Secondary Nav */}
        <div className="space-y-2 pt-2">
          <Skeleton className="w-full h-9 rounded-xl" />
          <Skeleton className="w-full h-9 rounded-xl" />
          <Skeleton className="w-full h-9 rounded-xl" />
        </div>

        {/* Recent Conversations */}
        {!collapsed && (
          <div className="space-y-2 pt-2">
            <Skeleton className="w-32 h-3 rounded-md mb-2" />
            <Skeleton className="w-full h-8 rounded-xl" />
            <Skeleton className="w-5/6 h-8 rounded-xl" />
            <Skeleton className="w-4/5 h-8 rounded-xl" />
          </div>
        )}
      </div>

      {/* Bottom Quote & Profile */}
      <div className="space-y-3">
        {!collapsed && (
          <div className="p-3 rounded-2xl bg-[#0b0f29]/45 space-y-2">
            <Skeleton className="w-full h-3 rounded-md" />
            <Skeleton className="w-4/5 h-3 rounded-md" />
            <Skeleton className="w-20 h-2.5 rounded-md" />
          </div>
        )}
        <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-[#0b0f29]/45">
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          {!collapsed && (
            <div className="space-y-1.5 flex-1">
              <Skeleton className="w-24 h-3.5 rounded-md" />
              <Skeleton className="w-12 h-2.5 rounded-md" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export const HeaderSkeleton: React.FC = () => {
  return (
    <header
      aria-hidden="true"
      className="w-full h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between shrink-0"
    >
      <div className="flex items-center gap-2 md:hidden">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="w-20 h-4 rounded-lg" />
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-24 h-8 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </header>
  );
};

export const HomeSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200" aria-hidden="true">
      {/* Hero Skeleton */}
      <div className="w-full flex flex-col items-center text-center my-2 sm:my-4 max-w-4xl mx-auto">
        <div className="my-2 sm:my-3">
          <EmblemSkeleton />
        </div>
        <Skeleton className="w-56 sm:w-80 h-8 sm:h-11 rounded-2xl mb-3 sm:mb-5" />
        <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl">
          <Skeleton className="w-28 h-8 rounded-full" />
          <Skeleton className="w-28 h-8 rounded-full" />
          <Skeleton className="w-28 h-8 rounded-full" />
          <Skeleton className="w-32 h-8 rounded-full" />
        </div>
      </div>

      {/* Composer Bar Skeleton */}
      <div className="w-full max-w-4xl mx-auto my-4">
        <div className="h-14 rounded-full bg-[#090e26]/55 backdrop-blur-2xl px-3 flex items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <Skeleton className="w-44 sm:w-64 h-4 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          </div>
        </div>
      </div>

      {/* 4 Core Cards Skeleton */}
      <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 my-2 sm:my-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* 3 Lower Panels Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 pt-1">
        <PanelSkeleton variant="activity" />
        <PanelSkeleton variant="quick-access" />
        <PanelSkeleton variant="status" />
      </div>
    </div>
  );
};

export const AppShellSkeleton: React.FC<{ collapsedSidebar?: boolean }> = ({
  collapsedSidebar = false,
}) => {
  return (
    <div
      role="status"
      aria-label="Loading Angel application"
      className="h-screen w-screen relative flex flex-col md:flex-row bg-[#070815]/90 text-slate-100 font-sans antialiased overflow-hidden z-10"
    >
      <span className="sr-only">Loading Angel...</span>
      <SidebarSkeleton collapsed={collapsedSidebar} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden relative z-10">
        <HeaderSkeleton />
        <main className="flex-1 px-3 sm:px-6 md:px-8 pb-12 max-w-7xl w-full mx-auto">
          <HomeSkeleton />
        </main>
      </div>
    </div>
  );
};

export const PageSkeleton: React.FC<{ variant?: 'default' | 'chat' | 'grid' | 'workspace' }> = ({
  variant = 'default',
}) => {
  if (variant === 'chat') {
    return (
      <div
        role="status"
        aria-label="Loading conversation"
        className="flex-1 flex flex-col justify-between w-full max-w-4xl mx-auto px-4 py-6 min-h-[70vh]"
      >
        <span className="sr-only">Loading conversation...</span>
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
            <Skeleton className="w-48 h-6 rounded-xl" />
            <div className="flex gap-2">
              <Skeleton className="w-20 h-8 rounded-full" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
          </div>
          <div className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Skeleton className="w-2/3 sm:w-1/2 h-14 rounded-2xl" />
            </div>
            <div className="flex items-start gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1 max-w-xl">
                <Skeleton className="w-full h-4 rounded-lg" />
                <Skeleton className="w-5/6 h-4 rounded-lg" />
                <Skeleton className="w-2/3 h-4 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <div className="h-14 rounded-full bg-[#090e26]/55 backdrop-blur-2xl px-3 flex items-center justify-between mt-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-48 h-4 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading view"
      className="space-y-6 py-4 animate-in fade-in duration-200"
    >
      <span className="sr-only">Loading view...</span>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="w-48 h-8 rounded-xl" />
          <Skeleton className="w-72 h-4 rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-28 h-9 rounded-full" />
          <Skeleton className="w-28 h-9 rounded-full" />
        </div>
      </div>

      {/* Filter / Mode Pills */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="w-24 h-8 rounded-full" />
        <Skeleton className="w-28 h-8 rounded-full" />
        <Skeleton className="w-24 h-8 rounded-full" />
        <Skeleton className="w-32 h-8 rounded-full" />
      </div>

      {/* Content Grid */}
      <div
        className={`grid gap-4 ${
          variant === 'workspace'
            ? 'grid-cols-1 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        <PanelSkeleton variant="activity" />
        <PanelSkeleton variant="quick-access" />
        <PanelSkeleton variant="status" />
        {variant === 'grid' && (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}
      </div>
    </div>
  );
};
