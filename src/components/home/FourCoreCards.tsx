import React from 'react';
import { MessageSquare, Folder, Clapperboard, Wrench, ArrowRight } from 'lucide-react';
import { PrimaryNavItem } from '../../types/angel';

interface FourCoreCardsProps {
  onSelectDestination: (dest: PrimaryNavItem) => void;
}

export const FourCoreCards: React.FC<FourCoreCardsProps> = ({
  onSelectDestination,
}) => {
  const cards: { id: PrimaryNavItem; title: string; subtitle: string; icon: React.FC<{ className?: string }> }[] = [
    {
      id: 'new-conversation',
      title: 'Conversation',
      subtitle: 'Chat naturally with Angel',
      icon: MessageSquare,
    },
    {
      id: 'workspace',
      title: 'Workspace',
      subtitle: 'Plan, build and organize',
      icon: Folder,
    },
    {
      id: 'studios',
      title: 'Studios',
      subtitle: 'Explore creative spaces',
      icon: Clapperboard,
    },
    {
      id: 'tools',
      title: 'Tools',
      subtitle: 'Extend your capabilities',
      icon: Wrench,
    },
  ];

  return (
    <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 my-2 sm:my-3 select-none">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            onClick={() => onSelectDestination(card.id)}
            className="group relative rounded-2xl sm:rounded-3xl p-3 sm:p-5 bg-[#070b20]/35 hover:bg-[#0a1030]/65 backdrop-blur-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[105px] sm:min-h-[135px] shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_0_30px_rgba(59,130,246,0.25)] hover:-translate-y-1 overflow-hidden"
          >
            {/* Top Glowing Cyan Icon */}
            <div className="flex items-center justify-between z-10">
              <div className="p-1 sm:p-2.5 rounded-2xl bg-transparent text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] group-hover:scale-110 transition-transform">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
            </div>

            {/* Title & Subtitle + Glass Circle Arrow Button */}
            <div className="flex items-end justify-between mt-2 sm:mt-3 z-10 gap-1">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-base font-bold font-heading text-white group-hover:text-cyan-200 transition-colors tracking-tight truncate">
                  {card.title}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5 font-normal line-clamp-1">
                  {card.subtitle}
                </p>
              </div>

              {/* Glass Circular Arrow Button */}
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#11193a]/80 flex items-center justify-center text-white group-hover:bg-blue-600 transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)] shrink-0">
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Silky Cosmic Blue Light Ribbon in card background */}
            <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-gradient-to-tl from-blue-600/20 via-cyan-500/10 to-transparent rounded-full blur-xl pointer-events-none group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
          </div>
        );
      })}
    </div>
  );
};
