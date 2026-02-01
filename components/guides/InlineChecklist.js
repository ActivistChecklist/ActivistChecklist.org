'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * InlineChecklist - Converts bullet points into interactive checklist items
 * 
 * Items can be checked off and state is persisted to localStorage using the
 * provided storageKey (or a generated one based on content).
 */
export function InlineChecklist({ children, storageKey, className }) {
  const [checkedItems, setCheckedItems] = useState({});
  const [mounted, setMounted] = useState(false);

  // Generate a storage key from content if not provided
  const getStorageKey = useCallback(() => {
    if (storageKey) return `checklist-${storageKey}`;
    
    // Generate key from children content
    const extractText = (node) => {
      if (typeof node === 'string') return node;
      if (React.isValidElement(node)) {
        return extractText(node.props.children);
      }
      if (Array.isArray(node)) {
        return node.map(extractText).join('');
      }
      return '';
    };
    
    const text = extractText(children);
    // Create a simple hash from the text
    const hash = text.slice(0, 50).replace(/\s+/g, '-').toLowerCase();
    return `checklist-${hash}`;
  }, [storageKey, children]);

  // Load checked state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const key = getStorageKey();
      const saved = localStorage.getItem(key);
      if (saved) {
        setCheckedItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load checklist state:', e);
    }
  }, [getStorageKey]);

  // Save checked state to localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      const key = getStorageKey();
      localStorage.setItem(key, JSON.stringify(checkedItems));
    } catch (e) {
      console.warn('Failed to save checklist state:', e);
    }
  }, [checkedItems, mounted, getStorageKey]);

  const toggleItem = (index) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Transform bullet list items into checklist items
  const transformChildren = (node, path = '') => {
    if (!React.isValidElement(node)) {
      return node;
    }

    const { type, props } = node;
    
    // Handle <ul> elements - this is the bullet list
    if (type === 'ul') {
      const items = React.Children.toArray(props.children);
      return (
        <ul className={cn("checklist-items list-none pl-0 space-y-2", props.className)}>
          {items.map((item, idx) => {
            if (React.isValidElement(item) && item.type === 'li') {
              const itemIndex = `${path}-${idx}`;
              const isChecked = checkedItems[itemIndex] || false;
              
              return (
                <li
                  key={idx}
                  onClick={() => toggleItem(itemIndex)}
                  className={cn(
                    "flex items-start gap-3 cursor-pointer select-none transition-all",
                    "hover:bg-gray-50 -mx-2 px-2 py-1 rounded-md",
                    isChecked && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-all",
                      isChecked
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-green-400"
                    )}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                  </span>
                  <span className={cn(
                    "flex-1 transition-all",
                    isChecked && "line-through text-gray-500"
                  )}>
                    {item.props.children}
                  </span>
                </li>
              );
            }
            return item;
          })}
        </ul>
      );
    }

    // Recursively transform children
    if (props.children) {
      const newChildren = React.Children.map(props.children, (child, idx) => 
        transformChildren(child, `${path}-${idx}`)
      );
      return React.cloneElement(node, {}, newChildren);
    }

    return node;
  };

  // Count total and checked items
  const countItems = (node, count = { total: 0 }) => {
    if (!React.isValidElement(node)) return count;
    
    const { type, props } = node;
    
    if (type === 'ul') {
      React.Children.forEach(props.children, (child) => {
        if (React.isValidElement(child) && child.type === 'li') {
          count.total++;
        }
      });
    }
    
    if (props.children) {
      React.Children.forEach(props.children, (child) => {
        countItems(child, count);
      });
    }
    
    return count;
  };

  const { total } = countItems(children);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const allChecked = total > 0 && checkedCount >= total;

  return (
    <div className={cn(
      "inline-checklist my-4 p-4 rounded-lg border-2 border-dashed",
      allChecked ? "border-green-300 bg-green-50/50" : "border-gray-200 bg-gray-50/50",
      className
    )}>
      {total > 0 && (
        <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
          <span className="font-medium">
            {allChecked ? "✓ All done!" : `${checkedCount} of ${total} completed`}
          </span>
          {checkedCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCheckedItems({});
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset
            </button>
          )}
        </div>
      )}
      {React.Children.map(children, (child, idx) => transformChildren(child, `root-${idx}`))}
    </div>
  );
}

export default InlineChecklist;
