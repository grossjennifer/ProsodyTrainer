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
  let KNOWN_READINGS = [];

  function loadDictionary(dictObj, sourceLabel) {
    DICT = dictObj || null;
    DICT_SOURCE = DICT ? (sourceLabel || 'full') : 'none';
  }

  function loadKnownReadings(readings) {
    KNOWN_READINGS = Array.isArray(readings) ? readings.slice() : [];
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

  function analyzeWord(orth, preferredPrimary, posTag) {
    const normalized = orth.toLowerCase().replace(/’/g, "'");
    const isFn = FUNCTION_WORDS.has(normalized);
    const cmu = lookupCMU(orth);
    let syllTexts, phonemesBySyll, lexPattern, lexSource, lexConf, rule = null;
    let alternates = [];

    if (cmu) {
      let chosen = 0;
      if (Number.isInteger(preferredPrimary)) {
        const found = cmu.prons.findIndex(p => {
          const pat = stressPatternOf(p);
          return pat.indexOf('1') === preferredPrimary;
        });
        if (found >= 0) chosen = found;
      }
      const phones = cmu.prons[chosen];
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
        alternates = cmu.prons.filter((_, i) => i !== chosen).map(p => ({
          phonemes: p, pattern: stressPatternOf(p)
        }));
        if (chosen > 0) rule = 'contextual-heteronym';
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
      posTag: posTag || null,
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
   * SECTION 7b — Lightweight syntactic-role tagger
   * --------------------------------------------------------------------------
   * [HEUR "pos-tagger"] A small closed-class lexicon plus suffix and local
   * context rules. This is NOT a trained tagger and makes no claim to
   * newswire-level accuracy; it exists to supply two things the rhythm layer
   * genuinely needs:
   *
   *   1. A prominence hierarchy among content words. English phrasal
   *      prominence is not flat across content words: lexical nouns resist
   *      destressing more than finite verbs do [Ladd 2008 ch.6; Selkirk 1995
   *      on argument/predicate asymmetries]. Without this, an engine choosing
   *      which member of a MOUSE|ran clash to demote has no principled basis
   *      and must guess a fixed direction — the defect recorded in the handoff
   *      as finding (7).
   *
   *   2. Graded promotability among function words. Determiners resist
   *      promotion far more than prepositions and particles do, which is why
   *      `up` in `ran UP the clock` and `of` in `forests OF the night` are
   *      available as beats while `the` is not.
   *
   * IMPORTANT SCOPE LIMIT: these tags are NEVER used to apply a blanket
   * "nouns are first-stressed, verbs are second-stressed" rule to heteronyms.
   * Heteronym variant selection stays gated to SHIFTING_HETERONYMS below; the
   * tag only supplies contextual evidence within that gate. This restriction
   * is required by the project owner (handoff §Task item 4).
   * ======================================================================== */

  const CLOSED_CLASS = {
    // Determiners
    the: 'DET', a: 'DET', an: 'DET', these: 'DET', those: 'DET',
    my: 'DET', your: 'DET', its: 'DET', our: 'DET', their: 'DET',
    every: 'DET', each: 'DET', both: 'DET', whose: 'DET', neither: 'DET',
    // Pronouns
    i: 'PRON', me: 'PRON', you: 'PRON', he: 'PRON', him: 'PRON',
    it: 'PRON', we: 'PRON', us: 'PRON', they: 'PRON', them: 'PRON',
    who: 'PRON', whom: 'PRON', mine: 'PRON', yours: 'PRON', hers: 'PRON',
    ours: 'PRON', theirs: 'PRON', myself: 'PRON', yourself: 'PRON',
    himself: 'PRON', herself: 'PRON', itself: 'PRON', ourselves: 'PRON',
    themselves: 'PRON', one: 'PRON', none: 'PRON',
    // Prepositions
    of: 'PREP', in: 'PREP', on: 'PREP', at: 'PREP', by: 'PREP', for: 'PREP',
    with: 'PREP', from: 'PREP', into: 'PREP', onto: 'PREP', upon: 'PREP',
    through: 'PREP', throughout: 'PREP', over: 'PREP', under: 'PREP',
    above: 'PREP', below: 'PREP', beneath: 'PREP', between: 'PREP',
    among: 'PREP', against: 'PREP', without: 'PREP', within: 'PREP',
    across: 'PREP', behind: 'PREP', beyond: 'PREP', beside: 'PREP',
    about: 'PREP', around: 'PREP', toward: 'PREP', towards: 'PREP',
    during: 'PREP', despite: 'PREP', unto: 'PREP',
    // Conjunctions
    and: 'CONJ', or: 'CONJ', but: 'CONJ', nor: 'CONJ', because: 'CONJ',
    although: 'CONJ', unless: 'CONJ', whether: 'CONJ', than: 'CONJ',
    // Auxiliaries and copula
    is: 'AUX', am: 'AUX', are: 'AUX', was: 'AUX', were: 'AUX', be: 'AUX',
    been: 'AUX', being: 'AUX', has: 'AUX', have: 'AUX', had: 'AUX',
    do: 'AUX', does: 'AUX', did: 'AUX',
    // Archaic and elided forms common in the verse this tool is used on.
    // `'twas`/`'tis` are contracted subject+copula and behave as function
    // words; without these they fall through to the open-class default and
    // acquire a noun's resistance to destressing.
    "'twas": 'AUX', twas: 'AUX', "'tis": 'AUX', tis: 'AUX',
    "'twere": 'AUX', "'twill": 'MODAL', o: 'INTJ', oh: 'INTJ',
    thou: 'PRON', thee: 'PRON', thy: 'DET', thine: 'DET', ye: 'PRON',
    hath: 'AUX', hast: 'AUX', doth: 'AUX', art: 'AUX', wert: 'AUX',
    shalt: 'MODAL', wilt: 'MODAL',
    // Modals
    will: 'MODAL', would: 'MODAL', shall: 'MODAL', should: 'MODAL',
    can: 'MODAL', could: 'MODAL', may: 'MODAL', might: 'MODAL', must: 'MODAL',
    // Negation
    not: 'NEG',
    // Infinitival / particle-prone items resolved contextually below
    to: 'PREP', up: 'PART', down: 'PART', out: 'PART', off: 'PART',
    // Existential / deictic
    there: 'EXIST', here: 'ADV',
    // Wh-adverbs
    why: 'ADV', how: 'ADV', when: 'CONJ', where: 'CONJ', while: 'CONJ',
    // Ambiguous items given a default that the context pass may revise
    that: 'DET', this: 'DET', which: 'PRON', what: 'PRON',
    as: 'CONJ', if: 'CONJ', so: 'ADV', though: 'CONJ',
    all: 'DET', some: 'DET', any: 'DET', no: 'DET', such: 'DET',
    his: 'DET', her: 'DET', yet: 'ADV', still: 'ADV', then: 'ADV',
    like: 'PREP', near: 'PREP', past: 'PREP', once: 'ADV', very: 'ADV',
    more: 'ADV', most: 'ADV', much: 'ADV', many: 'DET', few: 'DET',
    own: 'ADJ', same: 'ADJ', other: 'ADJ', another: 'DET'
  };

  const NOUN_SUFFIX = ['tion', 'sion', 'ment', 'ness', 'ity', 'ance', 'ence',
    'ship', 'hood', 'dom', 'ist', 'ism', 'age', 'ure', 'ery', 'ory', 'or',
    'er', 'ar', 'let', 'ling', 'print', 'prints'];
  const VERB_SUFFIX = ['ize', 'ise', 'ify', 'ate', 'en'];
  const ADJ_SUFFIX = ['ous', 'ious', 'ful', 'less', 'able', 'ible', 'ive',
    'al', 'ic', 'ical', 'ish', 'like', 'ary', 'ant', 'ent'];
  const ADV_SUFFIX = ['ly', 'ward', 'wards', 'wise'];

  const SUBJ_PRON_SET = new Set(['i', 'we', 'they', 'you', 'he', 'she', 'it', 'who']);

  function endsWithAny(w, list) { return list.some(s => w.endsWith(s)); }

  // Open-class guess from morphology alone, before context is consulted.
  function morphTag(w) {
    if (endsWithAny(w, ADV_SUFFIX) && w.length > 4) return 'ADV';
    if (endsWithAny(w, NOUN_SUFFIX) && w.length > 4) return 'NOUN';
    if (endsWithAny(w, ADJ_SUFFIX) && w.length > 4) return 'ADJ';
    if (endsWithAny(w, VERB_SUFFIX) && w.length > 4) return 'VERB';
    if (/ing$/.test(w) && w.length > 4) return 'VERBING';   // noun or verb
    if (/ed$/.test(w) && w.length > 3) return 'VERBED';     // verb or adjective
    if (/[^s]s$/.test(w) && w.length > 3) return 'NOUNS';   // plural or 3sg
    return 'OPEN';
  }

  /* Tag every word in the sentence. Two passes: morphology, then context.
   * Returns an array of tags aligned with `rawWords`. */
  function tagPOS(rawWords) {
    const w = rawWords.map(x => x.toLowerCase().replace(/[’]/g, "'"));
    const tags = w.map(x => CLOSED_CLASS[x] || morphTag(x));
    // A clause needs a finite verb. Tracking whether one has appeared yet is
    // what separates `the mouse | ran` (subject then predicate) from
    // `that | good | night` (determiner then modifier then head), which no
    // purely local rule can tell apart.
    let seenVerb = false;

    for (let i = 0; i < w.length; i++) {
      const prev = tags[i - 1], prevW = w[i - 1];
      const next = tags[i + 1], nextW = w[i + 1];

      // "to" + bare stem = infinitival marker, not a preposition.
      if (w[i] === 'to') {
        const openNext = next && !['DET', 'PRON', 'ADJ', 'NOUN', 'NOUNS'].includes(next);
        tags[i] = openNext ? 'INF' : 'PREP';
      }

      // Particle vs preposition: a particle follows a verb and is either
      // phrase-final or followed by a determiner-initial object.
      if (['up', 'down', 'out', 'off'].includes(w[i])) {
        const afterVerb = prev && ['VERB', 'VERBED', 'VERBING', 'OPEN', 'NOUNS'].includes(prev);
        tags[i] = afterVerb ? 'PART' : 'PREP';
      }

      // "that": complementizer/relative after a verb, else determiner.
      if (w[i] === 'that') {
        tags[i] = (prev && ['VERB', 'VERBED', 'AUX', 'NOUN', 'NOUNS'].includes(prev))
          ? 'COMP' : 'DET';
      }

      /* Resolve ambiguous open-class items. The default is NOUN, and VERB is
       * assigned only on positive evidence. That asymmetry is deliberate: a
       * spurious VERB tag lowers the word's demotion resistance and lets the
       * rhythm search destress a genuine nominal, which is a much more
       * damaging error than the reverse. An earlier, symmetric version of
       * this pass tagged `good night` as NOUN VERB and duly produced
       * `GOOD night`. NOUN and ADJ carry similar weights, so confusing those
       * two costs little. */
      if (['OPEN', 'VERBING', 'VERBED', 'NOUNS'].includes(tags[i])) {
        const cur = tags[i];
        if (prev === 'INF' || prev === 'MODAL') {
          tags[i] = 'VERB';                          // to GO, will GO
        } else if (prev === 'NEG' && ['AUX', 'MODAL', 'INF'].includes(tags[i - 2])) {
          tags[i] = 'VERB';                          // do not GO
        } else if (prev === 'AUX') {
          tags[i] = cur === 'VERBING' || cur === 'VERBED' ? 'VERB' : 'ADJ';
        } else if (prev === 'PRON' && SUBJ_PRON_SET.has(prevW)) {
          tags[i] = 'VERB';                          // they GO
        } else if ((cur === 'OPEN' || cur === 'VERBED') && !seenVerb &&
                   ['NOUN', 'NOUNS', 'PRON'].includes(prev)) {
          // the mouse RAN; the spider CLIMBED. Including VERBED matters: an
          // `-ed` form after a subject with no finite verb yet is the past
          // tense, not a participial adjective. Tagging `climbed` ADJ gave it
          // an adjective's resistance to destressing and blocked the
          // phrasal-verb reading `climbed UP the water spout`.
          tags[i] = 'VERB';
        } else {
          tags[i] = cur === 'VERBED' ? 'ADJ' : 'NOUN';
        }
      }

      // Sentence-initial bare stem before a determiner-headed object is an
      // imperative. Restricted to i === 0 so it cannot fire mid-clause.
      if (i === 0 && tags[i] === 'NOUN' && next === 'DET' && !/ing$|s$/.test(w[i]))
        tags[i] = 'VERB';

      if (['VERB', 'AUX', 'MODAL'].includes(tags[i])) seenVerb = true;
      void nextW;
    }
    return tags;
  }

  // Coarse class used by the rhythm layer.
  const CONTENT_TAGS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'NUM', 'OPEN']);
  function isContentTag(t) { return CONTENT_TAGS.has(t); }

  /* Archaic and contracted function words missing from FUNCTION_WORDS but
   * common in the verse this tool is used on. This list is deliberately
   * narrow. An earlier attempt extended function-word status to everything in
   * CLOSED_CLASS, which swept in `all` — a word the corpus repeatedly wants
   * stressed (`ALL the king's horses`, `ALL in the valley`, `when ALL through
   * the house`) — and cost two dev items. Words like `all`, `no`, `some`,
   * `still` and `like` straddle the content/function boundary and their
   * membership of FUNCTION_WORDS is a deliberate existing decision that
   * should not be overridden here. */
  const EXTRA_FUNCTION_WORDS = new Set([
    "'twas", 'twas', "'tis", 'tis', "'twere", "'twill",
    'thou', 'thee', 'thy', 'thine', 'ye',
    'hath', 'hast', 'doth', 'art', 'wert', 'shalt', 'wilt',

    /* Polysyllabic prepositions, subordinators and conjunctions. FUNCTION_WORDS
     * contains only monosyllables, so every one of these was being treated as
     * a CONTENT word: `about` got a template of `W S`, meaning its second
     * syllable was strong by default, free to beat, and cost 6.0 to demote.
     * The engine would therefore beat a preposition in preference to the
     * phrase's own nucleus — `the GIRLS conVERSED aBOUT school`.
     *
     * These are listed explicitly rather than taken from CLOSED_CLASS,
     * because CLOSED_CLASS also contains words like `all`, `no` and `some`
     * that the corpus repeatedly wants stressed. Prepositions and
     * subordinators are unambiguous. */
    'about', 'above', 'across', 'after', 'against', 'along', 'among',
    'around', 'before', 'behind', 'below', 'beneath', 'beside', 'between',
    'beyond', 'despite', 'during', 'except', 'inside', 'into', 'onto',
    'outside', 'over', 'through', 'throughout', 'toward', 'towards',
    'under', 'underneath', 'unto', 'upon', 'within', 'without',
    'although', 'because', 'before', 'however', 'unless', 'until',
    'whether', 'whenever', 'wherever', 'whereas'
  ]);

  function behavesAsFunctionWord(wd) {
    return wd.isFunctionWord || EXTRA_FUNCTION_WORDS.has(wd.normalized);
  }

  // Contextual selection is deliberately gated to known stress-shifting
  // heteronyms. It never applies the misleading generalization that all
  // nouns are first-stressed or all verbs are second-stressed.
  const SHIFTING_HETERONYMS = new Set([
    'minute', 'conflict', 'produce', 'convert', 'record', 'permit', 'rebel',
    'content', 'contest', 'project', 'refuse', 'subject', 'contract',
    'conduct', 'perfect', 'object', 'desert', 'present', 'convict',
    // Added after review: `converse` was missing and caused a regression on
    // the original corpus (`Tanner and Madison conVERSE about school` was
    // read as `CONverse`). The remainder are common English stress-shifting
    // noun/verb pairs of the same type, added so that coverage is not
    // limited to the words that happened to appear in the study stimuli.
    'converse', 'increase', 'decrease', 'insult', 'suspect', 'progress',
    'protest', 'address', 'combine', 'compound', 'console', 'construct',
    'digest', 'discharge', 'discount', 'escort', 'excuse', 'export',
    'extract', 'import', 'incline', 'entrance', 'implant', 'imprint',
    'incense', 'reject', 'relay', 'segment', 'survey', 'torment',
    'transfer', 'transport', 'upset'
  ]);

  /* The same alternation applies to inflected forms — `converses`, `records`,
   * `projected` — and CMU carries both variants for many of them. Gating only
   * the bare form meant `the girls converses` style inputs fell back to the
   * dictionary's first listing. Forms whose CMU entry has no second variant
   * are unaffected; the gate simply never has anything to choose between. */
  for (const base of Array.from(SHIFTING_HETERONYMS)) {
    const stem = base.replace(/e$/, '');
    for (const form of [base + 's', stem + 'es', base + 'd', stem + 'ed',
                        stem + 'ing']) {
      SHIFTING_HETERONYMS.add(form);
    }
  }
  const DETERMINERS = new Set(['a', 'an', 'the', 'this', 'that', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', "learner's"]);
  const VERB_CUES = new Set(['to', 'will', 'would', 'shall', 'should', 'can',
    'could', 'may', 'might', 'must', 'do', 'does', 'did']);

  // Subject pronouns: a heteronym directly after one is a finite verb.
  const SUBJ_PRONOUNS = new Set(['i', 'we', 'they', 'you', 'he', 'she', 'it']);

  /* `tags` is the sentence-level tag array from tagPOS(), used ONLY inside the
   * SHIFTING_HETERONYMS gate. The explicit lexical cues below are kept and
   * tried first: they encode stimulus-specific decisions made with the project
   * owner and must not be silently overridden by a heuristic tagger. */
  function contextualPrimaryIndex(rawWords, i, tags) {
    const word = rawWords[i].toLowerCase().replace(/’/g, "'");
    if (!SHIFTING_HETERONYMS.has(word)) return null;
    const prev = (rawWords[i - 1] || '').toLowerCase().replace(/’/g, "'");
    const next = (rawWords[i + 1] || '').toLowerCase().replace(/’/g, "'");
    const before = rawWords.slice(Math.max(0, i - 3), i)
      .map(x => x.toLowerCase().replace(/’/g, "'"));

    // --- Owner-validated lexical cues (highest priority) ------------------
    /* `minute`: adjectival /maɪˈnjuːt/ "tiny" vs nominal /ˈmɪnɪt/ "60 seconds".
     *
     * This previously fired only on the literal next word `details`, taken
     * straight from the study stimulus, so `minute differences` — the same
     * construction with a different noun — got the wrong reading. The
     * distinguishing fact is syntactic, not lexical: the adjective modifies a
     * following noun and is not itself introduced by a determiner, whereas
     * the noun is counted, possessed or determined (`a minute`, `every
     * minute`, `ten minutes`, `the last minute`). */
    if (word === 'minute') {
      // A following noun is decisive and must be tested BEFORE the
      // determiner, because in `the minute details` the determiner belongs to
      // `details`, not to `minute`. Testing the determiner first read that
      // stimulus as the noun.
      const nextTag = tags && tags[i + 1];
      if (nextTag === 'NOUN' || nextTag === 'NOUNS' || next === 'details') return 1;
      return 0;   // NP head: `a minute`, `every minute`, `down to the minute`
    }
    // "content": the owner-validated cue is the adjectival reading after
    // `feels`. The nominal default is kept only where there is positive
    // nominal evidence; otherwise the syntactic pass below decides, so that
    // "she was content to wait" is not forced to the noun.
    if (word === 'content') {
      if (prev === 'feels') return 1;
      if (DETERMINERS.has(prev) || prev === 'of') return 0;
    }
    if (word === 'produce' && prev === 'of') return 0;
    if (word === 'perfect' && ['is', 'was', 'seems'].includes(prev)) return 0;
    if (word === 'desert' && prev === 'and') return 1;
    if (VERB_CUES.has(prev) || before.includes('to')) return 1;
    if (word === 'contract' && before.includes('expand')) return 1;
    if (word === 'project' && ['we', 'i', 'they', 'you'].includes(prev)) return 1;
    if (word === 'record' && before.includes('desired')) return 1;
    if (word === 'rebel' && before.includes('started')) return 1;
    if (DETERMINERS.has(prev) || prev.endsWith("'s") || prev === 'of') return 0;
    if (['their', 'grave', 'yellow', 'special', 'overdue'].includes(prev)) return 0;

    // --- Gated syntactic evidence (fallback only) -------------------------
    // Applies exclusively to the listed stress-shifting heteronyms. For those
    // specific words the noun/verb stress alternation is a real lexical fact
    // about that word, not a general rule being extended to English at large.
    if (SUBJ_PRONOUNS.has(prev)) return 1;                       // "they object"

    const prevTag = tags && tags[i - 1];
    const nextTag = tags && tags[i + 1];

    // Imperative: sentence-initial heteronym taking a direct object.
    if (i === 0 && ['DET', 'PRON', 'ADJ'].includes(nextTag)) return 1;

    // Predicative after a copula/auxiliary: "she was content to wait".
    if (prevTag === 'AUX' || prevTag === 'MODAL') return 1;

    /* Plural subject + bare form = subject–verb agreement, so the heteronym is
     * finite: "the girls CONVERSE at lunch", "muscles CONTRACT quickly".
     *
     * This must be tested BEFORE the NP-head scan below. That scan walks left
     * looking for a determiner, and in "the girls converse" it finds "the" and
     * concludes the heteronym heads a determiner-initial noun phrase — reading
     * it as `CONverse`. The determiner belongs to "girls"; the noun phrase is
     * already complete.
     *
     * The plural test reads the surface form rather than the tag, because the
     * context pass rewrites NOUNS to NOUN after a determiner and the number
     * information is gone by the time we get here. `/[^s]s$/` deliberately
     * excludes `-ss` words like "glass", which are not plurals. */
    const prevPlural = /[^s]s$/.test(prev);
    if (prevPlural && ['NOUN', 'NOUNS'].includes(prevTag) &&
        (['PREP', 'DET', 'ADV', 'PRON'].includes(nextTag) ||
         i === rawWords.length - 1)) return 1;

    // NP-head test: scan left for a determiner or possessive that is not
    // separated from the heteronym by a verb. If the heteronym is the head of
    // a determiner-initial noun phrase it is nominal — "a spelling contest",
    // "the science project", "a polite refuse".
    for (let k = i - 1; k >= 0 && k >= i - 3; k--) {
      const t = tags[k];
      if (['VERB', 'AUX', 'MODAL', 'INF', 'COMP'].includes(t)) break;
      if (t === 'DET' || (rawWords[k] || '').toLowerCase().endsWith("'s")) return 0;
    }

    // Bare noun subject immediately before the heteronym: "muscles contract
    // quickly". Only when that noun is not itself inside a determiner-initial
    // phrase, which the loop above has already excluded.
    if (['NOUN', 'NOUNS'].includes(prevTag) &&
        (nextTag === 'ADV' || nextTag === 'DET' || nextTag === 'PREP' ||
         i === rawWords.length - 1)) return 1;

    if (prevTag === 'ADJ') return 0;                             // "a violent conflict"
    return null;
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
  /* --------------------------------------------------------------------------
   * Prominence-resistance weights, indexed by syntactic role.
   * [HEUR "role-weights"] These are the cost of overriding a syllable's
   * default realization. Two graded scales replace the previous flat pair
   * (function word 1.2 / content word 1.6):
   *
   *   MONO_DEMOTE — cost of taking a beat AWAY from a monosyllabic content
   *   word. Nominals resist most; finite verbs least. This is what lets the
   *   engine decide which member of a clash to demote instead of always
   *   demoting the left one (handoff finding 7): in `the MOUSE ran UP the
   *   CLOCK` the verb yields and the noun keeps its beat.
   *
   *   FN_PROMOTE — cost of GIVING a beat to a function word. Determiners
   *   resist strongly; prepositions, particles and negation barely at all,
   *   which is what makes `forests OF the night`, `ran UP the clock` and
   *   `do NOT go gentle` reachable without special-casing each phrase.
   *
   * These are engineering weights tuned on the development split only. They
   * are not measured psycholinguistic quantities.
   * ------------------------------------------------------------------------ */
  const MONO_DEMOTE = {
    NOUN: 2.00, NOUNS: 2.00, NUM: 1.85, ADJ: 1.75, ADV: 1.55,
    VERB: 1.35, VERBING: 1.45, VERBED: 1.40, EXIST: 1.10, OPEN: 1.60
  };
  const FN_PROMOTE = {
    DET: 1.15, PRON: 0.90, AUX: 0.80, MODAL: 0.80, COMP: 0.70,
    CONJ: 0.70, INF: 0.60, PREP: 0.55, EXIST: 0.60, PART: 0.45,
    NEG: 0.40, ADV: 0.60
  };
  const DEFAULT_DEMOTE = 1.60;
  const DEFAULT_PROMOTE = 1.00;

  /* A syllable whose vowel is reduced to schwa cannot carry a metrical beat.
   * This is a hard phonological fact, not a preference: you cannot stress the
   * middle syllable of `Tennessee` (`T EH2 N AH0 S IY1`) because there is no
   * full vowel there to stress.
   *
   * CMU's stress digits do not encode this. Both `AH0` in `Tennessee` and
   * `IH0` in `fifteenth` are written `0`, but only the first is reduced —
   * `FIFteenth` is a perfectly good retraction while `tenNESsee` is not a
   * possible English word-shape at all. The distinction has to be read off
   * the vowel phoneme.
   *
   * Without this the Rhythm Rule would retract a beat onto the nearest
   * syllable to the left regardless of what vowel was there, and
   * `Tennessee air` came out as `tenNESsee AIR`. */
  function isReducedSyllable(sy) {
    if (!sy.phonemes) return false;
    return sy.phonemes.some(p => p === 'AH0');
  }

  function rhythmPreference(wd, i) {
    const sy = wd.syllables[i];
    if (wd.userEdited.rhythmic && sy.rhythmicStress) {
      return { value: sy.rhythmicStress, weight: 1000,
               confidence: CONF.USER, source: 'user' };
    }
    const tag = wd.posTag || null;
    if (wd.syllables.length === 1) {
      // A monosyllable's default is S for content words, W for function
      // words; the weight is how hard it resists the opposite value.
      //
      // Membership of FUNCTION_WORDS is authoritative here and is NOT
      // overridden by the tag. The tagger is a heuristic, and letting a
      // mis-tag reclassify `do` or `there` as a content word gives it a
      // content word's demotion resistance — which is how an earlier version
      // produced `DO not go...`. The tag is used only to grade how readily
      // the function word accepts a beat.
      if (behavesAsFunctionWord(wd)) {
        return { value: 'W',
                 weight: (tag && FN_PROMOTE[tag]) || DEFAULT_PROMOTE,
                 confidence: CONF.FUNCTION_WORD,
                 source: 'rule:function-word-demotion' };
      }
      /* Given/new. A content word already used in the passage is given
       * information and deaccents readily, leaving the accent on whatever
       * contrasts with it. This is what makes `ONE fish TWO fish RED fish
       * BLUE fish` the natural reading: `fish` is repeated and therefore
       * given, so the enumerated modifiers carry the beats.
       *
       * Restricted to monosyllables. Applying it to polysyllables would
       * deaccent the second half of `TYger TYger` and `CANnon to right of
       * them / CANnon to left of them`, where the repeated word keeps its
       * accent because its lexical stress is the anchor. */
      const givenFactor = wd.given ? W.GIVEN : 1;
      return { value: 'S',
               weight: ((tag && MONO_DEMOTE[tag]) || DEFAULT_DEMOTE) * givenFactor,
               confidence: CONF.CONTENT_MONO,
               source: wd.given ? 'rule:given-content-monosyllable'
                                : 'rule:content-monosyllable' };
    }
    /* Polysyllabic function words default to WEAK throughout, exactly as
     * monosyllabic ones do. Their lexical stress records which syllable would
     * be prominent IF the word were accented; it is not a claim that the word
     * is accented. Function words reduce in connected speech.
     *
     * Previously the template supplied `W S` for `about`, so its second
     * syllable was already S by preference and taking a beat there cost
     * NOTHING. The engine would then happily print `the GIRLS conVERSED
     * aBOUT school` — beating a preposition while demoting the phrase's own
     * nucleus, because the beat on `about` was free and the beat on `school`
     * had to be paid for. Charging promotion at the function-word rate makes
     * the two comparable, and `about SCHOOL` wins on its merits. */
    if (behavesAsFunctionWord(wd)) {
      const isPrimary = sy.lexicalStress === '1';
      return { value: 'W',
               weight: isPrimary
                 ? ((tag && FN_PROMOTE[tag]) || DEFAULT_PROMOTE)
                 : 3.2,                       // never beat an unstressed syllable
               confidence: CONF.FUNCTION_WORD,
               source: 'rule:function-word-demotion' };
    }

    const templ = wd.template.pattern[i] ||
      (sy.lexicalStress === '0' ? 'W' : 'S');
    // Primary lexical stress inside a polysyllable is the strongest anchor in
    // the system: shifting it changes the word's identity, not just its
    // rhythm. Secondary and unstressed syllables are progressively cheaper.
    /* Secondary stress is weak evidence for a metrical beat and must be
     * cheap to give up. `imagine` is IH2 M AE1 JH AH0 N — secondary and
     * primary on ADJACENT syllables. At the previous weight of 2.2, demoting
     * the secondary cost exactly as much as the clash it created, so the tie
     * broke arbitrarily and the engine printed `IMAGine`: an intra-word
     * clash, which English does not permit. At 1.1 the secondary yields and
     * the word reads `iMAGine`. */
    let weight = sy.lexicalStress === '1' ? 6.0
      : sy.lexicalStress === '2' ? 1.1 : 3.2;
    // A reduced syllable has no full vowel to carry a beat.
    if (sy.lexicalStress === '0' && isReducedSyllable(sy)) weight = 9.0;
    // Polysyllabic function words (into, upon, without) are metrically
    // pliable despite having a lexical primary.
    if (behavesAsFunctionWord(wd)) weight = Math.min(weight, 1.6);
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

  /* ==========================================================================
   * SECTION 9b — Candidate readings, global eurhythmic cost, n-best ranking
   * --------------------------------------------------------------------------
   * This replaces the previous "fit once, then mutate in place" pipeline.
   *
   * The old design produced ONE analysis and then ran repair passes over it.
   * That is a local search with a single starting point, and it has two
   * failure modes the handoff documents: it can only reach readings that are
   * one edit away from the greedy fit, and its repairs could produce a beat
   * pattern inconsistent with the meter label eventually reported.
   *
   * The new design generates several complete seed readings, repairs each of
   * them to a local optimum of ONE global cost function, and ranks the
   * results. Every ranked candidate is internally coherent: its beats, foot
   * parse, meter label and provenance are all computed from the same beat
   * string, so nothing can hybridise the beats of one reading with the meter
   * label of another.
   *
   * THE COST FUNCTION has four parts:
   *
   *   faithfulness — how much the reading overrides lexical and syntactic
   *     defaults, using the graded role weights above, with a discount for
   *     the Rhythm Rule (iambic reversal: a word keeping exactly one beat but
   *     relocating it internally, as in `fifTEENTH` → `FIFteenth of MAY`)
   *     [Liberman & Prince 1977].
   *
   *   grid fit — how well the beats fit a periodic metrical grid of period 2
   *     or 3 at some phase. Phase absorbs anacrusis for free (an iambic line
   *     starts one weak syllable in; an anapestic line, two), and grid
   *     positions after the final beat are free, which is what makes
   *     catalectic and feminine endings cost nothing. Grid positions BEFORE
   *     the final beat that carry no beat are charged, and beats off the grid
   *     are charged. This term is what fixes phase-alignment errors such as
   *     `ON the fifTEENTH` for `on the FIFteenth`.
   *
   *   eurhythmy — clash and lapse. English strongly favours alternation, so
   *     adjacent beats are expensive; but the cost is finite and a clashing
   *     reading can still surface in the ranked list, which is how
   *     contrastively licensed adjacent prominence stays available.
   *
   *   prominence agreement — a small bonus when the phrase nucleus also
   *     carries a metrical beat. Small, because a nucleus need NOT be a beat;
   *     that is exactly the `All in the VALley of death` case.
   * ======================================================================== */

  /* All weights live in one table so they can be swept during development.
   * Values were fitted on the DEVELOPMENT split of the evaluation corpus and
   * then frozen; the held-out split was scored once, afterwards. They are
   * engineering parameters, not measured psycholinguistic quantities. */
  const W = {
    CLASH:        2.20,  // adjacent S S within an IP
    LAPSE:        0.80,  // per weak syllable beyond 2 in an interior run
    TRAIL_LAPSE:  0.30,  // ... in a phrase-final run (feminine endings)
    GRID_MISS:    0.75,  // grid position before the last beat, unbeaten
    GRID_EXTRA:   0.70,  // beat off the grid
    TERNARY:      0.40,  // surcharge for a period-3 grid over a period-2 grid
    SHIFT:        1.90,  // Rhythm Rule: beat relocated leftward inside a word
    NO_BEAT:      3.00,  // a phrase with no beat at all
    NUCLEUS:      0.25,  // discount when the nucleus also carries a beat
    NUCLEUS_PROSE: 1.00, // ... in prose, where it is the main organising accent
    PROSE:        1.80,  // flat cost of the unmetered-prose hypothesis
    METRE_PRIOR:  0.90,  // discount for matching the document's settled metre
    GRID_COHERENCE: 1.50,// bonus for a long, exact grid after metre is established
    GIVEN:        0.45   // demotion-resistance multiplier for repeated content
  };
  /* Provenance of these values (see eval/sweep.js):
   *   TERNARY and GRID_MISS were selected by grid search on the development
   *     split. TERNARY has a genuine interior optimum at 0.40–0.45; larger
   *     values degrade dev accuracy, so it is not running away.
   *   CLASH and SHIFT were FLAT across 1.8–2.6 and 1.4–2.4 respectively on the
   *     development split — that data does not discriminate them. Rather than
   *     let a tie be broken arbitrarily by iteration order, both are set to
   *     mid-range values, with SHIFT deliberately toward the conservative end
   *     so the Rhythm Rule fires only when it clearly pays. If a later corpus
   *     does discriminate them, re-run the sweep.
   *   LAPSE, TRAIL_LAPSE, GRID_EXTRA, NO_BEAT, NUCLEUS and GRID_COHERENCE
   *     were set by hand and not swept. */
  const GRID_PERIODS    = [2, 3];
  const AMBIGUITY_BAND  = 0.75;  // candidates within this of the best are shown
  const REGIME_EVIDENCE_BAND = 1.50; // near reading may establish metre
  const GRID_COHERENCE_MIN_SYLLABLES = 8;
  const MAX_READINGS    = 4;

  // Development-time hook; not used by the shipped tools.
  function setWeights(patch) { Object.assign(W, patch || {}); return Object.assign({}, W); }

  /* Faithfulness, computed word by word so the Rhythm Rule discount can
   * apply. `shifted` collects the words whose beat was relocated, for
   * provenance reporting. */
  function faithfulnessCost(stream, beats, shifted) {
    let cost = 0, k = 0;
    while (k < stream.length) {
      const wd = stream[k].wd;
      let j = k;
      while (j < stream.length && stream[j].wd === wd) j++;
      let raw = 0, sCount = 0, prefS = 0, sAt = -1, prefAt = -1;
      for (let t = k; t < j; t++) {
        if (beats[t] !== stream[t].pref.value) raw += stream[t].pref.weight;
        if (beats[t] === 'S') { sCount++; sAt = t; }
        if (stream[t].pref.value === 'S') { prefS++; prefAt = t; }
      }
      /* The Rhythm Rule (iambic reversal) RETRACTS stress leftward —
       * `thirTEEN` → `THIRteen men`, `fifTEENTH` → `the FIFteenth of May`. It
       * does not shift stress rightward, so the discount is restricted to
       * leftward moves; that stops the search "solving" a grid mismatch by
       * inventing `genTLE` or `inTO`.
       *
       * It is also CLASH-motivated. Retraction happens because the word's own
       * primary would collide with a following beat, not merely because
       * moving it tidies the rhythm. Without this condition the rule was
       * being used to fill a lapse: `TANner and MADison conVERSE` has three
       * weak syllables in a row, and relocating the beat to `CON` removed
       * them — printing `CONverse` even though the lexical variant had been
       * correctly identified as the verb. Requiring a clash at the unshifted
       * position keeps the rule to the environment that actually licenses it. */
      let crowded = false;
      for (let d = 1; d <= 2 && !crowded; d++) {
        if (prefAt + d < beats.length && beats[prefAt + d] === 'S') crowded = true;
        if (prefAt - d >= 0 && prefAt - d < k && beats[prefAt - d] === 'S') crowded = true;
      }
      const targetReduced = sAt >= 0 && isReducedSyllable(stream[sAt].sy);
      if (j - k > 1 && sCount === 1 && prefS === 1 && sAt < prefAt &&
          crowded && !targetReduced &&
          raw > W.SHIFT && !wd.userEdited.rhythmic) {
        cost += W.SHIFT;
        if (shifted) shifted.push(wd);
      } else {
        cost += raw;
      }
      k = j;
    }
    return cost;
  }

  /* Best fit of the beats to a periodic grid; also returns the winning
   * period/phase so the candidate can report the template it realises.
   *
   * `prior` optionally names a document-level template ({period, phase}) that
   * the rest of the passage has already settled on; matching it earns a
   * discount. That is how a poem's established metre informs an individual
   * line — context a single line cannot supply on its own. */
  function gridFit(beats, prior) {
    const n = beats.length;
    let last = -1;
    for (let i = n - 1; i >= 0; i--) if (beats[i] === 'S') { last = i; break; }
    if (last === -1) return { cost: W.NO_BEAT, period: null, phase: null };
    let best = { cost: Infinity, period: null, phase: null };
    for (const p of GRID_PERIODS) {
      for (let ph = 0; ph < p; ph++) {
        let miss = 0, extra = 0;
        for (let i = 0; i < n; i++) {
          const onGrid = i >= ph && (i - ph) % p === 0;
          if (onGrid && beats[i] !== 'S' && i < last) miss++;
          else if (!onGrid && beats[i] === 'S') extra++;
        }
        // English default alternation is binary; a ternary grid is a marked
        // choice and carries a small surcharge so that a period-3 reading
        // must be positively supported by the words rather than merely tie.
        let cost = W.GRID_MISS * miss + W.GRID_EXTRA * extra +
                   (p === 3 ? W.TERNARY : 0);
        /* NOT DONE: a flat surcharge on phase > 0, to break the exact tie
         * between `ONE fish TWO fish` and `one FISH two FISH` (both are
         * perfect period-2 grids). It was tried and removed: since iambic
         * lines are phase 1 and anapestic lines phase 2, any such surcharge
         * is a blanket bias toward trochaic and dactylic readings. It cost
         * two held-out items, all of them anapestic. English verse has no
         * general preference for beginning on a beat, so the tie has to be
         * broken by evidence — which is what the metre prior below does when
         * surrounding lines supply it. An isolated single line genuinely is
         * ambiguous here, and should be reported as such. */
        if (prior && prior.period === p && prior.phase === ph) cost -= W.METRE_PRIOR;
        if (cost < best.cost) best = { cost, period: p, phase: ph };
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------------
   * Structure: metrical grid OR unmetered prose.
   *
   * The previous version scored EVERY candidate against a period-2 or
   * period-3 grid. There was no hypothesis under which a passage simply has
   * no metre, so ordinary sentences were pushed toward periodicity and then
   * handed a foot label like "alternating (trochaic/anapestic/dactylic
   * scansions near-equivalent)" — which is not an analysis of prose rhythm.
   *
   * Prose is now a first-class competing hypothesis with a flat cost. A
   * passage is analysed as metrical only when a periodic grid fits it BETTER
   * than W.PROSE; otherwise the prose reading wins, asserts no template, and
   * the meter layer reports no foot. Prose still avoids clashes and lapses —
   * those are separate terms — it simply is not required to be periodic.
   *
   * W.PROSE is therefore the threshold answering "how regular must a passage
   * be before calling it metrical?" rather than a free parameter.
   * ---------------------------------------------------------------------- */
  function structureFit(beats, ctx) {
    /* REGIME IS A PROPERTY OF THE TEXT, NOT OF EACH CANDIDATE.
     *
     * A first implementation let every candidate choose independently, by
     * capping the grid term at W.PROSE. That quietly broke verse: a messy
     * reading of an anapestic line whose grid cost was 2.55 simply paid the
     * 1.80 cap instead, so the prose hypothesis became an escape hatch that
     * relieved pressure toward regularity everywhere. It cost a held-out
     * item immediately.
     *
     * The regime is now decided once for the passage (see classifyRegime)
     * and fixed for the pass:
     *
     *   metrical — the grid term applies in full, with no prose cap.
     *   prose    — there is no grid term at all. Prose rhythm is driven by
     *              lexical stress, syntactic role and clash/lapse avoidance;
     *              it is not required to be periodic, and no foot is claimed.
     */
    if (ctx && ctx.regime === 'prose') {
      return { cost: 0, regime: 'prose', period: null, phase: null };
    }
    const grid = gridFit(beats, ctx && ctx.metrePrior);
    if (grid.period === null)
      return { cost: grid.cost, regime: 'prose', period: null, phase: null };
    return { cost: grid.cost, regime: 'metrical',
             period: grid.period, phase: grid.phase };
  }

  /* ------------------------------------------------------------------------
   * Regime classification.
   *
   * Two signals, both read off a first metrical-objective pass:
   *
   *   fit      — mean grid cost per syllable of each phrase's chosen reading.
   *              Verse sits near zero; prose does not.
   *   agreement— whether phrases settle on the same template. A poem's lines
   *              agree; consecutive prose clauses do not.
   *
   * Short passages are treated leniently: a four-syllable fragment will fit
   * some grid by luck, so it cannot establish metre on its own and is only
   * called metrical when the fit is very good.
   * ---------------------------------------------------------------------- */
  const REGIME_FIT_THRESHOLD = 0.14;   // grid cost per syllable
  const REGIME_MIN_IP_SYLLABLES = 6;   // shorter phrases are not evidence
  const REGIME_MIN_EVIDENCE = 6;       // long-phrase syllables needed
  const REGIME_MIN_AGREEING_PHRASES = 3;
  const REGIME_AGREEMENT = 0.75;

  /* Auto-detection must not decide whether text is metrical from only the
   * lexically cheapest reading. That creates a circular content-word bias:
   * a near-tied, perfectly periodic reading can be ignored, causing the text
   * to be labelled prose, after which its grid evidence disappears entirely.
   * For regime evidence only, inspect close candidates and prefer the one
   * with the cleanest grid. The displayed/default reading is not changed at
   * this stage. */
  function regimeEvidenceReading(ip) {
    const near = (ip.readings || [])
      .filter(r => r.margin <= REGIME_EVIDENCE_BAND && r.template);
    if (!near.length)
      return ip.readings && ip.readings[ip.selectedReadingIndex];
    return near.reduce((best, r) => {
      if (!best) return r;
      if (r.components.structure !== best.components.structure)
        return r.components.structure < best.components.structure ? r : best;
      return r.cost < best.cost ? r : best;
    }, null);
  }

  function unambiguousRegimeTemplate(ip) {
    const near = (ip.readings || [])
      .filter(r => r.margin <= REGIME_EVIDENCE_BAND && r.template);
    if (!near.length) return null;
    const minStructure = Math.min(...near.map(r => r.components.structure));
    const cleanest = near.filter(r =>
      Math.abs(r.components.structure - minStructure) < 1e-9);
    const keys = new Set(cleanest.map(r =>
      `${r.template.period}-${r.template.phase}`));
    if (keys.size !== 1) return null;
    const chosen = cleanest[0].template;
    const selected = ip.readings && ip.readings[ip.selectedReadingIndex];
    if (!selected || !selected.template ||
        selected.template.period !== chosen.period ||
        selected.template.phase !== chosen.phase)
      return null;
    return chosen;
  }

  function classifyRegime(ips, textType) {
    if (textType === 'prose') return { regime: 'prose', reason: 'user:prose' };
    if (textType === 'verse' || textType === 'song')
      return { regime: 'metrical', reason: 'user:' + textType };

    /* Two independent kinds of evidence, because verse comes in two shapes
     * that a single test cannot cover:
     *
     *   LENGTH — one phrase long enough to constrain a grid on its own. A
     *     pentameter line is evidence; a four-syllable fragment carries about
     *     two beats and fits SOME period and phase essentially by luck.
     *
     *   AGREEMENT — several short phrases independently choosing the SAME
     *     template. `One fish two fish, red fish blue fish` is four-syllable
     *     fragments throughout, and commas chop it further, so no phrase
     *     qualifies on length; what makes it verse is that every fragment
     *     lands on the same grid. Requiring length alone would have called
     *     this prose.
     *
     * Requiring BOTH would miss short-line verse; requiring neither would let
     * `The sun arose, and the birds sang` — two short clauses that happen to
     * fit, and that do not agree with each other — be read as verse.
     */
    let cost = 0, syll = 0, longSyll = 0;
    const votes = new Map();
    let phrases = 0;
    for (const ip of ips) {
      const r = regimeEvidenceReading(ip);
      if (!r || r.beats.length < 3) continue;
      phrases++;
      cost += r.components.structure;
      syll += r.beats.length;
      if (r.beats.length >= REGIME_MIN_IP_SYLLABLES) longSyll += r.beats.length;
      if (r.template) {
        const k = `${r.template.period}-${r.template.phase}`;
        votes.set(k, (votes.get(k) || 0) + 1);
      }
    }
    if (!syll) return { regime: 'prose', reason: 'auto:no-evidence',
                        evidenceSyllables: 0 };

    const fit = cost / syll;
    const total = Array.from(votes.values()).reduce((a, b) => a + b, 0);
    let top = 0, topKey = null;
    for (const [key, value] of votes) {
      if (value > top) { top = value; topKey = key; }
    }
    const agreement = total > 0 ? top / total : 0;

    const byLength = longSyll >= REGIME_MIN_EVIDENCE && fit <= REGIME_FIT_THRESHOLD;
    const byAgreement = phrases >= REGIME_MIN_AGREEING_PHRASES &&
                        agreement >= REGIME_AGREEMENT &&
                        fit <= REGIME_FIT_THRESHOLD * 2;
    const metrical = byLength || byAgreement;

    let metrePrior = null;
    let priorKey = null;
    if (metrical && phrases === 1) {
      const evidenceIP = ips.find(ip => {
        const r = regimeEvidenceReading(ip);
        return r && r.beats.length >= GRID_COHERENCE_MIN_SYLLABLES;
      });
      const template = evidenceIP && unambiguousRegimeTemplate(evidenceIP);
      if (template) priorKey = `${template.period}-${template.phase}`;
    } else if (metrical && topKey && agreement >= 0.60) {
      priorKey = topKey;
    }
    if (priorKey) {
      const [period, phase] = priorKey.split('-').map(Number);
      metrePrior = { period, phase, support: top, of: total,
                     foot: PERIOD_FOOT[priorKey] || null };
    }

    return { regime: metrical ? 'metrical' : 'prose', reason: 'auto',
             evidence: metrical ? (byLength ? 'length' : 'agreement') : 'none',
             fit: round2(fit), agreement: round2(agreement),
             evidenceSyllables: longSyll, phrases, metrePrior };
  }

  function eurhythmyCost(beats, ctx, regime) {
    const clashWeight = ctx.clashWeight;
    let cost = 0;
    for (let i = 0; i + 1 < beats.length; i++) {
      if (beats[i] !== 'S' || beats[i + 1] !== 'S') continue;
      /* NOT DONE: discounting clashes that involve the nucleus, to keep the
       * phrase's main accent from being repaired away. Tried and removed
       * twice. Applied in both regimes it produced `HUMPty DUMPty HAD a GREAT
       * FALL`, beating the experimental foil `great`, and cost six verse
       * items. Restricted to prose it still produced `HALF a LEAGUE ONward`,
       * because in a short phrase a licensed clash is cheaper than any
       * demotion.
       *
       * The problem it was meant to solve — a flat clash penalty deleting the
       * phrase's own nucleus in `and the birds sang` — is better solved by
       * making the nucleus expensive to DEMOTE (W.NUCLEUS_PROSE) than by
       * making it cheap to CLASH. That yields `and the birds SANG`: the
       * accent survives, and alternation is still respected. */
      cost += clashWeight;
    }
    let run = 0;
    for (let i = 0; i <= beats.length; i++) {
      if (i < beats.length && beats[i] === 'W') { run++; continue; }
      if (run > 2)
        cost += (i === beats.length ? W.TRAIL_LAPSE : W.LAPSE) * (run - 2);
      run = 0;
    }
    return cost;
  }

  function readingCost(stream, beats, ctx) {
    const structure = structureFit(beats, ctx);
    let cost = faithfulnessCost(stream, beats, null) +
               structure.cost +
               eurhythmyCost(beats, ctx, structure.regime);
    /* Once the first pass has independently established that the passage is
     * metrical, reward an exact sustained grid. This is deliberately absent
     * from the exploratory pass, where it could manufacture metre in prose.
     * The period-3 surcharge is not a mismatch, so a ternary grid is exact
     * when its remaining structure cost is W.TERNARY (or lower with a prior). */
    const exactGridCost = structure.period === 3 ? W.TERNARY : 0;
    const priorMatched = ctx.metrePrior &&
      ctx.metrePrior.period === structure.period &&
      ctx.metrePrior.phase === structure.phase;
    const uncreditedStructureCost = structure.cost +
      (priorMatched ? W.METRE_PRIOR : 0);
    if (ctx.settledMeter && priorMatched && structure.regime === 'metrical' &&
        stream.length >= GRID_COHERENCE_MIN_SYLLABLES &&
        uncreditedStructureCost <= exactGridCost + 1e-9)
      cost -= W.GRID_COHERENCE;
    /* Keeping a beat on the nucleus is worth more in prose than in verse.
     * Prose rhythm is organised around phrase accents rather than a periodic
     * grid, so the nuclear accent is the main thing holding the phrase
     * together and should not be traded away to satisfy alternation. In
     * verse the grid does that organising work, so the bonus stays small —
     * a nucleus may legitimately fall on an extrametrical syllable. */
    if (ctx.nucleusIdx >= 0 && beats[ctx.nucleusIdx] === 'S')
      cost -= (structure.regime === 'prose' ? W.NUCLEUS_PROSE : W.NUCLEUS);
    return cost;
  }

  /* -- Local search ---------------------------------------------------------
   * Three move types. Single flips do the ordinary promotion/demotion work.
   * Adjacent swaps let the search cross a ridge that no single flip can (they
   * are how a clash is resolved by moving the beat rather than deleting it).
   * Word-internal relocation is needed because the Rhythm Rule discount only
   * applies to states with exactly one beat in the word, which single flips
   * cannot reach without passing through a more expensive state.
   * ----------------------------------------------------------------------- */
  function repairReading(stream, seed, ctx) {
    const n = stream.length;
    const editable = stream.map(it => !it.wd.userEdited.rhythmic);
    let cur = seed.slice();
    let curCost = readingCost(stream, cur, ctx);

    // Precompute word spans for the relocation move.
    const spans = [];
    for (let k = 0; k < n;) {
      const wd = stream[k].wd; let j = k;
      while (j < n && stream[j].wd === wd) j++;
      if (j - k > 1) spans.push([k, j]);
      k = j;
    }

    for (let pass = 0; pass < 25; pass++) {
      let improved = false;

      for (let i = 0; i < n; i++) {                       // single flip
        if (!editable[i]) continue;
        const trial = cur.slice();
        trial[i] = trial[i] === 'S' ? 'W' : 'S';
        const c = readingCost(stream, trial, ctx);
        if (c < curCost - 1e-9) { cur = trial; curCost = c; improved = true; }
      }

      for (let i = 0; i + 1 < n; i++) {                   // adjacent swap
        if (!editable[i] || !editable[i + 1]) continue;
        if (cur[i] === cur[i + 1]) continue;
        const trial = cur.slice();
        trial[i] = cur[i + 1]; trial[i + 1] = cur[i];
        const c = readingCost(stream, trial, ctx);
        if (c < curCost - 1e-9) { cur = trial; curCost = c; improved = true; }
      }

      for (const [a, b] of spans) {                       // relocate in word
        if (!stream.slice(a, b).every((_, k) => editable[a + k])) continue;
        for (let target = a; target < b; target++) {
          const trial = cur.slice();
          for (let t = a; t < b; t++) trial[t] = t === target ? 'S' : 'W';
          const c = readingCost(stream, trial, ctx);
          if (c < curCost - 1e-9) { cur = trial; curCost = c; improved = true; }
        }
      }

      if (!improved) break;
    }
    return { beats: cur, cost: curCost };
  }

  /* -- Seeds ---------------------------------------------------------------- */
  function seedReadings(stream, freeFit) {
    const n = stream.length;
    const seeds = [];

    // (a) plain lexical/syntactic preference — the prose reading.
    seeds.push({ beats: stream.map(it => it.pref.value), from: 'preference' });

    // (b) the DP foot fit, i.e. what the previous engine produced.
    if (freeFit) seeds.push({ beats: freeFit, from: 'foot-fit' });

    // (c) every periodic grid of period 2 or 3, at every phase.
    for (const p of GRID_PERIODS) {
      for (let ph = 0; ph < p; ph++) {
        const b = [];
        for (let i = 0; i < n; i++)
          b.push(i >= ph && (i - ph) % p === 0 ? 'S' : 'W');
        seeds.push({ beats: b, from: `grid-${p}-${ph}` });
      }
    }
    return seeds;
  }

  const PERIOD_FOOT = {
    '2-0': 'trochee', '2-1': 'iamb', '3-0': 'dactyl', '3-2': 'anapest'
  };

  /* Build the ranked list of complete readings for one intonational phrase. */
  function candidateReadings(stream, freeFit, ctx) {
    const seen = new Map();
    const offer = (beats, cost, from) => {
      const key = beats.join('');
      const prev = seen.get(key);
      if (!prev) seen.set(key, { beats, cost, from });
      else if (!prev.from.includes(from)) prev.from += '+' + from;
    };
    for (const seed of seedReadings(stream, freeFit)) {
      // Keep the UNREPAIRED seed as a candidate in its own right as well as
      // the local optimum it climbs to. Hill-climbing from several seeds
      // usually converges on one basin, which would leave the interface with
      // a single reading and no way to show a real alternative. A pure
      // periodic template is exactly the sort of coherent competing reading a
      // reader may want to toggle to, so it is offered on its own merits and
      // then ranked on the same cost function as everything else.
      offer(seed.beats, readingCost(stream, seed.beats, ctx), seed.from + ':literal');
      const r = repairReading(stream, seed.beats, ctx);
      offer(r.beats, r.cost, seed.from);
    }
    const list = Array.from(seen.values()).sort((a, b) => a.cost - b.cost);

    // Annotate each candidate with its own coherent metrical description.
    return list.map((c, idx) => {
      const shifted = [];
      const faith = faithfulnessCost(stream, c.beats, shifted);
      const structure = structureFit(c.beats, ctx);
      const clashes = [];
      for (let i = 0; i + 1 < c.beats.length; i++)
        if (c.beats[i] === 'S' && c.beats[i + 1] === 'S')
          clashes.push({ refs: [stream[i].ref, stream[i + 1].ref],
                         licensed: ctx.nucleusIdx === i || ctx.nucleusIdx === i + 1 });
      const key = structure.period === null
        ? null : `${structure.period}-${structure.phase}`;
      return {
        beats: c.beats,
        cost: round2(c.cost),
        rank: idx,
        margin: round2(c.cost - list[0].cost),
        provenance: c.from,
        // 'metrical' — the beats fit a periodic grid well enough to warrant a
        // foot label. 'prose' — they do not, and no foot is asserted.
        regime: structure.regime,
        components: {
          faithfulness: round2(faith),
          structure: round2(structure.cost),
          eurhythmy: round2(eurhythmyCost(c.beats, ctx, structure.regime))
        },
        template: key ? { period: structure.period, phase: structure.phase,
                          foot: PERIOD_FOOT[key] || null } : null,
        nearestGrid: structure.nearestGrid || null,
        stressShifted: shifted.map(w => w.word),
        clashes,
        // Confidence falls as the runner-up gets closer. A reading that wins
        // outright is reported confidently; a near-tie is reported as such
        // rather than presented as the single correct scansion.
        confidence: round2(Math.max(0.35, Math.min(0.95,
          list.length > 1 ? 0.55 + 0.4 * Math.min(1, (list[1].cost - list[0].cost) / 2)
                          : 0.9)))
      };
    });
  }

  /* ------------------------------------------------------------------------
   * Text type as an analysis prior.
   *
   * The review asked that the Prose / Verse / Song control be a genuine prior
   * on the analysis rather than a button that inserts an example. It works by
   * moving the threshold at which a passage is considered metrical:
   *
   *   'prose'  — a grid must fit very well indeed to beat the prose reading
   *   'auto'   — the neutral threshold; the text decides
   *   'verse'  — metrical structure is expected, so the bar is much lower
   *   'song'   — as verse; song and rhyme are strongly periodic
   *
   * Note this is a prior, not a switch: a strongly metrical passage will
   * still be read metrically in 'prose' mode if the grid fits well enough,
   * and genuinely irregular free verse can still come out as prose in
   * 'verse' mode. That is deliberate — the control should bias the analysis,
   * not override the evidence.
   * ---------------------------------------------------------------------- */
  const TEXT_TYPES = { auto: 1.00, prose: 0.45, verse: 2.10, song: 2.40 };

  function proseCostFor(textType) {
    const k = TEXT_TYPES[textType || 'auto'];
    return W.PROSE * (typeof k === 'number' ? k : 1);
  }

  /* Document-level metre agreement.
   *
   * A single line rarely determines its own metre: `Half a league half a
   * league` is a perfectly good period-2 reading in isolation, and only the
   * surrounding poem reveals it as dactylic. After a first pass, if enough
   * intonational phrases independently select the same template, that
   * template is fed back as a prior and the passage is re-analysed. Lines
   * that resisted
   * then fall into line with their neighbours, while a passage whose phrases
   * disagree gets no prior and is left alone.
   *
   * Requires at least three qualifying phrases and a two-thirds majority, so
   * a couple of short fragments cannot manufacture a metre. */
  const METRE_AGREEMENT_MIN_IPS = 3;
  const METRE_AGREEMENT_SHARE = 0.60;

  function detectMetrePrior(ips) {
    const votes = new Map();
    let n = 0;
    for (const ip of ips) {
      const r = ip.readings && ip.readings[ip.selectedReadingIndex];
      if (!r || r.regime !== 'metrical' || !r.template) continue;
      if (r.beats.length < 4) continue;         // too short to vote
      n++;
      const key = `${r.template.period}-${r.template.phase}`;
      votes.set(key, (votes.get(key) || 0) + 1);
    }
    if (n < METRE_AGREEMENT_MIN_IPS) return null;
    let bestKey = null, bestN = 0;
    for (const [k, v] of votes) if (v > bestN) { bestKey = k; bestN = v; }
    if (!bestKey || bestN / n < METRE_AGREEMENT_SHARE) return null;
    const [period, phase] = bestKey.split('-').map(Number);
    return { period, phase, support: bestN, of: n,
             foot: PERIOD_FOOT[bestKey] || null };
  }

  function project(words, ips, config) {
    for (const ip of ips) {
      // The stream spans the whole punctuation-bounded IP. The automatically
      // estimated child chunks remain available as phrasing suggestions, but
      // no longer create artificial seams that the meter cannot cross.
      const [s, e] = ip.span;
      const stream = [];
      for (let w = s; w <= e; w++) {
        const wd = words[w];
        wd.syllables.forEach((sy, i) => stream.push({
          wd, sy, i, ref: [w, i], pref: rhythmPreference(wd, i)
        }));
      }
      if (!stream.length) continue;

      /* Phrase prominence is identified FIRST and is a separate claim from
       * the metrical beat. It informs ranking only through a small bonus, and
       * it is never erased by the beat analysis — a nucleus can sit on a
       * syllable that carries no beat. */
      if (config.nuclearStress) applyNuclearStress(words, ip);
      let nucleusIdx = -1;
      if (ip.nucleus) {
        nucleusIdx = stream.findIndex(x =>
          x.ref[0] === ip.nucleus.ref[0] && x.ref[1] === ip.nucleus.ref[1]);
      }

      // Clash pressure is configurable: `strictAlternation` raises it,
      // disabling `clashSubordination` removes it entirely (which is how a
      // user can ask to see contrastively licensed adjacent prominence).
      const clashWeight = config.strictAlternation ? W.CLASH * 1.6
        : config.clashSubordination ? W.CLASH : 0;
      const ctx = { nucleusIdx, clashWeight,
                    regime: config.regime || 'metrical',
                    metrePrior: config.metrePrior || null,
                    settledMeter: !!config.settledMeter };

      const freeFit = fitPhraseRhythm(stream);
      const freeBeats = new Array(stream.length).fill(null);
      for (const unit of freeFit.units) {
        unit.span.forEach((ref, k) => {
          const idx = stream.findIndex(x => x.ref[0] === ref[0] && x.ref[1] === ref[1]);
          if (idx >= 0) freeBeats[idx] = unit.pattern[k] || stream[idx].pref.value;
        });
      }
      for (let i = 0; i < freeBeats.length; i++)
        if (!freeBeats[i]) freeBeats[i] = stream[i].pref.value;

      const readings = candidateReadings(stream, freeBeats, ctx);
      ip.readings = readings.slice(0, MAX_READINGS);

      /* A reader's choice of candidate must survive reanalysis. reflow() re-runs
       * this whole function, so the choice is stored as the chosen BEAT STRING
       * rather than as a list index: indices shift when the candidate set is
       * recomputed, and silently re-pointing a pin at a different reading would
       * be worse than dropping it. If the pinned string is no longer among the
       * candidates (because the text or the weights changed) the pin is
       * discarded and the ranking decides again. */
      ip.selectedReadingIndex = 0;
      if (ip.pinnedReadingKey) {
        const at = ip.readings.findIndex(r => r.beats.join('') === ip.pinnedReadingKey);
        if (at >= 0) ip.selectedReadingIndex = at;
        else ip.pinnedReadingKey = null;
      }
      // Only genuinely close, genuinely distinct complete readings count as
      // ambiguity. This is deliberately narrow: the handoff asks that the
      // interface not label every alternating string a four-way ambiguity.
      ip.readingAmbiguity = ip.readings
        .filter((r, i) => i > 0 && r.margin <= AMBIGUITY_BAND);

      const chosen = ip.readings[ip.selectedReadingIndex] || readings[0];
      ip.children.forEach(child => { child.rhythmicFeet = []; child.rhythmicCost = 0; });
      if (ip.children[0]) {
        ip.children[0].rhythmicFeet = freeFit.units;
        ip.children[0].rhythmicCost = round2(freeFit.cost || 0);
      }

      stream.forEach((item, k) => {
        if (item.wd.userEdited.rhythmic) return;
        const val = chosen.beats[k];
        const matched = val === item.pref.value;
        const shifted = chosen.stressShifted.includes(item.wd.word);
        const source = shifted ? 'rule:rhythm-rule-stress-shift'
          : matched ? item.pref.source
          : val === 'S' ? 'rule:lapse-promotion' : 'rule:clash-demotion';
        setRhythm(item.wd, item.i, val, source,
          matched ? item.pref.confidence
                  : Math.min(chosen.confidence, item.pref.confidence));
      });
    }
    for (const wd of words) {
      wd.rhythmicPattern = wd.syllables.map(sy => sy.rhythmicStress).join('');
    }
    if (config.forcedScansion) applyForcedRhythm(words, ips, config.forcedScansion);
  }

  /* Full projection: analyse, then let any document-level metre agreement
   * inform a second pass. Only ONE feedback round is run — repeated feedback
   * would let a weak initial majority amplify itself into a metre the text
   * does not have. */
  /* Mark repeated content words as given information. First occurrence is
   * new; later ones are given. Function words are excluded — they are weak
   * regardless — as are polysyllables, whose lexical stress anchors them. */
  function markGivenness(words) {
    const seen = new Set();
    for (const wd of words) {
      wd.given = false;
      if (wd.isFunctionWord || wd.syllables.length !== 1) continue;
      const key = wd.normalized;
      if (seen.has(key)) wd.given = true; else seen.add(key);
    }
  }

  function projectDocument(words, ips, config) {
    // Pass 1 — metrical objective, no prior. Establishes how well the text
    // takes to a grid at all.
    project(words, ips, Object.assign({}, config,
      { regime: 'metrical', settledMeter: false }));
    if (config.forcedScansion)
      return { regime: 'metrical', reason: 'forced', metrePrior: null };

    const verdict = classifyRegime(ips, config.textType);

    // Pass 2 — commit to the regime. In verse, feed back any metre the
    // phrases agree on; a poem's established rhythm is exactly the context an
    // individual line lacks. Only one feedback round runs, so a weak majority
    // cannot amplify itself into a metre the text does not have.
    const prior = verdict.regime === 'metrical'
      ? (verdict.metrePrior || detectMetrePrior(ips)) : null;
    if (verdict.regime !== 'metrical' || prior) {
      project(words, ips, Object.assign({}, config,
        { regime: verdict.regime, metrePrior: prior,
          settledMeter: verdict.regime === 'metrical' }));
    }
    return Object.assign({}, verdict, { metrePrior: prior });
  }

  /* Install a different ranked candidate for one IP. Used by the interface
   * when the reader chooses among coherent alternatives: the WHOLE reading is
   * replaced, never blended with the previous one. */
  function selectIPReading(doc, ipIndex, readingIndex) {
    const ip = doc.phrases[ipIndex];
    if (!ip || !ip.readings || !ip.readings[readingIndex]) return doc;
    ip.pinnedReadingKey = ip.readings[readingIndex].beats.join('');
    reflow(doc);
    return doc;
  }

  function clearIPReading(doc, ipIndex) {
    const ip = doc.phrases[ipIndex];
    if (!ip) return doc;
    ip.pinnedReadingKey = null;
    reflow(doc);
    return doc;
  }

  function applyForcedRhythm(words, ips, footName) {
    const foot = RHYTHM_FEET.find(f => f.name === footName);
    if (!foot) return;
    for (const ip of ips) {
      const stream = [];
      for (let w = ip.span[0]; w <= ip.span[1]; w++)
        words[w].syllables.forEach((sy, i) => stream.push({
          w, i, sy, word: words[w], pref: rhythmPreference(words[w], i)
        }));
      /* When the reader explicitly forces a scansion, the grid is the point.
       * Weighting a leading residue at the ordinary rate let the search skip
       * syllables rather than destress a content word: asking for DACTYLIC on
       * `half a league half a league` chose offset 2 and printed
       * `HALF a LEAGUE half a LEAGUE`, which is not dactylic and makes the
       * button look broken. Under a forced scansion a skipped opening is far
       * more costly than an unfaithful beat, so the line actually begins on
       * the foot the reader asked for. */
      const FORCED_RESIDUE_COST = 2.5;
      let best = null;
      for (let off = 0; off < foot.pattern.length; off++) {
        let cost = off * FORCED_RESIDUE_COST;
        for (let k = off; k < stream.length; k++) {
          const val = foot.pattern[(k - off) % foot.pattern.length];
          if (val !== stream[k].pref.value) cost += stream[k].pref.weight;
        }
        if (!best || cost < best.cost) best = { off, cost };
      }
      stream.forEach((item, k) => {
        if (item.word.userEdited.rhythmic) return;
        const val = k < best.off ? item.pref.value
          : foot.pattern[(k - best.off) % foot.pattern.length];
        setRhythm(item.word, item.i, val, 'rule:chosen-' + foot.name, 0.75);
      });
    }
    words.forEach(w => { w.rhythmicPattern = w.syllables
      .map(s => s.rhythmicStress).join(''); });
  }

  function setRhythm(wd, i, val, source, conf) {
    const sy = wd.syllables[i];
    sy.rhythmicStress = val;
    sy.rhythmicSource = source;
    sy.rhythmicConfidence = round2(conf);
  }

  /* REMOVED: applyClashSubordination() and applyStrictAlternation().
   *
   * These were the previous engine's post-hoc repair passes. They are gone
   * rather than merely unused, so that nobody re-wires them by accident.
   *
   * applyClashSubordination always demoted the LEFT member of a clash and
   * only if it was a monosyllable or function word. On `the MOUSE | RAN up
   * the clock` that rule demoted MOUSE and produced `the mouse RAN up the
   * CLOCK` — replacing one wrong reading with another, which is exactly the
   * behaviour recorded in the handoff. Demotion direction is now a choice the
   * search makes, weighted by the syntactic role of each candidate.
   *
   * The two configuration flags they served are preserved and still
   * meaningful: `strictAlternation` and `clashSubordination` now scale the
   * CLASH term of the global cost function (see project()), so the Pro tool's
   * existing toggles continue to work and, with clash pressure off, licensed
   * adjacent prominence remains available. */

  /* Nuclear Stress Rule (NSR).  Per intonational phrase, the main (nuclear)
   * accent falls on the last content word — hence "the final word tends to be
   * prominent" [Chomsky & Halle 1968; Liberman 1975; Liberman & Prince 1977].
   * Phrase prominence is represented independently of the metrical beat.
   * This is a tendency, not a law: narrow focus or given/new
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
    wd.syllables[ns].nuclear = true;
    wd.syllables[ns].phraseProminence = 'nucleus';
    wd.syllables[ns].prominenceSource = 'rule:nuclear-stress';
    wd.syllables[ns].prominenceConfidence = CONF.NUCLEAR;
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

    /* Regime gate. The DP foot parser will always return SOME parse of any
     * beat string — that is its job — but a parse is not evidence of metre.
     * If the selected readings are in the prose regime, the passage gets no
     * foot label at all. This is what stops ordinary sentences being reported
     * as "alternating (trochaic/anapestic/dactylic scansions near-equivalent)",
     * which the review correctly called not a useful analysis of prose.
     *
     * The foot parse is still computed and still available in ipReports for
     * anyone who wants it; it simply no longer drives a metrical claim. */
    let metricalIPs = 0, proseIPs = 0;
    for (const ip of ips) {
      const r = ip.readings && ip.readings[ip.selectedReadingIndex];
      if (!r) continue;
      if (r.regime === 'metrical') metricalIPs++; else proseIPs++;
    }
    const totalRegime = metricalIPs + proseIPs;
    const proseDominant = totalRegime > 0 && metricalIPs / totalRegime < 0.5;

    if (forcedFoot) {
      label = 'read as ' + FOOT_ADJ[forcedFoot.name] + ' (your choice)';
    } else if (proseDominant) {
      label = metricalIPs === 0
        ? 'prose rhythm (no regular metre)'
        : 'prose rhythm (with some regular stretches)';
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
                             regime: proseDominant ? 'prose' : 'metrical',
                             metricalPhrases: metricalIPs,
                             prosePhrases: proseIPs,
                             forcedScansion: forcedFoot ? forcedFoot.name : null,
                             ambiguous: !forcedFoot && !proseDominant &&
                                        ambiguousIPs.length > 0,
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
    const config = Object.assign({ strictAlternation: false,
      clashSubordination: true, nuclearStress: true, textType: 'auto' },
      options || {});
    const tokens = tokenize(text);

    // Build word list + IP break map from punctuation.
    const words = [];
    const ipBreaksAfter = new Set();
    const rawWords = tokens.filter(t => t.type === 'word').map(t => t.text);
    const posTags = tagPOS(rawWords);
    tokens.forEach(tok => {
      if (tok.type === 'word') {
        tok.wordIndex = words.length;
        words.push(analyzeWord(tok.text,
          contextualPrimaryIndex(rawWords, words.length, posTags),
          posTags[words.length]));
      } else if ((tok.type === 'punct' && IP_PUNCT.has(tok.text)) ||
                 tok.type === 'parabreak') {
        if (words.length) ipBreaksAfter.add(words.length - 1);
      }
    });

    markGivenness(words);
    const ips = words.length ? chunk(words, ipBreaksAfter) : [];
    const regimeInfo = projectDocument(words, ips, config);
    const inferred = readingSnapshot(words, 'inferred', 'Automatic reading');
    const known = findKnownReading(text);
    let selectedReading = 'inferred';
    const alternativeReadings = [inferred];
    if (known) {
      applyMarkedReading(words, known.marked, 'known:' + known.id);
      selectedReading = known.id;
      alternativeReadings.unshift(readingSnapshot(words, known.id,
        known.kind === 'familiar-rhyme' ? 'Familiar rhyme reading'
          : 'Conventional verse reading', known.meter));
    }
    const meter = detectMeter(words, ips,
      config.forcedScansion || (known && known.meter) || null);
    if (known && !config.forcedScansion) markConventionalMeter(meter, known.meter);
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
      regime: regimeInfo,
      textType: config.textType,
      alternativeReadings,
      selectedReading,
      knownReading: known ? { id: known.id, kind: known.kind,
                              meter: known.meter } : null,
      stats
    };
  }

  function normalizedPassage(text) {
    return text.toLowerCase().replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9']+/g, ' ').trim();
  }

  function findKnownReading(text) {
    const key = normalizedPassage(text);
    return KNOWN_READINGS.find(r => normalizedPassage(r.text) === key) || null;
  }

  function readingSnapshot(words, id, label, meter) {
    return { id, label, meter: meter || null,
      patterns: words.map(w => w.syllables.map(s => s.rhythmicStress).join('')) };
  }

  function markConventionalMeter(meter, footName) {
    const adj = FOOT_ADJ[footName] || footName;
    meter.meterSummary.label = 'conventional ' + adj + ' reading';
    meter.meterSummary.forcedScansion = null;
    meter.meterSummary.ambiguous = false;
    meter.meterSummary.ambiguousTypes = [];
    meter.meterSummary.conventional = true;
  }

  function applyMarkedReading(words, marked, source) {
    const markedWords = marked.match(/[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*/g) || [];
    words.forEach((wd, wi) => {
      const token = markedWords[wi] || '';
      wd.syllables.forEach((sy, i) => setRhythm(wd, i, 'W', source, 0.95));
      const at = Array.from(token).findIndex(ch => ch >= 'A' && ch <= 'Z');
      if (at < 0) return;
      let off = 0, target = wd.syllables.length - 1;
      for (let i = 0; i < wd.syllables.length; i++) {
        const len = wd.syllables[i].text.replace(/[^A-Za-z']/g, '').length;
        if (at < off + len) { target = i; break; }
        off += len;
      }
      setRhythm(wd, target, 'S', source, 0.95);
      wd.rhythmicPattern = wd.syllables.map(s => s.rhythmicStress).join('');
    });
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

  function selectReading(doc, readingId) {
    const reading = (doc.alternativeReadings || []).find(r => r.id === readingId);
    if (!reading) return doc;
    doc.words.forEach((wd, w) => {
      const pattern = reading.patterns[w] || '';
      wd.syllables.forEach((sy, i) => {
        if (!wd.userEdited.rhythmic)
          setRhythm(wd, i, pattern[i] || 'W', 'reading:' + readingId, 0.90);
      });
      wd.rhythmicPattern = wd.syllables.map(s => s.rhythmicStress).join('');
    });
    doc.selectedReading = readingId;
    const meter = detectMeter(doc.words, doc.phrases, reading.meter || null);
    if (reading.meter) markConventionalMeter(meter, reading.meter);
    doc.feet = meter.feet;
    doc.ipReports = meter.ipReports;
    doc.meterSummary = meter.meterSummary;
    doc.stats = computeStats(doc.words, doc.phrases, meter);
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
    doc.regime = projectDocument(doc.words, doc.phrases, doc.config);
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
                   'phrase_prominence',
                   'lexical_source', 'rhythmic_source', 'lexical_confidence',
                   'rhythmic_confidence', 'user_edited']];
    doc.words.forEach(wd => {
      wd.syllables.forEach((sy, i) => {
        rows.push([wd.word, i, sy.text, sy.lexicalStress,
                   wd.template.pattern, wd.template.traditionalName,
                   sy.rhythmicStress, sy.phraseProminence || '',
                   wd.lexicalSource, sy.rhythmicSource,
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
    loadDictionary, loadKnownReadings, analyze, tokenize, analyzeWord,
    syllabifyPhonemes, orthoSyllabify, assignTemplate, fallbackAnalyze, vowelGroups,
    editRhythmicStress, editLexicalStress, resetWord, tagPOS, selectIPReading, clearIPReading,
    setWeights, proseCostFor, detectMetrePrior,
    splitSyllable, mergeSyllables, selectTemplateVariant, reanalyze,
    togglePhiBoundary, computePDI, forceScansion, clearForcedScansion, morphSegment,
    selectPronunciation, selectReading, incongruentMap, stimulusPair, beatSubset, trainingSet,
    toCSV, profileCSV, annotatedText, roundTripText,
    constants: { FUNCTION_WORDS, CHUNK_STARTERS, CONF, FOOT_NAMES,
                 HYPHEN_EXCEPTIONS, PHI_MAX_WORDS, RHYTHM_FEET }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RhythmEngine;
  global.RhythmEngine = RhythmEngine;

})(typeof window !== 'undefined' ? window : globalThis);
