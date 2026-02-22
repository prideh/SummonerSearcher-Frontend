import axios from 'axios';

export interface FeedbackData {
    type: string;
    content: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Submits user feedback to the backend.
 * 
 * @param feedback The feedback data to submit (type and content)
 * @returns A promise that resolves if the submission was successful
 * @throws An error if the submission failed (e.g., rate limited, invalid data)
 */
export const submitFeedback = async (feedback: FeedbackData): Promise<void> => {
    try {
        await axios.post(`${API_BASE_URL}/api/feedback/submit`, feedback, {
            withCredentials: true
        });
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data || 'Failed to submit feedback.');
        } else {
            throw error;
        }
    }
};
