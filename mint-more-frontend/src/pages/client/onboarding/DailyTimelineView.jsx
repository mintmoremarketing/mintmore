import React, { useMemo, useRef, useEffect } from 'react';
import Icon from '../../../components/ui/Icon';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM (21:00)

export function DailyTimelineView({ selectedDay, scheduledDays, onSelectPost }) {
  // If no day selected, pick today, or the first day with a post
  const activeDay = useMemo(() => {
    if (selectedDay) return scheduledDays.find(d => d.dateKey === selectedDay);
    const today = new Date().toISOString().split('T')[0];
    const todayData = scheduledDays.find(d => d.dateKey === today);
    if (todayData) return todayData;
    return scheduledDays.find(d => d.hasPost) || scheduledDays[0];
  }, [selectedDay, scheduledDays]);

  const timelineContainerRef = useRef(null);

  // Auto-scroll to 9 AM on mount
  useEffect(() => {
    if (timelineContainerRef.current) {
      timelineContainerRef.current.scrollTop = 120; // roughly 2 hours down (1 hr = 60px)
    }
  }, [activeDay]);

  if (!activeDay) return null;

  // We only support one post per day currently in this system, but let's handle it robustly
  const posts = activeDay.hasPost && activeDay.topic ? [{
    id: activeDay.topic.id,
    time: activeDay.scheduledTime || '09:00', // e.g. "09:00"
    topic: activeDay.topic,
    format: activeDay.format,
    status: activeDay.status,
  }] : [];

  const formatHour = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : hour;
    return `${h} ${ampm}`;
  };

  const getFormatIcon = (format) => {
    switch(format) {
      case 'reel': return 'video';
      case 'carousel': return 'image';
      default: return 'file';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-paper overflow-hidden">
      {/* Header */}
      <div className="border-b border-hairline px-6 py-4 bg-paper sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-950">
            {activeDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-xs text-ink-500 font-medium">Daily Timeline</p>
        </div>
      </div>

      {/* Timeline Scroll Container */}
      <div className="flex-1 overflow-y-auto relative" ref={timelineContainerRef}>
        <div className="relative min-h-[900px] w-full" style={{ height: `${HOURS.length * 60}px` }}>
          
          {/* Background Grid Lines */}
          {HOURS.map((hour, idx) => (
            <div 
              key={hour} 
              className="absolute w-full border-b border-hairline flex items-start"
              style={{ top: `${idx * 60}px`, height: '60px' }}
            >
              <div className="w-20 text-right pr-4 pt-2 text-[11px] font-bold text-ink-400">
                {formatHour(hour)}
              </div>
            </div>
          ))}

          {/* Current Time Indicator (fake for mockup) */}
          <div className="absolute w-full border-b-2 border-red-500 z-10 flex items-center" style={{ top: `${3.5 * 60}px` }}>
            <div className="w-20 text-right pr-4 text-[10px] font-bold text-red-500 relative -top-2">10:30 AM</div>
            <div className="w-2 h-2 rounded-full bg-red-500 absolute left-[76px]"></div>
          </div>

          {/* Events */}
          {posts.map((post) => {
            const [hours, minutes] = post.time.split(':').map(Number);
            const relativeHour = hours - HOURS[0]; // e.g. 9 - 7 = 2
            const topOffset = (relativeHour * 60) + ((minutes / 60) * 60);
            
            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(activeDay.dateKey)}
                className="absolute left-24 right-6 p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all z-20 overflow-hidden"
                style={{ 
                  top: `${topOffset}px`, 
                  height: '56px', // Approx 1 hour duration block
                  backgroundColor: post.status === 'approved' ? 'var(--mint-50)' : 'var(--paper)',
                  borderColor: post.status === 'approved' ? 'var(--mint-400)' : 'var(--hairline-strong)',
                }}
              >
                <div className="flex items-center gap-3 h-full">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    post.format === 'reel' ? 'bg-pink-100 text-pink-600' :
                    post.format === 'carousel' ? 'bg-blue-100 text-blue-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    <Icon name={getFormatIcon(post.format)} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-ink-950 truncate">{post.topic.title}</h4>
                    <p className="text-xs text-ink-500 truncate">
                      {post.status === 'approved' ? '✅ Ready to publish' : '⏳ Needs approval'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
