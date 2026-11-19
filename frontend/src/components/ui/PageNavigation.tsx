import { useState } from 'react'
import {
  AvailabilityNotice,
  HomeNavigation,
} from '../../pages/home/HomeExperience'

/** Shared shell for the existing weather-based game routes. */
export function PageNavigation() {
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <div className="tg-page-nav">
      <HomeNavigation active="none" showPlayerTools showNotice={setNotice} />
      {notice && (
        <AvailabilityNotice message={notice} onClose={() => setNotice(null)} />
      )}
    </div>
  )
}
