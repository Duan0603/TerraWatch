import { useEffect, useCallback } from 'react';

/**
 * Custom React hook for disaster management operations keyboard shortcuts.
 * Automatically ignores keystrokes when focus is inside text input elements.
 * 
 * @param {Record<string, (e: KeyboardEvent) => void>} shortcutMap - Map of shortcut key combination to handler
 * @param {boolean} [enabled=true] - Whether shortcuts are actively listened
 */
export function useKeyboardShortcuts(shortcutMap, enabled = true) {
  const handleKeyDown = useCallback(
    (event) => {
      if (!enabled) return;

      // Do not trigger shortcuts when user is typing in forms/inputs
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable);

      if (isInput) return;

      const key = event.key;
      const isAlt = event.altKey;
      const isCtrl = event.ctrlKey;
      const isShift = event.shiftKey;

      // Formulate lookup keys: e.g. "Escape", "Alt+m", "Alt+l", "Alt+1"
      let lookupKey = '';
      if (isCtrl) lookupKey += 'Ctrl+';
      if (isAlt) lookupKey += 'Alt+';
      if (isShift) lookupKey += 'Shift+';
      lookupKey += key.toLowerCase();

      if (shortcutMap[key] && typeof shortcutMap[key] === 'function') {
        shortcutMap[key](event);
      } else if (shortcutMap[lookupKey] && typeof shortcutMap[lookupKey] === 'function') {
        shortcutMap[lookupKey](event);
      }
    },
    [shortcutMap, enabled]
  );

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

export default useKeyboardShortcuts;
