/* Conventional readings for familiar verse and validated study stimuli.
 * These are offered as alternatives to the context-free automatic analysis;
 * they are never generalized to unrelated prose. */
(function (global) {
  'use strict';
  global.PROSODY_KNOWN_READINGS = [
    {
      id: 'study-waltz-count', kind: 'validated-study-stimulus', meter: 'dactyl',
      text: 'Waltz two three, waltz two three.',
      marked: 'WALTZ two three WALTZ two three'
    },
    {
      id: 'nursery-mouse', kind: 'familiar-rhyme', meter: 'iamb',
      text: 'The mouse ran up the clock.',
      marked: 'the MOUSE ran UP the CLOCK'
    },
    {
      id: 'nursery-kings-horses', kind: 'familiar-rhyme', meter: 'dactyl',
      text: "All the king's horses and all the king's men.",
      marked: "ALL the king's HORses and ALL the king's MEN"
    },
    {
      id: 'poe-raven-opening', kind: 'familiar-verse', meter: 'trochee',
      text: 'Once upon a midnight dreary, while I pondered, weak and weary,',
      marked: 'ONCE upON a MIDnight DREARy while I PONdered WEAK and WEARy'
    },
    {
      id: 'tennyson-valley-death', kind: 'familiar-verse', meter: 'dactyl',
      text: 'All in the valley of Death',
      marked: 'ALL in the VALley of death'
    },
    {
      id: 'tennyson-cannon', kind: 'familiar-verse', meter: 'dactyl',
      text: 'Cannon to right of them, Cannon to left of them, Cannon in front of them',
      marked: 'CANnon to RIGHT of them CANnon to LEFT of them CANnon in FRONT of them'
    },
    {
      id: 'browning-silver', kind: 'familiar-verse', meter: 'dactyl',
      text: 'Just for a handful of silver he left us, Just for a riband to stick in his coat',
      marked: 'JUST for a HANDful of SILver he LEFT us JUST for a RIBand to STICK in his COAT'
    },
    {
      id: 'whitman-dactyl', kind: 'familiar-verse', meter: 'dactyl',
      text: 'Down to the shores of the water, the path by the swamp in the dimness,',
      marked: 'DOWN to the SHORES of the WAter the PATH by the SWAMP in the DIMness'
    },
    {
      id: 'shakespeare-summer', kind: 'familiar-verse', meter: 'iamb',
      text: "Shall I compare thee to a summer's day?",
      marked: "shall I comPARE thee TO a SUMmer's DAY"
    },
    {
      id: 'tennyson-strive', kind: 'familiar-verse', meter: 'iamb',
      text: 'To strive, to seek, to find, and not to yield.',
      marked: 'to STRIVE to SEEK to FIND and NOT to YIELD'
    },
    {
      id: 'frost-woods', kind: 'familiar-verse', meter: 'iamb',
      text: 'Whose woods these are I think I know.',
      marked: 'whose WOODS these ARE i THINK i KNOW'
    },
    {
      id: 'macbeth-double', kind: 'familiar-verse', meter: 'trochee',
      text: 'Double, double toil and trouble.',
      marked: 'DOUble DOUble TOIL and TROUble'
    },
    {
      id: 'blake-tyger', kind: 'familiar-verse', meter: 'trochee',
      text: 'Tyger! Tyger! burning bright, In the forests of the night.',
      marked: 'TYger TYger BURNing BRIGHT IN the FORests OF the NIGHT'
    },
    {
      id: 'blake-forests', kind: 'familiar-verse', meter: 'trochee',
      text: 'In the forests of the night.',
      marked: 'IN the FORests OF the NIGHT'
    },
    {
      id: 'seuss-horton-1', kind: 'familiar-verse', meter: 'anapest',
      text: 'on the fifteenth of May, in the jungle of Nool,',
      marked: 'on the FIFteenth of MAY in the JUNgle of NOOL'
    },
    {
      id: 'seuss-horton-2', kind: 'familiar-verse', meter: 'anapest',
      text: 'in the heat of the day, in the cool of the pool,',
      marked: 'in the HEAT of the DAY in the COOL of the POOL'
    },
    {
      id: 'seuss-horton-3', kind: 'familiar-verse', meter: 'anapest',
      text: "he was splashing… enjoying the jungle’s great joys…",
      marked: "he was SPLASHing enJOYing the JUNgle’s great JOYS"
    },
    {
      id: 'seuss-horton-4', kind: 'familiar-verse', meter: 'anapest',
      text: 'when Horton the elephant heard a small noise.',
      marked: 'when HORton the ELephant HEARD a small NOISE',
      preserveAmbiguity: true,
      studyEvidence: {
        candidateId: 'QID67',
        role: 'strong congruent candidate',
        note: 'Prior Poetry Training helpfulness-rating study; the line has a conventional anapestic reading but also supports a nearby dactylic alternative.'
      }
    },
    {
      id: 'shakespeare-sonnet-141', kind: 'familiar-verse', meter: 'iamb',
      text: 'In faith, I do not love thee with mine eyes,',
      marked: 'in FAITH i DO not LOVE thee WITH mine EYES',
      studyEvidence: {
        candidateId: 'QID57',
        role: 'strong congruent candidate',
        note: 'Prior Poetry Training helpfulness-rating study; the new study should retain the passage only after matched foil annotation.'
      }
    },
    {
      id: 'longfellow-lives', kind: 'familiar-verse', meter: 'trochee',
      text: 'Lives of great men all remind us we can make our lives sublime and, departing, leave behind us footprints on the sands of time.',
      marked: 'LIVES of GREAT men ALL reMIND us WE can MAKE our LIVES subLIME AND dePARTing LEAVE beHIND us FOOTprints ON the SANDS of TIME',
      studyEvidence: {
        candidateId: 'QID54',
        role: 'strong congruent candidate',
        note: 'Prior Poetry Training helpfulness-rating study; use as a metrical template, not as a validated forced-choice item.'
      }
    },
    {
      id: 'poe-raven-full-opening', kind: 'familiar-verse', meter: 'trochee',
      text: 'once upon a midnight dreary, while I pondered, weak and weary, over many a quaint and curious volume of forgotten lore, while I nodded, nearly napping, suddenly there came a tapping, as of someone gently rapping, rapping at my chamber door.',
      marked: 'ONCE upON a MIDnight DREARy WHILE i PONdered WEAK and WEARy OVer MANy a QUAINT and CURious VOLume OF forGOTten LORE WHILE i NODded NEARly NAPping SUDdenly THERE came A TAPping AS of SOMEone GENTly RAPping RAPping AT my CHAMber DOOR'
    }
  ];

  /* Research-facing seed passages are deliberately kept separate from the
   * registered readings above. They are drawn from the strongest items in
   * the older Poetry Training subset, but they are not treated as scored
   * correct/incorrect stimuli. The upcoming measure needs fresh matched
   * foils and a prose-heavy balance. */
  global.PROSODY_STUDY_EXAMPLES = [
    {
      id: 'study-qid62', candidateId: 'QID62', meter: 'anapest',
      label: 'They, with the gold to give…',
      text: 'They, with the gold to give, doled him out silver,',
      role: 'strong congruent candidate', status: 'template-only',
      note: 'Strong prior discriminator; syllable-level marking should be verified before use in a scored item.'
    },
    {
      id: 'study-qid54', candidateId: 'QID54', meter: 'trochee',
      label: 'Lives of great men…',
      text: 'Lives of great men all remind us,',
      role: 'strong congruent candidate', status: 'template-only',
      note: 'Strong prior discriminator; create a matched content-word foil rather than promoting a function word.'
    },
    {
      id: 'study-qid67', candidateId: 'QID67', meter: 'anapest',
      label: 'When Horton the elephant…',
      text: 'When Horton the elephant heard a small noise.',
      role: 'strong congruent candidate', status: 'template-only',
      note: 'Strong prior discriminator; pilot the line with an explicit foil because the conventional line supports nearby scansions.'
    },
    {
      id: 'study-qid57', candidateId: 'QID57', meter: 'iamb',
      label: 'In faith, I do not love…',
      text: 'In faith, I do not love thee with mine eyes,',
      role: 'strong congruent candidate', status: 'template-only',
      note: 'Strong prior discriminator; the final measure should avoid making function-word promotion the central contrast.'
    },
    {
      id: 'study-qid66', candidateId: 'QID66', meter: 'iamb',
      label: 'I sit back with this pack…',
      text: 'I sit back with this pack of zigzags and this bag.',
      role: 'strong but incomplete-sample candidate', status: 'template-only',
      note: 'Promising prior item, but it was not administered in every sample and requires fresh annotation.'
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
