import React from 'react';
import { cn } from '@/lib/utils';
import { IoCalendarOutline, IoChevronDown, IoChevronForward } from 'react-icons/io5';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function YearMonthFilter({ newsItems, selectedYear, selectedMonth, onFilterChange }) {
  const [expandedYears, setExpandedYears] = React.useState(new Set());

  // Group news items by year and month
  const groupByYearMonth = (items) => {
    const groups = {};

    items.forEach(item => {
      const itemDate = new Date(item.content.date || item.first_published_at || item.created_at);
      const year = itemDate.getFullYear();
      const month = itemDate.getMonth(); // 0-11

      if (!groups[year]) {
        groups[year] = { count: 0, months: {} };
      }
      
      if (!groups[year].months[month]) {
        groups[year].months[month] = 0;
      }

      groups[year].count++;
      groups[year].months[month]++;
    });

    return groups;
  };

  const groupedData = groupByYearMonth(newsItems);
  const sortedYears = Object.keys(groupedData)
    .map(y => parseInt(y))
    .sort((a, b) => b - a);

  const toggleYear = (year) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const handleYearClick = (year) => {
    // Toggle expansion
    toggleYear(year);
    
    // If clicking the same year, toggle it off
    if (selectedYear === year && !selectedMonth) {
      onFilterChange(null, null);
    } else {
      // Otherwise, select the year and clear month
      onFilterChange(year, null);
    }
  };

  const handleMonthClick = (year, month, e) => {
    e.stopPropagation();
    
    // If clicking the same month, deselect it
    if (selectedYear === year && selectedMonth === month) {
      onFilterChange(year, null);
    } else {
      onFilterChange(year, month);
    }
  };

  const clearFilters = () => {
    onFilterChange(null, null);
    setExpandedYears(new Set());
  };

  React.useEffect(() => {
    // Auto-expand the selected year
    if (selectedYear && !expandedYears.has(selectedYear)) {
      setExpandedYears(prev => new Set([...prev, selectedYear]));
    }
  }, [selectedYear]);

  if (sortedYears.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-20 w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-sm">
          <IoCalendarOutline className="text-lg" />
          Filter by Date
        </h3>
        {(selectedYear || selectedMonth) && (
          <button
            onClick={clearFilters}
            className="text-xs text-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-1">
        {sortedYears.map(year => {
          const yearData = groupedData[year];
          const isYearSelected = selectedYear === year;
          const isExpanded = expandedYears.has(year);
          
          // Get sorted months for this year (newest first)
          const sortedMonths = Object.keys(yearData.months)
            .map(m => parseInt(m))
            .sort((a, b) => b - a);

          return (
            <div key={year} className="overflow-hidden">
              <button
                onClick={() => handleYearClick(year)}
                className={cn(
                  "w-full flex items-center justify-between py-2 px-3 rounded-md text-sm transition-colors",
                  "hover:bg-muted",
                  isYearSelected && !selectedMonth
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  {sortedMonths.length > 0 && (
                    isExpanded 
                      ? <IoChevronDown className="text-base flex-shrink-0" />
                      : <IoChevronForward className="text-base flex-shrink-0" />
                  )}
                  <span>{year}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {yearData.count}
                </span>
              </button>

              {isExpanded && sortedMonths.length > 0 && (
                <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-muted pl-2">
                  {sortedMonths.map(month => {
                    const isMonthSelected = isYearSelected && selectedMonth === month;
                    return (
                      <button
                        key={month}
                        onClick={(e) => handleMonthClick(year, month, e)}
                        className={cn(
                          "w-full text-left py-1.5 px-2 rounded text-sm transition-colors",
                          "hover:bg-muted",
                          isMonthSelected
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span>{MONTH_NAMES[month]}</span>
                          <span className="text-xs opacity-70">
                            {yearData.months[month]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
