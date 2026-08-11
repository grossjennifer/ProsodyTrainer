/* ============================================================================
 * engine.js — Rhythm-Enhanced Text: Stage 1 Linguistic Engine
 * ----------------------------------------------------------------------------
 * Implements the frozen Revision 3 design:
 *
 *   raw text
 *     → Tokenizer              (lossless: words / space / punct / parabreak)
 *     → Lexical Lookup         (CMU dictionary → phonemes + stress digits)
 *     → Phonemic Syllabifier   (Maximal Onset Principle)
 *     → Orthographic Aligner   (phonemic syllables → spelling spans)
 *     → Fallback Analyzer      (rule-based analysis for OOV words)
 *     ───────── TIER 1: lexical stress ─────────
 *     → Template Assigner      (pattern-first metrical templates)
 *     ───────── TIER 2: metrical template ──────
 *     → Prosodic Chunker       (IP and φ boundaries)
 *     → Rhythmic Projector     (template + context → per-syllable beats)
 *     ───────── TIER 3: rhythmic realization ───
 *     → Meter Detector         (DP foot parse per IP; texture labels)
 *     → Stats + Implicit Prosody Profile
 *
 * Pure JavaScript, no DOM. Runs in Node (tests) and the browser (Stage 2).
 * Every heuristic is named; every analysis carries source + confidence.
 *
 * EPISTEMIC LEGEND used in comments below:
 *   [EST]  empirically established property relied upon
 *   [HEUR] engineering heuristic (named, documented, editable)
 *   [SPEC] speculative / instrumented-for-testing (see design §13)
 * ========================================================================== */

