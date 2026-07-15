'use client';
import { useEffect } from 'react';
import { ReactLenis } from 'lenis/react';
import {
  ArrowUpRight, ArrowRight, Menu, Sparkles,
  Receipt, Wallet, Network,
  ShieldCheck, Repeat, Percent,
  Landmark, Coins, Layers, LineChart, Bitcoin,
  Github, Twitter, MessageCircle, BookOpen, Globe as GlobeIcon,
} from 'lucide-react';
import Globe from './components/Globe';
import HorizontalScroll from './components/HorizontalScroll';

/* Brand logo — upward arrow mark */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="10" fill="#eaf9ea" stroke="url(#lg)" strokeWidth="1.5" />
      <path d="M16 23V10.5M16 10.5L10.5 16M16 10.5L21.5 16" stroke="url(#lg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const VAULTS = [
  { Icon: LineChart, title: 'Tokenized equity vault', desc: 'Post tokenized stocks and ETFs, keep the exposure, unlock cash.', ltv: 'Borrow at 0% · up to 75% LTV' },
  { Icon: Coins, title: 'Liquid staking vault', desc: 'Let staked ETH keep earning while it backs your aUSD.', ltv: 'Borrow at 0% · up to 80% LTV' },
  { Icon: Layers, title: 'Stablecoin vault', desc: 'Deep, low-volatility collateral for the tightest ratios.', ltv: 'Borrow at 0% · up to 95% LTV' },
  { Icon: Bitcoin, title: 'Crypto major vault', desc: 'BTC and ETH as blue-chip collateral, ready to mint.', ltv: 'Borrow at 0% · up to 70% LTV' },
];

const PROBLEMS = [
  { Icon: Receipt, title: 'Selling triggers taxes', desc: 'Selling a position to raise liquidity triggers a taxable event and permanently ends your exposure to the asset.' },
  { Icon: Wallet, title: 'Idle collateral', desc: 'Assets left sitting in a wallet earn nothing and back nothing. Locked in a vault, the same collateral mints aUSD you can actually put to work.' },
  { Icon: Network, title: 'Fragmented liquidity', desc: 'Liquidity split across wallets, chains and venues is hard to move and harder to price. One vault standard consolidates it into a single unit of account.' },
];

const STEPS = [
  { n: '1', title: 'Deposit collateral', desc: 'Supply crypto, LSTs, stables or tokenized equities.' },
  { n: '2', title: 'Mint aUSD', desc: 'Draw a stable, redeemable dollar against your position.' },
  { n: '3', title: 'Deploy anywhere', desc: 'Spend, farm, or provide it to the Stability Pool.' },
  { n: '4', title: 'Repay on your terms', desc: 'Close whenever you like and reclaim your collateral in full.' },
];

const AUSD_POINTS = [
  { Icon: ShieldCheck, title: 'Always overcollateralized.', desc: 'Minimum 110% backing enforced by the protocol at all times.' },
  { Icon: Repeat, title: 'Instantly redeemable.', desc: 'Swap aUSD for underlying collateral at face value, on-chain.' },
  { Icon: Percent, title: 'Interest-free to mint.', desc: 'Pay a one-time fee, then hold your loan for as long as you want.' },
];

const PARTNERS = ['Ascend Chain', 'Vaultworks', 'Chainlink', 'Pyth', 'Curve', 'Aave', 'Etherscan', 'Ledger', 'MetaMask', 'Safe'];

