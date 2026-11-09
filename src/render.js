// Pure string templates, shared by the browser and the Vite build.
import { profile, about, projects, lab, comms } from './content.js';
import { logoMark } from './logo.js';

export const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// Web links and the résumé PDF open in a new tab, so the visitor keeps their place.
const external = (href) =>
  /^http|\.pdf$/.test(href) ? ' target="_blank" rel="noopener"' : '';

export const linkList = (links) =>
  links
    .filter((l) => l.href)
    .map((l) => `<a class="link" href="${esc(l.href)}"${external(l.href)}>${esc(l.label)}</a>`)
    .join('');

export const metricList = (metrics = []) =>
  metrics.length
    ? `<dl class="metrics">${metrics
        .map((m) => `<div><dd>${esc(m.value)}</dd><dt>${esc(m.label)}</dt></div>`)
        .join('')}</dl>`
    : '';

export const projectMeta = (p) => [p.kicker, p.year].filter(Boolean).map(esc).join(' · ');

const projectLinks = (p) =>
  linkList([
    { label: 'Visit live site', href: p.live },
    { label: 'Source code', href: p.repo },
  ]);

const story = (tag, title, text) => (text ? `<${tag}>${esc(title)}</${tag}><p>${esc(text)}</p>` : '');

export const skillGroups = () =>
  lab.groups
    .map(
      (g) =>
        `<div class="skills"><h3>${esc(g.label)}</h3><p>${g.items.map(esc).join(' · ')}</p></div>`,
    )
    .join('');

export function caseHTML(p, next) {
  const nextLink =
    next === p
      ? ''
      : `<a class="next" href="#/project/${esc(next.slug)}">
      <span>Next planet</span><strong class="display">${esc(next.title)} →</strong>
    </a>`;

  return `
    <p class="kicker">${projectMeta(p)}</p>
    <h2 class="display" id="case-title">${esc(p.title)}</h2>
    <p class="lede">${esc(p.summary)}</p>
    ${metricList(p.metrics)}
    <dl class="specs">
      <div><dt>Role</dt><dd>${esc(p.role)}</dd></div>
      ${p.duration ? `<div><dt>Duration</dt><dd>${esc(p.duration)}</dd></div>` : ''}
      <div><dt>Stack</dt><dd>${p.stack.map(esc).join(', ')}</dd></div>
    </dl>
    ${story('h3', 'The problem', p.problem)}
    ${story('h3', 'The approach', p.approach)}
    <div class="links">${projectLinks(p)}</div>
    ${nextLink}`;
}

export function flatHTML() {
  const work = projects
    .map(
      (p) => `
      <article style="--accent:${esc(p.accent)}">
        <p class="kicker">${projectMeta(p)}</p>
        <h3 class="display">${esc(p.title)}</h3>
        <p class="lede">${esc(p.summary)}</p>
        ${metricList(p.metrics)}
        <p><strong>${esc(p.role)}</strong>${p.duration ? ` · ${esc(p.duration)}` : ''} · ${p.stack.map(esc).join(', ')}</p>
        ${story('h4', 'The problem', p.problem)}
        ${story('h4', 'The approach', p.approach)}
        <div class="links">${projectLinks(p)}</div>
      </article>`,
    )
    .join('');

  return `
    <header>
      ${logoMark}
      <p class="kicker">${esc(profile.role)} · ${esc(profile.location)}</p>
      <h1 class="display">${esc(profile.name)}</h1>
      <p class="lede">${esc(profile.intro)}</p>
      <div class="links">
        <a class="btn" href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>
        ${linkList(profile.links)}
        <a class="link" href="#/fly" data-reload>Launch the 3D flight</a>
      </div>
    </header>
    <section>
      <h2 class="display">${esc(about.title)}</h2>
      ${about.body.map((t) => `<p>${esc(t)}</p>`).join('')}
    </section>
    <section><h2 class="display">Work</h2>${work}</section>
    <section><h2 class="display">Skills</h2>${skillGroups()}</section>
    <section>
      <h2 class="display">${comms.title.map(esc).join(' ')}</h2>
      <p>${esc(comms.body)}</p>
      <a class="btn" href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>
    </section>`;
}
