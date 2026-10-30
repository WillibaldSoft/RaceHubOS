import { Component } from 'react'
import i18n from '../i18n'
import { recoverView } from '../lib/recoverView.mjs'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    if (recoverView(error)) return
    console.error('RaceHubOS view failed:', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-background text-foreground"
      >
        <h1 className="text-2xl font-bold">RaceHubOS</h1>
        <p className="text-lg">{i18n.t('common:pageError')}</p>
        <button
          className="rounded-lg bg-primary text-primary-foreground px-6 py-3"
          onClick={() => window.location.reload()}
        >
          {i18n.t('common:reload')}
        </button>
      </main>
    )
  }
}
