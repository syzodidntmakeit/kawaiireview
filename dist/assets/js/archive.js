const grids = document.querySelectorAll('.archive-grid');

async function loadEntries(source, inlineId) {
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error('Network error');
    return await response.json();
  } catch {
    if (inlineId) {
      const inline = document.getElementById(inlineId);
      if (inline?.textContent.trim()) {
        try {
          return JSON.parse(inline.textContent);
        } catch {
          // fallthrough
        }
      }
    }
    throw new Error(`Failed to load ${source}`);
  }
}

function createGridCard({ entry, kind }) {
  const card = document.createElement('article');
  card.className = 'card';

  const wrapper = entry.link ? document.createElement('a') : document.createElement('div');
  if (entry.link) wrapper.href = `../${entry.link}`;
  wrapper.className = entry.cover
    ? `cover cover-${kind === 'anime' ? 'portrait' : 'square'}`
    : `cover cover-${kind === 'anime' ? 'portrait' : 'square'} placeholder`;

  if (entry.cover) {
    const img = document.createElement('img');
    img.src = `../${entry.cover}`;
    img.alt = `${entry.title} cover art`;
    img.className = 'cover-media';
    wrapper.appendChild(img);
  } else {
    const span = document.createElement('span');
    span.textContent = entry.title.slice(0, 8);
    wrapper.appendChild(span);
  }

  const titleLine = document.createElement('div');
  titleLine.className = 'title-line';
  const title = document.createElement('h3');
  title.textContent = entry.title || 'Untitled';
  titleLine.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = kind === 'anime' ? entry.studio || 'Unknown' : entry.artist || 'Unknown';

  card.appendChild(wrapper);
  card.appendChild(titleLine);
  card.appendChild(meta);
  return card;
}

async function populateGrid(grid) {
  const { archive: kind, source, inline } = grid.dataset;
  if (!kind || !source) return;
  try {
    const entries = await loadEntries(source, inline);
    entries
      .filter((entry) => entry.cover && entry.link)
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .forEach((entry) => {
        grid.appendChild(createGridCard({ entry, kind }));
      });
  } catch (error) {
    const msg = document.createElement('p');
    msg.className = 'meta';
    msg.textContent = 'Failed to load entries.';
    grid.appendChild(msg);
  }
}

grids.forEach(populateGrid);
