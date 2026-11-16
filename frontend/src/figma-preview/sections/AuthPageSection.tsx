import type { CSSProperties } from 'react';
import './AuthPageSection.css';

import dBgPoster from '../assets/auth-page/desktop/bg-poster.png';
import dHorrorPromo from '../assets/auth-page/desktop/horror-promo.png';
import dGeoguessrPin from '../assets/auth-page/desktop/geoguessr-pin.png';
import dLogo from '../assets/auth-page/desktop/logo.svg';
import dAvailableOn from '../assets/auth-page/desktop/available-on.svg';
import dRatingStar from '../assets/auth-page/desktop/rating-star.svg';
import dArrow from '../assets/auth-page/desktop/arrow.svg';
import dPlayIcon from '../assets/auth-page/desktop/play-icon.svg';
import dGoogleLogo from '../assets/auth-page/desktop/google-logo.svg';
import dAppleLogo from '../assets/auth-page/desktop/apple-logo.svg';
import dFacebookLogo from '../assets/auth-page/desktop/facebook-logo.svg';
import dLanguageIcon from '../assets/auth-page/desktop/language-icon.svg';
import dLanguageMask from '../assets/auth-page/desktop/language-mask.svg';
import iconPlus from '../assets/auth-page/desktop/icon-plus.svg';
import logoMono from '../assets/auth-page/desktop/logo-mono.svg';

import mContainer from '../assets/auth-page/mobile/container.png';
import mImage from '../assets/auth-page/mobile/image.png';
import mGeoguessrPin from '../assets/auth-page/mobile/geoguessr-pin.png';
import mLogo from '../assets/auth-page/mobile/logo.svg';
import mAvailableOn from '../assets/auth-page/mobile/available-on.svg';
import mRatingStar from '../assets/auth-page/mobile/rating-star.svg';
import mArrow from '../assets/auth-page/mobile/arrow.svg';
import mPauseIcon from '../assets/auth-page/mobile/pause-icon.svg';
import mLanguageIcon from '../assets/auth-page/mobile/language-icon.svg';
import mLanguageMask from '../assets/auth-page/mobile/language-mask.svg';
import mCloseIcon from '../assets/auth-page/mobile/close-icon.svg';

const boldItalic: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontStyle: 'italic' };
const blackItalic: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 900, fontStyle: 'italic' };
const regular: CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 400 };

