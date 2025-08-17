import { useEffect } from 'react';

/**
 * Custom hook to dynamically update the page title
 * @param title - The page title, will be formatted as "extrapl • {title}"
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    // Use a blue dot (bullet) character for the separator
    const formattedTitle = title ? `extrapl • ${title}` : 'extrapl';
    document.title = formattedTitle;
    
    // Cleanup: reset to default when component unmounts
    return () => {
      document.title = 'extrapl';
    };
  }, [title]);
}