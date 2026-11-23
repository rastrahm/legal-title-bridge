const I18N = {
  es: {
    'html.lang': 'es',
    'meta.title': 'Legal Title Bridge — Rolando Strahm',
    'meta.description':
      'Puente Ethereum↔Solana para títulos legales: TitleRegistry ERC-3643, Token-2022 + hook, BridgeEndpoint 2-of-3, DvP atómico. Sepolia + Devnet. Foundry · Anchor 0.31.1 · Next.js 16.',

    'nav.overview': 'Proyecto',
    'nav.pillars': 'Pilares',
    'nav.gallery': 'UI',
    'nav.security': 'Seguridad',
    'nav.process': 'Proceso',
    'nav.repos': 'Repos',
    'nav.close': '← Cerrar',

    'hero.tag': '// MÓDULO 22 · PORTFOLIO WEB3',
    'hero.title': 'LEGAL TITLE<br>BRIDGE',
    'hero.role': 'Solidity 0.8.37 · Foundry · Anchor 0.31.1 · Next.js 16 · Node 22',
    'hero.sub':
      'Puente Ethereum ↔ Solana para títulos legales: Ethereum manda, Solana espeja con Token-2022 + transfer hook, DvP atómico y quórum 2-of-3 — evidencia real en Sepolia y Devnet.',
    'hero.cta1': 'Ver en GitHub',
    'hero.cta2': 'Ver en GitLab',

    'ov.eyebrow': '// 01 — CONTEXTO',
    'ov.title': 'Por qué este proyecto',
    'ov.lead':
      'Un título legal tokenizado no puede vivir en dos verdades. Este módulo fija <strong>Ethereum como fuente de verdad</strong> (TitleRegistry estilo ERC-3643), espeja en <strong>Solana Token-2022</strong> con transfer hook, cruza mensajes vía <strong>BridgeEndpoint 2-of-3</strong> y cierra ventas con <strong>escrow DvP</strong> (plazos D4–D6). Laboratorio en <strong>Sepolia + Solana Devnet</strong>, no mainnet ni asesoramiento legal.',

    'pi.eyebrow': '// 02 — CINCO PILARES',
    'pi.title': 'Qué entrega el módulo',
    'p1.num': '// PILAR_01',
    'p1.title': 'TitleRegistry',
    'p1.desc':
      'Ethereum manda: unidades por activo, compliance modular y asientos encadenados. Solana espeja con Token-2022 + transfer hook.',
    'p1.l1': 'ERC-3643-style + LedgerChain',
    'p1.l2': 'Token-2022 permanent delegate',
    'p1.l3': 'UnauthorizedTransferPath',
    'p2.num': '// PILAR_02',
    'p2.title': 'BridgeEndpoint',
    'p2.desc':
      'Quórum 2-of-3 de relayers, dominios/épocas, anti-replay por messageId y límites de flujo con pausa de guardián.',
    'p2.l1': 'RelayerQuorum · WrongDomain',
    'p2.l2': 'MessageAlreadyProcessed',
    'p2.l3': 'FlowLimitExceeded · Timelock',
    'p3.num': '// PILAR_03',
    'p3.title': 'DvP escrow',
    'p3.desc':
      'Escrow atómico en Solana: depósito, decisión Ethereum y settlement/refund bajo plazos D4–D6.',
    'p3.l1': 'D4 soft · D5 hard · D6 reconcile',
    'p3.l2': 'MintMismatch · PDA seeds',
    'p3.l3': 'LateApprovalRejected',
    'p4.num': '// PILAR_04',
    'p4.title': 'Testnets UI',
    'p4.desc':
      'Despliegue real en Sepolia + Solana Devnet con evidencia UI (MetaMask + Phantom) y recorrido documentado.',
    'p4.l1': 'Issue + DvP handoff',
    'p4.l2': 'DEPLOY-TESTNET-ES.md',
    'p4.l3': '8 capturas de pantalla',
    'p5.num': '// PILAR_05',
    'p5.title': 'Seguridad',
    'p5.desc':
      'REDTEAM R1–R7 con control positivo, EXTATK X1–X36 (0 roto) y auditoría estática SWC/Slither/Aderyn justificada.',
    'p5.l1': 'R1–R7 + P1–P9 + W1–W6',
    'p5.l2': 'X1–X36 · 0 roto · 2 parcial',
    'p5.l3': 'C4 High/Med justificados',

    'gal.eyebrow': '// 03 — RECORRIDO UI',
    'gal.title': 'Evidencia en pantallas',
    'gal.lead':
      'Capturas del frontend Next.js 16 contra el despliegue de laboratorio. Las direcciones vienen de <code>shared/</code> (D14), nunca de la URL.',
    'gal.video':
      '<strong>Video:</strong> un walkthrough grabado puede añadirse más adelante; para el cierre v1 las capturas cubren el tour (home → activos → puente → roles).',
    'gal.s1': 'Home',
    'gal.s2': 'Activos',
    'gal.s3': 'Detalle de activo',
    'gal.s4': 'Puente',
    'gal.s5': 'Comprador / DvP',
    'gal.s6': 'Cartera',
    'gal.s7': 'Operador',
    'gal.s8': 'Verificador',

    'sec.eyebrow': '// 04 — SEGURIDAD',
    'sec.title': 'REDTEAM · EXTATK · SWC',
    'sec.lead':
      'Defensa en capas: incidentes históricos <strong>R1–R7</strong> con control positivo, set profundo <strong>X1–X36</strong> por agente externo (<strong>0 roto</strong>) y auditoría estática C4 (Slither / Aderyn / cargo-audit / npm) justificada en <code>doc/SWC-AUDIT-ES.md</code>.',
    'sec.s1': 'EXTATK intentados',
    'sec.s2': 'Parcial (diseño)',
    'sec.s3': 'Roto',
    'cR.t': 'REDTEAM',
    'cR.d': 'Poly/Qubit/Wormhole/Cashio/Ronin/Harmony/Nomad: gana en vulnerable, falla en real.',
    'cP.t': 'Protocolo',
    'cP.d': 'Replay, dominio, hook bypass, reentrancy CEI, identidad, court, montos, refund.',
    'cX.t': 'EXTATK',
    'cX.d': '34 bloqueados · 2 parcial (X30 API, X32 flow griefing) · 0 roto.',
    'cS.t': 'SWC / estático',
    'cS.d': 'High/Medium de Slither y Aderyn justificados; cargo/npm sin vulns bloqueantes.',
    'sec.th1': 'Control clave',
    'sec.th2': 'Mitigación',
    'sec.r1a': 'Quórum 2-of-3 + epoch',
    'sec.r1b': 'InvalidQuorum / WrongDomain; rotación con timelock',
    'sec.r2a': 'messageId anti-replay',
    'sec.r2b': 'MessageAlreadyProcessed antes de efectos (CEI)',
    'sec.r3a': 'Sysvar instructions',
    'sec.r3b': 'address = instructions::ID + load_instruction_at_checked',
    'sec.r4a': 'Transfer hook path',
    'sec.r4b': 'Solo permanent delegate o escrow authority',
    'sec.r5a': 'DvP deadlines D4–D6',
    'sec.r5b': 'Expired / LateApprovalRejected / reconcile hash',
    'sec.r6a': 'Frontend D14 / CSP',
    'sec.r6b': 'Addresses desde shared/; frame-ancestors none; sin dangerouslySetInnerHTML',

    'pr.eyebrow': '// 05 — PROCESO',
    'pr.title': 'Fases BOOT→SOLV',
    'pr.lead':
      'Gates de autorización explícita: codec → title → endpoint → mirror/DvP → relay/e2e/front → REDTEAM → QA → EXTATK → TESTNET → SOLV.',
    'ph.15': 'BOOT → ENDPOINT (Ethereum core)',
    'ph.69': 'MIRROR → RELAY (Solana + flota)',
    'ph.1011': 'E2E + FRONT (Next.js 16)',
    'ph.1214': 'REDTEAM · QA · EXTATK',
    'ph.1516': 'TESTNET Sepolia+Devnet · SOLV',
    'st.1': 'Fases',
    'st.2': 'EXTATK',
    'st.3': 'Roto',
    'st.4': 'Cadenas testnet',

    'term.label': 'rolando@strahm:~/22-legal-title-bridge',
    'term.1': 'make check-extatk',
    'term.2': '[PASS] X1–X36 · 0 roto · 2 parcial',
    'term.3': 'cat doc/DEPLOY-TESTNET-ES.md | head',
    'term.4': 'Sepolia + Solana Devnet · UI issue + DvP OK',
    'term.5': 'echo status',
    'term.6': 'MODULE_22 · PORTFOLIO_READY · V1',

    're.eyebrow': '// 06 — CÓDIGO ABIERTO',
    're.title': 'Repositorios',
    're.lead':
      'Mismo código en GitHub y GitLab: contratos Solidity, programa Anchor, relayer, shared/, frontend, e2e y docs de seguridad.',
    're.cta': 'Contactar',
    're.linkedin': 'LinkedIn',

    'ft.left': 'ROLANDO STRAHM — Legal Title Bridge · Portfolio',
    'ft.right': 'FOUNDRY · SOLC 0.8.37 · ANCHOR 0.31.1 · NEXT 16 · ALL_SYSTEMS_OPERATIONAL',
  },

  en: {
    'html.lang': 'en',
    'meta.title': 'Legal Title Bridge — Rolando Strahm',
    'meta.description':
      'Ethereum↔Solana legal-title bridge: ERC-3643-style TitleRegistry, Token-2022 + hook, 2-of-3 BridgeEndpoint, atomic DvP. Sepolia + Devnet. Foundry · Anchor 0.31.1 · Next.js 16.',

    'nav.overview': 'Project',
    'nav.pillars': 'Pillars',
    'nav.gallery': 'UI',
    'nav.security': 'Security',
    'nav.process': 'Process',
    'nav.repos': 'Repos',
    'nav.close': '← Close',

    'hero.tag': '// MODULE 22 · WEB3 PORTFOLIO',
    'hero.title': 'LEGAL TITLE<br>BRIDGE',
    'hero.role': 'Solidity 0.8.37 · Foundry · Anchor 0.31.1 · Next.js 16 · Node 22',
    'hero.sub':
      'Ethereum ↔ Solana bridge for legal titles: Ethereum is source of truth, Solana mirrors with Token-2022 + transfer hook, atomic DvP and 2-of-3 quorum — real evidence on Sepolia and Devnet.',
    'hero.cta1': 'View on GitHub',
    'hero.cta2': 'View on GitLab',

    'ov.eyebrow': '// 01 — CONTEXT',
    'ov.title': 'Why this project',
    'ov.lead':
      'A tokenized legal title cannot live under two truths. This module makes <strong>Ethereum the source of truth</strong> (ERC-3643-style TitleRegistry), mirrors on <strong>Solana Token-2022</strong> with a transfer hook, crosses messages via a <strong>2-of-3 BridgeEndpoint</strong>, and settles sales with <strong>DvP escrow</strong> (D4–D6 deadlines). Lab on <strong>Sepolia + Solana Devnet</strong> — not mainnet, not legal advice.',

    'pi.eyebrow': '// 02 — FIVE PILLARS',
    'pi.title': 'What the module ships',
    'p1.num': '// PILLAR_01',
    'p1.title': 'TitleRegistry',
    'p1.desc':
      'Ethereum rules: units per asset, modular compliance, and chained ledger entries. Solana mirrors with Token-2022 + transfer hook.',
    'p1.l1': 'ERC-3643-style + LedgerChain',
    'p1.l2': 'Token-2022 permanent delegate',
    'p1.l3': 'UnauthorizedTransferPath',
    'p2.num': '// PILLAR_02',
    'p2.title': 'BridgeEndpoint',
    'p2.desc':
      '2-of-3 relayer quorum, domains/epochs, messageId anti-replay, and flow limits with guardian pause.',
    'p2.l1': 'RelayerQuorum · WrongDomain',
    'p2.l2': 'MessageAlreadyProcessed',
    'p2.l3': 'FlowLimitExceeded · Timelock',
    'p3.num': '// PILLAR_03',
    'p3.title': 'DvP escrow',
    'p3.desc':
      'Atomic escrow on Solana: deposit, Ethereum decision, and settle/refund under D4–D6 deadlines.',
    'p3.l1': 'D4 soft · D5 hard · D6 reconcile',
    'p3.l2': 'MintMismatch · PDA seeds',
    'p3.l3': 'LateApprovalRejected',
    'p4.num': '// PILLAR_04',
    'p4.title': 'Testnets UI',
    'p4.desc':
      'Live deploy on Sepolia + Solana Devnet with UI evidence (MetaMask + Phantom) and a documented walkthrough.',
    'p4.l1': 'Issue + DvP handoff',
    'p4.l2': 'DEPLOY-TESTNET-ES.md',
    'p4.l3': '8 UI screenshots',
    'p5.num': '// PILLAR_05',
    'p5.title': 'Security',
    'p5.desc':
      'REDTEAM R1–R7 with positive controls, EXTATK X1–X36 (0 broken), and a justified SWC/Slither/Aderyn static audit.',
    'p5.l1': 'R1–R7 + P1–P9 + W1–W6',
    'p5.l2': 'X1–X36 · 0 broken · 2 partial',
    'p5.l3': 'C4 High/Med justified',

    'gal.eyebrow': '// 03 — UI TOUR',
    'gal.title': 'Screen evidence',
    'gal.lead':
      'Screenshots of the Next.js 16 frontend against the lab deploy. Addresses come from <code>shared/</code> (D14), never from the URL.',
    'gal.video':
      '<strong>Video:</strong> a recorded walkthrough can be added later; for the v1 close, screenshots cover the tour (home → assets → bridge → roles).',
    'gal.s1': 'Home',
    'gal.s2': 'Assets',
    'gal.s3': 'Asset detail',
    'gal.s4': 'Bridge',
    'gal.s5': 'Buyer / DvP',
    'gal.s6': 'Wallet',
    'gal.s7': 'Operator',
    'gal.s8': 'Verifier',

    'sec.eyebrow': '// 04 — SECURITY',
    'sec.title': 'REDTEAM · EXTATK · SWC',
    'sec.lead':
      'Defense in depth: historical incidents <strong>R1–R7</strong> with positive controls, deep set <strong>X1–X36</strong> by an external agent (<strong>0 broken</strong>), and C4 static audit (Slither / Aderyn / cargo-audit / npm) justified in <code>doc/SWC-AUDIT-ES.md</code>.',
    'sec.s1': 'EXTATK attempted',
    'sec.s2': 'Partial (by design)',
    'sec.s3': 'Broken',
    'cR.t': 'REDTEAM',
    'cR.d': 'Poly/Qubit/Wormhole/Cashio/Ronin/Harmony/Nomad: wins on vulnerable, fails on real.',
    'cP.t': 'Protocol',
    'cP.d': 'Replay, domain, hook bypass, CEI reentrancy, identity, court, amounts, refund.',
    'cX.t': 'EXTATK',
    'cX.d': '34 blocked · 2 partial (X30 API, X32 flow griefing) · 0 broken.',
    'cS.t': 'SWC / static',
    'cS.d': 'Slither and Aderyn High/Medium justified; cargo/npm with no blocking vulns.',
    'sec.th1': 'Key control',
    'sec.th2': 'Mitigation',
    'sec.r1a': '2-of-3 quorum + epoch',
    'sec.r1b': 'InvalidQuorum / WrongDomain; rotation with timelock',
    'sec.r2a': 'messageId anti-replay',
    'sec.r2b': 'MessageAlreadyProcessed before effects (CEI)',
    'sec.r3a': 'Instructions sysvar',
    'sec.r3b': 'address = instructions::ID + load_instruction_at_checked',
    'sec.r4a': 'Transfer hook path',
    'sec.r4b': 'Only permanent delegate or escrow authority',
    'sec.r5a': 'DvP deadlines D4–D6',
    'sec.r5b': 'Expired / LateApprovalRejected / reconcile hash',
    'sec.r6a': 'Frontend D14 / CSP',
    'sec.r6b': 'Addresses from shared/; frame-ancestors none; no dangerouslySetInnerHTML',

    'pr.eyebrow': '// 05 — PROCESS',
    'pr.title': 'Phases BOOT→SOLV',
    'pr.lead':
      'Explicit authorization gates: codec → title → endpoint → mirror/DvP → relay/e2e/front → REDTEAM → QA → EXTATK → TESTNET → SOLV.',
    'ph.15': 'BOOT → ENDPOINT (Ethereum core)',
    'ph.69': 'MIRROR → RELAY (Solana + fleet)',
    'ph.1011': 'E2E + FRONT (Next.js 16)',
    'ph.1214': 'REDTEAM · QA · EXTATK',
    'ph.1516': 'TESTNET Sepolia+Devnet · SOLV',
    'st.1': 'Phases',
    'st.2': 'EXTATK',
    'st.3': 'Broken',
    'st.4': 'Testnet chains',

    'term.label': 'rolando@strahm:~/22-legal-title-bridge',
    'term.1': 'make check-extatk',
    'term.2': '[PASS] X1–X36 · 0 broken · 2 partial',
    'term.3': 'cat doc/DEPLOY-TESTNET-ES.md | head',
    'term.4': 'Sepolia + Solana Devnet · UI issue + DvP OK',
    'term.5': 'echo status',
    'term.6': 'MODULE_22 · PORTFOLIO_READY · V1',

    're.eyebrow': '// 06 — OPEN SOURCE',
    're.title': 'Repositories',
    're.lead':
      'Same codebase on GitHub and GitLab: Solidity contracts, Anchor program, relayer, shared/, frontend, e2e, and security docs.',
    're.cta': 'Contact',
    're.linkedin': 'LinkedIn',

    'ft.left': 'ROLANDO STRAHM — Legal Title Bridge · Portfolio',
    'ft.right': 'FOUNDRY · SOLC 0.8.37 · ANCHOR 0.31.1 · NEXT 16 · ALL_SYSTEMS_OPERATIONAL',
  },
};

function setLanguage(lang) {
  const dict = I18N[lang] || I18N.es;
  document.documentElement.lang = dict['html.lang'];
  document.title = dict['meta.title'];

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && dict['meta.description']) {
    metaDesc.setAttribute('content', dict['meta.description']);
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = dict[key];
    if (val == null) return;
    if (el.hasAttribute('data-i18n-html')) el.innerHTML = val;
    else el.textContent = val;
  });

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  localStorage.setItem('legal-title-bridge-portfolio-lang', lang);

  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
}

function initI18n() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('lang');
  const saved = localStorage.getItem('legal-title-bridge-portfolio-lang');
  const preferred =
    (fromQuery === 'en' || fromQuery === 'es' ? fromQuery : null) ||
    saved ||
    (navigator.language?.startsWith('en') ? 'en' : 'es');

  setLanguage(preferred);

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });
}

document.addEventListener('DOMContentLoaded', initI18n);
