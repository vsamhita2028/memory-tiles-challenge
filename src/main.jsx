import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import memo from './assets/memo.png';
import memoRocket from './assets/memo-rocket.png';

const PAIRS = [
  { id: 'crm', product: 'Zoho CRM', use: 'Manage customer relationships', symbol: '◉' },
  { id: 'desk', product: 'Zoho Desk', use: 'Manage customer support tickets', symbol: '✳' },
  { id: 'flow', product: 'Zoho Flow', use: 'Automate workflows between applications', symbol: '↗' },
  { id: 'catalyst', product: 'Zoho Catalyst', use: 'Build and deploy cloud applications', symbol: '✦' },
  { id: 'creator', product: 'Zoho Creator', use: 'Build low-code business applications', symbol: '◇' },
  { id: 'analytics', product: 'Zoho Analytics', use: 'Analyze business data', symbol: '▥' },
];
const DURATION = 120;
const PREVIEW_SECONDS = 3;

function makeDeck() {
  const deck = PAIRS.flatMap((pair) => [
    { ...pair, key: `${pair.id}-product`, kind: 'product', text: pair.product },
    { ...pair, key: `${pair.id}-use`, kind: 'use case', text: pair.use },
  ]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
const DB_NAME = 'memory-tiles-leaderboard';
function openLeaderboard() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readScores(limit = 10) {
  const db = await openLeaderboard();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readonly');
    const request = tx.objectStore('scores').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.seconds - b.seconds || a.attempts - b.attempts || a.id - b.id).slice(0, limit));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
async function saveScore(score) {
  const db = await openLeaderboard();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readwrite');
    tx.objectStore('scores').add(score);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
function Leaderboard({ scores, storageError }) {
  return <section className="leaderboard" aria-labelledby="leaderboard-heading"><div className="leaderboard-header"><div><div className="section-kicker">MEMO’S MEMORY CREW</div><h2 id="leaderboard-heading">Leaderboard <span className="heading-spark">✦</span></h2><p>Fastest wins on this device, with attempts as the tiebreaker.</p></div><span className="leaderboard-badge">TOP 10</span></div>{storageError ? <p className="leaderboard-empty" role="status">Leaderboard storage is unavailable in this browser.</p> : scores.length === 0 ? <p className="leaderboard-empty">No explorers yet. Help Memo find all six matches to take the first spot!</p> : <ol className="score-list">{scores.map((score, index) => <li key={score.id}><span className="score-rank">{String(index + 1).padStart(2, '0')}</span><strong>{score.name}</strong><span className="score-attempts">{score.attempts} {score.attempts === 1 ? 'attempt' : 'attempts'}</span><span className="score-time">{formatTime(score.seconds)}</span></li>)}</ol>}</section>;
}
function Tile({ tile, index, revealed, matched, disabled, onClick }) {
  const state = matched ? 'matched' : revealed ? 'revealed' : 'face down';
  return <button type="button" className={`tile ${revealed || matched ? 'is-revealed' : ''} ${matched ? 'is-matched' : ''}`} onClick={onClick} disabled={disabled} aria-disabled={matched || revealed || undefined} aria-label={`Tile ${index + 1}, ${tile.kind}, ${state}${revealed || matched ? `: ${tile.text}` : ''}`}>
    <span className="tile-inner">
      <span className={`tile-face tile-back ${tile.kind === 'product' ? 'product-back' : 'use-back'}`} aria-hidden="true"><img className="tile-memo" src={memo} alt=""/><span className="back-type">{tile.kind === 'product' ? 'PRODUCT' : 'USE CASE'}</span><span className="tile-number">{String(index + 1).padStart(2, '0')}</span></span>
      <span className="tile-face tile-front" aria-hidden="true"><span className="tile-icon">{tile.kind === 'product' ? tile.symbol : '↗'}</span><span className="tile-copy"><span className="tile-type">{tile.kind === 'product' ? 'ZOHO PRODUCT' : 'WHAT IT DOES'}</span><span className="tile-text">{tile.text}</span></span>{matched && <span className="match-check">✓</span>}</span>
    </span>
  </button>;
}
function App() {
  const [deck, setDeck] = useState(makeDeck);
  const [phase, setPhase] = useState('ready');
  const [selected, setSelected] = useState([]);
  const [matched, setMatched] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [remaining, setRemaining] = useState(DURATION);
  const [previewRemaining, setPreviewRemaining] = useState(PREVIEW_SECONDS);
  const [playerName, setPlayerName] = useState('');
  const [scores, setScores] = useState([]);
  const [storageError, setStorageError] = useState(false);
  const [nameError, setNameError] = useState('');
  const [checkingName, setCheckingName] = useState(false);
  const deadline = useRef(null);
  const mismatchTimer = useRef(null);

  useEffect(() => {
    if (phase !== 'preview') return;
    const previewEnd = Date.now() + PREVIEW_SECONDS * 1000;
    const update = () => {
      const left = Math.max(0, Math.ceil((previewEnd - Date.now()) / 1000));
      setPreviewRemaining(left);
      if (left === 0) {
        deadline.current = Date.now() + DURATION * 1000;
        setPhase('playing');
      }
    };
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const update = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) { clearTimeout(mismatchTimer.current); setSelected([]); setPhase('lost'); }
    };
    update();
    const timer = setInterval(update, 200);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => () => clearTimeout(mismatchTimer.current), []);
  useEffect(() => { readScores().then(setScores).catch(() => setStorageError(true)); }, []);

  async function startGame() {
    const name = playerName.trim();
    if (!name || checkingName) return;
    setCheckingName(true);
    setNameError('');
    try {
      const existing = await readScores(Infinity);
      if (existing.some((score) => score.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        setNameError('This name is already on the leaderboard. Please use another name.');
        setCheckingName(false);
        return;
      }
    } catch {
      setStorageError(true);
      setNameError('Unable to check the leaderboard. Please enable browser storage and try again.');
      setCheckingName(false);
      return;
    }
    setCheckingName(false);
    clearTimeout(mismatchTimer.current);
    setDeck(makeDeck()); setSelected([]); setMatched([]); setAttempts(0); setRemaining(DURATION);
    setPreviewRemaining(PREVIEW_SECONDS);
    setPhase('preview');
  }
  function returnHome() {
    clearTimeout(mismatchTimer.current);
    setPlayerName(''); setNameError(''); setDeck(makeDeck()); setSelected([]); setMatched([]); setAttempts(0); setRemaining(DURATION);
    setPhase('ready');
  }
  function choose(tile) {
    if (phase !== 'playing' || selected.length === 2 || selected.includes(tile.key) || matched.includes(tile.id)) return;
    if (Date.now() >= deadline.current) { setRemaining(0); setPhase('lost'); return; }
    if (selected.length === 0) { setSelected([tile.key]); return; }
    const first = deck.find((item) => item.key === selected[0]);
    setSelected([first.key, tile.key]);
    setAttempts((count) => count + 1);
    if (first.id === tile.id && first.kind !== tile.kind) {
      const next = [...matched, tile.id];
      setMatched(next); setSelected([]);
      if (next.length === PAIRS.length) {
        const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
        setRemaining(left);
        setPhase('won');
        saveScore({ name: playerName.trim(), seconds: DURATION - left, attempts: attempts + 1 }).then(readScores).then(setScores).catch(() => setStorageError(true));
      }
    } else {
      mismatchTimer.current = setTimeout(() => setSelected([]), 850);
    }
  }
  const finished = phase === 'won' || phase === 'lost';
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><span className="brand-name"><img src={memo} alt="" /> Memo’s Memory Mission</span><div className="event-label"><span className="event-dot"/> REACT HYDERABAD UTSAVAM <span>2026</span></div></div></header>
    <main className="main-wrap">
      {phase === 'ready' && <div className="intro-row"><div><div className="eyebrow"><span/> A LITTLE MISSION WITH MEMO</div><h1>Big ideas start with<br/><em>a little curiosity.</em></h1><p className="intro-text">Meet Memo, a curious explorer on a mission to discover Zoho’s tools. Help connect each product to what it does—and get Memo ready to build with Catalyst!</p><div className="mission-tag"><span>✦</span> YOUR MISSION: 6 MATCHES, 2 MINUTES</div></div><div className="intro-art" aria-hidden="true"><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/><span className="art-dot dot-one"/><span className="art-dot dot-two"/><span className="art-plus">✦</span><span className="memo-halo"/><img className="hero-memo" src={memo} alt=""/><span className="memo-hello"><strong>Hi, I’m Memo!</strong><span>Will you help me connect the dots?</span></span></div></div>}
      <section className={`game-panel ${phase !== 'ready' ? 'game-panel-active' : ''}`} aria-labelledby="game-heading">
        <div className="panel-top"><div><div className="section-kicker"><span className="tiny-grid">▦</span> MEMO’S MISSION</div><h2 id="game-heading">Memory Tiles <span className="heading-spark">✳</span></h2><p>Help Memo match each product to what it does.</p></div><div className="stats" aria-label="Game statistics"><div className={`stat ${remaining <= 20 && phase === 'playing' ? 'urgent' : ''}`}><span className="stat-label">TIME LEFT</span><strong>{formatTime(remaining)}</strong></div><span className="stat-divider"/><div className="stat"><span className="stat-label">ATTEMPTS</span><strong>{String(attempts).padStart(2, '0')}</strong></div><span className="stat-divider"/><div className="stat"><span className="stat-label">MATCHED</span><strong>{matched.length}<small> / 6</small></strong></div></div></div>
        <div className="board-area"><div className="board-heading"><div className="board-hint"><span className="hint-icon">✧</span> Blue = product · Lavender = use case</div><div className="board-actions"><span className="board-status"><span/> {phase === 'preview' ? 'PREVIEW' : phase === 'playing' ? 'GAME IN PROGRESS' : finished ? 'GAME COMPLETE' : 'READY WHEN YOU ARE'}</span>{(phase === 'playing' || phase === 'preview') && <button type="button" className="exit-button" onClick={returnHome}>Exit game</button>}</div></div>
          {phase === 'ready' ? <div className="product-guide"><div className="guide-intro"><div><span className="card-eyebrow">BEFORE YOU BEGIN</span><h3>Help Memo connect the dots.</h3><p>Memo is learning what each tool can do. Explore the pairs below, then find all six matches before the two minutes are up.</p></div><div className="start-controls"><label htmlFor="player-name">YOUR NAME</label><input id="player-name" required maxLength={30} value={playerName} onChange={(event) => { setPlayerName(event.target.value); setNameError(''); }} placeholder="Enter your name" autoComplete="nickname" aria-invalid={!!nameError} aria-describedby={nameError ? "name-error" : undefined}/><button className="primary-button" onClick={startGame} disabled={!playerName.trim() || checkingName}>{checkingName ? 'Checking name…' : 'Join Memo’s mission'} <span>↗</span></button>{nameError && <span id="name-error" className="name-error" role="alert">{nameError}</span>}</div></div><div className="guide-list">{PAIRS.map((pair) => <div className="guide-pair" key={pair.id}><span className="guide-icon" aria-hidden="true">{pair.symbol}</span><div><strong>{pair.product}</strong><span>{pair.use}</span></div></div>)}</div><div className="guide-footer"><span>◷ &nbsp; 2 MINUTES &nbsp; · &nbsp; 6 MATCHES</span><span>Blue tiles are products; lavender tiles are use cases.</span></div></div> : <div className="board-wrap">{phase === 'preview' && <p className="preview-message" role="status" aria-live="polite">Memo’s giving you a peek! The mission starts in <strong>{previewRemaining}</strong> seconds.</p>}<div className="tile-grid">{deck.map((tile, index) => <Tile key={tile.key} tile={tile} index={index} revealed={phase === 'preview' || selected.includes(tile.key)} matched={matched.includes(tile.id)} disabled={phase !== 'playing' || selected.length === 2} onClick={() => choose(tile)} />)}</div>
          {finished && <div className="start-overlay result-overlay" role="status" aria-live="polite"><div className="start-card result-card"><img className="result-memo" src={phase === 'won' ? memoRocket : memo} alt=""/><span className="card-eyebrow">{phase === 'won' ? 'ALL MATCHED UP' : 'TIME IS UP'}</span><h3>{phase === 'won' ? 'Mission accomplished!' : 'A great start!'}</h3><p>{phase === 'won' ? 'You helped Memo discover every match. Now those big ideas are ready to launch!' : `You helped Memo discover ${matched.length} of 6 pairs. Every explorer learns along the way!`}</p><div className="result-stats"><div><strong>{formatTime(DURATION - remaining)}</strong><span>TIME ELAPSED</span></div><div><strong>{attempts}</strong><span>ATTEMPTS</span></div></div><button className="primary-button" onClick={returnHome}>Back to home <span>↗</span></button></div></div>}</div>}
          <div className="board-footer"><span className="memo-note"><img src={memo} alt=""/> {phase === 'preview' ? 'Memo says: take a good look!' : phase === 'playing' ? 'Memo is cheering you on!' : 'A little curiosity goes a long way.'}</span><span>MADE FOR CURIOUS MINDS <span className="footer-heart">♥</span></span></div>
        </div>
      </section>
      <Leaderboard scores={scores} storageError={storageError} />
      <footer className="page-footer"><span>A little curiosity goes a long way <span>✦</span></span><span>ZOHO CATALYST &nbsp; / &nbsp; REACT HYDERABAD UTSAVAM 2026</span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
