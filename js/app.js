/* Afshar Repairs — theme, booking flow, local order records, sheets and feedback. */
(() => {
  'use strict';
  const root = document.documentElement;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

  const themeButton = document.querySelector('[data-theme-toggle]');
  const savedTheme = (() => { try { return localStorage.getItem('afshar-theme'); } catch { return null; } })();
  if (savedTheme === 'dark' || savedTheme === 'light') root.dataset.theme = savedTheme;
  themeButton?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('afshar-theme', next); } catch {}
  });

  const toast = document.querySelector('[data-toast]');
  let toastTimer;
  const showToast = message => {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
  };
  document.querySelectorAll('[data-toast-message]').forEach(el => el.addEventListener('click', () => showToast(el.dataset.toastMessage)));

  // Header intentionally remains fixed; no scroll-hide behavior.
  const header = document.querySelector('[data-header]');
  if (header) header.classList.remove('is-hidden');

  // Four-step repair request. A completed request is saved locally and receives a trackable ID.
  const stepper = document.querySelector('[data-stepper]');
  if (stepper) {
    const form = stepper.querySelector('form');
    const panels = [...stepper.querySelectorAll('[data-step]')];
    const bars = [...stepper.querySelectorAll('.stepper-progress span')];
    const title = stepper.querySelector('[data-step-title]');
    const count = stepper.querySelector('[data-step-count]');
    const back = stepper.querySelector('[data-step-back]');
    const next = stepper.querySelector('[data-step-next]');
    const submit = stepper.querySelector('[data-step-submit]');
    const message = stepper.querySelector('[data-step-message]');
    const courierFields = stepper.querySelector('[data-courier-fields]');
    const addressField = stepper.querySelector('[data-courier-address]');
    const labels = ['انتخاب دستگاه', 'مدل و نوع خرابی', 'روش تحویل دستگاه', 'اطلاعات تماس'];
    const draftKey = 'afshar-booking-draft-v2';
    let current = 0;

    const setCourierState = () => {
      const selected = form.querySelector('[name="visit"]:checked')?.value;
      const courier = selected === 'ارسال با پیک';
      if (courierFields) courierFields.hidden = !courier;
      if (addressField) addressField.required = courier;
    };

    const restoreDraft = () => {
      const draft = read(draftKey, null);
      if (!draft || typeof draft !== 'object') return;
      const allowed = ['device', 'model', 'issue', 'details', 'visit', 'address', 'name', 'phone', 'consent'];
      allowed.forEach(name => {
        const value = draft.values?.[name];
        if (value === undefined) return;
        [...form.querySelectorAll(`[name="${name}"]`)].forEach(control => {
          if (control.type === 'radio' || control.type === 'checkbox') control.checked = control.type === 'checkbox' ? Boolean(value) : control.value === value;
          else control.value = value;
        });
      });
      current = Math.max(0, Math.min(3, Number(draft.step) || 0));
      setCourierState();
    };

    const valuesFromForm = () => {
      const values = {};
      ['device', 'model', 'issue', 'details', 'visit', 'address', 'name', 'phone'].forEach(name => {
        const field = form.elements.namedItem(name);
        if (!field) return;
        if (field instanceof RadioNodeList) values[name] = field.value;
        else values[name] = field.value.trim();
      });
      values.consent = Boolean(form.elements.namedItem('consent')?.checked);
      return values;
    };
    const saveDraft = () => write(draftKey, { step: current, values: valuesFromForm(), updatedAt: Date.now() });

    const render = (focus = true) => {
      panels.forEach((panel, index) => {
        panel.hidden = index !== current;
        panel.classList.toggle('is-active', index === current);
      });
      bars.forEach((bar, index) => {
        bar.classList.toggle('is-current', index === current);
        bar.classList.toggle('is-done', index < current);
      });
      if (title) title.textContent = `مرحله ${current + 1}: ${labels[current]}`;
      if (count) count.textContent = `${current + 1} از ۴`;
      if (back) back.hidden = current === 0;
      if (next) next.hidden = current === 3;
      if (submit) submit.hidden = current !== 3;
      setCourierState();
      if (focus) panels[current].querySelector('input:not([type="radio"]),select,textarea')?.focus({ preventScroll: true });
    };

    const validateCurrent = () => {
      const fields = [...panels[current].querySelectorAll('[required]')].filter(field => !field.disabled && field.type !== 'hidden');
      for (const field of fields) {
        if (field.type === 'radio') {
          const group = [...panels[current].querySelectorAll(`[name="${field.name}"]`)];
          if (!group.some(item => item.checked)) {
            message.textContent = 'لطفاً یکی از روش‌ها رو انتخاب کن.';
            group[0]?.focus();
            return false;
          }
          continue;
        }
        if (field.type === 'checkbox' && !field.checked) {
          message.textContent = 'برای ادامه، تأیید این بخش لازمه.';
          field.focus();
          return false;
        }
        if (!field.checkValidity()) {
          field.reportValidity();
          message.textContent = 'اطلاعات مشخص‌شده رو بررسی و کامل کن.';
          field.focus();
          return false;
        }
      }
      if (current === 3) {
        const phoneRaw = String(form.elements.namedItem('phone')?.value || '');
        const phone = phoneRaw.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[\s-]/g, '');
        if (!/^09\d{9}$/.test(phone)) {
          message.textContent = 'شماره موبایل رو با ۱۱ رقم و با ۰۹ وارد کن.';
          form.elements.namedItem('phone')?.focus();
          return false;
        }
      }
      message.textContent = '';
      return true;
    };

    restoreDraft();
    form.addEventListener('change', () => { setCourierState(); saveDraft(); });
    form.addEventListener('input', saveDraft);
    next?.addEventListener('click', () => {
      if (!validateCurrent()) return;
      if (current < 3) { current += 1; saveDraft(); render(); }
    });
    back?.addEventListener('click', () => {
      if (current > 0) { current -= 1; saveDraft(); render(); }
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!validateCurrent()) return;
      const values = valuesFromForm();
      const orders = read('afshar-orders-v1', []);
      const orderId = `AF-${String(Date.now()).slice(-7)}`;
      const order = {
        id: orderId,
        createdAt: new Date().toISOString(),
        status: 'در انتظار هماهنگی پذیرش',
        values
      };
      orders.unshift(order);
      if (!write('afshar-orders-v1', orders)) {
        message.textContent = 'ذخیره درخواست در این مرورگر ممکن نشد؛ فضای ذخیره‌سازی رو بررسی کن.';
        showToast('درخواست ذخیره نشد. دوباره تلاش کن.');
        return;
      }
      try { localStorage.removeItem(draftKey); } catch {}
      stepper.innerHTML = `<section class="booking-success"><span class="booking-success__mark" aria-hidden="true">✓</span><p class="eyebrow">درخواست در این دستگاه ذخیره شد</p><h2>درخواست تعمیرت ثبت شد.</h2><p>شناسه درخواستت رو برای پیگیری نگه دار. ${values.visit === 'ارسال با پیک' ? 'برای هماهنگی دریافت دستگاه با پیک، اطلاعات تماس ثبت‌شده مبنای پیگیریه.' : 'برای تحویل حضوری، شناسه درخواستت رو همراه داشته باش.'}</p><b class="booking-success__id" dir="ltr">${orderId}</b><div class="success-actions"><a class="button button--primary" href="track.html?order=${encodeURIComponent(orderId)}">پیگیری درخواست</a><button class="button button--secondary" type="button" data-copy-order="${orderId}">کپی شناسه</button><a class="button button--secondary" href="index.html">بازگشت به خانه</a></div><p class="form-hint">این ثبت در حافظه همین مرورگر انجام شده و هنوز به سامانه مرکزی یا پیامک متصل نیست.</p></section>`;
      stepper.querySelector('[data-copy-order]')?.addEventListener('click', async event => {
        try { await navigator.clipboard.writeText(orderId); showToast('شناسه درخواست کپی شد.'); }
        catch { showToast(`شناسه درخواست: ${orderId}`); }
      });
    });
    render(false);
  }

  // Local order lookup for requests created in this browser.
  const trackForm = document.querySelector('[data-track-form]');
  if (trackForm) {
    const result = document.querySelector('[data-track-result]');
    const message = document.querySelector('[data-track-message]');
    const input = trackForm.elements.namedItem('order');
    const lookup = raw => {
      const id = String(raw || '').trim().toUpperCase();
      if (!id) { message.textContent = 'شناسه درخواست رو وارد کن.'; result.hidden = true; return; }
      const orders = read('afshar-orders-v1', []);
      const order = orders.find(item => item.id.toUpperCase() === id);
      if (!order) {
        result.hidden = true;
        message.textContent = 'درخواستی با این شناسه در همین مرورگر پیدا نشد. شناسه رو بررسی کن یا از دستگاهی استفاده کن که درخواست رو باهاش ثبت کردی.';
        return;
      }
      const v = order.values;
      result.innerHTML = `<p class="eyebrow">وضعیت درخواست</p><h2>درخواست <bdi dir="ltr">${order.id}</bdi></h2><div class="track-result__meta"><span>دستگاه</span><b>${escapeText(v.device)} · ${escapeText(v.model)}</b><span>نوع خرابی</span><b>${escapeText(v.issue)}</b><span>روش تحویل</span><b>${escapeText(v.visit)}</b><span>تاریخ ثبت</span><b>${new Date(order.createdAt).toLocaleDateString('fa-IR')}</b></div><p class="track-result__status">${escapeText(order.status)}</p><p class="form-hint">این وضعیت مربوط به نسخه محلی همین مرورگره؛ وضعیت تعمیرگاه از سامانه مرکزی دریافت نشده.</p>`;
      result.hidden = false;
      message.textContent = 'درخواست پیدا شد.';
    };
    trackForm.addEventListener('submit', event => { event.preventDefault(); lookup(input.value); });
    const params = new URLSearchParams(location.search);
    if (params.has('order')) { input.value = params.get('order'); lookup(input.value); }
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  // Corporate request draft stays local until a real submission endpoint is connected.
  document.querySelectorAll('[data-demo-form]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const payload = Object.fromEntries(new FormData(form).entries());
      if (!write('afshar-b2b-draft-v1', { ...payload, savedAt: new Date().toISOString() })) {
        const status = form.querySelector('.form-message');
        if (status) status.textContent = 'ذخیره پیش‌نویس ممکن نشد؛ فضای ذخیره‌سازی مرورگر رو بررسی کن.';
        return;
      }
      const status = form.querySelector('.form-message');
      if (status) status.textContent = 'پیش‌نویس درخواست در همین مرورگر ذخیره شد؛ هنوز برای مجموعه ارسال نشده.';
      showToast('پیش‌نویس درخواست ذخیره شد.');
    });
  });

  // Native details/summary accordion with one expanded item per list.
  document.querySelectorAll('.faq-list').forEach(list => list.addEventListener('toggle', event => {
    if (event.target.tagName !== 'DETAILS' || !event.target.open) return;
    list.querySelectorAll('details').forEach(item => { if (item !== event.target) item.open = false; });
  }, true));

  // Accessible bottom sheets: hidden by default, backdrop/Escape close, focus restore and trap.
  let activeSheet = null;
  let sheetPreviousFocus = null;
  let sheetCloseTimer = null;
  const closeSheet = () => {
    if (!activeSheet) return;
    const closingSheet = activeSheet;
    closingSheet.classList.remove('is-open');
    closingSheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-overlay');
    activeSheet = null;
    clearTimeout(sheetCloseTimer);
    sheetCloseTimer = setTimeout(() => { closingSheet.hidden = true; }, 220);
    const target = sheetPreviousFocus;
    sheetPreviousFocus = null;
    target?.focus({ preventScroll: true });
  };
  document.querySelectorAll('[data-sheet-open]').forEach(trigger => trigger.addEventListener('click', () => {
    const sheet = document.querySelector(trigger.dataset.sheetOpen);
    if (!sheet) return;
    if (activeSheet) closeSheet();
    clearTimeout(sheetCloseTimer);
    sheetPreviousFocus = trigger;
    activeSheet = sheet;
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-overlay');
    requestAnimationFrame(() => {
      if (activeSheet !== sheet) return;
      sheet.classList.add('is-open');
      sheet.querySelector('[data-sheet-close]')?.focus({ preventScroll: true });
    });
  }));
  document.querySelectorAll('[data-sheet-close]').forEach(button => button.addEventListener('click', closeSheet));
  document.addEventListener('keydown', event => {
    if (!activeSheet) return;
    if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
    if (event.key === 'Tab') {
      const focusable = [...activeSheet.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  // Device-specific model finder used by the booking flow.
  const guideTabs = [...document.querySelectorAll('[data-guide-device]')];
  const guideContent = document.querySelector('[data-guide-content]');
  const guideIntro = document.querySelector('#model-guide-intro');
  const guideCopy = {
    'موبایل': {
      intro: 'مدل موبایل معمولاً در بخش اطلاعات تلفن نوشته شده؛ مسیر مناسب برندت رو انتخاب کن.',
      steps: [
        ['آیفون', 'تنظیمات ← عمومی ← درباره؛ نام مدل و شماره مدل رو در همین صفحه می‌بینی.'],
        ['سامسونگ', 'تنظیمات ← درباره تلفن؛ نام مدل و شماره مدل در این بخشه.'],
        ['شیائومی و سایر اندرویدی‌ها', 'تنظیمات ← درباره تلفن؛ روبه‌روی «مدل» یا «نام دستگاه» رو بخون.']
      ]
    },
    'تبلت': {
      intro: 'تبلت رو روشن کن و از تنظیمات، اطلاعات دستگاه رو باز کن.',
      steps: [
        ['آیپد', 'Settings ← General ← About؛ نام مدل و Model Number نمایش داده می‌شه.'],
        ['تبلت سامسونگ', 'تنظیمات ← درباره تبلت؛ Model name یا Model number رو پیدا کن.'],
        ['سایر تبلت‌ها', 'تنظیمات ← درباره دستگاه؛ نام سازنده و شماره مدل رو وارد کن.']
      ]
    },
    'ساعت هوشمند': {
      intro: 'برای ساعت هوشمند، اطلاعات مدل در تنظیمات خود ساعت یا برنامه همراه اون قرار داره.',
      steps: [
        ['Apple Watch', 'Settings روی ساعت ← General ← About؛ نام و شماره مدل رو ببین.'],
        ['Galaxy Watch', 'Settings ← About watch؛ نام مدل و اطلاعات دستگاه نمایش داده می‌شه.'],
        ['سایر ساعت‌ها', 'در تنظیمات ساعت یا برنامه متصل به گوشی، بخش About یا Device information رو باز کن.']
      ]
    }
  };
  const renderGuide = device => {
    const selected = guideCopy[device] ? device : 'موبایل';
    const data = guideCopy[selected];
    guideTabs.forEach(tab => {
      const active = tab.dataset.guideDevice === selected;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    if (guideIntro) guideIntro.textContent = data.intro;
    if (guideContent) {
      guideContent.replaceChildren();
      data.steps.forEach(([title, description], index) => {
        const row = document.createElement('div');
        row.className = 'model-guide__step';
        const number = document.createElement('span'); number.textContent = String(index + 1);
        const body = document.createElement('div');
        const heading = document.createElement('b'); heading.textContent = title;
        const paragraph = document.createElement('p'); paragraph.textContent = description;
        body.append(heading, paragraph); row.append(number, body); guideContent.append(row);
      });
    }
  };
  guideTabs.forEach(tab => tab.addEventListener('click', () => renderGuide(tab.dataset.guideDevice)));
  const deviceInputs = document.querySelectorAll('[name="device"]');
  deviceInputs.forEach(input => input.addEventListener('change', () => renderGuide(input.value)));
  renderGuide(document.querySelector('[name="device"]:checked')?.value || 'موبایل');
})();
