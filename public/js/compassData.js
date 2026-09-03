/**
 * PRAXiS Career Compass - Structured Career & Assessment Database
 * Supports 20+ domains, 15 multidimensional traits, scenario-based adaptive questions,
 * 5-phase roadmaps, interactive reality checks, learning resources, and communication exercises.
 */

(function(root) {
    'use strict';

    // -------------------------------------------------------------
    // 1. THE 15 MEASURED DIMENSIONS
    // -------------------------------------------------------------
    const COMPASS_DIMENSIONS = {
        analyticalReasoning: {
            id: "analyticalReasoning",
            name: "Analytical Reasoning",
            icon: "🔬",
            category: "Thinking",
            desc: "Deconstructing complex datasets, identifying hidden patterns, and applying rigorous logic."
        },
        systemsThinking: {
            id: "systemsThinking",
            name: "Systems Thinking",
            icon: "🧩",
            category: "Thinking",
            desc: "Understanding architectural interdependencies, feedback loops, and holistic workflows."
        },
        creativity: {
            id: "creativity",
            name: "Creativity & Innovation",
            icon: "💡",
            category: "Thinking",
            desc: "Divergent thinking, aesthetic intuition, and imagining novel solutions from first principles."
        },
        problemSolving: {
            id: "problemSolving",
            name: "Practical Problem Solving",
            icon: "🛠️",
            category: "Thinking",
            desc: "Hands-on troubleshooting, overcoming blockers, and pragmatic resolution of operational challenges."
        },
        communication: {
            id: "communication",
            name: "Communication & Articulation",
            icon: "🎙️",
            category: "Communication",
            desc: "Translating complex concepts into crisp messages, empathetic listening, and storytelling."
        },
        leadership: {
            id: "leadership",
            name: "Leadership & Initiative",
            icon: "👑",
            category: "Work Style",
            desc: "Setting strategic direction, taking decisive accountability, and rallying others toward a shared vision."
        },
        collaboration: {
            id: "collaboration",
            name: "Collaboration & Team Dynamics",
            icon: "🤝",
            category: "Work Style",
            desc: "Thriving in multidisciplinary teams, facilitating consensus, and elevating peer capabilities."
        },
        independence: {
            id: "independence",
            name: "Autonomy & Independent Focus",
            icon: "🦅",
            category: "Work Style",
            desc: "Sustaining long stretches of deep, self-directed work with minimal oversight."
        },
        execution: {
            id: "execution",
            name: "Execution & Rigor",
            icon: "⚡",
            category: "Work Style",
            desc: "Disciplined delivery, meticulous attention to detail, and meeting high craft standards."
        },
        riskTolerance: {
            id: "riskTolerance",
            name: "Risk Tolerance & Ambiguity",
            icon: "🎲",
            category: "Values",
            desc: "Navigating uncertainty, betting on bold experiments, and adapting swiftly when conditions shift."
        },
        curiosity: {
            id: "curiosity",
            name: "Intellectual Curiosity",
            icon: "🔍",
            category: "Motivation",
            desc: "Inherent appetite for learning, exploring cutting-edge frontiers, and questioning existing conventions."
        },
        workEnvironment: {
            id: "workEnvironment",
            name: "Environment Flexibility",
            icon: "🌐",
            category: "Environment",
            desc: "Preference for modern asynchronous, remote, or dynamic lab/field workspaces over static routines."
        },
        careerValues: {
            id: "careerValues",
            name: "Societal Impact & Purpose",
            icon: "🌱",
            category: "Values",
            desc: "Drive to build technology, institutions, or services that demonstrably improve human lives."
        },
        interests: {
            id: "interests",
            name: "Interdisciplinary Breadth",
            icon: "🧭",
            category: "Interests",
            desc: "Connecting disparate fields such as tech + design, science + ethics, or business + engineering."
        },
        motivation: {
            id: "motivation",
            name: "Drive for Mastery",
            icon: "🎯",
            category: "Motivation",
            desc: "Internal drive to achieve world-class excellence in a specialized craft."
        }
    };

    // -------------------------------------------------------------
    // 2. THE 20+ CAREER DOMAINS
    // -------------------------------------------------------------
    const COMPASS_DOMAINS = [
        { id: "tech_ai", name: "Technology & AI", icon: "💻", color: "blue", desc: "Software, Machine Learning, Systems Architecture, Cybersecurity & Cloud Platforms" },
        { id: "engineering", name: "Engineering", icon: "⚙️", color: "sky", desc: "Mechanical, Robotics, Electrical, Civil & Aerospace Engineering" },
        { id: "data_analytics", name: "Data & Analytics", icon: "📊", color: "indigo", desc: "Data Science, Business Intelligence, Quantitative Modeling & Big Data Engineering" },
        { id: "science_research", name: "Science & Research", icon: "🔬", color: "teal", desc: "Biotechnology, Physics, Environmental Research & Clinical Discoveries" },
        { id: "finance", name: "Finance & Quantitative", icon: "📈", color: "emerald", desc: "Investment Banking, Quantitative Trading, Fintech & Asset Management" },
        { id: "business_management", name: "Business & Management", icon: "🏢", color: "slate", desc: "Product Management, Strategic Operations, Management Consulting & Organizational Leadership" },
        { id: "entrepreneurship", name: "Entrepreneurship & Startups", icon: "🚀", color: "purple", desc: "Venture Creation, Product-Market Fit, Bootstrapping & Scaling High-Growth Companies" },
        { id: "healthcare", name: "Healthcare & Medicine", icon: "🩺", color: "rose", desc: "Clinical Medicine, Nursing, Medical Diagnostics, Healthtech & Public Health" },
        { id: "law", name: "Law & Advocacy", icon: "⚖️", color: "amber", desc: "Corporate Law, Intellectual Property, Constitutional Litigation & Human Rights Advocacy" },
        { id: "government_policy", name: "Government & Public Policy", icon: "🏛️", color: "yellow", desc: "Public Policy Strategy, Civil Service, Urban Governance & International Relations" },
        { id: "education", name: "Education & EdTech", icon: "🎓", color: "blue", desc: "Instructional Design, Academic Teaching, EdTech Product Development & Mentorship" },
        { id: "psychology_human_services", name: "Psychology & Human Services", icon: "🧠", color: "violet", desc: "Clinical Psychology, Cognitive Behavioral Counseling, Social Work & Behavioral Economics" },
        { id: "marketing_sales", name: "Marketing & Strategic Sales", icon: "📣", color: "orange", desc: "Brand Strategy, Growth Marketing, Product Marketing & Strategic Enterprise Sales" },
        { id: "design_creative", name: "Design & Creative", icon: "🎨", color: "pink", desc: "UI/UX & Product Design, Visual Identity, 3D Motion & Creative Direction" },
        { id: "media_communication", name: "Media & Communication", icon: "🎙️", color: "cyan", desc: "Journalism, Multimedia Storytelling, Podcasting & Corporate Communications" },
        { id: "architecture", name: "Architecture & Spatial Design", icon: "📐", color: "stone", desc: "Architectural Design, Urban Planning, Sustainable Building & Spatial Informatics" },
        { id: "sports_fitness", name: "Sports & Performance", icon: "🏃", color: "emerald", desc: "Sports Science, Athletic Performance Coaching, Biomechanics & Physical Rehabilitation" },
        { id: "hospitality", name: "Hospitality & Experience", icon: "🛎️", color: "amber", desc: "Luxury Experience Design, Global Tourism Strategy & Event Operations" },
        { id: "skilled_technical", name: "Skilled & Technical Crafts", icon: "🔧", color: "zinc", desc: "Precision Manufacturing, Mechatronics, High-Tech Aviation Maintenance & Specialist Trades" },
        { id: "emerging_interdisciplinary", name: "Emerging & Interdisciplinary", icon: "🌐", color: "indigo", desc: "Quantum Computing, Synthetic Biology, Climate Tech & Human-AI Interaction Design" }
    ];

    // -------------------------------------------------------------
    // 3. ADAPTIVE SCENARIO-BASED QUESTIONS POOL
    // Non-obvious, realistic situations testing multi-dimensional trade-offs.
    // -------------------------------------------------------------
    const COMPASS_QUESTIONS = [
        // =========================================================
        // CORE ASSESSMENT QUESTIONS (Simple, Conversational, 8-15 Words)
        // =========================================================
        {
            id: "q01",
            stage: "core",
            category: "Problem Solving",
            type: "problem_solving",
            text: "You get a difficult problem. What do you do first?",
            question: "You get a difficult problem. What do you do first?",
            options: [
                {
                    text: "Break it into smaller parts",
                    signals: { analyticalReasoning: 3, problemSolving: 2 },
                    traits: ["Analytical", "Logical"]
                },
                {
                    text: "Ask someone for their ideas",
                    signals: { collaboration: 3, communication: 2 },
                    traits: ["Collaborative", "Social"]
                },
                {
                    text: "Try a fresh, creative approach",
                    signals: { creativity: 3, riskTolerance: 2 },
                    traits: ["Creative", "Inventive"]
                },
                {
                    text: "Make a step-by-step plan",
                    signals: { systemsThinking: 2, execution: 3 },
                    traits: ["Organized", "Methodical"]
                }
            ]
        },
        {
            id: "q02",
            stage: "core",
            category: "Work Style",
            type: "work_style",
            text: "What kind of work environment helps you focus best?",
            question: "What kind of work environment helps you focus best?",
            options: [
                {
                    text: "A quiet desk working on my own",
                    signals: { independence: 4, analyticalReasoning: 1, workEnvironment: 2 },
                    traits: ["Independent", "Focused"]
                },
                {
                    text: "A lively room with a team",
                    signals: { collaboration: 4, communication: 2, workEnvironment: 2 },
                    traits: ["Collaborative", "Outgoing"]
                },
                {
                    text: "A workshop building real things",
                    signals: { execution: 3, problemSolving: 2, workEnvironment: 3 },
                    traits: ["Hands-On", "Builder"]
                },
                {
                    text: "A flexible space with lots of variety",
                    signals: { riskTolerance: 3, curiosity: 2, workEnvironment: 3 },
                    traits: ["Adaptable", "Dynamic"]
                }
            ]
        },
        {
            id: "q03",
            stage: "core",
            category: "Organization",
            type: "situational",
            text: "Your team project is messy and unorganized. What do you do?",
            question: "Your team project is messy and unorganized. What do you do?",
            options: [
                {
                    text: "Map out how all parts connect",
                    signals: { systemsThinking: 4, analyticalReasoning: 2 },
                    traits: ["Systems Thinker", "Structured"]
                },
                {
                    text: "Take charge and assign clear tasks",
                    signals: { leadership: 4, execution: 2 },
                    traits: ["Leader", "Decisive"]
                },
                {
                    text: "Talk to everyone to clear confusion",
                    signals: { communication: 3, collaboration: 3 },
                    traits: ["Communicator", "Diplomatic"]
                },
                {
                    text: "Jump right in and start fixing things",
                    signals: { problemSolving: 3, execution: 3 },
                    traits: ["Action-Oriented", "Pragmatic"]
                }
            ]
        },
        {
            id: "q04",
            stage: "core",
            category: "Problem Solving",
            type: "situational",
            text: "You find a mistake right before a deadline. What do you do?",
            question: "You find a mistake right before a deadline. What do you do?",
            options: [
                {
                    text: "Trace the root cause and fix it",
                    signals: { analyticalReasoning: 3, problemSolving: 3, execution: 1 },
                    traits: ["Troubleshooter", "Calm"]
                },
                {
                    text: "Rally the team to fix it together",
                    signals: { leadership: 2, collaboration: 4 },
                    traits: ["Team-First", "Supportive"]
                },
                {
                    text: "Find a clever workaround quickly",
                    signals: { creativity: 3, problemSolving: 2 },
                    traits: ["Resourceful", "Quick Thinker"]
                },
                {
                    text: "Tell everyone honestly and adjust the plan",
                    signals: { communication: 3, careerValues: 3 },
                    traits: ["Honest", "Transparent"]
                }
            ]
        },
        {
            id: "q05",
            stage: "core",
            category: "Learning Style",
            type: "learning_preference",
            text: "How do you prefer to learn a brand-new topic?",
            question: "How do you prefer to learn a brand-new topic?",
            options: [
                {
                    text: "Read the theory and understand the logic",
                    signals: { analyticalReasoning: 3, curiosity: 3, independence: 2 },
                    traits: ["Logical", "Thorough"]
                },
                {
                    text: "Build a small project to test it",
                    signals: { execution: 3, problemSolving: 3, creativity: 1 },
                    traits: ["Hands-On", "Experimental"]
                },
                {
                    text: "Discuss and debate ideas with others",
                    signals: { communication: 3, collaboration: 3, curiosity: 1 },
                    traits: ["Interactive", "Social"]
                },
                {
                    text: "Study real-world examples of success",
                    signals: { systemsThinking: 3, curiosity: 2, interests: 2 },
                    traits: ["Observant", "Strategic"]
                }
            ]
        },
        {
            id: "q06",
            stage: "core",
            category: "Creativity",
            type: "creativity",
            text: "When you need a new idea, what helps you most?",
            question: "When you need a new idea, what helps you most?",
            options: [
                {
                    text: "Looking at facts and patterns for clues",
                    signals: { analyticalReasoning: 3, systemsThinking: 2 },
                    traits: ["Data-Driven", "Investigative"]
                },
                {
                    text: "Connecting two completely unrelated topics",
                    signals: { creativity: 4, interests: 3 },
                    traits: ["Imaginative", "Lateral Thinker"]
                },
                {
                    text: "Bouncing ideas back and forth with friends",
                    signals: { communication: 3, collaboration: 3 },
                    traits: ["Collaborative", "Open"]
                },
                {
                    text: "Sketching or building something rough immediately",
                    signals: { execution: 2, creativity: 2, problemSolving: 2 },
                    traits: ["Prototyper", "Action-Oriented"]
                }
            ]
        },
        {
            id: "q07",
            stage: "core",
            category: "Leadership",
            type: "leadership",
            text: "Your team needs to pick a project direction. What do you do?",
            question: "Your team needs to pick a project direction. What do you do?",
            options: [
                {
                    text: "Weigh the pros and cons using facts",
                    signals: { analyticalReasoning: 3, systemsThinking: 2 },
                    traits: ["Analytical", "Fair"]
                },
                {
                    text: "Take charge and guide the team",
                    signals: { leadership: 4, communication: 2 },
                    traits: ["Leader", "Decisive"]
                },
                {
                    text: "Make sure everyone feels included and heard",
                    signals: { collaboration: 4, careerValues: 2 },
                    traits: ["Empathetic", "Supportive"]
                },
                {
                    text: "Suggest a bold and unexpected direction",
                    signals: { creativity: 3, riskTolerance: 4 },
                    traits: ["Bold", "Visionary"]
                }
            ]
        },
        {
            id: "q08",
            stage: "core",
            category: "Interests",
            type: "quick_preference",
            text: "You have a free afternoon. Which sounds most fun?",
            question: "You have a free afternoon. Which sounds most fun?",
            options: [
                {
                    text: "Solving strategy puzzles, coding, or gaming",
                    signals: { analyticalReasoning: 2, systemsThinking: 2, motivation: 3 },
                    traits: ["Strategic", "Focused"]
                },
                {
                    text: "Drawing, writing stories, or making music",
                    signals: { creativity: 4, independence: 2 },
                    traits: ["Creative", "Artistic"]
                },
                {
                    text: "Helping someone learn or volunteering nearby",
                    signals: { careerValues: 4, communication: 3 },
                    traits: ["Helpful", "Purpose-Driven"]
                },
                {
                    text: "Working on a side project or business",
                    signals: { leadership: 2, execution: 2, riskTolerance: 3 },
                    traits: ["Enterprising", "Driven"]
                }
            ]
        },
        {
            id: "q09",
            stage: "core",
            category: "Communication",
            type: "communication",
            text: "When explaining a hard idea, what is your style?",
            question: "When explaining a hard idea, what is your style?",
            options: [
                {
                    text: "Use clear diagrams and clean logic",
                    signals: { systemsThinking: 3, analyticalReasoning: 3 },
                    traits: ["Logical", "Clear"]
                },
                {
                    text: "Tell an engaging story with simple examples",
                    signals: { communication: 4, creativity: 2 },
                    traits: ["Storyteller", "Engaging"]
                },
                {
                    text: "Show a practical example they can try",
                    signals: { problemSolving: 2, execution: 2, communication: 2 },
                    traits: ["Practical", "Direct"]
                },
                {
                    text: "Listen first to find where they are stuck",
                    signals: { communication: 3, collaboration: 3, careerValues: 1 },
                    traits: ["Patient", "Empathetic"]
                }
            ]
        },
        {
            id: "q10",
            stage: "core",
            category: "Motivation",
            type: "trade_off",
            text: "Which kind of challenge sounds more exciting to you?",
            question: "Which kind of challenge sounds more exciting to you?",
            options: [
                {
                    text: "Mastering a difficult skill with high precision",
                    signals: { motivation: 4, execution: 3, independence: 2 },
                    traits: ["Craftsman", "Disciplined"]
                },
                {
                    text: "Trying a risky new idea that might fail",
                    signals: { riskTolerance: 4, creativity: 2, curiosity: 2 },
                    traits: ["Adventurous", "Bold"]
                },
                {
                    text: "Guiding a group to complete a big goal",
                    signals: { leadership: 3, systemsThinking: 2, collaboration: 2 },
                    traits: ["Organizer", "Driver"]
                },
                {
                    text: "Solving problems that help your community directly",
                    signals: { careerValues: 4, communication: 2 },
                    traits: ["Community-Minded", "Caring"]
                }
            ]
        },
        {
            id: "q11",
            stage: "core",
            category: "Work Style",
            type: "quick_preference",
            text: "What type of task gives you the most satisfaction?",
            question: "What type of task gives you the most satisfaction?",
            options: [
                {
                    text: "Untangling a complicated puzzle or fixing errors",
                    signals: { problemSolving: 4, analyticalReasoning: 3 },
                    traits: ["Troubleshooter", "Persistent"]
                },
                {
                    text: "Designing something beautiful that people enjoy",
                    signals: { creativity: 4, communication: 2 },
                    traits: ["Designer", "User-Focused"]
                },
                {
                    text: "Organizing chaotic work so it runs smoothly",
                    signals: { systemsThinking: 3, execution: 3 },
                    traits: ["Organizer", "Efficient"]
                },
                {
                    text: "Inspiring and motivating people to reach a goal",
                    signals: { leadership: 3, communication: 3 },
                    traits: ["Motivator", "People-Centered"]
                }
            ]
        },
        {
            id: "q12",
            stage: "core",
            category: "Cognitive Style",
            type: "trade_off",
            text: "When working on something, what do you notice first?",
            question: "When working on something, what do you notice first?",
            options: [
                {
                    text: "Small details and tiny flaws others miss",
                    signals: { analyticalReasoning: 2, execution: 4, independence: 2 },
                    traits: ["Detail-Oriented", "Precise"]
                },
                {
                    text: "The big picture and how everything connects",
                    signals: { systemsThinking: 4, curiosity: 2, interests: 2 },
                    traits: ["Big Picture", "Strategic"]
                },
                {
                    text: "How the final result will make people feel",
                    signals: { careerValues: 3, communication: 3 },
                    traits: ["Empathetic", "Human-Centered"]
                },
                {
                    text: "Clever shortcuts to get it done faster",
                    signals: { problemSolving: 3, creativity: 2 },
                    traits: ["Resourceful", "Fast Mover"]
                }
            ]
        },
        {
            id: "q13",
            stage: "core",
            category: "Curiosity",
            type: "learning_preference",
            text: "If you could look behind the scenes, what would you pick?",
            question: "If you could look behind the scenes, what would you pick?",
            options: [
                {
                    text: "How cutting-edge AI and computer systems work",
                    signals: { curiosity: 4, systemsThinking: 3, analyticalReasoning: 2 },
                    traits: ["Tech-Curious", "Logical"]
                },
                {
                    text: "How medical scientists discover life-saving treatments",
                    signals: { careerValues: 3, curiosity: 3, analyticalReasoning: 2 },
                    traits: ["Science-Minded", "Impact-Driven"]
                },
                {
                    text: "How creative studios make animations and games",
                    signals: { creativity: 4, curiosity: 2, interests: 2 },
                    traits: ["Creative", "Curious"]
                },
                {
                    text: "How successful founders build fast-growing companies",
                    signals: { leadership: 3, execution: 2, riskTolerance: 2 },
                    traits: ["Business-Minded", "Strategic"]
                }
            ]
        },
        {
            id: "q14",
            stage: "core",
            category: "Values",
            type: "values",
            text: "Years from now, what would make you proudest of your work?",
            question: "Years from now, what would make you proudest of your work?",
            options: [
                {
                    text: "Building reliable systems that millions of people trust",
                    signals: { systemsThinking: 3, motivation: 3, execution: 2 },
                    traits: ["System Builder", "High Standard"]
                },
                {
                    text: "Creating something genuinely original and innovative",
                    signals: { creativity: 4, riskTolerance: 2 },
                    traits: ["Original", "Innovator"]
                },
                {
                    text: "Helping people improve their health and daily lives",
                    signals: { careerValues: 4, communication: 2 },
                    traits: ["Caring", "Impactful"]
                },
                {
                    text: "Building a thriving organization from the ground up",
                    signals: { leadership: 3, riskTolerance: 3, execution: 2 },
                    traits: ["Founder", "Achiever"]
                }
            ]
        },

        // =========================================================
        // ADAPTIVE DISCRIMINATOR QUESTIONS (Separating Competing Fields)
        // =========================================================
        {
            id: "ad01",
            stage: "adaptive",
            category: "Tech & Digital",
            type: "discriminator",
            discriminates: ["tech_ai", "data_analytics", "business_management", "design_creative"],
            text: "Which type of day sounds most exciting to you?",
            question: "Which type of day sounds most exciting to you?",
            options: [
                {
                    text: "Building software and making code work",
                    signals: { systemsThinking: 3, problemSolving: 2, analyticalReasoning: 1 },
                    boostDomain: "tech_ai",
                    traits: ["Software Engineer", "Builder"]
                },
                {
                    text: "Finding hidden patterns in numbers and data",
                    signals: { analyticalReasoning: 4, curiosity: 2 },
                    boostDomain: "data_analytics",
                    traits: ["Data Analyst", "Investigator"]
                },
                {
                    text: "Deciding what a product should do and why",
                    signals: { leadership: 2, communication: 3, systemsThinking: 1 },
                    boostDomain: "business_management",
                    traits: ["Product Manager", "Strategist"]
                },
                {
                    text: "Designing visual screens and easy user interfaces",
                    signals: { creativity: 4, communication: 2 },
                    boostDomain: "design_creative",
                    traits: ["UI/UX Designer", "Visual"]
                }
            ]
        },
        {
            id: "ad02",
            stage: "adaptive",
            category: "Science & Making",
            type: "discriminator",
            discriminates: ["engineering", "science_research", "healthcare", "emerging_interdisciplinary"],
            text: "Which real-world problem would you rather tackle?",
            question: "Which real-world problem would you rather tackle?",
            options: [
                {
                    text: "Designing robots, machines, or physical structures",
                    signals: { execution: 3, systemsThinking: 2, problemSolving: 3 },
                    boostDomain: "engineering",
                    traits: ["Engineer", "Maker"]
                },
                {
                    text: "Running experiments to discover new scientific facts",
                    signals: { curiosity: 4, analyticalReasoning: 3 },
                    boostDomain: "science_research",
                    traits: ["Researcher", "Scientist"]
                },
                {
                    text: "Treating patients and improving human health",
                    signals: { careerValues: 4, communication: 2, problemSolving: 2 },
                    boostDomain: "healthcare",
                    traits: ["Healthcare", "Empathetic"]
                },
                {
                    text: "Developing clean energy and environmental solutions",
                    signals: { careerValues: 3, systemsThinking: 3, interests: 2 },
                    boostDomain: "emerging_interdisciplinary",
                    traits: ["Climate Tech", "Systems"]
                }
            ]
        },
        {
            id: "ad03",
            stage: "adaptive",
            category: "Business & Society",
            type: "discriminator",
            discriminates: ["entrepreneurship", "law", "marketing_sales", "media_communication", "education"],
            text: "Where would you rather use your voice?",
            question: "Where would you rather use your voice?",
            options: [
                {
                    text: "Negotiating deals and growing a new company",
                    signals: { leadership: 3, riskTolerance: 3, execution: 1 },
                    boostDomain: "entrepreneurship",
                    traits: ["Entrepreneur", "Deal-Maker"]
                },
                {
                    text: "Debating rules, justice, and public policy",
                    signals: { communication: 3, analyticalReasoning: 3, careerValues: 2 },
                    boostDomain: "law",
                    traits: ["Advocate", "Debater"]
                },
                {
                    text: "Creating marketing campaigns that grab attention",
                    signals: { creativity: 3, communication: 3, riskTolerance: 1 },
                    boostDomain: "marketing_sales",
                    traits: ["Marketer", "Storyteller"]
                },
                {
                    text: "Reporting important stories and educating people",
                    signals: { curiosity: 3, communication: 4, independence: 1 },
                    boostDomain: "media_communication",
                    traits: ["Journalist", "Educator"]
                }
            ]
        },
        {
            id: "ad04",
            stage: "adaptive",
            category: "Work Roles",
            type: "discriminator",
            uncertainTrait: "independence_vs_leadership",
            text: "In a group project, which role feels most natural?",
            question: "In a group project, which role feels most natural?",
            options: [
                {
                    text: "The specialist who solves the hardest technical part",
                    signals: { independence: 3, analyticalReasoning: 2, motivation: 2 },
                    traits: ["Deep Specialist", "Expert"]
                },
                {
                    text: "The coordinator who keeps the team on schedule",
                    signals: { leadership: 3, execution: 2, communication: 2 },
                    traits: ["Coordinator", "Manager"]
                },
                {
                    text: "The teammate who supports and connects everyone",
                    signals: { collaboration: 4, communication: 2 },
                    traits: ["Team Anchor", "Harmonizer"]
                },
                {
                    text: "The creative who challenges standard thinking",
                    signals: { creativity: 3, riskTolerance: 3 },
                    traits: ["Idea Generator", "Challenger"]
                }
            ]
        },
        {
            id: "ad05",
            stage: "adaptive",
            category: "Pacing & Style",
            type: "discriminator",
            uncertainTrait: "execution_vs_risk",
            text: "Which sounds closer to how you like to work?",
            question: "Which sounds closer to how you like to work?",
            options: [
                {
                    text: "Taking time to make sure every detail is right",
                    signals: { execution: 4, analyticalReasoning: 2 },
                    traits: ["Precise", "Careful"]
                },
                {
                    text: "Moving quickly, testing ideas, and adjusting fast",
                    signals: { riskTolerance: 4, problemSolving: 2 },
                    traits: ["Fast Mover", "Experimental"]
                },
                {
                    text: "Making a solid plan before taking any action",
                    signals: { systemsThinking: 3, execution: 2 },
                    traits: ["Planner", "Structured"]
                },
                {
                    text: "Diving right in and learning by doing",
                    signals: { riskTolerance: 2, problemSolving: 3 },
                    traits: ["Pragmatic", "Hands-On"]
                }
            ]
        },
        {
            id: "ad06",
            stage: "adaptive",
            category: "Impact & Goals",
            type: "discriminator",
            uncertainTrait: "values_vs_venture",
            text: "What kind of organization would you rather be part of?",
            question: "What kind of organization would you rather be part of?",
            options: [
                {
                    text: "A fast-growing tech startup with huge upside",
                    signals: { riskTolerance: 3, leadership: 2, motivation: 3 },
                    traits: ["Startup", "High-Growth"]
                },
                {
                    text: "A public service or non-profit helping people",
                    signals: { careerValues: 4, collaboration: 2 },
                    traits: ["Public Good", "Service"]
                },
                {
                    text: "A research lab discovering new knowledge",
                    signals: { systemsThinking: 2, curiosity: 4, motivation: 2 },
                    traits: ["Research", "Discovery"]
                },
                {
                    text: "A creative studio producing media and art",
                    signals: { creativity: 4, interests: 2 },
                    traits: ["Studio", "Creative"]
                }
            ]
        },
        {
            id: "ad07",
            stage: "adaptive",
            category: "Thinking Style",
            type: "discriminator",
            uncertainTrait: "analytical_vs_execution",
            text: "Which type of day-to-day work sounds more satisfying?",
            question: "Which type of day-to-day work sounds more satisfying?",
            options: [
                {
                    text: "Analyzing complex problems and designing models",
                    signals: { analyticalReasoning: 4, curiosity: 2 },
                    traits: ["Analyst", "Theoretical"]
                },
                {
                    text: "Building physical objects or repairing equipment",
                    signals: { execution: 4, problemSolving: 3 },
                    traits: ["Craftsman", "Physical"]
                },
                {
                    text: "Coaching people and helping them succeed",
                    signals: { communication: 3, careerValues: 3, collaboration: 2 },
                    traits: ["Coach", "Mentor"]
                },
                {
                    text: "Organizing large events and leading campaigns",
                    signals: { leadership: 3, collaboration: 2, execution: 2 },
                    traits: ["Organizer", "Public"]
                }
            ]
        }
    ];

    // -------------------------------------------------------------
    // 4. STRUCTURED CAREER DATABASE (20+ Domains)
    // -------------------------------------------------------------
    const COMPASS_CAREERS = [
        // --- 1. Technology & AI ---
        {
            id: "sde_fullstack",
            domainId: "tech_ai",
            category: "Technology & AI",
            title: "Full-Stack Software Systems Engineer",
            icon: "💻",
            desc: "Architect and build resilient distributed systems, modern web microservices, and client-facing interfaces. Involves high algorithmic reasoning and scalable software architecture.",
            targetDimensions: {
                analyticalReasoning: 4,
                systemsThinking: 5,
                problemSolving: 5,
                independence: 4,
                execution: 4,
                curiosity: 4,
                creativity: 3,
                communication: 3,
                collaboration: 3,
                workEnvironment: 4,
                riskTolerance: 2,
                careerValues: 3
            },
            workStyle: "Deep autonomous problem-solving punctuated by structured code reviews and sprint planning.",
            communicationStyle: "Crisp technical design documents, architectural RFCs, and collaborative pull-request reviews.",
            environment: "Hybrid or remote-first, asynchronous developer workflows, high agency.",
            typicalActivities: [
                "Decompose complex business requirements into microservice architectures",
                "Write performant backend APIs, caching layers, and database schemas",
                "Debug distributed race conditions and optimize latency bottlenecks",
                "Review team pull requests for security, maintainability, and scalability"
            ],
            strengthsRequired: ["Systems Thinking", "Algorithmic Logic", "Independent Focus", "Root-Cause Debugging"],
            potentialFriction: "Context switching between heads-down coding and cross-functional meetings; patience required for elusive edge-case bugs.",
            missingEvidenceCheck: "Check comfort with deep logical debugging and reading extensive codebases.",
            learningRequirements: "Computer Science degree or rigorous self-directed software curriculum (DSA, System Design, Distributed Systems).",
            careerProgression: "Junior SDE ➔ Senior SDE ➔ Staff/Principal Engineer ➔ VP of Engineering / CTO",
            phases: [
                {
                    title: "Phase 1: Foundation (Core Computer Science)",
                    steps: "Master Discrete Math, Data Structures & Algorithms (arrays, trees, graphs, dynamic programming), and basic Linux operating systems."
                },
                {
                    title: "Phase 2: Skills & Tooling (Modern Stack)",
                    steps: "Gain fluency in TypeScript, Python or Go, SQL/PostgreSQL, relational modeling, Git workflows, and REST/GraphQL APIs."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Production Systems)",
                    steps: "Build a distributed task queue with Redis, an authenticated microservices application, and an open-source library with automated CI/CD."
                },
                {
                    title: "Phase 4: Experience & Industry Network",
                    steps: "Secure software engineering internships, contribute to active GitHub open-source repositories, and participate in hackathons."
                },
                {
                    title: "Phase 5: Career Preparation & Technical Interviews",
                    steps: "Practice LeetCode medium/hard patterns, master System Design interviews (caching, sharding, consensus), and refine portfolio codebase."
                }
            ],
            realityCheck: {
                scenario: "A high-traffic e-commerce checkout service experiences intermittent 504 Gateway Timeouts during peak flash sales. The application servers show 20% CPU usage, but the database connection pool is consistently exhausted.",
                task: "Which immediate architectural hypothesis is most credible to diagnose and resolve the bottleneck?",
                options: [
                    { id: "opt_a", text: "Double the CPU cores on all application server containers immediately.", correct: false, note: "Ineffective: CPU is already low (20%); the bottleneck is I/O / connections, not compute." },
                    { id: "opt_b", text: "Inspect slow query logs, implement database connection pooling with transaction timeouts, and cache hot inventory reads.", correct: true, note: "Spot on: Pool exhaustion points to long-lived transactions, unindexed queries, or uncached hot reads." },
                    { id: "opt_c", text: "Switch the front-end framework to reduce bundle size.", correct: false, note: "Irrelevant to backend database connection pool exhaustion." }
                ],
                debrief: "Real-world engineering frequently involves diagnosing distributed bottlenecks across network, cache, and database layers rather than just writing greenfield code."
            },
            learningResources: {
                learn: [
                    { title: "System Design Primer", provider: "GitHub / Donne Martin", desc: "Comprehensive blueprint for scalable, high-availability architecture." },
                    { title: "CS61A & CS61B", provider: "UC Berkeley", desc: "World-class foundational curriculum for data structures and software paradigms." }
                ],
                practice: [
                    { title: "NeetCode 150 / LeetCode", type: "Algorithmic Challenges", desc: "Curated problem sets covering graph traversal, trees, dynamic programming." },
                    { title: "Distributed Systems Labs", type: "Hands-on Simulator", desc: "MIT 6.824 Raft consensus implementation in Go." }
                ],
                build: [
                    { title: "Real-Time Collaborative Canvas", desc: "Build a multi-user canvas using WebSockets, operational transforms, and Redis pub/sub." }
                ],
                read: [
                    { title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", isbn: "9781449373320", year: 2017, rating: "4.9", desc: "The definitive guide to data models, distributed consensus, transactions, and scalability." },
                    { title: "Clean Code", author: "Robert C. Martin", isbn: "9780132350884", year: 2008, rating: "4.7", desc: "A handbook of agile software craftsmanship and refactoring principles." }
                ],
                explore: [
                    { title: "Hacker News & InfoQ", desc: "Stay ahead of cutting-edge backend and cloud trends." }
                ]
            },
            communicationExercise: {
                title: "Explaining System Architecture to Non-Technical Stakeholders",
                prompt: "Explain why migrating our monolithic legacy application to microservices is necessary for business reliability, without using jargon like 'Kubernetes', 'RPC', or 'sharding'.",
                framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
                why: "Senior engineers must articulate technical debt and architectural trade-offs in terms of business velocity and risk."
            }
        },

        // --- 2. Technology & AI ---
        {
            id: "ai_ml_architect",
            domainId: "tech_ai",
            category: "Technology & AI",
            title: "Machine Learning & AI Architect",
            icon: "🤖",
            desc: "Design and operationalize deep learning architectures, Large Language Model pipelines, and predictive algorithms. Combines advanced mathematics with scalable data engineering.",
            targetDimensions: {
                analyticalReasoning: 5,
                systemsThinking: 4,
                curiosity: 5,
                problemSolving: 5,
                independence: 4,
                execution: 4,
                creativity: 4,
                workEnvironment: 4,
                riskTolerance: 3,
                communication: 3
            },
            workStyle: "Iterative experimentation, research paper implementation, rigorous statistical evaluation.",
            communicationStyle: "Explaining model trade-offs (precision vs. recall, latency vs. accuracy) and AI ethics to product leads.",
            environment: "High-compute cloud environments, research-engineering hybrid labs.",
            typicalActivities: [
                "Fine-tune generative models with custom domain datasets and RLHF/DPO",
                "Evaluate model hallucinations, drift, and bias using statistical benchmarks",
                "Optimize inference pipelines with quantization and vector search indexing",
                "Implement robust MLOps pipelines for continuous training and model registry"
            ],
            strengthsRequired: ["Mathematical Modeling", "Deep Learning Frameworks", "Statistical Rigor", "Curiosity"],
            potentialFriction: "Models are non-deterministic; high tolerance needed for failed experiments and unexpected regressions.",
            missingEvidenceCheck: "Assess enthusiasm for advanced linear algebra, probability, and GPU infrastructure.",
            learningRequirements: "Degree in Computer Science, Data Science, Math, or equivalent deep portfolio in PyTorch/TensorFlow.",
            careerProgression: "ML Engineer ➔ Senior AI Specialist ➔ Staff AI Research Engineer ➔ Chief AI Scientist",
            phases: [
                {
                    title: "Phase 1: Foundation (Math & Code)",
                    steps: "Solidify Linear Algebra (eigenvectors, SVD), Multivariable Calculus (gradients), Probability, and Python programming."
                },
                {
                    title: "Phase 2: Skills & Tooling (Classical ML to Deep Learning)",
                    steps: "Master scikit-learn, PyTorch, Convolutional Networks, Transformers, attention mechanisms, and embeddings."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Applied AI)",
                    steps: "Build a production RAG (Retrieval-Augmented Generation) system, fine-tune an open LLM on specialized legal/medical data, and benchmark latency."
                },
                {
                    title: "Phase 4: Experience & Industry Network",
                    steps: "Participate in Kaggle competitions, publish technical write-ups on arXiv/Hugging Face, and intern with AI startups."
                },
                {
                    title: "Phase 5: Career Preparation & Technical Showcase",
                    steps: "Demonstrate deployment on cloud GPUs (Triton/vLLM), explain transformer internals from scratch, and pass system design interviews."
                }
            ],
            realityCheck: {
                scenario: "A customer support AI bot generates accurate answers 95% of the time, but occasionally invents non-existent return policies with supreme confidence (hallucination).",
                task: "Which mitigation strategy is most reliable for production systems?",
                options: [
                    { id: "opt_a", text: "Tell the model in the system prompt: 'Please never hallucinate or make things up.'", correct: false, note: "Prompt constraints alone do not prevent hallucinations when external grounding is missing." },
                    { id: "opt_b", text: "Implement strict Retrieval-Augmented Generation (RAG) with source verification and cite-check guardrails.", correct: true, note: "RAG anchors outputs to verified ground-truth knowledge bases and evaluates attribution." },
                    { id: "opt_c", text: "Increase temperature to 1.5 to promote creative problem solving.", correct: false, note: "Increasing temperature amplifies randomness and hallucinations." }
                ],
                debrief: "AI engineering requires understanding stochastic behavior and building deterministic validation guardrails around probabilistic models."
            },
            learningResources: {
                learn: [
                    { title: "Deep Learning Specialization", provider: "DeepLearning.AI / Andrew Ng", desc: "Comprehensive mastery of neural network mechanics." },
                    { title: "Fast.ai Practical Deep Learning", provider: "Jeremy Howard", desc: "Top-down, hands-on deep learning for coders." }
                ],
                practice: [
                    { title: "Hugging Face Spaces & Models", type: "Platform", desc: "Explore, fine-tune, and deploy transformer checkpoints." },
                    { title: "Kaggle Competitions", type: "Benchmarking", desc: "Iterate on real-world datasets with metric validation." }
                ],
                build: [
                    { title: "Autonomous Research Agent", desc: "Build an agentic pipeline that searches PubMed/arXiv, synthesizes findings, and verifies citations." }
                ],
                read: [
                    { title: "Deep Learning", author: "Ian Goodfellow, Yoshua Bengio", isbn: "9780262035613", year: 2016, rating: "4.8", desc: "The foundational mathematical textbook of the modern deep learning revolution." }
                ],
                explore: [
                    { title: "arXiv cs.AI / cs.LG", desc: "Track breakthrough research preprints daily." }
                ]
            },
            communicationExercise: {
                title: "Explaining AI Confidence & Hallucination Risks to Executives",
                prompt: "Present a risk assessment for deploying generative AI in customer-facing transactions. Explain why a 98% accuracy benchmark can still introduce corporate liability.",
                framework: "STAR: Situation ➔ Task ➔ Action ➔ Result",
                why: "AI leaders must temper executive hype with sober probabilistic realism."
            }
        },

        // --- 3. Data & Analytics ---
        {
            id: "data_scientist_lead",
            domainId: "data_analytics",
            category: "Data & Analytics",
            title: "Data Scientist & Analytics Strategist",
            icon: "📊",
            desc: "Extract causal insights, formulate statistical experiments (A/B testing), and steer strategic product decisions using vast enterprise datasets.",
            targetDimensions: {
                analyticalReasoning: 5,
                systemsThinking: 4,
                communication: 4,
                problemSolving: 4,
                independence: 3,
                execution: 4,
                curiosity: 4,
                collaboration: 4,
                careerValues: 3
            },
            workStyle: "Hypothesis testing, exploratory data analysis, cross-functional collaboration with product managers.",
            communicationStyle: "Compelling data visualizations, executive summaries, converting p-values into business growth levers.",
            environment: "Modern hybrid tech office, analytics-driven leadership councils.",
            typicalActivities: [
                "Design statistical A/B test experiments with proper sample size power calculations",
                "Build predictive user lifetime value (LTV) and churn forecasting models",
                "Construct reusable SQL/dbt data transformation pipelines in cloud data warehouses",
                "Present quarterly product growth insights directly to C-suite executives"
            ],
            strengthsRequired: ["Statistical Inference", "SQL & Python Fluency", "Business Acumen", "Data Storytelling"],
            potentialFriction: "Translating ambiguous business questions into testable queries; navigating messy, missing real-world data.",
            missingEvidenceCheck: "Check comfort with applied statistics, causality vs. correlation, and SQL.",
            learningRequirements: "Degree in Statistics, Economics, Mathematics, Computer Science, or proven analytics track record.",
            careerProgression: "Data Analyst ➔ Data Scientist ➔ Lead Data Scientist ➔ Head of Analytics / Chief Data Officer",
            phases: [
                {
                    title: "Phase 1: Foundation (Statistics & SQL)",
                    steps: "Master descriptive and inferential statistics, probability distributions, hypothesis testing, and advanced SQL (window functions, CTEs)."
                },
                {
                    title: "Phase 2: Skills & Tooling (Python & Visualization)",
                    steps: "Build fluency in pandas, NumPy, seaborn/Plotly, dbt, BigQuery/Snowflake, and interactive dashboarding (Streamlit/Tableau)."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Business Causal Analysis)",
                    steps: "Perform an end-to-end churn prediction model with SHAP interpretability and design an A/B test simulation with power analysis."
                },
                {
                    title: "Phase 4: Experience & Cross-Functional Work",
                    steps: "Collaborate on product analytics case studies, write data-driven essays, and secure data analytics internships."
                },
                {
                    title: "Phase 5: Career Preparation & Technical Interviews",
                    steps: "Solve product analytics interview cases, practice advanced SQL challenges under time pressure, and present data decks."
                }
            ],
            realityCheck: {
                scenario: "A feature update shows a statistically significant 15% increase in daily button clicks, but overall monthly revenue drops by 4%.",
                task: "What is the most likely statistical phenomenon explaining this paradox?",
                options: [
                    { id: "opt_a", text: "The database query must have a calculation error.", correct: false, note: "Unlikely to be simple calculation error; metric divergence is common in real products." },
                    { id: "opt_b", text: "The button click is causing cannibalization or misleading user expectations, creating downstream churn (Simpson's Paradox or local optimum).", correct: true, note: "Optimizing a micro-metric can degrade macro-outcomes by frustrating users or cannibalizing higher-value flows." },
                    { id: "opt_c", text: "Revenue will automatically catch up next month without intervention.", correct: false, note: "Wishful thinking; ignoring downstream negative revenue signals is dangerous." }
                ],
                debrief: "World-class data scientists avoid vanity metrics and rigorously investigate causal downstream impacts on genuine business value."
            },
            learningResources: {
                learn: [
                    { title: "StatQuest with Josh Starmer", provider: "YouTube / StatQuest", desc: "Clear, intuitive breakdowns of machine learning and statistical concepts." },
                    { title: "Mode Analytics SQL School", provider: "Mode", desc: "The definitive guide to analytical SQL and business data transformations." }
                ],
                practice: [
                    { title: "Stratascratch", type: "SQL & Python Challenges", desc: "Real interview questions from FAANG and high-growth startups." }
                ],
                build: [
                    { title: "SaaS Retention & Cohort Dashboard", desc: "Build an interactive cohort retention dashboard identifying early churn signals." }
                ],
                read: [
                    { title: "Naked Statistics", author: "Charles Wheelan", isbn: "9780393347777", year: 2013, rating: "4.7", desc: "Stripping the dread from the data and revealing the intuitive core of statistical thinking." },
                    { title: "Trustworthy Online Controlled Experiments", author: "Ron Kohavi", isbn: "9781108724265", year: 2020, rating: "4.9", desc: "The industry standard guide to A/B testing at tech giants." }
                ],
                explore: [
                    { title: "Locally Optimistic Community", desc: "Network of thoughtful data and analytics leaders." }
                ]
            },
            communicationExercise: {
                title: "Delivering a Counter-Intuitive Data Finding to Product Leadership",
                prompt: "Explain to a passionate product manager why their favorite feature is hurting overall platform retention, using data diplomacy and constructive alternatives.",
                framework: "Value Hook + Proof Point + Future Impact",
                why: "Data scientists must challenge organizational biases without alienating cross-functional partners."
            }
        },

        // --- 4. Engineering ---
        {
            id: "robotics_systems_engineer",
            domainId: "engineering",
            category: "Engineering",
            title: "Robotics & Autonomous Systems Engineer",
            icon: "⚙️",
            desc: "Bridge physical hardware, mechatronics, embedded firmware, and autonomous navigation algorithms to bring machines into physical reality.",
            targetDimensions: {
                analyticalReasoning: 5,
                systemsThinking: 5,
                problemSolving: 5,
                execution: 4,
                curiosity: 4,
                creativity: 3,
                independence: 3,
                collaboration: 4,
                riskTolerance: 3
            },
            workStyle: "Hardware-in-the-loop testing, lab experiments, cross-disciplinary mechanics and software debugging.",
            communicationStyle: "Interdisciplinary collaboration between mechanical, electrical, and firmware teams.",
            environment: "Robotics laboratories, testing facilities, high-tech manufacturing floors.",
            typicalActivities: [
                "Implement sensor fusion algorithms (Kalman filters, LiDAR, IMU) for localization",
                "Program real-time motor control loops and kinematic trajectory planning in C++",
                "Simulate robotic arms or mobile robots in ROS 2 and Gazebo physics engines",
                "Troubleshoot EMI noise, thermal constraints, and hardware-software timing jitter"
            ],
            strengthsRequired: ["Mechatronics", "Real-Time Embedded C++", "Physics & Kinematics", "Systems Architecture"],
            potentialFriction: "Hardware turnaround times are slower than pure software; physical components break, wear down, and have sensor noise.",
            missingEvidenceCheck: "Assess interest in physical hardware, sensors, embedded systems, and physics.",
            learningRequirements: "Degree in Robotics, Mechanical, Electrical, or Mechatronics Engineering.",
            careerProgression: "Robotics Engineer ➔ Senior Controls Specialist ➔ Lead Robotics Architect ➔ VP of Hardware",
            phases: [
                {
                    title: "Phase 1: Foundation (Math, Physics & C++)",
                    steps: "Master Newtonian Mechanics, Linear Algebra, Circuit Analysis, and modern C++ (memory management, pointers)."
                },
                {
                    title: "Phase 2: Skills & Tooling (Embedded & ROS)",
                    steps: "Learn microcontroller programming (STM32/ESP32), RTOS, ROS 2 (Robot Operating System), and sensor protocols (CAN, I2C, SPI)."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Physical Prototype)",
                    steps: "Build an autonomous mobile robot (AMR) with SLAM mapping, obstacle avoidance, and PID motor controllers."
                },
                {
                    title: "Phase 4: Experience & Lab Work",
                    steps: "Join university robotics clubs (Formula Student, RoboCup), intern at automation firms, and document builds."
                },
                {
                    title: "Phase 5: Career Preparation & Technical Tests",
                    steps: "Prepare for hardware-software integration challenges, state machine modeling, and controls interview problems."
                }
            ],
            realityCheck: {
                scenario: "A mobile robot's odometry tracking drifts significantly whenever it drives over polished concrete floors, causing it to miscalculate its map location by 2 meters.",
                task: "What is the root cause and optimal engineering mitigation?",
                options: [
                    { id: "opt_a", text: "Wheel slippage is introducing dead-reckoning drift; fuse wheel encoders with an IMU and LiDAR scan matching.", correct: true, note: "Wheel slippage on low-friction surfaces causes pure odometry drift; multi-sensor fusion (EKF) corrects for it." },
                    { id: "opt_b", text: "Replace the battery with a higher voltage supply.", correct: false, note: "Power supply is unrelated to kinematic wheel traction and state estimation drift." },
                    { id: "opt_c", text: "Double the speed of the robot so it glides across the concrete faster.", correct: false, note: "Higher speeds exacerbate slippage and collision hazards." }
                ],
                debrief: "Robotics engineers constantly navigate physical realities where sensors lie, surfaces slip, and uncertainty must be mathematically tamed."
            },
            learningResources: {
                learn: [
                    { title: "Modern Robotics: Mechanics, Planning, and Control", provider: "Northwestern University", desc: "Rigorous kinematic formulation of serial manipulators and mobile bases." },
                    { title: "Articulated Robotics Tutorials", provider: "YouTube", desc: "Step-by-step ROS 2 physical robot construction." }
                ],
                practice: [
                    { title: "Gazebo / Webots Simulator", type: "Simulation", desc: "Simulate dynamics, sensor noise, and environment collision." }
                ],
                build: [
                    { title: "Autonomous SLAM Rover", desc: "Construct a 2-wheel differential drive rover with RPLiDAR and ROS 2 navigation stack." }
                ],
                read: [
                    { title: "Probabilistic Robotics", author: "Sebastian Thrun", isbn: "9780262201629", year: 2005, rating: "4.8", desc: "The definitive guide to SLAM, particle filters, and state estimation under uncertainty." }
                ],
                explore: [
                    { title: "IEEE Robotics and Automation Society", desc: "Global flagship community for autonomous systems research." }
                ]
            },
            communicationExercise: {
                title: "Conducting a Multi-Disciplinary Hardware Post-Mortem",
                prompt: "Facilitate a blameless root-cause analysis after a prototype actuator burned out during live demonstration, aligning mechanical, electrical, and software leads.",
                framework: "Acknowledge + Trade-off Matrix + Proposed Alternative",
                why: "Engineering systems break at the seams between disciplines; collaborative blame-free inquiry is vital."
            }
        },

        // --- 5. Entrepreneurship & Startups ---
        {
            id: "venture_founder",
            domainId: "entrepreneurship",
            category: "Entrepreneurship & Startups",
            title: "Venture Founder & Startup Operator",
            icon: "🚀",
            desc: "Identify critical market inefficiencies, build innovative solutions from zero to one, assemble top talent, and navigate extreme uncertainty.",
            targetDimensions: {
                riskTolerance: 5,
                leadership: 5,
                creativity: 5,
                execution: 5,
                problemSolving: 5,
                communication: 5,
                systemsThinking: 4,
                independence: 4,
                curiosity: 4,
                motivation: 5,
                careerValues: 3
            },
            workStyle: "Relentless prioritization, fast iterative prototyping, customer discovery, hiring, and capital allocation.",
            communicationStyle: "Inspirational storytelling, investor pitching, transparent company-wide all-hands leadership.",
            environment: "High-velocity startup hubs, customer co-working spaces, remote distributed teams.",
            typicalActivities: [
                "Conduct 50+ discovery interviews with prospective customers to validate pain points",
                "Define the Minimum Viable Product (MVP) and lead rapid weekly deployment sprints",
                "Pitch angel investors and venture capital funds for seed funding rounds",
                "Recruit founding engineers, designers, and key growth operators"
            ],
            strengthsRequired: ["Extreme Resilience", "Strategic Vision", "Persuasive Communication", "Execution Velocity"],
            potentialFriction: "High personal risk, ambiguous milestones, long feedback loops before reaching product-market fit.",
            missingEvidenceCheck: "Assess appetite for financial uncertainty, public accountability, and relentless cold outreach.",
            learningRequirements: "No formal degree required; real-world commercial experience, product intuition, and founder grit.",
            careerProgression: "Solo Builder ➔ Seed-Stage Founder ➔ Growth-Stage CEO ➔ Serial Entrepreneur / Venture Partner",
            phases: [
                {
                    title: "Phase 1: Foundation (Problem Discovery & Market Research)",
                    steps: "Identify an acute, underserved pain point. Map existing competitors and interview 30+ domain practitioners."
                },
                {
                    title: "Phase 2: Skills & Tooling (No-Code to Rapid Prototyping)",
                    steps: "Build an MVP in under 3 weeks using modern web tools or no-code stacks. Collect first pre-orders or letters of intent."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Traction & Product-Market Fit)",
                    steps: "Iterate based on retention metrics, achieve first paying customers ($1k-$10k MRR), and optimize the core value loop."
                },
                {
                    title: "Phase 4: Experience & Founder Network",
                    steps: "Apply to elite startup accelerators (Y Combinator, Techstars), recruit a complementary co-founder, and build in public."
                },
                {
                    title: "Phase 5: Career Preparation & Capital Raising",
                    steps: "Create an investor deck, master unit economics (CAC, LTV, payback period), and structure legal incorporation and equity."
                }
            ],
            realityCheck: {
                scenario: "Your startup has 4 months of cash runway remaining. Your enterprise product has high user love from 3 pilot customers, but their sales cycles take 6 months to close. A prominent investor offers bridge funding ONLY if you pivot to a consumer hype market you don't believe in.",
                task: "What is the most sound entrepreneurial path forward?",
                options: [
                    { id: "opt_a", text: "Take the investor's money immediately and pivot away from your customers.", correct: false, note: "Chasing investor hype in a market you don't understand usually leads to founder burnout and failure." },
                    { id: "opt_b", text: "Negotiate pilot-to-production conversion milestones with your 3 customers for upfront annual prepayment discounts, while seeking bridge loans or angel checks.", correct: true, note: "Customer revenue is the purest form of capital; converting pilot champions into upfront cash extends runway without diluting vision." },
                    { id: "opt_c", text: "Ignore the runway and continue business as usual.", correct: false, note: "Running out of cash is the number one fatal cause of startup death." }
                ],
                debrief: "Founders constantly balance survival, financial runway, and strategic integrity under extreme asymmetry."
            },
            learningResources: {
                learn: [
                    { title: "Startup School", provider: "Y Combinator", desc: "The definitive guide to building a high-growth tech startup from scratch." },
                    { title: "How to Start a Startup", provider: "Stanford CS183B", desc: "Lectures by Peter Thiel, Sam Altman, and prominent operators." }
                ],
                practice: [
                    { title: "Product Hunt & BuildInPublic", type: "Community", desc: "Launch early MVPs, gather real user feedback, and iterate rapidly." }
                ],
                build: [
                    { title: "Micro-SaaS or Creator Tool", desc: "Launch a standalone micro-product that solves one sharp pain point and charges real credit cards." }
                ],
                read: [
                    { title: "The Lean Startup", author: "Eric Ries", isbn: "9780307887894", year: 2011, rating: "4.6", desc: "How continuous innovation and validated learning creates radically successful businesses." },
                    { title: "Zero to One", author: "Peter Thiel", isbn: "9780804139298", year: 2014, rating: "4.7", desc: "Notes on startups, building monopolies, and how to build the future." }
                ],
                explore: [
                    { title: "Indie Hackers & Hacker News", desc: "Transparent revenue milestones and bootstrapped founder discussions." }
                ]
            },
            communicationExercise: {
                title: "The 60-Second Investor Elevator Pitch",
                prompt: "Pitch your venture to a tier-1 angel investor in under 60 seconds. Articulate the problem, your proprietary insight, early traction, and market size.",
                framework: "Value Hook + Proof Point + Future Impact",
                why: "Founders must capture attention instantly and convey credibility with razor-sharp brevity."
            }
        },

        // --- 6. Design & Creative ---
        {
            id: "product_ux_designer",
            domainId: "design_creative",
            category: "Design & Creative",
            title: "Product Designer & UX Architect",
            icon: "🎨",
            desc: "Shape human-computer interaction, design intuitive visual interfaces, and build comprehensive design systems that millions of people use seamlessly.",
            targetDimensions: {
                creativity: 5,
                systemsThinking: 4,
                communication: 4,
                problemSolving: 4,
                collaboration: 4,
                execution: 4,
                curiosity: 4,
                workEnvironment: 4,
                independence: 3,
                careerValues: 3
            },
            workStyle: "Interactive wireframing, component tokenization, usability testing, cross-functional collaboration with engineering.",
            communicationStyle: "Design critiques, walking through user journey rationale, advocating for accessibility and cognitive simplicity.",
            environment: "Design studios, creative product squads, flexible hybrid environments.",
            typicalActivities: [
                "Conduct user journey mapping to identify cognitive friction in onboarding",
                "Design modular design systems in Figma with auto-layout and design tokens",
                "Create interactive prototypes for mobile and desktop web applications",
                "Collaborate with engineers to inspect CSS implementation and micro-interactions"
            ],
            strengthsRequired: ["Visual Hierarchy", "Interaction Design", "Empathy & User Testing", "Design Systems"],
            potentialFriction: "Subjective feedback from non-designers; balancing aesthetic ambition with engineering time constraints.",
            missingEvidenceCheck: "Check passion for visual craft, typography, accessibility (WCAG), and prototyping.",
            learningRequirements: "Degree in Interaction Design, HCI, Graphic Design, or a top-tier visual UX case-study portfolio.",
            careerProgression: "Junior UX Designer ➔ Senior Product Designer ➔ Staff Design Lead ➔ VP of Design",
            phases: [
                {
                    title: "Phase 1: Foundation (Design Fundamentals)",
                    steps: "Master typography, color theory, Gestalt visual principles, spacing rhythms, and WCAG accessibility standards."
                },
                {
                    title: "Phase 2: Skills & Tooling (Figma & Prototyping)",
                    steps: "Achieve deep mastery of Figma (variants, auto-layout, design tokens), prototyping tools (ProtoPie/Framer), and basic HTML/CSS."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Comprehensive Case Studies)",
                    steps: "Build 2 deep product case studies: one redesign fixing real friction with user metrics, and one zero-to-one mobile app."
                },
                {
                    title: "Phase 4: Experience & Design Community",
                    steps: "Share work on Dribbble/Twitter, participate in design critiques, and intern at a design-forward tech company."
                },
                {
                    title: "Phase 5: Career Preparation & Portfolio Review",
                    steps: "Prepare interactive slide decks, master whiteboard design challenges, and articulate design decisions under critique."
                }
            ],
            realityCheck: {
                scenario: "Users on a mobile banking app repeatedly fail to notice a required security confirmation checkbox at the bottom of a scrollable transfer screen, leading to high frustration and abandoned transfers.",
                task: "Which design intervention best solves this usability friction?",
                options: [
                    { id: "opt_a", text: "Make the checkbox neon red and blink continuously.", correct: false, note: "Blinking neon elements create visual anxiety and violate accessibility standards." },
                    { id: "opt_b", text: "Pin the primary action button to the bottom viewport bar with an inline disclaimer, or trigger confirmation via a focused sheet modal.", correct: true, note: "Pinned persistent action bars or progressive disclosure sheets keep critical actions within thumb reach and immediate visibility." },
                    { id: "opt_c", text: "Add a 500-word tutorial popup that users must read before transferring.", correct: false, note: "Users skip lengthy instructional popups; the interface itself must be self-explanatory." }
                ],
                debrief: "Product designers don't just make things look pretty; they eliminate cognitive load and guide human action gracefully."
            },
            learningResources: {
                learn: [
                    { title: "Refactoring UI", provider: "Adam Wathan & Steve Schoger", desc: "Practical, visual-first UI design rules for modern software." },
                    { title: "Nielsen Norman Group UX Articles", provider: "NN/g", desc: "The gold standard in evidence-based user experience research." }
                ],
                practice: [
                    { title: "Daily UI Challenge", type: "Design Prompts", desc: "Build speed and muscle memory across 100 interaction design components." }
                ],
                build: [
                    { title: "Full Modular Design System", desc: "Create an accessible, multi-theme design system in Figma with 50+ tokenized components." }
                ],
                read: [
                    { title: "The Design of Everyday Things", author: "Don Norman", isbn: "9780465050659", year: 2013, rating: "4.8", desc: "The foundational bible of human-centered design, affordances, and cognitive feedback." },
                    { title: "Don't Make Me Think", author: "Steve Krug", isbn: "9780321965516", year: 2014, rating: "4.7", desc: "A common sense approach to web and mobile usability." }
                ],
                explore: [
                    { title: "Mobbin & Pageflows", desc: "Real-world mobile and web user flows from leading digital products." }
                ]
            },
            communicationExercise: {
                title: "Defending a Design Decision to an Opinionated Stakeholder",
                prompt: "A senior executive asks to make the logo three times bigger and add 4 new buttons to the homepage. Walk them through your design rationale using user data and cognitive load principles.",
                framework: "PREP: Point ➔ Reason ➔ Example ➔ Point",
                why: "Designers must translate visual intuition into compelling business and user-advocacy arguments."
            }
        },

        // --- 7. Finance & Quantitative ---
        {
            id: "quant_financial_analyst",
            domainId: "finance",
            category: "Finance & Quantitative",
            title: "Quantitative Financial Analyst & Trader",
            icon: "📈",
            desc: "Develop mathematical models, algorithmic trading strategies, and risk-adjusted portfolio optimization engines for capital markets.",
            targetDimensions: {
                analyticalReasoning: 5,
                systemsThinking: 5,
                riskTolerance: 4,
                problemSolving: 5,
                execution: 5,
                independence: 4,
                curiosity: 4,
                motivation: 5
            },
            workStyle: "High-concentration quantitative modeling, backtesting alpha signals, analyzing microstructure data.",
            communicationStyle: "Crisp risk memos, mathematical proofs of edge, communicating drawdown limits to risk committees.",
            environment: "Hedge funds, quantitative proprietary trading desks, fintech investment platforms.",
            typicalActivities: [
                "Research statistical arbitrage signals across equity and derivatives markets",
                "Backtest trading strategies accounting for slippage, transaction costs, and market impact",
                "Construct Monte Carlo simulations to quantify extreme tail risk and VaR (Value at Risk)",
                "Optimize low-latency algorithmic execution pipelines in C++ or Python"
            ],
            strengthsRequired: ["Stochastic Calculus", "Statistical Arbitrage", "Disciplined Risk Management", "Algorithmic Speed"],
            potentialFriction: "High-stress market volatility; models that work in backtests can suddenly fail when market regimes shift.",
            missingEvidenceCheck: "Check appetite for probability theory, financial markets, and mathematical rigor under pressure.",
            learningRequirements: "Degree in Financial Engineering, Quantitative Finance, Mathematics, Physics, or Computer Science.",
            careerProgression: "Quant Analyst ➔ Quantitative Researcher ➔ Portfolio Manager ➔ Partner / Head of Trading",
            phases: [
                {
                    title: "Phase 1: Foundation (Math, Probability & Financial Markets)",
                    steps: "Master Multivariable Calculus, Linear Algebra, Probability & Statistics, Stochastic Processes, and basic microeconomics."
                },
                {
                    title: "Phase 2: Skills & Tooling (Python/C++ for Finance)",
                    steps: "Build deep proficiency in Python (NumPy, pandas, SciPy), C++ for performance, Time-Series Econometrics (ARIMA, GARCH), and financial data APIs."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Alpha Research & Backtesting)",
                    steps: "Build an event-driven backtesting engine from scratch. Test a statistical arbitrage pairs-trading strategy with transaction cost modeling."
                },
                {
                    title: "Phase 4: Experience & Trading Competitions",
                    steps: "Participate in quantitative finance challenges (WorldQuant, QuantConnect), write research notes, and intern at investment firms."
                },
                {
                    title: "Phase 5: Career Preparation & Technical Interviews",
                    steps: "Solve brainteasers, probability puzzles (coin tosses, random walks), option pricing problems (Black-Scholes), and code live."
                }
            ],
            realityCheck: {
                scenario: "A quantitative strategy shows a stellar Sharpe Ratio of 3.2 in a 5-year backtest. However, closer inspection reveals that the model uses tomorrow's closing price to calculate today's rebalancing signal.",
                task: "What fundamental modeling flaw has occurred?",
                options: [
                    { id: "opt_a", text: "Overfitting due to excessive parameter tuning.", correct: false, note: "While overfitting is a risk, this specific bug is look-ahead bias." },
                    { id: "opt_b", text: "Look-Ahead Bias (Data Snooping): Future data leaked into past predictions, rendering the backtest completely fictitious.", correct: true, note: "Look-ahead bias is fatal; algorithms cannot access future data points in live market execution." },
                    { id: "opt_c", text: "Normal statistical fluctuation that will self-correct in production.", correct: false, note: "Running this live will immediately lose money as future data is not accessible." }
                ],
                debrief: "Quantitative finance demands obsessive vigilance against data leakage, regime shifts, and transaction cost traps."
            },
            learningResources: {
                learn: [
                    { title: "Mathematical Methods for Quantitative Finance", provider: "MIT OpenCourseWare", desc: "Stochastic calculus, martingales, and arbitrage pricing theory." },
                    { title: "QuantConnect Bootcamps", provider: "QuantConnect", desc: "Interactive algorithmic trading tutorials in Python and C#." }
                ],
                practice: [
                    { title: "Jane Street / Citadel Puzzle Sets", type: "Probability Puzzles", desc: "Classic brainteasers and betting market games testing statistical instincts." }
                ],
                build: [
                    { title: "Statistical Arbitrage Engine", desc: "Build a cointegration-based pairs trading model with automated risk limits and slippage calculation." }
                ],
                read: [
                    { title: "Advances in Financial Machine Learning", author: "Marcos Lopez de Prado", isbn: "9781119482086", year: 2018, rating: "4.8", desc: "Modern machine learning frameworks tailored to financial time series and avoiding false discoveries." },
                    { title: "The Man Who Solved the Market", author: "Gregory Zuckerman", isbn: "9780735217980", year: 2019, rating: "4.7", desc: "How Jim Simons and Renaissance Technologies built the greatest money-making machine in history." }
                ],
                explore: [
                    { title: "Wilmott Forums & QuantLib", desc: "The premier global hub for quantitative finance practitioners." }
                ]
            },
            communicationExercise: {
                title: "Explaining Maximum Drawdown & Risk Limits to a Client",
                prompt: "Explain to an anxious investor why your quantitative strategy experienced an 8% drawdown during an unprecedented market liquidity shock, and why the risk parameters functioned properly.",
                framework: "STAR: Situation ➔ Task ➔ Action ➔ Result",
                why: "Quants must maintain client trust and explain probabilistic boundaries calmly during drawdowns."
            }
        },

        // --- 8. Healthcare & Medicine ---
        {
            id: "clinical_physician_researcher",
            domainId: "healthcare",
            category: "Healthcare & Medicine",
            title: "Clinical Physician & Medical Researcher",
            icon: "🩺",
            desc: "Diagnose and treat complex human illnesses, translate clinical discoveries into medical protocols, and safeguard community health.",
            targetDimensions: {
                analyticalReasoning: 5,
                problemSolving: 5,
                careerValues: 5,
                communication: 5,
                collaboration: 4,
                execution: 5,
                curiosity: 4,
                motivation: 5,
                independence: 3
            },
            workStyle: "Evidence-based clinical decision-making, patient bedside consultations, rigorous laboratory investigations.",
            communicationStyle: "Deeply empathetic patient consultations, multidisciplinary clinical handoffs, peer-reviewed medical publications.",
            environment: "Hospitals, diagnostic labs, academic research medical centers.",
            typicalActivities: [
                "Diagnose complex patient presentations using differential diagnosis frameworks",
                "Interpret biochemical pathology, imaging modalities (MRI/CT), and genomic profiles",
                "Formulate targeted patient care plans balancing clinical efficacy and side effects",
                "Conduct clinical research trials to advance treatment for chronic conditions"
            ],
            strengthsRequired: ["Diagnostic Acumen", "Deep Empathy", "Emotional Resilience", "Clinical Precision"],
            potentialFriction: "High emotional weight of patient outcomes; long training pathways; bureaucratic documentation burdens.",
            missingEvidenceCheck: "Assess commitment to rigorous medical education and deep human empathy.",
            learningRequirements: "Pre-Med / MBBS / MD degree, followed by residency, clinical licensing, and specialized fellowship.",
            careerProgression: "Medical Resident ➔ Attending Physician ➔ Clinical Department Chair ➔ Chief Medical Officer",
            phases: [
                {
                    title: "Phase 1: Foundation (Biomedical Sciences)",
                    steps: "Excel in Biology, Organic Chemistry, Biochemistry, Physics, and clear competitive medical entrance examinations (NEET / MCAT)."
                },
                {
                    title: "Phase 2: Medical School (Pre-Clinical to Clinical)",
                    steps: "Master Human Anatomy, Physiology, Pharmacology, Pathology, and clinical diagnostic methods during MBBS/MD training."
                },
                {
                    title: "Phase 3: Projects & Research (Clinical Studies)",
                    steps: "Publish clinical case reports, participate in prospective randomized clinical trials, and present at medical conferences."
                },
                {
                    title: "Phase 4: Residency & Fellowship Specialization",
                    steps: "Complete intensive residency training (Internal Medicine, Surgery, Pediatrics, or Oncology) with direct patient care responsibility."
                },
                {
                    title: "Phase 5: Career Practice & Continuous Leadership",
                    steps: "Obtain board certifications, mentor junior medical residents, and lead evidence-based clinical improvement protocols."
                }
            ],
            realityCheck: {
                scenario: "A 45-year-old patient arrives at the emergency room with acute chest pressure radiating to the jaw. Initial ECG is ambiguous, but troponin cardiac enzyme markers are trending upwards over 2 hours.",
                task: "What is the primary clinical priority?",
                options: [
                    { id: "opt_a", text: "Discharge the patient with antacids and suggest a follow-up appointment next week.", correct: false, note: "Dangerous: Trending troponins with acute symptoms indicate ongoing myocardial ischemia; discharge is contraindicated." },
                    { id: "opt_b", text: "Initiate acute coronary syndrome (ACS) protocol, administer aspirin/heparin, continuously monitor vitals, and consult cardiology for urgent angiography.", correct: true, note: "Prompt medical stabilization and cardiac catheterization prevent irreversible heart tissue necrosis." },
                    { id: "opt_c", text: "Wait 24 hours to see if symptoms disappear on their own.", correct: false, note: "Time is muscle; cardiac ischemia requires rapid intervention." }
                ],
                debrief: "Medicine requires decisive, evidence-grounded action under high stakes where timing directly dictates human survival."
            },
            learningResources: {
                learn: [
                    { title: "Osmosis Medical Education", provider: "Osmosis / Elsevier", desc: "Animated clinical pathology and pharmacology videos." },
                    { title: "UpToDate Clinical Decision Support", provider: "Wolters Kluwer", desc: "The gold standard clinical reference for evidence-based medicine." }
                ],
                practice: [
                    { title: "Clinical Case Simulator", type: "Virtual Patients", desc: "Diagnose virtual patient cases with differential trees and lab tests." }
                ],
                build: [
                    { title: "Epidemiological Community Study", desc: "Analyze regional public health indicators to identify preventative health interventions." }
                ],
                read: [
                    { title: "Being Mortal", author: "Atul Gawande", isbn: "9781250076229", year: 2014, rating: "4.9", desc: "Medicine and what matters in the end; navigating aging, mortality, and patient autonomy." },
                    { title: "The Emperor of All Maladies", author: "Siddhartha Mukherjee", isbn: "9781439170915", year: 2010, rating: "4.8", desc: "A biography of cancer, humanity, and the relentless quest for scientific breakthroughs." }
                ],
                explore: [
                    { title: "The New England Journal of Medicine (NEJM)", desc: "World-leading peer-reviewed clinical research and case challenges." }
                ]
            },
            communicationExercise: {
                title: "Delivering a Difficult Diagnosis with Empathy and Clarity",
                prompt: "Communicate a chronic illness diagnosis to a frightened patient. Explain the treatment pathway clearly without overwhelming medical jargon, while addressing their fears.",
                framework: "SPIKES Protocol (Setting, Perception, Invitation, Knowledge, Empathy, Strategy)",
                why: "Compassionate bedside communication transforms patient compliance and psychological wellbeing."
            }
        },

        // --- 9. Law & Advocacy ---
        {
            id: "corporate_litigation_attorney",
            domainId: "law",
            category: "Law & Advocacy",
            title: "Corporate & Constitutional Law Strategist",
            icon: "⚖️",
            desc: "Navigate statutory frameworks, argue landmark litigation before judicial benches, structure billion-dollar mergers, and safeguard civil rights.",
            targetDimensions: {
                analyticalReasoning: 5,
                communication: 5,
                problemSolving: 4,
                systemsThinking: 4,
                execution: 5,
                careerValues: 4,
                independence: 4,
                collaboration: 3,
                leadership: 4
            },
            workStyle: "Exhaustive legal precedent research, precise contractual drafting, courtroom advocacy, strategic negotiation.",
            communicationStyle: "Impeccably reasoned written briefs, persuasive oral arguments, cross-examination, client counseling.",
            environment: "Law firms, courtrooms, corporate legal suites, non-profit policy advocacy institutes.",
            typicalActivities: [
                "Draft and negotiate high-stakes cross-border contracts, intellectual property, or M&A agreements",
                "Analyze legal precedent and judicial rulings to formulate winning litigation strategies",
                "Conduct oral arguments, preliminary motions, and witness examinations before legal tribunals",
                "Advise executive boards on regulatory compliance, antitrust risks, and fiduciary duties"
            ],
            strengthsRequired: ["Analytical Rigor", "Persuasive Argumentation", "Meticulous Drafting", "Ethical Integrity"],
            potentialFriction: "Demanding billable hour structures; reading thousands of pages of statutory text; adversarial court dynamics.",
            missingEvidenceCheck: "Check appetite for textual analysis, legal debate, and logical scrutiny.",
            learningRequirements: "Bachelor of Laws (LL.B / B.A. LL.B) or Juris Doctor (J.D.), followed by Bar Council examination and licensing.",
            careerProgression: "Associate Attorney ➔ Senior Associate ➔ Partner / Senior Advocate ➔ Managing Partner / Judge",
            phases: [
                {
                    title: "Phase 1: Foundation (Constitutional & Common Law)",
                    steps: "Master Constitutional Law, Contracts, Torts, Criminal Jurisprudence, and statutory interpretation rules."
                },
                {
                    title: "Phase 2: Skills & Tooling (Legal Research & Drafting)",
                    steps: "Master legal databases (SCC Online, Manupatra, Westlaw), brief writing, contract drafting, and moot court advocacy."
                },
                {
                    title: "Phase 3: Projects & Moot Court Excellence",
                    steps: "Compete in national/international moot courts (e.g. Jessup, Willem C. Vis), and publish papers in peer-reviewed law reviews."
                },
                {
                    title: "Phase 4: Experience & Judicial Clerkships",
                    steps: "Clerk for high court or supreme court judges, intern with top tier-1 law firms or senior litigation advocates."
                },
                {
                    title: "Phase 5: Bar Admission & Practice Launch",
                    steps: "Clear Bar Council licensing examination, build a reputation in specialized domain (IP, corporate, environmental, or litigation)."
                }
            ],
            realityCheck: {
                scenario: "In an acquisition contract, a seller guarantees that 'no intellectual property lawsuits are pending or threatened.' Two days before closing, a competitor sends an informal demand letter alleging patent infringement, but has not filed a court suit.",
                task: "Does this demand letter breach the warranty representation?",
                options: [
                    { id: "opt_a", text: "No, because no lawsuit has been officially stamped by a court clerk.", correct: false, note: "Incorrect: The clause explicitly included 'threatened' litigation; a formal demand letter constitutes a legal threat." },
                    { id: "opt_b", text: "Yes, an explicit written demand alleging infringement constitutes 'threatened' litigation under established commercial contract law.", correct: true, note: "Precise phrasing in contracts matters; failing to disclose threatened litigation can trigger massive post-closing damages and indemnity claims." },
                    { id: "opt_c", text: "Contracts don't matter once both parties shake hands.", correct: false, note: "Naive: Written agreements are the legally binding document governing remedies." }
                ],
                debrief: "Lawyers operate as the architects of trust and accountability, where a single ambiguous word can alter millions of dollars in liability."
            },
            learningResources: {
                learn: [
                    { title: "Harvard Law School Public Lectures", provider: "Harvard University", desc: "Foundations of constitutional law, corporate contracts, and justice theory." }
                ],
                practice: [
                    { title: "Moot Court Society Case Studies", type: "Simulation", desc: "Participate in simulated appellate court bench trials." }
                ],
                build: [
                    { title: "Public Interest Legal Brief", desc: "Draft a model Public Interest Litigation (PIL) petition advocating for environmental conservation." }
                ],
                read: [
                    { title: "Courting Justice", author: "Madhav Khosla", isbn: "9780143424987", year: 2012, rating: "4.7", desc: "The evolution of constitutional jurisprudence and landmark legal arguments." },
                    { title: "Point Made: How to Write Like the Nation's Top Advocates", author: "Ross Guberman", isbn: "9780199943852", year: 2014, rating: "4.9", desc: "The definitive guide to persuasive judicial writing." }
                ],
                explore: [
                    { title: "SCOTUSblog & Bar and Bench", desc: "Real-time analysis of landmark judicial rulings and constitutional proceedings." }
                ]
            },
            communicationExercise: {
                title: "Structuring a 3-Minute Judicial Oral Argument",
                prompt: "Argue before a simulated judicial bench why your client's data privacy rights supersede a corporate terms-of-service clause, anticipating harsh counter-questions.",
                framework: "IRAC: Issue ➔ Rule ➔ Application ➔ Conclusion",
                why: "Attorneys must structure arguments logically and pivot effortlessly under aggressive cross-questioning."
            }
        },

        // --- 10. Business & Management ---
        {
            id: "product_management_director",
            domainId: "business_management",
            category: "Business & Management",
            title: "Product Management Director & Strategy Lead",
            icon: "🏢",
            desc: "Sit at the intersection of technology, design, and business strategy to define product vision, align cross-functional teams, and drive market growth.",
            targetDimensions: {
                systemsThinking: 5,
                communication: 5,
                leadership: 5,
                problemSolving: 5,
                collaboration: 5,
                analyticalReasoning: 4,
                execution: 4,
                riskTolerance: 3,
                creativity: 4
            },
            workStyle: "Strategic roadmap prioritization, running sprint planning, stakeholder alignment, user interviews.",
            communicationStyle: "Inspiring product vision presentations, clear PRDs (Product Requirements Documents), executive trade-off memos.",
            environment: "Tech headquarters, cross-functional agile squads, global product teams.",
            typicalActivities: [
                "Define the multi-year product roadmap and strategic North Star metrics",
                "Write comprehensive PRDs specifying feature requirements and acceptance criteria",
                "Align engineering, design, data, legal, and sales teams on sprint priorities",
                "Analyze user retention funnels and commercial monetization levers"
            ],
            strengthsRequired: ["Cross-Functional Leadership", "Strategic Prioritization", "Customer Empathy", "Analytical Decisiveness"],
            potentialFriction: "Holding ultimate responsibility for product outcomes without having direct authority over engineers or designers.",
            missingEvidenceCheck: "Assess ability to persuade without authority, make trade-offs, and balance technical and business constraints.",
            learningRequirements: "Background in Computer Science, Engineering, Business (MBA), or successful track record as an associate PM.",
            careerProgression: "Associate PM ➔ Product Manager ➔ Senior PM ➔ Director of Product ➔ Chief Product Officer (CPO)",
            phases: [
                {
                    title: "Phase 1: Foundation (Tech, Design & Business Fundamentals)",
                    steps: "Understand software architectures (APIs, databases), basic UX principles, and unit economics (LTV, CAC, margins)."
                },
                {
                    title: "Phase 2: Skills & Tooling (Product Management Toolkit)",
                    steps: "Master writing crisp PRDs, user story mapping, backlog management (Jira/Linear), analytics (Mixpanel/Amplitude), and Figma navigation."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Live Product Tear-Downs)",
                    steps: "Produce 2 in-depth product teardowns identifying friction in real apps with proposed specs, roadmaps, and metric impact models."
                },
                {
                    title: "Phase 4: Experience & APM Programs",
                    steps: "Apply to prestigious Associate Product Manager (APM) programs or transition internally from engineering/analytics into PM."
                },
                {
                    title: "Phase 5: Career Preparation & PM Interviews",
                    steps: "Master product design, estimation, behavioral (STAR), and strategic execution interview frameworks."
                }
            ],
            realityCheck: {
                scenario: "Your engineering lead estimates that a requested client feature will take 3 months and delay a critical security overhaul by 6 weeks. The VP of Sales insists that without this feature, the company will miss quarterly revenue goals.",
                task: "How do you navigate this classic executive deadlock?",
                options: [
                    { id: "opt_a", text: "Side with the VP of Sales immediately and tell engineers to work weekends.", correct: false, note: "Unsound: Burning out engineers and ignoring security debt creates catastrophic vulnerabilities." },
                    { id: "opt_b", text: "Deconstruct the client feature to its bare Minimum Lovable Product (MLP), finding a lightweight phase-1 solution in 2 weeks while safeguarding the security overhaul timeline.", correct: true, note: "Master PMs re-negotiate scope trade-offs, discovering compromise solutions that satisfy business commitments while protecting system integrity." },
                    { id: "opt_c", text: "Tell both sides to sort it out themselves and step away.", correct: false, note: "Abdication of product leadership; the PM's core responsibility is steering difficult trade-offs." }
                ],
                debrief: "Product managers succeed not by making everyone happy, but by leading transparent prioritization that protects long-term company health."
            },
            learningResources: {
                learn: [
                    { title: "Lenny's Newsletter & Podcast", provider: "Lenny Rachitsky", desc: "The premier playbook on product management, growth, and company culture." },
                    { title: "Product School Free Masterclasses", provider: "Product School", desc: "Insights from leading CPOs across Silicon Valley." }
                ],
                practice: [
                    { title: "Exponent PM Interview Prep", type: "Practice Community", desc: "Mock product design and execution interviews with peers." }
                ],
                build: [
                    { title: "Comprehensive PRD & Prototype", desc: "Write a 10-page production-grade PRD for an AI workflow tool, complete with user stories and edge cases." }
                ],
                read: [
                    { title: "Inspired: How to Create Tech Products Customers Love", author: "Marty Cagan", isbn: "9781119387503", year: 2017, rating: "4.8", desc: "The definitive guide to modern empowered product teams and discovery." },
                    { title: "Cracking the PM Interview", author: "Gayle Laakmann McDowell", isbn: "9780984782819", year: 2013, rating: "4.6", desc: "How to land a product manager job in technology." }
                ],
                explore: [
                    { title: "Mind the Product Community", desc: "Global network of innovative product managers." }
                ]
            },
            communicationExercise: {
                title: "Pitching an Unpopular Strategic Trade-Off to Leadership",
                prompt: "Present a case to the executive team for sunsetting a legacy product feature that generates 5% of revenue but consumes 40% of customer support and engineering bandwidth.",
                framework: "Trade-off Matrix: Costs of Action vs. Costs of Inaction",
                why: "Product leaders must courageously prune low-value complexity to free resources for high-leverage growth."
            }
        },

        // --- 11. Government & Policy ---
        {
            id: "public_policy_strategist",
            domainId: "government_policy",
            category: "Government & Policy",
            title: "Public Policy Strategist & Civil Administrator",
            icon: "🏛️",
            desc: "Architect national social programs, craft regulatory frameworks for emerging technology, and steer public institutions to serve citizens at scale.",
            targetDimensions: {
                systemsThinking: 5,
                careerValues: 5,
                communication: 5,
                analyticalReasoning: 4,
                leadership: 4,
                collaboration: 4,
                problemSolving: 4,
                execution: 3,
                riskTolerance: 2
            },
            workStyle: "Socio-economic impact assessments, legislative drafting, stakeholder diplomacy, public hearings.",
            communicationStyle: "Objective policy briefing memos, diplomatic mediation, speeches, public testimony.",
            environment: "Government ministries, think tanks, international NGOs (UN, World Bank), municipal secretariats.",
            typicalActivities: [
                "Analyze empirical economic data to evaluate the impact of universal healthcare or education policies",
                "Draft white papers and statutory guidelines for municipal urban infrastructure projects",
                "Coordinate across government departments, civil society, and industry stakeholders",
                "Evaluate policy outcomes against constitutional equity and budgetary constraints"
            ],
            strengthsRequired: ["Institutional Systems Thinking", "Diplomatic Communication", "Socio-Economic Acumen", "Public Interest Focus"],
            potentialFriction: "Navigating slow bureaucratic hierarchies; political headwinds and polarized interest groups.",
            missingEvidenceCheck: "Assess passion for macro governance, constitutional principles, and long-term systemic change.",
            learningRequirements: "Degree in Public Policy (MPP), Public Administration (MPA), Economics, Political Science, or competitive Civil Service examination (UPSC / Civil Services).",
            careerProgression: "Policy Analyst ➔ Senior Policy Advisor ➔ Director of Public Affairs ➔ Secretary to Government / Chief Policy Officer",
            phases: [
                {
                    title: "Phase 1: Foundation (Economics, Governance & Constitution)",
                    steps: "Master Micro & Macroeconomics, Constitutional Law, Administrative Governance, and Public Finance."
                },
                {
                    title: "Phase 2: Skills & Tooling (Policy Evaluation & Data)",
                    steps: "Learn econometric software (R / Stata), Cost-Benefit Analysis (CBA), randomized controlled trial (RCT) evaluation, and legislative drafting."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Policy White Paper)",
                    steps: "Publish a comprehensive policy brief proposing regulatory safeguards for algorithmic AI bias in civic administration."
                },
                {
                    title: "Phase 4: Experience & Civil Service / Think Tanks",
                    steps: "Fellowships with think tanks (Brookings, NITI Aayog, ORF), legislative assistant internships, or clearing Civil Service exams."
                },
                {
                    title: "Phase 5: Career Leadership & Institutional Impact",
                    steps: "Direct key public welfare missions, advise parliamentary committees, and represent institutions in multilateral forums."
                }
            ],
            realityCheck: {
                scenario: "A municipality plans to introduce an automated digital tax filing portal. While tech-savvy citizens praise it, 35% of elderly and low-income residents lack internet access or digital literacy, risking widespread penalties.",
                task: "What policy amendment ensures universal equity without halting digital progress?",
                options: [
                    { id: "opt_a", text: "Proceed with 100% digital only and fine those who do not comply to force adoption.", correct: false, note: "Punitively disenfranchises vulnerable citizens and violates public administrative duties." },
                    { id: "opt_b", text: "Implement an assisted hybrid model: keep the digital portal, but convert local post offices and community centers into free assisted physical filing kiosks with mobile outreach units.", correct: true, note: "Inclusive public policy bridges digital divides by coupling technological progress with accessible physical infrastructure." },
                    { id: "opt_c", text: "Abandon the digital system entirely and remain on paper forever.", correct: false, note: "Halting progress preserves administrative inefficiency, fraud, and high tax processing costs." }
                ],
                debrief: "Public administrators must design systems that uplift the most vulnerable citizens rather than leaving them behind in the march of efficiency."
            },
            learningResources: {
                learn: [
                    { title: "Public Policy Analysis", provider: "London School of Economics (LSE)", desc: "Quantitative and qualitative frameworks for evaluating policy interventions." }
                ],
                practice: [
                    { title: "J-PAL Case Studies", provider: "MIT / J-PAL", desc: "Rigorous randomized evaluation of poverty alleviation and social programs." }
                ],
                build: [
                    { title: "Municipal Urban Transit Blueprint", desc: "Draft an integrated bus-rapid-transit and bike-share public policy proposal for an expanding city." }
                ],
                read: [
                    { title: "Poor Economics", author: "Abhijit V. Banerjee & Esther Duflo", isbn: "9781610390934", year: 2011, rating: "4.8", desc: "A radical rethinking of the way to fight global poverty using empirical evidence." },
                    { title: "Governing the Commons", author: "Elinor Ostrom", isbn: "9780521405997", year: 1990, rating: "4.9", desc: "The evolution of institutions for collective action and resource governance." }
                ],
                explore: [
                    { title: "Project Syndicate & Foreign Affairs", desc: "Global commentary on governance, geo-economics, and institutional reform." }
                ]
            },
            communicationExercise: {
                title: "Conducting a Public Town Hall Under Community Criticism",
                prompt: "Address an anxious crowd of residents protesting a new urban rezoning proposal. Validate their concerns, explain the long-term infrastructure benefits, and outline mitigation measures.",
                framework: "Acknowledge + Empathize + Evidence + Path Forward",
                why: "Public leaders must face democratic scrutiny with grace, transparency, and unshakeable calm."
            }
        },

        // --- 12. Science & Research ---
        {
            id: "biomedical_genomics_scientist",
            domainId: "science_research",
            category: "Science & Research",
            title: "Biomedical & Genomics Research Scientist",
            icon: "🔬",
            desc: "Investigate cellular pathways, CRISPR gene-editing therapies, and molecular biology to unlock breakthrough cures for genetic diseases.",
            targetDimensions: {
                curiosity: 5,
                analyticalReasoning: 5,
                problemSolving: 5,
                independence: 4,
                execution: 4,
                systemsThinking: 4,
                careerValues: 4,
                collaboration: 3,
                motivation: 5
            },
            workStyle: "Wet-lab assay protocols, bioinformatic sequence analysis, peer-reviewed paper authorship.",
            communicationStyle: "Scientific paper publications, presenting posters at international conferences, grant writing.",
            environment: "Biotechnology research laboratories, academic research institutes, genomics startup labs.",
            typicalActivities: [
                "Analyze next-generation sequencing (NGS) data to identify novel disease mutations",
                "Design in vitro CRISPR-Cas9 guide RNA constructs and validate target specificity",
                "Author grant proposals for funding from the NIH, Wellcome Trust, or scientific foundations",
                "Collaborate with computational biologists to model protein folding and drug interactions"
            ],
            strengthsRequired: ["Scientific Method", "Molecular Biology", "Bioinformatics", "Perseverance"],
            potentialFriction: "Long experimental timelines; experiments frequently fail; highly competitive grant-writing cycles.",
            missingEvidenceCheck: "Assess deep love for bench science, empirical discovery, and reading dense literature.",
            learningRequirements: "B.S. in Biochemistry / Biotechnology / Biology, followed by Ph.D. in Molecular Biology, Genomics, or Bioengineering.",
            careerProgression: "Graduate Researcher ➔ Postdoctoral Fellow ➔ Principal Investigator (PI) / Senior Scientist ➔ Chief Scientific Officer",
            phases: [
                {
                    title: "Phase 1: Foundation (Molecular Biology & Genetics)",
                    steps: "Master Cell Biology, Organic Chemistry, Genetics, Bioinformatics, and statistical research methods."
                },
                {
                    title: "Phase 2: Laboratory Mastery (Wet Lab & Computational)",
                    steps: "Learn PCR, gel electrophoresis, cell culture, CRISPR protocols, and Python/R for genomic sequence analysis (Biopython, DESeq2)."
                },
                {
                    title: "Phase 3: Ph.D. Dissertation & Publications",
                    steps: "Lead original doctoral research, uncover novel biological mechanisms, and publish peer-reviewed papers in high-impact journals."
                },
                {
                    title: "Phase 4: Postdoctoral Fellowship & Grant Writing",
                    steps: "Broaden specialized research domains in a renowned lab, write successful fellowship grant proposals, and build an international scientific network."
                },
                {
                    title: "Phase 5: Laboratory Leadership or Biotech Spin-Out",
                    steps: "Establish your independent academic lab as a Principal Investigator (PI) or co-found a therapeutics biotech startup."
                }
            ],
            realityCheck: {
                scenario: "A targeted cell therapy shows tremendous eradication of tumor cells in 2D cell cultures, but when tested in 3D spheroid models with an extracellular matrix, cell penetration drops to under 5%.",
                task: "What is the primary scientific deduction?",
                options: [
                    { id: "opt_a", text: "The experimental pipette must be contaminated; throw out all samples.", correct: false, note: "Unlikely to be simple contamination; this is a classic physiological delivery barrier." },
                    { id: "opt_b", text: "2D culture models fail to simulate physical extracellular matrix density and interstitial fluid pressure barriers; redesign the carrier formulation for tissue penetration.", correct: true, note: "In vivo tissue microenvironments present biophysical barriers that simple flat cultures fail to model; drug delivery requires spatial bioengineering." },
                    { id: "opt_c", text: "Publish the 2D results anyway and hide the 3D data.", correct: false, note: "Scientific misconduct and a guarantee of clinical trial failure later." }
                ],
                debrief: "True science requires intellectual honesty, resilience against initial setbacks, and honoring empirical truth."
            },
            learningResources: {
                learn: [
                    { title: "MIT Principles of Molecular Biology", provider: "MIT OpenCourseWare", desc: "Rigorous mechanisms of DNA replication, transcription, and translation." }
                ],
                practice: [
                    { title: "Rosalind Bioinformatics Challenges", type: "Problem Platform", desc: "Learn bioinformatics through algorithmic genomics problems." }
                ],
                build: [
                    { title: "RNA-Seq Differential Expression Analysis", desc: "Process raw FASTQ files into differential gene expression plots using Python and DESeq2." }
                ],
                read: [
                    { title: "The Code Breaker", author: "Walter Isaacson", isbn: "9781982115852", year: 2021, rating: "4.8", desc: "Jennifer Doudna, gene editing, and the future of the human race." },
                    { title: "Molecular Biology of the Cell", author: "Bruce Alberts", isbn: "9780393884821", year: 2022, rating: "4.9", desc: "The foundational encyclopedia of cellular machinery." }
                ],
                explore: [
                    { title: "Nature & Science Journals", desc: "Flagship global discovery publications." }
                ]
            },
            communicationExercise: {
                title: "Explaining Gene Editing Ethics to a Parliamentary Committee",
                prompt: "Testify before a public legislative committee on the safety, therapeutic potential, and ethical boundaries of somatic gene therapies.",
                framework: "Science Context ➔ Benefit Matrix ➔ Ethical Safeguards ➔ Recommendation",
                why: "Leading scientists must bridge technical frontiers with public ethics and legislative understanding."
            }
        },

        // --- 13. Psychology & Human Services ---
        {
            id: "clinical_psychologist",
            domainId: "psychology_human_services",
            category: "Psychology & Human Services",
            title: "Clinical Psychologist & Cognitive Therapist",
            icon: "🧠",
            desc: "Help individuals navigate trauma, neurodivergence, and emotional distress through evidence-based cognitive therapies and psychological assessments.",
            targetDimensions: {
                communication: 5,
                careerValues: 5,
                collaboration: 4,
                analyticalReasoning: 4,
                problemSolving: 4,
                curiosity: 4,
                independence: 3,
                execution: 3
            },
            workStyle: "1-on-1 confidential therapeutic sessions, clinical case formulation, psychometric testing.",
            communicationStyle: "Deep empathetic active listening, non-judgmental reframing, psychoeducation.",
            environment: "Private therapy clinics, mental health hospitals, university counseling centers.",
            typicalActivities: [
                "Conduct comprehensive psychological diagnostic interviews and psychometric assessments",
                "Formulate personalized Cognitive Behavioral Therapy (CBT) and ACT intervention plans",
                "Guide clients through trauma processing, emotional regulation, and cognitive restructuring",
                "Coordinate with psychiatrists on pharmacological and therapeutic dual care"
            ],
            strengthsRequired: ["Empathetic Attunement", "Psychological Formulation", "Emotional Stability", "Confidential Rigor"],
            potentialFriction: "Risk of vicarious traumatization and compassion fatigue; requires strict personal boundary management.",
            missingEvidenceCheck: "Assess patience, deep empathy, emotional resilience, and interest in psychological frameworks.",
            learningRequirements: "B.A./B.S. in Psychology, followed by Master's in Clinical Psychology (M.Phil / M.Sc) or Psy.D. / Ph.D., and state licensing.",
            careerProgression: "Trainee Psychologist ➔ Licensed Clinical Psychologist ➔ Senior Consultant ➔ Clinic Director / Academic Chair",
            phases: [
                {
                    title: "Phase 1: Foundation (Psychology Fundamentals)",
                    steps: "Master General Psychology, Abnormal Psychology, Developmental Stages, and Research Methodology."
                },
                {
                    title: "Phase 2: Master's & Therapeutic Frameworks",
                    steps: "Complete Master's degree. Master CBT, Acceptance and Commitment Therapy (ACT), psychometrics, and clinical diagnostics (DSM-5 / ICD-11)."
                },
                {
                    title: "Phase 3: Supervised Clinical Practicum",
                    steps: "Complete 1,000+ hours of supervised clinical patient hours in inpatient psychiatric and outpatient therapy settings."
                },
                {
                    title: "Phase 4: Clinical Licensing & Ethics",
                    steps: "Clear state/national licensing board exams, commit to code of ethics, and establish peer supervision circles."
                },
                {
                    title: "Phase 5: Specialized Practice or Clinic Leadership",
                    steps: "Establish a specialized private practice (e.g. adolescent anxiety, neurodiversity, trauma) or lead clinical counseling teams."
                }
            ],
            realityCheck: {
                scenario: "A client dealing with severe social anxiety cancels their third consecutive session at the last minute, citing feeling 'unworthy of taking up the therapist's time.'",
                task: "What is the most therapeutically constructive response?",
                options: [
                    { id: "opt_a", text: "Send a stern message charging a cancellation penalty and terminate therapy.", correct: false, note: "Reinforces the client's core belief of rejection and unworthiness." },
                    { id: "opt_b", text: "Acknowledge their avoidance with warm validation, gently reframe the cancellation as a direct manifestation of their anxiety, and collaboratively explore a lower-pressure re-entry step.", correct: true, note: "Clinical mastery recognizes avoidance behavior as clinical material to be explored empathetically rather than punished." },
                    { id: "opt_c", text: "Ignore the message completely and wait to see if they reach out in 6 months.", correct: false, note: "Abandons a vulnerable client during an acute anxiety spiral." }
                ],
                debrief: "Psychology is the delicate art and rigorous science of holding space for human vulnerability and guiding self-transformation."
            },
            learningResources: {
                learn: [
                    { title: "Beck Institute CBT Essentials", provider: "Beck Institute", desc: "The definitive cognitive behavioral therapy course by Judith Beck." }
                ],
                practice: [
                    { title: "Clinical Roleplay Supervisions", type: "Practicum", desc: "Supervised roleplay sessions with master clinicians." }
                ],
                build: [
                    { title: "Psychoeducational Self-Regulation Workbook", desc: "Design an evidence-based DBT/CBT workbook for emotional regulation and mindfulness." }
                ],
                read: [
                    { title: "The Body Keeps the Score", author: "Bessel van der Kolk", isbn: "9780143127741", year: 2014, rating: "4.9", desc: "Brain, mind, and body in the healing of trauma." },
                    { title: "Man's Search for Meaning", author: "Viktor E. Frankl", isbn: "9780807014295", year: 1946, rating: "4.8", desc: "The classic tribute to hope from the Holocaust and logotherapy principles." }
                ],
                explore: [
                    { title: "American Psychological Association (APA)", desc: "Global flagship psychological research and clinical practice association." }
                ]
            },
            communicationExercise: {
                title: "Reframing a Catastrophic Thought Loop",
                prompt: "Demonstrate therapeutic reframing with a client who believes 'If I make one mistake during my presentation tomorrow, my entire career is permanently destroyed.'",
                framework: "Empathy ➔ Cognitive Decatastrophizing ➔ Alternative Perspective",
                why: "Therapists must gently challenge distorted cognitive schemas without invalidating the client's emotional reality."
            }
        },

        // --- 14. Marketing & Strategic Sales ---
        {
            id: "growth_marketing_strategist",
            domainId: "marketing_sales",
            category: "Marketing & Strategic Sales",
            title: "Growth Marketing Director & Brand Strategist",
            icon: "📣",
            desc: "Synthesize consumer psychology, creative brand storytelling, and data-driven distribution channels to acquire millions of users and scale enterprise revenue.",
            targetDimensions: {
                creativity: 5,
                communication: 5,
                analyticalReasoning: 4,
                systemsThinking: 4,
                execution: 4,
                problemSolving: 4,
                riskTolerance: 3,
                collaboration: 4
            },
            workStyle: "Multi-channel experimentation, creative campaign ideation, funnel conversion optimization, customer psychology research.",
            communicationStyle: "Irresistible value propositions, viral copywriting, performance marketing dashboards, brand decks.",
            environment: "Modern consumer tech startups, global agencies, growth-stage digital companies.",
            typicalActivities: [
                "Architect multi-channel growth loops across content, SEO, paid performance, and viral referrals",
                "Write persuasive high-converting copy for landing pages, product announcements, and email onboarding",
                "Analyze CAC (Customer Acquisition Cost) to LTV ratios across demographic customer cohorts",
                "Direct creative teams on video production, motion graphics, and brand positioning"
            ],
            strengthsRequired: ["Consumer Psychology", "Data-Driven Experimentation", "Persuasive Copywriting", "Strategic Distribution"],
            potentialFriction: "Ad platform algorithm shifts; pressure to maintain constant acquisition efficiency in saturating markets.",
            missingEvidenceCheck: "Check passion for consumer psychology, analytics, viral mechanics, and creative messaging.",
            learningRequirements: "Degree in Marketing, Communications, Economics, or proven track record of scaling consumer/B2B products.",
            careerProgression: "Growth Associate ➔ Growth Marketing Manager ➔ VP of Growth ➔ Chief Marketing Officer (CMO)",
            phases: [
                {
                    title: "Phase 1: Foundation (Consumer Psychology & Storytelling)",
                    steps: "Study behavioral economics, persuasion frameworks (Cialdini), brand architecture, and copy fundamentals."
                },
                {
                    title: "Phase 2: Skills & Tooling (Performance & Funnel Analytics)",
                    steps: "Master Google Ads, Meta Ads Manager, SEO tooling (Ahrefs), email automation (Klaviyo), and web analytics (GA4/Mixpanel)."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Live Growth Campaigns)",
                    steps: "Build and scale an audience or e-commerce store to 10k+ followers/subscribers with documented CAC and conversion metrics."
                },
                {
                    title: "Phase 4: Experience & Agency/Startup Growth Sprints",
                    steps: "Lead growth experiments at a high-velocity startup or digital agency, scaling marketing budgets profitably."
                },
                {
                    title: "Phase 5: Career Leadership & CMO Brand Mastery",
                    steps: "Craft enterprise brand narratives, manage multi-million dollar budgets, and direct integrated product marketing launches."
                }
            ],
            realityCheck: {
                scenario: "A SaaS marketing team launches an aggressive paid ad campaign that triples website traffic, but free-to-paid conversion plunges from 8% to 0.4%, wasting significant marketing spend.",
                task: "What is the diagnosis and remedy?",
                options: [
                    { id: "opt_a", text: "Triple the ad budget again to overpower the drop with sheer volume.", correct: false, note: "Disastrous: Scaling an unprofitable, low-intent funnel burns cash exponentially." },
                    { id: "opt_b", text: "The ad creative targeted low-intent audiences with misaligned expectations; refine targeting to high-intent buyer personas and realign landing page messaging with the core value proposition.", correct: true, note: "Growth marketing is about high-intent resonance, not vanity traffic; audience targeting and landing page congruence are paramount." },
                    { id: "opt_c", text: "Delete all ads and never use paid marketing again.", correct: false, note: "Extreme overreaction; paid marketing works well when targeting and messaging are calibrated." }
                ],
                debrief: "Exceptional marketers understand that qualified intent and unit economics always trump empty vanity traffic metrics."
            },
            learningResources: {
                learn: [
                    { title: "Reforge Growth Series", provider: "Reforge / Brian Balfour", desc: "The premier curriculum on scalable growth loops, retention, and monetization." }
                ],
                practice: [
                    { title: "Marketing Examined Case Studies", type: "Breakdowns", desc: "Deconstructed growth tactics from the world's fastest growing brands." }
                ],
                build: [
                    { title: "Zero-to-One Product Launch Strategy", desc: "Design an end-to-end product launch playbook with positioning, channel mix, and 90-day targets." }
                ],
                read: [
                    { title: "Influence: The Psychology of Persuasion", author: "Robert B. Cialdini", isbn: "9780061241895", year: 2006, rating: "4.8", desc: "The foundational classic on human psychological triggers and compliance." },
                    { title: "Traction: How Any Startup Can Achieve Explosive Customer Growth", author: "Gabriel Weinberg", isbn: "9781591848363", year: 2015, rating: "4.7", desc: "The Bullseye Framework for mastering 19 customer acquisition channels." }
                ],
                explore: [
                    { title: "GrowthHackers Community", desc: "Global collective of data-driven marketing practitioners." }
                ]
            },
            communicationExercise: {
                title: "Pitching a Radical Brand Re-positioning to the Board",
                prompt: "Convince conservative board members why shedding their 15-year-old corporate brand identity in favor of a modern, provocative voice will unlock younger demographics.",
                framework: "Value Hook + Proof Point + Future Impact",
                why: "Marketing leaders must inspire corporate boards to embrace bold creative differentiation."
            }
        },

        // --- 15. Media & Communication ---
        {
            id: "investigative_multimedia_journalist",
            domainId: "media_communication",
            category: "Media & Communication",
            title: "Investigative Journalist & Multimedia Storyteller",
            icon: "🎙️",
            desc: "Uncover hidden truths, hold powerful institutions accountable, and craft compelling investigative documentaries and podcast narratives.",
            targetDimensions: {
                curiosity: 5,
                communication: 5,
                careerValues: 5,
                analyticalReasoning: 4,
                independence: 4,
                riskTolerance: 4,
                execution: 4,
                problemSolving: 4,
                creativity: 4
            },
            workStyle: "Deep source cultivation, public records investigations, narrative audio/video production, fact-checking.",
            communicationStyle: "Compelling narrative nonfiction, sharp on-the-record interviewing, investigative exposés.",
            environment: "Newsrooms, field reporting locations, audio production studios, international bureaus.",
            typicalActivities: [
                "File Freedom of Information (FOI) requests and analyze leaked financial/government datasets",
                "Cultivate confidential whistleblowers and conduct sensitive investigative interviews",
                "Script, produce, and narrate serialized documentary podcasts and video series",
                "Defend journalistic integrity and withstand legal review with bulletproof documentation"
            ],
            strengthsRequired: ["Tenacious Inquiry", "Narrative Storytelling", "Source Cultivation", "Ethical Courage"],
            potentialFriction: "Legal intimidation from powerful entities; irregular field hours; emotional toll of traumatic stories.",
            missingEvidenceCheck: "Assess passion for truth, investigative digging, and compelling narrative writing.",
            learningRequirements: "Degree in Journalism, Mass Communication, English, History, or proven investigative publishing record.",
            careerProgression: "Staff Reporter ➔ Senior Investigative Journalist ➔ Executive Producer / Foreign Correspondent ➔ Editor-in-Chief",
            phases: [
                {
                    title: "Phase 1: Foundation (Reporting & Media Ethics)",
                    steps: "Master news gathering, investigative ethics, media law (defamation, source protection), and narrative writing."
                },
                {
                    title: "Phase 2: Skills & Tooling (Data Journalism & Audio/Video)",
                    steps: "Learn data scraping (Python), public records requests (RTI / FOIA), audio editing (Logic/Pro Tools), and camera operation."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Investigative Feature)",
                    steps: "Publish a three-part investigative series exposing an overlooked municipal, environmental, or corporate abuse."
                },
                {
                    title: "Phase 4: Experience & Newsroom Internships",
                    steps: "Work in reputable news organizations, collaborate on collaborative investigative consortia (ICIJ / ProPublica models)."
                },
                {
                    title: "Phase 5: Career Impact & Senior Reporting",
                    steps: "Lead investigative desks, publish landmark books, produce serialized podcasts, and hold power accountable."
                }
            ],
            realityCheck: {
                scenario: "An anonymous source sends you explosive leaked documents proving a major corporation dumped toxic chemicals into a municipal river. A corporate lawyer contacts you claiming the documents were stolen and threatens immediate criminal prosecution if you publish.",
                task: "What is your primary journalistic and legal obligation?",
                options: [
                    { id: "opt_a", text: "Delete the files immediately and apologize to the corporation.", correct: false, note: "Capitulating to pre-publication threats without investigation betrays public interest journalism." },
                    { id: "opt_b", text: "Verify the authenticity of the documents through independent laboratory testing and corroborating witnesses, consult newsroom legal counsel on public interest protections, and offer the corporation fair right of reply with specific questions before publishing.", correct: true, note: "Bulletproof verification, independent corroboration, and rigorous right-of-reply protect both the truth and the journalist." },
                    { id: "opt_c", text: "Post raw unverified scans to social media anonymously with no verification.", correct: false, note: "Unethical: Publishing unverified documents can spread hoaxes and cause defamation." }
                ],
                debrief: "Journalists are the public's guardians of truth, operating with scrupulous fact-checking and unwavering courage under pressure."
            },
            learningResources: {
                learn: [
                    { title: "Knight Center for Journalism Courses", provider: "University of Texas", desc: "Data journalism, open-source intelligence (OSINT), and investigative methods." }
                ],
                practice: [
                    { title: "Bellingcat OSINT Guides", type: "Investigation Tools", desc: "Learn geolocation, satellite imagery verification, and digital forensic sleuthing." }
                ],
                build: [
                    { title: "Serialized 4-Episode Podcast", desc: "Script, record, and sound-design an investigative true audio documentary with original interviews." }
                ],
                read: [
                    { title: "All the President's Men", author: "Bob Woodward & Carl Bernstein", isbn: "9780671894412", year: 1974, rating: "4.8", desc: "The landmark story of how two young reporters broke the Watergate scandal." },
                    { title: "Bad Blood", author: "John Carreyrou", isbn: "9781524731656", year: 2018, rating: "4.9", desc: "Secrets and lies in a Silicon Valley startup: the investigative exposé of Theranos." }
                ],
                explore: [
                    { title: "ProPublica & ICIJ", desc: "Flagship global investigative nonprofit reporting." }
                ]
            },
            communicationExercise: {
                title: "Conducting an On-the-Record Adversarial Interview",
                prompt: "Interview a defensive public official who refuses to answer questions about unaccounted disaster relief funds, keeping them focused on concrete accounting records.",
                framework: "Calm Persistence + Fact Anchor + Follow-up Mirroring",
                why: "Investigative reporters must remain unflinchingly polite, hyper-focused, and unshakeable under evasive spin."
            }
        },

        // --- 16. Architecture & Spatial Design ---
        {
            id: "sustainable_architect",
            domainId: "architecture",
            category: "Architecture & Spatial Design",
            title: "Sustainable Architect & Urban Planner",
            icon: "📐",
            desc: "Conceive regenerative physical buildings, sustainable public spaces, and smart urban masterplans that harmonize human community with ecological balance.",
            targetDimensions: {
                creativity: 5,
                systemsThinking: 5,
                problemSolving: 4,
                analyticalReasoning: 4,
                careerValues: 4,
                execution: 4,
                collaboration: 4,
                independence: 3
            },
            workStyle: "3D architectural modeling, spatial diagrams, physical site visits, structural engineering coordination.",
            communicationStyle: "Vivid architectural rendering walkthroughs, client vision presentations, zoning board hearings.",
            environment: "Architecture design studios, physical construction sites, municipal planning offices.",
            typicalActivities: [
                "Draft conceptual spatial blueprints and passive solar thermal models in BIM (Revit/Rhino)",
                "Integrate embodied carbon accounting, timber structures, and circular building materials",
                "Coordinate MEP (Mechanical, Electrical, Plumbing) and structural engineering systems",
                "Conduct municipal zoning reviews and present designs to environmental committees"
            ],
            strengthsRequired: ["Spatial Imagination", "BIM Mastery", "Ecological Building Science", "Aesthetic Craft"],
            potentialFriction: "Bureaucratic building codes and municipal delays; client budget cuts eroding architectural vision.",
            missingEvidenceCheck: "Assess passion for physical structures, spatial geometry, sustainable materials, and 3D modeling.",
            learningRequirements: "Bachelor of Architecture (B.Arch) or Master of Architecture (M.Arch), licensed by the national Council of Architecture.",
            careerProgression: "Junior Architect ➔ Project Architect ➔ Senior Associate ➔ Principal Design Partner / Studio Founder",
            phases: [
                {
                    title: "Phase 1: Foundation (Drafting & Architectural History)",
                    steps: "Master freehand architectural sketching, descriptive geometry, structural mechanics, and history of world architecture."
                },
                {
                    title: "Phase 2: Skills & Tooling (BIM & Environmental Simulation)",
                    steps: "Achieve fluency in Revit, Rhino/Grasshopper, AutoCAD, daylight simulation (Ladybug/Honeybee), and Enscape/Twinmotion."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Comprehensive Design Studio)",
                    steps: "Design a mixed-use community hub with net-zero carbon certification, active rainwater harvesting, and timber structure."
                },
                {
                    title: "Phase 4: Apprenticeship & Site Execution",
                    steps: "Complete architectural apprenticeships, observe on-site concrete pours and structural framing, and coordinate subcontractor blueprints."
                },
                {
                    title: "Phase 5: Licensing & Independent Practice",
                    steps: "Clear professional licensing examinations, win design competitions, and launch an independent architecture atelier."
                }
            ],
            realityCheck: {
                scenario: "A client demands floor-to-ceiling glass windows on the entire western facade of a building in a hot climate zone to maximize views. Energy simulations show this will triple cooling electricity consumption and create intense thermal discomfort.",
                task: "What architectural innovation resolves this dilemma elegantly?",
                options: [
                    { id: "opt_a", text: "Surrender to the client and install giant diesel backup air conditioners on the roof.", correct: false, note: "Irresponsible: Destroys energy efficiency, violates sustainable design standards, and balloons operating costs." },
                    { id: "opt_b", text: "Integrate kinetic exterior louvers, deep horizontal brise-soleil overhangs, and high-performance electrochromic double-glazed low-E glass that blocks solar heat gain while preserving the panoramic view.", correct: true, note: "Passive architectural shading and high-performance glass achieve aesthetic ambition while dramatically slashing thermal load." },
                    { id: "opt_c", text: "Refuse to build windows at all and give them a solid concrete wall.", correct: false, note: "Unrealistic; ignores client desires instead of solving the design tension intelligently." }
                ],
                debrief: "Architects harmonize physics, ecological conscience, and human aesthetic desires into enduring physical monuments."
            },
            learningResources: {
                learn: [
                    { title: "MIT Sustainable Architecture", provider: "MIT OpenCourseWare", desc: "Daylighting, building physics, and energy modeling fundamentals." }
                ],
                practice: [
                    { title: "Parametric Grasshopper Challenges", type: "Computational Design", desc: "Algorithmic generation of complex structural facades." }
                ],
                build: [
                    { title: "Net-Zero Urban Community Center", desc: "Produce a full BIM model with life-cycle carbon calculations and passive ventilation diagrams." }
                ],
                read: [
                    { title: "The Architecture of Happiness", author: "Alain de Botton", isbn: "9780307277244", year: 2006, rating: "4.6", desc: "How buildings shape our emotions, character, and psychological wellbeing." },
                    { title: "Cradle to Cradle", author: "William McDonough & Michael Braungart", isbn: "9780865475878", year: 2002, rating: "4.7", desc: "Remaking the way we make things; the foundational philosophy of ecological design." }
                ],
                explore: [
                    { title: "ArchDaily & Dezeen", desc: "World's most visited architecture and spatial design publications." }
                ]
            },
            communicationExercise: {
                title: "Presenting a Sustainable Masterplan to a Municipal Planning Board",
                prompt: "Walk city councilors through your proposed community masterplan, demonstrating how pedestrian greenways and passive water drainage will enhance civic pride and lower flooding risks.",
                framework: "Vision Hook ➔ Ecological Evidence ➔ Community Benefit ➔ Walkthrough",
                why: "Architects must communicate spatial dreams into tangible, approved civic realities."
            }
        },

        // --- 17. Sports, Athletics & Fitness ---
        {
            id: "sports_performance_scientist",
            domainId: "sports_fitness",
            category: "Sports & Performance",
            title: "Sports Performance Scientist & Biomechanist",
            icon: "🏃",
            desc: "Apply human biomechanics, neuromuscular conditioning, and data analytics to optimize elite athletic performance, prevent injury, and accelerate recovery.",
            targetDimensions: {
                problemSolving: 5,
                analyticalReasoning: 4,
                communication: 4,
                execution: 5,
                collaboration: 4,
                curiosity: 4,
                careerValues: 3
            },
            workStyle: "High-performance training facility sessions, force plate kinetic testing, GPS telemetry analysis.",
            communicationStyle: "Motivational athlete coaching, translating complex kinetic data into intuitive movement cues.",
            environment: "Olympic training centers, professional sports clubs, high-performance athletic clinics.",
            typicalActivities: [
                "Analyze high-speed motion capture and force plate telemetry to diagnose kinetic chain leaks",
                "Design periodized strength and neuromuscular power training programs for elite athletes",
                "Monitor acute-to-chronic workload ratios to proactively prevent soft-tissue injuries",
                "Collaborate with orthopedic surgeons and physical therapists on return-to-play protocols"
            ],
            strengthsRequired: ["Biomechanics", "Kinetic Movement Analysis", "Athlete Communication", "Data Tracking"],
            potentialFriction: "Athlete resistance to wearable sensors or modified workloads; intense competition calendar schedules.",
            missingEvidenceCheck: "Assess passion for human physiology, biomechanics, athletic training, and performance data.",
            learningRequirements: "Degree in Exercise Science, Kinesiology, Biomechanics, or CSCS (Certified Strength and Conditioning Specialist) certification.",
            careerProgression: "Performance Coach ➔ Head Sports Scientist ➔ Director of High Performance ➔ General Manager / Olympic Director",
            phases: [
                {
                    title: "Phase 1: Foundation (Anatomy & Exercise Physiology)",
                    steps: "Master Human Musculoskeletal Anatomy, Exercise Physiology, Biomechanical Kinetics, and Energy Systems."
                },
                {
                    title: "Phase 2: Skills & Tooling (Performance Tech & Analytics)",
                    steps: "Master force plates (Hawkin/VALD), GPS tracking (Catapult), velocity-based training (VBT), and periodization theory."
                },
                {
                    title: "Phase 3: Projects & Case Studies (Athlete Periodization)",
                    steps: "Build a 12-month periodized training plan for a sprinter or footballer, modeling taper peaks and fatigue recovery."
                },
                {
                    title: "Phase 4: Experience & Team Internships",
                    steps: "Work with collegiate or professional athletic teams, managing telemetry data and warm-up/cool-down protocols."
                },
                {
                    title: "Phase 5: High-Performance Leadership",
                    steps: "Oversee sports science departments for premier sports franchises or national Olympic federations."
                }
            ],
            realityCheck: {
                scenario: "A star soccer player's weekly GPS telemetry reveals a 35% spike in high-speed running distance compared to their 4-week baseline, alongside an asymmetric 12% asymmetry in left-to-right force plate jump landings.",
                task: "What is the science-backed recommendation for tomorrow's match?",
                options: [
                    { id: "opt_a", text: "Ignore the data and push the athlete to run twice as much to build mental toughness.", correct: false, note: "Dangerous: High acute spikes combined with landing asymmetry are the primary precursor to hamstring and ACL tears." },
                    { id: "opt_b", text: "Flag an acute soft-tissue injury risk to the head coach; recommend limiting match minutes and implementing focused unilateral eccentric loading and recovery protocols.", correct: true, note: "Sports science protects elite assets by intervening before subclinical fatigue translates into structural season-ending tears." },
                    { id: "opt_c", text: "Tell the athlete they are faking fatigue.", correct: false, note: "Objective telemetry data does not lie; dismissing it alienates athletes and destroys trust." }
                ],
                debrief: "Sports scientists safeguard athletic careers by reading physiological telemetry before catastrophic injuries occur."
            },
            learningResources: {
                learn: [
                    { title: "National Strength and Conditioning Association (NSCA)", provider: "NSCA", desc: "Scientific principles of athletic conditioning and biomechanics." }
                ],
                practice: [
                    { title: "Kinovea Video Biomechanics", type: "Software Tool", desc: "Free, open-source video movement analysis for kinematic angles." }
                ],
                build: [
                    { title: "Athlete Monitoring Telemetry Dashboard", desc: "Build an automated dashboard flagging acute:chronic workload spikes in Python or Google Sheets." }
                ],
                read: [
                    { title: "Supertraining", author: "Yuri Verkhoshansky & Mel Siff", isbn: "9788890403811", year: 2009, rating: "4.9", desc: "The definitive encyclopedia of high-performance physical preparation." }
                ],
                explore: [
                    { title: "Journal of Strength and Conditioning Research", desc: "Peer-reviewed applied sports science studies." }
                ]
            },
            communicationExercise: {
                title: "Explaining Workload Management to a Hard-Charging Head Coach",
                prompt: "Advise a demanding head coach why resting their star striker for 30 minutes in a mid-week game is vital to prevent an impending 3-month injury layoff.",
                framework: "Data Evidence ➔ Risk Projection ➔ Strategic Compromise",
                why: "Sports scientists must communicate performance risk assertively to competitive coaches."
            }
        },

        // --- 18. Education & EdTech ---
        {
            id: "edtech_learning_architect",
            domainId: "education",
            category: "Education & EdTech",
            title: "EdTech Learning Architect & Curriculum Innovator",
            icon: "🎓",
            desc: "Design transformative digital learning experiences, interactive pedagogies, and AI-assisted educational platforms that democratize global mastery.",
            targetDimensions: {
                creativity: 5,
                communication: 5,
                careerValues: 5,
                systemsThinking: 4,
                curiosity: 5,
                collaboration: 4,
                problemSolving: 4,
                execution: 3
            },
            workStyle: "Pedagogical design, learner experience wireframing, cognitive psychology research, content production.",
            communicationStyle: "Crystal-clear explanations, engaging multimodal tutorials, empathetic mentoring.",
            environment: "EdTech companies, innovative university learning labs, open-learning foundations.",
            typicalActivities: [
                "Decompose complex academic or professional subjects into progressive scaffolded learning modules",
                "Design interactive simulations and gamified feedback loops that cement deep conceptual intuition",
                "Analyze learner drop-off points to iteratively improve retention and comprehension",
                "Train generative AI tutors to offer Socratic guidance rather than spoon-feeding direct answers"
            ],
            strengthsRequired: ["Instructional Design", "Cognitive Empathy", "Conceptual Clarity", "Gamified Learning Systems"],
            potentialFriction: "High learner attrition in asynchronous digital courses; balancing depth with engaging entertainment.",
            missingEvidenceCheck: "Assess passion for teaching, cognitive science, simplifying complex ideas, and educational equity.",
            learningRequirements: "Degree in Education, Cognitive Science, Instructional Design, or proven track record of creating beloved educational courses.",
            careerProgression: "Instructional Designer ➔ Learning Experience Lead ➔ Head of Curriculum ➔ Chief Learning Officer",
            phases: [
                {
                    title: "Phase 1: Foundation (Cognitive Science & Learning Theory)",
                    steps: "Master Bloom's Taxonomy, Cognitive Load Theory, Spaced Repetition, and Deliberate Practice paradigms."
                },
                {
                    title: "Phase 2: Skills & Tooling (Curriculum Architecture & Media)",
                    steps: "Learn interactive authoring tools, video production, Socratic prompt engineering, and LMS analytics."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Comprehensive Course Experience)",
                    steps: "Build an interactive, gamified 5-module digital mini-course with 80%+ completion rate in real user testing."
                },
                {
                    title: "Phase 4: Experience & EdTech Product Squads",
                    steps: "Collaborate with product and engineering teams at leading educational platforms (Duolingo/Khan Academy models)."
                },
                {
                    title: "Phase 5: Educational Leadership & Scaled Impact",
                    steps: "Direct global educational platforms, publish learning frameworks, and democratize access to world-class mastery."
                }
            ],
            realityCheck: {
                scenario: "A 10-week online software engineering course has a 90% drop-off rate by Week 3. Learner feedback indicates they feel overwhelmed and isolated during their first independent coding assignment.",
                task: "What pedagogical redesign best restores learner momentum and completion?",
                options: [
                    { id: "opt_a", text: "Make the final exam harder so only the most committed students remain.", correct: false, note: "Punitively accelerates dropouts rather than diagnosing pedagogical failure." },
                    { id: "opt_b", text: "Introduce scaffolded 'faded examples', interactive instant-feedback code sandboxes, and peer accountability study pods for Week 3.", correct: true, note: "Scaffolding complex transitions with immediate feedback loops and social accountability bridges the gap from passive theory to active practice." },
                    { id: "opt_c", text: "Send automated robotic reminder emails every hour.", correct: false, note: "Nagging notifications do not solve cognitive overwhelm or lack of instructional clarity." }
                ],
                debrief: "Master educators recognize that learner drop-off is almost always a failure of instructional scaffolding, not student capability."
            },
            learningResources: {
                learn: [
                    { title: "Learning How to Learn", provider: "Deep Teaching Solutions / Barbara Oakley", desc: "Powerful mental tools to help master tough subjects." }
                ],
                practice: [
                    { title: "Khan Academy Pedagogy Reviews", type: "Case Studies", desc: "Deconstruct how mastery-based progression is structured." }
                ],
                build: [
                    { title: "Interactive Socratic Learning Widget", desc: "Build an interactive explainer with sliders and instant visual feedback for a complex concept." }
                ],
                read: [
                    { title: "Make It Stick: The Science of Successful Learning", author: "Peter C. Brown", isbn: "9780674729018", year: 2014, rating: "4.8", desc: "Concrete cognitive psychology insights into memory, retrieval, and durable mastery." },
                    { title: "Mindstorms: Children, Computers, and Powerful Ideas", author: "Seymour Papert", isbn: "9780465046744", year: 1980, rating: "4.9", desc: "Constructionism and how interactive computational worlds empower learning." }
                ],
                explore: [
                    { title: "EdSurge & HolonIQ", desc: "Global intelligence and trends in education technology and future of learning." }
                ]
            },
            communicationExercise: {
                title: "Explaining a Complex Scientific Concept using the Feynman Technique",
                prompt: "Explain how public-key cryptography works using simple metaphors (like locks and mailboxes) that an 8-year-old or non-technical senior could easily grasp.",
                framework: "Feynman Simplification: Concept ➔ Common Metaphor ➔ Everyday Analogy ➔ Insight",
                why: "Great educators possess the rare gift of illuminating complex abstractions with sparkling clarity."
            }
        },

        // --- 19. Emerging & Interdisciplinary ---
        {
            id: "climate_tech_systems_architect",
            domainId: "emerging_interdisciplinary",
            category: "Emerging & Interdisciplinary",
            title: "Climate Tech & Clean Energy Systems Architect",
            icon: "🌐",
            desc: "Pioneer planetary-scale decarbonization, next-generation battery storage, grid modernization, and carbon-removal technologies.",
            targetDimensions: {
                systemsThinking: 5,
                careerValues: 5,
                curiosity: 5,
                analyticalReasoning: 5,
                problemSolving: 5,
                riskTolerance: 4,
                creativity: 4,
                execution: 4
            },
            workStyle: "Techno-economic modeling, grid simulation, clean energy prototype engineering, environmental policy coordination.",
            communicationStyle: "Techno-economic viability reports, green premium deconstructions, pitching climate venture funds.",
            environment: "Clean tech accelerators, energy research laboratories, national grid dispatch centers.",
            typicalActivities: [
                "Model grid-scale renewable intermittency and battery energy storage systems (BESS)",
                "Calculate levelized cost of energy (LCOE) and green premiums across emerging fuels (green hydrogen)",
                "Simulate industrial carbon capture, utilization, and storage (CCUS) thermodynamic cycles",
                "Coordinate techno-economic feasibility studies for institutional infrastructure investors"
            ],
            strengthsRequired: ["Thermodynamic Systems", "Techno-Economic Modeling", "Planetary Vision", "Cross-Disciplinary Grit"],
            potentialFriction: "Capital-intensive hardware deployment cycles; fluctuating regulatory carbon credit pricing.",
            missingEvidenceCheck: "Assess deep commitment to environmental stewardship, physics, thermodynamics, and large-scale infrastructure.",
            learningRequirements: "Degree in Energy Engineering, Chemical, Electrical, Environmental Engineering, or applied physics.",
            careerProgression: "Clean Energy Analyst ➔ Senior Systems Architect ➔ VP of Climate Engineering ➔ Clean Tech Venture Founder",
            phases: [
                {
                    title: "Phase 1: Foundation (Thermodynamics, Energy & Chemistry)",
                    steps: "Master Thermodynamics, Heat Transfer, Electrochemistry, Electrical Grid Fundamentals, and climate science."
                },
                {
                    title: "Phase 2: Skills & Tooling (Techno-Economic & Grid Modeling)",
                    steps: "Learn Python energy modeling frameworks (PyPSA, SAM), geospatial mapping (GIS), and lifecycle emissions accounting (LCA)."
                },
                {
                    title: "Phase 3: Projects & Portfolio (Regional Decarbonization Model)",
                    steps: "Model a regional electrical grid transitioning to 90% renewables + 4-hour battery storage, calculating curtailment and costs."
                },
                {
                    title: "Phase 4: Experience & Climate Tech Ecosystems",
                    steps: "Join climate venture incubators, intern at clean energy utilities or direct-air-capture startups, and publish analyses."
                },
                {
                    title: "Phase 5: Planetary Leadership & Infrastructure Scale",
                    steps: "Lead gigawatt-scale renewable deployment, secure non-dilutive climate grants, and spearhead industrial decarbonization."
                }
            ],
            realityCheck: {
                scenario: "A prospective clean tech innovation can capture carbon from air at $800 per ton, but the current market price for voluntary carbon offsets is $30 per ton.",
                task: "What is the primary engineering and techno-economic imperative?",
                options: [
                    { id: "opt_a", text: "Give up immediately because it is not profitable on day one.", correct: false, note: "Defeatist: Solar and lithium batteries also cost 50x more 20 years ago before scaling down learning curves." },
                    { id: "opt_b", text: "Map out the physics and supply-chain 'learning rate' cost-reduction curve: identify thermodynamic energy efficiencies, manufacturing scale, and cheap geothermal/waste heat to reach the $100/ton threshold.", correct: true, note: "Climate tech relies on Wright's Law learning curves; architects chart the path from expensive early prototypes to competitive mass deployment." },
                    { id: "opt_c", text: "Sell the carbon at $30 anyway and absorb $770 losses per ton with no plan.", correct: false, note: "Insolvent: Without a credible path to cost parity, the enterprise collapses." }
                ],
                debrief: "Climate systems architects bridge hard physical laws with economic reality to build a regenerative planetary future."
            },
            learningResources: {
                learn: [
                    { title: "Terra.do Climate Fellowships", provider: "Terra.do", desc: "The premier global bootcamp for climate science and clean technology careers." }
                ],
                practice: [
                    { title: "Project Drawdown Solutions", type: "Framework", desc: "Evidence-based quantitative evaluations of top 100 climate solutions." }
                ],
                build: [
                    { title: "Microgrid Dispatch Optimization Model", desc: "Build a Python simulation optimizing solar, wind, and battery dispatch against dynamic electricity prices." }
                ],
                read: [
                    { title: "How to Avoid a Climate Disaster", author: "Bill Gates", isbn: "9780385546133", year: 2021, rating: "4.7", desc: "The solutions we have and the breakthroughs we need; introducing the 'Green Premium' framework." },
                    { title: "Speed & Scale", author: "John Doerr", isbn: "9780593420416", year: 2021, rating: "4.8", desc: "An action plan for solving our climate crisis now using OKRs." }
                ],
                explore: [
                    { title: "My Climate Journey (MCJ) Collective", desc: "The world's leading community for climate tech builders and investors." }
                ]
            },
            communicationExercise: {
                title: "Deconstructing the 'Green Premium' for Industrial Customers",
                prompt: "Persuade a steel manufacturing company to switch to zero-emission green hydrogen, highlighting long-term regulatory carbon taxes and brand equity.",
                framework: "Current Cost vs. Future Liability ➔ Technological Roadmap ➔ Competitive Advantage",
                why: "Climate leaders must translate planetary benefits into undeniable commercial arguments."
            }
        },

        // --- 20. Skilled & Technical Careers ---
        {
            id: "aerospace_avionics_technician",
            domainId: "skilled_technical",
            category: "Skilled & Technical Crafts",
            title: "Aerospace Avionics & Mechatronics Specialist",
            icon: "🔧",
            desc: "Perform precision calibration, diagnostics, and structural maintenance on advanced commercial aviation, satellite, and autonomous spacecraft systems.",
            targetDimensions: {
                execution: 5,
                problemSolving: 5,
                analyticalReasoning: 4,
                systemsThinking: 4,
                independence: 3,
                collaboration: 4,
                riskTolerance: 2
            },
            workStyle: "High-precision physical assembly, diagnostic oscilloscopes, strict adherence to aviation regulatory checklists.",
            communicationStyle: "Rigorous maintenance logbook sign-offs, FAA/DGCA compliant reporting, debriefing flight crews.",
            environment: "Aircraft hangars, cleanrooms, defense maintenance depots, space launch integration facilities.",
            typicalActivities: [
                "Diagnose fly-by-wire flight control computers, radar transponders, and inertial navigation units",
                "Inspect high-voltage harness integrity using time-domain reflectometry and mil-spec test equipment",
                "Execute Federal Aviation Administration (FAA) or DGCA airworthiness directives",
                "Perform engine borescope inspections and avionics software telemetry updates"
            ],
            strengthsRequired: ["Extreme Precision", "Technical Diagnostics", "Regulatory Compliance", "Safety Culture"],
            potentialFriction: "Zero tolerance for error; working with complex wiring schematics under strict turnaround flight schedules.",
            missingEvidenceCheck: "Assess hands-on mechanical aptitude, spatial precision, and deep respect for safety protocols.",
            learningRequirements: "AME (Aircraft Maintenance Engineering) license or Associate Degree in Avionics / Mechatronics.",
            careerProgression: "Avionics Technician ➔ Licensed Aircraft Maintenance Engineer ➔ Quality Assurance Lead ➔ Director of Fleet Maintenance",
            phases: [
                {
                    title: "Phase 1: Foundation (Aerodynamics, Electronics & Air Law)",
                    steps: "Master DC/AC electrical circuits, aircraft instruments, digital logic, and civil aviation safety regulations."
                },
                {
                    title: "Phase 2: Skills & Certification (AME Modular Exams)",
                    steps: "Clear regulatory module exams (DGCA/FAA/EASA), master oscilloscopes, multimeters, and wiring crimp specifications."
                },
                {
                    title: "Phase 3: Practical Hangar Apprenticeship",
                    steps: "Complete 2,000+ hours of documented hands-on maintenance on airframes, powerplants, and navigation avionics."
                },
                {
                    title: "Phase 4: Aircraft Type Ratings",
                    steps: "Obtain specialized type certification on commercial jets (e.g. Airbus A320, Boeing 737 MAX) or space launch vehicles."
                },
                {
                    title: "Phase 5: Master Inspector & Fleet Airworthiness",
                    steps: "Certify aircraft for release-to-service, lead avionics retrofit modifications, and audit hangar safety standards."
                }
            ],
            realityCheck: {
                scenario: "Prior to takeoff, an aircraft's auxiliary power unit (APU) generator shows intermittent voltage drops on the master cockpit annunciator panel. The flight is full and passengers are boarding.",
                task: "What is your mandatory protocol as the certifying avionics specialist?",
                options: [
                    { id: "opt_a", text: "Reset the circuit breaker and tell the pilot to ignore it if it resets.", correct: false, note: "Dangerous: Blindly resetting tripped breakers without root-cause diagnosis risks electrical fires." },
                    { id: "opt_b", text: "Consult the Minimum Equipment List (MEL), perform diagnostic fault-isolation tests on the generator control unit (GCU), and only sign release-to-service if authorized safety redundancies are met.", correct: true, note: "Aviation safety is built on unwavering discipline: never release an aircraft unless compliant with MEL and manufacturer manuals." },
                    { id: "opt_c", text: "Sign the logbook without checking to avoid flight delay penalties.", correct: false, note: "Criminal negligence and grounds for immediate license revocation." }
                ],
                debrief: "Skilled aerospace technicians hold human lives in their hands with every rivet, wire crimp, and logbook signature."
            },
            learningResources: {
                learn: [
                    { title: "FAA Aviation Maintenance Technician Handbook", provider: "FAA", desc: "The official guide to airframe and avionics maintenance." }
                ],
                practice: [
                    { title: "Avionics Circuit Fault Simulator", type: "Simulation", desc: "Interactive troubleshooting of aircraft electrical busses." }
                ],
                build: [
                    { title: "Miniature Flight Control Interface", desc: "Wire and program a micro-avionics flight telemetry display using Arduino and an IMU." }
                ],
                read: [
                    { title: "Skunk Works", author: "Ben R. Rich", isbn: "9780316743006", year: 1996, rating: "4.9", desc: "A personal memoir of my years at Lockheed; building the U-2, SR-71 Blackbird, and F-117 Nighthawk." }
                ],
                explore: [
                    { title: "Aviation Maintenance Magazine", desc: "Industry developments in MRO, avionics upgrades, and aerospace safety." }
                ]
            },
            communicationExercise: {
                title: "Delivering an Uncompromising Grounding Notice to Flight Operations",
                prompt: "Explain to a frustrated airline flight dispatcher why an aircraft cannot be dispatched on schedule due to an avionics bus grounding fault, holding firm to regulatory airworthiness rules.",
                framework: "Safety First Statement + Factual Diagnostic + Required Maintenance Time",
                why: "Technical specialists must stand firm against commercial pressures when safety is at stake."
            }
        }
    ];

    // Export to global and module environments
    root.COMPASS_DIMENSIONS = COMPASS_DIMENSIONS;
    root.COMPASS_DOMAINS = COMPASS_DOMAINS;
    root.COMPASS_QUESTIONS = COMPASS_QUESTIONS;
    root.COMPASS_CAREERS = COMPASS_CAREERS;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            COMPASS_DIMENSIONS,
            COMPASS_DOMAINS,
            COMPASS_QUESTIONS,
            COMPASS_CAREERS
        };
    }

})(typeof window !== 'undefined' ? window : global);
