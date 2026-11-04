/**
 * Practice question bank (Eduten-style). Every question is generated from a formula template with the
 * answer computed, so answers and worked solutions are correct by construction. Each wrong option carries
 * the misconception it represents, which drives the "students who need help on X" analysis.
 * Tags map each question to TS Intermediate, JEE Main and NEET chapters (curriculum mapping).
 */
export type Subject = 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Curriculum = 'TS Inter' | 'JEE Main' | 'NEET';

export interface PracticeQuestion {
  id: string;
  subject: Subject;
  chapter: string;
  curriculum: Curriculum[];
  difficulty: Difficulty;
  stem: string;
  options: string[];
  answer: number;
  /** misconception behind each option; null for the correct one */
  misconceptions: (string | null)[];
  solution: string;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

function build(
  id: string,
  subject: Subject,
  chapter: string,
  curriculum: Curriculum[],
  difficulty: Difficulty,
  stem: string,
  correct: string,
  wrong: { text: string; mis: string }[],
  solution: string,
  seed: number,
): PracticeQuestion {
  const opts: { text: string; mis: string | null }[] = [{ text: correct, mis: null }];
  for (const w of wrong) if (!opts.some((o) => o.text === w.text)) opts.push(w);
  // Fill to four distinct options with arithmetic slips if distractors collided.
  for (let k = 1; opts.length < 4; k++) {
    const n = Number(correct);
    const text = Number.isFinite(n) ? fmt(n + k * (k % 2 ? 1 : -1) * Math.max(1, Math.abs(n) * 0.1)) : `${correct} (${k})`;
    if (!opts.some((o) => o.text === text)) opts.push({ text, mis: 'Calculation slip' });
  }
  const four = opts.slice(0, 4);
  const shift = seed % 4;
  const rotated = [...four.slice(shift), ...four.slice(0, shift)];
  return { id, subject, chapter, curriculum, difficulty, stem, options: rotated.map((o) => o.text), answer: rotated.findIndex((o) => o.mis === null), misconceptions: rotated.map((o) => o.mis), solution };
}

const diff = (i: number, n: number): Difficulty => (i < n / 3 ? 'easy' : i < (2 * n) / 3 ? 'medium' : 'hard');
const JEE: Curriculum[] = ['TS Inter', 'JEE Main'];
const NEET: Curriculum[] = ['TS Inter', 'NEET'];
const ALL: Curriculum[] = ['TS Inter', 'JEE Main', 'NEET'];

function generate(): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  const N = 20;

  // ---------------- Mathematics
  for (let i = 0; i < N; i++) {
    const a = 1 + (i % 7), b = 2 + ((i * 3) % 9);
    out.push(build(`m-quad-${i}`, 'Mathematics', 'Quadratic equations', JEE, diff(i, N),
      `For x² − ${a + b}x + ${a * b} = 0, what is the sum of the roots?`, fmt(a + b),
      [{ text: fmt(-(a + b)), mis: 'Sign of the sum of roots (−b/a)' }, { text: fmt(a * b), mis: 'Confusing sum with product (c/a)' }, { text: fmt(b - a), mis: 'Difference of roots instead of sum' }],
      `Sum of roots = −b/a = −(−${a + b})/1 = ${a + b}. (Roots are ${a} and ${b}.)`, i));
  }
  for (let i = 0; i < N; i++) {
    const n = 2 + (i % 5), k = 1 + (i % 4);
    out.push(build(`m-diff-${i}`, 'Mathematics', 'Differentiation', JEE, diff(i, N),
      `If f(x) = x^${n}, what is f′(${k})?`, fmt(n * k ** (n - 1)),
      [{ text: fmt(k ** n), mis: 'Evaluating f instead of f′' }, { text: fmt(n * k ** n), mis: 'Not reducing the power by 1' }, { text: fmt((n - 1) * k ** (n - 1)), mis: 'Using (n−1) as the coefficient' }],
      `f′(x) = ${n}x^${n - 1}, so f′(${k}) = ${n} × ${k}^${n - 1} = ${fmt(n * k ** (n - 1))}.`, i + 1));
  }
  for (let i = 0; i < N; i++) {
    const a = 2 + (i % 6), d = 3 + (i % 5), n = 5 + i;
    out.push(build(`m-ap-${i}`, 'Mathematics', 'Sequences and series', JEE, diff(i, N),
      `An AP has first term ${a} and common difference ${d}. What is its ${n}th term?`, fmt(a + (n - 1) * d),
      [{ text: fmt(a + n * d), mis: 'Using n instead of (n−1) in a + (n−1)d' }, { text: fmt(n * d), mis: 'Ignoring the first term' }, { text: fmt(a * n), mis: 'Multiplying first term by n' }],
      `aₙ = a + (n−1)d = ${a} + ${n - 1} × ${d} = ${fmt(a + (n - 1) * d)}.`, i + 2));
  }
  for (let i = 0; i < N; i++) {
    const b = [2, 3, 5, 10][i % 4], k = 2 + (i % 6);
    out.push(build(`m-log-${i}`, 'Mathematics', 'Logarithms', ['TS Inter', 'JEE Main'], diff(i, N),
      `What is log base ${b} of ${b ** k}?`, fmt(k),
      [{ text: fmt(b * k), mis: 'Multiplying base and exponent' }, { text: fmt(b ** k / b), mis: 'Dividing the number by the base' }, { text: fmt(k + 1), mis: 'Off-by-one on the exponent' }],
      `${b ** k} = ${b}^${k}, so log_${b}(${b ** k}) = ${k}.`, i + 3));
  }

