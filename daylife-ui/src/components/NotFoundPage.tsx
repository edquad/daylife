import React from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
        <p className="text-gray-500 mb-4">Page not found</p>
        <Link to="/" className="text-brand-600 hover:underline text-sm font-medium">Back to dashboard</Link>
      </div>
    </div>
  );
}
