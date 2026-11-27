import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'

interface PrivacyTopic {
  icon: IconName
  title: string
  body: ReactNode
}

const PRIVACY_TOPICS: PrivacyTopic[] = [
  {
    icon: 'person',
    title: 'What we store',
    body: (
      <>
        When you create an account, we store your email address, display name, hashed password (or Google account ID),
        avatar, settings, and match history so your stats stay synced. If you play as a guest, your rounds are not
        archived—your avatar, guest name, and preferences stay only on this device.
      </>
    ),
  },
  {
    icon: 'lock',
    title: 'Cookies & browser storage',
    body: (
      <>
        We do not use ads, analytics, or cross-site tracking cookies. We only use strictly functional cookies to keep
        you signed in (<code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-cream">tg_session</code>) and to
        secure Google sign-in (<code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-cream">tg_google_flow</code>),
        plus browser local storage for guest preferences, avatar setup, tutorial state, and active lobbies.
      </>
    ),
  },
  {
    icon: 'timer',
    title: 'How long data is kept',
    body: (
      <>
        Live singleplayer sessions expire after 24 hours and multiplayer lobbies after 2 hours. Archived match history
        for signed-in accounts is automatically purged after 6 months.
      </>
    ),
  },
  {
    icon: 'globe',
    title: 'Third-party services',
    body: (
      <>
        World map tiles are loaded from Esri ArcGIS, typography from Google Fonts, and optional sign-in through Google
        if you choose it. Emails are sent only for verification, email changes, and password resets—never for marketing.
        Weather clues are fetched server-side for game locations without sending personal data.
      </>
    ),
  },
  {
    icon: 'info',
    title: 'Your control',
    body: (
      <>
        You can update your display name or email, or permanently delete your account—which immediately removes your
        profile, preferences, and all saved statistics—anytime from your{' '}
        <Link
          to="/account"
          className="font-bold text-lime-300 underline decoration-lime-300/35 underline-offset-4 hover:text-lime-200"
        >
          Account
        </Link>{' '}
        page.
      </>
    ),
  },
]

export function PrivacyTopicsList() {
  return (
    <div className="divide-y divide-white/6">
      {PRIVACY_TOPICS.map((topic) => (
        <div key={topic.title} className="flex items-start gap-4 px-5 py-5">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
            <Icon name={topic.icon} size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-cream">{topic.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{topic.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PrivacyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="How your data is used"
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/privacy"
            onClick={onClose}
            className="text-sm font-bold text-lime-300 hover:underline"
          >
            Open full page
          </Link>
          <Button size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted">
          TerraGuessr keeps things minimal—no ads, no analytics, and no tracking cookies.
        </p>
        <ul className="flex flex-col gap-3.5">
          {PRIVACY_TOPICS.map((topic) => (
            <li key={topic.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-space-800 text-lime-300">
                <Icon name={topic.icon} size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-cream">{topic.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{topic.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}
