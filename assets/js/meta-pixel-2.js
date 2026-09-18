/**
 * Meta Pixel — inicialização única + helpers de evento com deduplicação (browser + CAPI).
 *
 * Carregado por TODAS as páginas do funil via:
 *   <script src="/assets/js/meta-pixel.js"></script>
 *
 * COEXISTE com o Pixel da UTMify (cdn.utmify.com.br): a UTMify continua rodando
 * para o dashboard dela; este arquivo cuida do Pixel Meta oficial (fbq direto).
 *
 * API pública (window):
 *   window.metaTrack(eventName, params, eventId)   — dispara evento padrão do Meta
 *   window.metaTrackCustom(eventName, params, eventId)
 *   window.metaUserData()                          — { fbp, fbc, fbclid, external_id_source }
 *   window.metaEventId(prefix, seed)               — gera event_id estável p/ dedup
 *
 * REGRAS:
 *  - PageView dispara UMA vez por carregamento de página (guardado por __metaPixelInit).
 *  - Eventos de fundo de funil (Purchase / InitiateCheckout) devem usar SEMPRE o mesmo
 *    event_id no browser e no servidor (CAPI): "purchase_<transactionId>" / "ic_<transactionId>".
 *  - Nunca colocar Access Token da Meta aqui (isto roda no browser).
 */
