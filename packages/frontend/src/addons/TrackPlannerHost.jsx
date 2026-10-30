import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { emptyTrackPlan, readTrackPlan } from '@racehubos/shared'
import { useApp } from '../context/AppContext'
import { useTrackPlanner } from './FeatureState'
import { Button } from '../components/ui/button'
const channel = 'racehubos:track-planner:1'
const api = import.meta.env.VITE_API_URL || ''

export default function AddonTrackEditor(props) {
  const { t, i18n } = useTranslation('addons')
  const { isDark } = useApp()
  const { available, entry } = useTrackPlanner()
  const frame = useRef(null),
    latest = useRef(props)
  useLayoutEffect(() => {
    latest.current = props
  })
  const [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false)
  const opened = available && props.expanded
  const url = entry ? new URL(`${api}${entry}`, window.location.href) : null
  if (url) url.hash = new URLSearchParams({ host: window.location.origin }).toString()
  const origin = url?.origin
  useEffect(() => {
    if (!opened) return
    const timeout = setTimeout(() => setFailed(true), 15000)
    function receive(event) {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin || event.data?.channel !== channel)
        return
      const p = latest.current
      if (event.data.type === 'ready') {
        clearTimeout(timeout)
        setReady(true)
        event.source.postMessage(
          {
            channel,
            type: 'init',
            language: i18n.resolvedLanguage,
            dark: isDark,
            draft: { plan: p.value, name: p.trackName, importAsNew: false },
          },
          origin
        )
      }
      const draft = event.data.draft
      if (['change', 'save'].includes(event.data.type)) {
        const plan = readTrackPlan(draft?.plan)
        if (!plan || typeof draft?.name !== 'string' || draft.name.length > 150) {
          setFailed(true)
          return
        }
        p.onChange(plan)
        p.onNameChange(draft.name)
        if (draft.importAsNew) p.onImportNew?.(draft.name)
        if (event.data.type === 'save')
          p.onSave({
            plan,
            name: draft.name,
            importAsNew: !!draft.importAsNew,
          })
      }
      if (event.data.type === 'cancel') {
        if (!p.value?.pieces.length) p.onChange(null)
        p.onExpandedChange(false)
      }
    }
    window.addEventListener('message', receive)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('message', receive)
    }
  }, [opened, origin, i18n.resolvedLanguage, isDark])
  useEffect(() => {
    if (ready)
      frame.current?.contentWindow?.postMessage(
        {
          channel,
          type: 'status',
          status: {
            saving: props.saving,
            error: props.statusError,
            success: props.statusSuccess,
          },
        },
        origin
      )
  }, [ready, props.saving, props.statusError, props.statusSuccess, origin])
  if (!available)
    return (
      <p data-testid="planner-unavailable" className="text-sm text-muted-foreground">
        {t('unavailable')}
      </p>
    )
  return (
    <>
      <Button
        type="button"
        data-testid="enable-track-editor"
        variant="outline"
        onClick={() => {
          setReady(false)
          setFailed(false)
          if (!props.value) props.onChange(emptyTrackPlan())
          props.onExpandedChange(true)
        }}
      >
        {t('open')}
      </Button>
      {opened && (
        <section className="fixed inset-0 z-[90] bg-background" data-testid="planner-addon-host">
          {!ready && !failed && <p role="status">{t('loading')}</p>}
          <Button
            type="button"
            data-testid="close-planner-addon"
            className="absolute right-2 bottom-2 z-10"
            onClick={() => {
              if (!props.value?.pieces.length) props.onChange(null)
              props.onExpandedChange(false)
            }}
          >
            {t('close')}
          </Button>
          {failed ? (
            <p role="alert" className="p-8">
              {t('loadError')}
            </p>
          ) : (
            <iframe
              ref={frame}
              data-testid="planner-addon-frame"
              title={t('title')}
              src={url.href}
              className="h-full w-full border-0"
              onError={() => setFailed(true)}
            />
          )}
        </section>
      )}
    </>
  )
}
