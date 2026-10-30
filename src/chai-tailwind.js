(function (window) {
  'use strict';

  // ============================================================================
  // 1. Config & Constants
  // ============================================================================

  const VERSION = '1.0.0';
  const PREFIX = 'chai-';
  const ownScript = typeof document !== 'undefined' ? document.currentScript : null;

  const configState = { debug: false, keepClasses: false };
  const parseCache = new Map();
  const warnedClasses = new Set();
  let activeObserver = null;

  // ============================================================================
  // 2. Palette & Scales
  // ============================================================================

  const PALETTE = {
    'chai-50':  '#fdf8f0', 'chai-100': '#f7ead6', 'chai-300': '#e2b77a',
    'chai-500': '#c27c2c', 'chai-700': '#8a5216', 'chai-900': '#4a2a0a',
    'masala':   '#7b2d26', 'elaichi':  '#8fae6b', 'kesar':    '#f4a300',
    'dark':     '#1a1a1a', 'light':    '#f5f5f5',
  };

  const FONT_SIZES = {
    'xs': '12px', 'sm': '14px', 'base': '16px', 'lg': '18px', 'xl': '20px',
    '2xl': '24px', '3xl': '30px', '4xl': '36px', '5xl': '48px',
  };

  const FONT_WEIGHTS = {
    'thin': '100', 'light': '300', 'normal': '400', 'medium': '500',
    'semibold': '600', 'bold': '700', 'black': '900',
    '100': '100', '200': '200', '300': '300', '400': '400', '500': '500',
    '600': '600', '700': '700', '800': '800', '900': '900',
  };

  const FONT_FAMILIES = {
    'sans':  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'serif': 'Georgia, Cambria, "Times New Roman", Times, serif',
    'mono':  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  };

  const SHADOWS = {
    'sm':   '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'md':   '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    'lg':   '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    'xl':   '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    'none': 'none',
  };

  const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'none']);

  // ============================================================================
  // 3. Value Resolvers
  // ============================================================================

  function extractArbitrary(raw) {
    if (raw.length >= 3 && raw.startsWith('[') && raw.endsWith(']')) {
      return raw.slice(1, -1).replace(/_/g, ' ');
    }
    return null;
  }

  function isFiniteNumber(str) {
    return str !== '' && str.trim() === str && Number.isFinite(Number(str));
  }

  function isNonNegativeNumber(str) {
    return isFiniteNumber(str) && Number(str) >= 0;
  }

  function isValidCssColor(val) {
    if (!val || isFiniteNumber(val)) return false;
    return typeof window.CSS !== 'undefined' && typeof window.CSS.supports === 'function'
      ? window.CSS.supports('color', val)
      : false;
  }

  function resolveFraction(raw) {
    const match = /^(\d+)\/(\d+)$/.exec(raw);
    if (!match || Number(match[2]) === 0) return null;
    const pct = Number(((Number(match[1]) / Number(match[2])) * 100).toFixed(6));
    return `${pct}%`;
  }

  function createSizeResolver(screenUnit) {
    return function resolveSize(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      if (raw === 'full') return '100%';
      if (raw === 'screen') return screenUnit;
      if (raw === 'auto') return 'auto';
      const fraction = resolveFraction(raw);
      if (fraction !== null) return fraction;
      return isNonNegativeNumber(raw) ? `${Number(raw)}px` : null;
    };
  }

  const RESOLVERS = {
    spacing(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      return isNonNegativeNumber(raw) ? `${Number(raw)}px` : null;
    },

    margin(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      if (raw === 'auto') return 'auto';
      return isFiniteNumber(raw) ? `${Number(raw)}px` : null;
    },

    widthSize: createSizeResolver('100vw'),
    heightSize: createSizeResolver('100vh'),

    color(raw) {
      if (Object.prototype.hasOwnProperty.call(PALETTE, raw)) return PALETTE[raw];
      const arb = extractArbitrary(raw);
      const candidate = arb !== null ? arb : raw;
      return isValidCssColor(candidate) ? candidate : null;
    },

    text(raw) {
      if (Object.prototype.hasOwnProperty.call(FONT_SIZES, raw)) {
        return { fontSize: FONT_SIZES[raw] };
      }
      if (isNonNegativeNumber(raw)) return { fontSize: `${Number(raw)}px` };
      const arb = extractArbitrary(raw);
      if (arb !== null) {
        return isValidCssColor(arb) ? { color: arb } : { fontSize: arb };
      }
      const colorVal = RESOLVERS.color(raw);
      return colorVal !== null ? { color: colorVal } : null;
    },

    font(raw) {
      if (Object.prototype.hasOwnProperty.call(FONT_WEIGHTS, raw)) {
        return { fontWeight: FONT_WEIGHTS[raw] };
      }
      if (Object.prototype.hasOwnProperty.call(FONT_FAMILIES, raw)) {
        return { fontFamily: FONT_FAMILIES[raw] };
      }
      const arb = extractArbitrary(raw);
      return arb !== null ? { fontFamily: arb } : null;
    },

    leading(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      if (isNonNegativeNumber(raw)) {
        const num = Number(raw);
        return num <= 3 ? String(num) : `${num}px`;
      }
      return null;
    },

    tracking(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      return isFiniteNumber(raw) ? `${Number(raw)}px` : null;
    },

    border(raw) {
      if (BORDER_STYLES.has(raw)) return { borderStyle: raw };
      if (isNonNegativeNumber(raw)) {
        return { borderWidth: `${Number(raw)}px`, borderStyle: 'solid' };
      }
      const arb = extractArbitrary(raw);
      if (arb !== null) {
        return isValidCssColor(arb) ? { borderColor: arb } : { border: arb };
      }
      const colorVal = RESOLVERS.color(raw);
      return colorVal !== null ? { borderColor: colorVal } : null;
    },

    borderSide(raw, props) {
      const width = RESOLVERS.spacing(raw);
      return width !== null ? { [props[0]]: width, [props[1]]: 'solid' } : null;
    },

    radius(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      if (raw === 'full') return '9999px';
      return isNonNegativeNumber(raw) ? `${Number(raw)}px` : null;
    },

    gridCols(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      return /^[1-9]\d*$/.test(raw) ? `repeat(${raw}, minmax(0, 1fr))` : null;
    },

    offset(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      if (raw === 'auto') return 'auto';
      const fraction = resolveFraction(raw);
      if (fraction !== null) return fraction;
      return isFiniteNumber(raw) ? `${Number(raw)}px` : null;
    },

    zIndex(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      if (raw === 'auto') return 'auto';
      return /^-?\d+$/.test(raw) ? String(Number(raw)) : null;
    },

    shadow(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      return Object.prototype.hasOwnProperty.call(SHADOWS, raw) ? SHADOWS[raw] : null;
    },

    opacity(raw) {
      const arb = extractArbitrary(raw);
      if (arb !== null) return arb;
      if (isNonNegativeNumber(raw)) {
        const num = Number(raw);
        if (num >= 0 && num <= 100) return String(Number((num / 100).toFixed(4)));
      }
      return null;
    },
  };

  // ============================================================================
  // 4. Utility Registry
  // ============================================================================

  const KEYWORDS = {
    'text-left':       { textAlign: 'left' },
    'text-center':     { textAlign: 'center' },
    'text-right':      { textAlign: 'right' },
    'text-justify':    { textAlign: 'justify' },
    'bold':            { fontWeight: '700' },
    'italic':          { fontStyle: 'italic' },
    'underline':       { textDecoration: 'underline' },
    'no-underline':    { textDecoration: 'none' },
    'uppercase':       { textTransform: 'uppercase' },
    'lowercase':       { textTransform: 'lowercase' },
    'capitalize':      { textTransform: 'capitalize' },
    'border':          { border: '1px solid currentColor' },
    'rounded':         { borderRadius: '4px' },
    'rounded-full':    { borderRadius: '9999px' },
    'block':           { display: 'block' },
    'inline':          { display: 'inline' },
    'inline-block':    { display: 'inline-block' },
    'flex':            { display: 'flex' },
    'inline-flex':     { display: 'inline-flex' },
    'grid':            { display: 'grid' },
    'hidden':          { display: 'none' },
    'flex-row':        { flexDirection: 'row' },
    'flex-col':        { flexDirection: 'column' },
    'flex-wrap':       { flexWrap: 'wrap' },
    'flex-1':          { flex: '1 1 0%' },
    'items-start':     { alignItems: 'flex-start' },
    'items-center':    { alignItems: 'center' },
    'items-end':       { alignItems: 'flex-end' },
    'items-stretch':   { alignItems: 'stretch' },
    'justify-start':   { justifyContent: 'flex-start' },
    'justify-center':  { justifyContent: 'center' },
    'justify-end':     { justifyContent: 'flex-end' },
    'justify-between': { justifyContent: 'space-between' },
    'justify-around':  { justifyContent: 'space-around' },
    'justify-evenly':  { justifyContent: 'space-evenly' },
    'relative':        { position: 'relative' },
    'absolute':        { position: 'absolute' },
    'fixed':           { position: 'fixed' },
    'sticky':          { position: 'sticky' },
    'overflow-hidden': { overflow: 'hidden' },
    'overflow-auto':   { overflow: 'auto' },
    'overflow-scroll': { overflow: 'scroll' },
    'shadow':          { boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)' },
    'cursor-pointer':  { cursor: 'pointer' },
    'transition':      { transition: 'all 150ms ease' },
  };

  const UTILITIES = {
    'p':          { props: ['padding'],                             value: 'spacing' },
    'px':         { props: ['paddingLeft', 'paddingRight'],          value: 'spacing' },
    'py':         { props: ['paddingTop', 'paddingBottom'],          value: 'spacing' },
    'pt':         { props: ['paddingTop'],                          value: 'spacing' },
    'pr':         { props: ['paddingRight'],                        value: 'spacing' },
    'pb':         { props: ['paddingBottom'],                       value: 'spacing' },
    'pl':         { props: ['paddingLeft'],                         value: 'spacing' },
    'm':          { props: ['margin'],                              value: 'margin',   allowNegative: true },
    'mx':         { props: ['marginLeft', 'marginRight'],           value: 'margin',   allowNegative: true },
    'my':         { props: ['marginTop', 'marginBottom'],           value: 'margin',   allowNegative: true },
    'mt':         { props: ['marginTop'],                           value: 'margin',   allowNegative: true },
    'mr':         { props: ['marginRight'],                         value: 'margin',   allowNegative: true },
    'mb':         { props: ['marginBottom'],                        value: 'margin',   allowNegative: true },
    'ml':         { props: ['marginLeft'],                          value: 'margin',   allowNegative: true },
    'gap':        { props: ['gap'],                                 value: 'spacing' },
    'w':          { props: ['width'],                               value: 'widthSize' },
    'h':          { props: ['height'],                              value: 'heightSize' },
    'min-w':      { props: ['minWidth'],                            value: 'widthSize' },
    'max-w':      { props: ['maxWidth'],                            value: 'widthSize' },
    'min-h':      { props: ['minHeight'],                           value: 'heightSize' },
    'max-h':      { props: ['maxHeight'],                           value: 'heightSize' },
    'bg':         { props: ['backgroundColor'],                     value: 'color' },
    'text':       { props: ['fontSize', 'color'],                   value: 'text' },
    'font':       { props: ['fontWeight', 'fontFamily'],            value: 'font' },
    'leading':    { props: ['lineHeight'],                          value: 'leading' },
    'tracking':   { props: ['letterSpacing'],                       value: 'tracking', allowNegative: true },
    'border':     { props: ['borderWidth', 'borderStyle', 'borderColor'], value: 'border' },
    'border-t':   { props: ['borderTopWidth', 'borderTopStyle'],    value: 'borderSide' },
    'border-r':   { props: ['borderRightWidth', 'borderRightStyle'], value: 'borderSide' },
    'border-b':   { props: ['borderBottomWidth', 'borderBottomStyle'], value: 'borderSide' },
    'border-l':   { props: ['borderLeftWidth', 'borderLeftStyle'],  value: 'borderSide' },
    'rounded':    { props: ['borderRadius'],                        value: 'radius' },
    'rounded-tl': { props: ['borderTopLeftRadius'],                 value: 'radius' },
    'rounded-tr': { props: ['borderTopRightRadius'],                value: 'radius' },
    'rounded-bl': { props: ['borderBottomLeftRadius'],              value: 'radius' },
    'rounded-br': { props: ['borderBottomRightRadius'],             value: 'radius' },
    'grid-cols':  { props: ['gridTemplateColumns'],                 value: 'gridCols' },
    'top':        { props: ['top'],                                 value: 'offset',   allowNegative: true },
    'right':      { props: ['right'],                               value: 'offset',   allowNegative: true },
    'bottom':     { props: ['bottom'],                              value: 'offset',   allowNegative: true },
    'left':       { props: ['left'],                                value: 'offset',   allowNegative: true },
    'z':          { props: ['zIndex'],                              value: 'zIndex',   allowNegative: true },
    'shadow':     { props: ['boxShadow'],                           value: 'shadow' },
    'opacity':    { props: ['opacity'],                             value: 'opacity' },
  };

  const UTILITY_PREFIXES = Object.keys(UTILITIES).sort((a, b) => b.length - a.length);

  // ============================================================================
  // 5. Parser
  // ============================================================================

  function warnUnknown(className) {
    if (configState.debug && !warnedClasses.has(className)) {
      warnedClasses.add(className);
      console.warn(`[ChaiTailwind] Unknown or invalid utility class: "${className}"`);
    }
  }

  /**
   * Parses a single `chai-*` utility class into a style object.
   * Pure function with no DOM access.
   *
   * @param {string} className - The class name to parse (e.g. 'chai-p-12').
   * @returns {Object<string, string>|null} Style map or null if unrecognized.
   */
  function parse(className) {
    if (typeof className !== 'string' || !className.startsWith(PREFIX)) return null;

    if (parseCache.has(className)) {
      const cached = parseCache.get(className);
      if (cached === null) {
        warnUnknown(className);
        return null;
      }
      return { ...cached };
    }

    let body = className.slice(PREFIX.length);
    if (!body) {
      parseCache.set(className, null);
      warnUnknown(className);
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(KEYWORDS, body)) {
      const result = { ...KEYWORDS[body] };
      parseCache.set(className, result);
      return { ...result };
    }

    let isNegative = false;
    if (body.startsWith('-')) {
      isNegative = true;
      body = body.slice(1);
    }

    for (let i = 0; i < UTILITY_PREFIXES.length; i += 1) {
      const prefix = UTILITY_PREFIXES[i];
      const matchPrefix = `${prefix}-`;

      if (body.startsWith(matchPrefix)) {
        const rawValue = body.slice(matchPrefix.length);
        if (!rawValue) break;

        const entry = UTILITIES[prefix];
        if (isNegative && !entry.allowNegative) break;

        const valueToResolve = isNegative ? `-${rawValue}` : rawValue;
        const resolved = RESOLVERS[entry.value](valueToResolve, entry.props);

        if (resolved !== null) {
          let styleObj;
          if (typeof resolved === 'object') {
            styleObj = { ...resolved };
          } else {
            styleObj = {};
            for (let j = 0; j < entry.props.length; j += 1) {
              styleObj[entry.props[j]] = resolved;
            }
          }
          parseCache.set(className, styleObj);
          return { ...styleObj };
        }
        break;
      }
    }

    parseCache.set(className, null);
    warnUnknown(className);
    return null;
  }

  // ============================================================================
  // 6. DOM Applier
  // ============================================================================

  function processElement(el) {
    if (!el || !el.classList || el.classList.length === 0) return 0;

    const classes = Array.from(el.classList);
    let processedCount = 0;

    for (let i = 0; i < classes.length; i += 1) {
      const cls = classes[i];
      if (!cls.startsWith(PREFIX)) continue;

      const styleObj = parse(cls);
      if (styleObj !== null) {
        const props = Object.keys(styleObj);
        const before = el.style.cssText;
        let allApplied = true;

        for (let j = 0; j < props.length; j += 1) {
          const prop = props[j];
          el.style[prop] = '';
          el.style[prop] = styleObj[prop];
          if (el.style[prop] === '') {
            allApplied = false;
            break;
          }
        }

        if (!allApplied) {
          el.style.cssText = before;
          warnUnknown(cls);
          continue;
        }

        if (!configState.keepClasses) {
          el.classList.remove(cls);
        }
        processedCount += 1;
      }
    }

    if (el.classList.length === 0 && el.hasAttribute('class')) {
      el.removeAttribute('class');
    }

    return processedCount;
  }

  /**
   * Scans `root` and all descendants for `chai-*` classes, applies inline styles,
   * and removes processed classes (unless `keepClasses` is enabled).
   *
   * @param {Element} [root=document.body] - Root DOM element to scan.
   * @returns {number} Count of `chai-*` classes processed.
   */
  function apply(root = document.body) {
    if (!root) return 0;
    let totalProcessed = 0;

    if (root.classList && root.getAttribute && (root.getAttribute('class') || '').includes(PREFIX)) {
      totalProcessed += processElement(root);
    }

    if (typeof root.querySelectorAll === 'function') {
      const elements = root.querySelectorAll(`[class*="${PREFIX}"]`);
      for (let i = 0; i < elements.length; i += 1) {
        totalProcessed += processElement(elements[i]);
      }
    }

    return totalProcessed;
  }

  // ============================================================================
  // 7. Public API
  // ============================================================================

  /**
   * Updates ChaiTailwind configuration options.
   *
   * @param {Object} options - Configuration options (`debug`, `keepClasses`).
   * @returns {Object} Current configuration copy.
   */
  function config(options = {}) {
    if (options && typeof options === 'object') {
      if (typeof options.debug === 'boolean') configState.debug = options.debug;
      if (typeof options.keepClasses === 'boolean') configState.keepClasses = options.keepClasses;
    }
    return { ...configState };
  }

  /**
   * Starts a MutationObserver to automatically process newly added elements
   * or updated `class` attributes.
   *
   * @param {Element} [root=document.body] - Root element to observe.
   * @returns {MutationObserver|null} The active MutationObserver instance.
   */
  function observe(root = document.body) {
    if (!root || typeof window.MutationObserver !== 'function') return null;
    if (activeObserver) activeObserver.disconnect();

    activeObserver = new window.MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i += 1) {
        const mutation = mutations[i];
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target;
          if (target && target.getAttribute && (target.getAttribute('class') || '').includes(PREFIX)) {
            processElement(target);
          }
        } else if (mutation.type === 'childList') {
          for (let j = 0; j < mutation.addedNodes.length; j += 1) {
            const node = mutation.addedNodes[j];
            if (node && node.nodeType === 1) apply(node);
          }
        }
      }
    });

    activeObserver.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });

    return activeObserver;
  }

  window.ChaiTailwind = { apply, parse, observe, config, version: VERSION };

  // ============================================================================
  // 8. Auto-Init
  // ============================================================================

  function init() {
    if (typeof document === 'undefined') return;
    if (ownScript && ownScript.hasAttribute('data-chai-manual')) return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) apply(document.body);
      });
    } else if (document.body) {
      apply(document.body);
    }
  }

  init();
})(window);
