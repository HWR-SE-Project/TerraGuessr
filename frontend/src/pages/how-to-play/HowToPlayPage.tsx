import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppHeader } from '../../components/layout/AppHeader'
import { Icon } from '../../components/ui/Icon'
import { DIFFICULTY_LEVELS } from '../../game/difficulty'
import { haversineKm } from '../../lib/distance'
import { FULL_SCORE_KM, MAX_SCORE, ZERO_SCORE_KM, scoreForDistance } from '../../lib/scoring'
import { staggerContainer, staggerItem } from '../../lib/motion'
import '../../components/ui/Button.css'
import './HowToPlayPage.css'

const exampleDistance = haversineKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })
const steps = [
  { title: 'Look around', copy: 'Each round drops you into a mystery Street View location. Look around for road signs, languages, buildings, vegetation and which side of the road people drive on.' },
  { title: 'Follow the clues', copy: 'Open Geographic Intelligence to read the weather. Temperature, rainfall, humidity and wind can help narrow down the region. Additional weather and environment clues are free on Easy; on Medium and Hard, you can unlock them for points or time.' },
  { title: 'Choose your location', copy: 'On Easy, choose from six locations. On Medium and Hard, tap or click the world map to place a pin. Zoom in to be more precise. You can change your selection before submitting.' },
  { title: 'Make your guess', copy: 'Press Guess before the timer runs out. If you have attempts left, refine your answer and try again, or use Final submit to finish the round. Your best submitted attempt counts. After the reveal, compare your guess with the actual location and continue to the next round.' },
]

export function HowToPlayPage() {
  const [distance, setDistance] = useState(500)
  return (
    <div className="htp-page">
      <a className="htp-skip" href="#how-to-play">Skip to guide</a>
      <AppHeader />
      <motion.main
        id="how-to-play"
        className="htp-main"
        tabIndex={-1}
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.header className="htp-intro" variants={staggerItem}>
          <span className="htp-eyebrow"><Icon name="help" /> Your explorer’s guide</span>
          <h1>How to <span>play.</span></h1>
          <p>A mystery location. A few clues. Your best guess.<br />Here’s how to find your place in the world.</p>
          <a className="htp-jump" href="#round-guide">Learn the basics <span aria-hidden="true">↓</span></a>
        </motion.header>

        <motion.section id="round-guide" className="htp-rounds" aria-labelledby="round-guide-title" variants={staggerItem}>
          <div className="htp-section-heading"><span className="htp-eyebrow">The basics</span><h2 id="round-guide-title">From somewhere to somewhere you know.</h2></div>
          <ol className="htp-steps">
            {steps.map(({ title, copy }, index) => (
              <li key={title}>
                <span className="htp-step-number" aria-hidden="true">0{index + 1}</span>
                <div><h3>{title}</h3><p>{copy}</p></div>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.section className="htp-difficulty" aria-labelledby="difficulty-guide-title" variants={staggerItem}>
          <div className="htp-section-heading"><span className="htp-eyebrow">Find your pace</span><h2 id="difficulty-guide-title">Choose your challenge.</h2><p>Pick a difficulty before starting. Time and attempts reset each round.</p></div>
          <div className="htp-levels">
            {DIFFICULTY_LEVELS.map(level => (
              <article key={level.id} className={`htp-level htp-level--${level.id}`}>
                <h3>{level.label}</h3>
                <p className="htp-selection"><Icon name="pin" />{level.selection}</p>
                <p>{level.detail}</p>
              </article>
            ))}
          </div>
          <p className="htp-note">New here? Easy gives you more time, a shortlist of locations and free additional clues.</p>
        </motion.section>

        <motion.section className="htp-scoring" aria-labelledby="scoring-guide-title" variants={staggerItem}>
          <div className="htp-score-copy">
            <span className="htp-eyebrow">Every kilometre counts</span>
            <h2 id="scoring-guide-title">Get closer.<br /><span>Score higher.</span></h2>
            <p>Your score depends on the geographic distance between your guess and the actual location. Earn up to {MAX_SCORE.toLocaleString('en-US')} points per round: guesses within {FULL_SCORE_KM} km receive full points, with the score decreasing to zero at {ZERO_SCORE_KM.toLocaleString('en-US')} km.</p>
            <p>For example, a guess in London for a location in Paris is about {exampleDistance.toFixed(1)} km away. Additional clues on Medium deduct 100 points from your round score; on Hard, they take 20 seconds off your remaining time.</p>
          </div>
          <div className="htp-score-demo">
            <span className="htp-eyebrow">Try an example</span>
            <output className="htp-example-score" aria-label="Example score" aria-live="polite">{scoreForDistance(distance).toLocaleString('en-US')}<span> / {MAX_SCORE.toLocaleString('en-US')} pts</span></output>
            <label htmlFor="example-distance">Distance from the actual location<strong>{distance.toLocaleString('en-US')} km</strong></label>
            <input id="example-distance" aria-label="Example distance in kilometers" type="range" min="0" max={ZERO_SCORE_KM} step="50" value={distance} onChange={event => setDistance(Number(event.target.value))} />
            <div className="htp-range-labels" aria-hidden="true"><span>Right there</span><span>A world away</span></div>
            <p>Example score before any clue cost.</p>
          </div>
        </motion.section>

        <motion.footer className="htp-ready" variants={staggerItem}>
          <div><h2>The world is waiting.</h2><p>Singleplayer has endless rounds. End your expedition from the game menu whenever you’re ready to see your total score.</p></div>
          <Link className="tg-button tg-button--primary tg-button--lg tg-control tg-control--primary htp-play" to="/game/singleplayer">Let’s explore <Icon name="arrow" /></Link>
        </motion.footer>
        <motion.p className="htp-multiplayer" variants={staggerItem}>Exploring together? <Link to="/multiplayer/create">Create a multiplayer lobby</Link> or <Link to="/multiplayer/join">join with a code</Link>. The lobby host chooses the difficulty.</motion.p>
      </motion.main>
    </div>
  )
}
