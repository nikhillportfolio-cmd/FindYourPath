/**
 * PRAXiS Fluency Lab - Static Sentence & Exercise Library
 * Structured by 6 Progressive Difficulty Levels across 8 Realistic Speaking Topics.
 * NO External AI API needed. 100% deterministic local data.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FluencyLabData = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const EXERCISE_LEVELS = [
        {
            level: 1,
            name: "Smooth Reading",
            badge: "Level 1",
            icon: "📖",
            description: "Read natural English sentences smoothly with steady pace, minimal hesitation, and zero fillers.",
            type: "smooth_reading",
            duration: 30
        },
        {
            level: 2,
            name: "Phrase Chunking",
            badge: "Level 2",
            icon: "🧩",
            description: "Speak in natural thought phrases instead of word-by-word, pausing only at meaningful boundaries.",
            type: "phrase_chunking",
            duration: 35
        },
        {
            level: 3,
            name: "Sentence Expansion",
            badge: "Level 3",
            icon: "📈",
            description: "Progressively build a short thought into a rich, detailed compound-complex sentence.",
            type: "sentence_expansion",
            duration: 45
        },
        {
            level: 4,
            name: "Connect the Thoughts",
            badge: "Level 4",
            icon: "🔗",
            description: "Merge two separate ideas into one cohesive, fluent sentence using appropriate discourse connectors.",
            type: "connect_thoughts",
            duration: 40
        },
        {
            level: 5,
            name: "Quick Response",
            badge: "Level 5",
            icon: "⚡",
            description: "Answer spontaneous prompt questions within a 15-second response window to eliminate hesitation.",
            type: "quick_response",
            duration: 30
        },
        {
            level: 6,
            name: "Situation Response",
            badge: "Level 6",
            icon: "💼",
            description: "Navigate real-world workplace, interview, and conversational scenarios with executive fluency.",
            type: "situation_response",
            duration: 60
        }
    ];

    const EXERCISES = [
        // =====================================================================
        // LEVEL 1: SMOOTH READING
        // =====================================================================
        {
            id: "sr-1",
            level: 1,
            type: "smooth_reading",
            topic: "Everyday English",
            title: "Morning Routine Decision",
            text: "Although the weather was bad, we decided to continue our journey without any delay.",
            instruction: "Read this sentence naturally and smoothly from start to finish.",
            targetWpmRange: [110, 150],
            minWords: 13
        },
        {
            id: "sr-2",
            level: 1,
            type: "smooth_reading",
            topic: "Opinions",
            title: "Technology in Everyday Life",
            text: "Modern smartphones have transformed the way people communicate and collaborate across the globe.",
            instruction: "Read with clear enunciation and a relaxed, steady rhythm.",
            targetWpmRange: [110, 150],
            minWords: 13
        },
        {
            id: "sr-3",
            level: 1,
            type: "smooth_reading",
            topic: "Workplace",
            title: "Team Alignment",
            text: "Before starting the new project, the team gathered to review the core deliverables and deadlines.",
            instruction: "Maintain a steady speaking pace without stopping between words.",
            targetWpmRange: [110, 150],
            minWords: 14
        },
        {
            id: "sr-4",
            level: 1,
            type: "smooth_reading",
            topic: "Experiences",
            title: "Travel Memory",
            text: "Walking through the ancient city center reminded me of how much history remains hidden in plain sight.",
            instruction: "Deliver the full sentence smoothly without inserting filler words.",
            targetWpmRange: [110, 150],
            minWords: 16
        },
        {
            id: "sr-5",
            level: 1,
            type: "smooth_reading",
            topic: "Professional English",
            title: "Customer Satisfaction",
            text: "Providing exceptional customer service requires listening carefully and offering prompt, practical solutions.",
            instruction: "Read smoothly with natural vocal inflection and confident clarity.",
            targetWpmRange: [110, 150],
            minWords: 12
        },

        // =====================================================================
        // LEVEL 2: PHRASE CHUNKING
        // =====================================================================
        {
            id: "pc-1",
            level: 2,
            type: "phrase_chunking",
            topic: "Everyday English",
            title: "Journey Continuation",
            text: "Although the weather was bad, we decided to continue our journey.",
            chunks: [
                "Although the weather was bad",
                "we decided to continue",
                "our journey"
            ],
            chunkedText: "Although the weather was bad / we decided to continue / our journey.",
            instruction: "Speak in natural phrases instead of word-by-word. Take micro-pauses at the slashes (/).",
            targetWpmRange: [105, 145],
            minWords: 10
        },
        {
            id: "pc-2",
            level: 2,
            type: "phrase_chunking",
            topic: "Professional English",
            title: "Strategic Planning",
            text: "To achieve long-term growth, our organization must invest in talent and streamline daily operations.",
            chunks: [
                "To achieve long-term growth",
                "our organization must invest in talent",
                "and streamline daily operations"
            ],
            chunkedText: "To achieve long-term growth / our organization must invest in talent / and streamline daily operations.",
            instruction: "Link words inside each chunk smoothly, pausing briefly only between chunks.",
            targetWpmRange: [110, 150],
            minWords: 13
        },
        {
            id: "pc-3",
            level: 2,
            type: "phrase_chunking",
            topic: "Opinions",
            title: "Continuous Learning",
            text: "Learning a new language opens up unexpected opportunities and broadens your global worldview.",
            chunks: [
                "Learning a new language",
                "opens up unexpected opportunities",
                "and broadens your global worldview"
            ],
            chunkedText: "Learning a new language / opens up unexpected opportunities / and broadens your global worldview.",
            instruction: "Flow through each phrase without hesitation inside the group.",
            targetWpmRange: [110, 150],
            minWords: 12
        },
        {
            id: "pc-4",
            level: 2,
            type: "phrase_chunking",
            topic: "Workplace",
            title: "Effective Meetings",
            text: "When leading a team meeting, always establish a clear agenda and encourage active participation.",
            chunks: [
                "When leading a team meeting",
                "always establish a clear agenda",
                "and encourage active participation"
            ],
            chunkedText: "When leading a team meeting / always establish a clear agenda / and encourage active participation.",
            instruction: "Group words into 3 distinct rhythmic units.",
            targetWpmRange: [110, 150],
            minWords: 13
        },

        // =====================================================================
        // LEVEL 3: SENTENCE EXPANSION
        // =====================================================================
        {
            id: "se-1",
            level: 3,
            type: "sentence_expansion",
            topic: "Everyday English",
            title: "Market Trip Expansion",
            tiers: [
                {
                    tier: 1,
                    text: "I went to the market.",
                    wordCount: 5,
                    instruction: "Tier 1: Read this short base sentence cleanly."
                },
                {
                    tier: 2,
                    text: "I went to the market because I needed some fresh groceries.",
                    wordCount: 10,
                    instruction: "Tier 2: Expand with the reason clause."
                },
                {
                    tier: 3,
                    text: "I went to the market because I needed some fresh groceries, but I couldn't find everything I wanted.",
                    wordCount: 18,
                    instruction: "Tier 3: Produce the full expanded thought with both clauses."
                }
            ],
            text: "I went to the market because I needed some fresh groceries, but I couldn't find everything I wanted.",
            instruction: "Step through the 3 expansion tiers to train comfortable production of longer sentences.",
            targetWpmRange: [110, 150],
            minWords: 16
        },
        {
            id: "se-2",
            level: 3,
            type: "sentence_expansion",
            topic: "Professional English",
            title: "Project Delivery Expansion",
            tiers: [
                {
                    tier: 1,
                    text: "We finished the project.",
                    wordCount: 4,
                    instruction: "Tier 1: Start with the foundation statement."
                },
                {
                    tier: 2,
                    text: "We finished the project on time by prioritizing our core technical milestones.",
                    wordCount: 11,
                    instruction: "Tier 2: Add the execution method."
                },
                {
                    tier: 3,
                    text: "We finished the project on time by prioritizing our core technical milestones, which earned positive feedback from senior leadership.",
                    wordCount: 19,
                    instruction: "Tier 3: Speak the full executive result."
                }
            ],
            text: "We finished the project on time by prioritizing our core technical milestones, which earned positive feedback from senior leadership.",
            instruction: "Progressively produce longer complex thoughts without losing breath or pacing.",
            targetWpmRange: [110, 155],
            minWords: 17
        },
        {
            id: "se-3",
            level: 3,
            type: "sentence_expansion",
            topic: "Opinions",
            title: "Reading Habit Expansion",
            tiers: [
                {
                    tier: 1,
                    text: "I enjoy reading books.",
                    wordCount: 4,
                    instruction: "Tier 1: Express the baseline interest."
                },
                {
                    tier: 2,
                    text: "I enjoy reading books every evening to unwind after work.",
                    wordCount: 10,
                    instruction: "Tier 2: Add frequency and purpose."
                },
                {
                    tier: 3,
                    text: "I enjoy reading books every evening to unwind after work, especially historical non-fiction that provides valuable life lessons.",
                    wordCount: 18,
                    instruction: "Tier 3: Complete the full expanded perspective."
                }
            ],
            text: "I enjoy reading books every evening to unwind after work, especially historical non-fiction that provides valuable life lessons.",
            instruction: "Train your mental endurance by articulating complete compound thoughts smoothly.",
            targetWpmRange: [110, 150],
            minWords: 16
        },

        // =====================================================================
        // LEVEL 4: CONNECT THE THOUGHTS (CONNECTOR PRACTICE)
        // =====================================================================
        {
            id: "ct-1",
            level: 4,
            type: "connect_thoughts",
            topic: "Connectors",
            title: "Fatigue vs Completion",
            ideaA: "I was extremely tired.",
            ideaB: "I finished all my assignments before midnight.",
            suggestedConnectors: ["although", "even though", "despite", "however", "but"],
            sampleAnswers: [
                "Although I was extremely tired, I finished all my assignments before midnight.",
                "I was extremely tired, but I finished all my assignments before midnight.",
                "Even though I was very tired, I managed to complete all my assignments on time."
            ],
            instruction: "Combine these two ideas into one natural, fluent sentence using a connector.",
            targetWpmRange: [100, 145],
            minWords: 10
        },
        {
            id: "ct-2",
            level: 4,
            type: "connect_thoughts",
            topic: "Connectors",
            title: "Weather vs Outdoor Plans",
            ideaA: "The forecast predicted heavy rain all afternoon.",
            ideaB: "We organized an indoor workshop for the entire group.",
            suggestedConnectors: ["therefore", "because", "since", "so", "as a result"],
            sampleAnswers: [
                "Since the forecast predicted heavy rain, we organized an indoor workshop for the entire group.",
                "The forecast predicted heavy rain all afternoon, so we organized an indoor workshop instead."
            ],
            instruction: "Express cause and effect smoothly using a connector.",
            targetWpmRange: [100, 145],
            minWords: 12
        },
        {
            id: "ct-3",
            level: 4,
            type: "connect_thoughts",
            topic: "Connectors",
            title: "Budget Constraints vs Innovation",
            ideaA: "Our team had a very limited marketing budget.",
            ideaB: "We achieved record customer signups through organic community outreach.",
            suggestedConnectors: ["despite", "although", "nevertheless", "yet", "however"],
            sampleAnswers: [
                "Despite having a limited marketing budget, our team achieved record signups through organic community outreach.",
                "Although our budget was small, we achieved record customer signups through community outreach."
            ],
            instruction: "Contrast constraint with success in a cohesive sentence.",
            targetWpmRange: [105, 150],
            minWords: 12
        },
        {
            id: "ct-4",
            level: 4,
            type: "connect_thoughts",
            topic: "Connectors",
            title: "Career Growth vs Risk Taking",
            ideaA: "Stepping into leadership roles can feel intimidating.",
            ideaB: "It accelerates personal and professional growth faster than staying comfortable.",
            suggestedConnectors: ["while", "although", "even though", "because", "on the other hand"],
            sampleAnswers: [
                "While stepping into leadership can feel intimidating, it accelerates personal growth faster than staying comfortable.",
                "Although leadership roles are intimidating, they accelerate professional growth significantly."
            ],
            instruction: "Unify both perspectives into one confident statement.",
            targetWpmRange: [105, 150],
            minWords: 12
        },

        // =====================================================================
        // LEVEL 5: QUICK RESPONSE
        // =====================================================================
        {
            id: "qr-1",
            level: 5,
            type: "quick_response",
            topic: "Experiences",
            title: "Yesterday's Accomplishment",
            promptQuestion: "What was the most productive thing you did yesterday, and why did it matter to you?",
            responseWindowSeconds: 15,
            guidance: "State your point immediately, give one reason, and wrap up in 2-3 clean sentences.",
            instruction: "Start speaking within 10–15 seconds. Deliver 20–40 words with zero fillers.",
            targetWpmRange: [100, 145],
            minWords: 15
        },
        {
            id: "qr-2",
            level: 5,
            type: "quick_response",
            topic: "Opinions",
            title: "Favorite Habit",
            promptQuestion: "What is one daily habit that has significantly improved your focus or productivity?",
            responseWindowSeconds: 15,
            guidance: "Name the habit right away and briefly explain how it benefits your day.",
            instruction: "Minimize start hesitation. Answer spontaneously and fluently.",
            targetWpmRange: [100, 145],
            minWords: 15
        },
        {
            id: "qr-3",
            level: 5,
            type: "quick_response",
            topic: "Professional English",
            title: "Handling Urgent Requests",
            promptQuestion: "How do you decide what to do first when you receive three urgent tasks at once?",
            responseWindowSeconds: 15,
            guidance: "Outline a quick prioritization principle (e.g., impact vs deadline).",
            instruction: "Speak with confidence and continuous pacing without long pauses.",
            targetWpmRange: [100, 150],
            minWords: 15
        },

        // =====================================================================
        // LEVEL 6: SITUATION RESPONSE (REAL-WORLD & PROFESSIONAL)
        // =====================================================================
        {
            id: "sr-sit-1",
            level: 6,
            type: "situation_response",
            topic: "Workplace",
            title: "Explaining an Unforeseen Delay",
            scenario: "Your project manager asks: 'Why was the sprint release delayed by two days, and what are we doing to prevent it next time?'",
            promptQuestion: "Explain the root cause professionally and outline your immediate corrective action.",
            guidance: "Acknowledge the delay directly ➔ State the root cause ➔ Present the preventative measure.",
            instruction: "Answer in a natural, executive tone. Aim for 40–70 words with clear discourse markers.",
            targetWpmRange: [110, 150],
            minWords: 25
        },
        {
            id: "sr-sit-2",
            level: 6,
            type: "situation_response",
            topic: "Interview",
            title: "Skill You Want to Improve",
            scenario: "An interviewer asks: 'What is one professional skill you are actively working to improve this year?'",
            promptQuestion: "Name the skill, explain why it is valuable to your career, and describe how you practice it.",
            guidance: "Specific skill ➔ Reason for choosing it ➔ Concrete learning habit or practice.",
            instruction: "Respond with authentic conviction, steady rhythm, and zero filler words.",
            targetWpmRange: [110, 150],
            minWords: 25
        },
        {
            id: "sr-sit-3",
            level: 6,
            type: "situation_response",
            topic: "Group Discussion",
            title: "Advocating for a Sustainable Policy",
            scenario: "In a team brainstorming session, a colleague proposes cutting remote work days to boost collaboration. You believe flexible hybrid work produces better overall output.",
            promptQuestion: "Respectfully express your viewpoint and provide a balanced argument for hybrid flexibility.",
            guidance: "Validate colleague's intent ➔ Provide counter-evidence ➔ Propose balanced hybrid alternative.",
            instruction: "Deliver a structured, persuasive 45–60 second verbal response.",
            targetWpmRange: [110, 150],
            minWords: 30
        }
    ];

    return {
        EXERCISE_LEVELS,
        EXERCISES,
        getLevelInfo: (levelNum) => EXERCISE_LEVELS.find(l => l.level === Number(levelNum)) || EXERCISE_LEVELS[0],
        getExercisesByLevel: (levelNum) => EXERCISES.filter(e => e.level === Number(levelNum)),
        getExerciseById: (id) => EXERCISES.find(e => e.id === id) || EXERCISES[0]
    };
}));
