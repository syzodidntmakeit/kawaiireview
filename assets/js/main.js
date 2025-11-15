const backToTop = document.getElementById('back-to-top');

if (backToTop) {
  window.addEventListener('scroll', () => {
    backToTop.style.display = window.scrollY > 320 ? 'block' : 'none';
  });
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

const CAROUSELS = [
  {
    type: 'anime',
    file: 'data/anime.json',
    stripId: 'anime-strip',
    metaKey: 'studio',
    coverShape: 'portrait',
  },
  {
    type: 'album',
    file: 'data/albums.json',
    stripId: 'album-strip',
    metaKey: 'artist',
    coverShape: 'square',
  },
];

function createPlaceholderText(text) {
  if (!text) return 'Soon';
  return text.length > 10 ? `${text.slice(0, 9)}…` : text;
}

function createCard({ type, entry, coverShape }) {
  const card = document.createElement('article');
  card.className = 'card';
  const wrapper = entry.link ? document.createElement('a') : document.createElement('div');
  if (entry.link) {
    wrapper.href = entry.link;
  }
  wrapper.className = entry.cover
    ? `cover cover-${coverShape}`
    : `cover cover-${coverShape} placeholder`;

  if (entry.cover) {
    const img = document.createElement('img');
    img.src = entry.cover;
    img.alt = `${entry.title} cover art`;
    img.className = 'cover-media';
    wrapper.appendChild(img);
  } else {
    const span = document.createElement('span');
    span.textContent = createPlaceholderText(entry.title);
    wrapper.appendChild(span);
  }

  const titleLine = document.createElement('div');
  titleLine.className = 'title-line';
  const title = document.createElement('h3');
  title.textContent = entry.title || 'Untitled';
  titleLine.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = (type === 'anime' ? entry.studio : entry.artist) || 'Unknown';

  card.appendChild(wrapper);
  card.appendChild(titleLine);
  card.appendChild(meta);
  return card;
}

async function loadData(config) {
  try {
    const response = await fetch(config.file);
    if (!response.ok) throw new Error('Failed to load data');
    return await response.json();
  } catch (error) {
    const inline = document.getElementById(`${config.type}-data-inline`);
    if (inline?.textContent.trim()) {
      try {
        return JSON.parse(inline.textContent);
      } catch {
        // ignore parse error
      }
    }
    throw error;
  }
}

async function populateCarousel(config) {
  const strip = document.getElementById(config.stripId);
  if (!strip) return;
  try {
    const entries = await loadData(config);
    entries
      .filter((entry) => entry.cover && entry.link)
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .slice(0, 20) // newest first
      .forEach((entry) => {
        const card = createCard({ type: config.type, entry, coverShape: config.coverShape });
        strip.appendChild(card);
      });
  } catch (error) {
    const errorMessage = document.createElement('p');
    errorMessage.className = 'meta';
    errorMessage.textContent = 'Failed to load entries.';
    strip.appendChild(errorMessage);
  }
}

function initCarouselControls() {
  document.querySelectorAll('.scroll-arrow').forEach((button) => {
    const targetId = button.dataset.target;
    const direction = button.dataset.dir;
    const strip = document.getElementById(targetId);
    if (!strip) return;

    button.addEventListener('click', () => {
      const card = strip.querySelector('.card');
      const cardWidth = card ? card.getBoundingClientRect().width : 240;
      const gap = 14;
      const delta = direction === 'right' ? cardWidth + gap : -(cardWidth + gap);
      strip.scrollBy({ left: delta, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.scroll-wrap').forEach((wrap) => {
    const leftArrow = wrap.querySelector('.scroll-arrow.left');
    const rightArrow = wrap.querySelector('.scroll-arrow.right');
    if (!leftArrow || !rightArrow) return;

    const toggle = (arrow, show) => {
      arrow.style.opacity = show ? '1' : '0';
      arrow.style.pointerEvents = show ? 'auto' : 'none';
    };

    wrap.addEventListener('mousemove', (event) => {
      const rect = wrap.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      toggle(leftArrow, ratio <= 0.2);
      toggle(rightArrow, ratio >= 0.8);
    });

    wrap.addEventListener('mouseleave', () => {
      toggle(leftArrow, false);
      toggle(rightArrow, false);
    });
  });
}

CAROUSELS.forEach(populateCarousel);
initCarouselControls();
