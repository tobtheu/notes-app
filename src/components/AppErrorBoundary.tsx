import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 p-8 text-center gap-4">
          <p className="font-bold text-lg">Something went wrong</p>
          <p className="text-sm text-gray-500 font-mono max-w-sm break-all">{this.state.error.message}</p>
          <button type="button" className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
