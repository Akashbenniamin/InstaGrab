import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg-main,#0b0f19)] text-[var(--text-primary,#ffffff)] flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-[var(--bg-card,#131b2e)] border border-[var(--border-color,#1e293b)] shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary,#ffffff)]">
              Display Recovery
            </h2>
            <p className="text-xs text-[var(--text-secondary,#94a3b8)] leading-relaxed">
              InstaGrab encountered a temporary display glitch during your download. Your engine, network connection, and downloaded files remain safe.
            </p>
            {this.state.error && (
              <p className="text-[11px] text-red-400 font-mono bg-red-950/40 border border-red-900/50 p-2.5 rounded-xl break-words max-h-24 overflow-y-auto text-left">
                {this.state.error.message || String(this.state.error)}
              </p>
            )}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border border-[var(--border-color,#1e293b)] text-[var(--text-primary,#ffffff)] hover:bg-white/5 transition-colors cursor-pointer"
              >
                Recover View
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  background: 'var(--btn-primary-bg, linear-gradient(135deg, #0284c7 0%, #38bdf8 100%))',
                  color: 'var(--btn-primary-text, #041324)'
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
