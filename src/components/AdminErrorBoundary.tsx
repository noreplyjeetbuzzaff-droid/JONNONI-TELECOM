import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  onResetToCatalog?: () => void;
}

interface AdminErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class AdminErrorBoundary extends React.Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  constructor(props: AdminErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): AdminErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'অ্যাডমিন ড্যাশবোর্ড লোড করতে অপ্রত্যাশিত ত্রুটি হয়েছে।',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('AdminPanel render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="mx-auto max-w-lg px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-red-200 bg-white p-7 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-slate-900">
              অ্যাডমিন প্যানেল লোড করতে সমস্যা হয়েছে
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {this.state.errorMessage}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  this.setState({ hasError: false, errorMessage: null })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>পুনরায় চেষ্টা করুন</span>
              </button>
              {this.props.onResetToCatalog && (
                <button
                  type="button"
                  onClick={this.props.onResetToCatalog}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  হোম পেজে ফিরুন
                </button>
              )}
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
