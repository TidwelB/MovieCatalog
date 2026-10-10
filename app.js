(() => {
  'use strict';

  const DB_NAME = 'myMovieRoomDB';
  const DB_VERSION = 1;
  const MOVIES = 'movies';
  const CASES = 'cases';
  const SETTINGS = 'settings';
  const TMDB_API = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';

  let db;
  let movies = [];
  let cases = [];
  let editingMovieId = null;
  let editingCaseId = null;
  let roomEditMode = true;
  let searchDebounceTimer = null;
  let searchSuggestionSerial = 0;

  const $ = (id) => document.getElementById(id);
  const qsa = (selector) => [...document.querySelectorAll(selector)];
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(MOVIES)) database.createObjectStore(MOVIES, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(CASES)) database.createObjectStore(CASES, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(SETTINGS)) database.createObjectStore(SETTINGS, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(storeName, mode = 'readonly') {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGet(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(storeName, value) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  function idbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function idbClear(storeName) {
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function getSetting(key, fallback = '') {
    const row = await idbGet(SETTINGS, key);
    return row?.value ?? fallback;
  }

  async function setSetting(key, value) {
    return idbPut(SETTINGS, { key, value });
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function posterUrl(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return `${TMDB_IMAGE}${path}`;
  }
  function yearOf(movie) { return (movie.releaseDate || '').slice(0, 4) || '—'; }
  function caseById(id) { return cases.find(c => c.id === id); }
  function movieLocation(movie) {
    const c = caseById(movie.caseId);
    if (!c) return 'Unassigned';
    const bits = [c.name];
    if (movie.shelf) bits.push(`Shelf ${movie.shelf}`);
    if (movie.position) bits.push(`Pos ${movie.position}`);
    return bits.join(' · ');
  }
  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function setView(name) {
    qsa('.view').forEach(v => v.classList.toggle('active-view', v.id === `view-${name}`));
    qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    if (name === 'catalog') renderCatalog();
    if (name === 'room') renderRoom();
    if (name === 'storage') renderCases();
  }

  function movieCard(movie, searchMode = false) {
    const owned = movies.some(m => m.tmdbId === movie.tmdbId);
    const poster = posterUrl(movie.posterPath);
    return `
      <article class="movie-card" data-id="${escapeHtml(movie.id || '')}" data-tmdb-id="${movie.tmdbId || ''}">
        ${owned && searchMode ? '<span class="owned-badge">Owned</span>' : ''}
        <div class="poster-wrap">${poster ? `<img src="${poster}" loading="lazy" alt="Poster for ${escapeHtml(movie.title)}">` : `<div class="poster-placeholder">${escapeHtml(movie.title)}</div>`}</div>
        <div class="movie-card-body">
          <h3 title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</h3>
          <div class="movie-meta">${escapeHtml(yearOf(movie))}${movie.runtime ? ` · ${movie.runtime} min` : ''}</div>
          ${!searchMode ? `<span class="location-pill" title="${escapeHtml(movieLocation(movie))}">${escapeHtml(movieLocation(movie))}</span>` : ''}
          <div class="card-actions">
            ${searchMode ? `<button class="${owned ? 'secondary' : 'primary'} search-add" ${owned ? 'disabled' : ''}>${owned ? 'Already owned' : 'Add to catalog'}</button>` : '<button class="secondary catalog-edit">Edit / locate</button>'}
          </div>
        </div>
      </article>`;
  }

  function populateFilters() {
    const caseFilter = $('catalogCaseFilter');
    const currentCase = caseFilter.value;
    caseFilter.innerHTML = '<option value="">All cases</option><option value="__unassigned">Unassigned</option>' + cases.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    caseFilter.value = [...caseFilter.options].some(o => o.value === currentCase) ? currentCase : '';

    const formats = [...new Set(movies.map(m => m.format).filter(Boolean))].sort();
    const formatFilter = $('catalogFormatFilter');
    const currentFormat = formatFilter.value;
    formatFilter.innerHTML = '<option value="">All formats</option>' + formats.map(f => `<option>${escapeHtml(f)}</option>`).join('');
    formatFilter.value = formats.includes(currentFormat) ? currentFormat : '';
  }

  function renderCatalog() {
    populateFilters();
    const term = $('catalogSearch').value.trim().toLowerCase();
    const caseFilter = $('catalogCaseFilter').value;
    const formatFilter = $('catalogFormatFilter').value;
    const sort = $('catalogSort').value;

    let filtered = movies.filter(m => {
      const hay = `${m.title} ${yearOf(m)} ${m.notes || ''} ${m.edition || ''}`.toLowerCase();
      const caseMatch = !caseFilter || (caseFilter === '__unassigned' ? !m.caseId : m.caseId === caseFilter);
      return hay.includes(term) && caseMatch && (!formatFilter || m.format === formatFilter);
    });

    filtered.sort((a,b) => {
      if (sort === 'year-desc') return yearOf(b).localeCompare(yearOf(a)) || a.title.localeCompare(b.title);
      if (sort === 'added-desc') return (b.addedAt || '').localeCompare(a.addedAt || '');
      if (sort === 'location') return movieLocation(a).localeCompare(movieLocation(b)) || String(a.position || '').localeCompare(String(b.position || ''), undefined, {numeric:true});
      return a.title.localeCompare(b.title);
    });

    $('catalogSummary').textContent = `${movies.length} owned title${movies.length === 1 ? '' : 's'} · ${movies.filter(m => !m.caseId).length} unassigned`;
    $('catalogGrid').innerHTML = filtered.map(m => movieCard(m)).join('');
    $('catalogEmpty').classList.toggle('hidden', movies.length !== 0);
    $('catalogGrid').classList.toggle('hidden', movies.length === 0);

    qsa('.catalog-edit').forEach(btn => btn.addEventListener('click', e => openMovieEditor(e.target.closest('.movie-card').dataset.id)));
  }

  async function tmdbFetch(path) {
    const token = (await getSetting('tmdbToken', '')).trim();
    if (!token) throw new Error('Add your TMDB API Read Access Token in Settings first.');
    const res = await fetch(`${TMDB_API}${path}`, { headers: { 'Authorization': `Bearer ${token}`, 'accept': 'application/json' } });
    if (!res.ok) {
      if (res.status === 401) throw new Error('TMDB rejected the token. Check the token in Settings.');
      throw new Error(`TMDB request failed (${res.status}).`);
    }
    return res.json();
  }

  function mapTmdbMovies(data, limit = 20) {
    return (data.results || []).slice(0, limit).map(r => ({
      tmdbId: r.id,
      title: r.title,
      releaseDate: r.release_date || '',
      posterPath: r.poster_path || '',
      overview: r.overview || '',
      rating: r.vote_average || null
    }));
  }

  function hideSearchSuggestions() {
    $('movieSearchSuggestions').classList.add('hidden');
    $('movieSearchSuggestions').innerHTML = '';
    $('movieSearchInput').setAttribute('aria-expanded', 'false');
  }

  function clearMovieSearch({ focus = false } = {}) {
    clearTimeout(searchDebounceTimer);
    searchSuggestionSerial += 1;
    $('movieSearchInput').value = '';
    $('searchResults').innerHTML = '';
    $('searchStatus').textContent = 'TMDB search is optional. Manual entry works without a token or internet connection.';
    $('searchClearBtn').classList.add('hidden');
    hideSearchSuggestions();
    if (focus) $('movieSearchInput').focus();
  }

  function renderSearchSuggestions(results) {
    const box = $('movieSearchSuggestions');
    if (!results.length) {
      box.innerHTML = '<div class="suggestion-empty">No matching titles</div>';
    } else {
      box.innerHTML = results.map(r => {
        const poster = posterUrl(r.posterPath);
        return `<button type="button" class="search-suggestion" role="option" data-tmdb-id="${r.tmdbId}">
          <span class="suggestion-poster">${poster ? `<img src="${poster}" alt="" loading="lazy">` : '<span>🎬</span>'}</span>
          <span class="suggestion-copy"><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(yearOf(r))}${r.overview ? ` · ${escapeHtml(r.overview.slice(0, 88))}${r.overview.length > 88 ? '…' : ''}` : ''}</span></span>
        </button>`;
      }).join('');
    }
    box.classList.remove('hidden');
    $('movieSearchInput').setAttribute('aria-expanded', 'true');
    qsa('.search-suggestion').forEach(btn => btn.addEventListener('click', () => {
      const selected = results.find(r => r.tmdbId === Number(btn.dataset.tmdbId));
      if (!selected) return;
      $('movieSearchInput').value = selected.title;
      $('searchClearBtn').classList.remove('hidden');
      hideSearchSuggestions();
      searchMovies(selected.title);
    }));
  }

  async function loadSearchSuggestions(query) {
    const serial = ++searchSuggestionSerial;
    try {
      const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`);
      if (serial !== searchSuggestionSerial || $('movieSearchInput').value.trim() !== query) return;
      renderSearchSuggestions(mapTmdbMovies(data, 7));
      $('searchStatus').textContent = 'Choose a suggestion or press Search TMDB for full results.';
    } catch (err) {
      if (serial !== searchSuggestionSerial) return;
      hideSearchSuggestions();
      $('searchStatus').textContent = err.message;
    }
  }

  function handleMovieSearchInput() {
    const query = $('movieSearchInput').value.trim();
    $('searchClearBtn').classList.toggle('hidden', !$('movieSearchInput').value);
    $('searchResults').innerHTML = '';
    hideSearchSuggestions();
    clearTimeout(searchDebounceTimer);
    searchSuggestionSerial += 1;

    if (!query) {
      $('searchStatus').textContent = 'TMDB search is optional. Manual entry works without a token or internet connection.';
      return;
    }
    if (query.length < 2) {
      $('searchStatus').textContent = 'Type at least 2 characters for suggestions.';
      return;
    }

    $('searchStatus').textContent = 'Finding suggestions…';
    searchDebounceTimer = setTimeout(() => loadSearchSuggestions(query), 350);
  }

  async function searchMovies(query) {
    clearTimeout(searchDebounceTimer);
    searchSuggestionSerial += 1;
    hideSearchSuggestions();
    $('searchStatus').textContent = 'Searching…';
    $('searchResults').innerHTML = '';
    try {
      const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`);
      const results = mapTmdbMovies(data, 20);
      $('searchStatus').textContent = results.length ? `${results.length} results` : 'No matches found.';
      $('searchResults').innerHTML = results.map(r => movieCard(r, true)).join('');
      qsa('.search-add').forEach(btn => btn.addEventListener('click', async e => {
        const card = e.target.closest('.movie-card');
        const tmdbId = Number(card.dataset.tmdbId);
        const selected = results.find(r => r.tmdbId === tmdbId);
        await addFromSearch(selected);
      }));
    } catch (err) {
      $('searchStatus').textContent = err.message;
    }
  }

  function fillManualShelfSelect(caseId, selected = '') {
    const select = $('manualShelf');
    const c = caseById(caseId);
    select.innerHTML = '<option value="">No shelf</option>' + (c ? Array.from({length:c.shelfCount},(_,i) => `<option value="${i+1}">Shelf ${i+1}</option>`).join('') : '');
    select.value = selected ? String(selected) : '';
  }

  function openManualMovieDialog() {
    $('manualMovieForm').reset();
    $('manualFormat').value = 'Blu-ray';
    fillCaseSelect($('manualCase'), '');
    fillManualShelfSelect('', '');
    $('manualMovieDialog').showModal();
    setTimeout(() => $('manualTitle').focus(), 0);
  }

  function closeManualMovieDialog() {
    if ($('manualMovieDialog').open) $('manualMovieDialog').close('cancel');
    $('manualMovieForm').reset();
  }

  async function saveManualMovie() {
    const title = $('manualTitle').value.trim();
    if (!title) return;
    const runtimeRaw = $('manualRuntime').value.trim();
    const movie = {
      id: uuid(),
      tmdbId: null,
      manual: true,
      title,
      releaseDate: $('manualReleaseDate').value.trim(),
      posterPath: $('manualPosterUrl').value.trim(),
      overview: $('manualOverview').value.trim(),
      runtime: runtimeRaw ? Number(runtimeRaw) : null,
      genres: $('manualGenres').value.split(',').map(g => g.trim()).filter(Boolean),
      format: $('manualFormat').value,
      edition: $('manualEdition').value.trim(),
      caseId: $('manualCase').value,
      shelf: $('manualShelf').value,
      position: $('manualPosition').value.trim(),
      notes: $('manualNotes').value.trim(),
      addedAt: new Date().toISOString()
    };
    await idbPut(MOVIES, movie);
    movies.push(movie);
    toast(`Added “${movie.title}” manually`);
    renderCatalog(); renderCases(); renderRoom();
  }

  async function addFromSearch(base) {
    if (movies.some(m => m.tmdbId === base.tmdbId)) return;
    try {
      let details = {};
      try { details = await tmdbFetch(`/movie/${base.tmdbId}?language=en-US`); } catch (_) { /* base data is enough */ }
      const movie = {
        id: uuid(),
        tmdbId: base.tmdbId,
        title: details.title || base.title,
        releaseDate: details.release_date || base.releaseDate || '',
        posterPath: details.poster_path || base.posterPath || '',
        overview: details.overview || base.overview || '',
        runtime: details.runtime || null,
        genres: (details.genres || []).map(g => g.name),
        format: 'Blu-ray',
        edition: '', caseId: '', shelf: '', position: '', notes: '',
        addedAt: new Date().toISOString()
      };
      await idbPut(MOVIES, movie);
      movies.push(movie);
      toast(`Added “${movie.title}”`);
      await openMovieEditor(movie.id);
      const q = $('movieSearchInput').value.trim();
      if (q) searchMovies(q);
    } catch (err) { toast(err.message); }
  }

  function fillCaseSelect(select, selected = '') {
    select.innerHTML = '<option value="">Unassigned</option>' + cases.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    select.value = selected || '';
  }

  function fillShelfSelect(caseId, selected = '') {
    const select = $('editShelf');
    const c = caseById(caseId);
    select.innerHTML = '<option value="">No shelf</option>' + (c ? Array.from({length:c.shelfCount},(_,i) => `<option value="${i+1}">Shelf ${i+1}</option>`).join('') : '');
    select.value = selected ? String(selected) : '';
  }

  async function openMovieEditor(id) {
    const m = movies.find(x => x.id === id);
    if (!m) return;
    editingMovieId = id;
    $('editTitle').textContent = m.title;
    $('editMeta').textContent = `${yearOf(m)}${m.genres?.length ? ` · ${m.genres.join(', ')}` : ''}${m.runtime ? ` · ${m.runtime} min` : ''}`;
    const poster = posterUrl(m.posterPath);
    $('editPoster').src = poster;
    $('editPoster').alt = poster ? `Poster for ${m.title}` : '';
    $('editPoster').classList.toggle('hidden', !poster);
    $('editFormat').value = m.format || 'Blu-ray';
    $('editEdition').value = m.edition || '';
    fillCaseSelect($('editCase'), m.caseId || '');
    fillShelfSelect(m.caseId, m.shelf || '');
    $('editPosition').value = m.position || '';
    $('editNotes').value = m.notes || '';
    $('movieDialog').showModal();
  }

  async function saveMovieEditor() {
    const m = movies.find(x => x.id === editingMovieId);
    if (!m) return;
    m.format = $('editFormat').value;
    m.edition = $('editEdition').value.trim();
    m.caseId = $('editCase').value;
    m.shelf = $('editShelf').value;
    m.position = $('editPosition').value.trim();
    m.notes = $('editNotes').value.trim();
    await idbPut(MOVIES, m);
    toast('Movie updated');
    renderCatalog(); renderCases(); renderRoom();
  }

  async function deleteEditingMovie() {
    const m = movies.find(x => x.id === editingMovieId);
    if (!m || !confirm(`Delete “${m.title}” from your catalog?`)) return;
    await idbDelete(MOVIES, m.id);
    movies = movies.filter(x => x.id !== m.id);
    $('movieDialog').close();
    toast('Movie deleted');
    renderCatalog(); renderCases(); renderRoom();
  }

  function caseMovieCount(caseId) { return movies.filter(m => m.caseId === caseId).length; }
  function shelfMovies(caseId, shelf) {
    return movies.filter(m => m.caseId === caseId && String(m.shelf) === String(shelf))
      .sort((a,b) => String(a.position || '').localeCompare(String(b.position || ''), undefined, {numeric:true}) || a.title.localeCompare(b.title));
  }

  function movieShelfThumb(movie, compact = false) {
    const poster = posterUrl(movie.posterPath);
    const label = `${movie.position ? `Position ${movie.position}: ` : ''}${movie.title}`;
    return `<button type="button" class="shelf-poster-thumb${compact ? ' compact' : ''}" data-movie-id="${movie.id}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
      ${poster ? `<img src="${poster}" loading="lazy" alt="">` : `<span>${escapeHtml(movie.title.slice(0,1).toUpperCase() || '?')}</span>`}
    </button>`;
  }

  function renderShelfPosterStrip(sm, limit = 12, compact = false) {
    if (!sm.length) return '<span class="muted shelf-empty">Empty</span>';
    const visible = sm.slice(0, limit);
    const overflow = sm.length - visible.length;
    return `<div class="shelf-poster-strip${compact ? ' compact' : ''}">${visible.map(m => movieShelfThumb(m, compact)).join('')}${overflow > 0 ? `<span class="shelf-overflow" title="${overflow} more movie${overflow===1?'':'s'}">+${overflow}</span>` : ''}</div>`;
  }

  function wireShelfPosterClicks(root = document) {
    root.querySelectorAll('.shelf-poster-thumb').forEach(btn => btn.addEventListener('click', () => openMovieEditor(btn.dataset.movieId)));
  }

  function openVirtualShelf(caseId, shelf) {
    const c = caseById(caseId);
    if (!c) return;
    const sm = shelfMovies(caseId, shelf);
    $('shelfDialogTitle').textContent = `${c.name} · Shelf ${shelf}`;
    $('shelfDialogMeta').textContent = `${sm.length} movie${sm.length === 1 ? '' : 's'} · ordered by physical shelf position`;
    if (!sm.length) {
      $('virtualShelf').innerHTML = '<div class="virtual-shelf-empty">This shelf is currently empty.</div>';
    } else {
      $('virtualShelf').innerHTML = `<div class="virtual-shelf-track">${sm.map(movie => {
        const poster = posterUrl(movie.posterPath);
        const position = movie.position ? `Position ${escapeHtml(movie.position)}` : 'No position';
        return `<button type="button" class="virtual-movie" data-movie-id="${movie.id}" title="${escapeHtml(movie.title)}">
          <div class="virtual-movie-cover">${poster ? `<img src="${poster}" loading="lazy" alt="">` : `<span>${escapeHtml(movie.title.slice(0,1).toUpperCase() || '?')}</span>`}</div>
          <div class="virtual-movie-position">${position}</div>
          <div class="virtual-movie-title">${escapeHtml(movie.title)}</div>
        </button>`;
      }).join('')}</div>`;
      $('virtualShelf').querySelectorAll('.virtual-movie').forEach(btn => btn.addEventListener('click', () => {
        $('shelfDialog').close();
        openMovieEditor(btn.dataset.movieId);
      }));
    }
    $('shelfDialog').showModal();
  }

  function wireShelfViewButtons(root = document) {
    root.querySelectorAll('.shelf-view-btn').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      openVirtualShelf(btn.dataset.caseId, btn.dataset.shelf);
    }));
  }

  function roomCaseShelfPreview(caseId, shelf, limit = 4) {
    const sm = shelfMovies(caseId, shelf);
    const visible = sm.slice(0, limit);
    const overflow = sm.length - visible.length;
    return `<div class="room-case-shelf" title="Shelf ${shelf}: ${sm.length} movie${sm.length===1?'':'s'}">${visible.map(movie => {
      const poster = posterUrl(movie.posterPath);
      return poster ? `<img class="room-case-poster" src="${poster}" loading="lazy" alt="">` : `<span class="room-case-initial">${escapeHtml(movie.title.slice(0,1).toUpperCase() || '?')}</span>`;
    }).join('')}${overflow > 0 ? `<span class="room-case-more">+${overflow}</span>` : ''}</div>`;
  }

  function renderCases() {
    $('caseList').innerHTML = cases.map(c => {
      const shelfRows = Array.from({length:c.shelfCount}, (_,i) => {
        const sm = shelfMovies(c.id, i+1);
        return `<div class="shelf-row shelf-row-visual">
          <div class="shelf-row-label"><strong>Shelf ${i+1}</strong><span>${sm.length} movie${sm.length===1?'':'s'}</span><div class="shelf-row-label-actions"><button type="button" class="secondary shelf-view-btn" data-case-id="${c.id}" data-shelf="${i+1}">View shelf</button></div></div>
          ${renderShelfPosterStrip(sm, 12)}
        </div>`;
      }).join('');
      return `<article class="case-card" data-id="${c.id}">
        <div class="case-card-header"><div><h3>${escapeHtml(c.name)}</h3><p class="muted">${caseMovieCount(c.id)} movies · ${c.shelfCount} shelves</p></div><button class="secondary edit-case">Edit</button></div>
        <div class="shelf-table">${shelfRows}</div>
      </article>`;
    }).join('');
    $('caseEmpty').classList.toggle('hidden', cases.length !== 0);
    qsa('.edit-case').forEach(btn => btn.addEventListener('click', e => openCaseDialog(e.target.closest('.case-card').dataset.id)));
    wireShelfPosterClicks($('caseList'));
    wireShelfViewButtons($('caseList'));
  }

  function openCaseDialog(id = null) {
    editingCaseId = id;
    const c = id ? caseById(id) : null;
    $('caseDialogTitle').textContent = c ? 'Edit bookcase' : 'Add bookcase';
    $('caseName').value = c?.name || '';
    $('caseShelves').value = c?.shelfCount || 5;
    $('caseWidth').value = c?.width || 18;
    $('caseHeight').value = c?.height || 42;
    $('deleteCaseBtn').classList.toggle('hidden', !c);
    $('caseDialog').showModal();
  }

  async function saveCase() {
    const name = $('caseName').value.trim();
    if (!name) return;
    let c = editingCaseId ? caseById(editingCaseId) : null;
    if (!c) {
      const idx = cases.length;
      c = { id: uuid(), name, shelfCount: 5, x: 5 + (idx % 4) * 22, y: 7 + Math.floor(idx/4) * 48, width:18, height:42 };
      cases.push(c);
    }
    c.name = name;
    c.shelfCount = clamp(Number($('caseShelves').value) || 5, 1, 20);
    c.width = clamp(Number($('caseWidth').value) || 18, 6, 45);
    c.height = clamp(Number($('caseHeight').value) || 42, 8, 80);
    await idbPut(CASES, c);
    toast('Bookcase saved');
    renderCases(); renderRoom(); renderCatalog();
  }

  async function deleteEditingCase() {
    const c = caseById(editingCaseId);
    if (!c) return;
    const count = caseMovieCount(c.id);
    if (!confirm(`Delete “${c.name}”? ${count ? `${count} assigned movie(s) will become unassigned.` : ''}`)) return;
    for (const m of movies.filter(m => m.caseId === c.id)) {
      m.caseId = ''; m.shelf = ''; m.position = '';
      await idbPut(MOVIES, m);
    }
    await idbDelete(CASES, c.id);
    cases = cases.filter(x => x.id !== c.id);
    $('caseDialog').close();
    toast('Bookcase deleted');
    renderCases(); renderRoom(); renderCatalog();
  }

  function renderRoom(selectedId = null) {
    const map = $('roomMap');
    map.innerHTML = '';
    cases.forEach(c => {
      const el = document.createElement('div');
      el.className = `bookcase${roomEditMode ? ' editable' : ''}${c.id === selectedId ? ' selected' : ''}`;
      el.dataset.id = c.id;
      el.style.left = `${c.x}%`;
      el.style.top = `${c.y}%`;
      el.style.width = `${c.width}%`;
      el.style.height = `${c.height}%`;
      el.innerHTML = `<div class="bookcase-label">${escapeHtml(c.name)}</div><div class="room-case-shelves">${Array.from({length:c.shelfCount},(_,i)=>roomCaseShelfPreview(c.id, i+1, 4)).join('')}</div>`;
      map.appendChild(el);
      wireBookcase(el, c);
    });
    if (selectedId) renderRoomInspector(selectedId);
    else $('roomInspector').innerHTML = '<h3>Room</h3><p class="muted">Select a bookcase to see its shelves and movies.</p>';
  }

  function renderRoomInspector(caseId) {
    const c = caseById(caseId);
    if (!c) return;
    const shelves = Array.from({length:c.shelfCount},(_,i) => {
      const sm = shelfMovies(c.id, i+1);
      return `<div class="shelf-summary"><div class="shelf-summary-heading"><strong>Shelf ${i+1}</strong><div class="shelf-row-label-actions"><span class="muted">${sm.length}</span><button type="button" class="secondary shelf-view-btn" data-case-id="${c.id}" data-shelf="${i+1}">View shelf</button></div></div>${renderShelfPosterStrip(sm, 6, true)}</div>`;
    }).join('');
    $('roomInspector').innerHTML = `<h3>${escapeHtml(c.name)}</h3><p class="muted">${caseMovieCount(c.id)} movies · ${c.shelfCount} shelves</p>${shelves}<button class="secondary room-edit-case">Edit bookcase</button>`;
    $('roomInspector').querySelector('.room-edit-case')?.addEventListener('click', () => openCaseDialog(c.id));
    wireShelfPosterClicks($('roomInspector'));
    wireShelfViewButtons($('roomInspector'));
  }

  function wireBookcase(el, c) {
    let drag = null;
    let moved = false;
    const map = $('roomMap');
    el.addEventListener('pointerdown', e => {
      if (!roomEditMode) return;
      e.preventDefault();
      moved = false;
      const mapRect = map.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      drag = { dx:e.clientX-elRect.left, dy:e.clientY-elRect.top, mapRect };
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      moved = true;
      const x = ((e.clientX - drag.mapRect.left - drag.dx) / drag.mapRect.width) * 100;
      const y = ((e.clientY - drag.mapRect.top - drag.dy) / drag.mapRect.height) * 100;
      c.x = clamp(x, 0, 100-c.width);
      c.y = clamp(y, 0, 100-c.height);
      el.style.left = `${c.x}%`; el.style.top = `${c.y}%`;
    });
    el.addEventListener('pointerup', async e => {
      if (drag) {
        drag = null; el.classList.remove('dragging');
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        await idbPut(CASES, c);
      }
      if (!moved) selectRoomCase(c.id);
    });
    el.addEventListener('click', () => { if (!roomEditMode) selectRoomCase(c.id); });

    el.addEventListener('mouseenter', e => {
      const tip = document.createElement('div');
      tip.className = 'case-tooltip'; tip.id = 'caseTooltip';
      tip.innerHTML = `<strong>${escapeHtml(c.name)}</strong><br>${caseMovieCount(c.id)} movies`;
      map.appendChild(tip); positionTooltip(tip,e,map);
    });
    el.addEventListener('mousemove', e => { const tip=$('caseTooltip'); if(tip) positionTooltip(tip,e,map); });
    el.addEventListener('mouseleave', () => $('caseTooltip')?.remove());
  }

  function positionTooltip(tip, e, map) {
    const r = map.getBoundingClientRect();
    tip.style.left = `${clamp(e.clientX-r.left+12,0,r.width-160)}px`;
    tip.style.top = `${clamp(e.clientY-r.top+12,0,r.height-70)}px`;
  }

  function selectRoomCase(id) {
    qsa('.bookcase').forEach(e => e.classList.toggle('selected', e.dataset.id === id));
    renderRoomInspector(id);
  }

  async function autoArrangeRoom() {
    const cols = Math.max(1, Math.ceil(Math.sqrt(cases.length)));
    cases.forEach((c,i) => {
      const col = i % cols, row = Math.floor(i/cols);
      c.width = Math.min(c.width || 18, 22);
      c.height = Math.min(c.height || 42, 42);
      c.x = 4 + col * Math.min(28, 88/cols);
      c.y = 5 + row * 47;
      c.y = clamp(c.y, 0, 100-c.height);
    });
    await Promise.all(cases.map(c => idbPut(CASES,c)));
    renderRoom(); toast('Room layout auto-arranged');
  }

  async function exportBackup() {
    const payload = { schemaVersion:1, exportedAt:new Date().toISOString(), movies, cases, settings:{ tmdbToken: await getSetting('tmdbToken','') } };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `movie-room-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    $('backupStatus').textContent = 'Backup exported.';
  }

  async function importBackup(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.movies) || !Array.isArray(payload.cases)) throw new Error('This does not look like a valid Movie Room backup.');
      if (!confirm(`Import ${payload.movies.length} movies and ${payload.cases.length} bookcases? This replaces current local data.`)) return;
      await idbClear(MOVIES); await idbClear(CASES);
      for (const m of payload.movies) await idbPut(MOVIES,m);
      for (const c of payload.cases) await idbPut(CASES,c);
      if (payload.settings?.tmdbToken) await setSetting('tmdbToken', payload.settings.tmdbToken);
      await reloadState();
      $('tmdbToken').value = await getSetting('tmdbToken','');
      $('backupStatus').textContent = 'Backup imported successfully.';
      toast('Import complete');
    } catch (err) { $('backupStatus').textContent = err.message; }
  }

  async function eraseAll() {
    if (!confirm('Erase every movie, bookcase and local setting from this browser?')) return;
    if (!confirm('Final confirmation: this cannot be undone without a backup.')) return;
    await idbClear(MOVIES); await idbClear(CASES); await idbClear(SETTINGS);
    await reloadState(); $('tmdbToken').value=''; toast('Local data erased');
  }

  async function reloadState() {
    movies = await idbGetAll(MOVIES);
    cases = await idbGetAll(CASES);
    movies.sort((a,b)=>a.title.localeCompare(b.title));
    cases.sort((a,b)=>a.name.localeCompare(b.name));
    renderCatalog(); renderCases(); renderRoom();
  }

  function bindEvents() {
    qsa('.tab').forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));
    qsa('[data-go]').forEach(b => b.addEventListener('click', () => setView(b.dataset.go)));
    $('catalogSearch').addEventListener('input', renderCatalog);
    $('catalogCaseFilter').addEventListener('change', renderCatalog);
    $('catalogFormatFilter').addEventListener('change', renderCatalog);
    $('catalogSort').addEventListener('change', renderCatalog);
    $('movieSearchForm').addEventListener('submit', e => { e.preventDefault(); const q=$('movieSearchInput').value.trim(); if(q) searchMovies(q); });
    $('movieSearchInput').addEventListener('input', handleMovieSearchInput);
    $('movieSearchInput').addEventListener('focus', () => {
      const q = $('movieSearchInput').value.trim();
      if (q.length < 2 || !$('movieSearchSuggestions').classList.contains('hidden')) return;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => loadSearchSuggestions(q), 180);
    });
    $('searchClearBtn').addEventListener('click', () => clearMovieSearch({ focus:true }));
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.search-input-wrap')) hideSearchSuggestions(); });
    $('manualMovieBtn').addEventListener('click', openManualMovieDialog);
    $('manualCloseBtn').addEventListener('click', closeManualMovieDialog);
    $('manualCancelBtn').addEventListener('click', closeManualMovieDialog);
    $('manualMovieDialog').addEventListener('close', () => $('manualMovieForm').reset());
    $('manualCase').addEventListener('change', () => fillManualShelfSelect($('manualCase').value,''));
    $('manualMovieForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (!$('manualMovieForm').reportValidity()) return;
      await saveManualMovie();
      closeManualMovieDialog();
    });
    $('editCase').addEventListener('change', () => fillShelfSelect($('editCase').value,''));
    $('movieEditForm').addEventListener('submit', async e => { if (e.submitter?.value === 'default') await saveMovieEditor(); });
    $('deleteMovieBtn').addEventListener('click', deleteEditingMovie);
    $('addCaseBtn').addEventListener('click', () => openCaseDialog());
    $('caseForm').addEventListener('submit', async e => { if (e.submitter?.value === 'default') await saveCase(); });
    $('deleteCaseBtn').addEventListener('click', deleteEditingCase);
    $('roomEditToggle').addEventListener('change', e => { roomEditMode=e.target.checked; renderRoom(); });
    $('resetRoomLayout').addEventListener('click', autoArrangeRoom);
    $('saveTokenBtn').addEventListener('click', async () => { await setSetting('tmdbToken',$('tmdbToken').value.trim()); $('tokenStatus').textContent='Token saved locally.'; toast('TMDB token saved'); });
    $('testTokenBtn').addEventListener('click', async () => {
      await setSetting('tmdbToken',$('tmdbToken').value.trim());
      $('tokenStatus').textContent='Testing…';
      try { const data=await tmdbFetch('/movie/550?language=en-US'); $('tokenStatus').textContent=`Connected successfully (${data.title || 'TMDB'}).`; }
      catch(err) { $('tokenStatus').textContent=err.message; }
    });
    $('exportBtn').addEventListener('click', exportBackup);
    $('importInput').addEventListener('change', e => { if(e.target.files[0]) importBackup(e.target.files[0]); e.target.value=''; });
    $('eraseBtn').addEventListener('click', eraseAll);
    $('shelfDialogClose').addEventListener('click', () => $('shelfDialog').close());
  }

  async function init() {
    if (!('indexedDB' in window)) {
      alert('This browser does not support IndexedDB. Please use a current version of Chrome, Edge, Firefox, or Safari.');
      return;
    }
    db = await openDB();
    bindEvents();
    await reloadState();
    $('tmdbToken').value = await getSetting('tmdbToken','');
  }

  init().catch(err => { console.error(err); alert(`Movie Room could not start: ${err.message}`); });
})();
