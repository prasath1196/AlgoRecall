import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-red-500/10 p-4 rounded-full mb-4 animate-bounce">
                        <AlertTriangle size={48} className="text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
                    <p className="text-gray-400 mb-6 max-w-md">
                        The application encountered an unexpected error. We apologize for the inconvenience.
                    </p>

                    <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800 text-left w-full max-w-lg overflow-auto max-h-48">
                        <code className="text-xs text-red-300 font-mono">
                            {this.state.error && this.state.error.toString()}
                        </code>
                    </div>

                    <button
                        onClick={this.handleReload}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        <RefreshCcw size={18} />
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
