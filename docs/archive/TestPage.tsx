import React from 'react';

const TestPage: React.FC = () => {
  console.log('[TestPage] Minimal component rendering!');

  return (
    <div className="min-h-screen bg-blue-900 text-white p-8"> {/* Different background */}
      <h1 className="text-3xl font-bold">Test Page Rendered!</h1>
      <p>If you see this, ProtectedRoute/Outlet works for /test.</p>
    </div>
  );
};

export default TestPage;