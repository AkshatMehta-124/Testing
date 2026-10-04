/**
 * Utility for normalizing various timestamp formats into a standard JS Date or ms timestamp.
 * Handles Firestore Timestamp, numeric (ms or sec), JS Date, missing values.
 */

export function normalizeTimestamp(ts) {
    if (!ts) return null;

    // Firestore Timestamp
    if (typeof ts.toDate === 'function') {
        return ts.toDate();
    }
    
    // JS Date
    if (ts instanceof Date) {
        return ts;
    }

    // Number (could be ms or seconds)
    if (typeof ts === 'number') {
        // Assume ms if > 10000000000 (approx year 1970 vs 2286)
        if (ts < 10000000000) {
            return new Date(ts * 1000);
        }
        return new Date(ts);
    }

    // String (ISO string)
    if (typeof ts === 'string') {
        const parsed = new Date(ts);
        if (!isNaN(parsed.valueOf())) {
            return parsed;
        }
    }

    // Firestore Timestamp serialized (e.g., {seconds, nanoseconds})
    if (ts.seconds !== undefined) {
        return new Date(ts.seconds * 1000);
    }

    return null;
}

export function formatTime(ts) {
    const date = normalizeTimestamp(ts);
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(ts) {
    const date = normalizeTimestamp(ts);
    if (!date) return "";
    return date.toLocaleDateString();
}
