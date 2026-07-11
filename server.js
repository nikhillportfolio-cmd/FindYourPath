const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. MASSIVE DYNAMIC QUESTION BANK (UNCHANGED)
const questionsDB = {
    "TechAI": [
        { text: "When faced with a complex software bug, what is your approach?", options: [ { text: "Trace the logic line by line until I find the exact flaw.", tags: { analytical: 3, logic: 3 } }, { text: "Check the server architecture and network traffic for bottlenecks.", tags: { structure: 3, systemsThinking: 2 } }, { text: "Think about how the user caused the error and redesign the flow.", tags: { empathy: 2, creativity: 3 } }, { text: "Write a script to automate the testing process so it never happens again.", tags: { logic: 4, structure: 2 } } ] },
        { text: "Which of these futuristic projects excites you the most?", options: [ { text: "Building an AI model that can predict global weather patterns.", tags: { analytical: 4, research: 2 } }, { text: "Designing a highly secure, unhackable decentralized voting system.", tags: { investigation: 4, logic: 2 } }, { text: "Creating a beautiful, immersive virtual reality operating system.", tags: { creativity: 4, empathy: 2 } }, { text: "Managing the massive server farms that power the internet.", tags: { structure: 4, systemsThinking: 3 } } ] },
        { text: "How do you prefer to learn new technical skills?", options: [ { text: "Reading the raw documentation and API references.", tags: { logic: 3, analytical: 2 } }, { text: "Building a messy prototype just to see how it looks.", tags: { creativity: 3, riskTolerance: 2 } }, { text: "Trying to break into a system to see how it defends itself.", tags: { investigation: 4, logic: 1 } }, { text: "Studying the underlying mathematical theories first.", tags: { analytical: 4, research: 3 } } ] },
        { text: "In a tech team, what role do you naturally fall into?", options: [ { text: "The solitary coder who tackles the hardest algorithms.", tags: { logic: 4, analytical: 3 } }, { text: "The architect who plans how all the pieces connect together.", tags: { systemsThinking: 4, structure: 3 } }, { text: "The security reviewer who looks for vulnerabilities.", tags: { investigation: 4, detail: 3 } }, { text: "The product lead who ensures it looks great and works smoothly.", tags: { creativity: 3, leadership: 2 } } ] },
        { text: "What frustrates you the most in technology?", options: [ { text: "Inefficient, messy code that runs slowly.", tags: { logic: 3, analytical: 3 } }, { text: "Ugly, confusing interfaces that frustrate users.", tags: { empathy: 3, creativity: 3 } }, { text: "Systems that are vulnerable and easily compromised.", tags: { investigation: 3, structure: 3 } }, { text: "When the underlying math or logic is fundamentally flawed.", tags: { analytical: 4, logic: 2 } } ] }
    ],
    "ContentMedia": [
        { text: "What defines a truly great piece of content for you?", options: [ { text: "It goes viral and dominates social media algorithms.", tags: { riskTolerance: 3, analytical: 2 } }, { text: "It tells a deeply moving, beautifully shot visual story.", tags: { creativity: 4, empathy: 2 } }, { text: "It uses perfect grammar and highly persuasive language.", tags: { writing: 4, logic: 2 } }, { text: "It educates the viewer on complex, heavily researched topics.", tags: { research: 3, publicSpeaking: 3 } } ] },
        { text: "When creating a video, where do you spend the most time?", options: [ { text: "On camera, perfecting my delivery and energy.", tags: { publicSpeaking: 4, charisma: 3 } }, { text: "In the editing room, adjusting cuts, color, and pacing.", tags: { creativity: 3, structure: 2 } }, { text: "Writing the script and researching the facts beforehand.", tags: { writing: 4, research: 3 } }, { text: "Analyzing the thumbnail, title, and viewer retention graphs.", tags: { analytical: 4, strategy: 2 } } ] },
        { text: "How do you handle negative feedback or low views?", options: [ { text: "I dive into the analytics to figure out exactly why it failed.", tags: { analytical: 4, structure: 2 } }, { text: "I trust my creative vision and move on to the next project.", tags: { riskTolerance: 3, creativity: 3 } }, { text: "I rewrite my scripts to be more engaging next time.", tags: { writing: 3, resilience: 2 } }, { text: "I ask my community directly what they want to see.", tags: { empathy: 4, charisma: 2 } } ] },
        { text: "Which aspect of the media industry excites you most?", options: [ { text: "Building a personal brand and a loyal following.", tags: { charisma: 4, riskTolerance: 2 } }, { text: "Directing large-scale film sets or commercial shoots.", tags: { leadership: 3, creativity: 3 } }, { text: "Writing copy that drives massive sales and conversions.", tags: { writing: 4, strategy: 3 } }, { text: "Reporting on breaking news and investigating the truth.", tags: { investigation: 4, writing: 2 } } ] },
        { text: "If you had infinite budget, what would you create?", options: [ { text: "A daily, high-energy talk show or podcast.", tags: { publicSpeaking: 4, charisma: 3 } }, { text: "A visually stunning, award-winning documentary.", tags: { creativity: 4, research: 2 } }, { text: "A bestselling book or an influential newsletter.", tags: { writing: 4, structure: 2 } }, { text: "A massive marketing campaign that takes over the internet.", tags: { strategy: 4, analytical: 2 } } ] }
    ],
    "Healthcare": [
        { text: "In a medical setting, where do you feel most comfortable?", options: [ { text: "In the operating room, relying on steady hands and precision.", tags: { precision: 4, pressure: 3 } }, { text: "Sitting with a patient, talking through their mental health trauma.", tags: { empathy: 4, psychology: 3 } }, { text: "In a sterile lab, looking through a microscope at cell cultures.", tags: { research: 4, analytical: 2 } }, { text: "Managing hospital logistics to ensure everything runs smoothly.", tags: { structure: 4, systemsThinking: 3 } } ] },
        { text: "How do you approach a difficult diagnosis?", options: [ { text: "I cross-reference symptoms with medical literature and raw data.", tags: { analytical: 4, biology: 3 } }, { text: "I run physical tests and trust my hands-on clinical experience.", tags: { precision: 3, pressure: 2 } }, { text: "I ask the patient deeply personal questions to find hidden triggers.", tags: { empathy: 3, psychology: 4 } }, { text: "I send the samples to the lab for complex chemical analysis.", tags: { chemistry: 4, research: 3 } } ] },
        { text: "What drives your passion for healthcare?", options: [ { text: "The immediate thrill of saving a life on the edge.", tags: { pressure: 4, biology: 2 } }, { text: "Discovering a new drug that could cure a disease permanently.", tags: { chemistry: 4, research: 4 } }, { text: "Helping someone overcome deep depression or anxiety.", tags: { empathy: 4, psychology: 3 } }, { text: "Fixing broken public health systems so more people get care.", tags: { systemsThinking: 4, governance: 2 } } ] },
        { text: "How do you handle the emotional weight of illness?", options: [ { text: "I compartmentalize and focus purely on the surgical task at hand.", tags: { pressure: 4, logic: 2 } }, { text: "I embrace it and use it to connect with the patient.", tags: { empathy: 4, caregiving: 3 } }, { text: "I channel it into finding a scientific cure in the lab.", tags: { research: 4, analytical: 2 } }, { text: "I focus on the statistics and how to improve survival rates.", tags: { analytical: 4, structure: 2 } } ] },
        { text: "What is your favorite subject to study?", options: [ { text: "Human Anatomy and the mechanics of the body.", tags: { biology: 4, precision: 2 } }, { text: "Neuroscience and human behavioral patterns.", tags: { psychology: 4, research: 2 } }, { text: "Organic Chemistry and pharmacology.", tags: { chemistry: 4, analytical: 2 } }, { text: "Epidemiology and tracking global health data.", tags: { analytical: 3, systemsThinking: 3 } } ] }
    ],
    "LawAdmin": [
        { text: "How do you win an argument?", options: [ { text: "I aggressively pick apart the opponent's logic in front of others.", tags: { debate: 4, publicSpeaking: 3 } }, { text: "I calmly present undeniable data and systemic rules.", tags: { structure: 3, analytical: 3 } }, { text: "I find a diplomatic compromise that benefits both sides.", tags: { diplomacy: 4, empathy: 2 } }, { text: "I cite the exact rulebook or legal precedent that proves I am right.", tags: { compliance: 4, research: 2 } } ] },
        { text: "What level of impact are you aiming for?", options: [ { text: "Winning high-stakes corporate lawsuits for massive clients.", tags: { litigation: 4, strategy: 3 } }, { text: "Running a district and ensuring government policies are executed.", tags: { governance: 4, leadership: 3 } }, { text: "Representing the nation in international treaty negotiations.", tags: { diplomacy: 4, leadership: 2 } }, { text: "Ensuring a multi-billion dollar company stays perfectly legal.", tags: { compliance: 4, structure: 3 } } ] },
        { text: "How do you handle massive volumes of dry text?", options: [ { text: "I read closely to find loopholes I can exploit in court.", tags: { analytical: 3, debate: 3 } }, { text: "I memorize the key points so I can apply the rules perfectly.", tags: { compliance: 4, logic: 2 } }, { text: "I summarize it to brief politicians or executives on strategy.", tags: { governance: 3, strategy: 3 } }, { text: "I look for the societal implications behind the words.", tags: { empathy: 3, research: 3 } } ] },
        { text: "What environment brings out your best performance?", options: [ { text: "The intense, combative arena of a courtroom.", tags: { litigation: 4, pressure: 3 } }, { text: "The structured, hierarchical environment of civil services.", tags: { governance: 4, structure: 3 } }, { text: "The quiet, focused environment of a corporate boardroom.", tags: { strategy: 4, compliance: 3 } }, { text: "A military setting where discipline and justice are paramount.", tags: { discipline: 4, leadership: 2 } } ] },
        { text: "Which of these concepts is most important to you?", options: [ { text: "Absolute Justice.", tags: { adjudication: 4, logic: 2 } }, { text: "Public Welfare.", tags: { governance: 4, empathy: 3 } }, { text: "Corporate Compliance.", tags: { compliance: 4, structure: 3 } }, { text: "National Security.", tags: { discipline: 4, strategy: 3 } } ] }
    ],
    "BusinessHustle": [
        { text: "If you started a company today, what is your primary focus?", options: [ { text: "Pitching investors and raising millions in venture capital.", tags: { charisma: 4, riskTolerance: 4 } }, { text: "Building a flawless supply chain and operational system.", tags: { systemsThinking: 4, structure: 3 } }, { text: "Crafting a brand identity that consumers absolutely love.", tags: { creativity: 3, strategy: 4 } }, { text: "Balancing the spreadsheets to ensure massive profitability.", tags: { analytical: 4, compliance: 2 } } ] },
        { text: "How do you view financial risk?", options: [ { text: "I embrace high risk if the potential reward is massive.", tags: { riskTolerance: 5, strategy: 2 } }, { text: "I calculate risk carefully using data before making a move.", tags: { analytical: 4, structure: 2 } }, { text: "I hate risk and prefer slow, steady, guaranteed growth.", tags: { compliance: 3, structure: 3 } }, { text: "I rely on my intuition and market trends, not just math.", tags: { creativity: 3, riskTolerance: 3 } } ] },
        { text: "What is your management style?", options: [ { text: "I inspire the team with a big vision and let them execute.", tags: { leadership: 4, charisma: 3 } }, { text: "I micromanage the data to ensure perfection.", tags: { analytical: 4, structure: 3 } }, { text: "I focus on building a great culture where people feel valued.", tags: { empathy: 4, leadership: 2 } }, { text: "I am a solo hustler. I prefer to do everything myself.", tags: { riskTolerance: 3, strategy: 2 } } ] },
        { text: "Which metric matters most to you?", options: [ { text: "Top-line revenue and rapid market expansion.", tags: { strategy: 4, riskTolerance: 3 } }, { text: "Customer satisfaction and brand loyalty scores.", tags: { empathy: 3, creativity: 3 } }, { text: "Profit margins and reducing operational costs.", tags: { analytical: 4, structure: 3 } }, { text: "Employee retention and company culture.", tags: { leadership: 4, empathy: 2 } } ] },
        { text: "How do you handle a fierce competitor?", options: [ { text: "I out-market them with a louder, better brand campaign.", tags: { strategy: 4, creativity: 3 } }, { text: "I out-work them by optimizing my supply chain to be cheaper.", tags: { systemsThinking: 4, structure: 3 } }, { text: "I try to acquire them or partner with them.", tags: { diplomacy: 4, negotiation: 4 } }, { text: "I find a completely new niche they haven't noticed yet.", tags: { creativity: 3, strategy: 4 } } ] }
    ],
    "ArtsDesign": [
        { text: "What makes a design 'good'?", options: [ { text: "It functions perfectly and solves a practical problem.", tags: { structure: 4, logic: 2 } }, { text: "It evokes a deep emotional response from the viewer.", tags: { empathy: 4, creativity: 4 } }, { text: "It breaks the rules and does something completely original.", tags: { riskTolerance: 4, creativity: 4 } }, { text: "It is mathematically balanced, symmetrical, and structurally sound.", tags: { analytical: 3, structure: 4 } } ] },
        { text: "When starting a new project, what is your first step?", options: [ { text: "Drawing wild, chaotic sketches to brainstorm.", tags: { creativity: 4, riskTolerance: 2 } }, { text: "Measuring dimensions and creating a strict grid or blueprint.", tags: { structure: 4, analytical: 3 } }, { text: "Researching the history of similar projects for inspiration.", tags: { research: 4, logic: 2 } }, { text: "Talking to the client to deeply understand their emotional needs.", tags: { empathy: 4, strategy: 2 } } ] },
        { text: "What medium do you prefer to work in?", options: [ { text: "Digital software (Figma, Photoshop, CAD).", tags: { logic: 3, structure: 2 } }, { text: "Physical materials (Clay, wood, concrete, canvas).", tags: { creativity: 3, precision: 3 } }, { text: "Space (Designing rooms, buildings, or landscapes).", tags: { systemsThinking: 4, structure: 3 } }, { text: "Concepts (Branding, theory, user experience).", tags: { strategy: 4, empathy: 3 } } ] },
        { text: "How do you handle client revisions?", options: [ { text: "I argue for my design because I know it is aesthetically superior.", tags: { debate: 3, riskTolerance: 3 } }, { text: "I compromise and adjust the design to make them happy.", tags: { diplomacy: 4, empathy: 3 } }, { text: "I show them the data on why my design converts better.", tags: { analytical: 4, strategy: 3 } }, { text: "I strictly follow the brief and make exact requested changes.", tags: { compliance: 4, structure: 2 } } ] },
        { text: "What is your ultimate goal as a creator?", options: [ { text: "To have my art displayed in prestigious galleries.", tags: { creativity: 4, riskTolerance: 2 } }, { text: "To design a building that stands for a hundred years.", tags: { structure: 4, systemsThinking: 3 } }, { text: "To create user interfaces that millions of people use daily.", tags: { strategy: 3, empathy: 3 } }, { text: "To build a highly profitable commercial design agency.", tags: { leadership: 4, strategy: 3 } } ] }
    ]
};

