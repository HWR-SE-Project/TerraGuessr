import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useSession } from '../../state/session'
import { fadeUp, staggerContainer, staggerItem } from '../../lib/motion'
import { AvatarCustomizeMenu } from './AvatarCustomizeMenu'
import earthFallback from '../../assets/images/earth-horizon.webp'
import './HomePage.css'

// Keep the 3D scene out of the initial bundle.
const HomeScene = lazy(() =>
  import('../../scene/HomeScene').then((m) => ({ default: m.HomeScene })),
)

export function HomePage() {
  const navigate = useNavigate()
  const session = useSession()

  return (
    <section className="home-hero" aria-labelledby="home-heading">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="home-hero-layout"
      >
        <div className="home-intro">
          <motion.h1 variants={staggerItem} id="home-heading" className="home-heading">
            <span className="home-heading-lead">Small world.</span>{' '}
            <span>Big adventure.</span>
          </motion.h1>
          <motion.p variants={staggerItem} className="home-description">
            Find yourself somewhere unexpected. Read the weather, explore the biome,
            and guess your spot on Earth.
          </motion.p>
        </div>

        <motion.div variants={fadeUp} className="home-world">
          <div className="home-world-halo" aria-hidden="true" />
          <div className="home-orbit home-orbit-outer" aria-hidden="true" />
          <div className="home-orbit home-orbit-inner" aria-hidden="true" />
          <div className="home-world-spark home-world-spark-one" aria-hidden="true">
            <Icon name="sparkle" size={25} />
          </div>
          <div className="home-world-spark home-world-spark-two" aria-hidden="true">
            <Icon name="plus" size={16} />
          </div>
          <div className="home-world-scene" role="img" aria-label="Your explorer standing on a miniature, rotating Earth">
            <Suspense fallback={
              <div className="home-scene-fallback" aria-hidden="true">
                <img src={earthFallback} alt="" fetchPriority="high" />
              </div>
            }>
              <HomeScene />
            </Suspense>
            <div className="home-character-slot" />
          </div>
          <div className="home-explorer-control">
            <AvatarCustomizeMenu />
          </div>
        </motion.div>

        <motion.div variants={staggerItem} className="home-play-area">
          <div className="home-play-actions">
            <Button size="lg" icon="play" className="home-primary-cta" onClick={() => navigate('/singleplayer')}>
              Play singleplayer
            </Button>
            <Link to="/multiplayer" className="btn-base home-multiplayer-cta">
              <Icon name="users" size={21} />
              Multiplayer
            </Link>
          </div>
          {session.status === 'guest' && (
            <p className="home-account-note">
              Make every discovery count.{' '}
              <Link to="/auth">Create a free account</Link>
            </p>
          )}
        </motion.div>
      </motion.div>

    </section>
  )
}
