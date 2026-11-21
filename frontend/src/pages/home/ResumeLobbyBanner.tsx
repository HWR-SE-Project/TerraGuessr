import { Icon } from '../../components/ui/Icon'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useCurrentLobby } from '../../game/useCurrentLobby'
import { noticeVariants } from '../../lib/motion'

export function ResumeLobbyBanner() {
  const lobby = useCurrentLobby()

  return (
    <AnimatePresence>
      {lobby && (
        <motion.aside
          key={lobby.code}
          className="th-resume"
          aria-label="Return to lobby"
          variants={noticeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <span className="th-resume-icon" aria-hidden="true">
            <Icon name="users" />
          </span>
          <span className="th-resume-copy">
            <strong>Your multiplayer lobby is still open</strong>
            <small>
              Lobby {lobby.code} · {lobby.members.length} players ·{' '}
              {lobby.status === 'playing'
                ? 'match in progress'
                : lobby.status === 'finished'
                  ? 'final results ready'
                  : 'waiting room'}
            </small>
          </span>
          <Link
            to={`/lobby/${lobby.code}`}
            className="th-resume-action tg-control tg-control--primary"
          >
            Return to lobby <Icon name="arrow" />
          </Link>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
