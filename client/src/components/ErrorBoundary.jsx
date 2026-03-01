import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#eef1f8", padding: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2d3748", marginBottom: 8 }}>エラーが発生しました</div>
            <div style={{ fontSize: 13, color: "#a0aec0", marginBottom: 16 }}>予期しないエラーが発生しました</div>
            <button onClick={() => window.location.reload()} style={{ padding: "10px 28px", borderRadius: 10, border: "1px solid #0090d9", background: "transparent", color: "#0090d9", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>再読み込み</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
