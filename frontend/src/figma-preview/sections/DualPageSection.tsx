import type { CSSProperties } from 'react';
import './DualPageSection.css';

import flagImg from '../assets/dual-page/desktop/image3.svg';
import duelMaskImg from '../assets/dual-page/desktop/image.png';
import duelBgImg from '../assets/dual-page/desktop/image1.png';
import diamondImg from '../assets/dual-page/desktop/image2.png';
import rankChampionImg from '../assets/dual-page/desktop/image4.png';
import rankMasterImg from '../assets/dual-page/desktop/image5.png';
import rankGoldImg from '../assets/dual-page/desktop/image6.png';
import rankSilverImg from '../assets/dual-page/desktop/image7.png';
import rankBronzeImg from '../assets/dual-page/desktop/image8.png';
import rankGradientMaskImg from '../assets/dual-page/desktop/gradient.svg';
import userBubbleImg from '../assets/dual-page/desktop/background-shadow.png';
import userFlagImg from '../assets/dual-page/desktop/image9.svg';
import flameShadowImg from '../assets/dual-page/desktop/shadow.png';
import flameMidImg from '../assets/dual-page/desktop/image10.png';
import flameShadow1Img from '../assets/dual-page/desktop/shadow1.png';
import flameMainImg from '../assets/dual-page/desktop/image11.png';
import dailyIconImg from '../assets/dual-page/desktop/image12.png';
import competitiveIconImg from '../assets/dual-page/desktop/image13.png';
import worldIconImg from '../assets/dual-page/desktop/image14.png';
import worldBadgeImg from '../assets/dual-page/desktop/image15.png';
import logoImg from '../assets/dual-page/desktop/logo.svg';
import caretImg from '../assets/dual-page/desktop/vector.svg';
import avatarRingImg from '../assets/dual-page/desktop/container.png';
import avatarImg from '../assets/dual-page/desktop/avatar-webp.png';
import flagSmallImg from '../assets/dual-page/desktop/image16.png';
import searchIconImg from '../assets/dual-page/desktop/search-icon.svg';
import hgIconImg from '../assets/dual-page/desktop/overlay.png';

import mMaskImg from '../assets/dual-page/mobile/container.png';
import mDuelBgImg from '../assets/dual-page/mobile/image.png';
import mDiamondImg from '../assets/dual-page/mobile/image1.png';
import mFlagImg from '../assets/dual-page/mobile/image2.svg';
import mHomeIconImg from '../assets/dual-page/mobile/image3.png';
import mDailyIconImg from '../assets/dual-page/mobile/image4.png';
import mCompetitiveIconImg from '../assets/dual-page/mobile/image5.png';
import mWorldIconImg from '../assets/dual-page/mobile/image6.png';
import mAvatarRingImg from '../assets/dual-page/mobile/container1.png';
import mAvatarImg from '../assets/dual-page/mobile/avatar-webp.png';
import mSearchIconImg from '../assets/dual-page/mobile/search-icon.svg';
import mCaretImg from '../assets/dual-page/mobile/svg.svg';
import mBellImg from '../assets/dual-page/mobile/svg1.svg';
import mHamburgerImg from '../assets/dual-page/mobile/hamburger.svg';

const headingFont: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 900, fontStyle: 'italic' };
const boldItalic: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontStyle: 'italic' };
const regularItalic: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 400, fontStyle: 'italic' };

function RankItem({
  top,
  color,
  label,
  icon,
  dots,
}: {
  top: number;
  color: string;
  label: string;
  icon: string;
  dots: boolean;
}) {
  return (
    <div className="dp-abs" style={{ left: 0, top, width: 198, height: 48 }}>
      <div
        className="dp-abs"
        style={{ left: 6, top: 18, width: 12, height: 12, borderRadius: 6, background: '#171235', border: `2px solid ${color}` }}
      />
      <div
        className="dp-abs"
        style={{
          ...headingFont,
          left: 112,
          top: 11,
          fontSize: 12.1,
          color,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      {dots && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="dp-abs"
              style={{ left: 112 + i * 12, top: 31, width: 6, height: 6, borderRadius: 3, background: color, opacity: 0.35 }}
            />
          ))}
        </>
      )}
      <img src={icon} alt="" className="dp-abs" style={{ left: 44, top: 0, width: 48, height: 48 }} />
    </div>
  );
}

