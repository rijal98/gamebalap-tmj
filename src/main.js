import { Game } from './core/Game.js';

const canvas = document.querySelector('#game');
try {
  const game = new Game(canvas);
  game.start();
  window.__game = game; // memudahkan debugging dari konsol peramban
} catch (err) {
  console.error(err);
  document.getElementById('fatal').classList.remove('hidden');
  document.getElementById('menu').classList.add('hidden');
}
