/**
 * Open Book taxonomy: educational categories → examinations → subjects → chapters → concepts.
 * Chapter names follow the current NCERT Class 11/12 textbooks (the core books for TS Intermediate, JEE and
 * NEET). Concept lists are starting points; students may also type their own concept, and admins add
 * subjects/chapters/concepts at runtime (stored in the ob_taxonomy collection and merged in taxonomy()).
 * Exam patterns are the published patterns at the time of writing; admins should check them against each
 * year's information bulletin (they are editable in the AI settings).
 */

export type CategoryId = 'intermediate' | 'engineering' | 'medical' | 'higher';
export type Phase = 1 | 2 | 3; // content priority (§25): 1 = BJC first, 2 = next, 3 = later

export interface Category { id: CategoryId; name: string; short: string; blurb: string }
export const CATEGORIES: Category[] = [
  { id: 'intermediate', name: 'Intermediate Education', short: 'Intermediate', blurb: 'Inter 1st & 2nd year: MPC, BiPC, MEC, CEC, HEC · State Board and NCERT textbooks' },
  { id: 'engineering', name: 'Engineering Entrance Examinations', short: 'JEE & engineering', blurb: 'JEE Main, JEE Advanced, BITSAT, VITEEE, EAPCET, COMEDK' },
  { id: 'medical', name: 'Medical Entrance Examinations', short: 'NEET & medical', blurb: 'NEET UG and medical entrance preparation (Biology, Physics, Chemistry)' },
  { id: 'higher', name: 'Higher Education & Competitive Examinations', short: 'Higher & competitive', blurb: 'IIT-JAM, GATE, CAT, MAT, GMAT, GRE, UPSC, APPSC, TGPSC, SSC, Banking, RRB' },
];

export type QType =
  | 'mcq_single' | 'mcq_multi' | 'assertion_reason' | 'match' | 'fill_blank' | 'true_false' | 'one_word' | 'short' | 'long'
  | 'numerical' | 'application' | 'case' | 'diagram' | 'coding' | 'reasoning' | 'analytical';
export const QTYPES: { id: QType; label: string; objective: boolean }[] = [
  { id: 'mcq_single', label: 'MCQ · single correct', objective: true },
  { id: 'mcq_multi', label: 'MCQ · multiple correct', objective: true },
  { id: 'assertion_reason', label: 'Assertion and reason', objective: true },
  { id: 'match', label: 'Match the following', objective: true },
  { id: 'fill_blank', label: 'Fill in the blanks', objective: true },
  { id: 'true_false', label: 'True or false', objective: true },
  { id: 'one_word', label: 'One-word answer', objective: true },
  { id: 'numerical', label: 'Numerical problem', objective: true },
  { id: 'short', label: 'Short answer', objective: false },
  { id: 'long', label: 'Long answer', objective: false },
  { id: 'application', label: 'Application-based', objective: false },
  { id: 'case', label: 'Case-based', objective: false },
  { id: 'diagram', label: 'Diagram-based', objective: false },
  { id: 'coding', label: 'Coding', objective: false },
  { id: 'reasoning', label: 'Logical reasoning', objective: true },
  { id: 'analytical', label: 'Analytical', objective: false },
];
export const isObjective = (t: QType) => QTYPES.find((q) => q.id === t)?.objective ?? false;

export const DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'very_hard', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { beginner: 'Beginner', easy: 'Easy', medium: 'Medium', hard: 'Hard', very_hard: 'Very hard', advanced: 'Advanced competitive' };

export interface ExamPattern {
  /** question types this exam actually uses; the generator refuses others for this exam */
  types: QType[];
  marks: number;
  negative: number;
  /** minutes for the full paper and its question count, to scale mock durations */
  minutes: number;
  questions: number;
  note: string;
}

export interface Exam {
  id: string;
  name: string;
  category: CategoryId;
  subjects: string[];
  /** which chapter sets apply: '11', '12' or both */
  classes: ('11' | '12')[];
  phase: Phase;
  pattern: ExamPattern;
  /** short warning shown to students (e.g. AIIMS → NEET) */
  notice?: string;
}