(function (global) {
  'use strict';

  /* ==========================================================================
   * SECTION 0 — Linguistic constants
   * ======================================================================== */

  // ARPAbet vowel phonemes. [EST] Syllable count = vowel-phoneme count.
  const VOWELS = new Set([
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
    'IH', 'IY', 'OW', 'OY', 'UH', 'UW'
  ]);

  // Legal English word-initial onsets (phonemic). [EST] approximation of
  // English phonotactics; used by the Maximal Onset Principle.
  const LEGAL_ONSETS = new Set([
    // single consonants (all)
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N',
    'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
    // two-consonant clusters
    'B L', 'B R', 'B Y', 'D R', 'D W', 'D Y', 'F L', 'F R', 'F Y',
    'G L', 'G R', 'G W', 'HH Y', 'K L', 'K R', 'K W', 'K Y',
    'M Y', 'P L', 'P R', 'P Y', 'S F', 'S K', 'S L', 'S M', 'S N',
    'S P', 'S T', 'S W', 'SH R', 'T R', 'T W', 'TH R', 'TH W', 'V Y',
    // three-consonant clusters
    'S K R', 'S K W', 'S K Y', 'S P L', 'S P R', 'S P Y', 'S T R', 'S T Y'
  ]);

  // Orthographic onsets considered legal at a syllable boundary in spelling.
  // [HEUR "orthographic-onset"] — affects hyphen placement only.
  const ORTHO_ONSETS = new Set([
    'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r',
    's', 't', 'v', 'w', 'y', 'z',
    'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'dw', 'fl', 'fr', 'gh', 'gl', 'gr',
    'gn', 'kn', 'ph', 'pl', 'pr', 'qu', 'rh', 'sc', 'sh', 'sk', 'sl', 'sm',
    'sn', 'sp', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr',
    'sch', 'scr', 'shr', 'spl', 'spr', 'squ', 'str', 'thr', 'phr', 'chr'
  ]);

  // Monosyllabic function words. [EST] function words reduce in connected
  // speech; [HEUR "function-word rule"] this specific list and its blanket
  // Tier-3 demotion (contrastive stress is NOT modeled — design §12).
  const FUNCTION_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'nor', 'of', 'to', 'in', 'on',
    'at', 'by', 'for', 'with', 'from', 'as', 'if', 'that', 'than', 'then',
    'this', 'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her',
    'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'is', 'am',
    'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'has', 'had',
    'have', 'will', 'would', 'shall', 'should', 'can', 'could', 'may',
    'might', 'must', 'not', 'no', 'so', 'up', 'through', 'though', 'when', 'while', 'who',
    'whom', 'whose', 'which', 'what', 'there', 'here', 'some', 'such'
  ]);

  // Words (function words + polysyllabic prepositions/conjunctions/aux)
  // that may OPEN a phonological phrase. [HEUR "phi-chunk-starter"]
  const CHUNK_STARTERS = new Set([
    ...FUNCTION_WORDS,
    'before', 'after', 'between', 'above', 'below', 'under', 'over',
    'because', 'although', 'though', 'unless', 'until', 'during',
    'against', 'without', 'within', 'across', 'behind', 'beyond',
    'about', 'around', 'toward', 'towards', 'upon', 'into', 'onto'
  ]);

  // Stress-relevant suffixes for OOV words and for orthographic suffix
  // integrity. [HEUR "suffix rules"] — approximations of well-known
  // English stress-determining morphology.
  const NEUTRAL_SUFFIXES = ['ing', 'ed', 'er', 'ly', 'ness', 'ful', 'less', 'es', 's', 'y', 'ic'];
  // (-ic is stress-determining for STRESS but kept intact orthographically.)

  // Conventional-hyphenation exception table. [HEUR "display-hyphenation
  // exceptions"] Orthographic syllabification has no single ground truth
  // (design §13); these entries follow dictionary/spec convention where the
  // general rules would produce a different (also defensible) division.
  // Affects hyphen DISPLAY only — never stress, templates, or rhythm.
  const HYPHEN_EXCEPTIONS = {
    'photographer': ['pho', 'tog', 'ra', 'pher']
  };

  // Confidence table (design §10). [HEUR] Scores are heuristic, not
  // calibrated probabilities.
  const CONF = {
    CMU_SINGLE: 0.97,
    CMU_VARIANTS_SAME: 0.95,
    CMU_VARIANTS_DIFF: 0.70,
    ALIGN_FORCED_PENALTY: 0.10,
    FUNCTION_WORD: 0.75,
    CONTENT_MONO: 0.85,
    NUCLEAR: 0.80,                // phrase-final nuclear accent (NSR)
    SECONDARY_RESOLUTION: 0.90,   // template-level: secondary resolved by rule
    SUFFIX_RULE: 0.70,
    DISYLLABIC_DEFAULT: 0.55,
    TRISYLLABIC_DEFAULT: 0.45,
    LONG_DEFAULT: 0.40,
    IP_PUNCT: 0.90,
    PHI_CHUNK: 0.60,
    PHI_LENGTH_SPLIT: 0.40,
    USER: 1.00
  };

  /* ==========================================================================
   * SECTION 1 — Tokenizer
   * Lossless: concatenating token.text reproduces the input exactly.
   * ======================================================================== */

  // A word = letters plus internal apostrophes/hyphens (don't, mother-in-law).
  const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*/y;

  function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      // paragraph break: blank-line sequence
      const para = /^(\r?\n[ \t]*\r?\n[\s]*)/.exec(text.slice(i));
      if (para) {
        tokens.push({ type: 'parabreak', text: para[1] });
        i += para[1].length;
        continue;
      }
      const ws = /^[ \t\r\n]+/.exec(text.slice(i));
      if (ws) {
        tokens.push({ type: 'space', text: ws[0] });
        i += ws[0].length;
        continue;
      }
      WORD_RE.lastIndex = 0;
      const w = WORD_RE.exec(text.slice(i));
      if (w && w.index === 0) {
        tokens.push({ type: 'word', text: w[0] });
        i += w[0].length;
        continue;
      }
      // anything else: one punctuation/symbol character
      tokens.push({ type: 'punct', text: text[i] });
      i += 1;
    }
    return tokens;
  }

  /* ==========================================================================
   * SECTION 2 — Dictionary lookup (Tier 1 source A)
   * ======================================================================== */

  let DICT = null;          // { WORD: "PH ON EMES|variant|..." }
  let DICT_SOURCE = 'none'; // 'full' | 'subset' | 'none'

  function loadDictionary(dictObj, sourceLabel) {
    DICT = dictObj || null;
    DICT_SOURCE = DICT ? (sourceLabel || 'full') : 'none';
  }

  function normalizeWord(orth) {
    return orth.toUpperCase().replace(/’/g, "'");
  }

  // Returns { prons: [ [phone,...], ... ], confidence, source } or null.
  function lookupCMU(orth) {
    if (!DICT) return null;
    const key = normalizeWord(orth);
    let raw = DICT[key];
    let usedKey = key;
    // possessive fallback: PUPPY'S → PUPPY + Z (display syllables unaffected)
    if (!raw && key.endsWith("'S") && DICT[key.slice(0, -2)]) {
      usedKey = key.slice(0, -2);
      raw = DICT[usedKey].split('|').map(p => p + ' Z').join('|');
    }
    if (!raw) return null;
    const prons = raw.split('|').map(p => p.trim().split(/\s+/));
    // Variant handling (design §4): all stored; first is default;
    // stress-divergent variants lower confidence.
    let confidence = CONF.CMU_SINGLE;
    if (prons.length > 1) {
      const patterns = new Set(prons.map(p => stressPatternOf(p)));
      confidence = patterns.size > 1 ? CONF.CMU_VARIANTS_DIFF : CONF.CMU_VARIANTS_SAME;
    }
    return { prons, confidence, source: 'CMU' };
  }

  function stressPatternOf(phones) {
    return phones
      .filter(p => VOWELS.has(p.replace(/\d/, '')))
      .map(p => (p.match(/\d/) || ['0'])[0])
      .join('');
  }

  /* ==========================================================================
   * SECTION 3 — Phonemic syllabifier (Maximal Onset Principle)  [EST]
   * ======================================================================== */

  function syllabifyPhonemes(phones) {
    const nuclei = [];
    phones.forEach((p, idx) => {
      if (VOWELS.has(p.replace(/\d/, ''))) nuclei.push(idx);
    });
    if (nuclei.length === 0) return null; // no vowel: not syllabifiable
    const sylls = [];
    let start = 0;
    for (let n = 0; n < nuclei.length; n++) {
      const isLast = n === nuclei.length - 1;
      let end;
      if (isLast) {
        end = phones.length;
      } else {
        // consonants strictly between nucleus n and nucleus n+1
        const cluster = phones.slice(nuclei[n] + 1, nuclei[n + 1]);
        // Maximal Onset: longest legal suffix of the cluster becomes the
        // next syllable's onset.
        let onsetLen = 0;
        for (let take = cluster.length; take >= 0; take--) {
          const cand = cluster.slice(cluster.length - take)
            .map(p => p.replace(/\d/, '')).join(' ');
          if (take === 0 || LEGAL_ONSETS.has(cand)) { onsetLen = take; break; }
        }
        end = nuclei[n + 1] - onsetLen;
      }
      sylls.push(phones.slice(start, end));
      start = end;
    }
    return sylls; // array of phoneme arrays, one per syllable
  }

  /* ==========================================================================
   * SECTION 4 — Orthographic aligner  [HEUR "orthographic alignment"]
   * Maps N phonemic syllables onto spelling spans. Affects hyphen display
   * only. On forced merges/splits, sets alignmentForced (confidence penalty).
   * ======================================================================== */

  function isVowelLetter(ch) { return 'aeiouy'.includes(ch); }

  // Find vowel-group spans [start,end) in a lowercase word. [HEUR]
  //  - 'qu' is a consonant unit (quiet, quickly)
  //  - y is a consonant word-initially (yes) and intervocalically (beyond),
  //    vocalic otherwise (happy, away — where 'ay' is a digraph, one group)
  function vowelGroups(word) {
    const groups = [];
    let i = 0;
    const yIsConsonantAt = (k) =>
      word[k] === 'y' &&
      (k === 0 || (k + 1 < word.length && isVowelLetter(word[k + 1])));
    while (i < word.length) {
      if (word[i] === 'q' && word[i + 1] === 'u') { i += 2; continue; }
      if (isVowelLetter(word[i]) && !yIsConsonantAt(i)) {
        let j = i;
        while (j < word.length && isVowelLetter(word[j]) && !yIsConsonantAt(j)) j++;
        groups.push([i, j]);
        i = j;
      } else i++;
    }
    return groups;
  }

  // Orthographic suffixes kept intact at syllable boundaries (min length 2).
  // [HEUR "suffix-integrity"] — display only. A suffix cut applies only when
  // the residual stem is itself a dictionary word (morphological reality
  // check: photograph+ic yes, fabr+ic no, decemb+er no).
  const ORTHO_SUFFIXES = ['tion', 'sion', 'ness', 'less', 'ing', 'ful',
                          'ly', 'er', 'ed', 'ic', 'es'];

  // Lax (checked) vowels cannot end a stressed open syllable [EST —
  // phonotactics of English; cf. Selkirk on stress-sensitive syllable
  // structure]. Used by the closure rule in orthoSyllabify.
  const LAX_VOWELS = new Set(['IH', 'EH', 'AE', 'AH', 'UH']);
  const ORTHO_DIGRAPHS = new Set(['th', 'sh', 'ch', 'ph', 'wh', 'ck', 'ng']);

  // Split N-1 boundaries for a word given target syllable count N.
  // Returns array of N strings, or null on failure.
  function orthoSyllabify(orth, N, sylInfo) {
    const word = orth.toLowerCase();
    const exc = HYPHEN_EXCEPTIONS[word];
    if (exc && exc.length === N) return { sylls: exc.slice(), forced: false };
    if (N === 1) return { sylls: [word], forced: false };

    let groups = vowelGroups(word);
    let forced = false;

    // C+le ending: final syllable is C+"le" (table, little, possible).
    let cleTail = null;
    if (/[^aeiou]le$/.test(word) && N >= 2) {
      cleTail = word.slice(-3); // e.g. "ble", "tle"
      // remove any group inside the tail
      const tailStart = word.length - 3;
      groups = groups.filter(g => g[1] <= tailStart);
      // recurse on the head for N-1 syllables
      const head = word.slice(0, tailStart);
      const headRes = orthoSyllabify(head, N - 1, sylInfo ? sylInfo.slice(0, N - 1) : null);
      if (headRes) return { sylls: [...headRes.sylls, cleTail], forced: headRes.forced };
      return { sylls: [head, cleTail], forced: true };
    }

    // Silent-e adjustments when we have too many groups:
    //  (a) word-final e after a consonant (above, arise, believe)
    //  (b) final -ed after non-t/d consonant (noticed)
    //  (c) word-internal e before a consonant (carefully) — last resort
    const drop = (pred) => {
      for (let gi = groups.length - 1; gi >= 0 && groups.length > N; gi--) {
        if (pred(groups[gi], gi)) groups.splice(gi, 1);
      }
    };
    if (groups.length > N) {
      drop(([s, e]) => word.slice(s, e) === 'e' && e === word.length &&
                       s > 0 && !isVowelLetter(word[s - 1]));           // (a)
      if (groups.length > N)
        drop(([s, e]) => word.slice(s, e) === 'e' && e === word.length - 1 &&
                         word.endsWith('ed'));                          // (b)
      if (groups.length > N)
        drop(([s, e], gi) => word.slice(s, e) === 'e' && gi > 0 &&
                             e < word.length && !isVowelLetter(word[e])); // (c)
    }
    // Too few groups: split a multi-letter group (qui·et).
    while (groups.length < N) {
      const gi = groups.findIndex(([s, e]) => e - s > 1);
      if (gi === -1) { forced = true; break; }
      const [s, e] = groups[gi];
      groups.splice(gi, 1, [s, s + 1], [s + 1, e]);
    }
    // Still mismatched: force-merge extras. [confidence penalty]
    while (groups.length > N) { groups.pop(); forced = true; }
    if (groups.length !== N) {
      // give up gracefully: even split
      return { sylls: evenSplit(word, N), forced: true };
    }

    // Place boundaries in each intervocalic consonant span.
    // Three ordered rules [HEUR — display only, design §4]:
    //   1. doubles: split between double letters       (hap·py, run·ning)
    //   2. suffix-integrity: if a recognized suffix begins inside this
    //      span, cut at the suffix start                (morn·ing, ri·ly,
    //      graph·ic, za·tion, ti·ful, quick·ly)
    //   3. maximal orthographic onset                    (gar·den, chil·dren)
    const cuts = []; // absolute indices where a syllable boundary falls
    for (let g = 0; g < N - 1; g++) {
      const cStart = groups[g][1];        // first consonant after group g
      const cEnd = groups[g + 1][0];      // start of next vowel group
      const cluster = word.slice(cStart, cEnd);
      let cut = null;

      const dbl = cluster.match(/(.)\1/); // rule 1: doubles
      if (dbl) {
        cut = cStart + cluster.indexOf(dbl[0]) + 1;
      } else {
        for (const sfx of ORTHO_SUFFIXES) { // rule 2: suffix-integrity,
          const p = word.length - sfx.length; // gated by stem reality
          if (word.endsWith(sfx) && p >= cStart && p <= cEnd &&
              DICT && DICT[word.slice(0, p).toUpperCase()]) { cut = p; break; }
        }
        if (cut === null) {                 // rule 3: maximal onset
          const onset = onsetOf(cluster);
          cut = cEnd - onset.length;
        }
      }
      // rule 4: lax closure [EST] — a stressed lax vowel cannot end an
      // open syllable (*ru·sty, *fa·bric); pull one consonant (or a whole
      // digraph: meth·od, gath·er) into the coda.
      const info = sylInfo ? sylInfo[g] : null;
      if (info && info.stressed && info.lax && cut === cStart &&
          cEnd > cStart) {
        const take = ORTHO_DIGRAPHS.has(word.slice(cStart, cStart + 2))
          ? 2 : 1;
        cut = Math.min(cStart + take, cEnd);
      }
      cuts.push(Math.min(Math.max(cut, cStart), cEnd));
    }

    const sylls = [];
    let prev = 0;
    for (const c of cuts) { sylls.push(word.slice(prev, c)); prev = c; }
    sylls.push(word.slice(prev));
    if (sylls.some(s => s.length === 0)) return { sylls: evenSplit(word, N), forced: true };
    return { sylls, forced };
  }

  function onsetOf(cluster) {
    for (let take = Math.min(3, cluster.length); take >= 1; take--) {
      const cand = cluster.slice(cluster.length - take);
      if (ORTHO_ONSETS.has(cand)) return cand;
    }
    return '';
  }

  function evenSplit(word, N) {
    const size = Math.ceil(word.length / N);
    const out = [];
    for (let i = 0; i < N; i++) out.push(word.slice(i * size, (i + 1) * size));
    return out.filter(s => s.length);
  }

  /* ==========================================================================
   * SECTION 5 — Fallback analyzer (OOV words)  [HEUR — design §5]
   * Ordered, named rules; every result tagged source:"heuristic" + rule name.
   * ======================================================================== */

  // Count syllables orthographically (vowel groups w/ silent-e adjustments).
  function fallbackSyllableCount(word) {
    let groups = vowelGroups(word).length;
    if (/[^aeiou]le$/.test(word)) { /* C+le keeps its e syllabic */ }
    else if (/e$/.test(word) && groups > 1 && !isVowelLetter(word[word.length - 2]))
      groups -= 1; // silent final e
    if (/[^td]ed$/.test(word) && groups > 1) groups -= 1; // silent -ed
    return Math.max(1, groups);
  }

  // Stress-determining suffix rules. Returns {pattern, rule, confidence}|null.
  function suffixStress(word, N) {
    const pre = (idx) => {           // stress syllable at index idx (0-based)
      const p = new Array(N).fill('0'); p[idx] = '1'; return p.join('');
    };
    const tests = [
      { re: /(tion|sion|cian)s?$/, place: (n) => pre(Math.max(0, n - 2)), name: 'suffix:-tion' },
      { re: /(ic|ical|ics)$/,      place: (n) => pre(Math.max(0, n - 2)), name: 'suffix:-ic' },
      { re: /(ity|ety)$/,          place: (n) => pre(Math.max(0, n - 3)), name: 'suffix:-ity' },
      { re: /(ee|eer|ese|esque)$/, place: (n) => pre(n - 1),              name: 'suffix:-ee' }
    ];
    for (const t of tests) {
      if (t.re.test(word) && N >= 2) {
        return { pattern: t.place(N), rule: t.name, confidence: CONF.SUFFIX_RULE };
      }
    }
    return null;
  }

  function fallbackAnalyze(orth) {
    const word = orth.toLowerCase().replace(/[^a-z']/g, '');
    const N = fallbackSyllableCount(word);
    let pattern, rule, confidence;

    if (N === 1) {
      pattern = '1'; rule = 'monosyllable-default'; confidence = CONF.CONTENT_MONO;
    } else {
      const sfx = suffixStress(word, N);
      if (sfx) {
        ({ pattern, rule, confidence } = sfx);
      } else if (N === 2) {
        pattern = '10'; rule = 'disyllabic-default';          // [HEUR] most
        confidence = CONF.DISYLLABIC_DEFAULT;                 // disyllables
      } else if (N === 3) {                                   // are trochaic
        pattern = '100'; rule = 'trisyllabic-default';
        confidence = CONF.TRISYLLABIC_DEFAULT;
      } else {
        // antepenultimate primary + alternating secondary two to the left
        const p = new Array(N).fill('0');
        p[N - 3] = '1';
        if (N - 5 >= 0) p[N - 5] = '2'; else if (N - 3 - 2 < 0 && N - 3 + 2 <= N - 1) { /* none */ }
        pattern = p.join(''); rule = 'long-word-default';
        confidence = CONF.LONG_DEFAULT;
      }
    }
    const { sylls, forced } = orthoSyllabify(word, N) || { sylls: [word], forced: true };
    if (forced) confidence = Math.max(0.1, confidence - CONF.ALIGN_FORCED_PENALTY);
    return { syllTexts: sylls, phonemesBySyll: null, pattern, rule, confidence, source: 'heuristic' };
  }

  /* ==========================================================================
   * SECTION 6 — Template Assigner (Tier 2)  [SPEC — instrumented hypothesis]
   * Pattern-first representation: the S/W pattern is the primary object;
   * the traditional foot name is an educational label (design final rev).
   * ======================================================================== */

  // The rhythmic inventory is deliberately limited to the four recurring
  // English feet used by this application. A surface string such as WSW is
  // parsed across a foot boundary (for example, W + SW or WS + W); it is not
  // assigned a fifth, word-sized "amphibrach" template.
  const FOOT_NAMES = {
    'SW': 'trochee', 'WS': 'iamb', 'WWS': 'anapest', 'SWW': 'dactyl'
  };
  const CLASSICAL = new Set(['SW', 'WS', 'WWS', 'SWW']);
  const FOOT_INVENTORY = ['SW', 'WS', 'WWS', 'SWW'];

  // All resolutions of secondary stress: each '2' → 'S' or 'W'.
  function resolutions(lexPattern) {
    let outs = [''];
    for (const d of lexPattern) {
      if (d === '1') outs = outs.map(o => o + 'S');
      else if (d === '0') outs = outs.map(o => o + 'W');
      else outs = outs.flatMap(o => [o + 'S', o + 'W']); // d === '2'
    }
    // de-duplicate, remember which came from 2→S (full) vs 2→W (reduced)
    return Array.from(new Set(outs));
  }

  // DP parse of an S/W string into the four-foot inventory + singletons.
  // Costs: an English foot 1.0, singleton 1.6.
  // Returns { units: [{pattern, name}], cost } minimizing cost;
  // tie-breaks: (a) primary-stress syllable inside a classical foot,
  // (b) fewer singletons, (c) leftmost-longest.
  function parseFeet(sw, primaryIdx) {
    const n = sw.length;
    const memo = new Array(n + 1).fill(null);
    memo[n] = { units: [], cost: 0 };
    for (let i = n - 1; i >= 0; i--) {
      let best = null;
      const candidates = [];
      for (const f of FOOT_INVENTORY) {
        if (sw.startsWith(f, i)) {
          candidates.push({ pattern: f, len: f.length,
                            cost: 1.0 });
        }
      }
      candidates.push({ pattern: sw[i], len: 1, cost: 1.6 }); // singleton
      for (const c of candidates) {
        const restPart = memo[i + c.len];
        const unit = { pattern: c.pattern,
                       name: FOOT_NAMES[c.pattern] ||
                             (c.pattern === 'S' ? 'stressed syllable' : 'weak syllable') };
        const cand = { units: [unit, ...restPart.units], cost: c.cost + restPart.cost };
        if (!best || better(cand, best, i, primaryIdx)) best = cand;
      }
      memo[i] = best;
    }
    return memo[0];
  }

  function better(a, b, startIdx, primaryIdx) {
    if (a.cost !== b.cost) return a.cost < b.cost;
    const inClassical = (parse) => {
      let pos = startIdx;
      for (const u of parse.units) {
        const end = pos + u.pattern.length;
        if (primaryIdx >= pos && primaryIdx < end)
          return CLASSICAL.has(u.pattern);
        pos = end;
      }
      return false;
    };
    const ac = inClassical(a), bc = inClassical(b);
    if (ac !== bc) return ac;                                   // tie-break (a)
    const sing = (p) => p.units.filter(u => u.pattern.length === 1).length;
    if (sing(a) !== sing(b)) return sing(a) < sing(b);          // tie-break (b)
    return (a.units[0] ? a.units[0].pattern.length : 0) >
           (b.units[0] ? b.units[0].pattern.length : 0);        // tie-break (c)
  }

  function assignTemplate(lexPattern, isFunctionWord) {
    // Compound Stress Rule [EST — English compounds are left-prominent]:
    // CMU marks some compounds with multiple primaries (lifelong = 11).
    // Keep the first primary; treat later primaries as demotable
    // secondaries so the resolution machinery applies (lifelong -> trochee).
    let compoundResolved = false;
    if ((lexPattern.match(/1/g) || []).length > 1) {
      const first = lexPattern.indexOf('1');
      lexPattern = lexPattern.slice(0, first + 1) +
                   lexPattern.slice(first + 1).replace(/1/g, '2');
      compoundResolved = true;
    }
    const stamp = (t) => {
      if (compoundResolved) {
        t.assignmentRule = 'compound-stress-resolution+' + t.assignmentRule;
        t.compoundStressResolved = true;
      }
      return t;
    };
    // Monosyllables: template records the word's own (citation) shape.
    if (lexPattern.length === 1) {
      const pat = lexPattern === '0' ? 'W' : 'S';
      return stamp({
        pattern: pat,
        traditionalName: 'monosyllable',
        lexicalClass: isFunctionWord ? 'function' : 'content',
        variants: [], assignmentRule: 'monosyllable',
        confidence: 1.0, source: 'template-assigner'
      });
    }
    const primaryIdx = lexPattern.indexOf('1');
    const res = resolutions(lexPattern);

    // Rule 1 [design §3.2]: single-classical-foot preference.
    const singleClassical = res.filter(r => CLASSICAL.has(r));
    if (singleClassical.length === 1) {
      const canonical = singleClassical[0];
      const full = lexPattern.replace(/[12]/g, 'S').replace(/0/g, 'W');
      const variants = res.filter(r => r !== canonical).map(r => ({
        pattern: r,
        label: r === full ? 'full-secondary' : 'alternative',
        footing: FOOT_NAMES[r] || describeParse(parseFeet(r, primaryIdx))
      }));
      return stamp({
        pattern: canonical, traditionalName: FOOT_NAMES[canonical],
        variants,
        assignmentRule: 'single-classical-foot-preference',
        confidence: lexPattern.includes('2') ? CONF.SECONDARY_RESOLUTION : 1.0,
        source: 'template-assigner'
      });
    }
    // Rule 2: composite — pick the resolution with the cheapest parse over
    // the four English feet. Edge syllables may remain unfooted here; the
    // phrase-level projector below decides how neighboring words combine.
    let best = null;
    for (const r of res) {
      const parse = parseFeet(r, primaryIdx);
      if (!best || parse.cost < best.parse.cost) best = { r, parse };
    }
    const label = describeParse(best.parse);
    const isAtemplatic = best.parse.units.every(u => u.pattern.length === 1);
    return stamp({
      pattern: best.r,
      traditionalName: isAtemplatic ? 'atemplatic' : 'composite: ' + label,
      footing: best.parse.units.map(u => u.pattern),
      variants: res.filter(r => r !== best.r).map(r => ({
        pattern: r, label: 'alternative',
        footing: describeParse(parseFeet(r, primaryIdx))
      })),
      assignmentRule: isAtemplatic ? 'atemplatic-fallback' : 'composite-min-cost',
      confidence: (lexPattern.includes('2') ? CONF.SECONDARY_RESOLUTION : 1.0) *
                  (isAtemplatic ? 0.7 : 0.9),
      source: 'template-assigner'
    });
  }

  function describeParse(parse) {
    return parse.units.map(u => FOOT_NAMES[u.pattern] || u.pattern).join('+');
  }

  /* ==========================================================================
   * SECTION 7 — Word analysis (assembles Tier 1 + Tier 2 for one word)
   * ======================================================================== */

  function analyzeWord(orth) {
    const normalized = orth.toLowerCase().replace(/’/g, "'");
    const isFn = FUNCTION_WORDS.has(normalized);
    const cmu = lookupCMU(orth);
    let syllTexts, phonemesBySyll, lexPattern, lexSource, lexConf, rule = null;
    let alternates = [];

    if (cmu) {
      const phones = cmu.prons[0];
      const phonSylls = syllabifyPhonemes(phones);
      if (phonSylls) {
        lexPattern = stressPatternOf(phones);
        const sylInfo = phonSylls.map(ph => {
          const v = ph.find(p => VOWELS.has(p.replace(/\d/, '')));
          return { stressed: /[12]/.test(v || ''),
                   lax: v ? LAX_VOWELS.has(v.replace(/\d/, '')) : false };
        });
        const ortho = orthoSyllabify(normalized.replace(/[^a-z']/g, ''), phonSylls.length, sylInfo);
        syllTexts = ortho.sylls;
        phonemesBySyll = phonSylls;
        lexSource = 'CMU';
        lexConf = cmu.confidence - (ortho.forced ? CONF.ALIGN_FORCED_PENALTY : 0);
        alternates = cmu.prons.slice(1).map(p => ({
          phonemes: p, pattern: stressPatternOf(p)
        }));
      }
    }
    // Hyphenated compounds: analyze each component separately (design §4),
    // preserving the hyphen in the display and letting the Compound Stress
    // Rule resolve the resulting multiple primaries (MYRiad-wear).
    if (!syllTexts && normalized.includes('-')) {
      const parts = orth.split('-').filter(p => p.length);
      if (parts.length > 1) {
        const analyses = parts.map(p => analyzeWord(p));
        syllTexts = [];
        phonemesBySyll = [];
        lexPattern = '';
        lexConf = 1;
        let allCMU = true;
        analyses.forEach((a, ai) => {
          a.syllables.forEach((sy, i) => {
            const last = i === a.syllables.length - 1 &&
                         ai < analyses.length - 1;
            syllTexts.push(sy.text + (last ? '-' : ''));
            phonemesBySyll.push(sy.phonemes);
          });
          lexPattern += a.lexicalPattern;
          lexConf = Math.min(lexConf, a.lexicalConfidence);
          if (a.lexicalSource !== 'CMU') allCMU = false;
        });
        if (phonemesBySyll.some(p => !p)) phonemesBySyll = null;
        lexSource = allCMU ? 'CMU' : 'heuristic';
        rule = 'hyphenated-compound';
        lexConf = round2(lexConf * 0.95);
      }
    }
    if (!syllTexts) {
      const fb = fallbackAnalyze(orth);
      syllTexts = fb.syllTexts;
      phonemesBySyll = fb.phonemesBySyll;
      lexPattern = fb.pattern;
      lexSource = fb.source;
      lexConf = fb.confidence;
      rule = fb.rule;
    }

    const template = assignTemplate(lexPattern, isFn);

    const syllables = syllTexts.map((t, i) => ({
      text: t,
      phonemes: phonemesBySyll ? phonemesBySyll[i] : null,
      lexicalStress: lexPattern[i] || '0',
      rhythmicStress: null,          // filled by the Rhythmic Projector
      rhythmicSource: null,
      rhythmicConfidence: null
    }));

    return {
      word: orth,
      normalized,
      isFunctionWord: isFn,
      hasStressVariants: alternates.some(a => a.pattern !== lexPattern),
      syllables,
      lexicalPattern: lexPattern,
      lexicalSource: lexSource,
      lexicalRule: rule,
      lexicalConfidence: round2(lexConf),
      template,
      rhythmicPattern: null,
      alternates,
      userEdited: { lexical: false, template: false, rhythmic: false },
      editHistory: []
    };
  }

  /* ==========================================================================
   * SECTION 8 — Prosodic Chunker (IP and φ)  [design §7]
   * ======================================================================== */

  const IP_PUNCT = new Set(['.', '!', '?', ';', ':', ',', '—', '–', '(', ')', '"', '“', '”']);
  const PHI_MAX_WORDS = 4; // [HEUR "phi-length-cap"]

  // wordTokenIdxs: indices into doc.words, in order; ipBreaksAfter: set of
  // word indices after which an IP boundary falls (from punctuation).
  function chunk(words, ipBreaksAfter) {
    const ips = [];
    let ipStart = 0;
    for (let w = 0; w < words.length; w++) {
      if (ipBreaksAfter.has(w) || w === words.length - 1) {
        ips.push(buildIP(words, ipStart, w));
        ipStart = w + 1;
      }
    }
    return ips;
  }

  function buildIP(words, start, end) {
    // φ chunking [HEUR "phi-chunk-starter"]: open a new φ at a chunk-starter
    // word that follows at least one content word in the current φ.
    // "Content" here = not a chunk starter (so "before the children" stays
    // one chunk: 'before' opens it, 'the' does not re-split).
    const phis = [];
    let phiStart = start;
    let sawContent = false;
    for (let w = start; w <= end; w++) {
      const wd = words[w];
      const starter = CHUNK_STARTERS.has(wd.normalized);
      if (starter && sawContent && w > phiStart) {
        phis.push({ span: [phiStart, w - 1], confidence: CONF.PHI_CHUNK,
                    source: 'function-word-chunking', userEdited: false });
        phiStart = w; sawContent = false;
      }
      if (!starter) sawContent = true;
    }
    phis.push({ span: [phiStart, end], confidence: CONF.PHI_CHUNK,
                source: 'function-word-chunking', userEdited: false });

    // Length cap [HEUR "phi-length-cap"]: split oversized φ at the
    // content–content joint nearest the middle (later joint wins ties).
    const capped = [];
    for (const phi of phis) {
      let [s, e] = phi.span;
      while (e - s + 1 > PHI_MAX_WORDS) {
        const isContent = (j) => !CHUNK_STARTERS.has(words[j].normalized);
        const joints = [];
        for (let j = s; j < e; j++) joints.push(j);
        const ccJoints = joints.filter(j => isContent(j) && isContent(j + 1));
        const pool = ccJoints.length ? ccJoints : joints;
        const mid = (s + e) / 2;
        let bestJ = pool[0], bestDist = Infinity;
        for (const j of pool) {
          const d = Math.abs(j + 0.5 - mid);
          if (d <= bestDist) { bestDist = d; bestJ = j; } // later wins ties
        }
        capped.push({ span: [s, bestJ], confidence: CONF.PHI_LENGTH_SPLIT,
                      source: 'length-cap-split', userEdited: false });
        s = bestJ + 1;
      }
      capped.push({ ...phi, span: [s, e] });
    }
    return { type: 'IP', span: [start, end], confidence: CONF.IP_PUNCT,
             source: 'punctuation', children: capped, userEdited: false };
  }

  /* ==========================================================================
   * SECTION 9 — Phrase-level Rhythmic Projector (Tier 3)  [design §6]
   * Fits the continuous syllable stream inside each φ to the four English
   * rhythmic feet: SW, WS, WWS, and SWW. Lexical stress supplies weighted
   * preferences; it does not force every word to behave like a complete foot.
   * A single weak/strong syllable may remain at a phrase edge (pickup or tail),
   * because ordinary prose and short fragments do not always begin and end on
   * complete feet. Feet never cross a φ boundary.
   * ======================================================================== */

  const RHYTHM_FEET = [
    { pattern: 'SW', name: 'trochee' },
    { pattern: 'WS', name: 'iamb' },
    { pattern: 'WWS', name: 'anapest' },
    { pattern: 'SWW', name: 'dactyl' }
  ];
  const LEADING_RESIDUE_COST = 0.55;
  const TRAILING_RESIDUE_COST = 0.65;
  const FOOT_SWITCH_COST = 0.08;
  const SAME_BOUNDARY_COST = 0.12;

  // Build the preferred realization for one syllable before phrase footing.
  // Primary lexical stress is the strongest anchor. Unstressed syllables in
  // polysyllabic words resist promotion more than free-standing function or
  // content monosyllables resist contextual adjustment.
  function rhythmPreference(wd, i) {
    const sy = wd.syllables[i];
    if (wd.userEdited.rhythmic && sy.rhythmicStress) {
      return { value: sy.rhythmicStress, weight: 1000,
               confidence: CONF.USER, source: 'user' };
    }
    if (wd.syllables.length === 1) {
      return wd.isFunctionWord
        ? { value: 'W', weight: 1.2, confidence: CONF.FUNCTION_WORD,
            source: 'rule:function-word-demotion' }
        : { value: 'S', weight: 1.6, confidence: CONF.CONTENT_MONO,
            source: 'rule:content-monosyllable' };
    }
    const templ = wd.template.pattern[i] ||
      (sy.lexicalStress === '0' ? 'W' : 'S');
    const weight = sy.lexicalStress === '1' ? 6.0
      : sy.lexicalStress === '2' ? 2.5 : 3.5;
    return { value: templ, weight,
             confidence: Math.min(wd.lexicalConfidence, wd.template.confidence),
             source: 'rule:lexical-template-preference' };
  }

  function unitMismatch(stream, pos, pattern) {
    let cost = 0, primaryMismatches = 0;
    for (let k = 0; k < pattern.length; k++) {
      const item = stream[pos + k];
      if (item.pref.value !== pattern[k]) {
        cost += item.pref.weight;
        if (item.sy.lexicalStress === '1') primaryMismatches++;
      }
    }
    return { cost, primaryMismatches };
  }

  function betterRhythmFit(a, b) {
    if (!b) return true;
    if (Math.abs(a.cost - b.cost) > 1e-9) return a.cost < b.cost;
    if (a.primaryMismatches !== b.primaryMismatches)
      return a.primaryMismatches < b.primaryMismatches;
    if (a.residues !== b.residues) return a.residues < b.residues;
    if (a.switches !== b.switches) return a.switches < b.switches;
    // Prefer analyses with a leading pickup over a dangling final syllable.
    if (a.trailingResidues !== b.trailingResidues)
      return a.trailingResidues < b.trailingResidues;
    return a.units.length < b.units.length;
  }

  // Fit complete feet from `start`; only one trailing edge syllable may remain.
  function fitFrom(stream, start, previousLast, previousFoot) {
    const n = stream.length;
    const memo = new Map();
    const solve = (i, prevLast, prevFoot) => {
      const key = i + '|' + (prevLast || '-') + '|' + (prevFoot || '-');
      if (memo.has(key)) return memo.get(key);
      if (i === n) {
        const done = { units: [], cost: 0, primaryMismatches: 0,
                       residues: 0, trailingResidues: 0, switches: 0 };
        memo.set(key, done); return done;
      }
      let best = null;
      if (i === n - 1) {
        const item = stream[i];
        best = {
          units: [{ type: 'trailing', pattern: item.pref.value,
                    span: [item.ref], cost: TRAILING_RESIDUE_COST }],
          cost: TRAILING_RESIDUE_COST,
          primaryMismatches: 0, residues: 1, trailingResidues: 1, switches: 0
        };
      }
      for (const foot of RHYTHM_FEET) {
        if (i + foot.pattern.length > n) continue;
        const local = unitMismatch(stream, i, foot.pattern);
        const boundary = prevLast && prevLast === foot.pattern[0]
          ? SAME_BOUNDARY_COST : 0;
        const switched = prevFoot && prevFoot !== foot.name ? 1 : 0;
        const switchCost = switched ? FOOT_SWITCH_COST : 0;
        const rest = solve(i + foot.pattern.length,
                           foot.pattern[foot.pattern.length - 1], foot.name);
        const cand = {
          units: [{ type: foot.name, pattern: foot.pattern,
                    span: stream.slice(i, i + foot.pattern.length).map(x => x.ref),
                    cost: round2(local.cost + boundary + switchCost) },
                  ...rest.units],
          cost: local.cost + boundary + switchCost + rest.cost,
          primaryMismatches: local.primaryMismatches + rest.primaryMismatches,
          residues: rest.residues,
          trailingResidues: rest.trailingResidues,
          switches: switched + rest.switches
        };
        if (betterRhythmFit(cand, best)) best = cand;
      }
      memo.set(key, best); return best;
    };
    return solve(start, previousLast, previousFoot);
  }

  function fitPhraseRhythm(stream) {
    if (!stream.length) return { units: [], cost: 0 };
    if (stream.length === 1) {
      const item = stream[0];
      return { units: [{ type: 'isolated', pattern: item.pref.value,
                         span: [item.ref], cost: 0 }], cost: 0,
               primaryMismatches: 0, residues: 1,
               trailingResidues: 0, switches: 0 };
    }
    let best = fitFrom(stream, 0, null, null);
    // Also test an initial pickup. This is especially important for lexical
    // WSW sequences: the first W can be a pickup and the remaining SW a
    // trochee, rather than inventing a fifth three-syllable foot.
    if (stream.length >= 3) {
      const first = stream[0];
      const rest = fitFrom(stream, 1, first.pref.value, null);
      const withPickup = {
        units: [{ type: 'pickup', pattern: first.pref.value,
                  span: [first.ref], cost: LEADING_RESIDUE_COST }, ...rest.units],
        cost: LEADING_RESIDUE_COST + rest.cost,
        primaryMismatches: rest.primaryMismatches,
        residues: 1 + rest.residues,
        trailingResidues: rest.trailingResidues,
        switches: rest.switches
      };
      if (betterRhythmFit(withPickup, best)) best = withPickup;
    }
    return best;
  }

  function project(words, ips, config) {
    for (const ip of ips) {
      for (const phi of ip.children) {
        const [s, e] = phi.span;
        const stream = [];
        for (let w = s; w <= e; w++) {
          const wd = words[w];
          wd.syllables.forEach((sy, i) => stream.push({
            wd, sy, i, ref: [w, i], pref: rhythmPreference(wd, i)
          }));
        }
        const fit = fitPhraseRhythm(stream);
        phi.rhythmicFeet = fit.units;
        phi.rhythmicCost = round2(fit.cost || 0);

        for (const unit of fit.units) {
          unit.span.forEach((ref, k) => {
            const [w, i] = ref;
            const wd = words[w];
            // Preserve the user's word-level rhythmic edit exactly as the
            // previous engine did; the fitted unit remains diagnostic only.
            if (wd.userEdited.rhythmic) return;
            const item = stream.find(x => x.ref[0] === w && x.ref[1] === i);
            const val = unit.pattern[k] || item.pref.value;
            const matched = val === item.pref.value;
            const source = ['pickup', 'trailing', 'isolated'].includes(unit.type)
              ? 'rule:phrase-edge-residue'
              : 'rule:phrase-foot-' + unit.type;
            const confidence = matched
              ? item.pref.confidence
              : Math.min(0.60, item.pref.confidence);
            setRhythm(wd, i, val, source, confidence);
          });
        }

        // Optional post-projection adjustments remain available for research
        // comparisons, but are OFF by default because they can disrupt a foot.
        if (config.strictAlternation) applyStrictAlternation(words, s, e);
        if (config.clashSubordination) applyClashSubordination(words, s, e);
      }
      if (config.nuclearStress) applyNuclearStress(words, ip);
    }
    for (const wd of words) {
      wd.rhythmicPattern = wd.syllables.map(sy => sy.rhythmicStress).join('');
    }
  }

  function setRhythm(wd, i, val, source, conf) {
    const sy = wd.syllables[i];
    sy.rhythmicStress = val;
    sy.rhythmicSource = source;
    sy.rhythmicConfidence = round2(conf);
  }

  function applyClashSubordination(words, s, e) {
    const stream = [];
    for (let w = s; w <= e; w++)
      words[w].syllables.forEach((sy, i) =>
        stream.push({ w, i, sy, word: words[w] }));
    for (let k = 0; k < stream.length - 1; k++) {
      const cur = stream[k], nxt = stream[k + 1];
      if (cur.sy.rhythmicStress === 'S' && nxt.sy.rhythmicStress === 'S' &&
          cur.word.syllables.length === 1 &&
          !cur.word.userEdited.rhythmic && !cur.word.isFunctionWord) {
        setRhythm(cur.word, cur.i, 'W', 'rule:clash-subordination', 0.60);
      }
    }
  }

  function applyStrictAlternation(words, s, e) {
    const stream = [];
    for (let w = s; w <= e; w++)
      words[w].syllables.forEach((sy, i) => stream.push({ w, i, sy, word: words[w] }));
    for (let k = 0; k < stream.length; k++) {
      const cur = stream[k];
      if (cur.sy.rhythmicStress === 'S' && cur.sy.lexicalStress === '2') {
        const left = stream[k - 1], right = stream[k + 1];
        if ((left && left.sy.rhythmicStress === 'S') ||
            (right && right.sy.rhythmicStress === 'S')) {
          setRhythm(cur.word, cur.i, 'W', 'rule:strict-alternation', 0.60);
        }
      }
    }
  }

  /* Nuclear Stress Rule (NSR).  Per intonational phrase, the main (nuclear)
   * accent falls on the last content word — hence "the final word tends to be
   * stressed" [Chomsky & Halle 1968; Liberman 1975; Liberman & Prince 1977].
   * We mark that word's primary-stress syllable as the IP nucleus and, if
   * footing left it weak, promote it to strong so the phrase does not end
   * unaccented. This is a tendency, not a law: narrow focus or given/new
   * structure can shift the nucleus leftward, so it is a gated pass and never
   * overrides a user's own rhythmic edit.  A single flat marker (`sy.nuclear`)
   * plus `ip.nucleus` lets the UI highlight the phrase's strongest beat. */
  function applyNuclearStress(words, ip) {
    const [start, end] = ip.span;
    if (end < start) return;
    // Rightmost content word (function words reduce and do not take the nucleus
    // in neutral prosody); fall back to the last word if the IP is all-function.
    let nw = -1;
    for (let w = end; w >= start; w--) {
      if (!words[w].isFunctionWord) { nw = w; break; }
    }
    if (nw === -1) nw = end;
    const wd = words[nw];
    // Nuclear syllable = primary lexical stress; else the rightmost strong
    // syllable; else the last syllable.
    let ns = wd.syllables.findIndex(sy => sy.lexicalStress === '1');
    if (ns === -1) {
      for (let i = wd.syllables.length - 1; i >= 0; i--) {
        if (wd.syllables[i].rhythmicStress === 'S') { ns = i; break; }
      }
    }
    if (ns === -1) ns = wd.syllables.length - 1;
    if (ns < 0) return;
    if (!wd.userEdited.rhythmic && wd.syllables[ns].rhythmicStress !== 'S') {
      setRhythm(wd, ns, 'S', 'rule:nuclear-stress', CONF.NUCLEAR);
    }
    wd.syllables[ns].nuclear = true;
    ip.nucleus = { word: nw, syllable: ns, ref: [nw, ns],
                   source: 'rule:nuclear-stress' };
  }

  /* ==========================================================================
   * SECTION 10 — Meter Detector  [design §9]
   * DP foot parse over the rhythmic tier, per IP (feet never cross an IP).
   * Mismatch costs weighted by rhythmic confidence. Near-optimal alternative
   * parses retained; alternation ambiguity reported honestly.
   * ======================================================================== */

  const METRICAL_FEET = RHYTHM_FEET;
  const SINGLETON_COST = 0.55;
  const AMBIGUITY_MARGIN = 0.6;

  function meterParseIP(stream) {
    // stream: [{sw, conf, ref:[w,i]}]; DP over positions.
    const n = stream.length;
    const memo = new Array(n + 1).fill(null);
    memo[n] = { feet: [], cost: 0 };
    for (let i = n - 1; i >= 0; i--) {
      let best = null;
      for (const f of METRICAL_FEET) {
        if (i + f.pattern.length > n) continue;
        let cost = 0;
        for (let k = 0; k < f.pattern.length; k++) {
          if (stream[i + k].sw !== f.pattern[k]) cost += stream[i + k].conf;
        }
        const rest = memo[i + f.pattern.length];
        const cand = { feet: [{ type: f.name, pattern: f.pattern, cost,
                                span: stream.slice(i, i + f.pattern.length).map(s => s.ref) },
                              ...rest.feet],
                       cost: cost + rest.cost };
        if (!best || cand.cost < best.cost) best = cand;
      }
      // singleton escape
      {
        const rest = memo[i + 1];
        const cand = { feet: [{ type: stream[i].sw === 'S' ? 'stray-S' : 'stray-W',
                                pattern: stream[i].sw, cost: SINGLETON_COST,
                                span: [stream[i].ref] }, ...rest.feet],
                       cost: SINGLETON_COST + rest.cost };
        if (!best || cand.cost < best.cost) best = cand;
      }
      memo[i] = best;
    }
    return memo[0];
  }

  // Grid-alignment probe [design §9: near-optimal alternative parses]:
  // for each foot type, the cheapest "pure" scansion (foot repeated from
  // some offset, singletons at the edges). Two foot types within
  // AMBIGUITY_MARGIN of the minimum = genuinely alternative scansions
  // (the classic iamb/trochee ambiguity of perfectly alternating text).
  const MIN_AMBIGUITY_SYLLS = 6;

  function gridProbe(stream) {
    if (stream.length < MIN_AMBIGUITY_SYLLS) return [];
    const costs = {};
    for (const f of METRICAL_FEET) {
      let best = Infinity;
      for (let off = 0; off < f.pattern.length; off++) {
        let cost = off * SINGLETON_COST;
        let i = off;
        while (i + f.pattern.length <= stream.length) {
          for (let k = 0; k < f.pattern.length; k++) {
            if (stream[i + k].sw !== f.pattern[k]) cost += stream[i + k].conf;
          }
          i += f.pattern.length;
        }
        cost += (stream.length - i) * SINGLETON_COST; // tail singletons
        best = Math.min(best, cost);
      }
      costs[f.name] = best;
    }
    const min = Math.min(...Object.values(costs));
    return Object.entries(costs)
      .filter(([, c]) => c <= min + AMBIGUITY_MARGIN)
      .map(([name, c]) => ({ type: name, cost: round2(c) }));
  }

  // Build the feet of the best "pure" scansion of one foot type over a
  // stream: leading singletons, repeated foot windows (mismatches costed),
  // trailing singletons. Used when a user RESOLVES a scansion ambiguity —
  // the display then honors their chosen reading rather than the DP optimum.
  function gridFeet(stream, foot) {
    let best = null;
    for (let off = 0; off < foot.pattern.length; off++) {
      let cost = 0;
      const feet = [];
      for (let k = 0; k < off; k++) {
        feet.push({ type: stream[k].sw === 'S' ? 'stray-S' : 'stray-W',
                    pattern: stream[k].sw, cost: SINGLETON_COST,
                    span: [stream[k].ref] });
        cost += SINGLETON_COST;
      }
      let i = off;
      while (i + foot.pattern.length <= stream.length) {
        let c = 0;
        for (let k = 0; k < foot.pattern.length; k++)
          if (stream[i + k].sw !== foot.pattern[k]) c += stream[i + k].conf;
        feet.push({ type: foot.name, pattern: foot.pattern, cost: round2(c),
                    span: stream.slice(i, i + foot.pattern.length).map(s => s.ref) });
        cost += c;
        i += foot.pattern.length;
      }
      for (let k = i; k < stream.length; k++) {
        feet.push({ type: stream[k].sw === 'S' ? 'stray-S' : 'stray-W',
                    pattern: stream[k].sw, cost: SINGLETON_COST,
                    span: [stream[k].ref] });
        cost += SINGLETON_COST;
      }
      if (!best || cost < best.cost) best = { feet, cost: round2(cost) };
    }
    return best;
  }

  const FOOT_ADJ = { iamb: 'iambic', trochee: 'trochaic',
                     anapest: 'anapestic', dactyl: 'dactylic' };

  // Resolve a scansion ambiguity: re-derive feet as the chosen type's pure
  // scansion (per IP; feet still never cross IPs). The DP analysis and grid
  // probe remain in ipReports — the choice layers over the automatic
  // analysis, it does not erase it.
  function forceScansion(doc, footName) {
    doc.config.forcedScansion = footName;
    reflow(doc);
    return doc;
  }
  function clearForcedScansion(doc) {
    doc.config.forcedScansion = null;
    reflow(doc);
    return doc;
  }

  function detectMeter(words, ips, forced) {
    const forcedFoot = forced
      ? METRICAL_FEET.find(f => f.name === forced) : null;
    const allFeet = [];
    const ipReports = [];
    let totalCost = 0, totalSyll = 0, confSum = 0;

    for (const ip of ips) {
      const stream = [];
      for (let w = ip.span[0]; w <= ip.span[1]; w++) {
        words[w].syllables.forEach((sy, i) =>
          stream.push({ sw: sy.rhythmicStress, conf: sy.rhythmicConfidence,
                        ref: [w, i] }));
      }
      if (!stream.length) continue;
      const best = meterParseIP(stream);
      const probe = gridProbe(stream);
      const alternates = probe.length >= 2 ? probe : [];
      const used = forcedFoot ? gridFeet(stream, forcedFoot) : best;
      allFeet.push(...used.feet);
      totalCost += used.cost;
      totalSyll += stream.length;
      confSum += stream.reduce((a, s) => a + s.conf, 0);
      ipReports.push({ span: ip.span, feet: used.feet, cost: round2(used.cost),
                       dpCost: round2(best.cost), alternates });
    }

    // Local runs: >=3 consecutive feet of one classical type.
    const RUN_NAMES = { iamb: 'iambic', trochee: 'trochaic',
                        anapest: 'anapestic', dactyl: 'dactylic' };
    const localRuns = [];
    let runType = null, runStart = 0;
    const flush = (endIdx) => {
      if (runType && endIdx - runStart >= 3) {
        const runFeet = allFeet.slice(runStart, endIdx);
        const conf = 1 - runFeet.reduce((a, f) => a + f.cost, 0) / (endIdx - runStart);
        localRuns.push({ type: RUN_NAMES[runType], footRange: [runStart, endIdx - 1],
                         confidence: round2(Math.max(0, conf)) });
      }
    };
    allFeet.forEach((f, idx) => {
      const t = ['iamb', 'trochee', 'anapest', 'dactyl'].includes(f.type) ? f.type : null;
      if (t !== runType) { flush(idx); runType = t; runStart = idx; }
    });
    flush(allFeet.length);

    // Summary label [design §9]: one type >= 70% of all feet → predominant;
    // grid-probe ambiguity (two pure scansions near-equivalent) reported
    // honestly; else mixed, with local runs named when present.
    const counts = {};
    for (const f of allFeet)
      if (['iamb', 'trochee', 'anapest', 'dactyl'].includes(f.type))
        counts[f.type] = (counts[f.type] || 0) + 1;
    const totalFeet = allFeet.length || 1;
    let label = 'mixed';
    const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const ambiguousIPs = ipReports.filter(r => r.alternates.length);
    if (forcedFoot) {
      label = 'read as ' + FOOT_ADJ[forcedFoot.name] + ' (your choice)';
    } else if (ambiguousIPs.length) {
      const ADJ = { iamb: 'iambic', trochee: 'trochaic',
                    anapest: 'anapestic', dactyl: 'dactylic' };
      const types = Array.from(new Set(
        ambiguousIPs.flatMap(r => r.alternates.map(a => ADJ[a.type] || a.type))));
      label = `alternating (${types.join('/')} scansions near-equivalent)`;
    } else if (dom && dom[1] / totalFeet >= 0.7) {
      label = `predominantly ${dom[0] === 'iamb' ? 'iambic'
        : dom[0] === 'trochee' ? 'trochaic'
        : dom[0] === 'anapest' ? 'anapestic' : 'dactylic'}`;
    } else if (localRuns.length) {
      label = 'mixed with local ' +
        Array.from(new Set(localRuns.map(r => r.type))).join(' and ') + ' sequences';
    }
    const meanConf = totalSyll ? confSum / totalSyll : 0;
    const parseConfidence = totalSyll
      ? round2(Math.max(0, (1 - totalCost / totalSyll)) * meanConf) : 0;

    return { feet: allFeet, ipReports, localRuns,
             meterSummary: { label, localRuns, parseConfidence,
                             footCounts: counts,
                             forcedScansion: forcedFoot ? forcedFoot.name : null,
                             ambiguous: !forcedFoot && ambiguousIPs.length > 0,
                             ambiguousTypes: ambiguousIPs.length
                               ? Array.from(new Set(ambiguousIPs.flatMap(r =>
                                   r.alternates.map(a => a.type)))) : [],
                             displayThreshold: 0.6,
                             showFeet: !!forcedFoot || parseConfidence >= 0.6 } };
  }


  /* ==========================================================================
   * SECTION 11 — Statistics + Implicit Prosody Profile
   * ======================================================================== */

  function computeStats(words, ips, meter) {
    const n = words.length || 1;
    const bySource = { CMU: 0, heuristic: 0 };
    const templateDistribution = {};
    const patternDistribution = {};
    let tierMismatch = 0, syllTotal = 0, userEdits = 0;

    for (const wd of words) {
      bySource[wd.lexicalSource === 'CMU' ? 'CMU' : 'heuristic']++;
      const tname = wd.syllables.length === 1
        ? 'monosyllable-' + (wd.isFunctionWord ? 'function' : 'content')
        : wd.template.traditionalName;
      templateDistribution[tname] = (templateDistribution[tname] || 0) + 1;
      patternDistribution[wd.lexicalPattern] =
        (patternDistribution[wd.lexicalPattern] || 0) + 1;
      if (wd.userEdited.lexical || wd.userEdited.template || wd.userEdited.rhythmic)
        userEdits++;
      for (const sy of wd.syllables) {
        syllTotal++;
        const lexSW = sy.lexicalStress === '0' ? 'W' : 'S'; // 1,2 → S
        if (lexSW !== sy.rhythmicStress) tierMismatch++;
      }
    }
    const phiLengths = [];
    for (const ip of ips)
      for (const phi of ip.children)
        phiLengths.push(phi.span[1] - phi.span[0] + 1);

    // Rhythmic regularity, two operationalizations kept side by side:
    //  - rhythmicRegularityIndex: parse-based (1 − normalized foot-parse
    //    cost, folded with confidence) — depends on the meter model.
    //  - alternationIndex: proportion of adjacent within-IP syllable pairs
    //    whose beats differ (S↔W). Parser-independent; a perfectly
    //    alternating stream scores 1 regardless of scansion ambiguity.
    const rri = meter.meterSummary.parseConfidence;
    let pairs = 0, alternating = 0;
    for (const ip of ips) {
      let prev = null;
      for (let w = ip.span[0]; w <= ip.span[1]; w++) {
        for (const sy of words[w].syllables) {
          if (prev !== null) { pairs++; if (sy.rhythmicStress !== prev) alternating++; }
          prev = sy.rhythmicStress;
        }
      }
    }
    const alternationIndex = pairs ? round2(alternating / pairs) : 0;

    // Template Stability Index: proportion of words whose template
    // assignment was retained (not user-changed). [SPEC — proposed measure]
    const templateEdited = words.filter(w => w.userEdited.template).length;
    const tsi = round2(1 - templateEdited / n);

    const polys = words.filter(w => w.syllables.length > 1).length || 1;
    const prop = (name) =>
      round2((templateDistribution[name] || 0) / polys);

    return {
      cmuRate: round2(bySource.CMU / n),
      heuristicRate: round2(bySource.heuristic / n),
      userEditRate: round2(userEdits / n),
      templateDistribution,
      patternDistribution,
      tierMismatchCount: tierMismatch,
      tierMismatchRate: round2(tierMismatch / (syllTotal || 1)),
      implicitProsodyProfile: {
        proportionTrochaic: prop('trochee'),
        proportionIambic: prop('iamb'),
        proportionAnapestic: prop('anapest'),
        proportionDactylic: prop('dactyl'),
        // Retained as a zero-valued compatibility field for older exports.
        // WSW is now analyzed across boundaries, never as a fifth foot.
        proportionAmphibrachic: 0,
        phraseLengthDistribution: phiLengths,
        meanPhraseLength: round2(phiLengths.reduce((a, b) => a + b, 0) /
                                 (phiLengths.length || 1)),
        tierMismatchRate: round2(tierMismatch / (syllTotal || 1)),
        userCorrectionRate: round2(userEdits / n),
        rhythmicRegularityIndex: rri,
        alternationIndex,
        templateStabilityIndex: tsi
      }
    };
  }

  /* ==========================================================================
   * SECTION 12 — Top-level analyze()
   * ======================================================================== */

  function analyze(text, options) {
    const config = Object.assign({ strictAlternation: false, clashSubordination: false, nuclearStress: true }, options || {});
    const tokens = tokenize(text);

    // Build word list + IP break map from punctuation.
    const words = [];
    const ipBreaksAfter = new Set();
    tokens.forEach(tok => {
      if (tok.type === 'word') {
        tok.wordIndex = words.length;
        words.push(analyzeWord(tok.text));
      } else if ((tok.type === 'punct' && IP_PUNCT.has(tok.text)) ||
                 tok.type === 'parabreak') {
        if (words.length) ipBreaksAfter.add(words.length - 1);
      }
    });

    const ips = words.length ? chunk(words, ipBreaksAfter) : [];
    project(words, ips, config);
    const meter = detectMeter(words, ips, config.forcedScansion || null);
    const stats = computeStats(words, ips, meter);

    return {
      version: 3,
      engineStage: 1,
      dictionary: DICT_SOURCE,
      config,
      originalText: text,
      tokens,
      words,
      phrases: ips,
      feet: meter.feet,
      ipReports: meter.ipReports,
      meterSummary: meter.meterSummary,
      stats
    };
  }

  /* ==========================================================================
   * SECTION 13 — Edit API (tier-specific; engine-level, no UI)
   * User authority: edits set confidence 1.0 and are never overwritten;
   * automatic analysis remains recoverable via resetWord.
   * ======================================================================== */

  function editRhythmicStress(doc, wordIdx, sylIdx, newVal) {
    const wd = doc.words[wordIdx];
    const sy = wd.syllables[sylIdx];
    wd.editHistory.push({ tier: 'rhythmic', syllable: sylIdx,
                          old: sy.rhythmicStress, new: newVal,
                          t: Date.now() });
    sy.rhythmicStress = newVal;
    sy.rhythmicSource = 'user';
    sy.rhythmicConfidence = CONF.USER;
    wd.userEdited.rhythmic = true;
    reflow(doc);
    return doc;
  }

  function editLexicalStress(doc, wordIdx, newPattern) {
    const wd = doc.words[wordIdx];
    wd.editHistory.push({ tier: 'lexical', old: wd.lexicalPattern,
                          new: newPattern, t: Date.now() });
    wd.lexicalPattern = newPattern;
    wd.syllables.forEach((sy, i) => { sy.lexicalStress = newPattern[i] || '0'; });
    wd.lexicalSource = 'user';
    wd.lexicalConfidence = CONF.USER;
    wd.userEdited.lexical = true;
    if (!wd.userEdited.template) {
      wd.template = assignTemplate(newPattern, wd.isFunctionWord);
    }
    wd.userEdited.rhythmic = false; // re-project from the new template
    reflow(doc);
    return doc;
  }

  function resetWord(doc, wordIdx) {
    const orig = analyzeWord(doc.words[wordIdx].word);
    orig.editHistory = doc.words[wordIdx].editHistory.concat(
      [{ tier: 'all', old: 'edited', new: 'reset-to-default', t: Date.now() }]);
    doc.words[wordIdx] = orig;
    reflow(doc);
    return doc;
  }

  // Split syllable i of a word at character offset (1..len-1). The original
  // lexical digit stays on the left part; the right part is unstressed.
  // Structural edits invalidate the phonemic alignment for that word.
  function splitSyllable(doc, wordIdx, sylIdx, offset) {
    const wd = doc.words[wordIdx];
    const sy = wd.syllables[sylIdx];
    if (offset <= 0 || offset >= sy.text.length) return doc;
    wd.editHistory.push({ tier: 'lexical', op: 'split', syllable: sylIdx,
                          old: sy.text, new: sy.text.slice(0, offset) + '·' +
                          sy.text.slice(offset), t: Date.now() });
    const left = { text: sy.text.slice(0, offset), phonemes: null,
                   lexicalStress: sy.lexicalStress,
                   rhythmicStress: null, rhythmicSource: null,
                   rhythmicConfidence: null };
    const right = { text: sy.text.slice(offset), phonemes: null,
                    lexicalStress: '0',
                    rhythmicStress: null, rhythmicSource: null,
                    rhythmicConfidence: null };
    wd.syllables.splice(sylIdx, 1, left, right);
    afterStructuralEdit(doc, wd);
    return doc;
  }

  // Merge syllable i with syllable i+1. The stronger stress wins (1 > 2 > 0).
  function mergeSyllables(doc, wordIdx, sylIdx) {
    const wd = doc.words[wordIdx];
    if (sylIdx >= wd.syllables.length - 1) return doc;
    const a = wd.syllables[sylIdx], b = wd.syllables[sylIdx + 1];
    wd.editHistory.push({ tier: 'lexical', op: 'merge', syllable: sylIdx,
                          old: a.text + '·' + b.text, new: a.text + b.text,
                          t: Date.now() });
    const RANK = { '1': 3, '2': 2, '0': 1 };
    const merged = {
      text: a.text + b.text,
      phonemes: (a.phonemes && b.phonemes) ? a.phonemes.concat(b.phonemes) : null,
      lexicalStress: RANK[a.lexicalStress] >= RANK[b.lexicalStress]
        ? a.lexicalStress : b.lexicalStress,
      rhythmicStress: null, rhythmicSource: null, rhythmicConfidence: null
    };
    wd.syllables.splice(sylIdx, 2, merged);
    afterStructuralEdit(doc, wd);
    return doc;
  }

  function afterStructuralEdit(doc, wd) {
    wd.lexicalPattern = wd.syllables.map(s => s.lexicalStress).join('');
    wd.lexicalSource = 'user';
    wd.lexicalConfidence = CONF.USER;
    wd.userEdited.lexical = true;
    if (!wd.userEdited.template)
      wd.template = assignTemplate(wd.lexicalPattern, wd.isFunctionWord);
    wd.userEdited.rhythmic = false; // re-project from the new structure
    reflow(doc);
  }

  // Select one of a word's template variants (a Tier-2 edit): the variant
  // pattern becomes the realized template; the previous canonical joins
  // the variants list. Design §3.2/§3.3.
  function selectTemplateVariant(doc, wordIdx, variantPattern) {
    const wd = doc.words[wordIdx];
    const v = wd.template.variants.find(x => x.pattern === variantPattern);
    if (!v) return doc;
    wd.editHistory.push({ tier: 'template', old: wd.template.pattern,
                          new: variantPattern, t: Date.now() });
    const oldCanonical = { pattern: wd.template.pattern,
                           label: 'previous-canonical',
                           footing: wd.template.traditionalName };
    wd.template = {
      pattern: v.pattern,
      traditionalName: FOOT_NAMES[v.pattern] ||
        (typeof v.footing === 'string' ? 'composite: ' + v.footing : 'composite'),
      variants: [oldCanonical,
                 ...wd.template.variants.filter(x => x.pattern !== variantPattern)],
      assignmentRule: 'user-selected-variant',
      confidence: CONF.USER, source: 'user'
    };
    wd.userEdited.template = true;
    wd.userEdited.rhythmic = false; // realize the newly chosen template
    reflow(doc);
    return doc;
  }

  // Select an alternative dictionary pronunciation (the heteronym
  // workflow: PROduce/proDUCE — Gross et al., 2017, Exp. 2). A Tier-1
  // choice among dictionary entries: full CMU confidence, logged as a
  // user selection; the previous default joins the alternates.
  function selectPronunciation(doc, wordIdx, altIndex) {
    const wd = doc.words[wordIdx];
    const alt = wd.alternates[altIndex];
    if (!alt) return doc;
    const phones = Array.isArray(alt.phonemes)
      ? alt.phonemes : alt.phonemes.split(/\s+/);
    const phonSylls = syllabifyPhonemes(phones);
    if (!phonSylls) return doc;
    wd.editHistory.push({ tier: 'lexical', op: 'pronunciation',
      old: wd.lexicalPattern, new: stressPatternOf(phones), t: Date.now() });
    const prevDefault = {
      phonemes: wd.syllables.map(s => s.phonemes || []).flat(),
      pattern: wd.lexicalPattern
    };
    const lexPattern = stressPatternOf(phones);
    const sylInfo = phonSylls.map(ph => {
      const v = ph.find(p => VOWELS.has(p.replace(/\d/, '')));
      return { stressed: /[12]/.test(v || ''),
               lax: v ? LAX_VOWELS.has(v.replace(/\d/, '')) : false };
    });
    const ortho = orthoSyllabify(
      wd.normalized.replace(/[^a-z']/g, ''), phonSylls.length, sylInfo);
    wd.syllables = ortho.sylls.map((t, i) => ({
      text: t, phonemes: phonSylls[i],
      lexicalStress: lexPattern[i] || '0',
      rhythmicStress: null, rhythmicSource: null, rhythmicConfidence: null
    }));
    wd.lexicalPattern = lexPattern;
    wd.lexicalSource = 'CMU';
    wd.lexicalRule = 'user-pronunciation-selection';
    wd.lexicalConfidence = CONF.CMU_SINGLE;
    wd.alternates = [prevDefault,
      ...wd.alternates.filter((_, i) => i !== altIndex)];
    wd.userEdited.lexical = true;
    if (!wd.userEdited.template)
      wd.template = assignTemplate(lexPattern, wd.isFunctionWord);
    wd.userEdited.rhythmic = false;
    reflow(doc);
    return doc;
  }

  /* ==========================================================================
   * SECTION 13c — Incongruent-marking generator (Gross et al., 2017 paradigm)
   * Congruent marking = the beats. Incongruent marking = the same NUMBER of
   * marks placed on non-beat syllables, preferring within-word transfer for
   * polysyllables and stressed-mono -> unstressed-mono transfer within the
   * same intonational phrase, matching the construction of the 2017 stimuli
   * ("PipING songs OF pleasANT muSIC"). Deterministic (reproducible stimuli).
   * ======================================================================== */
  function incongruentMap(doc) {
    // returns { marks: Set('w:i'), congruentCount, incongruentCount }
    const marks = new Set();
    let congruentCount = 0;
    for (const ip of doc.phrases) {
      const leftoverStrong = [];
      const weakMonos = [];
      for (let w = ip.span[0]; w <= ip.span[1]; w++) {
        const wd = doc.words[w];
        const sylls = wd.syllables;
        if (sylls.length === 1) {
          if (sylls[0].rhythmicStress === 'S') {
            congruentCount++;
            leftoverStrong.push(w);
          } else {
            weakMonos.push(w);
          }
          continue;
        }
        sylls.forEach((sy, i) => {
          if (sy.rhythmicStress !== 'S') return;
          congruentCount++;
          // within-word transfer: prefer the following weak syllable
          let target = -1;
          for (const j of [i + 1, i - 1]) {
            if (j >= 0 && j < sylls.length &&
                sylls[j].rhythmicStress !== 'S' &&
                !marks.has(w + ':' + j)) { target = j; break; }
          }
          if (target === -1) {
            target = sylls.findIndex((s2, j) =>
              s2.rhythmicStress !== 'S' && !marks.has(w + ':' + j));
          }
          if (target !== -1) marks.add(w + ':' + target);
          else leftoverStrong.push(w); // all-strong word: enter mono pool
        });
      }
      // stressed monosyllables -> unstressed monosyllables, in order
      let k = 0;
      for (const w of leftoverStrong) {
        while (k < weakMonos.length && marks.has(weakMonos[k] + ':0')) k++;
        if (k < weakMonos.length) marks.add(weakMonos[k++] + ':0');
      }
    }
    return { marks, congruentCount, incongruentCount: marks.size };
  }

  /* ==========================================================================
   * SECTION 13d — Marking density / cue fading (Gross et al., 2026 paradigm)
   * The 2026 training study annotated passages fully, then reduced cues to a
   * single marker to evaluate transfer. beatSubset selects which beats are
   * visibly marked at a given density level; the underlying analysis is
   * untouched (density is a view/rendering filter, not an edit).
   * Deterministic selection rule, documented: the FIRST beat in each unit
   * survives; researchers can relocate any mark by tap-editing.
   * Levels: 'all' | 'phrase' (one per phonological phrase) |
   *         'sentence' (one per intonational phrase) | 'none'.
   * ======================================================================== */
  function beatSubset(doc, level) {
    const keep = new Set();
    if (level === 'none') return keep;
    const addFirstS = (wStart, wEnd) => {
      for (let w = wStart; w <= wEnd; w++) {
        const sylls = doc.words[w].syllables;
        for (let i = 0; i < sylls.length; i++) {
          if (sylls[i].rhythmicStress === 'S') {
            keep.add(w + ':' + i);
            return;
          }
        }
      }
    };
    for (const ip of doc.phrases) {
      if (level === 'sentence') { addFirstS(ip.span[0], ip.span[1]); continue; }
      for (const phi of ip.children) {
        if (level === 'phrase') { addFirstS(phi.span[0], phi.span[1]); continue; }
        for (let w = phi.span[0]; w <= phi.span[1]; w++)
          doc.words[w].syllables.forEach((sy, i) => {
            if (sy.rhythmicStress === 'S') keep.add(w + ':' + i);
          });
      }
    }
    return keep;
  }

  // Render one passage at descending cue densities (full -> phrase ->
  // sentence -> plain): a ready-made training-with-fading sequence.
  function trainingSet(doc) {
    const renderAt = (level) => {
      const keep = beatSubset(doc, level);
      let out = '';
      for (const tok of doc.tokens) {
        if (tok.type !== 'word') { out += tok.text; continue; }
        const wd = doc.words[tok.wordIndex];
        let start = 0;
        out += wd.syllables.map((sy, i) => {
          let t = tok.text.slice(start, start + sy.text.length) || sy.text;
          start += sy.text.length;
          return keep.has(tok.wordIndex + ':' + i) ? t.toUpperCase() : t;
        }).join('');
      }
      return out;
    };
    return { full: renderAt('all'), phrase: renderAt('phrase'),
             sentence: renderAt('sentence'), plain: renderAt('none') };
  }

  // Render a congruent/incongruent stimulus pair as plain text (CAPS
  // marking, natural word forms), for direct use as experimental stimuli.
  function stimulusPair(doc) {
    const inc = incongruentMap(doc);
    const renderWith = (isMarked) => {
      let out = '';
      for (const tok of doc.tokens) {
        if (tok.type !== 'word') { out += tok.text; continue; }
        const wd = doc.words[tok.wordIndex];
        let start = 0;
        out += wd.syllables.map((sy, i) => {
          let t = tok.text.slice(start, start + sy.text.length) || sy.text;
          start += sy.text.length;
          return isMarked(tok.wordIndex, i, sy) ? t.toUpperCase() : t;
        }).join('');
      }
      return out;
    };
    return {
      congruent: renderWith((w, i, sy) => sy.rhythmicStress === 'S'),
      incongruent: renderWith((w, i) => inc.marks.has(w + ':' + i)),
      congruentCount: inc.congruentCount,
      incongruentCount: inc.incongruentCount
    };
  }

  // Re-run projection + meter + stats after a config change (e.g. toggling
  // strict alternation). User edits are preserved (project() skips them).
  function reanalyze(doc, configPatch) {
    Object.assign(doc.config, configPatch || {});
    reflow(doc);
    return doc;
  }

  // Toggle a phonological-phrase boundary immediately BEFORE word `wordIdx`
  // (a Tier-above edit: design §7 requires φ boundaries to be insertable and
  // deletable). IP boundaries derive from punctuation and are not editable
  // here — to change them, change the text.
  function togglePhiBoundary(doc, wordIdx) {
    const ip = doc.phrases.find(p =>
      wordIdx > p.span[0] && wordIdx <= p.span[1]);
    if (!ip) return doc; // IP-initial or out of range: nothing to toggle
    const starts = new Set(ip.children.map(c => c.span[0]));
    const meta = {};
    ip.children.forEach(c => { meta[c.span[0]] = c; });
    if (starts.has(wordIdx)) starts.delete(wordIdx);
    else starts.add(wordIdx);
    starts.add(ip.span[0]);
    const sorted = Array.from(starts).sort((a, b) => a - b);
    ip.children = sorted.map((s, i) => {
      const e = i + 1 < sorted.length ? sorted[i + 1] - 1 : ip.span[1];
      const prev = meta[s];
      return (prev && prev.span[0] === s && !((s === wordIdx)))
        ? { ...prev, span: [s, e] }
        : { span: [s, e], confidence: CONF.USER, source: 'user',
            userEdited: true };
    });
    ip.userEdited = true;
    doc.userPhraseEdits = (doc.userPhraseEdits || 0) + 1;
    // words in this IP re-project under the new φ structure
    for (let w = ip.span[0]; w <= ip.span[1]; w++)
      if (!doc.words[w].userEdited.rhythmic) {
        doc.words[w].syllables.forEach(sy => { sy.rhythmicStress = null; });
      }
    reflow(doc);
    return doc;
  }

  /* ==========================================================================
   * SECTION 13b — Prosodic Divergence Index (PDI)
   * A single [0,1] measure of how far this document's current annotation
   * diverges from the fully automatic default analysis, with per-tier
   * components. [SPEC — a proposed research measure; the composite is a
   * convenience and the component vector is the real data, since a summed
   * index cannot say WHICH representation a reader disagrees with.]
   * ======================================================================== */
  function computePDI(doc) {
    const base = analyze(doc.originalText, doc.config);
    let sylTotal = 0, lexDiv = 0, rhyDiv = 0, tmplDiv = 0;
    const nWords = Math.max(doc.words.length, 1);
    for (let w = 0; w < doc.words.length; w++) {
      const cur = doc.words[w], ref = base.words[w];
      if (!ref) { sylTotal += cur.syllables.length; continue; }
      if (cur.template.pattern !== ref.template.pattern) tmplDiv++;
      if (cur.syllables.length !== ref.syllables.length) {
        // structural edit: count the whole word as divergent on both
        // syllable-level tiers
        const n = Math.max(cur.syllables.length, ref.syllables.length);
        sylTotal += n; lexDiv += n; rhyDiv += n;
        continue;
      }
      cur.syllables.forEach((sy, i) => {
        sylTotal++;
        if (sy.lexicalStress !== ref.syllables[i].lexicalStress) lexDiv++;
        if (sy.rhythmicStress !== ref.syllables[i].rhythmicStress) rhyDiv++;
      });
    }
    // phrase component: Jaccard distance over non-IP-initial φ starts
    const phiStarts = (d) => {
      const s = new Set();
      for (const ip of d.phrases)
        for (const phi of ip.children)
          if (phi.span[0] !== ip.span[0]) s.add(phi.span[0]);
      return s;
    };
    const a = phiStarts(doc), b = phiStarts(base);
    const union = new Set([...a, ...b]);
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const phraseDiv = union.size ? (union.size - inter) / union.size : 0;

    const components = {
      lexical: round2(lexDiv / Math.max(sylTotal, 1)),
      template: round2(tmplDiv / nWords),
      rhythmic: round2(rhyDiv / Math.max(sylTotal, 1)),
      phrase: round2(phraseDiv)
    };
    const pdi = round2((components.lexical + components.template +
                        components.rhythmic + components.phrase) / 4);
    return { pdi, components };
  }

  function reflow(doc) {
    project(doc.words, doc.phrases, doc.config);
    const meter = detectMeter(doc.words, doc.phrases,
                              doc.config.forcedScansion || null);
    doc.feet = meter.feet;
    doc.ipReports = meter.ipReports;
    doc.meterSummary = meter.meterSummary;
    doc.stats = computeStats(doc.words, doc.phrases, meter);
  }

  /* ==========================================================================
   * SECTION 14 — Data exports (CSV / JSON / annotated plain text)
   * ======================================================================== */

  function toCSV(doc) {
    const rows = [['word', 'syllable_index', 'syllable', 'lexical_stress',
                   'template_pattern', 'template_name', 'rhythmic_stress',
                   'lexical_source', 'rhythmic_source', 'lexical_confidence',
                   'rhythmic_confidence', 'user_edited']];
    doc.words.forEach(wd => {
      wd.syllables.forEach((sy, i) => {
        rows.push([wd.word, i, sy.text, sy.lexicalStress,
                   wd.template.pattern, wd.template.traditionalName,
                   sy.rhythmicStress, wd.lexicalSource, sy.rhythmicSource,
                   wd.lexicalConfidence, sy.rhythmicConfidence,
                   (wd.userEdited.lexical || wd.userEdited.rhythmic ||
                    wd.userEdited.template)]);
      });
    });
    return rows.map(r => r.map(csvEscape).join(',')).join('\n');
  }

  function profileCSV(doc) {
    const p = doc.stats.implicitProsodyProfile;
    const d = computePDI(doc);
    const rows = [['measure', 'value'],
      ['prosodic_divergence_index', d.pdi],
      ['pdi_lexical', d.components.lexical],
      ['pdi_template', d.components.template],
      ['pdi_rhythmic', d.components.rhythmic],
      ['pdi_phrase', d.components.phrase],
      ['proportion_trochaic', p.proportionTrochaic],
      ['proportion_iambic', p.proportionIambic],
      ['proportion_anapestic', p.proportionAnapestic],
      ['proportion_dactylic', p.proportionDactylic],
      ['proportion_amphibrachic', p.proportionAmphibrachic],
      ['mean_phrase_length', p.meanPhraseLength],
      ['phrase_length_distribution', p.phraseLengthDistribution.join(' ')],
      ['tier_mismatch_rate', p.tierMismatchRate],
      ['user_correction_rate', p.userCorrectionRate],
      ['rhythmic_regularity_index', p.rhythmicRegularityIndex],
      ['alternation_index', p.alternationIndex],
      ['template_stability_index', p.templateStabilityIndex]];
    return rows.map(r => r.map(csvEscape).join(',')).join('\n');
  }

  function csvEscape(v) {
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function annotatedText(doc) {
    // Debug rendition: syllables joined by ·, stressed syllables in caps.
    let out = '';
    for (const tok of doc.tokens) {
      if (tok.type === 'word') {
        const wd = doc.words[tok.wordIndex];
        out += wd.syllables.map(sy =>
          sy.rhythmicStress === 'S' ? sy.text.toUpperCase() : sy.text
        ).join('·');
      } else out += tok.text;
    }
    return out;
  }

  /* ==========================================================================
   * SECTION 14b — Morphological segmenter  [HEUR "morph-segmentation"]
   * Surface-level meaning-parts segmentation for display: suffix and prefix
   * stripping gated by stem reality (the residue must be a dictionary word,
   * with orthographic repairs: runn+ing -> run; hop+ed -> hope; happi -> happy),
   * plus conservative compound splitting. Returns surface substrings whose
   * concatenation reproduces the input exactly. Documented error modes:
   * pseudo-suffix false positives (corn·er for 'corner') and repair-blocked
   * misses (runner stays atomic); it is a reading-instruction display aid,
   * not a morphological parser, and is labeled heuristic in the interface.
   * ======================================================================== */
  const MORPH_SUFFIXES = ['ation', 'tion', 'sion', 'ness', 'less', 'ment',
    'able', 'ible', 'ing', 'est', 'ish', 'ous', 'ive', 'ful', 'ity',
    'al', 'ic', 'ly', 'er', 'ed', 'en', 'es', 'y', 's'];
  const MORPH_PREFIXES = ['under', 'inter', 'over', 'fore', 'anti', 'semi',
    'non', 'out', 'sub', 'mis', 'dis', 'pre', 'un', 're', 'de'];

  function wordish(w) {
    return w.length >= 3 && DICT && !!DICT[w.toUpperCase()];
  }

  // Irregular morphology that no productive rule derives. [HEUR]
  const IRREGULAR_MORPH = {
    'children': ['child', 'ren'],
    'oxen': ['ox', 'en'],
    'brethren': ['brethr', 'en']
  };

  function segmentChunk(chunk, depth) {
    if (IRREGULAR_MORPH[chunk]) return IRREGULAR_MORPH[chunk].slice();
    if (depth > 3 || chunk.length < 4) return [chunk];
    // suffixes first (longest first), stem-reality-gated with repairs
    for (const sfx of MORPH_SUFFIXES) {
      if (!chunk.endsWith(sfx)) continue;
      const base = chunk.slice(0, -sfx.length);
      if (base.length < 3) continue;
      // '-y' needs a longer stem: CMU surnames (HAPP) make short exact
      // stems unreliable, and short -y words (dingy) are rarely stem+y.
      if (sfx === 'y' && base.length < 5) continue;
      // Orthographic repairs are risky near CMU's proper-name entries
      // (fabr+e = FABRE); allow them only for the reliable verbal suffixes
      // or when the base is long enough that name collisions are unlikely.
      const repairsOK = ['ing', 'ed'].includes(sfx) || base.length >= 5;
      const candidates = [base];
      if (repairsOK) {
        candidates.push(base + 'e');                                   // hop -> hope
        if (base.length >= 4 && base[base.length - 1] === base[base.length - 2])
          candidates.push(base.slice(0, -1));                          // runn -> run
        if (base.endsWith('i')) candidates.push(base.slice(0, -1) + 'y'); // happi -> happy
      }
      if (candidates.some(wordish)) {
        return [...segmentChunk(base, depth + 1), sfx];
      }
    }
    // prefixes
    for (const pfx of MORPH_PREFIXES) {
      if (chunk.startsWith(pfx) && wordish(chunk.slice(pfx.length))) {
        return [pfx, ...segmentChunk(chunk.slice(pfx.length), depth + 1)];
      }
    }
    // conservative compounds: long words only, both halves real
    if (chunk.length >= 7) {
      let best = null;
      for (let i = 4; i <= chunk.length - 4; i++) {
        const a = chunk.slice(0, i), b = chunk.slice(i);
        if (wordish(a) && wordish(b)) {
          const score = Math.min(a.length, b.length);
          if (!best || score > best.score) best = { i, score };
        }
      }
      if (best) {
        return [chunk.slice(0, best.i),
                ...segmentChunk(chunk.slice(best.i), depth + 1)];
      }
    }
    return [chunk];
  }

  // Public: segment a word's surface form into meaning parts.
  // Hyphens and apostrophes are natural boundaries; case is preserved.
  function morphSegment(orth) {
    const parts = [];
    let buf = '';
    const flush = () => {
      if (!buf) return;
      const segs = segmentChunk(buf.toLowerCase(), 0);
      let pos = 0;
      for (const s of segs) { parts.push(buf.slice(pos, pos + s.length)); pos += s.length; }
      buf = '';
    };
    for (const ch of orth) {
      if (/[A-Za-z]/.test(ch)) buf += ch;
      else {
        flush();
        if (parts.length) parts[parts.length - 1] += ch;
        else parts.push(ch);
      }
    }
    flush();
    return parts;
  }

  function roundTripText(doc) {
    return doc.tokens.map(t => t.text).join('');
  }

  function round2(x) { return Math.round(x * 100) / 100; }

  /* ==========================================================================
   * Public API
   * ======================================================================== */
  const RhythmEngine = {
    loadDictionary, analyze, tokenize, analyzeWord,
    syllabifyPhonemes, orthoSyllabify, assignTemplate, fallbackAnalyze, vowelGroups,
    editRhythmicStress, editLexicalStress, resetWord,
    splitSyllable, mergeSyllables, selectTemplateVariant, reanalyze,
    togglePhiBoundary, computePDI, forceScansion, clearForcedScansion, morphSegment,
    selectPronunciation, incongruentMap, stimulusPair, beatSubset, trainingSet,
    toCSV, profileCSV, annotatedText, roundTripText,
    constants: { FUNCTION_WORDS, CHUNK_STARTERS, CONF, FOOT_NAMES,
                 HYPHEN_EXCEPTIONS, PHI_MAX_WORDS, RHYTHM_FEET }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RhythmEngine;
  global.RhythmEngine = RhythmEngine;

})(typeof window !== 'undefined' ? window : globalThis);
