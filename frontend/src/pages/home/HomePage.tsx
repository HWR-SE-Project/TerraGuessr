import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { SectionErrorBoundary } from '../../components/layout/ErrorFallback'
import { useSession } from '../../state/session'
import { warmSingleplayer } from '../../state/singleplayerWarmup'
import { fadeUp, staggerContainer, staggerItem } from '../../lib/motion'
import { AvatarCustomizeMenu } from './AvatarCustomizeMenu'
import earthFallback from '../../assets/images/earth-horizon.webp'

// Keep the 3D scene out of the initial bundle.
const HomeScene = lazy(() =>
  import('../../scene/HomeScene').then((m) => ({ default: m.HomeScene })),
)

export function HomePage() {
  const navigate = useNavigate()
  const session = useSession()

  return (
    <section
      className="relative isolate flex h-[calc(100dvh-6.5rem)] min-h-[460px] flex-col justify-stretch px-4 pb-2 pt-1 sm:h-auto sm:min-h-[calc(100svh-6.5rem)] sm:justify-center sm:px-6 sm:pb-4 sm:pt-5 md:px-8 md:pb-6 md:pt-6"
      aria-labelledby="home-heading"
    >
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="mx-auto grid h-full w-full max-w-6xl grid-cols-1 grid-rows-[auto_minmax(190px,1fr)_auto] items-center justify-items-center sm:h-auto sm:grid-rows-[auto_auto_auto]"
      >
        <div className="relative z-[2] text-center">
          <motion.h1
            variants={staggerItem}
            id="home-heading"
            className="text-balance text-[clamp(1.9rem,8.2vw,2.5rem)] leading-[1.06] font-medium tracking-[-0.035em] sm:text-[clamp(2.35rem,5.5vw,3rem)] sm:leading-[1.1] md:text-[clamp(2.75rem,4.5vw,4rem)]"
          >
            <span className="block sm:inline">Small world.</span>{' '}
            <span className="text-lime-400">Big adventure.</span>
          </motion.h1>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-2 max-w-[330px] text-pretty text-sm leading-snug text-muted sm:mt-3.5 sm:max-w-[510px] sm:text-base sm:leading-relaxed md:max-w-[570px]"
          >
            Find yourself somewhere unexpected. Read the weather, explore the biome,
            and guess your spot on Earth.
          </motion.p>
        </div>

        <motion.div
          variants={fadeUp}
          className="relative mx-auto mt-1 h-full max-h-[360px] w-full min-w-0 max-w-[540px] [--world-inset-b:12px] sm:mt-2 sm:h-[clamp(260px,44svh,420px)] sm:max-h-none sm:[--world-inset-b:56px] md:h-[clamp(360px,49svh,500px)] md:max-w-[640px]"
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_50%_45%,rgb(113_83_185/24%),rgb(66_101_133/12%)_42%,transparent_70%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[45%] aspect-square max-h-[92%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/12 after:absolute after:left-[14%] after:top-[15%] after:size-1.5 after:rounded-full after:bg-violet-300 after:shadow-[0_0_14px_rgb(181_155_255/60%)] sm:w-[min(82%,440px)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[45%] aspect-square max-h-[76%] w-[min(68%,360px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-violet-300/8 after:absolute after:left-[86%] after:top-[82%] after:size-1 after:rounded-full after:bg-lime-300"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-[76%] top-[24%] rotate-10 text-lime-300"
            aria-hidden="true"
          >
            <Icon name="sparkle" size={25} />
          </div>
          <div
            className="pointer-events-none absolute right-[78%] top-[60%] text-violet-300"
            aria-hidden="true"
          >
            <Icon name="plus" size={16} />
          </div>
          <div
            className="absolute inset-x-0 top-0 bottom-[var(--world-inset-b)]"
            role="img"
            aria-label="Your explorer standing on a miniature, rotating Earth"
          >
            <SectionErrorBoundary
              name="HomeScene"
              fallback={
                <div
                  className="absolute inset-x-[5%] top-[12%] bottom-[3%] overflow-hidden rounded-full [mask-image:radial-gradient(ellipse,black_30%,transparent_70%)]"
                  aria-hidden="true"
                >
                  <img
                    src={earthFallback}
                    alt=""
                    fetchPriority="high"
                    className="h-full w-full object-cover"
                  />
                </div>
              }
            >
              <Suspense
                fallback={
                  <div
                    className="absolute inset-x-[5%] top-[12%] bottom-[3%] overflow-hidden rounded-full [mask-image:radial-gradient(ellipse,black_30%,transparent_70%)]"
                    aria-hidden="true"
                  >
                    <img
                      src={earthFallback}
                      alt=""
                      fetchPriority="high"
                      className="h-full w-full object-cover"
                    />
                  </div>
                }
              >
                <HomeScene />
              </Suspense>
            </SectionErrorBoundary>
            <div className="home-character-slot pointer-events-none absolute left-1/2 top-[3%] h-[52%] w-[46%] -translate-x-1/2" />
          </div>
          {/* Tracks the seam where the explorer's feet meet the planet (~53.4% of the scene height). */}
          <div className="absolute left-1/2 top-[calc(53.4%-var(--world-inset-b)*0.534)] z-[2] -translate-x-1/2 -translate-y-1/2">
            <AvatarCustomizeMenu />
          </div>
        </motion.div>

        <motion.div variants={staggerItem} className="relative z-[3] mt-2 w-full text-center sm:mt-5 sm:w-auto">
          <div className="flex flex-nowrap items-center justify-center gap-2.5 sm:flex-wrap sm:gap-3">
            <Button
              size="lg"
              icon="play"
              className="min-w-0 flex-1 max-sm:h-12 max-sm:gap-1.5 max-sm:px-3 max-sm:text-[0.95rem] sm:h-[60px] sm:flex-none sm:px-6"
              onPointerEnter={warmSingleplayer}
              onFocus={warmSingleplayer}
              onClick={() => navigate('/singleplayer')}
            >
              Singleplayer
            </Button>
            <Button
              to="/multiplayer"
              variant="secondary"
              size="lg"
              icon="users"
              className="min-w-0 flex-1 border-violet-300/25 bg-[linear-gradient(180deg,rgb(255_255_255/5%),rgb(0_0_0/14%))] hover:border-violet-300/45 max-sm:h-12 max-sm:gap-1.5 max-sm:px-3 max-sm:text-[0.95rem] sm:h-[60px] sm:flex-none sm:px-6"
            >
              Multiplayer
            </Button>
          </div>
          {session.status === 'guest' && (
            <p className="mt-1.5 text-balance text-[0.8125rem] leading-snug text-subtle sm:mt-2.5 sm:leading-relaxed">
              Make every discovery count.{' '}
              <Link
                to="/auth"
                className="font-extrabold text-cream underline decoration-cream/30 underline-offset-4 hover:text-lime-300"
              >
                Create a free account
              </Link>
            </p>
          )}
        </motion.div>
      </motion.div>
    </section>
  )
}
