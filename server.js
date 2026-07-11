require('dotenv').config(); // Loads your .env file
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai'); // Import the Gemini SDK

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Gemini 
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. MASSIVE DYNAMIC QUESTION BANK (Keep your existing questionsDB here!)
const questionsDB = {
    // ... PASTE YOUR EXISTING questionsDB HERE ...
};

app.get('/api/questions', (req, res) => {
    const requestedInterest = req.query.interest; 
    const selectedQuestions = questionsDB[requestedInterest] || questionsDB["TechAI"];
    res.json(selectedQuestions);
});

// 2. THE NEW AI MATCHING ENGINE
app.post('/api/calculate-result', async (req, res) => {
    try {
        const { userTraits, interest, studentInput } = req.body; 
        
        // Construct the prompt for Gemini
        const prompt = `
            You are an expert career counselor for high school and college students. 
            A student is deeply interested in the broad category of: ${interest}.
            They completed a behavioral assessment and demonstrated these dominant traits: ${JSON.stringify(userTraits)}.
            They also provided this personal context about their goals/hobbies: "${studentInput}".
            
            Analyze their psychological traits alongside their personal context. Recommend 4 highly specific, modern career paths tailored exactly to them. 
            
            You MUST return the data strictly as a JSON array. Do not wrap the JSON in markdown blocks (like \`\`\`json). The JSON must perfectly match this schema:
            [
              {
                "title": "String (Name of career)",
                "icon": "Emoji",
                "desc": "String (A short encouraging summary of why it fits them)",
                "phases": [
                  { "title": "Phase 1: Foundation", "steps": "String (Specific actionable steps)" },
                  { "title": "Phase 2: Skill Building", "steps": "String" },
                  { "title": "Phase 3: Career Entry", "steps": "String" }
                ],
                "books": ["String (Book title by Author)", "String"]
              }
            ]
        `;

        // Call Gemini 2.5 Flash, forcing it to return pure JSON
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        // Parse the AI's string response into an actual JavaScript Array
        const aiGeneratedRoadmaps = JSON.parse(response.text);

        // Send the AI generated data back to the frontend!
        res.json(aiGeneratedRoadmaps);

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate AI roadmap." });
    }
});

app.listen(PORT, () => console.log(`AI Matching Engine alive on Port ${PORT}`));