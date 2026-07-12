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

// 1. AI DYNAMIC QUESTION GENERATOR
app.get('/api/questions', async (req, res) => {
    const requestedInterest = req.query.interest || "General"; 
    
    try {
        const prompt = `
            You are an expert career counselor and psychologist. A student wants to explore careers in the field of: ${requestedInterest}.
            Generate a personality and skills assessment quiz with exactly 5 highly specific questions tailored to this field.
            Each question must have 4 distinct options.
            Each option must map to 1 or 2 psychological traits (e.g., "Analytical", "Creative", "Leadership", "Empathy", "Technical", "Organized") and assign a point value from 1 to 3.
            
            You MUST return the data strictly as a JSON array. Do not wrap the JSON in markdown blocks. It must perfectly match this schema:
            [
              {
                "text": "String (The specific question)",
                "options": [
                  { "text": "String (Option A)", "tags": { "Analytical": 2, "Technical": 1 } },
                  { "text": "String (Option B)", "tags": { "Creative": 3 } },
                  { "text": "String (Option C)", "tags": { "Leadership": 2, "Empathy": 1 } },
                  { "text": "String (Option D)", "tags": { "Organized": 3 } }
                ]
              }
            ]
        `;

        // Call Gemini to generate the questions
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        // Convert the AI's text into a real JavaScript array and send it to the website
        const aiGeneratedQuestions = JSON.parse(response.text);
        res.json(aiGeneratedQuestions);

    } catch (error) {
        console.error("AI Question Generation Error:", error);
        res.status(500).json({ error: "Failed to generate AI questions." });
    }
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

        // Call Gemini 3.5 Flash, forcing it to return pure JSON
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
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