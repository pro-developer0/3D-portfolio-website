import { profile, about, projects, lab, comms } from '../content.js';
import { esc, caseHTML, linkList, metricList, projectMeta, skillGroups } from '../render.js';
import { logoMark } from '../logo.js';

const FADE = 0.22; // screens of scrolling over which a panel arrives or leaves

const mail = (label, cls = 'btn') => `<a class="${cls}" href="mailto:${esc(profile.email)}">${esc(label)}</a>`;

function panelMarkup() {
  const hero = `
    <section class="panel left hero" data-beat="hero">
      <p class="kicker">${esc(profile.name)} · ${esc(profile.role)}</p>
      <h1 class="display">${profile.headline.map((l) => `<span>${esc(l)}</span>`).join('')}</h1>
      <p class="lede">${esc(profile.intro)}</p>
      <div class="actions">
        <button class="btn" data-goto="${esc(projects[0].slug)}">See the work</button>
        <button class="btn ghost" data-goto="comms">Hire me</button>
      </div>
    </section>`;

  const log = `
    <section class="panel right" data-beat="about"><div class="glass">
      <h2 class="display">${esc(about.title)}</h2>
      ${about.body.map((t) => `<p>${esc(t)}</p>`).join('')}
    </div></section>`;

  const cards = projects
    .map((p, i) => {
      const side = i % 2 ? 'right' : 'left';
      return `
      <section class="panel ${side}" data-beat="${esc(p.slug)}" style="--accent:${esc(p.accent)}"><div class="glass">
        <span class="panel-index">Planet ${String(i + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}</span>
        <p class="kicker">${projectMeta(p)}</p>
        <h2 class="display">${esc(p.title)}</h2>
        <p>${esc(p.summary)}</p>
        ${metricList(p.metrics)}
        <div><a class="btn" href="#/project/${esc(p.slug)}">Land on planet →</a></div>
      </div></section>`;
    })
    .join('');

  const reactor = `
    <section class="panel right" data-beat="lab"><div class="glass">
      <h2 class="display">${esc(lab.title)}</h2>
      <p>${esc(lab.intro)}</p>
      ${skillGroups()}
    </div></section>`;

  const contact = `
    <section class="panel comms" data-beat="comms" data-center>
      <h2 class="display">${comms.title.map((l) => `<span>${esc(l)}</span>`).join('')}</h2>
      <p>${esc(comms.body)}</p>
      <div class="actions">
        ${mail(profile.email)}
        <button class="btn ghost" data-copy>Copy email</button>
      </div>
      <div class="links">${linkList(profile.links)}</div>
    </section>`;

  return hero + log + cards + reactor + contact;
}