  // ---------------- Physics
  for (let i = 0; i < N; i++) {
    const u = 2 * (i % 6), a = 1 + (i % 4), t = 2 + (i % 7);
    out.push(build(`p-kin-${i}`, 'Physics', 'Kinematics', ALL, diff(i, N),
      `A body starts at ${u} m/s and accelerates uniformly at ${a} m/s² for ${t} s. What is its final velocity (m/s)?`, fmt(u + a * t),
      [{ text: fmt(a * t), mis: 'Forgetting the initial velocity u' }, { text: fmt(u + 0.5 * a * t * t), mis: 'Using displacement formula instead of v = u + at' }, { text: fmt(u * t), mis: 'Multiplying u by t' }],
      `v = u + at = ${u} + ${a} × ${t} = ${fmt(u + a * t)} m/s.`, i));
  }
  for (let i = 0; i < N; i++) {
    const m = 2 + (i % 9), a = 2 + (i % 5);
    out.push(build(`p-nlm-${i}`, 'Physics', 'Laws of motion', ALL, diff(i, N),
      `What net force (N) gives a ${m} kg mass an acceleration of ${a} m/s²?`, fmt(m * a),
      [{ text: fmt(m / a), mis: 'Dividing mass by acceleration' }, { text: fmt(m + a), mis: 'Adding instead of multiplying (F = ma)' }, { text: fmt(m * a * 9.8), mis: 'Multiplying by g unnecessarily' }],
      `F = ma = ${m} × ${a} = ${fmt(m * a)} N.`, i + 1));
  }
  for (let i = 0; i < N; i++) {
    const I = 1 + (i % 5), R = 2 * (1 + (i % 8));
    out.push(build(`p-ohm-${i}`, 'Physics', 'Current electricity', ALL, diff(i, N),
      `A current of ${I} A flows through a ${R} Ω resistor. What is the voltage across it (V)?`, fmt(I * R),
      [{ text: fmt(R / I), mis: 'Using V = R/I' }, { text: fmt(I / R), mis: 'Using V = I/R' }, { text: fmt(I * I * R), mis: 'Computing power I²R instead of voltage' }],
      `V = IR = ${I} × ${R} = ${fmt(I * R)} V.`, i + 2));
  }
  for (let i = 0; i < N; i++) {
    const m = 1 + (i % 6), v = 2 + (i % 5) * 2;
    out.push(build(`p-ke-${i}`, 'Physics', 'Work, energy and power', ALL, diff(i, N),
      `What is the kinetic energy (J) of a ${m} kg body moving at ${v} m/s?`, fmt(0.5 * m * v * v),
      [{ text: fmt(m * v * v), mis: 'Missing the ½ in ½mv²' }, { text: fmt(0.5 * m * v), mis: 'Not squaring the velocity' }, { text: fmt(m * v), mis: 'Computing momentum mv instead' }],
      `KE = ½mv² = ½ × ${m} × ${v}² = ${fmt(0.5 * m * v * v)} J.`, i + 3));
  }

