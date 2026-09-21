import React from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('MIRA Application Telemetry Exception:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-lg w-full bg-[#0d1527]/90 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              System Safeguard Active
            </h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              A temporary telemetry or rendering interruption occurred. The safety core intercepted the fault to protect your workspace state.
            </p>

            {this.state.error && (
              <div className="mb-6 p-3.5 bg-black/40 border border-red-500/20 rounded-xl text-left">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Telemetry Intercept Diagnostic</span>
                </div>
                <p className="text-xs text-slate-300 font-mono break-all line-clamp-3">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reconnect Telemetry</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full py-3 px-5 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-200 font-medium rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Home className="w-4 h-4" />
                <span>Return to Bridge</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
