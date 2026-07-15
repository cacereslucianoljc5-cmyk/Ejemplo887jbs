'use client';
import { useEffect, useRef } from 'react';
import { animate, scroll, spring } from 'motion';
import { LineChart, Coins, Layers, Bitcoin } from 'lucide-react';

/**
 * Horizontal scroll — based on the ui-layouts "horizontal-scroll" component
 * (motion `scroll` + `animate`). Rebuilt with refs (instead of global
 * document queries) so it is safe to drop into a multi-section page, and
 * themed with the Ascend vault types + lucide icons.
 */
const panels = [
  {
    tag: 'EQUITY',
    title: 'Tokenized equity vault',
    desc: 'Post tokenized stocks and ETFs, keep the exposure, unlock cash.',
    ltv: 'Borrow at 0% · up to 75% LTV',
    Icon: LineChart,
    bg: '#eaf9ea',
  },
  {
    tag: 'STAKING',
    title: 'Liquid staking vault',
    desc: 'Let staked ETH keep earning while it backs your aUSD.',
    ltv: 'Borrow at 0% · up to 80% LTV',
    Icon: Coins,
    bg: '#dff5e0',
  },
  {
    tag: 'STABLES',
    title: 'Stablecoin vault',
    desc: 'Deep, low-volatility collateral for the tightest ratios.',
    ltv: 'Borrow at 0% · up to 95% LTV',
    Icon: Layers,
    bg: '#eaf9ea',
  },
  {
    tag: 'CRYPTO',
    title: 'Crypto major vault',
    desc: 'BTC and ETH as blue-chip collateral, ready to mint.',
    ltv: 'Borrow at 0% · up to 70% LTV',
    Icon: Bitcoin,
    bg: '#dff5e0',
  },
];

export default function HorizontalScroll() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const items = track.querySelectorAll('li');

    // Drive the track horizontally as the tall section scrolls.
    const controls = animate(
      track,
      { transform: ['none', `translateX(-${items.length - 1}00vw)`] },
      { easing: spring() }
    );
    scroll(controls, { target: section });

    // Sweep each panel's big heading across as it becomes active.
    const segment = 1 / items.length;
    items.forEach((item, i) => {
      const header = item.querySelector('h2');
      if (!header) return;
      scroll(animate([header], { x: [700, -700] }), {
        target: section,
        offset: [
          [i * segment, 1],
          [(i + 1) * segment, 0],
        ],
      });
    });

    return () => {
      controls.stop?.();
    };
  }, []);

  return (
    <section ref={sectionRef} className="hscroll" style={{ height: `${panels.length * 100}vh` }}>
      <ul ref={trackRef} className="hscroll-track">
        {panels.map((p, i) => {
          const Icon = p.Icon;
          return (
            <li key={i} className="hscroll-panel" style={{ background: p.bg }}>
              <div className="hscroll-inner">
                <div className="hscroll-badge">
                  <Icon size={26} strokeWidth={2} />
                  <span>{p.tag}</span>
                </div>
                <h2 className="hscroll-h2">{p.title}</h2>
                <p className="hscroll-desc">{p.desc}</p>
                <div className="hscroll-ltv">{p.ltv}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
