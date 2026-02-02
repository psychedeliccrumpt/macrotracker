/**
 * Utility functions for local-aware date handling
 */

/**
 * Returns a YYYY-MM-DD string in the CURRENT LOCAL timezone
 */
export const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Parses a numeric timestamp from a database date string.
 * Ensures the date is treated as UTC if it was saved as an ISO string.
 */
export const parseTimestamp = (dateStr: string): number => {
    if (!dateStr) return Date.now();

    // If the string doesn't have a timezone indicator, assume it's UTC 
    // (since we save with .toISOString())
    let adjustedStr = dateStr;
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:?\d{2}$/)) {
        adjustedStr = dateStr.includes('T') ? dateStr + 'Z' : dateStr.replace(' ', 'T') + 'Z';
    }

    return new Date(adjustedStr).getTime();
};

/**
 * Formats a timestamp into a local time string (e.g. "07:26 PM")
 */
export const formatLocalTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

/**
 * Formats a timestamp into a local long date string (e.g. "Monday, Feb 1")
 */
export const formatLocalDateLong = (dateStr: string): string => {
    // Use a date object that is definitely local
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};