// 2. EXPANDED ROADMAPS WITH PHASES & BOOKS
const roadmaps = {
    "SoftwareDev": { 
        category: "TechAI", title: "Software Engineer", icon: "💻", desc: "Pure logic processing and structural system development.", targetProfile: { logic: 4, analytical: 3 }, 
        phases: [
            { title: "Phase 1: Foundation", steps: "Master Data Structures, Algorithms, and a core back-end language (like Python or Java)." },
            { title: "Phase 2: Project Building", steps: "Build full-stack applications and push them to GitHub to create a portfolio." },
            { title: "Phase 3: Career Entry", steps: "Practice LeetCode problems and apply for junior engineering roles." }
        ],
        books: ["Clean Code by Robert C. Martin", "The Pragmatic Programmer by David Thomas"]
    },
    "AIEngineer": { 
        category: "TechAI", title: "AI/ML Engineer", icon: "🧠", desc: "Heavy abstract mathematical logic and pattern computation.", targetProfile: { analytical: 4, logic: 3, research: 2 }, 
        phases: [
            { title: "Phase 1: Mathematics", steps: "Acquire deep competencies in linear algebra, calculus, and statistics." },
            { title: "Phase 2: ML Frameworks", steps: "Learn Python, TensorFlow, and PyTorch. Build predictive models." },
            { title: "Phase 3: Specialization", steps: "Dive into Neural Networks, NLP, or Computer Vision." }
        ],
        books: ["Deep Learning by Ian Goodfellow", "Life 3.0 by Max Tegmark"]
    },
    "CloudArchitect": { 
        category: "TechAI", title: "Cloud Architect", icon: "☁️", desc: "Design massive server structures that keep the internet running.", targetProfile: { architecture: 4, structure: 3, systemsThinking: 3 }, 
        phases: [
            { title: "Phase 1: Basics", steps: "Understand networking, Linux commands, and basic web servers." },
            { title: "Phase 2: Certifications", steps: "Get certified in AWS Solutions Architect or Azure Admin." },
            { title: "Phase 3: Architecture", steps: "Learn Terraform, Docker, and Kubernetes for scalable deployments." }
        ],
        books: ["Designing Data-Intensive Applications by Martin Kleppmann", "The Phoenix Project by Gene Kim"]
    },
    "CyberSecurity": { 
        category: "TechAI", title: "Cybersecurity Analyst", icon: "🛡️", desc: "Protect networks and find hidden system vulnerabilities.", targetProfile: { investigation: 4, logic: 3, detail: 3 }, 
        phases: [
            { title: "Phase 1: Fundamentals", steps: "Learn Networking, OSI model, and basic scripting." },
            { title: "Phase 2: Practical Skills", steps: "Practice on platforms like TryHackMe and HackTheBox." },
            { title: "Phase 3: Certification", steps: "Acquire Security+ or CEH certifications to enter the field." }
        ],
        books: ["Ghost in the Wires by Kevin Mitnick", "Social Engineering by Christopher Hadnagy"]
    },
    "Surgeon": { 
        category: "Healthcare", title: "Medical Doctor / Surgeon", icon: "🩺", desc: "High pressure, high precision. You save lives directly.", targetProfile: { precision: 4, pressure: 4, biology: 3 }, 
        phases: [
            { title: "Phase 1: Pre-Med", steps: "Clear NEET-UG with high marks in PCB (Physics, Chem, Bio)." },
            { title: "Phase 2: Medical School", steps: "Complete your MBBS degree and mandatory internships." },
            { title: "Phase 3: Residency", steps: "Clear NEET-PG and complete surgical residency training." }
        ],
        books: ["Being Mortal by Atul Gawande", "When Breath Becomes Air by Paul Kalanithi"]
    },
    "Psychiatrist": { 
        category: "Healthcare", title: "Psychologist/Psychiatrist", icon: "🫂", desc: "Deep empathy and psychological insight to heal the human mind.", targetProfile: { empathy: 4, psychology: 4, caregiving: 3 }, 
        phases: [
            { title: "Phase 1: Education", steps: "Pursue a Bachelor's in Psychology or an MBBS (for Psychiatry)." },
            { title: "Phase 2: Specialization", steps: "Complete a Master's/MD in Clinical Psychology or Psychiatry." },
            { title: "Phase 3: Practice", steps: "Acquire clinical hours and get licensed to practice therapy." }
        ],
        books: ["The Body Keeps the Score by Bessel van der Kolk", "Man's Search for Meaning by Viktor Frankl"]
    },
    "BiotechResearcher": { 
        category: "Healthcare", title: "Biomedical Researcher", icon: "🔬", desc: "Methodical and analytical. You discover the cures of tomorrow.", targetProfile: { research: 4, chemistry: 3, analytical: 3 }, 
        phases: [
            { title: "Phase 1: Undergrad", steps: "Complete a B.Sc in Biotechnology or Molecular Biology." },
            { title: "Phase 2: Advanced Study", steps: "Pursue a Master's and a Ph.D. focusing on a specific disease or tech." },
            { title: "Phase 3: Lab Work", steps: "Publish research papers and secure grants for lab experiments." }
        ],
        books: ["The Code Breaker by Walter Isaacson", "The Emperor of All Maladies by Siddhartha Mukherjee"]
    },
    "HospitalAdmin": { 
        category: "Healthcare", title: "Healthcare Admin", icon: "🏥", desc: "Manage hospital logistics to ensure everything runs smoothly.", targetProfile: { structure: 4, systemsThinking: 3, leadership: 2 }, 
        phases: [
            { title: "Phase 1: Core Degree", steps: "Get a Bachelor's degree in Business or Public Health." },
            { title: "Phase 2: Specialization", steps: "Complete an MBA in Healthcare Management." },
            { title: "Phase 3: Leadership", steps: "Start as a department manager and work up to hospital director." }
        ],
        books: ["Lean Hospitals by Mark Graban", "The Innovator's Prescription by Clayton Christensen"]
    },
    "Advocate": { 
        category: "LawAdmin", title: "Litigation Advocate", icon: "⚖️", desc: "High courtroom debate skills and legal interpretation.", targetProfile: { debate: 4, litigation: 3, analytical: 2 }, 
        phases: [
            { title: "Phase 1: Law School", steps: "Clear CLAT and complete your BA LLB degree." },
            { title: "Phase 2: Certification", steps: "Pass the All India Bar Examination (AIBE)." },
            { title: "Phase 3: Practice", steps: "Join a senior advocate's chamber to learn courtroom tactics." }
        ],
        books: ["To Kill a Mockingbird by Harper Lee", "The Rule of Law by Tom Bingham"]
    },
    "IASOfficer": { 
        category: "LawAdmin", title: "Civil Services (IAS)", icon: "🇮🇳", desc: "High systemic governance capacity to manage public districts.", targetProfile: { governance: 4, leadership: 3, empathy: 2 }, 
        phases: [
            { title: "Phase 1: Graduation", steps: "Complete any bachelor's degree while reading current affairs." },
            { title: "Phase 2: Preparation", steps: "Dedicate 1-2 years to intensive UPSC CSE preparation." },
            { title: "Phase 3: Selection", steps: "Clear Prelims, Mains, and the final Personality Test (Interview)." }
        ],
        books: ["India After Gandhi by Ramachandra Guha", "The Difficulty of Being Good by Gurcharan Das"]
    },
    "CompanySecretary": { 
        category: "LawAdmin", title: "Company Secretary (CS)", icon: "📈", desc: "Ensure absolute corporate governance and legal compliance.", targetProfile: { compliance: 4, structure: 4 }, 
        phases: [
            { title: "Phase 1: Foundation", steps: "Register for the ICSI Foundation/CSEET exam." },
            { title: "Phase 2: Executive & Prof", steps: "Clear the Executive and Professional programs." },
            { title: "Phase 3: Articleship", steps: "Complete mandatory practical training in a corporate firm." }
        ],
        books: ["Corporate Governance by Christine Mallin", "Business Law for Managers"]
    },
    "PolicyAnalyst": { 
        category: "LawAdmin", title: "Public Policy Analyst", icon: "📄", desc: "Research socio-economic data to advise governments.", targetProfile: { research: 4, analytical: 3, writing: 3 }, 
        phases: [
            { title: "Phase 1: Education", steps: "Complete a BA in Economics, Political Science, or Sociology." },
            { title: "Phase 2: Specialization", steps: "Pursue a Master's in Public Policy (MPP)." },
            { title: "Phase 3: Think Tanks", steps: "Work with NGOs, Think Tanks, or government advisory panels." }
        ],
        books: ["Thinking, Fast and Slow by Daniel Kahneman", "Nudge by Richard Thaler"]
    },
    "Youtuber": { 
        category: "ContentMedia", title: "Content Creator", icon: "🎥", desc: "High public engagement and direct storytelling profile.", targetProfile: { publicSpeaking: 4, charisma: 4, riskTolerance: 2 }, 
        phases: [
            { title: "Phase 1: Niche Discovery", steps: "Identify a topic you love and can talk about for hours." },
            { title: "Phase 2: Skill Building", steps: "Learn basic video editing, scripting, and thumbnail design." },
            { title: "Phase 3: Consistency", steps: "Post consistently and study analytics to improve audience retention." }
        ],
        books: ["Steal Like an Artist by Austin Kleon", "Contagious by Jonah Berger"]
    },
    "Copywriter": { 
        category: "ContentMedia", title: "Direct Response Copywriter", icon: "✍️", desc: "Write highly persuasive text that drives sales and action.", targetProfile: { writing: 4, strategy: 3, empathy: 2 }, 
        phases: [
            { title: "Phase 1: Psychology", steps: "Study consumer psychology and classic copywriting frameworks." },
            { title: "Phase 2: Practice", steps: "Rewrite successful ads and build a mock portfolio." },
            { title: "Phase 3: Freelance/Agency", steps: "Pitch clients on Upwork or join an advertising agency." }
        ],
        books: ["The Boron Letters by Gary Halbert", "Influence by Robert Cialdini"]
    },
    "VideoEditor": { 
        category: "ContentMedia", title: "Creative Video Editor", icon: "🎬", desc: "Piece together visual pacing and storytelling.", targetProfile: { creativity: 4, structure: 3 }, 
        phases: [
            { title: "Phase 1: Software", steps: "Master Premiere Pro, DaVinci Resolve, or Final Cut." },
            { title: "Phase 2: Storytelling", steps: "Learn color grading, sound design, and narrative pacing." },
            { title: "Phase 3: Showreel", steps: "Edit sample footage to build a high-end professional showreel." }
        ],
        books: ["In the Blink of an Eye by Walter Murch", "Story by Robert McKee"]
    },
    "Founder": { 
        category: "BusinessHustle", title: "Startup Founder", icon: "🚀", desc: "High risk-tolerance and visionary leadership.", targetProfile: { riskTolerance: 4, leadership: 4, charisma: 3 }, 
        phases: [
            { title: "Phase 1: Problem Finding", steps: "Find a painful problem in the market that people will pay to solve." },
            { title: "Phase 2: MVP", steps: "Build a Minimum Viable Product as quickly and cheaply as possible." },
            { title: "Phase 3: Scaling", steps: "Acquire your first 100 users, validate, and pitch to investors." }
        ],
        books: ["The Lean Startup by Eric Ries", "Zero to One by Peter Thiel"]
    },
    "OperationsMgr": { 
        category: "BusinessHustle", title: "Operations Manager", icon: "⚙️", desc: "Build flawless supply chains and internal systems.", targetProfile: { systemsThinking: 4, structure: 4 }, 
        phases: [
            { title: "Phase 1: Education", steps: "Get a degree in Business Administration or Supply Chain Management." },
            { title: "Phase 2: Analytics", steps: "Master Excel, data analytics, and project management tools." },
            { title: "Phase 3: Optimization", steps: "Work in logistics or corporate operations to streamline processes." }
        ],
        books: ["High Output Management by Andrew Grove", "Good to Great by Jim Collins"]
    },
    "UXDesigner": { 
        category: "ArtsDesign", title: "UX/UI Designer", icon: "🎨", desc: "Blend human psychology with beautiful digital interfaces.", targetProfile: { empathy: 4, creativity: 3, strategy: 2 }, 
        phases: [
            { title: "Phase 1: Tools & Theory", steps: "Master Figma and study color theory and typography." },
            { title: "Phase 2: User Research", steps: "Learn how to conduct user interviews and build wireframes." },
            { title: "Phase 3: Portfolio", steps: "Build 3 complete, problem-solving case studies for your portfolio." }
        ],
        books: ["The Design of Everyday Things by Don Norman", "Don't Make Me Think by Steve Krug"]
    },
    "Architect": { 
        category: "ArtsDesign", title: "Structural Architect", icon: "🏛️", desc: "Design physical spaces that are structurally sound and beautiful.", targetProfile: { structure: 4, systemsThinking: 3, creativity: 2 }, 
        phases: [
            { title: "Phase 1: Degree", steps: "Clear NATA or JEE Mains Paper 2 and complete a B.Arch degree." },
            { title: "Phase 2: Software", steps: "Master AutoCAD, SketchUp, and Revit." },
            { title: "Phase 3: Apprenticeship", steps: "Work under a senior architect to understand real-world site management." }
        ],
        books: ["Architecture: Form, Space, and Order by Francis D.K. Ching", "The Architecture of Happiness by Alain de Botton"]
    }
};

app.get('/api/questions', (req, res) => {
    const requestedInterest = req.query.interest; 
    const selectedQuestions = questionsDB[requestedInterest] || questionsDB["TechAI"];
    res.json(selectedQuestions);
});

app.post('/api/calculate-result', (req, res) => {
    const { userTraits, interest } = req.body; 
    
    let careerMatches = [];

    for (const [key, careerData] of Object.entries(roadmaps)) {
        if (careerData.category !== interest) {
            continue; 
        }

        let matchingScore = 0;
        
        for (const [trait, value] of Object.entries(careerData.targetProfile)) {
            if (userTraits[trait]) {
                matchingScore += userTraits[trait] * value; 
            }
        }
        
        careerMatches.push({ key, score: matchingScore, ...careerData });
    }

    careerMatches.sort((a, b) => b.score - a.score);

    // BUG FIX/UPDATE: Send back up to 4 Matches!
    res.json(careerMatches.slice(0, 4)); 
});

app.listen(PORT, () => console.log(`Fixed Matching Engine alive on Port ${PORT}`));