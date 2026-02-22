import React, { useState } from 'react';
import { submitFeedback } from '../api/feedback';

const FeedbackPage: React.FC = () => {
  const [type, setType] = useState('general');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Maximum character length for feedback content
  const maxContentLength = 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!content.trim()) {
      setErrorMsg('Please enter some feedback before submitting.');
      return;
    }
    
    // Prevent spam clicking
    if (isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      await submitFeedback({ type, content });
      setSuccessMsg('Thank you! Your feedback has been submitted.');
      setContent(''); // Clear the form on success
      setType('general');
    } catch (error) {
      if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('An unexpected error occurred while submitting feedback.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 h-full w-full text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-950 px-4 py-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 tracking-wider">
            We Value Your Feedback
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Help us improve SummonerSearcher. Found a bug? Have a feature request? Let us know!
          </p>
        </div>

        <div className="bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border border-gray-200 dark:border-blue-900/30 rounded-2xl p-6 md:p-10 shadow-xl dark:shadow-black/50 relative overflow-hidden">
           {/* Decorative background elements */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

          {/* Feedback Messages */}
          {successMsg && (
            <div className="relative z-10 mb-6 p-4 bg-green-100 dark:bg-green-900/40 border border-green-400 dark:border-green-500/50 text-green-700 dark:text-green-300 rounded-xl font-medium text-sm">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="relative z-10 mb-6 p-4 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-500/50 text-red-700 dark:text-red-300 rounded-xl font-medium text-sm">
              {errorMsg}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            
            {/* Feedback Type Selection */}
            <div className="space-y-2">
              <label htmlFor="feedback-type" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                What kind of feedback do you have?
              </label>
              <div className="relative">
                <select
                  id="feedback-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="block w-full appearance-none bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white py-3 px-4 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors cursor-pointer"
                >
                  <option value="general">General Feedback</option>
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Feedback Content */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label htmlFor="feedback-content" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Your Thoughts
                </label>
                <span className={`text-xs ${content.length > maxContentLength * 0.9 ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}>
                  {content.length} / {maxContentLength}
                </span>
              </div>
              <textarea
                id="feedback-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={maxContentLength}
                rows={6}
                placeholder="Tell us what's on your mind... The more details, the better!"
                className="block w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white py-3 px-4 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors resize-none"
                required
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm md:shadow-md text-sm md:text-base font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-4">
                Please do not include any sensitive personal information.
              </p>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
