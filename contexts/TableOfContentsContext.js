import React, { createContext, useContext, useState, useEffect } from 'react';

const TableOfContentsContext = createContext({
  headers: [],
  activeId: '',
  setHeaders: () => {},
  setActiveId: () => {},
});

export function TableOfContentsProvider({ children }) {
  const [headers, setHeaders] = useState([]);
  const [activeId, setActiveId] = useState('');
  
  useEffect(() => {
    const NAV_HEIGHT = 164; // Height of sticky nav in pixels
    const observerOptions = {
      rootMargin: `-${NAV_HEIGHT}px 0px -80% 0px`,
      threshold: [0],
    };

    const observer = new IntersectionObserver(entries => {
      const visibleHeaders = headers
        .map(header => ({
          ...header,
          element: document.getElementById(header.id),
        }))
        .filter(header => header.element)
        .sort((a, b) => 
          a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top
        );

      // Find the first header below the nav
      const nextHeader = visibleHeaders.find(header => 
        header.element.getBoundingClientRect().top > NAV_HEIGHT
      );

      // If we found a next header, activate the previous one
      // If we didn't (we're above all headers), activate the last one
      const activeHeader = nextHeader ? 
        visibleHeaders[Math.max(0, visibleHeaders.indexOf(nextHeader) - 1)] :
        visibleHeaders[visibleHeaders.length - 1];

      if (activeHeader && activeHeader.id !== activeId) {
        setActiveId(activeHeader.id);
      }
    }, observerOptions);

    headers.forEach(header => {
      const element = document.getElementById(header.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headers, activeId]);

  return (
    <TableOfContentsContext.Provider value={{ headers, setHeaders, activeId, setActiveId }}>
      {children}
    </TableOfContentsContext.Provider>
  );
}

export function useTableOfContents() {
  const context = useContext(TableOfContentsContext);
  if (!context) {
    throw new Error('useTableOfContents must be used within a TableOfContentsProvider');
  }
  return context;
} 