(function () {
  'use strict';

  var PIXEL_ID = '895650053388075';

  // Evita init duplicado se o script for incluído mais de uma vez.
  if (window.__metaPixelInit) return;
  window.__metaPixelInit = true;

  // ---- Loader padrão do fbevents (idempotente: se já existir fbq, não recria) ----
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  try {
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  } catch (e) {
    if (window.console) console.error('[Meta Pixel] erro no init/PageView:', e);
  }

  // ---------------------------- helpers ----------------------------

  function getCookie(name) {
    var m = document.cookie.match('(?:^|; )' + name + '=([^;]+)');
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Recupera a atribuição preservada pelo tracking.js (localStorage "utm_params_all") + URL.
  function mergedTracking() {
    try {
      if (typeof window.gvdesenrolaMergeTracking === 'function') {
        return window.gvdesenrolaMergeTracking();
      }
    } catch (e) {}
    var out = {};
    try {
      var p = new URLSearchParams(window.location.search);
      p.forEach(function (v, k) { if (v) out[k] = v; });
    } catch (e) {}
    return out;
  }

  // Dados de usuário disponíveis no browser (para o Pixel e para repassar ao CAPI).
  window.metaUserData = function () {
    var t = mergedTracking();
    var fbc = getCookie('_fbc');
    // Se não há _fbc mas há fbclid na atribuição, o backend pode reconstruir o fbc.
    return {
      fbp: getCookie('_fbp') || null,
      fbc: fbc || null,
      fbclid: t.fbclid || null
    };
  };

  // Gera um event_id estável para dedup. Se houver um "seed" (ex.: transactionId),
  // usa-o para casar 1:1 com o CAPI. Sem seed, cai num id aleatório por ocorrência.
  window.metaEventId = function (prefix, seed) {
    prefix = prefix || 'ev';
    if (seed) return prefix + '_' + String(seed);
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  };

  function fire(method, eventName, params, eventId) {
    if (typeof fbq !== 'function') return;
    var opts = eventId ? { eventID: String(eventId) } : {};
    try {
      fbq(method, eventName, params || {}, opts);
      if (window.console) {
        console.log('[Meta Pixel] ' + eventName + (eventId ? ' — eventID: ' + eventId : ''), params || {});
      }
    } catch (e) {
      if (window.console) console.error('[Meta Pixel] erro ao disparar ' + eventName + ':', e);
    }
  }

  // Evento padrão do Meta (Lead, ViewContent, InitiateCheckout, Purchase, Contact...).
  window.metaTrack = function (eventName, params, eventId) {
    fire('track', eventName, params, eventId);
  };

  // Evento customizado (trackCustom).
  window.metaTrackCustom = function (eventName, params, eventId) {
    fire('trackCustom', eventName, params, eventId);
  };

  // ------------------- Advanced Matching (browser) -------------------
  // O init acima roda SEM dados de usuario para nao atrasar o PageView. Assim que
  // os dados do comprador estiverem disponiveis, re-inicializamos o Pixel com eles.
  // Os valores sao hasheados AQUI com exatamente as mesmas regras do meta-capi-lib.php
  // (SHA-256 sobre o valor normalizado) para que Pixel e CAPI produzam a MESMA chave
  // e a Meta consiga casar os dois eventos.

  function sha256Hex(str) {
    if (!window.crypto || !window.crypto.subtle) return Promise.resolve(null);
    var buf = new TextEncoder().encode(str);
    return window.crypto.subtle.digest('SHA-256', buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (b) {
        return ('00' + b.toString(16)).slice(-2);
      }).join('');
    }).catch(function () { return null; });
  }

  // Espelha metaHash(): trim + lowercase.
  function normText(v) {
    if (!v) return null;
    v = String(v).trim().toLowerCase();
    return v || null;
  }
  // Espelha metaHashPhone(): so digitos, prefixo 55 quando <= 11 digitos.
  function normPhone(v) {
    if (!v) return null;
    var d = String(v).replace(/\D+/g, '');
    if (!d) return null;
    if (d.length <= 11) d = '55' + d;
    return d;
  }
  // Espelha metaHashCpf(): so digitos.
  function normDigits(v) {
    if (!v) return null;
    var d = String(v).replace(/\D+/g, '');
    return d || null;
  }

  // Placeholders fake compartilhados por todo cliente que nao informa email/telefone.
  // Enviar isto ao Meta gera >50% de "duplicados" e derruba o match — melhor omitir.
  function emailFake(v) {
    var e = String(v || '').trim().toLowerCase();
    if (!e) return true;
    if (e === 'cliente@desenrola.br') return true;
    if (e.slice(-10) === '@email.com') return true;
    if (e.indexOf('@telegram') !== -1) return true;
    return false;
  }
  function phoneFake(v) {
    var d = String(v || '').replace(/\D+/g, '');
    return ['11988887777','11999999999','00000000000','5511988887777','5511999999999','5500000000000'].indexOf(d) !== -1;
  }

  // Recebe { email, phone, nome, cpf } em texto plano, hasheia e re-inicializa o Pixel.
  window.metaSetUserData = function (dados) {
    try {
      if (!dados || typeof fbq !== 'function') return;

      var firstName = null, lastName = null;
      if (dados.nome) {
        var parts = String(dados.nome).trim().split(/\s+/);
        firstName = parts[0] || null;
        if (parts.length > 1) lastName = parts[parts.length - 1];
      }

      var jobs = [
        ['em', emailFake(dados.email) ? null : normText(dados.email)],
        ['ph', phoneFake(dados.phone || dados.telefone) ? null : normPhone(dados.phone || dados.telefone)],
        ['fn', normText(firstName)],
        ['ln', normText(lastName)],
        ['external_id', normDigits(dados.cpf)]
      ].filter(function (j) { return j[1]; });

      if (!jobs.length) return;

      Promise.all(jobs.map(function (j) { return sha256Hex(j[1]); })).then(function (hashes) {
        var am = {};
        hashes.forEach(function (h, i) { if (h) am[jobs[i][0]] = h; });
        if (!Object.keys(am).length) return;
        // Re-init com Advanced Matching: vale para os eventos disparados a partir daqui.
        fbq('init', PIXEL_ID, am);
        if (window.console) {
          console.log('[Meta Pixel] Advanced Matching ativo:', Object.keys(am).join(', '));
        }
      });
    } catch (e) {
      if (window.console) console.error('[Meta Pixel] erro no Advanced Matching:', e);
    }
  };

  // Tenta popular sozinho a partir do que o funil ja guarda (localStorage + URL).
  (function autoUserData() {
    try {
      var d = {};
      try {
        var ls = JSON.parse(localStorage.getItem('dadosUsuario') || '{}') || {};
        d.email = ls.email; d.phone = ls.telefone || ls.phone; d.nome = ls.nome; d.cpf = ls.cpf;
      } catch (e) {}
      var q = new URLSearchParams(window.location.search);
      d.email = d.email || q.get('email');
      d.phone = d.phone || q.get('telefone') || q.get('phone');
      d.nome  = d.nome  || q.get('nome');
      d.cpf   = d.cpf   || q.get('cpf');
      if (d.email || d.phone || d.nome || d.cpf) window.metaSetUserData(d);
    } catch (e) {}
  })();
})();
