import React, { useMemo } from 'react';
import Icon from '../../../components/ui/Icon';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function YearlyCalendarView({ year, posts = [], eventsByDateKey = {}, onSelectMonth, onSelectDate }) {
  // Aggregate real post data into month buckets
  const yearData = useMemo(() => {
    const data = [];
    const currentYear = year || new Date().getFullYear();
    
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
      const firstDay = new Date(currentYear, m, 1).getDay();
      
      const days = [];
      let itemsAssigned = 0;
      
      for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        // Count posts for this date
        const postsOnDay = posts.filter(p => {
          const ts = p.publish_at || p.published_at || p.created_at;
          if (!ts) return false;
          return ts.startsWith(dateKey);
        });
        
        const eventsOnDay = eventsByDateKey[dateKey] || [];
        const totalItems = postsOnDay.length + eventsOnDay.length;
        
        if (totalItems > 0) itemsAssigned += totalItems;
        
        days.push({
          date: d,
          hasPost: totalItems > 0,
          dateKey
        });
      }
      
      data.push({
        monthName: MONTHS[m],
        monthIndex: m,
        daysInMonth,
        firstDay,
        days,
        totalPosts: itemsAssigned,
      });
    }
    return data;
  }, [posts, year]);

  return (
    <div className="flex-1 overflow-y-auto bg-paper p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-bold text-ink-950 mb-6">Yearly Content Distribution</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {yearData.map((month) => (
            <div key={month.monthName} className="bg-paper-tint rounded-xl p-4 border border-hairline hover:border-mint-300 transition-colors group cursor-pointer" onClick={() => onSelectMonth(month.monthIndex)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-ink-900">{month.monthName}</h3>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-500 bg-paper px-2 py-1 rounded-full shadow-sm group-hover:text-mint-600 transition-colors">
                  <span className={`w-1.5 h-1.5 rounded-full ${month.totalPosts > 0 ? 'bg-mint-500' : 'bg-ink-300'}`}></span>
                  {month.totalPosts} Posts
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-[8px] font-bold text-ink-400 text-center">{d}</div>
                ))}
                
                {/* Empty slots for first day offset */}
                {Array(month.firstDay).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {/* Days */}
                {month.days.map((day) => (
                  <div 
                    key={day.date} 
                    className={`aspect-square rounded-sm flex items-center justify-center text-[9px] relative transition-all ${
                      day.hasPost 
                        ? 'bg-mint-500 text-white font-bold hover:bg-mint-600 hover:scale-110 shadow-sm z-10 cursor-pointer' 
                        : 'text-ink-400 hover:bg-paper hover:text-ink-900'
                    }`}
                    onClick={(e) => {
                      if (day.hasPost) {
                        e.stopPropagation();
                        onSelectDate(day.dateKey);
                      }
                    }}
                  >
                    {day.date}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