  // ---------------- Chemistry
  const molar = [['water (H₂O)', 18], ['carbon dioxide (CO₂)', 44], ['sodium hydroxide (NaOH)', 40], ['methane (CH₄)', 16], ['glucose (C₆H₁₂O₆)', 180]] as const;
  for (let i = 0; i < N; i++) {
    const [name, M] = molar[i % molar.length];
    const n = 1 + (i % 4);
    out.push(build(`c-mole-${i}`, 'Chemistry', 'Mole concept', ALL, diff(i, N),
      `How many moles are in ${n * M} g of ${name}? (Molar mass ${M} g/mol)`, fmt(n),
      [{ text: fmt(n * M * M), mis: 'Multiplying mass by molar mass' }, { text: fmt(M / (n * M)), mis: 'Inverting moles = mass/M' }, { text: fmt(n * M), mis: 'Giving the mass, not moles' }],
      `n = mass / M = ${n * M} / ${M} = ${n} mol.`, i));
  }
  for (let i = 0; i < N; i++) {
    const k = 1 + (i % 13);
    out.push(build(`c-ph-${i}`, 'Chemistry', 'Ionic equilibrium', ALL, diff(i, N),
      `A solution has [H⁺] = 10^−${k} mol/L. What is its pH?`, fmt(k),
      [{ text: fmt(-k), mis: 'Sign error in pH = −log[H⁺]' }, { text: fmt(14 - k), mis: 'Giving pOH instead of pH' }, { text: fmt(k + 1), mis: 'Off-by-one on the exponent' }],
      `pH = −log[H⁺] = −log(10^−${k}) = ${k}.`, i + 1));
  }
  for (let i = 0; i < N; i++) {
    const n = 0.5 * (1 + (i % 6)), V = [0.25, 0.5, 1, 2][i % 4];
    out.push(build(`c-molar-${i}`, 'Chemistry', 'Solutions', ALL, diff(i, N),
      `${fmt(n)} mol of solute is dissolved to make ${fmt(V)} L of solution. What is the molarity (M)?`, fmt(n / V),
      [{ text: fmt(n * V), mis: 'Multiplying moles by volume' }, { text: fmt(V / n), mis: 'Inverting M = n/V' }, { text: fmt(n / (V * 1000)), mis: 'Converting litres to mL wrongly' }],
      `M = n / V = ${fmt(n)} / ${fmt(V)} = ${fmt(n / V)} M.`, i + 2));
  }
  for (let i = 0; i < N; i++) {
    const n = 1 + (i % 5) * 0.5;
    out.push(build(`c-stp-${i}`, 'Chemistry', 'States of matter', ALL, diff(i, N),
      `What volume (L) does ${fmt(n)} mol of an ideal gas occupy at STP? (Take 22.4 L/mol)`, fmt(n * 22.4),
      [{ text: fmt(22.4 / n), mis: 'Dividing 22.4 by moles' }, { text: fmt(n * 24.8), mis: 'Using 24.8 L (room temperature) instead of 22.4 L at STP' }, { text: fmt(n), mis: 'Giving moles, not volume' }],
      `V = n × 22.4 = ${fmt(n)} × 22.4 = ${fmt(n * 22.4)} L.`, i + 3));
  }

