import { Component, type ErrorInfo, type ReactNode } from "react";

interface WorldBoundaryProps {
  readonly children: ReactNode;
}

interface WorldBoundaryState {
  readonly failed: boolean;
}

export class WorldBoundary extends Component<WorldBoundaryProps, WorldBoundaryState> {
  override state: WorldBoundaryState = { failed: false };

  static getDerivedStateFromError(): WorldBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("The 3D world failed to load.", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <section className="world-load-error" role="alert">
      <span className="eyebrow">THE THREAD SNAGGED</span>
      <h1>Meadowrest could not open.</h1>
      <p>Your local save is safe. Reconnect if needed, then try loading the world again.</p>
      <button className="primary" onClick={() => location.reload()}>Reload Everloom</button>
    </section>;
  }
}
