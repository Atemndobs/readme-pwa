'use client';

export default function SentryTestPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Sentry Test Page</h1>
      <button
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        onClick={() => {
          throw new Error('Test error from Sentry test page');
        }}
      >
        Trigger Test Error
      </button>
    </div>
  );
}