const PCM = ['Physics', 'Chemistry', 'Mathematics'];
const PCB = ['Physics', 'Chemistry', 'Biology'];
const BOTH: ('11' | '12')[] = ['11', '12'];
const board = (marks: number): ExamPattern => ({ types: ['short', 'long', 'one_word', 'fill_blank', 'mcq_single', 'numerical'], marks, negative: 0, minutes: 180, questions: 24, note: 'TS Intermediate (TSBIE) theory paper: very short (2 marks), short (4 marks) and long (8 marks) answers, 3 hours.' });

export const EXAMS: Exam[] = [
  // A. Intermediate
  { id: 'inter1-mpc', name: 'Intermediate 1st Year · MPC', category: 'intermediate', subjects: PCM, classes: ['11'], phase: 1, pattern: board(2) },
  { id: 'inter2-mpc', name: 'Intermediate 2nd Year · MPC', category: 'intermediate', subjects: PCM, classes: ['12'], phase: 1, pattern: board(2) },
  { id: 'inter1-bipc', name: 'Intermediate 1st Year · BiPC', category: 'intermediate', subjects: PCB, classes: ['11'], phase: 1, pattern: board(2) },
  { id: 'inter2-bipc', name: 'Intermediate 2nd Year · BiPC', category: 'intermediate', subjects: PCB, classes: ['12'], phase: 1, pattern: board(2) },
  { id: 'inter-mec', name: 'Intermediate · MEC', category: 'intermediate', subjects: ['Mathematics', 'Economics', 'Commerce'], classes: BOTH, phase: 2, pattern: board(2) },
  { id: 'inter-cec', name: 'Intermediate · CEC', category: 'intermediate', subjects: ['Civics', 'Economics', 'Commerce'], classes: BOTH, phase: 2, pattern: board(2) },
  { id: 'inter-hec', name: 'Intermediate · HEC', category: 'intermediate', subjects: ['History', 'Economics', 'Civics'], classes: BOTH, phase: 2, pattern: board(2) },
  // B. Engineering
  { id: 'jee-main', name: 'JEE Main', category: 'engineering', subjects: PCM, classes: BOTH, phase: 1, pattern: { types: ['mcq_single', 'numerical'], marks: 4, negative: 1, minutes: 180, questions: 75, note: 'NTA JEE Main Paper 1: 25 questions per subject (20 single-correct MCQs and 5 numerical-value questions), +4 / −1, 3 hours.' } },
  { id: 'jee-advanced', name: 'JEE Advanced', category: 'engineering', subjects: PCM, classes: BOTH, phase: 1, pattern: { types: ['mcq_single', 'mcq_multi', 'numerical', 'match'], marks: 4, negative: 1, minutes: 180, questions: 51, note: 'Two papers of 3 hours; single-correct, multiple-correct (partial marking), numerical and matching-list questions. The mix changes each year; check the official paper.' } },
  { id: 'iit-prep', name: 'IIT Entrance Preparation', category: 'engineering', subjects: PCM, classes: BOTH, phase: 1, pattern: { types: ['mcq_single', 'mcq_multi', 'numerical', 'assertion_reason', 'match', 'application'], marks: 4, negative: 1, minutes: 180, questions: 60, note: 'Foundation-to-advanced IIT preparation mixing JEE Main and Advanced styles.' } },
  { id: 'eapcet-e', name: 'TS / AP EAPCET (Engineering)', category: 'engineering', subjects: PCM, classes: BOTH, phase: 1, pattern: { types: ['mcq_single'], marks: 1, negative: 0, minutes: 180, questions: 160, note: '160 single-correct MCQs (80 Mathematics, 40 Physics, 40 Chemistry), 1 mark each, no negative marking, 3 hours.' } },
  { id: 'bitsat', name: 'BITSAT', category: 'engineering', subjects: [...PCM, 'English Proficiency', 'Logical Reasoning'], classes: BOTH, phase: 2, pattern: { types: ['mcq_single', 'reasoning'], marks: 3, negative: 1, minutes: 180, questions: 130, note: 'Computer-based, 130 MCQs, +3 / −1, 3 hours, with optional bonus questions.' } },
  { id: 'viteee', name: 'VITEEE', category: 'engineering', subjects: [...PCM, 'English', 'Aptitude'], classes: BOTH, phase: 2, pattern: { types: ['mcq_single'], marks: 1, negative: 0, minutes: 150, questions: 125, note: '125 MCQs, no negative marking, 2.5 hours.' } },
  { id: 'comedk', name: 'COMEDK UGET', category: 'engineering', subjects: PCM, classes: BOTH, phase: 2, pattern: { types: ['mcq_single'], marks: 1, negative: 0, minutes: 180, questions: 180, note: '180 MCQs (60 per subject), 1 mark each, no negative marking, 3 hours.' } },
  { id: 'eng-other', name: 'Other engineering entrances', category: 'engineering', subjects: PCM, classes: BOTH, phase: 2, pattern: { types: ['mcq_single', 'numerical'], marks: 4, negative: 1, minutes: 180, questions: 90, note: 'Generic engineering-entrance pattern.' } },
  // C. Medical
  { id: 'neet-ug', name: 'NEET UG', category: 'medical', subjects: PCB, classes: BOTH, phase: 1, pattern: { types: ['mcq_single', 'assertion_reason', 'match'], marks: 4, negative: 1, minutes: 180, questions: 180, note: 'NTA NEET UG: 180 compulsory single-correct MCQs (Physics 45, Chemistry 45, Biology 90) including statement, assertion–reason and match-the-list styles, +4 / −1, 3 hours.' } },
  { id: 'eapcet-am', name: 'TS / AP EAPCET (Agriculture & Pharmacy)', category: 'medical', subjects: PCB, classes: BOTH, phase: 1, pattern: { types: ['mcq_single'], marks: 1, negative: 0, minutes: 180, questions: 160, note: '160 MCQs (80 Biology, 40 Physics, 40 Chemistry), 1 mark each, no negative marking.' } },
  { id: 'aiims', name: 'AIIMS-related preparation', category: 'medical', subjects: PCB, classes: BOTH, phase: 1, pattern: { types: ['mcq_single', 'assertion_reason'], marks: 4, negative: 1, minutes: 180, questions: 180, note: 'AIIMS MBBS seats are filled through NEET UG since 2020; preparation follows the NEET pattern.' }, notice: 'AIIMS no longer holds its own MBBS entrance: since 2020 admission is through NEET UG. These resources follow the NEET pattern.' },
  { id: 'med-prep', name: 'Medical entrance preparation', category: 'medical', subjects: PCB, classes: BOTH, phase: 1, pattern: { types: ['mcq_single', 'assertion_reason', 'match', 'application'], marks: 4, negative: 1, minutes: 180, questions: 180, note: 'NEET-style preparation.' } },
  // D. Higher education & competitive
  ...([
    ['iit-jam', 'IIT-JAM', ['Physics', 'Chemistry', 'Mathematics', 'Biotechnology'], { types: ['mcq_single', 'mcq_multi', 'numerical'], marks: 2, negative: 0.66, minutes: 180, questions: 60, note: 'MCQ, MSQ and NAT sections, 3 hours (organised by a different IIT each year).' }],
    ['gate', 'GATE', ['Engineering Mathematics', 'General Aptitude', 'Electrical Engineering', 'Computer Science', 'Mechanical Engineering', 'Civil Engineering', 'Electronics'], { types: ['mcq_single', 'mcq_multi', 'numerical'], marks: 2, negative: 0.66, minutes: 180, questions: 65, note: '65 questions (MCQ, MSQ, NAT), 100 marks, 3 hours; negative marking only for MCQs.' }],
    ['cat', 'CAT', ['Verbal Ability', 'Data Interpretation & Logical Reasoning', 'Quantitative Ability'], { types: ['mcq_single', 'numerical', 'reasoning'], marks: 3, negative: 1, minutes: 120, questions: 68, note: 'Three sections with sectional time limits; MCQs (−1) and type-in-answer questions (no negative).' }],
    ['mat', 'MAT', ['Language Comprehension', 'Mathematical Skills', 'Data Analysis', 'Intelligence & Critical Reasoning', 'Indian & Global Environment'], { types: ['mcq_single', 'reasoning'], marks: 1, negative: 0.25, minutes: 150, questions: 200, note: '200 MCQs across five sections.' }],
    ['gmat', 'GMAT', ['Quantitative Reasoning', 'Verbal Reasoning', 'Data Insights'], { types: ['mcq_single', 'reasoning', 'analytical'], marks: 1, negative: 0, minutes: 135, questions: 64, note: 'GMAT Focus Edition: three sections, adaptive. Official guides are copyrighted (links only).' }],
    ['gre', 'GRE', ['Verbal Reasoning', 'Quantitative Reasoning', 'Analytical Writing'], { types: ['mcq_single', 'mcq_multi', 'numerical', 'analytical'], marks: 1, negative: 0, minutes: 118, questions: 54, note: 'Shorter GRE General Test; official guides are copyrighted (links only).' }],
    ['upsc', 'UPSC Civil Services', ['Indian Polity', 'History', 'Geography', 'Economy', 'Environment', 'Science & Technology', 'CSAT'], { types: ['mcq_single', 'long', 'analytical'], marks: 2, negative: 0.66, minutes: 120, questions: 100, note: 'Prelims GS Paper I: 100 MCQs, 2 marks, 1/3 negative; Mains are descriptive.' }],
    ['appsc', 'APPSC', ['General Studies', 'Mental Ability', 'Andhra Pradesh History & Culture'], { types: ['mcq_single', 'long'], marks: 1, negative: 0.33, minutes: 150, questions: 150, note: 'Group exams: objective screening and descriptive mains; check each notification.' }],
    ['tgpsc', 'TGPSC (formerly TSPSC)', ['General Studies', 'Mental Ability', 'Telangana History & Movement'], { types: ['mcq_single', 'long'], marks: 1, negative: 0, minutes: 150, questions: 150, note: 'Renamed TGPSC in 2024; check each notification for the pattern.' }],
    ['ssc', 'SSC', ['General Intelligence & Reasoning', 'General Awareness', 'Quantitative Aptitude', 'English Comprehension'], { types: ['mcq_single', 'reasoning'], marks: 2, negative: 0.5, minutes: 60, questions: 100, note: 'CGL Tier I style: 100 MCQs, 60 minutes.' }],
    ['banking', 'Banking (IBPS / SBI / RBI)', ['Reasoning Ability', 'Quantitative Aptitude', 'English Language', 'General Awareness'], { types: ['mcq_single', 'reasoning', 'analytical'], marks: 1, negative: 0.25, minutes: 60, questions: 100, note: 'Prelims: 100 MCQs with sectional timing, 1/4 negative.' }],
    ['rrb', 'RRB (Railways)', ['Mathematics', 'General Intelligence & Reasoning', 'General Awareness', 'General Science'], { types: ['mcq_single', 'reasoning'], marks: 1, negative: 0.33, minutes: 90, questions: 100, note: 'CBT: 100 MCQs, 1/3 negative; varies by recruitment.' }],
    ['govt-other', 'Other government examinations', ['General Studies', 'Reasoning', 'Quantitative Aptitude'], { types: ['mcq_single', 'reasoning'], marks: 1, negative: 0.25, minutes: 90, questions: 100, note: 'Generic competitive pattern.' }],
  ] as [string, string, string[], ExamPattern][]).map(([id, name, subjects, pattern]): Exam => ({ id, name, category: 'higher', subjects, classes: BOTH, phase: 3, pattern })),
];
export const EXAM_BY_ID = new Map(EXAMS.map((e) => [e.id, e]));

