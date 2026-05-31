import React from 'react';
import { Link } from 'react-router-dom';
import { applyAppUpdate } from '../lib/appUpdate';

export function NotFoundPage() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
        <p className="text-gray-500 mb-4">Page not found</p>
        <p className="text-xs text-gray-400 mb-4">
          On an old install? Tap Update below or reinstall from{' '}
          <a href="https://edquad.github.io/daylife/" className="text-brand-600 underline">
            edquad.github.io/daylife
          </a>
        </p>
        <div className="flex flex-col gap-2 items-center">
          <Link to="/" className="text-brand-600 hover:underline text-sm font-medium">
            Back to Today
          </Link>
          <button
            type="button"
            onClick={() => void applyAppUpdate()}
            className="text-sm text-gray-600 underline"
          >
            Update app
          </button>
        </div>
      </div>
    </div>
  );
}