const gradientPillText: CSSProperties = {
  background: 'linear-gradient(to bottom, #ffffff 6.5%, #d5d5f3)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

function GradientPill({ left, top, width, height, label }: { left: number; top: number; width: number; height: number; label: string }) {
  return (
    <div className="ap-abs" style={{ left, top, width, height, borderRadius: height }}>
      <div
        className="ap-abs"
        style={{
          inset: 0,
          borderRadius: height,
          backdropFilter: 'blur(4.5px)',
          background: 'linear-gradient(to bottom, rgba(189,181,255,0.2), rgba(143,134,230,0.2))',
          boxShadow: 'inset 0px 0.75px 0px 0px rgba(255,255,255,0.2), inset 0px -1.5px 0px 0px rgba(0,0,0,0.3)',
        }}
      />
      <div
        className="ap-abs"
        style={{
          ...boldItalic,
          ...gradientPillText,
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: height * 0.4,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ProviderButton({
  top,
  height,
  bg,
  color,
  border,
  icon,
  iconSize,
  label,
  fontSize,
}: {
  top: number;
  height: number;
  bg: string;
  color: string;
  border?: string;
  icon?: string;
  iconSize?: number;
  label: string;
  fontSize: number;
}) {
  return (
    <div
      className="ap-abs"
      style={{
        left: 16,
        right: 16,
        top,
        height,
        borderRadius: 36,
        background: bg,
        border,
        boxShadow: '0px 4px 12px 0px rgba(16,16,28,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {icon && <img src={icon} alt="" style={{ width: iconSize, height: iconSize }} />}
      <span style={{ ...boldItalic, color, fontSize }}>{label}</span>
    </div>
  );
}

function SignupCard({ width, height, close }: { width: number; height: number; close?: string }) {
  return (
    <div
      className="ap-abs"
      style={{
        left: 0,
        top: 0,
        width,
        height,
        borderRadius: 16,
        background: '#211a4c',
        boxShadow:
          '0px 4px 4px 0px rgba(16,16,28,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.1), inset 0px 2px 8px 0px rgba(93,81,182,0.5), inset 0px 1px 0px 0px rgba(255,255,255,0.2)',
      }}
    >
      {close && <img src={close} alt="" className="ap-abs" style={{ right: 14, top: 14, width: 20, height: 20 }} />}
      <div className="ap-abs" style={{ ...boldItalic, left: 0, right: 0, top: 45, fontSize: 23.3, color: '#fff', textAlign: 'center' }}>
        Sign up to play
      </div>
      <ProviderButton top={90} height={32} bg="#fff" color="#000" icon={dGoogleLogo} iconSize={16} label="Continue with Google" fontSize={11.4} />
      <ProviderButton top={130} height={32} bg="#10101c" color="#fff" icon={dAppleLogo} iconSize={16} label="Continue with Apple" fontSize={11.4} />
      <ProviderButton top={170} height={32} bg="#4769b0" color="#fff" icon={dFacebookLogo} iconSize={20} label="Continue with Facebook" fontSize={11.4} />
      <ProviderButton top={218} height={32} bg="rgba(255,255,255,0)" color="#fff" border="2px solid rgba(255,255,255,0.2)" label="Continue with Email" fontSize={11.4} />
      <div className="ap-abs" style={{ left: 16, right: 16, top: 276.5, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, borderTop: '1px dashed rgba(255,255,255,0.1)' }} />
        <span style={{ ...boldItalic, fontSize: 10.9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Or</span>
        <div style={{ flex: 1, borderTop: '1px dashed rgba(255,255,255,0.1)' }} />
      </div>
      <div
        className="ap-abs"
        style={{ left: 16, top: 319, fontFamily: 'Inter, sans-serif', fontStyle: 'italic', fontSize: 13.5, color: 'rgba(255,255,255,0.6)' }}
      >
        Already have an account?
      </div>
      <GradientPill left={width - 16 - 76} top={305} width={76} height={28} label="Log in" />
    </div>
  );
}

export function AuthPageSectionDesktop() {
  return (
    <div className="ap-frame" data-figma-frame="auth-page-desktop" style={{ width: 1920, height: 1695 }}>
      <div className="ap-abs" style={{ left: 0, top: 0, width: 1920, height: 1240, background: '#171235' }}>
        {/* Hero backdrop */}
        <div className="ap-abs" style={{ left: 0, top: 0, width: 1920, height: 1140, overflow: 'hidden' }}>
          <img src={dBgPoster} alt="" style={{ position: 'absolute', left: '-2.78%', top: 0, width: '105.56%', height: '100%', objectFit: 'cover' }} />
          <div className="ap-abs" style={{ inset: 0, background: '#7950e5', opacity: 0.4 }} />
          <div className="ap-abs" style={{ inset: 0, background: 'rgba(16,16,28,0.4)' }} />

          <div className="ap-abs" style={{ left: 352, top: 266, width: 180, height: 44 }}>
            <img src={dLogo} alt="GeoGuessr" style={{ width: 180, height: 34.6 }} />
          </div>

          <div
            className="ap-abs"
            style={{ ...blackItalic, left: 352, top: 334, fontSize: 65.5, lineHeight: '72px', color: '#fff', textTransform: 'uppercase', textShadow: '0px 2px 4px rgba(16,16,28,0.6), 0px 1px 2px rgba(16,16,28,0.6), 0px 1px 1px rgba(16,16,28,0.6)' }}
          >
            <p className="ap-p">Explore the</p>
            <p className="ap-p">world!</p>
          </div>

          <div className="ap-abs" style={{ ...regular, left: 352, top: 518, width: 701, fontSize: 17.3, lineHeight: '22px', color: 'rgba(255,255,255,0.8)' }}>
            <p className="ap-p">Get dropped anywhere from the busy streets of New York to the beautiful beaches of</p>
            <p className="ap-p">Bali. Join 100 million players today!</p>
          </div>

          <img src={dAvailableOn} alt="Available on Web, Steam, iOS and Android" className="ap-abs" style={{ left: 352, top: 594, width: 120, height: 29 }} />
          <div className="ap-abs" style={{ ...regular, left: 352, top: 631, fontSize: 11.4, color: 'rgba(255,255,255,0.6)' }}>
            Play on Web, Steam iOS and Android
          </div>

          <div className="ap-abs" style={{ left: 567.08, top: 594, height: 51, borderLeft: '1px dashed rgba(255,255,255,0.1)' }} />
          <img src={dRatingStar} alt="4.5 out of 5" className="ap-abs" style={{ left: 584.08, top: 594, width: 92, height: 29 }} />
          <div className="ap-abs" style={{ ...regular, left: 584.08, top: 631, fontSize: 11.4, color: 'rgba(255,255,255,0.6)' }}>
            4.5/5 rating in App Store
          </div>

          <div
            className="ap-abs"
            style={{ left: 32, top: 928, width: 220, height: 180.16, borderRadius: 12, background: '#1a1a26', border: '3px solid #dc1934', overflow: 'hidden', boxShadow: '0px 8px 20px 0px rgba(26,26,46,0.85)' }}
          >
            <div style={{ ...regular, position: 'absolute', left: 12, top: 40.25, width: 180, whiteSpace: 'nowrap', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 18, lineHeight: '28.5px', color: '#dc1934', textTransform: 'uppercase' }}>
              <p className="ap-p">Play our</p>
              <p className="ap-p">free horrormode</p>
            </div>
            <img src={dArrow} alt="" className="ap-abs" style={{ left: 12, top: 136.16, width: 26, height: 18.9 }} />
            <img src={dHorrorPromo} alt="" className="ap-abs" style={{ left: 66, top: 73, width: 108, height: 101.16, objectFit: 'cover' }} />
          </div>

          <div className="ap-abs" style={{ right: 32, bottom: 32, width: 44, height: 44, borderRadius: 22, background: 'rgba(0,0,0,0.4)' }}>
            <img src={dPlayIcon} alt="Play background video" style={{ position: 'absolute', left: '50%', top: '50%', width: 17.14, height: 20, transform: 'translate(-50%,-50%)' }} />
          </div>

          <div className="ap-abs" style={{ left: 1228, top: 417.5, width: 340, height: 360 }}>
            <SignupCard width={340} height={360} />
          </div>
        </div>

        {/* Top utility bar overlapping hero */}
        <img src={dGeoguessrPin} alt="" className="ap-abs" style={{ left: 32, top: 6, width: 36, height: 36 }} />
        <div className="ap-abs" style={{ ...boldItalic, left: 86, top: 17.5, fontSize: 10.7, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          World Championship &apos;26
        </div>
        <div className="ap-abs" style={{ ...boldItalic, left: 252.17, top: 17.5, fontSize: 10.7, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Organizations
        </div>
        <div className="ap-abs" style={{ ...boldItalic, left: 360.88, top: 17.5, fontSize: 10.5, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Merch
        </div>
        <div className="ap-abs" style={{ ...boldItalic, left: 417.8, top: 17.5, fontSize: 10.5, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Gift Cards
        </div>

        <div className="ap-abs" style={{ left: 1389.64, top: 6.67, width: 101.92, height: 36, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <img src={dLanguageIcon} alt="" className="ap-abs" style={{ left: 7, top: 7, width: 20, height: 20 }} />
          <div className="ap-abs" style={{ ...regular, left: 34, top: 10, fontSize: 11.3, color: '#fff', whiteSpace: 'nowrap' }}>
            English
          </div>
          <img src={dLanguageMask} alt="" className="ap-abs" style={{ left: 79.64, top: 13.8, width: 8.4, height: 8.4 }} />
        </div>

        <div className="ap-abs" style={{ ...boldItalic, left: 1517.56, top: 17, fontSize: 10.3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Code
        </div>
        {[1556.98, 1588.98, 1620.98, 1652.98, 1684.98].map((left) => (
          <div key={left} className="ap-abs" style={{ left, top: 6, width: 28, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }} />
        ))}
        <GradientPill left={1750.59} top={15} width={41.56} height={18} label="Log in" />
        <GradientPill left={1819.77} top={10} width={68.23} height={28} label="Sign up" />

        <div className="ap-abs" style={{ left: -21, top: 1234, width: 42, height: 46, opacity: 0.3, borderRadius: '5px 5px 0 0', background: '#211a4c' }} />
      </div>

      <AuthFooter top={1240} />
    </div>
  );
}

export function AuthPageSectionMobile() {
  return (
    <div className="ap-frame" data-figma-frame="auth-page-mobile" style={{ width: 390, height: 2012 }}>
      <div className="ap-abs" style={{ left: 0, top: 0, width: 390, height: 820, background: '#171235' }}>
        <div className="ap-abs" style={{ left: 0, top: 0, width: 390, height: 741, overflow: 'hidden' }}>
          <img src={mContainer} alt="" style={{ position: 'absolute', left: '-118.89%', top: 0, width: '337.78%', height: '100%', objectFit: 'cover' }} />
          <div className="ap-abs" style={{ inset: 0, background: '#7950e5', opacity: 0.4 }} />
          <div className="ap-abs" style={{ inset: 0, background: 'rgba(16,16,28,0.4)' }} />

          <div className="ap-abs" style={{ left: 125, top: 254, width: 140, height: 34, display: 'flex', alignItems: 'center' }}>
            <img src={mLogo} alt="GeoGuessr" style={{ width: 140, height: 26.9 }} />
          </div>

          <div
            className="ap-abs"
            style={{ ...blackItalic, left: 42.86, top: 317, width: 304.48, textAlign: 'center', fontSize: 43.7, lineHeight: '52px', color: '#fff', textTransform: 'uppercase', textShadow: '0px 2px 4px rgba(16,16,28,0.6), 0px 1px 2px rgba(16,16,28,0.6), 0px 1px 1px rgba(16,16,28,0.6)' }}
          >
            <p className="ap-p">Explore the</p>
            <p className="ap-p">world!</p>
          </div>

          <div className="ap-abs" style={{ ...regular, left: 33.95, top: 456, width: 322.3, textAlign: 'center', fontSize: 17.2, lineHeight: '22px', color: 'rgba(255,255,255,0.8)' }}>
            <p className="ap-p">Get dropped anywhere from the busy</p>
            <p className="ap-p">streets of New York to the beautiful</p>
            <p className="ap-p">beaches of Bali. Join 100 million players</p>
            <p className="ap-p">today!</p>
          </div>

          <img src={mAvailableOn} alt="Available on Web, Steam, iOS and Android" className="ap-abs" style={{ left: 59.72, top: 576, width: 120, height: 29 }} />
          <div className="ap-abs" style={{ ...regular, left: 43.41, top: 612, width: 152.84, textAlign: 'center', fontSize: 11.4, color: 'rgba(255,255,255,0.6)' }}>
            <p className="ap-p">Play on Web, Steam iOS and</p>
            <p className="ap-p">Android</p>
          </div>

          <div className="ap-abs" style={{ left: 223.45, top: 576, height: 65, borderLeft: '1px dashed rgba(255,255,255,0.1)' }} />
          <img src={mRatingStar} alt="4.5 out of 5" className="ap-abs" style={{ left: 253.22, top: 576, width: 92, height: 29 }} />
          <div className="ap-abs" style={{ ...regular, left: 248.56, top: 612, width: 101.53, textAlign: 'center', fontSize: 11.6, color: 'rgba(255,255,255,0.6)' }}>
            <p className="ap-p">4.5/5 rating in App</p>
            <p className="ap-p">Store</p>
          </div>

          <div
            className="ap-abs"
            style={{ left: 16, right: 16, top: 64, height: 73.94, borderRadius: 12, background: '#1a1a26', border: '3px solid #dc1934', overflow: 'hidden', display: 'flex', alignItems: 'center', boxShadow: '0px 8px 20px 0px rgba(26,26,46,0.85)' }}
          >
            <img src={mImage} alt="" style={{ width: 64, height: 59.94, marginLeft: 8, objectFit: 'cover' }} />
            <div style={{ ...regular, flex: 1, paddingLeft: 12, fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 13.1, color: '#dc1934', textTransform: 'uppercase' }}>
              Play our free horrormode
            </div>
            <img src={mArrow} alt="" style={{ width: 24, height: 17.46, marginRight: 20 }} />
          </div>

          <div className="ap-abs" style={{ right: 32, bottom: 32, width: 44, height: 44, borderRadius: 22, background: 'rgba(0,0,0,0.4)' }}>
            <img src={mPauseIcon} alt="Pause background video" style={{ position: 'absolute', left: '50%', top: '50%', width: 17.14, height: 20, transform: 'translate(-50%,-50%)' }} />
          </div>
        </div>

        <img src={mGeoguessrPin} alt="" className="ap-abs" style={{ left: 16, top: 6, width: 36, height: 36 }} />
        <div className="ap-abs" style={{ left: 68.7, top: 6.67, width: 101.92, height: 36, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <img src={mLanguageIcon} alt="" className="ap-abs" style={{ left: 7, top: 7, width: 20, height: 20 }} />
          <div className="ap-abs" style={{ ...regular, left: 34, top: 10, fontSize: 11.3, color: '#fff', whiteSpace: 'nowrap' }}>
            English
          </div>
          <img src={mLanguageMask} alt="" className="ap-abs" style={{ left: 79.64, top: 13.8, width: 8.4, height: 8.4 }} />
        </div>

        <div className="ap-abs" style={{ ...boldItalic, left: 196.63, top: 17, fontSize: 10.3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Code
        </div>
        {[236.05, 262.44, 288.83, 315.22, 341.61].map((left) => (
          <div key={left} className="ap-abs" style={{ left, top: 8, width: 22.39, height: 32, borderRadius: 4.8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }} />
        ))}

        <div className="ap-abs" style={{ left: 0, bottom: 0, width: '100%', height: 84, background: 'rgba(16,16,28,0.8)' }}>
          <div
            className="ap-abs"
            style={{ left: 16, right: 16, top: 16, height: 52, borderRadius: 60, background: 'linear-gradient(to bottom, #97e851, #479440)', boxShadow: 'inset 0px 1px 0px 0px rgba(255,255,255,0.2), inset 0px -2px 0px 0px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ ...boldItalic, fontSize: 18, color: '#fff', textTransform: 'uppercase', textShadow: '0px 1px 2px #171235' }}>Play now</span>
          </div>
        </div>

        <div className="ap-abs" style={{ left: -21, top: 814, width: 42, height: 46, opacity: 0.3, borderRadius: '5px 5px 0 0', background: '#211a4c' }} />
      </div>

      <div className="ap-abs" style={{ left: 0, top: 820, width: 390, height: 365, borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
        <SignupCard width={358} height={365} close={mCloseIcon} />
      </div>

      <AuthFooter top={1185} mobile />
    </div>
  );
}

function AuthFooter({ top, mobile }: { top: number; mobile?: boolean }) {
  if (mobile) {
    const faqs = [
      { q: 'What is GeoGuessr?', top: 68 },
      { q: 'I have trouble accessing my account.', top: 118 },
      { q: 'Is GeoGuessr available on App Store and Google Play?', top: 168, big: true },
      { q: 'What languages is GeoGuessr available in?', top: 234 },
      { q: 'What is Seterra?', top: 284 },
    ];
    return (
      <div className="ap-abs ap-footer" style={{ left: 0, top, width: 390, height: 827 }}>
        <div className="ap-abs" style={{ ...boldItalic, left: 24, top: 48, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
          Frequently asked questions
        </div>
        {faqs.map((f) => (
          <div key={f.q} className="ap-abs" style={{ left: 24, right: 24, top: f.top, borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: f.big ? 16 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8, paddingBottom: 8 }}>
              <span style={{ ...regular, fontSize: 13.3, color: '#fff', maxWidth: 300 }}>{f.q}</span>
              <img src={iconPlus} alt="" style={{ width: 14, height: 14, marginTop: 1 }} />
            </div>
          </div>
        ))}
        <div className="ap-abs" style={{ left: 24, right: 24, top: 342, borderTop: '1px solid transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
            <span style={{ ...regular, fontSize: 13, color: '#fff' }}>Business enquiries</span>
            <img src={iconPlus} alt="" style={{ width: 14, height: 14 }} />
          </div>
        </div>
        <div className="ap-abs" style={{ left: 24, right: 24, top: 358, borderTop: '1px solid rgba(255,255,255,0.1)' }} />

        <div className="ap-abs" style={{ ...boldItalic, left: 24, top: 431, fontSize: 12.9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
          Explore
        </div>
        <div className="ap-abs" style={{ ...regular, left: 24, top: 451, fontSize: 13.1, color: 'rgba(255,255,255,0.8)' }}>
          World Championship &apos;26
        </div>
        <div className="ap-abs" style={{ ...regular, left: 24, top: 479, fontSize: 13.2, color: 'rgba(255,255,255,0.8)' }}>
          Organizations
        </div>
        <div className="ap-abs" style={{ ...regular, left: 24, top: 507, fontSize: 13.1, color: 'rgba(255,255,255,0.8)' }}>
          Merch
        </div>
        <div className="ap-abs" style={{ ...regular, left: 24, top: 535, fontSize: 13.1, color: 'rgba(255,255,255,0.8)' }}>
          Gift cards
        </div>

        <img src={logoMono} alt="GeoGuessr" className="ap-abs" style={{ left: 24, top: 577, width: 140, height: 28 }} />
        <div className="ap-abs" style={{ ...regular, left: 24, top: 634, fontSize: 12.8, color: 'rgba(255,255,255,0.6)' }}>
          <p className="ap-p">GeoGuessr AB</p>
          <p className="ap-p">Katarinavägen 17</p>
          <p className="ap-p">116 45 Stockholm, Sweden</p>
        </div>
        <div className="ap-abs" style={{ ...regular, left: 24, top: 699, fontSize: 12.8, color: 'rgba(255,255,255,0.6)' }}>
          © 2026 GeoGuessr AB
        </div>
      </div>
    );
  }

  const faqs = [
    'What is GeoGuessr?',
    'I have trouble accessing my account.',
    'Is GeoGuessr available on App Store and Google Play?',
    'What languages is GeoGuessr available in?',
    'What is Seterra?',
  ];

  return (
    <div className="ap-abs ap-footer" style={{ left: 0, top, width: 1920, height: 455 }}>
      <img src={logoMono} alt="GeoGuessr" className="ap-abs" style={{ left: 153.59, top: 64, width: 140, height: 28 }} />
      <div className="ap-abs" style={{ ...regular, left: 153.59, top: 108, fontSize: 12.8, color: 'rgba(255,255,255,0.6)' }}>
        <p className="ap-p">GeoGuessr AB</p>
        <p className="ap-p">Katarinavägen 17</p>
        <p className="ap-p">116 45 Stockholm, Sweden</p>
      </div>
      <div className="ap-abs" style={{ ...regular, left: 153.59, top: 172, fontSize: 12.8, color: 'rgba(255,255,255,0.6)' }}>
        © 2026 GeoGuessr AB
      </div>

      <div className="ap-abs" style={{ ...boldItalic, left: 580.8, top: 64, fontSize: 12.9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
        Explore
      </div>
      <div className="ap-abs" style={{ ...regular, left: 580.8, top: 92, fontSize: 13.1, color: 'rgba(255,255,255,0.8)' }}>
        World Championship &apos;26
      </div>
      <div className="ap-abs" style={{ ...regular, left: 580.8, top: 120, fontSize: 13.2, color: 'rgba(255,255,255,0.8)' }}>
        Organizations
      </div>
      <div className="ap-abs" style={{ ...regular, left: 580.8, top: 148, fontSize: 13.1, color: 'rgba(255,255,255,0.8)' }}>
        Merch
      </div>
      <div className="ap-abs" style={{ ...regular, left: 580.8, top: 176, fontSize: 13.1, color: 'rgba(255,255,255,0.8)' }}>
        Gift cards
      </div>

      <div className="ap-abs" style={{ ...boldItalic, left: 1008, top: 64, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
        Frequently asked questions
      </div>
      {faqs.map((q, i) => (
        <div key={q} className="ap-abs" style={{ left: 1008, right: 153.59, top: 92 + i * 50, borderBottom: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
          <span style={{ ...regular, fontSize: 13.2, color: '#fff' }}>{q}</span>
          <img src={iconPlus} alt="" style={{ width: 14, height: 14 }} />
        </div>
      ))}
      <div className="ap-abs" style={{ left: 1008, right: 153.59, top: 342, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...regular, fontSize: 13, color: '#fff' }}>Business enquiries</span>
        <img src={iconPlus} alt="" style={{ width: 14, height: 14 }} />
      </div>
      <div className="ap-abs" style={{ left: 1008, right: 153.59, top: 366, borderTop: '1px solid rgba(255,255,255,0.1)' }} />
    </div>
  );
}

export function AuthPageSection() {
  return (
    <div>
      <AuthPageSectionDesktop />
      <AuthPageSectionMobile />
    </div>
  );
}

