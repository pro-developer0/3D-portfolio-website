// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE. Every word on the site comes from here.
//  Add or remove entries in `projects` and the flight path,
//  planets and navigation rebuild themselves.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: 'Muhammad Haziq',
  role: 'Creative Developer',
  headline: ['WEBSITES', 'WORTH THE', 'TRIP'],
  intro: 'Creative developer turning bold ideas into interactive experiences.',
  availability: 'Working on animated websites and AI',
  location: 'Available remotely 24/7',
  email: '01muhammadhaziq@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/pro-developer0' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/muhammad-haziq-3351a0436/' },
    { label: 'Instagram', href: 'https://www.instagram.com/meer_haziq.01/' },
    { label: 'Résumé', href: 'resume.pdf' },
  ],
};

export const about = {
  title: 'PILOT LOG',
  body: [
    'Hi, I’m Muhammad Haziq, a creative developer who builds clean, modern websites and interactive experiences. I love turning ideas into designs that look good and work smoothly. Let’s build something great together.',
    'Clients get more than code. They get a creative partner who listens, explains things simply, and delivers polished work on time. Your idea, built the right way.',
  ],
};

// Required: slug, title, kicker, summary, role, stack, accent, planet.
// Optional (leave out to hide): year, duration, problem, approach, metrics, live, repo.
// Optional nav: a shorter name for the side navigation, for long titles.
// planet.type: 'ocean' | 'ember' | 'gas' | 'crystal'
// planet.colors: [surface, secondary, highlight]
// accent: the colour of that project's card and buttons
export const projects = [
  {
    slug: 'smart-parking-system',
    title: 'Smart Parking System',
    kicker: 'University project · App',
    summary:
      'A smart system for monitoring parking spaces, managing vehicle parking and improving parking efficiency.',
    role: 'Developer',
    duration: '4 months',
    stack: ['Flutter', 'Android Studio', 'Firebase'],
    repo: 'https://github.com/pro-developer0/smart_parking_system',
    accent: '#7fe7ff',
    planet: { type: 'ocean', radius: 28, colors: ['#0b3a6e', '#3f8f5f', '#d6c28e'] },
  },
  {
    slug: 'diagnosis-guide-rag-system',
    title: 'Diagnosis Guide RAG System',
    nav: 'Diagnosis Guide',
    kicker: 'Personal project · AI web app',
    summary:
      'A diagnostic reference for healthcare staff. Ask in plain language and get a short answer drawn only from 20 built-in disease files, with a link to the exact section it came from.',
    role: 'Developer',
    stack: ['Next.js', 'TypeScript', 'RAG', 'In-browser embeddings'],
    approach:
      'Matching passages are found in the browser using a prebuilt search index, and the AI service writes its answer only from those passages. Users can open the exact text that was sent to the AI under any answer.',
    live: 'https://diagnosis-guide-rag-system.vercel.app',
    repo: 'https://github.com/pro-developer0/diagnosis-guide-rag-system',
    accent: '#a9b8ff',
    planet: { type: 'crystal', radius: 25, colors: ['#1a2452', '#8fb2e8', '#7ffff0'] },
  },
  {
    slug: 'space-station-portfolio',
    title: 'Space Station Portfolio',
    nav: 'This Portfolio',
    kicker: 'Personal project · 3D website',
    summary:
      'The site you are flying through: a scroll-driven 3D space station where every project is a planet you can land on.',
    role: 'Developer',
    stack: ['Three.js', 'WebGL', 'GLSL', 'JavaScript', 'Vite'],
    approach:
      'The station, planets, portals and nebula are all generated in code with custom shaders, with no 3D model files. The same content is also built in as a plain page for recruiters, search engines and devices that cannot run 3D.',
    repo: 'https://github.com/pro-developer0/3D-portfolio-website',
    accent: '#ff8a4c',
    planet: { type: 'ember', radius: 24, colors: ['#17090a', '#ff3d12', '#ffc34d'] },
  },
];

export const lab = {
  title: 'THE REACTOR',
  intro: 'What powers the station. Move your cursor to disturb the core.',
  groups: [
    { label: 'Build', items: ['Web development', 'Flutter app development'] },
    { label: 'Motion + 3D', items: ['Animations'] },
    { label: 'Design', items: ['Different ideas get different designs.'] },
  ],
};

export const comms = {
  title: ['OPEN A', 'CHANNEL'],
  body: 'Have a project, or a seat on your team? Tell me what you need and I will reply within a day.',
};
