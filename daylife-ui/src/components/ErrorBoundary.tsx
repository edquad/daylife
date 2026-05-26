import React, { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p className="text-gray-500 mb-2">Something went wrong loading this page.</p>
          <button onClick={() => this.setState({ hasError: false })} className="text-brand-600 text-sm hover:underline">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