// ---------------------------------------------------------------- chapters (NCERT) with key concepts
// "Chapter|concept; concept; …"
const C11: Record<string, string[]> = {
  Physics: [
    'Units and Measurement|SI units; Significant figures; Dimensional analysis; Errors in measurement',
    'Motion in a Straight Line|Displacement and velocity; Acceleration; Equations of motion; Relative velocity in one dimension; Motion graphs',
    'Motion in a Plane|Vectors and resolution; Projectile motion; Uniform circular motion; Relative velocity in two dimensions',
    'Laws of Motion|Newton\'s laws; Friction; Free-body diagrams; Circular motion dynamics; Impulse and momentum',
    'Work, Energy and Power|Work-energy theorem; Potential energy and springs; Conservation of mechanical energy; Power; Collisions',
    'System of Particles and Rotational Motion|Centre of mass; Torque; Moment of inertia; Angular momentum conservation; Rolling motion',
    'Gravitation|Universal law of gravitation; Acceleration due to gravity; Gravitational potential energy; Escape velocity; Kepler\'s laws and satellites',
    'Mechanical Properties of Solids|Stress and strain; Hooke\'s law; Young\'s modulus; Elastic potential energy',
    'Mechanical Properties of Fluids|Pressure and Pascal\'s law; Bernoulli\'s principle; Viscosity; Surface tension',
    'Thermal Properties of Matter|Thermal expansion; Specific heat and calorimetry; Latent heat; Heat transfer',
    'Thermodynamics|First law of thermodynamics; Thermodynamic processes; Heat engines; Second law and Carnot engine',
    'Kinetic Theory|Ideal gas equation; Kinetic interpretation of temperature; Degrees of freedom; Mean free path',
    'Oscillations|Simple harmonic motion; Spring-mass system; Simple pendulum; Energy in SHM',
    'Waves|Transverse and longitudinal waves; Speed of a wave; Standing waves; Beats; Doppler effect',
  ],
  Chemistry: [
    'Some Basic Concepts of Chemistry|Mole concept; Stoichiometry; Limiting reagent; Concentration terms',
    'Structure of Atom|Bohr model; Quantum numbers; Electronic configuration; Photoelectric effect; De Broglie relation',
    'Classification of Elements and Periodicity in Properties|Periodic trends; Ionisation enthalpy; Electron gain enthalpy; Electronegativity',
    'Chemical Bonding and Molecular Structure|VSEPR theory; Hybridisation; Molecular orbital theory; Hydrogen bonding; Dipole moment',
    'Thermodynamics|Enthalpy; Hess\'s law; Entropy; Gibbs free energy',
    'Equilibrium|Law of mass action; Le Chatelier\'s principle; pH and ionic equilibrium; Buffer solutions; Solubility product',
    'States of Matter|Gas laws; Ideal gas equation; Dalton\'s law of partial pressures; Kinetic molecular theory of gases',
    'Redox Reactions|Oxidation number; Balancing redox reactions; Redox titrations',
    'Organic Chemistry – Some Basic Principles and Techniques|IUPAC nomenclature; Isomerism; Inductive and resonance effects; Reaction intermediates; Purification methods',
    'Hydrocarbons|Alkanes; Alkenes and Markovnikov\'s rule; Alkynes; Aromaticity and benzene reactions',
  ],
  Mathematics: [
    'Sets|Types of sets; Venn diagrams; Operations on sets',
    'Relations and Functions|Cartesian product; Relations; Functions and their graphs',
    'Trigonometric Functions|Radian measure; Trigonometric identities; Compound angles; Trigonometric equations',
    'Complex Numbers and Quadratic Equations|Algebra of complex numbers; Modulus and argument; Quadratic equations with complex roots; Nature and sum of roots',
    'Linear Inequalities|Solving linear inequalities; Graphical solution',
    'Permutations and Combinations|Fundamental principle of counting; Permutations; Combinations',
    'Binomial Theorem|Binomial expansion; General term; Middle term',
    'Sequences and Series|Arithmetic progression; Geometric progression; AM–GM inequality; Sum of special series',
    'Straight Lines|Slope; Forms of a line; Distance of a point from a line; Angle between lines',
    'Conic Sections|Circle; Parabola; Ellipse; Hyperbola',
    'Introduction to Three Dimensional Geometry|Coordinates in 3D; Distance formula; Section formula',
    'Limits and Derivatives|Limits; Standard limits; Derivative from first principles; Rules of differentiation',
    'Statistics|Mean deviation; Variance and standard deviation',
    'Probability|Sample space and events; Axiomatic probability; Addition rule',
  ],
  Biology: [
    'The Living World|Characteristics of living organisms; Taxonomic categories; Binomial nomenclature',
    'Biological Classification|Five kingdom classification; Monera; Protista; Fungi; Viruses and lichens',
    'Plant Kingdom|Algae; Bryophytes; Pteridophytes; Gymnosperms; Angiosperms; Plant life cycles',
    'Animal Kingdom|Basis of classification; Non-chordate phyla; Chordates',
    'Morphology of Flowering Plants|Root, stem and leaf; Inflorescence; Flower; Fruit and seed',
    'Anatomy of Flowering Plants|Tissues; Tissue systems; Dicot and monocot anatomy; Secondary growth',
    'Structural Organisation in Animals|Animal tissues; Organ systems of the frog',
    'Cell: The Unit of Life|Cell theory; Prokaryotic cells; Eukaryotic cell organelles; Cell membrane',
    'Biomolecules|Carbohydrates; Proteins; Nucleic acids; Enzymes',
    'Cell Cycle and Cell Division|Cell cycle phases; Mitosis; Meiosis',
    'Photosynthesis in Higher Plants|Light reactions; Calvin cycle; C4 pathway; Photorespiration',
    'Respiration in Plants|Glycolysis; Krebs cycle; Electron transport system; Respiratory quotient',
    'Plant Growth and Development|Growth phases; Plant growth regulators; Photoperiodism and vernalisation',
    'Breathing and Exchange of Gases|Respiratory organs; Mechanism of breathing; Transport of gases',
    'Body Fluids and Circulation|Blood and lymph; Cardiac cycle; ECG; Double circulation',
    'Excretory Products and their Elimination|Nephron structure; Urine formation; Regulation of kidney function',
    'Locomotion and Movement|Types of movement; Muscle contraction; Skeletal system; Joints',
    'Neural Control and Coordination|Neuron and nerve impulse; Synapse; Central nervous system',
    'Chemical Coordination and Integration|Endocrine glands; Hormones and their actions; Mechanism of hormone action',
  ],
};
const C12: Record<string, string[]> = {
  Physics: [
    'Electric Charges and Fields|Coulomb\'s law; Electric field and field lines; Electric dipole; Gauss\'s law',
    'Electrostatic Potential and Capacitance|Electric potential; Equipotential surfaces; Capacitors and dielectrics; Energy stored in a capacitor',
    'Current Electricity|Ohm\'s law and resistivity; Kirchhoff\'s laws; Wheatstone bridge; Cells, EMF and internal resistance',
    'Moving Charges and Magnetism|Biot–Savart law; Ampere\'s circuital law; Force on a moving charge; Moving coil galvanometer',
    'Magnetism and Matter|Bar magnet as a dipole; Earth\'s magnetism; Magnetic properties of materials',
    'Electromagnetic Induction|Faraday\'s law; Lenz\'s law; Motional EMF; Self and mutual inductance',
    'Alternating Current|AC voltage and phasors; LCR circuit and resonance; Power factor; Transformers',
    'Electromagnetic Waves|Displacement current; Electromagnetic spectrum',
    'Ray Optics and Optical Instruments|Reflection and mirrors; Refraction and lenses; Total internal reflection; Prism; Microscope and telescope',
    'Wave Optics|Huygens principle; Young\'s double-slit experiment; Diffraction; Polarisation',
    'Dual Nature of Radiation and Matter|Photoelectric effect; Einstein\'s equation; Matter waves',
    'Atoms|Rutherford model; Bohr model of hydrogen; Hydrogen spectrum',
    'Nuclei|Mass defect and binding energy; Nuclear fission and fusion; Radioactive decay',
    'Semiconductor Electronics|Intrinsic and extrinsic semiconductors; p-n junction; Diode as a rectifier',
  ],
  Chemistry: [
    'Solutions|Concentration terms; Raoult\'s law; Colligative properties; Van\'t Hoff factor',
    'Electrochemistry|Galvanic cells; Nernst equation; Conductance; Electrolysis and Faraday\'s laws',
    'Chemical Kinetics|Rate of reaction; Order and molecularity; Integrated rate laws; Arrhenius equation',
    'The d- and f-Block Elements|Transition metal properties; Lanthanoid contraction; KMnO4 and K2Cr2O7',
    'Coordination Compounds|Werner theory; IUPAC naming of complexes; Isomerism in complexes; Crystal field theory',
    'Haloalkanes and Haloarenes|SN1 and SN2 reactions; Elimination reactions; Haloarenes reactions',
    'Alcohols, Phenols and Ethers|Preparation of alcohols; Acidity of phenols; Reactions of ethers',
    'Aldehydes, Ketones and Carboxylic Acids|Nucleophilic addition; Aldol and Cannizzaro reactions; Acidity of carboxylic acids',
    'Amines|Basicity of amines; Diazonium salts; Preparation of amines',
    'Biomolecules|Carbohydrates; Proteins; Vitamins; Nucleic acids',
  ],
  Mathematics: [
    'Relations and Functions|Types of relations; Types of functions; Composition and invertible functions',
    'Inverse Trigonometric Functions|Principal values; Properties of inverse trigonometric functions',
    'Matrices|Types of matrices; Matrix operations; Transpose and symmetric matrices; Invertible matrices',
    'Determinants|Properties of determinants; Area of a triangle; Adjoint and inverse; Solving linear equations',
    'Continuity and Differentiability|Continuity; Chain rule; Implicit differentiation; Logarithmic differentiation',
    'Application of Derivatives|Rate of change; Increasing and decreasing functions; Maxima and minima',
    'Integrals|Integration by substitution; Integration by parts; Partial fractions; Definite integrals and properties',
    'Application of Integrals|Area under curves; Area between two curves',
    'Differential Equations|Order and degree; Variable separable; Homogeneous equations; Linear differential equations',
    'Vector Algebra|Vector addition; Dot product; Cross product',
    'Three Dimensional Geometry|Direction cosines; Equation of a line; Angle between lines; Shortest distance',
    'Linear Programming|Formulating LPP; Graphical method',
    'Probability|Conditional probability; Bayes\' theorem; Random variables; Binomial distribution',
  ],
  Biology: [
    'Sexual Reproduction in Flowering Plants|Microsporogenesis; Pollination; Double fertilisation; Apomixis and polyembryony',
    'Human Reproduction|Male and female reproductive systems; Gametogenesis; Menstrual cycle; Fertilisation and implantation',
    'Reproductive Health|Contraception; Sexually transmitted infections; Assisted reproductive technologies',
    'Principles of Inheritance and Variation|Mendel\'s laws; Incomplete dominance and codominance; Sex determination; Genetic disorders',
    'Molecular Basis of Inheritance|DNA structure; Replication; Transcription; Genetic code and translation; Lac operon',
    'Evolution|Origin of life; Evidence of evolution; Natural selection; Hardy–Weinberg principle',
    'Human Health and Disease|Common diseases; Immunity; AIDS and cancer; Drugs and alcohol abuse',
    'Microbes in Human Welfare|Microbes in household products; Industrial products; Sewage treatment; Biofertilisers',
    'Biotechnology: Principles and Processes|Restriction enzymes; Cloning vectors; PCR; Recombinant DNA process',
    'Biotechnology and its Applications|Bt crops; RNA interference; Genetically engineered insulin; Gene therapy',
    'Organisms and Populations|Population attributes; Population growth models; Population interactions',
    'Ecosystem|Productivity; Decomposition; Energy flow; Ecological pyramids',
    'Biodiversity and Conservation|Patterns of biodiversity; Loss of biodiversity; In-situ and ex-situ conservation',
  ],
};