export default function App() {
  useReveal();

  return (
    <ReactLenis root>
      {/* shared SVG gradient defs */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0" stopColor="#12d61b" />
            <stop offset="1" stopColor="#058a15" />
          </linearGradient>
        </defs>
      </svg>

      {/* NAV */}
      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top"><Logo /><span className="brandmark">Ascend</span></a>
          <nav className="nav-links">
            <a href="#borrow">Borrow</a>
            <a href="#stability">Stability Pool</a>
            <a href="#markets">Markets</a>
            <a href="#ausd">aUSD</a>
            <a href="#governance">Governance</a>
          </nav>
          <div className="nav-cta">
            <a className="btn btn-ghost" href="#ausd"><BookOpen size={16} /> Docs</a>
            <a className="btn btn-primary" href="#top">Launch Testnet <ArrowUpRight size={16} /></a>
            <button className="menu-btn" aria-label="Menu" onClick={() => document.querySelector('#ausd')?.scrollIntoView({ behavior: 'smooth' })}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="top">
        <div className="hero-orbs"><span className="bloom a" /><span className="bloom b" /></div>
        <div className="wrap">
          <span className="eyebrow reveal"><Sparkles size={13} /> Live on Ascend Chain testnet</span>
          <h1 className="reveal">Borrow against what<br />you <span className="grad">already own</span></h1>
          <p className="sub reveal">Supply crypto, stablecoins or tokenized equities as collateral, mint <b>aUSD</b> against them, and keep your upside without selling a single share.</p>
          <div className="hero-cta reveal">
            <a className="btn btn-primary" href="#top">Get Started <ArrowRight size={16} /></a>
            <a className="btn btn-ghost" href="#markets">Talk to the team</a>
          </div>
          <div className="trust reveal">
            <div><b>$0</b>collateral sold to borrow</div>
            <div><b>110%</b>minimum collateral ratio</div>
            <div><b>0%</b>recurring interest on core vaults</div>
          </div>

          <div className="vaults">
            {VAULTS.map(({ Icon, title, desc, ltv }, i) => (
              <div className="vault reveal" key={i}>
                <div className="spark"><Icon size={20} strokeWidth={2} /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
                <div className="apr">{ltv}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GLOBE + MARQUEE */}
      <section className="section globe-section" id="markets">
        <div className="wrap globe-grid">
          <div className="reveal">
            <span className="eyebrow"><GlobeIcon size={13} /> One liquidity layer</span>
            <h2 className="globe-title">Liquidity without <em>borders</em></h2>
            <p className="globe-copy">aUSD settles the same way in every market your collateral touches — from New York to Singapore. One unit of account, redeemable everywhere the protocol lives.</p>
            <a className="btn btn-primary" href="#ausd">Explore aUSD <ArrowRight size={16} /></a>
          </div>
          <div className="reveal globe-holder"><Globe /></div>
        </div>
        <p className="marquee-label">Backed &amp; integrated across the on-chain economy</p>
        <div className="marquee">
          <div className="marquee-track">
            {[...PARTNERS, ...PARTNERS].map((name, i) => (
              <div className="lg-chip" key={i}><Landmark size={18} />{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="section" id="borrow">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow reveal">The problem</span>
            <h2 className="reveal">Owning an asset shouldn't mean <em>locking up</em> its value</h2>
            <p className="reveal">Traditional paths to liquidity force a trade-off: sell and lose your position, or leave capital sitting idle. Ascend removes the trade-off.</p>
          </div>
          <div className="problems">
            {PROBLEMS.map(({ Icon, title, desc }, i) => (
              <div className="prob reveal" key={i}>
                <div className="prob-ico"><Icon size={26} strokeWidth={2} /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HORIZONTAL SCROLL — vault types */}
      <div className="hscroll-lead wrap">
        <span className="eyebrow reveal">Vault types</span>
        <h2 className="reveal hscroll-lead-title">Four ways to turn holdings into <em>aUSD</em></h2>
        <p className="reveal hscroll-hint">Keep scrolling ↓</p>
      </div>
      <HorizontalScroll />

      {/* HOW IT WORKS / BENTO */}
      <section className="section" id="how">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow reveal">How it works</span>
            <h2 className="reveal">Four steps from holdings to <em>spendable liquidity</em></h2>
          </div>
          <div className="bento">
            <div className="cell big reveal">
              <div>
                <h3>Open a vault, keep your upside</h3>
                <p>Deposit collateral once and mint against it whenever you need. Your assets stay yours — every dividend, staking reward and price gain still belongs to you.</p>
                {STEPS.map((s) => (
                  <div className="step" key={s.n}>
                    <span className="n">{s.n}</span>
                    <div><h4>{s.title}</h4><p>{s.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="cell reveal" id="stability">
              <h3>Stability Pool</h3>
              <p>Deposit aUSD to backstop the system and earn liquidation rewards and protocol emissions in return.</p>
              <div className="flywheel">
                <svg className="ring" width="150" height="150" viewBox="0 0 150 150">
                  <circle cx="75" cy="75" r="62" stroke="#eef1ee" strokeWidth="11" fill="none" />
                  <circle cx="75" cy="75" r="62" stroke="url(#lg)" strokeWidth="11" fill="none" strokeLinecap="round" strokeDasharray="389" strokeDashoffset="86" transform="rotate(-90 75 75)" />
                  <circle cx="75" cy="13" r="4.5" fill="#00c805" />
                </svg>
                <div className="core"><div><b>78%</b><span>deposited</span></div></div>
              </div>
            </div>
            <div className="cell reveal" id="governance">
              <h3>Governance</h3>
              <p>ASC holders set collateral types, fees and risk parameters. Protocol-owned, community-steered.</p>
            </div>
          </div>
        </div>
      </section>

      {/* aUSD */}
      <section className="section" id="ausd">
        <div className="wrap ausd">
          <div className="reveal coin-wrap">
            <svg className="coin" viewBox="0 0 200 200" fill="none">
              <defs>
                <radialGradient id="cg" cx="35%" cy="30%" r="80%">
                  <stop offset="0" stopColor="#eaf9ea" /><stop offset="1" stopColor="#c9f2cb" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="92" fill="url(#cg)" stroke="#00c805" strokeWidth="2.5" />
              <circle cx="100" cy="100" r="74" stroke="#00c805" strokeWidth="1" strokeOpacity=".4" />
              <path d="M100 58v84M78 78h30a17 17 0 010 34H78m0-34h44m-44 34h44" stroke="url(#lg)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <text x="100" y="168" textAnchor="middle" fill="#058a15" fontFamily="'JetBrains Mono',monospace" fontSize="15" fontWeight="700" letterSpacing="2">aUSD</text>
            </svg>
          </div>
          <div className="reveal">
            <span className="eyebrow">The stablecoin</span>
            <h2>aUSD, a dollar backed by <em>everything you own</em></h2>
            <p className="ausd-lead">Every aUSD in circulation is overcollateralized and redeemable for a dollar of underlying collateral — no custodians, no off-chain reserves to trust.</p>
            <ul>
              {AUSD_POINTS.map(({ Icon, title, desc }, i) => (
                <li key={i}><span className="check"><Icon size={18} strokeWidth={2.2} /></span><span><b>{title}</b> {desc}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="wrap">
          <div className="cta-box reveal">
            <h2>Put your portfolio <em>to work</em></h2>
            <p>Open a vault on the Ascend testnet, mint aUSD, and feel what borrowing without selling is like.</p>
            <div className="cta-actions">
              <a className="btn btn-primary" href="#top">Launch Testnet <ArrowUpRight size={16} /></a>
              <a className="btn btn-ghost" href="#ausd">Read the docs</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="governance">
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <a className="brand" href="#top"><Logo /><span className="brandmark">Ascend</span></a>
              <p>A decentralized borrowing protocol. Borrow against what you already own and keep your upside.</p>
            </div>
            <div>
              <h5>Protocol</h5>
              <a href="#borrow">Borrow</a><a href="#stability">Stability Pool</a><a href="#markets">Markets</a><a href="#ausd">aUSD</a>
            </div>
            <div>
              <h5>Resources</h5>
              <a href="#">Docs</a><a href="#">Risks</a><a href="#">Changelog</a><a href="#">Contact</a>
            </div>
            <div>
              <h5>Community</h5>
              <a href="#"><MessageCircle size={14} /> Discord</a>
              <a href="#"><Twitter size={14} /> X / Twitter</a>
              <a href="#"><Github size={14} /> GitHub</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Ascend Finance. All rights reserved.</span>
            <span>Terms &amp; Conditions · Privacy · Not financial advice</span>
          </div>
        </div>
      </footer>
    </ReactLenis>
  );
}
