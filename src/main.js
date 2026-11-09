import '@fontsource/marcellus/latin-400.css';
import '@fontsource/tenor-sans/latin-400.css';
import './style.css';

// Switching between the flat page and the 3D flight is decided in <head>.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-reload]');
  if (!link) return;
  event.preventDefault();
  location.hash = link.getAttribute('href');
  location.reload();
});

// Flat-page visitors never download the 3D engine.
if (document.documentElement.classList.contains('fly')) {
  import('./flight/index.js').then((flight) => flight.start());
}
