import type { CSSProperties, ReactNode } from 'react';
import './HomePageSection.css';

import image from '../assets/home-page/desktop/image.png';
import image1 from '../assets/home-page/desktop/image1.png';
import image2 from '../assets/home-page/desktop/image2.png';
import subscriptionIllustration from '../assets/home-page/desktop/subscription-illustration.png';
import patrickImg from '../assets/home-page/desktop/patrick.png';
import unclepandaImg from '../assets/home-page/desktop/unclepanda.png';
import image5 from '../assets/home-page/desktop/image5.png';
import image6 from '../assets/home-page/desktop/image6.png';
import image7 from '../assets/home-page/desktop/image7.png';
import shadowImg from '../assets/home-page/desktop/shadow.png';
import image8 from '../assets/home-page/desktop/image8.png';
import shadow1Img from '../assets/home-page/desktop/shadow1.png';
import image9 from '../assets/home-page/desktop/image9.png';
import itemLinkImg from '../assets/home-page/desktop/item-link.png';
import image10 from '../assets/home-page/desktop/image10.png';
import itemLink1Img from '../assets/home-page/desktop/item-link1.png';
import image11 from '../assets/home-page/desktop/image11.png';
import buttonImg from '../assets/home-page/desktop/button.png';
import image12 from '../assets/home-page/desktop/image12.png';
import proLockImg from '../assets/home-page/desktop/pro-lock.png';
import playHorrorGuessrNowImg from '../assets/home-page/desktop/play-horror-guessr-now.png';
import containerImg from '../assets/home-page/desktop/container.png';
import avatarWebpImg from '../assets/home-page/desktop/avatar-webp.png';
import image13 from '../assets/home-page/desktop/image13.png';
import overlayImg from '../assets/home-page/desktop/overlay.png';
import bgBrcImg from '../assets/home-page/desktop/bg-brc.png';
import image14 from '../assets/home-page/desktop/image14.png';
import bgBrdImg from '../assets/home-page/desktop/bg-brd.png';
import image15 from '../assets/home-page/desktop/image15.png';
import twitchSvg from '../assets/home-page/desktop/group.svg';
import redditSvg from '../assets/home-page/desktop/reddit.svg';
import discordGlyphSvg from '../assets/home-page/desktop/group2.svg';
import facebookSvg from '../assets/home-page/desktop/facebook.svg';
import instagramSvg from '../assets/home-page/desktop/instagram.svg';
import xSvg from '../assets/home-page/desktop/x.svg';
import youtubeSvg from '../assets/home-page/desktop/youtube.svg';
import tiktokSvg from '../assets/home-page/desktop/tiktok.svg';
import checkmarkSvg from '../assets/home-page/desktop/checkmark.svg';
import flagImg3 from '../assets/home-page/desktop/image3.svg';
import flagImg4 from '../assets/home-page/desktop/image4.svg';
import arrowLeftSvg from '../assets/home-page/desktop/arrow-left.svg';
import logoSvg from '../assets/home-page/desktop/logo.svg';
import dividerVectorSvg from '../assets/home-page/desktop/vector.svg';
import searchIconSvg from '../assets/home-page/desktop/search-icon.svg';
import streakCalIconSvg from '../assets/home-page/desktop/svg.svg';
import closeSvg from '../assets/home-page/desktop/button-svg.svg';
import plusSvg from '../assets/home-page/desktop/button-svg1.svg';
import highlightFrameSvg from '../assets/home-page/desktop/frame.svg';
import clubIconSvg from '../assets/home-page/desktop/svg1.svg';
import chevronVector4Svg from '../assets/home-page/desktop/vector4.svg';
import chevronVector5Svg from '../assets/home-page/desktop/vector5.svg';

import mImage from '../assets/home-page/mobile/image.png';
import mImage1 from '../assets/home-page/mobile/image1.png';
import mImage2 from '../assets/home-page/mobile/image2.png';
import mSubscriptionIllustration from '../assets/home-page/mobile/subscription-illustration.png';
import mFlagImg3 from '../assets/home-page/mobile/image3.png';
import mFlagImg4 from '../assets/home-page/mobile/image4.png';
import mImage5 from '../assets/home-page/mobile/image5.png';
import mHomeIcon from '../assets/home-page/mobile/image6.png';
import mDailyIcon from '../assets/home-page/mobile/image7.png';
import mCompetitiveIcon from '../assets/home-page/mobile/image8.png';
import mWorldIcon from '../assets/home-page/mobile/image9.png';
import mContainerImg from '../assets/home-page/mobile/container.png';
import mAvatarWebpImg from '../assets/home-page/mobile/avatar-webp.png';
import mSearchIconSvg from '../assets/home-page/mobile/search-icon.svg';
import mBellSvg from '../assets/home-page/mobile/svg1.svg';
import mHamburgerSvg from '../assets/home-page/mobile/hamburger.svg';
import mTwitchSvg from '../assets/home-page/mobile/group.svg';
import mRedditSvg from '../assets/home-page/mobile/reddit.svg';
import mDiscordGlyphSvg from '../assets/home-page/mobile/group2.svg';
import mFacebookSvg from '../assets/home-page/mobile/facebook.svg';
import mInstagramSvg from '../assets/home-page/mobile/instagram.svg';
import mXSvg from '../assets/home-page/mobile/x.svg';
import mYoutubeSvg from '../assets/home-page/mobile/youtube.svg';
import mTiktokSvg from '../assets/home-page/mobile/tiktok.svg';
import mCheckmarkSvg from '../assets/home-page/mobile/checkmark.svg';

