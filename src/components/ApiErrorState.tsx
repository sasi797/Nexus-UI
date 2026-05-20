'use client';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
  status?: number;
}

const statusMessages: Record<number, { title: string; message: string }> = {
  401: { title: 'Session Expired',      message: 'Please log in again to continue.' },
  403: { title: 'Access Denied',        message: 'You do not have permission to view this.' },
  404: { title: 'Not Found',            message: 'The requested resource could not be found.' },
  500: { title: 'Server Error',         message: 'Something went wrong on the server. Please try again.' },
  503: { title: 'Service Unavailable',  message: 'The server is temporarily unavailable.' },
};

export default function ApiErrorState({ title, message, onRetry, status }: Props) {
  const preset = status ? statusMessages[status] : undefined;
  const displayTitle   = title   ?? preset?.title   ?? 'Failed to Load';
  const displayMessage = message ?? preset?.message ?? 'An unexpected error occurred. Please try again.';

  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center space-y-3 max-w-xs">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-gray-800 text-sm">{displayTitle}</p>
          <p className="text-xs text-gray-400 mt-1">{displayMessage}</p>
          {status && <p className="text-[10px] text-gray-300 mt-1 font-mono">HTTP {status}</p>}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-bold text-indigo-600 border border-indigo-200 px-4 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