export interface Chapter { subject: string; cls: '11' | '12'; name: string; concepts: string[] }
const parse = (cls: '11' | '12', m: Record<string, string[]>): Chapter[] =>
  Object.entries(m).flatMap(([subject, rows]) => rows.map((r) => { const [name, c] = r.split('|'); return { subject, cls, name, concepts: c.split(';').map((x) => x.trim()) }; }));
export const BASE_CHAPTERS: Chapter[] = [...parse('11', C11), ...parse('12', C12)];

/** Practice-bank chapter names → NCERT chapters, so existing practice attempts count towards mastery. */
export const PRACTICE_CHAPTER_ALIAS: Record<string, string> = {
  'Quadratic equations': 'Complex Numbers and Quadratic Equations',
  Differentiation: 'Limits and Derivatives',
  'Sequences and series': 'Sequences and Series',
  Logarithms: 'Relations and Functions',
  Kinematics: 'Motion in a Straight Line',
  'Laws of motion': 'Laws of Motion',
  'Current electricity': 'Current Electricity',
  'Work, energy and power': 'Work, Energy and Power',
  'Principles of inheritance': 'Principles of Inheritance and Variation',
  'Ionic equilibrium': 'Equilibrium',
  'Mole concept': 'Some Basic Concepts of Chemistry',
  'States of matter': 'States of Matter',
};

export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const conceptKey = (subject: string, chapter: string, concept: string) => `${slug(subject)}/${slug(chapter)}/${slug(concept)}`;