export function createUI({ beats, total }) {
  const stops = beats.filter((b) => b.hold);
  const root = document.body;

  const shell = document.createElement('div');
  shell.innerHTML = `
    <canvas id="gl" aria-hidden="true"></canvas>
    <div id="spacer" style="height:${((total + 1) * 100).toFixed(2)}lvh"></div>
    <header id="hud">
      <button class="brand" data-goto="hero" aria-label="${esc(profile.name)}, back to start">${logoMark}<span>${esc(profile.name)}</span></button>
      <div class="hud-actions">
        <span class="status">${esc(profile.availability)}</span>
        <a class="link" href="#/flat" data-reload>Skip the flight</a>
        <button class="btn" data-goto="comms">Hire me</button>
      </div>
    </header>
    <nav id="rail" aria-label="Sections">
      ${stops.map((b) => `<button data-goto="${esc(b.id)}"><span>${esc(b.nav)}</span></button>`).join('')}
    </nav>
    <div id="panels">${panelMarkup()}</div>
    <aside id="case" role="dialog" aria-modal="true" aria-labelledby="case-title">
      <button class="btn ghost" id="case-close">← Back to orbit</button>
      <div id="case-body"></div>
    </aside>
    <div id="hint">Scroll to fly</div>
    <div id="progress"></div>
    <div id="boot" role="status">${logoMark}<span id="boot-line">Powering up</span></div>`;
  root.append(...shell.children);

  const $ = (id) => document.getElementById(id);
  const caseEl = $('case');
  const hint = $('hint');
  const progress = $('progress');
  const railButtons = [...$('rail').children];
  const beatById = new Map(beats.map((b) => [b.id, b]));
  let returnFocus = null;

  const panels = [...document.querySelectorAll('.panel')].map((el) => ({
    el,
    beat: beatById.get(el.dataset.beat),
    center: 'center' in el.dataset,
    dir: el.classList.contains('left') ? -1 : 1,
    last: '',
  }));

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const scrollX = () => (window.scrollY / Math.max(maxScroll(), 1)) * total;

  function goto(id, behavior = 'smooth') {
    const beat = beatById.get(id);
    if (!beat) return;
    const x = beat === stops[0] ? 0 : beat === stops[stops.length - 1] ? total : (beat.a + beat.b) / 2;
    window.scrollTo({ top: (x / total) * maxScroll(), behavior });
  }

  document.addEventListener('click', (event) => {
    const go = event.target.closest('[data-goto]');
    if (go) goto(go.dataset.goto);
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      navigator.clipboard?.writeText(profile.email).then(() => {
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy email'), 1600);
      });
    }
  });

  $('case-close').addEventListener('click', () => (location.hash = '#/'));

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && caseEl.classList.contains('open')) location.hash = '#/';
    if (caseEl.classList.contains('open') || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
    const x = scrollX();
    const target =
      event.key === 'ArrowRight'
        ? stops.find((b) => b.a > x + 0.05)
        : [...stops].reverse().find((b) => b.b < x - 0.05);
    if (target) goto(target.id);
  });

  function update(x, focus, tiltX, tiltY) {
    let active = stops[0];
    for (const stop of stops) if (x >= stop.a - 0.3) active = stop;

    railButtons.forEach((button) => button.classList.toggle('on', button.dataset.goto === active.id));
    progress.style.transform = `scaleX(${(x / total).toFixed(4)})`;
    hint.style.opacity = x < 0.1 ? 1 : 0;

    for (const panel of panels) {
      const { a, b } = panel.beat;
      const f = x < a ? (x - a) / FADE : x > b ? (x - b) / FADE : 0;
      const amount = Math.min(Math.abs(f), 1);
      const visible = amount < 1 && focus < 0.02;
      if (!visible) {
        if (panel.last !== 'off') {
          panel.el.classList.remove('live');
          panel.el.style.opacity = 0;
          panel.last = 'off';
        }
        continue;
      }
      // Incoming cards rise from deep space; outgoing ones sweep past the camera.
      const z = f < 0 ? -620 * amount : 240 * amount;
      const spin = panel.center ? 0 : panel.dir * f * 24;
      const centre = panel.center ? 'translate(-50%, 0)' : '';
      const value = `perspective(1100px) ${centre} translateY(-50%) translateZ(${z.toFixed(1)}px) rotateY(${(spin + tiltX).toFixed(2)}deg) rotateX(${tiltY.toFixed(2)}deg)`;
      const key = value + amount.toFixed(3);
      if (key === panel.last) continue;
      panel.last = key;
      panel.el.classList.add('live');
      panel.el.style.opacity = (1 - amount * amount).toFixed(3);
      panel.el.style.transform = value;
    }
  }

  return {
    update,
    goto,
    scrollX,
    setBoot: (text) => ($('boot-line').textContent = text),
    finishBoot: () => $('boot').classList.add('done'),
    openCase(project) {
      const i = projects.indexOf(project);
      $('case-body').innerHTML = caseHTML(project, projects[(i + 1) % projects.length]);
      caseEl.style.setProperty('--accent', project.accent);
      caseEl.scrollTop = 0;
      caseEl.classList.add('open');
      returnFocus ??= document.activeElement;
      $('case-close').focus({ preventScroll: true });
      document.documentElement.style.overflow = 'hidden';
    },
    closeCase() {
      caseEl.classList.remove('open');
      document.documentElement.style.overflow = '';
      returnFocus?.focus?.({ preventScroll: true });
      returnFocus = null;
    },
  };
}
