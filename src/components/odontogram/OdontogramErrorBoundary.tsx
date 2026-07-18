import React from "react";

interface OdontogramErrorBoundaryProps {
  children: React.ReactNode;
}

interface OdontogramErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class OdontogramErrorBoundary extends React.Component<
  OdontogramErrorBoundaryProps,
  OdontogramErrorBoundaryState
> {
  constructor(props: OdontogramErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): OdontogramErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error?.message ||
        "Ocorreu um erro inesperado ao carregar o odontograma.",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Erro no odontograma:", error);
    console.error("Informações adicionais:", errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-3 text-lg font-semibold text-rose-700">
              Não foi possível carregar o odontograma
            </div>

            <p className="mb-5 text-sm leading-relaxed text-rose-600">
              {this.state.errorMessage}
            </p>

            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
