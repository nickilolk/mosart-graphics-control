import React from 'react';
import { FIXED_WIDTH } from '../styles/theme.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        width: FIXED_WIDTH, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 20, fontFamily: 'Arial, Helvetica, sans-serif',
        background: '#1a1a1e', color: '#e8e8ec',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#6a6a75', marginBottom: 8 }}>
          Viz Mosart
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>
          Something went wrong
        </h1>
        <div style={{
          width: '100%', padding: '12px 14px', borderRadius: 6,
          background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.3)',
          fontSize: 11, color: '#e53935', lineHeight: 1.6, marginBottom: 20,
          wordBreak: 'break-word',
        }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#5b9bd5', border: 'none', borderRadius: 4, padding: '8px 20px',
            cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>
          Reload
        </button>
      </div>
    );
  }
}