const boldItalic: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontStyle: 'italic' };
const blackItalic: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 900, fontStyle: 'italic' };
const regular: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 400 };

const gradientPillText: CSSProperties = {
  background: 'linear-gradient(to bottom, #ffffff 6.5%, #d5d5f3)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

function PillButton({ left, top, width, label, big }: { left: number; top: number; width: number; label: string; big?: boolean }) {
  return (
    <div className="hp-abs" style={{ left, top, width, height: big ? 32.66 : 28, borderRadius: 32.67 }}>
      <div
        className="hp-abs"
        style={{ inset: 0, borderRadius: 32.67, background: 'linear-gradient(to bottom, #a685ff, #4a2399)', boxShadow: 'inset 0px 0.875px 0px 0px rgba(255,255,255,0.2), inset 0px -1.75px 0px 0px rgba(0,0,0,0.3)' }}
      />
      <div
        className="hp-abs"
        style={{ ...boldItalic, ...gradientPillText, left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: big ? 12.7 : 10.7, textTransform: 'uppercase' }}
      >
        {label}
      </div>
    </div>
  );
}

function SocialRow({ left, top, icons, size = 1 }: { left: number; top: number; icons: string[]; size?: number }) {
  return (
    <div className="hp-abs" style={{ left, top, height: 28 }}>
      {icons.map((src, i) => (
        <div
          key={i}
          className="hp-abs"
          style={{
            left: i * 58 * size,
            top: 0,
            width: 28,
            height: 28,
            opacity: 0.5,
            borderRadius: 16,
            background: 'radial-gradient(circle at center, rgba(57,50,115,0.2) 0%, #393273 100%)',
            boxShadow: 'inset 0px 1px 2px 0px #8f86e6',
          }}
        >
          <img src={src} alt="" style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', width: 12, height: 12 }} />
        </div>
      ))}
    </div>
  );
}

function CoinBadge({ left, top }: { left: number; top: number }) {
  return (
    <div className="hp-abs" style={{ left, top, width: 36, height: 36, borderRadius: 18 }}>
      <div className="hp-abs" style={{ inset: 0, borderRadius: 18, boxShadow: '0px 0px 0px 2px #10101c, 0px 0px 0px 3px rgba(255,255,255,0.1)' }} />
      <div className="hp-abs" style={{ left: 3, top: 3, width: 30, height: 30, borderRadius: 15, background: '#11101f' }} />
      <div
        className="hp-abs"
        style={{
          inset: 0,
          borderRadius: 18,
          background: 'radial-gradient(circle at center, #10101c 0%, #10101c 30%, transparent 50%, transparent 100%)',
        }}
      />
      <div
        className="hp-abs"
        style={{ ...blackItalic, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffcf4a', fontSize: 16, textTransform: 'uppercase' }}
      >
        4
      </div>
    </div>
  );
}

function Frame({
  children,
  style,
  frameName,
}: {
  children: ReactNode;
  style: CSSProperties;
  frameName: string;
}) {
  return (
    <div className="hp-frame" style={style} data-figma-frame={frameName}>
      {children}
    </div>
  );
}

export function HomePageSectionDesktop() {
  return (
    <Frame style={{ width: 1920, height: 2400 }} frameName="home-page-desktop">
      <div className="hp-abs" style={{ left: 0, top: 0, width: 1920, height: 1200, overflow: 'hidden' }}>
        <div
          className="hp-abs"
          style={{
            inset: 0,
            backgroundImage:
              'radial-gradient(ellipse 128px 265px at 2612px -737px, rgba(58,232,189,0.5) 0%, rgba(58,232,189,0) 92%),' +
              'radial-gradient(ellipse 180px 152px at 560px -675px, rgba(58,232,189,0.8) 0%, rgba(58,232,189,0) 92%),' +
              'radial-gradient(ellipse 165px 122px at -329px -298px, rgba(121,80,229,1) 0%, rgba(121,80,229,0) 92%),' +
              'linear-gradient(90deg, #171235 0%, #171235 100%)',
          }}
        />
        <div
          className="hp-abs"
          style={{ inset: 0, backgroundImage: 'radial-gradient(circle at 960px 600px, #211a4c 0%, #120e2d 27.5%, #0b081e 41.25%, #04020e 55%)' }}
        />

        {/* Main content area */}
        <div className="hp-abs" style={{ left: 80, top: 60, width: 1784, height: 1140, overflow: 'hidden' }}>
          {/* Avatar scene */}
          <div className="hp-abs" style={{ left: 189.17, top: 16, width: 1302, height: 1108, overflow: 'hidden' }}>
            <img src={image} alt="" className="hp-abs" style={{ left: '50%', bottom: -240, width: 720, height: 720, transform: 'translateX(-50%)' }} />
            <img src={image1} alt="" className="hp-abs" style={{ left: '50%', bottom: 240, width: 720, height: 720, transform: 'translateX(-50%)' }} />
            <div className="hp-abs" style={{ left: '50%', top: '72.05%', width: 88.78, transform: 'translateX(-50%)' }}>
              <PillButton left={0} top={0} width={88.78} label="Edit avatar" />
              <div className="hp-abs" style={{ right: -8, top: -4, width: 5.25, height: 5.25, borderRadius: 5.25, background: '#ffa43d' }} />
            </div>
          </div>

          {/* Horror mode banner */}
          <div className="hp-abs" style={{ left: 1338, top: 284.59, right: 20, height: 100.42, borderRadius: 16, border: '4px solid rgba(23,18,53,0.9)', boxShadow: 'inset 0px 0px 4px 0px rgba(121,80,229,0.8)' }}>
            <div className="hp-abs" style={{ inset: 0, borderRadius: 16, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 40%), linear-gradient(90deg, rgba(23,18,53,0.9), rgba(23,18,53,0.9))' }} />
            <div className="hp-abs" style={{ inset: 0, borderRadius: 16, border: '1px solid #393273' }} />
            <div className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 100.42, borderRadius: 12, border: '3px solid #dc1934', background: '#1a1a26', overflow: 'hidden' }}>
              <img src={image2} alt="" className="hp-abs" style={{ left: 8, top: 12, width: 88, height: 82.42 }} />
              <div className="hp-abs" style={{ left: 108, top: 14, color: '#dc1934', fontSize: 13.1, textTransform: 'uppercase' }}>Play our free horrormode</div>
              <div className="hp-abs" style={{ left: 108, top: 52.3, width: 82.56, height: 28, borderRadius: 28 }}>
                <div className="hp-abs" style={{ inset: 0, borderRadius: 28, background: 'linear-gradient(to bottom, #97e851, #479440)', boxShadow: 'inset 0px 0.75px 0px 0px rgba(255,255,255,0.2), inset 0px -1.5px 0px 0px rgba(0,0,0,0.3)' }} />
                <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.7, textTransform: 'uppercase' }}>Play now</div>
              </div>
            </div>
          </div>

          <SocialRow
            left={1334}
            top={1096}
            icons={[twitchSvg, redditSvg, discordGlyphSvg, facebookSvg, instagramSvg, xSvg, youtubeSvg, tiktokSvg]}
          />

          {/* Subscription panel */}
          <div className="hp-abs" style={{ left: 1334, top: 421.02, right: 16, height: 394.41, borderRadius: 12, background: '#351370', overflow: 'hidden' }}>
            <img src={subscriptionIllustration} alt="" className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 192 }} />
            <div className="hp-abs" style={{ ...boldItalic, left: 16, right: 54.46, top: 216, fontSize: 23.1, color: '#fff' }}>Subscribe to play without limits!</div>
            <div className="hp-abs" style={{ left: 16, right: 16, top: 254 }}>
              {['Ad free, unlimited play', '1000s of maps', 'Play on web, apps or Steam'].map((label, i) => (
                <div key={label} className="hp-abs" style={{ left: 0, right: 0, top: i * 26.25, height: 19.25 }}>
                  <div className="hp-abs" style={{ left: 0, top: 0.35, width: 18.19, height: 18.19, borderRadius: 9.1, background: '#7950e5' }}>
                    <img src={checkmarkSvg} alt="" style={{ position: 'absolute', left: '50%', top: '50%', width: 14.5, height: 14.5, transform: 'translate(-50%,-50%)' }} />
                  </div>
                  <div className="hp-abs" style={{ ...regular, left: 25.19, top: 1, fontSize: 13.5, color: '#fff' }}>{label}</div>
                </div>
              ))}
            </div>
            <div className="hp-abs" style={{ ...blackItalic, left: 16, top: 346, fontSize: 13.2, color: '#bdb5ff' }}>From €3.99/month</div>
            <PillButton left={309.83} top={337.75} width={85.77} label="View plans" big />
          </div>

          {/* Recent / VS bar */}
          <div className="hp-abs" style={{ left: 641.45, right: 641.47, top: 16, height: 46, borderRadius: 8, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
            <div className="hp-abs" style={{ left: 18, top: 13, width: 79.34, height: 20.31, borderRadius: 6, background: '#e94555', transform: 'skewX(-10deg) scaleY(0.98)' }} />
            <div className="hp-abs" style={{ left: 26, top: 19, width: 8, height: 8, borderRadius: 4, background: '#fff' }} />
            <div className="hp-abs" style={{ ...boldItalic, left: 41, top: 15, fontSize: 12.5, color: '#fff', textTransform: 'uppercase' }}>Recent</div>
            <div className="hp-abs" style={{ left: 115.35, top: 11, width: 24, height: 24, borderRadius: 24, background: '#fff', boxShadow: '0px 6px 5px rgba(26,26,26,0.1)' }}>
              <img src={patrickImg} alt="" style={{ position: 'absolute', left: 1.5, top: 1.5, width: 21, height: 21, borderRadius: 21 }} />
            </div>
            <div className="hp-abs" style={{ ...boldItalic, left: 151.35, top: 13, fontSize: 15.5, color: '#fff' }}>Patrick</div>
            <img src={flagImg3} alt="" className="hp-abs" style={{ left: 208.82, top: 16.4, width: 17.28, height: 13.3, borderRadius: 1.75 }} />
            <div
              className="hp-abs"
              style={{ ...boldItalic, left: 242.1, top: 10, fontSize: 21.2, color: '#fff', textTransform: 'uppercase', textShadow: '0px 6px 32px #7950e5, 0px 4px 16px #3ae8bd' }}
            >
              VS.
            </div>
            <div className="hp-abs" style={{ left: 294, top: 11, width: 24, height: 24, borderRadius: 24, background: '#fff', boxShadow: '0px 6px 5px rgba(26,26,26,0.1)' }}>
              <img src={unclepandaImg} alt="" style={{ position: 'absolute', left: 1.5, top: 1.5, width: 21, height: 21, borderRadius: 21 }} />
            </div>
            <div className="hp-abs" style={{ ...boldItalic, left: 330, top: 13, fontSize: 15.3, color: '#fff' }}>Unclepanda</div>
            <img src={flagImg4} alt="" className="hp-abs" style={{ left: 423.8, top: 16.4, width: 17.28, height: 13.3, borderRadius: 1.75 }} />
            <img src={arrowLeftSvg} alt="" className="hp-abs" style={{ right: 20, top: 11, width: 24, height: 24, opacity: 0.6, transform: 'rotate(180deg)' }} />
          </div>

          {/* Players online pill */}
          <div className="hp-abs" style={{ left: 767, right: 767, top: 74, height: 36, borderRadius: 1584 }}>
            {[image5, image6, image7].map((src, i) => (
              <img key={i} src={src} alt="" className="hp-abs" style={{ left: i * 24, top: 0, width: 36, height: 36, borderRadius: 18, border: '2px solid rgba(23,18,53,0.9)' }} />
            ))}
            <div className="hp-abs" style={{ ...regular, left: 90, top: 8, fontSize: 15.6, color: '#fff', whiteSpace: 'nowrap' }}>
              13,486 <span style={{ color: 'rgba(255,255,255,0.6)' }}>players online</span>
            </div>
          </div>
        </div>

        {/* Left sidebar panel */}
        <div className="hp-abs" style={{ left: 0, top: 60, width: 256, height: 1140 }}>
          {/* Streak widget */}
          <div className="hp-abs" style={{ left: 16, right: 16, bottom: 524, height: 101 }}>
            <div className="hp-abs" style={{ left: 16, right: 91.08, top: 0, height: 28, borderRadius: '12px 12px 0 0', background: '#211a4c', boxShadow: 'inset 0px -4px 1px 0px rgba(16,16,28,0.4), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)' }}>
              <div className="hp-abs" style={{ ...boldItalic, left: 16, top: 6, fontSize: 10.7, color: '#8f86e6', textTransform: 'uppercase' }}>0 days streak</div>
            </div>
            <div className="hp-abs" style={{ left: 0, right: 0, top: 28, height: 73, borderRadius: 16, background: '#393273', boxShadow: 'inset 0px -4px 1px 0px rgba(16,16,28,0.4), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)' }}>
              {['T', 'F', 'S', 'S', 'M', 'T', 'W'].map((d, i) => (
                <div key={i} className="hp-abs" style={{ left: 21.69 + i * 29.17, top: 13, fontSize: 10.5, fontWeight: 700, color: '#8f86e6', textTransform: 'uppercase' }}>{d}</div>
              ))}
              {['12', '13', '14', '15', '16', '17', '18'].map((n, i) => {
                const active = n === '15';
                const dim = Number(n) > 15;
                return (
                  <div
                    key={n}
                    className="hp-abs"
                    style={{
                      left: 12.25 + i * 29,
                      top: 33.25,
                      width: 25.5,
                      height: 25.5,
                      borderRadius: 5.25,
                      background: active ? '#211a4c' : 'linear-gradient(to bottom, rgba(16,16,28,0.5), rgba(16,16,28,0.34))',
                      border: active ? '1px solid #ffcf4a' : undefined,
                      opacity: dim ? 0.3 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11.4,
                      fontWeight: active ? 700 : 400,
                      color: active ? '#ffcf4a' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {n}
                  </div>
                );
              })}
              <div className="hp-abs" style={{ right: 10, top: -50, width: 60, height: 66 }}>
                <img src={shadowImg} alt="" className="hp-abs" style={{ inset: 0 }} />
                <img src={image8} alt="" className="hp-abs" style={{ left: -2, right: 0, top: 2, bottom: -4, transform: 'rotate(2deg)' }} />
                <img src={shadow1Img} alt="" className="hp-abs" style={{ inset: 0 }} />
                <img src={image9} alt="" className="hp-abs" style={{ left: 1.5, right: 1.5, top: 0, bottom: 0 }} />
              </div>
            </div>
          </div>

          {/* Nav list */}
          <div className="hp-abs" style={{ left: 16, right: 16, bottom: 186, height: 322 }}>
            {[
              { label: 'Daily Challenge', sub: '3 hr left', subColor: 'rgba(255,255,255,0.6)', img: itemLinkImg, icon: image10 },
              { label: 'Competitive', sub: 'Get ranked', subColor: '#ffc628', img: itemLink1Img, icon: image11, subUpper: true },
            ].map((item, i) => (
              <div key={item.label} className="hp-abs" style={{ left: 0, right: 0, top: i * 110, height: 102, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(to right, #211a4c, #7950e5)' }}>
                <img src={item.img} alt="" className="hp-abs" style={{ left: '-3.68%', right: 0, top: 0, width: '107.37%', height: '100%' }} />
                <img src={item.icon} alt="" className="hp-abs" style={{ left: 141.34, top: 13.67, right: 8, bottom: 13.67, filter: 'drop-shadow(0px 4px 8px rgba(16,16,28,0.8))' }} />
                <div className="hp-abs" style={{ ...boldItalic, left: 12, top: 23, fontSize: 17, color: '#fff', textShadow: '0px 1px 1px rgba(16,16,28,0.4)' }}>{item.label}</div>
                <div className="hp-abs" style={{ ...boldItalic, left: 12, top: 57, fontSize: 12.8, color: item.subColor, textTransform: item.subUpper ? 'uppercase' : undefined }}>{item.sub}</div>
                <div className="hp-abs" style={{ inset: 0, borderRadius: 16, boxShadow: 'inset 0px -4px 1px 0px rgba(16,16,28,0.4), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)' }} />
              </div>
            ))}
            <div className="hp-abs" style={{ left: 0, right: 0, top: 220, height: 102, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(to right, #211a4c, #7950e5)' }}>
              <img src={buttonImg} alt="" className="hp-abs" style={{ left: '-3.68%', right: 0, top: 0, width: '107.37%', height: '100%' }} />
              <img src={image12} alt="" className="hp-abs" style={{ left: 141.34, top: 13.67, right: 8, bottom: 13.67, filter: 'drop-shadow(0px 4px 8px rgba(16,16,28,0.8))' }} />
              <div className="hp-abs" style={{ ...boldItalic, left: 12, top: 23, fontSize: 17.3, color: '#fff', textShadow: '0px 1px 1px rgba(16,16,28,0.4)' }}>World</div>
              <div className="hp-abs" style={{ inset: 0, borderRadius: 16, boxShadow: 'inset 0px -4px 1px 0px rgba(16,16,28,0.4), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)' }} />
              <div className="hp-abs" style={{ left: -4, bottom: 26, width: 155.33, height: 20, borderRadius: 4, background: '#7950e5' }}>
                <div className="hp-abs" style={{ ...boldItalic, left: 24, top: 2, fontSize: 12.4, color: '#fff', textShadow: '0px 1px 2px rgba(16,16,28,0.8)', textTransform: 'uppercase' }}>Subscribers only</div>
                <img src={proLockImg} alt="" className="hp-abs" style={{ left: -7, top: -16, width: 30, height: 36 }} />
              </div>
            </div>
          </div>

          {/* HorrorGuessr promo */}
          <div className="hp-abs" style={{ left: 32, right: 80.75, bottom: 142, height: 28, borderRadius: '12px 12px 0 0', background: '#211a4c', boxShadow: 'inset 0px -4px 1px 0px rgba(16,16,28,0.4), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)' }}>
            <div className="hp-abs" style={{ ...boldItalic, left: 16, top: 6, fontSize: 10.9, color: '#8f86e6', textTransform: 'uppercase' }}>{`What's happening`}</div>
          </div>
          <div className="hp-abs" style={{ left: 16, right: 16, bottom: 16, height: 126, borderRadius: 16, overflow: 'hidden', background: 'radial-gradient(circle at center, #393273 0%, #211a4c 100%)', boxShadow: 'inset 0px -1px 1px 0px rgba(0,0,0,0.55), inset 0px 1px 1px 0px rgba(33,26,76,0.4)' }}>
            <img src={playHorrorGuessrNowImg} alt="" className="hp-abs" style={{ inset: 0 }} />
            <div className="hp-abs" style={{ inset: 0, borderRadius: 16, boxShadow: 'inset 0px -4px 1px 0px rgba(16,16,28,0.4), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)' }} />
          </div>
        </div>

        {/* Header */}
        <div className="hp-abs" style={{ left: 0, right: 56, top: 0, height: 60, background: 'rgba(16,16,28,0.8)' }}>
          <div className="hp-abs" style={{ left: 0, top: -16, bottom: 0, width: 184, background: '#10101c', backdropFilter: 'blur(12px)', maskImage: 'linear-gradient(to right, black 60%, transparent 100%)' }} />
          <img src={logoSvg} alt="GeoGuessr" className="hp-abs" style={{ left: 16, top: '50%', width: 128, height: 25.6, transform: 'translateY(-50%)' }} />
          <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, left: 188, top: 20, fontSize: 15.4 }}>Singleplayer</div>
          <img src={dividerVectorSvg} alt="" className="hp-abs" style={{ left: 289.69, top: 28, width: 8, height: 24, opacity: 0.2 }} />
          <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, left: 322, top: 20, fontSize: 15.6 }}>Multiplayer</div>
          <img src={dividerVectorSvg} alt="" className="hp-abs" style={{ left: 415.94, top: 28, width: 8, height: 24, opacity: 0.2 }} />
          <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, left: 448, top: 20, fontSize: 15.9 }}>Party</div>
          <img src={dividerVectorSvg} alt="" className="hp-abs" style={{ left: 497.47, top: 28, width: 8, height: 24, opacity: 0.2 }} />
          <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, left: 554.47, top: 22, fontSize: 10.7, textTransform: 'uppercase' }}>Community</div>
          <div className="hp-abs" style={{ left: 648.13, top: 0, bottom: 0, width: 30 }}>
            <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, left: 0, top: 22, fontSize: 10.5, textTransform: 'uppercase' }}>Shop</div>
            <div className="hp-abs" style={{ right: -8, top: 16, width: 6, height: 6, borderRadius: 6, background: '#ffa43d' }} />
          </div>
          <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, left: 702, top: 22, fontSize: 10.5, textTransform: 'uppercase' }}>Merch</div>
          <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, left: 765, top: 22, fontSize: 10.7, textTransform: 'uppercase' }}>World Championship</div>

          <div className="hp-abs" style={{ left: 1588.75, top: 0, bottom: 0, width: 191.25 }}>
            <div className="hp-abs" style={{ left: -3.6, top: '50%', width: 79.2, height: 79.2, transform: 'translateY(-50%)' }}>
              <div className="hp-abs" style={{ inset: '22px', borderRadius: 34.84, overflow: 'hidden' }}>
                <img src={containerImg} alt="" className="hp-abs" style={{ inset: 0 }} />
              </div>
              <img src={avatarWebpImg} alt="" className="hp-abs" style={{ inset: 0 }} />
            </div>
            <div className="hp-abs" style={{ left: 72, top: '50%', width: 119.25, height: 35, transform: 'translateY(-50%)' }}>
              <div className="hp-abs" style={{ ...boldItalic, left: 0, top: 0, fontSize: 13.5, color: '#fff' }}>Maximpolakovskij</div>
              <img src={image13} alt="" className="hp-abs" style={{ left: 0, top: 17, width: 18, height: 18 }} />
              <div className="hp-abs" style={{ ...boldItalic, left: 22, top: 19, fontSize: 10.1, color: '#a685ff', textTransform: 'uppercase' }}>75</div>
            </div>
          </div>

          <img src={dividerVectorSvg} alt="" className="hp-abs" style={{ left: 1788, top: 28, width: 8, height: 24, opacity: 0.2 }} />
          <CoinBadge left={1812} top={10.5} />
          <div className="hp-abs" style={{ left: 1519.56, top: 8, width: 61.19, height: 24 }}>
            <img src={searchIconSvg} alt="" className="hp-abs" style={{ left: 16, top: 0, width: 24, height: 24 }} />
          </div>
        </div>

        {/* Right community panel */}
        <div className="hp-abs" style={{ left: 1864, top: 0, width: 288, height: 1200, background: '#171235', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 60, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="hp-abs" style={{ left: 12, top: '50%', width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', transform: 'translateY(-50%)' }}>
              <img src={overlayImg} alt="" className="hp-abs" style={{ left: '-39%', top: 0, width: '178%', height: '100%' }} />
            </div>
            <div className="hp-abs" style={{ ...boldItalic, left: 56, top: '50%', fontSize: 13.3, color: '#fff', transform: 'translateY(-50%)' }}>Play HorrorGuessr Now!</div>
            <div className="hp-abs" style={{ right: 6, top: 6, width: 16, height: 16, borderRadius: 16, background: '#e94555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>1</div>
          </div>
          <div className="hp-abs" style={{ left: 0, right: 0, top: 60, height: 47, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="hp-abs" style={{ left: 8, right: 80, top: '50%', height: 34, borderRadius: 8, transform: 'translateY(-50%)' }}>
              <img src={streakCalIconSvg} alt="" className="hp-abs" style={{ left: 12, top: '50%', width: 14, height: 14, transform: 'translateY(-50%)' }} />
              <div className="hp-abs" style={{ ...regular, left: 34, top: '50%', fontSize: 14, color: 'rgba(255,255,255,0.4)', transform: 'translateY(-50%)' }}>Search users...</div>
            </div>
            <img src={closeSvg} alt="" className="hp-abs" style={{ left: 221, top: '50%', width: 14, height: 14, transform: 'translateY(-50%)' }} />
            <img src={plusSvg} alt="" className="hp-abs" style={{ left: 250, top: '50%', width: 20, height: 20, transform: 'translate(0, -50%) rotate(45deg)' }} />
          </div>
          <div className="hp-abs" style={{ left: 0, right: 0, top: 107, height: 51, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="hp-abs" style={{ left: 12, right: 244, top: 9, bottom: 9, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <img src={highlightFrameSvg} alt="" className="hp-abs" style={{ left: 7, top: 7, width: 16, height: 16 }} />
            </div>
          </div>
          <div className="hp-abs" style={{ left: 0, right: 0, top: 158, height: 50 }}>
            <div className="hp-abs" style={{ left: 12, top: '50%', width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', transform: 'translateY(-50%)' }}>
              <img src={clubIconSvg} alt="" className="hp-abs" style={{ left: '50%', top: '50%', width: 16, height: 16, transform: 'translate(-50%,-50%)' }} />
            </div>
            <div className="hp-abs" style={{ ...regular, left: 58, top: 8, fontSize: 13.2, color: '#fff' }}>Find your club</div>
            <div className="hp-abs" style={{ ...regular, left: 58, top: 27, fontSize: 11.6, color: 'rgba(255,255,255,0.6)' }}>Compete together</div>
          </div>
          <div className="hp-abs" style={{ left: 0, right: 0, top: 208, bottom: 0, overflow: 'hidden' }}>
            <div className="hp-abs" style={{ left: 0, right: 0, top: 39, height: 48 }}>
              <img src={bgBrcImg} alt="" className="hp-abs" style={{ inset: 0, opacity: 0.3 }} />
              <img src={image14} alt="" className="hp-abs" style={{ left: 11, top: '50%', width: 32, height: 32, transform: 'translateY(-50%)' }} />
              <div className="hp-abs" style={{ ...boldItalic, left: 71, top: '50%', fontSize: 13.5, color: '#68c045', transform: 'translateY(-50%)' }}>Battle royale countries</div>
            </div>
            <div className="hp-abs" style={{ left: 0, right: 0, top: 88, height: 48 }}>
              <img src={bgBrdImg} alt="" className="hp-abs" style={{ inset: 0, opacity: 0.3 }} />
              <img src={image15} alt="" className="hp-abs" style={{ left: 11, top: '50%', width: 32, height: 32, transform: 'translateY(-50%)' }} />
              <div className="hp-abs" style={{ ...boldItalic, left: 71, top: '50%', fontSize: 13.5, color: '#68c045', transform: 'translateY(-50%)' }}>Battle royale distance</div>
            </div>
            <div className="hp-abs" style={{ left: 0, right: 0, top: 136, height: 39, background: '#171235', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <img src={chevronVector4Svg} alt="" className="hp-abs" style={{ left: 21, top: 16, width: 6, height: 12 }} />
              <img src={chevronVector5Svg} alt="" className="hp-abs" style={{ left: 21, top: 16, width: 9, height: 10 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Flat navy background continuing to the full 2400px canvas height, matching the Figma frame */}
    </Frame>
  );
}

export function HomePageSectionMobile() {
  return (
    <Frame style={{ width: 390, height: 1239.52 }} frameName="home-page-mobile">
      <div
        className="hp-abs"
        style={{
          left: 0,
          right: 0,
          top: 0,
          height: 780,
          backgroundImage:
            'radial-gradient(ellipse 26px 173px at 531px -479px, rgba(58,232,189,0.5) 0%, rgba(58,232,189,0) 92%),' +
            'radial-gradient(ellipse 36px 99px at 114px -439px, rgba(58,232,189,0.8) 0%, rgba(58,232,189,0) 92%),' +
            'radial-gradient(ellipse 34px 79px at -67px -193px, rgba(121,80,229,1) 0%, rgba(121,80,229,0) 92%),' +
            'linear-gradient(90deg, #171235, #171235)',
        }}
      />
      <div className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 780, backgroundImage: 'radial-gradient(circle at 195px 390px, #211a4c 0%, #120e2d 27.5%, #0b081e 41.25%, #04020e 55%)' }} />

      {/* Main */}
      <div className="hp-abs" style={{ left: 0, right: 0, top: 60, height: 1179.52 }}>
        <div className="hp-abs" style={{ left: 0, right: 0, top: 52, height: 1047.52 }}>
          {/* Avatar scene */}
          <div className="hp-abs" style={{ left: 16, right: 16, top: 636.83, height: 362.69 }}>
            <img src={mImage} alt="" className="hp-abs" style={{ left: '50%', bottom: -90.65, width: 272, height: 272, transform: 'translateX(-50%)' }} />
            <img src={mImage1} alt="" className="hp-abs" style={{ left: '50%', bottom: 90.69, width: 272, height: 272, transform: 'translateX(-50%)' }} />
            <div className="hp-abs" style={{ left: '50%', top: '65.99%', width: 88.78, transform: 'translateX(-50%)' }}>
              <PillButton left={0} top={0} width={88.78} label="Edit avatar" />
              <div className="hp-abs" style={{ right: -8, top: -4, width: 5.25, height: 5.25, borderRadius: 5.25, background: '#ffa43d' }} />
            </div>
          </div>

          {/* Horror mode banner */}
          <div className="hp-abs" style={{ left: 20, right: 20, top: 20, height: 100.42, borderRadius: 16, border: '4px solid rgba(23,18,53,0.9)', boxShadow: 'inset 0px 0px 4px 0px rgba(121,80,229,0.8)' }}>
            <div className="hp-abs" style={{ inset: 0, borderRadius: 16, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 40%), linear-gradient(90deg, rgba(23,18,53,0.9), rgba(23,18,53,0.9))' }} />
            <div className="hp-abs" style={{ inset: 0, borderRadius: 16, border: '1px solid #393273' }} />
            <div className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 100.42, borderRadius: 12, border: '3px solid #dc1934', background: '#1a1a26', overflow: 'hidden' }}>
              <img src={mImage2} alt="" className="hp-abs" style={{ left: 8, top: 12, width: 88, height: 82.42 }} />
              <div className="hp-abs" style={{ left: 108, right: 28.13, top: 14, color: '#dc1934', fontSize: 13.1, textTransform: 'uppercase' }}>Play our free horrormode</div>
              <div className="hp-abs" style={{ left: 108, top: 52.3, width: 82.56, height: 28, borderRadius: 28 }}>
                <div className="hp-abs" style={{ inset: 0, borderRadius: 28, background: 'linear-gradient(to bottom, #97e851, #479440)', boxShadow: 'inset 0px 0.75px 0px 0px rgba(255,255,255,0.2), inset 0px -1.5px 0px 0px rgba(0,0,0,0.3)' }} />
                <div className="hp-abs" style={{ ...boldItalic, ...gradientPillText, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.7, textTransform: 'uppercase' }}>Play now</div>
              </div>
            </div>
          </div>

          <SocialRow left={16} top={592.83} icons={[mTwitchSvg, mRedditSvg, mDiscordGlyphSvg, mFacebookSvg, mInstagramSvg, mXSvg, mYoutubeSvg, mTiktokSvg]} size={47.14 / 58} />

          {/* Subscription panel */}
          <div className="hp-abs" style={{ left: 16, right: 16, top: 156.42, height: 420.41, borderRadius: 12, background: '#351370', overflow: 'hidden' }}>
            <img src={mSubscriptionIllustration} alt="" className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 192 }} />
            <div className="hp-abs" style={{ ...boldItalic, left: 16, right: 147.85, top: 240, fontSize: 22.7, color: '#fff', lineHeight: '26px' }}>
              <div>Subscribe to play</div>
              <div>without limits!</div>
            </div>
            <div className="hp-abs" style={{ left: 16, right: 16, top: 296 }}>
              {['Ad free, unlimited play', '1000s of maps', 'Play on web, apps or Steam'].map((label, i) => (
                <div key={label} className="hp-abs" style={{ left: 0, right: 0, top: i * 26.25, height: 19.25 }}>
                  <div className="hp-abs" style={{ left: 0, top: 0.35, width: 18.19, height: 18.19, borderRadius: 9.1, background: '#7950e5' }}>
                    <img src={mCheckmarkSvg} alt="" style={{ position: 'absolute', left: '50%', top: '50%', width: 14.5, height: 14.5, transform: 'translate(-50%,-50%)' }} />
                  </div>
                  <div className="hp-abs" style={{ ...regular, left: 25.19, top: 1, fontSize: 13.5, color: '#fff' }}>{label}</div>
                </div>
              ))}
            </div>
            <div className="hp-abs" style={{ ...blackItalic, left: 16, top: 372, fontSize: 13.2, color: '#bdb5ff' }}>From €3.99/month</div>
            <PillButton left={233.83} top={363.75} width={85.77} label="View plans" big />
          </div>
        </div>

        {/* Players online pill */}
        <div className="hp-abs" style={{ left: 79.88, right: 79.87, top: 16, height: 36, borderRadius: 1584 }}>
          {[mFlagImg3, mFlagImg4, mImage5].map((src, i) => (
            <img key={i} src={src} alt="" className="hp-abs" style={{ left: i * 24, top: 0, width: 36, height: 36, borderRadius: 18, border: '2px solid rgba(23,18,53,0.9)' }} />
          ))}
          <div className="hp-abs" style={{ ...regular, left: 90, top: 10, fontSize: 13.7, color: '#fff', whiteSpace: 'nowrap' }}>
            13,493 <span style={{ color: 'rgba(255,255,255,0.6)' }}>players online</span>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="hp-abs" style={{ left: 0, right: 0, bottom: 0, height: 92, background: '#211a4c', borderTop: '4px solid #4e4497' }}>
        <div className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 88, background: 'linear-gradient(to bottom, #393273, #211a4c)', borderTop: '2px solid #171235' }}>
          {[
            { icon: mHomeIcon, label: 'Home', active: false },
            { icon: mDailyIcon, label: 'Daily challenge', active: false, twoLine: true },
            { icon: mCompetitiveIcon, label: 'Competitive', active: true },
            { icon: mWorldIcon, label: 'World', active: false },
          ].map((item, i) => (
            <div key={item.label} className="hp-abs" style={{ left: i * 97.5, width: 97.5, top: 0, bottom: 0, borderLeft: i > 0 ? '2px solid #171235' : undefined }}>
              <img src={item.icon} alt="" className="hp-abs" style={{ left: '50%', top: item.twoLine ? 'calc(50% - 15px)' : 'calc(50% - 8px)', width: 48, height: 48, transform: 'translate(-50%, -50%)' }} />
              <div
                className="hp-abs"
                style={{
                  ...boldItalic,
                  left: '50%',
                  top: 'calc(50% + 25px)',
                  transform: 'translate(-50%, -50%)',
                  fontSize: 10.7,
                  color: item.active ? '#fff' : 'rgba(255,255,255,0.8)',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  whiteSpace: item.twoLine ? 'normal' : 'nowrap',
                  width: item.twoLine ? 65 : undefined,
                  lineHeight: '14px',
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
        <div className="hp-abs" style={{ left: 0, top: 2, bottom: 0, width: 97.5, background: 'linear-gradient(to bottom, #5d51b6, #393273)' }} />
      </div>

      {/* Header */}
      <div className="hp-abs" style={{ left: 0, right: 0, top: 0, height: 60, background: 'rgba(16,16,28,0.6)', backdropFilter: 'blur(76px)' }}>
        <img src={mSearchIconSvg} alt="" className="hp-abs" style={{ left: 170, top: 18, width: 24, height: 24 }} />
        <div className="hp-abs" style={{ left: 206.8, top: '50%', width: 70.4, height: 70.4, transform: 'translateY(-50%)' }}>
          <div className="hp-abs" style={{ inset: '19.7px', borderRadius: 30.97, overflow: 'hidden' }}>
            <img src={mContainerImg} alt="" className="hp-abs" style={{ inset: 0 }} />
          </div>
          <img src={mAvatarWebpImg} alt="" className="hp-abs" style={{ inset: 0 }} />
        </div>
        <CoinBadge left={286} top={10.5} />
        <img src={mBellSvg} alt="" className="hp-abs" style={{ left: 356, top: 18, width: 24, height: 24 }} />
        <div className="hp-abs" style={{ left: 356, top: 11.2, width: 22, height: 22, borderRadius: 80, background: '#c9333a', border: '2px solid #11101f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.6, color: '#fff' }}>1</div>
        <img src={mHamburgerSvg} alt="" className="hp-abs" style={{ left: 32, top: 23, width: 24, height: 14 }} />
      </div>
    </Frame>
  );
}

export function HomePageSection() {
  return (
    <div>
      <HomePageSectionDesktop />
      <HomePageSectionMobile />
    </div>
  );
}