  // ---------------- Biology
  for (let i = 0; i < 25; i++) {
    const n = 1 + (i % 8);
    out.push(build(`b-gam-${i}`, 'Biology', 'Principles of inheritance', NEET, diff(i, 25),
      `How many genetically different gametes can an organism heterozygous for ${n} independently assorting gene${n > 1 ? 's' : ''} produce?`, fmt(2 ** n),
      [{ text: fmt(2 * n), mis: 'Using 2n instead of 2ⁿ' }, { text: fmt(n), mis: 'One gamete type per gene' }, { text: fmt(4 ** n), mis: 'Counting genotypes (4ⁿ) instead of gametes' }],
      `Each heterozygous gene gives 2 kinds of allele, so ${n} genes give 2^${n} = ${2 ** n} gamete types.`, i));
  }
  for (let i = 0; i < 25; i++) {
    const q = Math.round((0.1 + (i % 9) * 0.1) * 10) / 10, p = Math.round((1 - q) * 10) / 10;
    out.push(build(`b-hw-${i}`, 'Biology', 'Evolution', NEET, diff(i, 25),
      `In a population in Hardy–Weinberg equilibrium the recessive allele frequency q = ${fmt(q)}. What is the frequency of heterozygotes?`, fmt(2 * p * q),
      [{ text: fmt(p * q), mis: 'Missing the 2 in 2pq' }, { text: fmt(q * q), mis: 'Giving q² (homozygous recessive)' }, { text: fmt(p * p), mis: 'Giving p² (homozygous dominant)' }],
      `p = 1 − q = ${fmt(p)}; heterozygotes = 2pq = 2 × ${fmt(p)} × ${fmt(q)} = ${fmt(2 * p * q)}.`, i + 1));
  }
  const facts: [string, string, string, string, string, string][] = [
    // chapter, stem, correct, wrong1, wrong2, wrong3
    ['Cell: the unit of life', 'Which organelle is the site of aerobic respiration?', 'Mitochondrion', 'Ribosome', 'Golgi body', 'Lysosome'],
    ['Cell: the unit of life', 'Which organelle synthesises proteins?', 'Ribosome', 'Lysosome', 'Centriole', 'Vacuole'],
    ['Cell cycle and cell division', 'In which phase of mitosis do chromosomes line up at the equator?', 'Metaphase', 'Prophase', 'Anaphase', 'Telophase'],
    ['Cell cycle and cell division', 'Crossing over occurs during which stage?', 'Pachytene', 'Leptotene', 'Diakinesis', 'Zygotene'],
    ['Molecular basis of inheritance', 'Which base is found in RNA but not in DNA?', 'Uracil', 'Thymine', 'Adenine', 'Cytosine'],
    ['Molecular basis of inheritance', 'How many base pairs are there per turn of the B-DNA helix (approximately)?', '10', '20', '3.4', '36'],
    ['Human health and disease', 'Which cells does HIV mainly attack?', 'Helper T cells', 'B cells', 'Red blood cells', 'Platelets'],
    ['Breathing and exchange of gases', 'Where does gas exchange take place in human lungs?', 'Alveoli', 'Bronchi', 'Trachea', 'Larynx'],
    ['Body fluids and circulation', 'Which blood group is the universal donor?', 'O negative', 'AB positive', 'A positive', 'B negative'],
    ['Photosynthesis in higher plants', 'Where do the light reactions of photosynthesis occur?', 'Thylakoid membranes', 'Stroma', 'Cytoplasm', 'Mitochondrial matrix'],
    ['Photosynthesis in higher plants', 'Which enzyme fixes CO₂ in the Calvin cycle?', 'RuBisCO', 'PEP carboxylase', 'ATP synthase', 'Hexokinase'],
    ['Neural control and coordination', 'Which part of the brain controls balance and posture?', 'Cerebellum', 'Medulla', 'Hypothalamus', 'Pons'],
    ['Excretory products and their elimination', 'What is the functional unit of the kidney?', 'Nephron', 'Neuron', 'Alveolus', 'Villus'],
    ['Plant kingdom', 'Which group of plants has naked seeds?', 'Gymnosperms', 'Angiosperms', 'Bryophytes', 'Pteridophytes'],
    ['Human reproduction', 'Where does fertilisation normally occur in humans?', 'Ampullary region of the fallopian tube', 'Uterus', 'Cervix', 'Ovary'],
    ['Biotechnology: principles and processes', 'Which enzyme joins DNA fragments?', 'DNA ligase', 'Restriction endonuclease', 'DNA polymerase', 'Helicase'],
    ['Ecosystem', 'What percentage of energy is transferred to the next trophic level (Lindeman’s rule)?', '10%', '1%', '50%', '90%'],
    ['Digestion and absorption', 'Which enzyme begins protein digestion in the stomach?', 'Pepsin', 'Trypsin', 'Amylase', 'Lipase'],
    ['Biomolecules', 'Which bond links amino acids in a protein?', 'Peptide bond', 'Glycosidic bond', 'Phosphodiester bond', 'Hydrogen bond'],
    ['Locomotion and movement', 'Which protein forms the thick filaments of muscle?', 'Myosin', 'Actin', 'Troponin', 'Tropomyosin'],
  ];
  facts.forEach(([chapter, stem, c, w1, w2, w3], i) => {
    out.push(build(`b-fact-${i}`, 'Biology', chapter, NEET, i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard', stem, c,
      [{ text: w1, mis: `Confusing ${c} with ${w1}` }, { text: w2, mis: `Confusing ${c} with ${w2}` }, { text: w3, mis: `Confusing ${c} with ${w3}` }],
      `${c}. ${stem.replace(/\?$/, '')}: ${c}.`, i));
  });
  return out;
}

export const QUESTIONS: PracticeQuestion[] = generate();
export const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
export const SUBJECTS: Subject[] = ['Mathematics', 'Physics', 'Chemistry', 'Biology'];
export const chaptersOf = (subject: Subject) => [...new Set(QUESTIONS.filter((q) => q.subject === subject).map((q) => q.chapter))];

/** Curriculum mapping: question counts per chapter and syllabus. */
export function curriculumMap() {
  const rows = new Map<string, { subject: Subject; chapter: string; total: number; byCurriculum: Record<Curriculum, number> }>();
  for (const q of QUESTIONS) {
    const k = `${q.subject}|${q.chapter}`;
    const r = rows.get(k) ?? { subject: q.subject, chapter: q.chapter, total: 0, byCurriculum: { 'TS Inter': 0, 'JEE Main': 0, NEET: 0 } };
    r.total++;
    for (const c of q.curriculum) r.byCurriculum[c]++;
    rows.set(k, r);
  }
  return [...rows.values()];
}
