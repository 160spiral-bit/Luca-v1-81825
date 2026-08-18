  /* ── BRIDGE: orchestrates onboarding ↔ chat transition ── */
  (function() {
    const ONBOARDING_KEY = 'luca-onboarding';
    const onboardingEl = document.getElementById('onboarding-flow');
    const chatEl = document.getElementById('chat-workspace');

    // Exposed globally so the onboarding IIFE can call it
    window.__finishOnboarding = function(payload) {
      // Make the profile (name + avatar) available to the chat app immediately.
      window.__lucaUser = payload;

      // Save to localStorage. `complete: true` distinguishes a finished
      // profile from the in-progress draft the wizard also stores under
      // this SAME key (see the onboarding IIFE below) — there used to be a
      // second key, 'luca-onboarding-partial', just for the draft, but
      // nothing ever read it back; it was a dead write on every wizard
      // step. One key now covers both cases.
      try {
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify(Object.assign({ complete: true }, payload)));
      } catch (e) {
        console.warn('Could not save onboarding ', e);
      }

      // Apply saved theme
      if (payload.theme) {
        document.documentElement.setAttribute('data-theme', payload.theme);
      }

      // Reveal the chat workspace RIGHT NOW. It's already fully built (hidden
      // behind the onboarding overlay), so there's no window where nothing
      // is visible. Previously this was gated behind a 500ms setTimeout —
      // during that gap the overlay was fading out AND the chat workspace
      // was still opacity:0, so if that timer got delayed (backgrounded
      // tab, throttled timers, a slow paint) you'd land on a stuck black
      // screen with no way out except a refresh. Doing it synchronously
      // removes that gap entirely.
      document.body.classList.remove('onboarding-active');
      document.body.classList.add('chat-active');
      chatEl.classList.add('visible');

      // Now just fade the onboarding overlay away on top of the chat that's
      // already sitting underneath it, then drop it from layout. Use
      // 'transitionend' (with a timeout fallback in case the transition
      // never fires) instead of a fixed delay, so cleanup always happens.
      onboardingEl.classList.add('hidden');
      let overlayCleaned = false;
      function cleanupOverlay() {
        if (overlayCleaned) return;
        overlayCleaned = true;
        onboardingEl.style.display = 'none';
      }
      onboardingEl.addEventListener('transitionend', cleanupOverlay, { once: true });
      setTimeout(cleanupOverlay, 700);

      // Fire a custom event so chat JS can react if needed
      window.dispatchEvent(new CustomEvent('onboarding-complete', { detail: payload }));
    };


    // Detect OS color scheme preference
    try {
      const osPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!document.documentElement.getAttribute('data-theme')) {
        document.documentElement.setAttribute('data-theme', osPrefersDark ? 'dark' : 'light');
      }
    } catch(e) {}
    // On page load: check if onboarding was already completed. A saved
    // record with complete !== true is just the wizard's in-progress draft
    // (see the onboarding IIFE below) — that should still show the wizard,
    // not skip straight to chat.
    try {
      const saved = localStorage.getItem(ONBOARDING_KEY);
      if (saved && JSON.parse(saved).complete === true) {
        const payload = JSON.parse(saved);
        window.__lucaUser = payload;

        // Apply saved theme immediately
        if (payload.theme) {
          document.documentElement.setAttribute('data-theme', payload.theme);
        }

        // Skip onboarding, show chat directly
        onboardingEl.style.display = 'none';
        onboardingEl.classList.add('hidden');
        document.body.classList.remove('onboarding-active');
        document.body.classList.add('chat-active');
        // Visibility handled by CSS class
        chatEl.classList.add('visible');
      }
    } catch (e) {
      // localStorage not available or parse error — show onboarding
    }
  })();

  /* ── ONBOARDING JS ── */
  (function() {

    /* ---------- STATE ---------- */
    const state = {
      currentStep: 1,
      totalSteps: 3,
      direction: 'forward',        // 'forward' | 'back'
      data: {
        name: '',
        persona: null,              // 'developer' | 'student' | ...
        theme: 'dark',
        avatar: null                 // data URL of the uploaded profile photo, or null
      }
    };

    /* Step metadata for the progress label */
    const STEP_LABELS = {
      1: 'Welcome',
      2: 'Persona',
      3: 'Look & Feel'
    };

    const PERSONA_LABELS = {
      developer: 'Developer',
      student: 'Student',
      designer: 'Designer',
      writer: 'Writer',
      researcher: 'Researcher',
      founder: 'Founder'
    };

    /* ---------- DOM CACHE ---------- */
    const dom = {
      stepCurrent: document.getElementById('stepCurrent'),
      stepTotal: document.getElementById('stepTotal'),
      stepLabel: document.getElementById('stepLabel'),
      progressFill: document.getElementById('progressFill'),
      stepsViewport: document.getElementById('stepsViewport'),

      inputName: document.getElementById('inputName'),
      personaGrid: document.getElementById('personaGrid'),
      themeGroup: document.getElementById('themeGroup'),

      avatarPickerBtn: document.getElementById('avatarPickerBtn'),
      avatarPickerPreview: document.getElementById('avatarPickerPreview'),
      avatarUploadBtn: document.getElementById('avatarUploadBtn'),
      avatarRemoveBtn: document.getElementById('avatarRemoveBtn'),
      avatarFileInput: document.getElementById('avatarFileInput'),

      btnBack: document.getElementById('btnBack'),
      btnSkip: document.getElementById('btnSkip'),
      btnNext: document.getElementById('btnNext'),

      // Preview card
      pcardAvatar: document.getElementById('pcardAvatar'),
      pcardName: document.getElementById('pcardName'),
      pcardRole: document.getElementById('pcardRole'),
      pcardThemeBadge: document.getElementById('pcardThemeBadge'),
    };

    /* All step elements */
    const stepEls = Array.from(dom.stepsViewport.querySelectorAll('.step'));

    /* ---------- STEP NAVIGATION ---------- */
    function goToStep(next) {
      if (next < 1 || next > state.totalSteps) return;

      state.direction = next > state.currentStep ? 'forward' : 'back';
      const prev = state.currentStep;
      state.currentStep = next;

      // Update step elements with directional transitions
      stepEls.forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.remove('active', 'exit-left');
        if (s === prev) {
          el.classList.add(state.direction === 'forward' ? 'exit-left' : '');
        }
        if (s === next) {
          // Delay adding 'active' so exit animation plays first
          requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('active')));
          });
        }
      });

      // Update progress bar & labels
      dom.stepCurrent.textContent = next;
      dom.stepLabel.textContent = STEP_LABELS[next] || '';
      dom.progressFill.style.width = ((next / state.totalSteps) * 100) + '%';

      // Show/hide back & skip buttons
      dom.btnBack.style.display = next === 1 ? 'none' : '';
      dom.btnSkip.style.display = next === state.totalSteps ? 'none' : '';

      // Update primary button label
      if (next === state.totalSteps) {
        dom.btnNext.innerHTML = 'Enter Chat <i data-lucide="arrow-right" style="font-size:16px"></i>';
      } else {
        dom.btnNext.innerHTML = 'Continue <i data-lucide="chevron-right" style="font-size:16px"></i>';
      }
      safeCreateIcons();

      updatePreview();

      // Auto-save partial onboarding progress — into the SAME 'luca-onboarding'
      // key the finished profile uses (see the bridge IIFE above), tagged
      // complete:false so it's recognized as a draft, not a finished
      // profile, on the next page load. Previously this wrote to a second,
      // separate key ('luca-onboarding-partial') that nothing ever read
      // back, so progress was silently discarded on refresh; now it's
      // actually restored (see the RESUME block in INIT below).
      try {
        localStorage.setItem('luca-onboarding', JSON.stringify({
          complete: false, step: state.currentStep, name: state.data.name,
          persona: state.data.persona, theme: state.data.theme
        }));
      } catch(e) {}
    }

    /* ---------- EVENT WIRING ---------- */

    // Next button
    dom.btnNext.addEventListener('click', () => {
      if (state.currentStep === state.totalSteps) {
        finishOnboarding();
      } else {
        goToStep(state.currentStep + 1);
      }
    });

    // Back button
    dom.btnBack.addEventListener('click', () => {
      goToStep(state.currentStep - 1);
    });

    // Skip button — jump straight to the last step
    dom.btnSkip.addEventListener('click', () => {
      goToStep(state.totalSteps);
    });

    // Keyboard navigation: Enter to advance on the name field
    dom.inputName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        goToStep(state.currentStep + 1);
      }
    });

    // Name input — live preview update
    dom.inputName.addEventListener('input', () => {
      state.data.name = dom.inputName.value.trim();
      updatePreview();
    });

    // Persona selection
    dom.personaGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.persona-card');
      if (!card) return;

      dom.personaGrid.querySelectorAll('.persona-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
        c.tabIndex = -1;
      });
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
      card.tabIndex = 0;
      state.data.persona = card.dataset.persona;
      updatePreview();
    });


    // Keyboard navigation for persona grid (arrow keys)
    dom.personaGrid.addEventListener('keydown', (e) => {
      if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)) return;
      const cards = Array.from(dom.personaGrid.querySelectorAll('.persona-card'));
      const current = cards.findIndex(c => c.tabIndex === 0);
      let next = current;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % cards.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + cards.length) % cards.length;
      if (next !== current) {
        e.preventDefault();
        cards[next].focus();
        cards[next].click();
      }
    });

    // Theme toggle
    dom.themeGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-toggle-btn');
      if (!btn) return;

      dom.themeGroup.querySelectorAll('.theme-toggle-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');

      state.data.theme = btn.dataset.themeVal;
      document.documentElement.setAttribute('data-theme', state.data.theme);
      updatePreview();
    });

    /* ---------- PROFILE PHOTO PICKER ---------- */
    // Downscale to a small square JPEG so it stays cheap to store in
    // localStorage and renders crisply at the sizes we actually show it.
    function downscaleImage(dataUrl, maxSize) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          } catch (e) {
            resolve(dataUrl); // canvas export blocked — fall back to the original
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    }

    function openAvatarPicker() { dom.avatarFileInput.click(); }
    dom.avatarPickerBtn.addEventListener('click', openAvatarPicker);
    dom.avatarUploadBtn.addEventListener('click', openAvatarPicker);

    dom.avatarFileInput.addEventListener('change', () => {
      const file = dom.avatarFileInput.files && dom.avatarFileInput.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Please choose an image file.');
        dom.avatarFileInput.value = '';
        return;
      }
      const MAX_BYTES = 4 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        alert('That image is too large — please choose one under 4MB.');
        dom.avatarFileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        downscaleImage(reader.result, 160).then((dataUrl) => {
          state.data.avatar = dataUrl;
          updatePreview();
        });
      };
      reader.readAsDataURL(file);
    });

    dom.avatarRemoveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.data.avatar = null;
      dom.avatarFileInput.value = '';
      updatePreview();
    });

    /* ---------- LIVE PREVIEW UPDATE ---------- */
    function updatePreview() {
      const { name, persona, theme, avatar } = state.data;

      // Avatar — uploaded photo takes priority over the initial-letter fallback
      if (avatar) {
        dom.pcardAvatar.innerHTML = '<img class="pcard-avatar-img" src="' + avatar + '" alt="">';
        dom.avatarPickerPreview.innerHTML = '<img src="' + avatar + '" alt="">';
        dom.avatarRemoveBtn.style.display = '';
      } else {
        dom.pcardAvatar.textContent = name ? name.charAt(0).toUpperCase() : '?';
        dom.avatarPickerPreview.innerHTML = '<i data-lucide="camera"></i>';
        dom.avatarRemoveBtn.style.display = 'none';
      }

      // Name
      dom.pcardName.textContent = name || 'Your Name';

      // Role
      dom.pcardRole.textContent = persona ? PERSONA_LABELS[persona] : 'No role selected';

      // Theme badge
      const themeIcon = theme === 'dark' ? 'moon' : 'sun';
      dom.pcardThemeBadge.innerHTML = '<i data-lucide="' + themeIcon + '"></i> ' + (theme === 'dark' ? 'Dark' : 'Light');
      safeCreateIcons();
    }

    /* ---------- FINISH ---------- */
    function finishOnboarding() {
      // Persist to localStorage
      const payload = {
        name: state.data.name || 'User',
        persona: state.data.persona || null,
        theme: state.data.theme,
        avatar: state.data.avatar || null,
        completedAt: Date.now()
      };
      try {
        localStorage.setItem('luca-onboarding', JSON.stringify(payload));
      } catch (e) {
        // Storage may be unavailable in private mode — graceful degradation
        console.warn('Could not save onboarding ', e);
      }

      // Success animation — brief flash before redirect
      const shell = document.querySelector('.onboarding-shell');
      shell.style.transition = 'opacity 0.4s var(--ease), transform 0.4s var(--ease)';
      shell.style.opacity = '0';
      shell.style.transform = 'scale(0.97)';

      setTimeout(() => {
        window.__finishOnboarding && window.__finishOnboarding(payload);
      }, 200); // was `TIMINGS.ONBOARDING_TRANSITION` — but TIMINGS is declared
               // inside a *different* IIFE (the chat app's), out of scope here.
               // Referencing it threw "TIMINGS is not defined" the instant
               // "Enter Chat" was clicked, which aborted this handler before
               // window.__finishOnboarding ever ran — the onboarding overlay
               // was already faded to opacity 0 by the two lines above, but
               // the chat workspace never got revealed. That's the black
               // screen: onboarding data was already saved to localStorage,
               // so a refresh took the "already onboarded" fast path, which
               // doesn't depend on this code at all, and worked.
    }

    /* ---------- RESUME (restore an in-progress draft, if any) ---------- */
    // If the bridge IIFE above didn't find a *complete* profile, the
    // wizard is about to show — but there may still be a draft saved from
    // an earlier, abandoned run (complete:false). Restore it so the user
    // picks up where they left off instead of re-entering everything.
    (function restoreDraft() {
      let draft = null;
      try {
        const raw = localStorage.getItem('luca-onboarding');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.complete === false) draft = parsed;
        }
      } catch (e) {}
      if (!draft) return;

      if (draft.name) { state.data.name = draft.name; dom.inputName.value = draft.name; }

      if (draft.persona) {
        state.data.persona = draft.persona;
        const card = dom.personaGrid.querySelector('.persona-card[data-persona="' + draft.persona + '"]');
        if (card) {
          dom.personaGrid.querySelectorAll('.persona-card').forEach(c => {
            c.classList.remove('selected'); c.setAttribute('aria-checked', 'false'); c.tabIndex = -1;
          });
          card.classList.add('selected'); card.setAttribute('aria-checked', 'true'); card.tabIndex = 0;
        }
      }

      if (draft.theme) {
        state.data.theme = draft.theme;
        document.documentElement.setAttribute('data-theme', draft.theme);
        const btn = dom.themeGroup.querySelector('.theme-toggle-btn[data-theme-val="' + draft.theme + '"]');
        if (btn) {
          dom.themeGroup.querySelectorAll('.theme-toggle-btn').forEach(b => {
            b.classList.remove('active'); b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('active'); btn.setAttribute('aria-checked', 'true');
        }
      }

      if (draft.step && draft.step > 1 && draft.step <= state.totalSteps) {
        goToStep(draft.step);
      }
    })();

    /* ---------- INIT ---------- */
    dom.stepTotal.textContent = state.totalSteps;
    updatePreview();
    safeCreateIcons();

  })();
