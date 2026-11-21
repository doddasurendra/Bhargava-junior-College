/**
 * OFFICIAL college content: the 2027-28 brochure ("Final Version 2027 v3.2 - 29 oct"), word for word.
 * English is the source. te.ts and hi.ts have exactly the same shape (TODO(college): native-speaker review).
 * Names, qualifications and postal addresses are not translated.
 */
export const en = {
  cover: {
    eyebrow: 'Admission 2027-28 Open',
    title: 'Two Years. One Dream.',
    sub: 'The right choice today shapes your child’s tomorrow.',
    society: 'By Sri Vihana Educational Society',
    recognised: 'Recognised by Govt. of Telangana, College Code: 58560',
    exams: 'JEE Main · JEE Advanced · NEET-UG',
  },
  photoNote: 'All photographs featured are original photographs taken on our campuses.',

  leadership: {
    eyebrow: 'Our Leadership',
    title: 'Experience, Vision and Commitment.',
    subtitle: 'A Message from the Chairman',
    name: 'Venugopal Gattu',
    role: 'Chairman & Co-founder',
    salutation: 'Dear Students and Parents,',
    message: [
      'A very warm welcome to you all from Bhargava Junior College.',
      'My professional journey spans over 28 years, during which I have held senior management positions in leading multinational organizations, gaining valuable experience in leadership, problem-solving and strategic thinking. However, my deepest passion has always been teaching Physics and inspiring young minds to explore the beauty of science.',
      'At Bhargava, we believe that true education goes beyond academics. It is about creating a healthy, motivating environment that nurtures the mind, character and confidence of every student. Our students are at the core of everything we do.',
    ],
    visionLabel: 'Vision',
    vision: 'We envision being a beacon of academic excellence to help aspiring students excel in prestigious entrance examinations such as IIT-JEE & NEET.',
    missionLabel: 'Mission',
    mission: [
      'At Bhargava Junior College, we are committed to providing students with a transformative educational experience through redefined academic coaching methodologies and a meticulously designed curriculum. By staying at the forefront of educational innovation, we ensure that every student receives nothing short of the best.',
      'Our mission is to equip students with strong logical, analytical and technical skills, enabling them to excel in their chosen fields and achieve their goals in competitive examinations such as IIT-JEE & NEET.',
      'We are equally committed to nurturing intellectual growth, academic development and emotional well-being within a collaborative yet competitive learning environment, encouraging every student to explore and realise their maximum potential.',
    ],
    closing: [
      'Driven by a deep passion for teaching, our educators connect with students, understand their aspirations and guide them every step of the way. Over the years, our faculty have proudly mentored numerous students who have secured admissions to some of the nation’s most prestigious institutions in Engineering and Medicine.',
      'Our goal is to instil the joy of learning while equipping students with the knowledge, skills, and mindset required for success in competitive examinations.',
    ],
    motto: 'Balance is our mantra of Life',
  },

  different: {
    eyebrow: 'What makes Bhargava different?',
    title: 'More than a classroom. A Place to Learn, Grow and Succeed.',
    intro: 'At Bhargava, every aspect of student life is thoughtfully designed to nurture focused learning, personal attention, continuous progress and overall well-being.',
    items: [
      { title: 'Expert Faculty & Mentorship', body: 'Learn from experienced and passionate educators who bring subject expertise, conceptual clarity and continuous mentorship to help students progress towards their IIT-JEE & NEET goals.' },
      { title: 'Technology-Enabled Learning', body: 'Smart classrooms and digital learning resources make concepts more visual, interactive and engaging, supporting deeper understanding and effective learning.' },
      { title: 'Personal Attention', body: 'With classes capped at 40 students, our focused environment enables faculty to understand individual strengths, identify learning gaps and provide timely guidance for consistent academic growth.' },
      { title: 'Structured Academic System', body: 'Daily practice, regular tests, mock test series, periodic evaluations, chapter-wise doubt resolution and detailed performance analysis help students prepare for Board examinations alongside IIT-JEE or NEET.' },
      { title: 'Safe, Supportive & Balanced Campus Life', body: 'A disciplined and homely environment, with Three-tier security, CCTV surveillance, wardens, Counselling and time-management guidance, helps students remain safe, confident and focused.' },
      { title: 'Board + IIT-JEE / NEET Preparation', body: 'Our integrated academic approach ensures that students are well prepared for Board examinations alongside IIT-JEE or NEET, maintaining the right balance between both.' },
      { title: 'Modern Infrastructure', body: 'Smart classrooms, well-equipped laboratories, technology-enabled learning spaces, spacious libraries and green surroundings create an environment designed for focused learning, holistic development and academic excellence.' },
      { title: 'Beyond Academics', body: 'Because a healthy student learns better.' },
    ],
    beyondTitle: 'Beyond Academics',
    beyond: [
      { title: 'Games & Sports', body: 'Playtime and outdoor activities keep students active and fresh.' },
      { title: 'Nutritious Food', body: 'Fresh, balanced and hygienic meals that fuel long study days.' },
      { title: 'Workshop', body: 'Sessions on study skills, time management and exam strategy.' },
      { title: 'Life Skills', body: 'Personal Counselling and mentoring that build confidence, discipline and balance.' },
    ],
    differenceTitle: 'The Bhargava Difference',
    difference: 'Individual Attention. Structured Preparation. Strong Foundations. Complete Care.',
    seeAll: 'See what makes Bhargava different',
  },

  parents: {
    eyebrow: 'What parents care about',
    title: 'Your Aspirations. Our Responsibility.',
    tagline: 'Because behind every student is a family with big dreams.',
    items: [
      { q: 'Will my child receive the individual attention they need?', a: 'With classrooms capped at 40 students, our experienced faculty can understand individual needs, provide timely guidance and support consistent academic growth.' },
      { q: 'Will my child’s progress be tracked regularly?', a: 'Daily practice, regular tests, mock examinations and periodic evaluations help us measure progress and identify areas that need attention.' },
      { q: 'How will my child handle pressure?', a: 'Personalised counselling, mentoring and time-management guidance help students remain balanced, confident and focused.' },
      { q: 'Will my child be safe and comfortable?', a: 'A disciplined, homely campus supported by CCTV surveillance, security personnel and a caring environment helps students focus on their learning.' },
      { q: 'Will my child receive the right academic direction?', a: 'Experienced mentors, chapter-wise doubt resolution and focused guidance help students work purposefully towards their IIT-JEE & NEET goals.' },
      { q: 'Will Board preparation be covered too?', a: 'Our integrated academic approach prepares students for Board examinations alongside IIT-JEE & NEET, without compromising competitive examination preparation.' },
    ],
  },

  faculty: {
    eyebrow: 'Faculty',
    title: 'The Power Houses — MPC & BiPC',
    groups: ['The Mathematics Power Houses', 'The Physics Power Houses', 'The Chemistry Power Houses', 'The Botany & Zoology Power Houses'],
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Botany & Zoology'],
    years: 'Years of experience',
    expertise: {
      'Expert in Concept Clarity': 'Expert in Concept Clarity',
      'Expert in Problem Solving': 'Expert in Problem Solving',
      'Expert in Concept Building': 'Expert in Concept Building',
      'Expert in Applications': 'Expert in Applications',
      'Expert in Plant Sciences': 'Expert in Plant Sciences',
      'Expert in Zoology Concepts': 'Expert in Zoology Concepts',
    } as Record<string, string>,
    meetAll: 'Meet all 16',
  },

  courses: {
    eyebrow: 'Courses offered',
    intro: 'Focused, integrated programmes for JEE Main · JEE Advanced & NEET with a clear academic pathway.',
    highlightsLabel: 'Course highlights',
    jee: {
      label: 'Engineering',
      exams: 'JEE Main · JEE Advanced · IIT',
      kind: 'Two-Year Integrated Programmes',
      body: 'For students moving to Class XI, this is a rigorous two-year integrated programmes for IIT-JEE, combining Intermediate Board preparation with JEE Main and JEE Advanced.',
      highlights: [
        { t: 'Concept-Based Learning', b: 'Strong fundamentals through conceptual, NCERT-aligned teaching by expert faculty.' },
        { t: 'Personalised Attention', b: 'Limited batch size for focused mentoring and doubt resolution.' },
        { t: 'Advanced Study Material', b: 'Topic-wise material with graded exercises for JEE Main and JEE Advanced.' },
        { t: 'Daily Practice & Revision', b: 'Daily practice papers (DPPs), regular revision and spaced learning to improve retention.' },
        { t: 'Systematic Testing', b: 'Regular JEE pattern tests and All India Test Series (AITS) with detailed analysis.' },
        { t: 'Performance & Improvement', b: 'Continuous benchmarking, targeted practice and structured guidance to achieve top ranks.' },
      ],
    },
    neet: {
      label: 'Medical',
      exams: 'NEET-UG',
      kind: 'Two-Year Integrated Programme',
      body: 'For students moving to Class XI. A focused two-year integrated programme for NEET, designed to build strong conceptual foundations, master the NEET syllabus and develop the speed, accuracy, and confidence required to excel.',
      highlights: [
        { t: 'Concept-Based, NCERT-Focused Learning', b: 'Strong fundamentals in Physics, Chemistry and Biology through NCERT-aligned teaching.' },
        { t: 'Expert NEET Faculty', b: 'Experienced faculty with personalised mentoring and effective doubt clarification.' },
        { t: 'Comprehensive Study Material', b: 'Topic-wise NEET material, graded exercises and extensive exam-oriented practice.' },
        { t: 'Daily Practice & Revision', b: 'Daily practice papers (DPPs), repeated practice and scientifically planned revision.' },
        { t: 'Regular Testing & Analysis', b: 'Regular NEET-level tests, mock tests and performance analysis to track progress.' },
        { t: 'Vast Resource Support', b: 'Access to a wide collection of NCERT-based resources for comprehensive preparation.' },
      ],
    },
  },

  evolve: {
    title: 'EVOLVE — The Bhargava Learning Model',
    intro: 'Six steps, from concept to excellence, repeated for every chapter, in every subject.',
    sub: 'How a Student Grows, Step by Step',
    steps: [
      { t: 'Explore Concepts Clearly', b: 'Build strong foundations through clear, structured teaching of every concept.' },
      { t: 'Validate Through Application', b: 'Apply each concept to problems to confirm real understanding.' },
      { t: 'Optimise With Practice', b: 'Daily practice papers (DPPs) sharpen speed and accuracy.' },
      { t: 'Learn From Tests & Gaps', b: 'Weekly tests and mock series reveal gaps, each gap becomes a lesson.' },
      { t: 'Verify & Clarify Doubts', b: 'Chapter-wise doubt resolution sessions close every open question.' },
      { t: 'Excel Through Continuous Improvement', b: 'Periodic evaluations and mentoring helps students stay on track.' },
    ],
  },

  campusLife: {
    title: 'Campus Life at Bhargava Junior College',
    motto: 'Vidhya • Vruddhi • Vikasam',
    intro: 'An environment designed for focused learning, healthy living and all-round growth.',
    blocks: [
      { title: 'Laboratories', tagline: 'Hands-on Learning for a Stronger Tomorrow', body: 'Well-equipped laboratories for Physics, Chemistry and other subjects provide opportunities for practical learning, experimentation and stronger conceptual understanding.', captions: ['Chemistry Lab', 'Physics Lab'] },
      { title: 'Smart Classrooms', tagline: 'Modern Classrooms for a Brighter Future', body: 'Spacious, technology-enabled classrooms create a focused learning environment. With a maximum of 40 students per classroom, our faculty ensure meaningful interaction and individual attention.', captions: ['Digital Classroom', 'Spacious Classroom'] },
      { title: 'Hostel Life', tagline: 'Safe, Comfortable & Home-like Environment', body: 'A home away from home, where discipline meets care. With comfortable accommodation, green surroundings and a purposeful routine, students stay focused on their goals while growing with confidence, independence and a sense of belonging.', captions: ['Boys Hostel', 'Girls Hostel'] },
      { title: 'Hygienic & Nutritious Mess', tagline: 'Healthy Food for a Healthier Future', body: 'A clean and hygienic dining environment with fresh, balanced and nutritious meals supports the health, energy and well-being of our students. Meal plans are designed with nutrition and hygiene in mind.', captions: ['Dining Hall', 'Nutritious Meals'] },
      { title: 'Sports & Recreation', tagline: 'Play · Stay Fit · Build Team Spirit', body: 'A healthy academic environment also needs time for movement and recreation. Our campus offers dedicated spaces for sports and physical activities, helping students stay active, refreshed and mentally balanced.', captions: ['Playground', 'Basketball Court'] },
      { title: 'The Bhargava Environment', tagline: 'A Modern Gurukula Rooted in Nature', body: 'Set across approximately 1.5 acres of lush greenery, our campus provides a spacious, peaceful and relatively noise-free environment conducive to focused learning and holistic development.', captions: ['Yoga in green surroundings', 'Morning yoga on campus'] },
    ],
    values: ['Academic Excellence', 'Healthy Living', 'Safety & Security', 'Holistic Development', 'Balanced Student Life'],
    closing: 'A place to learn. A place to grow. A place to belong.',
  },

  campuses: {
    eyebrow: 'Our Campuses',
    title: 'Three campuses. One academic purpose.',
    intro: 'Bhargava Junior College provides purpose-built learning environments for different student needs, residential programmes for boys and girls, and a day-scholar campus, with the same academic focus, systems and commitment across every campus.',
    strip: 'Three campuses • One standard • One Bhargava experience',
    stripItems: ['Safe Environment', 'Experienced Faculty', 'Proven Systems', 'Holistic Environment'],
    items: [
      { name: 'Girls Residential Campus', location: 'Bairamalguda', tagline: 'Safe. Supportive. Focused.', features: ['Dedicated girls’ residential campus', '24×7 security and CCTV surveillance', 'Nutritious and hygienic meals', 'Homely, disciplined residential environment', 'Academic support, mentoring and personal attention', 'Spaces designed for focused study, rest and recreation'] },
      { name: 'Boys Residential Campus', location: 'Kuntloor', tagline: 'Disciplined. Focused. Growth-oriented.', features: ['Dedicated boys’ residential campus', '24×7 security and CCTV surveillance', 'Nutritious meals and structured residential routines', 'Academic mentoring and doubt support', 'Sports, recreation and healthy daily routines', 'Environment designed for focused learning and personal development'] },
      { name: 'Day Scholar Campus', location: 'LB Nagar, Hyderabad', tagline: 'Accessible. Academic. Student-focused.', features: ['Dedicated day-scholar campus', 'Modern classrooms and academic facilities', 'Focused IIT-JEE and NEET preparation', 'Regular practice, testing and performance tracking', 'Personalised academic guidance', 'Safe and supportive campus environment'] },
    ],
    standardTitle: 'One Bhargava Standard',
    standard: 'Across all three campuses, students experience the same core academic philosophy: experienced faculty, concept-based learning, regular practice and assessment, personalised attention, doubt resolution, Counselling and a balanced environment.',
  },

  contact: {
    bannerTitle: 'Your Child’s Next Two Years Matter. Make Them Count.',
    bannerOpen: 'Admission 2027-28 Open',
    discover: 'Discover the difference. Discover Bhargava.',
    addressesTitle: 'Our addresses',
    offices: ['Central Administration Office', 'Boys Residential', 'Girls Residential'],
    call: 'Call',
    email: 'Email',
    website: 'Website',
    mapTitle: 'Find our campuses',
    pins: ['Bairamalguda (Girls Residential)', 'LB Nagar (Day Scholar)', 'Kuntloor (Boys Residential)'],
    directions: 'Open in Google Maps',
    mapNote: 'Not to scale. Tap a pin for directions.',
    visit: 'Book a campus visit',
    scan: 'Scan to download',
    download: 'Download brochure',
    downloadNote: 'The official 2027-28 brochure (PDF, 8 pages).',
    quote: 'With the utmost personal care, we empower every student towards success.',
    motto: 'Vidhya · Vruddhi · Vikasam — Balance is our mantra of life.',
  },
};

export type BrochureText = typeof en;
