import React, { useMemo, useRef, useEffect } from 'react';
import Icon from '../../../components/ui/Icon';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM (21:00)

export function DailyTimelineView({ dateKey, posts = [], onSelectPost }) {
  const timelineContainerRef = useRef(null);

  // Auto-scroll to 9 AM on mount
  useEffect(() => {
    if (timelineContainerRef.current) {
      timelineContainerRef.current.scrollTop = 120; // roughly 2 hours down (1 hr = 60px)
    }
  }, [dateKey]);

  if (!dateKey) return null;

  // Build Date object from YYYY-MM-DD
  const [y, m, d] = dateKey.split('-').map(Number);
  const activeDate = new Date(y, m - 1, d);

  const formatHour = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : hour;
    return `${h} ${ampm}`;
  };

  const getFormatIcon = (format) => {
    switch(format?.toLowerCase()) {
      case 'reel': return 'video';
      case 'carousel': return 'image';
      default: return 'file';
    }
  };
  
  const getFormat = (post) => {
    if (post?.asset_type) {
      const at = post.asset_type.toLowerCase()
      if (at.includes('reel')) return 'reel'
      if (at.includes('carousel')) return 'carousel'
    }
    if (post?.media?.[0]?.media_type === 'video' || post?.media?.[0]?.type === 'video') return 'reel'
    if (post?.media && post.media.length > 1) return 'carousel'
    return 'post'
  };

  return (
    <div className="flex-1 flex flex-col bg-paper overflow-hidden">
      {/* Header */}
      <div className="border-b border-hairline px-6 py-4 bg-paper sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-950">
            {activeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
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

          {/* Current Time Indicator */}
          {activeDate.toDateString() === new Date().toDateString() && (
            <div className="absolute w-full border-b-2 border-red-500 z-10 flex items-center" 
                 style={{ top: `${(Math.max(7, new Date().getHours()) - 7) * 60 + (new Date().getMinutes() / 60) * 60}px` }}>
              <div className="w-20 text-right pr-4 text-[10px] font-bold text-red-500 relative -top-2">
                {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
              <div className="w-2 h-2 rounded-full bg-red-500 absolute left-[76px]"></div>
            </div>
          )}

          {/* Events */}
          {posts.map((post) => {
            const ts = post.publish_at || post.published_at || post.created_at;
            let timeStr = '09:00';
            if (ts) {
               const dObj = new Date(ts);
               timeStr = `${String(dObj.getHours()).padStart(2, '0')}:${String(dObj.getMinutes()).padStart(2, '0')}`;
            }
            const [hours, minutes] = timeStr.split(':').map(Number);
            const relativeHour = Math.max(0, hours - HOURS[0]); // fallback to top if before 7 AM
            const topOffset = (relativeHour * 60) + ((minutes / 60) * 60);
            
            const format = getFormat(post);
            
            return (
              <div
                key={post.id}
                onClick={() => onSelectPost && onSelectPost(post)}
                className="absolute left-24 right-6 p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all z-20 overflow-hidden"
                style={{ 
                  top: `${topOffset}px`, 
                  height: '56px', // Approx 1 hour duration block
                  backgroundColor: post.status === 'published' ? 'var(--mint-50)' : 'var(--paper)',
                  borderColor: post.status === 'published' ? 'var(--mint-400)' : 'var(--hairline-strong)',
                }}
              >
                <div className="flex items-center gap-3 h-full">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    format === 'reel' ? 'bg-pink-100 text-pink-600' :
                    format === 'carousel' ? 'bg-blue-100 text-blue-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    <Icon name={getFormatIcon(format)} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-ink-950 truncate">{post.caption || post.title || 'Untitled Post'}</h4>
                    <p className="text-xs text-ink-500 truncate">
                      {post.status === 'published' ? '✅ Published' : (post.status === 'scheduled' ? '⏳ Scheduled' : 'Draft')}
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