function SidebarIcon({ top, icon, badge }: { top: number; icon: string; badge?: string }) {
  return (
    <div
      className="dp-abs"
      style={{
        left: 0,
        top,
        width: 80,
        height: 102,
        background: '#211a4c',
        borderRadius: '0 16px 16px 0',
        boxShadow:
          'inset 0px -4px 1px 0px rgba(16,16,28,0.4), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)',
      }}
    >
      <img src={icon} alt="" className="dp-abs" style={{ left: 16, top: 25, width: 48, height: 48, filter: 'drop-shadow(0px 4px 8px rgba(16,16,28,0.8))' }} />
      {badge && (
        <img src={badge} alt="" className="dp-abs" style={{ left: 52, top: 54, width: 14, height: 21, filter: 'drop-shadow(0px 2px 4px rgba(16,16,28,0.8))' }} />
      )}
    </div>
  );
}

function NavLink({ left, children, active }: { left: number; children: string; active?: boolean }) {
  return (
    <div
      className="dp-abs"
      style={{
        ...boldItalic,
        left,
        top: 20,
        fontSize: 15.5,
        background: 'linear-gradient(to bottom, #ffffff 6.5%, #d5d5f3)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {active && (
        <div className="dp-abs" style={{ left: 0, top: 37, width: 86.25, height: 3, background: '#7950e5' }} />
      )}
    </div>
  );
}

export function DualPageSectionDesktop() {
  return (
    <div className="dp-frame" data-figma-frame="dual-page-desktop" style={{ width: 1920, height: 2400 }}>
      {/* Hero container 0,0,1920,1200 */}
      <div className="dp-abs" style={{ left: 0, top: 0, width: 1920, height: 1200 }}>
        <div
          className="dp-abs"
          style={{
            left: 0,
            top: 0,
            width: 1920,
            height: 1200,
            backgroundImage:
              "radial-gradient(circle at 1920px -240px, rgba(58,232,189,0.5) 0%, rgba(58,232,189,0) 60%)," +
              "radial-gradient(circle at 960px -720px, rgba(58,232,189,0.5) 0%, rgba(58,232,189,0) 65%)," +
              "radial-gradient(ellipse 271px 203px at 0px -240px, rgba(121,80,229,1) 0%, rgba(121,80,229,0) 50%)," +
              'linear-gradient(90deg, #171235 0%, #171235 100%)',
          }}
        />
        <div
          className="dp-abs"
          style={{
            left: 0,
            top: 0,
            width: 1920,
            height: 1200,
            backgroundImage: 'radial-gradient(circle at 960px 600px, #211a4c 0%, #120e2d 27.5%, #0b081e 41.25%, #04020e 55%)',
          }}
        />

        {/* Main hero content 80,60,1784,1140 */}
        <div className="dp-abs" style={{ left: 80, top: 60, width: 1784, height: 1140, overflow: 'hidden' }}>
          <div
            className="dp-abs"
            style={{ ...headingFont, left: 631.8, top: 215.4, width: 282.5, textAlign: 'center', fontSize: 85.1, lineHeight: '96px', color: '#fff', textTransform: 'uppercase' }}
          >
            Duels
          </div>
          <div
            className="dp-abs"
            style={{ ...regularItalic, left: 631.8, top: 315.4, width: 282.4, textAlign: 'center', fontSize: 22.9, lineHeight: '26px', color: '#ffc628' }}
          >
            Play 3 duels to get ranked
          </div>

          <div className="dp-abs" style={{ left: 436.9, top: 341.4, width: 672, height: 480, WebkitMaskImage: `url(${duelMaskImg})`, maskImage: `url(${duelMaskImg})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}>
            <img src={duelBgImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <img src={diamondImg} alt="" className="dp-abs" style={{ left: 612.9, top: 493.4, width: 320, height: 320 }} />
          <img src={flagImg} alt="" className="dp-abs" style={{ left: 475.2, top: 391.9, width: 22.2, height: 17.1, borderRadius: 2.25 }} />
          <div className="dp-abs" style={{ ...boldItalic, left: 504.6, top: 389.4, fontSize: 17.4, color: '#fff' }}>Maximpolakovskij</div>
          <div className="dp-abs" style={{ ...boldItalic, left: 910.4, top: 389.4, fontSize: 17.4, color: '#fff' }}>Unknown player</div>

          <div className="dp-abs" style={{ left: 436.9, top: 821.4, width: 672, height: 52 }}>
            <div
              className="dp-abs"
              style={{
                left: 153.1,
                width: 113.1,
                height: 52,
                borderRadius: 16,
                background: 'radial-gradient(circle, #393273 0%, #211a4c 100%)',
                boxShadow:
                  'inset 0px -1px 1px 0px rgba(0,0,0,0.55), inset 0px 1px 1px 0px rgba(33,26,76,0.4), inset 0px 1px 1px 0px rgba(255,255,255,0.2)',
              }}
            >
              <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 16, textAlign: 'center', fontSize: 14.6, color: '#ffc628', textTransform: 'uppercase' }}>Duel 1</div>
            </div>
            <div
              className="dp-abs"
              style={{
                left: 278.2,
                width: 114.3,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(to bottom, rgba(16,16,28,0.5), rgba(16,16,28,0.3) 61.5%)',
                boxShadow: '0px -1px 1px 0px rgba(0,0,0,0.55), 0px 1px 1px 0px rgba(255,255,255,0.1), inset 0px 10px 20px 0px rgba(0,0,0,0.15)',
              }}
            >
              <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 16, textAlign: 'center', fontSize: 14.4, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Duel 2</div>
            </div>
            <div
              className="dp-abs"
              style={{
                left: 404.5,
                width: 114.3,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(to bottom, rgba(16,16,28,0.5), rgba(16,16,28,0.3) 61.5%)',
                boxShadow: '0px -1px 1px 0px rgba(0,0,0,0.55), 0px 1px 1px 0px rgba(255,255,255,0.1), inset 0px 10px 20px 0px rgba(0,0,0,0.15)',
              }}
            >
              <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 16, textAlign: 'center', fontSize: 14.3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Duel 3</div>
            </div>
          </div>

          <div
            className="dp-abs"
            style={{
              left: 659.9,
              top: 897.4,
              width: 226,
              height: 59.2,
              borderRadius: 60,
              background: 'linear-gradient(to bottom, #97e851, #479440)',
              boxShadow: 'inset 0px 1px 0px 0px rgba(255,255,255,0.2), inset 0px -2px 0px 0px rgba(0,0,0,0.3), 0px 4.4px 9px rgba(0,0,0,0.25)',
            }}
          >
            <div className="dp-abs" style={{ ...boldItalic, left: 0, right: 0, top: 17, textAlign: 'center', fontSize: 17.8, color: '#fff', textTransform: 'uppercase', textShadow: '0px 1px 2px #171235' }}>Play</div>
          </div>

          {/* Ranks panel */}
          <div className="dp-abs" style={{ left: 1148.9, top: 360, width: 198.1, height: 452 }}>
            <div className="dp-abs" style={{ left: 7, top: 0, width: 10, height: 452, background: 'rgba(255,255,255,0.2)' }} />
            <div
              className="dp-abs"
              style={{
                left: 9,
                top: 68,
                width: 6,
                height: 384,
                borderRadius: 6,
                backgroundImage:
                  'linear-gradient(0deg, #ffa43d 15.6%, #fff 34.4%, #fff 34.4%, #ffc628 53.1%, #ffc628 53.1%, #e94555 71.9%, #e94555 71.9%, #00a2fe 90.6%)',
                WebkitMaskImage: `url(${rankGradientMaskImg})`,
                maskImage: `url(${rankGradientMaskImg})`,
                WebkitMaskSize: '6px 384px',
                maskSize: '6px 384px',
              }}
            />
            <div className="dp-abs" style={{ ...headingFont, left: 44, top: 0, fontSize: 14.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Ranks</div>
            <div className="dp-abs" style={{ left: 0, top: 44, width: 198.1, height: 336 }}>
              <RankItem top={0} color="#00a2fe" label="Champion" icon={rankChampionImg} dots={false} />
              <RankItem top={72} color="#e94555" label="Master" icon={rankMasterImg} dots />
              <RankItem top={144} color="#ffc628" label="Gold" icon={rankGoldImg} dots />
              <RankItem top={216} color="#ffffff" label="Silver" icon={rankSilverImg} dots />
              <RankItem top={288} color="#ffa43d" label="Bronze" icon={rankBronzeImg} dots />
            </div>
            <div
              className="dp-abs"
              style={{
                left: -12,
                top: 404,
                width: 48,
                height: 48,
                borderRadius: 24,
                overflow: 'hidden',
                background: '#211a4c',
                boxShadow: '0px 0px 0px 2px #3ae8bd, 0px 0px 16px 0px #3ae8bd',
              }}
            >
              <img src={userBubbleImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <img src={userFlagImg} alt="" className="dp-abs" style={{ left: 56, top: 413.3, width: 17.3, height: 13.3, borderRadius: 1.75 }} />
            <div className="dp-abs" style={{ ...boldItalic, left: 78.9, top: 403, fontSize: 13.5, color: '#fff' }}>Maximpolakovskij</div>
            <div className="dp-abs" style={{ ...headingFont, left: 56, top: 423.5, fontSize: 10.9, color: '#3ae8bd', textTransform: 'uppercase' }}>Unranked</div>
          </div>
        </div>

        {/* Left icon rail 0,60,80,1140 */}
        <div className="dp-abs" style={{ left: 0, top: 60, width: 80, height: 1140 }}>
          <div className="dp-abs" style={{ ...headingFont, left: 33.9, top: 335.5, fontSize: 18.9, color: '#8f86e6' }}>0</div>
          <div className="dp-abs" style={{ left: 5, top: 266.5, width: 70, height: 77 }}>
            <img src={flameShadowImg} alt="" className="dp-abs" style={{ left: 0, top: 0, width: 70, height: 77 }} />
            <img src={flameMidImg} alt="" className="dp-abs" style={{ left: 2.5, top: -4.6, width: 65, height: 73, transform: 'rotate(2deg)' }} />
            <img src={flameShadow1Img} alt="" className="dp-abs" style={{ left: 0, top: 0, width: 70, height: 77 }} />
            <img src={flameMainImg} alt="" className="dp-abs" style={{ left: -1.75, top: 0, width: 73.5, height: 77 }} />
          </div>
          <div className="dp-abs" style={{ left: 0, top: 382.5, width: 80, height: 322 }}>
            <SidebarIcon top={0} icon={dailyIconImg} />
            <SidebarIcon top={110} icon={competitiveIconImg} />
            <SidebarIcon top={220} icon={worldIconImg} badge={worldBadgeImg} />
          </div>
        </div>

        {/* Header 0,0,1864,60 */}
        <div className="dp-abs" style={{ left: 0, top: 0, width: 1864, height: 60, background: 'rgba(16,16,28,0.8)' }}>
          <a href="#" className="dp-abs" style={{ left: 16, top: 16, width: 128, height: 26, display: 'block' }}>
            <img src={logoImg} alt="GeoGuessr" style={{ width: '100%', height: '100%' }} />
          </a>
          <NavLink left={188}>Singleplayer</NavLink>
          <img src={caretImg} alt="" className="dp-abs" style={{ left: 289.7, top: 28, width: 8, height: 4, opacity: 0.2 }} />
          <NavLink left={321.7} active>Multiplayer</NavLink>
          <img src={caretImg} alt="" className="dp-abs" style={{ left: 415.9, top: 28, width: 8, height: 4, opacity: 0.2 }} />
          <NavLink left={447.9}>Party</NavLink>
          <img src={caretImg} alt="" className="dp-abs" style={{ left: 497.5, top: 28, width: 8, height: 4, opacity: 0.2 }} />
          <div className="dp-abs" style={{ left: 531.2, top: 20, width: 4, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <div className="dp-abs" style={{ ...boldItalic, left: 554.5, top: 22, fontSize: 10.7, textTransform: 'uppercase', background: 'linear-gradient(to bottom, #ffffff 6.5%, #d5d5f3)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Community</div>
          <div className="dp-abs" style={{ left: 648.1, top: 0, width: 30, height: 60 }}>
            <div className="dp-abs" style={{ ...boldItalic, left: 0, top: 22, fontSize: 10.5, textTransform: 'uppercase', background: 'linear-gradient(to bottom, #ffffff 6.5%, #d5d5f3)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Shop</div>
            <div className="dp-abs" style={{ left: 22, top: 16, width: 6, height: 6, borderRadius: 6, background: '#ffa43d' }} />
          </div>
          <div className="dp-abs" style={{ ...boldItalic, left: 702, top: 22, fontSize: 10.5, textTransform: 'uppercase', background: 'linear-gradient(to bottom, #ffffff 6.5%, #d5d5f3)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Merch</div>
          <div className="dp-abs" style={{ ...boldItalic, left: 764.9, top: 22, fontSize: 10.7, textTransform: 'uppercase', background: 'linear-gradient(to bottom, #ffffff 6.5%, #d5d5f3)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>World Championship</div>

          <div className="dp-abs" style={{ left: 1588.75, top: 0, width: 191.25, height: 60 }}>
            <div className="dp-abs" style={{ left: -3.6, top: -9.6, width: 79.2, height: 79.2 }}>
              <img src={avatarRingImg} alt="" className="dp-abs" style={{ left: 22.2, top: 22.2, width: 34.8, height: 34.8, borderRadius: '50%' }} />
              <img src={avatarImg} alt="" style={{ width: '100%', height: '100%' }} />
            </div>
            <div className="dp-abs" style={{ ...boldItalic, left: 72, top: 12.5, fontSize: 13.5, color: '#fff' }}>Maximpolakovskij</div>
            <img src={flagSmallImg} alt="" className="dp-abs" style={{ left: 72, top: 29.5, width: 18, height: 18 }} />
            <div className="dp-abs" style={{ left: 94, top: 31.5, fontSize: 10.1, fontFamily: 'Inter, sans-serif', fontStyle: 'italic', fontWeight: 700, color: '#a685ff' }}>75</div>
          </div>

          <img src={caretImg} alt="" className="dp-abs" style={{ left: 1788, top: 28, width: 8, height: 4, opacity: 0.2 }} />

          <div
            className="dp-abs"
            style={{
              left: 1812,
              top: 10.5,
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'radial-gradient(circle, #10101c 0%, #10101c 20%, #10101c 30%, rgba(16,16,28,0) 50%)',
              boxShadow: '0px 0px 0px 3px rgba(255,255,255,0.1)',
            }}
          >
            <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 8, textAlign: 'center', fontSize: 16, color: '#ffcf4a', textTransform: 'uppercase' }}>4</div>
          </div>

          <div className="dp-abs" style={{ left: 1519.6, top: 8, width: 61.2, height: 44 }}>
            <img src={searchIconImg} alt="" className="dp-abs" style={{ left: 17, top: 10, width: 24, height: 24 }} />
          </div>
        </div>

        {/* Right collapsed community tab, clipped to frame bounds */}
        <div className="dp-abs" style={{ left: 1864, top: 0, width: 56, height: 1200, overflow: 'hidden' }}>
          <div className="dp-abs" style={{ left: 0, top: 0, width: 56, height: 60, background: '#171235', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="dp-abs" style={{ left: 12, top: 14, width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.1)' }}>
              <img src={hgIconImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div
              className="dp-abs"
              style={{
                left: 38,
                top: 6,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#e94555',
                boxShadow: '0px 1px 2px rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: 9,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                textAlign: 'center',
                lineHeight: '16px',
              }}
            >
              1
            </div>
          </div>
        </div>
      </div>

      {/* Minimized feedback tab bottom-left */}
      <div className="dp-abs" style={{ left: -21, bottom: -40, width: 42, height: 46, opacity: 0.3, borderRadius: '5px 5px 0 0', background: '#211a4c' }} />
    </div>
  );
}

function MobileNavItem({
  left,
  width,
  icon,
  iconTop,
  label,
  labelTop,
  dim,
  twoLine,
}: {
  left: number;
  width: number;
  icon: string;
  iconTop: number;
  label: string | string[];
  labelTop: number;
  dim?: boolean;
  twoLine?: boolean;
}) {
  const lines = Array.isArray(label) ? label : [label];
  return (
    <div className="dp-abs" style={{ left, top: 2, width, height: 86, opacity: dim ? 0.5 : 1 }}>
      <img src={icon} alt="" className="dp-abs" style={{ left: (width - 48) / 2, top: iconTop, width: 48, height: 48 }} />
      <div
        className="dp-abs"
        style={{
          ...boldItalic,
          left: 0,
          right: 0,
          top: labelTop,
          textAlign: 'center',
          fontSize: 10.6,
          color: 'rgba(255,255,255,0.8)',
          textTransform: 'uppercase',
          lineHeight: twoLine ? '14px' : 'normal',
        }}
      >
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </div>
  );
}

export function DualPageSectionMobile() {
  return (
    <div className="dp-frame" data-figma-frame="dual-page-mobile" style={{ width: 390, height: 820 }}>
      <div className="dp-abs" style={{ left: 0, top: 0, width: 390, height: 780 }}>
        <div
          className="dp-abs"
          style={{
            left: 0,
            top: 0,
            width: 390,
            height: 780,
            backgroundImage:
              'radial-gradient(circle at 390px -156px, rgba(58,232,189,0.5) 0%, rgba(58,232,189,0) 60%),' +
              'radial-gradient(circle at 195px -468px, rgba(58,232,189,0.5) 0%, rgba(58,232,189,0) 65%),' +
              'radial-gradient(ellipse 55px 132px at 0px -156px, rgba(121,80,229,1) 0%, rgba(121,80,229,0) 50%),' +
              'linear-gradient(90deg, #171235 0%, #171235 100%)',
          }}
        />
        <div
          className="dp-abs"
          style={{
            left: 0,
            top: 0,
            width: 390,
            height: 780,
            backgroundImage: 'radial-gradient(circle at 195px 390px, #211a4c 0%, #120e2d 27.5%, #0b081e 41.25%, #04020e 55%)',
          }}
        />

        {/* Main 0,60,390,720 */}
        <div className="dp-abs" style={{ left: 0, top: 60, width: 390, height: 720 }}>
          <div className="dp-abs" style={{ ...headingFont, left: 124.4, top: 48, width: 141.3, textAlign: 'center', fontSize: 42.6, lineHeight: '52px', color: '#fff', textTransform: 'uppercase' }}>
            Duels
          </div>
          <div className="dp-abs" style={{ ...regularItalic, left: 53.9, top: 104, width: 282.4, textAlign: 'center', fontSize: 22.9, lineHeight: '26px', color: '#ffc628' }}>
            Play 3 duels to get ranked
          </div>

          <div className="dp-abs" style={{ left: 31.2, top: 130, width: 327.6, height: 234, WebkitMaskImage: `url(${mMaskImg})`, maskImage: `url(${mMaskImg})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}>
            <img src={mDuelBgImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <img src={mDiamondImg} alt="" className="dp-abs" style={{ left: 109.2, top: 196.3, width: 171.6, height: 171.6 }} />
          <img src={mFlagImg} alt="" className="dp-abs" style={{ left: 23.3, top: 155.2, width: 17.3, height: 13.3, borderRadius: 1.75 }} />
          <div className="dp-abs" style={{ ...boldItalic, left: 46.2, top: 153.4, fontSize: 13.5, color: '#fff' }}>Maximpolakovskij</div>
          <div className="dp-abs" style={{ ...boldItalic, left: 242, top: 153.4, fontSize: 13.5, color: '#fff' }}>Unknown player</div>

          <div className="dp-abs" style={{ left: 32, top: 364, width: 326, height: 51.2 }}>
            <div
              className="dp-abs"
              style={{
                left: 40.1,
                width: 73.1,
                height: 51.2,
                borderRadius: 16,
                background: 'radial-gradient(circle, #393273 0%, #211a4c 100%)',
                boxShadow: 'inset 0px -1px 1px 0px rgba(0,0,0,0.55), inset 0px 1px 1px 0px rgba(255,255,255,0.2)',
              }}
            >
              <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 15.6, textAlign: 'center', fontSize: 14.6, color: '#ffc628', textTransform: 'uppercase' }}>Duel 1</div>
            </div>
            <div
              className="dp-abs"
              style={{
                left: 125.2,
                width: 74.3,
                height: 51.2,
                borderRadius: 16,
                background: 'linear-gradient(to bottom, rgba(16,16,28,0.5), rgba(16,16,28,0.3) 62.5%)',
                boxShadow: 'inset 0px 10px 20px 0px rgba(0,0,0,0.15)',
              }}
            >
              <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 15.6, textAlign: 'center', fontSize: 14.4, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Duel 2</div>
            </div>
            <div
              className="dp-abs"
              style={{
                left: 211.5,
                width: 74.3,
                height: 51.2,
                borderRadius: 16,
                background: 'linear-gradient(to bottom, rgba(16,16,28,0.5), rgba(16,16,28,0.3) 62.5%)',
                boxShadow: 'inset 0px 10px 20px 0px rgba(0,0,0,0.15)',
              }}
            >
              <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 15.6, textAlign: 'center', fontSize: 14.3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Duel 3</div>
            </div>
          </div>

          <div
            className="dp-abs"
            style={{
              left: 98,
              top: 431.2,
              width: 194,
              height: 59.2,
              borderRadius: 60,
              background: 'linear-gradient(to bottom, #97e851, #479440)',
              boxShadow: 'inset 0px 1px 0px 0px rgba(255,255,255,0.2), inset 0px -2px 0px 0px rgba(0,0,0,0.3), 0px 4.4px 9px rgba(0,0,0,0.25)',
            }}
          >
            <div className="dp-abs" style={{ ...boldItalic, left: 0, right: 0, top: 17, textAlign: 'center', fontSize: 17.8, color: '#fff', textTransform: 'uppercase', textShadow: '0px 1px 2px #171235' }}>Play</div>
          </div>
        </div>

        {/* Bottom nav 0,728,390,92 */}
        <div className="dp-abs" style={{ left: 0, top: 728, width: 390, height: 92, background: '#211a4c', borderTop: '4px solid #4e4497' }}>
          <div className="dp-abs" style={{ left: 0, top: 4, width: 390, height: 88, background: 'linear-gradient(to bottom, #393273, #211a4c)', borderTop: '2px solid #171235' }}>
            <div className="dp-abs" style={{ left: 195, top: 0, width: 97.5, height: 86, background: 'linear-gradient(to bottom, #5d51b6, #393273)' }} />
            <MobileNavItem left={0} width={96} icon={mHomeIconImg} iconTop={11} label="Home" labelTop={61} dim />
            <MobileNavItem left={96} width={98} icon={mDailyIconImg} iconTop={4} label={['Daily', 'Challenge']} labelTop={53} twoLine />
            <MobileNavItem left={194} width={98} icon={mCompetitiveIconImg} iconTop={11} label="Competitive" labelTop={61} />
            <MobileNavItem left={292} width={98} icon={mWorldIconImg} iconTop={11} label="World" labelTop={61} dim />
          </div>
        </div>

        {/* Header 0,0,390,60 */}
        <div className="dp-abs" style={{ left: 0, top: 0, width: 390, height: 60, background: 'rgba(16,16,28,0.6)', backdropFilter: 'blur(12px)' }}>
          <img src={mSearchIconImg} alt="" className="dp-abs" style={{ left: 170, top: 18, width: 24, height: 24 }} />
          <div className="dp-abs" style={{ left: 206.8, top: -5.2, width: 70.4, height: 70.4 }}>
            <img src={mAvatarRingImg} alt="" className="dp-abs" style={{ left: 19.7, top: 19.7, width: 31, height: 31, borderRadius: '50%' }} />
            <img src={mAvatarImg} alt="" style={{ width: '100%', height: '100%' }} />
          </div>
          <img src={mCaretImg} alt="" className="dp-abs" style={{ left: 266, top: 28, width: 8, height: 4, opacity: 0.2 }} />
          <div
            className="dp-abs"
            style={{
              left: 286,
              top: 10.5,
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'radial-gradient(circle, #10101c 0%, #10101c 20%, #10101c 30%, rgba(16,16,28,0) 50%)',
              boxShadow: '0px 0px 0px 3px rgba(255,255,255,0.1)',
            }}
          >
            <div className="dp-abs" style={{ ...headingFont, left: 0, right: 0, top: 8, textAlign: 'center', fontSize: 16, color: '#ffcf4a', textTransform: 'uppercase' }}>4</div>
          </div>
          <img src={mBellImg} alt="" className="dp-abs" style={{ left: 350, top: 18, width: 24, height: 24 }} />
          <div
            className="dp-abs"
            style={{
              left: 356,
              top: 11.2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#c9333a',
              border: '2px solid #11101f',
              color: '#fff',
              fontSize: 9.6,
              fontFamily: 'Inter, sans-serif',
              textAlign: 'center',
              lineHeight: '14px',
            }}
          >
            1
          </div>
          <img src={mHamburgerImg} alt="" className="dp-abs" style={{ left: 32, top: 21.5, width: 24, height: 14 }} />
        </div>
      </div>

      {/* Minimized feedback tab */}
      <div className="dp-abs" style={{ left: -21, top: 814, width: 42, height: 46, opacity: 0.3, borderRadius: '5px 5px 0 0', background: '#211a4c' }} />
    </div>
  );
}

export function DualPageSection() {
  return (
    <div>
      <DualPageSectionDesktop />
      <DualPageSectionMobile />
    </div>
  );
}
